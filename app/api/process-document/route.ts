import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { fileTypeFromBuffer } from 'file-type';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function extractTextFromPdf(dataBuffer: Buffer) {
  try {
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return '';
  }
}

async function performOcr(dataBuffer: Buffer, lang: string) {
  const worker = await createWorker();

  try {
    await worker.load();
    await worker.reinitialize(lang);

    const { data: { text } } = await worker.recognize(dataBuffer);
    await worker.terminate();
    return text;
  } catch (error) {
    await worker.terminate();
    console.error('OCR failed:', error);
    return '';
  }
}

async function translateText(text: string, sourceLang: string, targetLang: string) {
  const apiKey = process.env.NEXT_PUBLIC_TRANSLATION_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const prompt = `Translate the following text from ${sourceLang} to ${targetLang}: ${text}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  const data = await response.json();

  if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    const translatedText = data.candidates[0].content.parts[0].text;
    return translatedText.trim();
  } else {
    console.error('Unexpected response structure:', data);
    throw new Error('Translation failed due to unexpected response structure');
  }
}

async function createTranslatedPdf(originalBuffer: Buffer, translatedText: string) {
  const pdfDoc = await PDFDocument.load(originalBuffer);

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
  const lineHeight = 16;
  const margin = 50;

  let currentPageIndex = 0;
  let currentPage = pdfDoc.getPages()[currentPageIndex];
  let yPosition = currentPage.getSize().height - margin;
  // const maxWidth = currentPage.getSize().width - (2 * margin);

  // Clear the existing text
  pdfDoc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });
  });

  // Process each line
  const lines = translatedText.split('\n');
  for (const line of lines) {
    if (line.trim() === '') {
      yPosition -= lineHeight;
      continue;
    }

    let xPosition = margin;
    const parts = line.split(/(\*\*.*?\*\*)/g);

    for (const part of parts) {
      if (part === '') continue;

      const isBold = part.startsWith('**') && part.endsWith('**');
      const font = isBold ? boldFont : regularFont;
      const text = isBold ? part.slice(2, -2) : part;
      
      // Split text into words
      const words = text.split(' ');
      let currentWord = '';

      for (const word of words) {
        const testLine = currentWord + (currentWord ? ' ' : '') + word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (xPosition + testWidth > currentPage.getSize().width - margin) {
          // Draw current accumulated text before moving to next line
          if (currentWord) {
            currentPage.drawText(currentWord, {
              x: xPosition,
              y: yPosition,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            });
          }

          // Move to next line
          yPosition -= lineHeight;
          xPosition = margin;
          currentWord = word;

          // Check if we need a new page
          if (yPosition < margin) {
            currentPageIndex++;
            if (currentPageIndex < pdfDoc.getPages().length) {
              currentPage = pdfDoc.getPages()[currentPageIndex];
            } else {
              currentPage = pdfDoc.addPage();
            }
            yPosition = currentPage.getSize().height - margin;
          }
        } else {
          currentWord = testLine;
        }
      }

      // Draw remaining text
      if (currentWord) {
        currentPage.drawText(currentWord, {
          x: xPosition,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
        xPosition += font.widthOfTextAtSize(currentWord + ' ', fontSize);
      }
    }

    // Move to next line after processing all parts
    yPosition -= lineHeight;

    // Check if we need a new page
    if (yPosition < margin) {
      currentPageIndex++;
      if (currentPageIndex < pdfDoc.getPages().length) {
        currentPage = pdfDoc.getPages()[currentPageIndex];
      } else {
        currentPage = pdfDoc.addPage();
      }
      yPosition = currentPage.getSize().height - margin;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function POST(request: NextRequest) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';
    const targetLanguage = formData.get('targetLanguage') as string || 'en';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileTypeResult = await fileTypeFromBuffer(buffer);
    const mimeType = fileTypeResult ? fileTypeResult.mime : 'text/plain';

    let text = '';

    if (mimeType === 'application/pdf') {
      text = await extractTextFromPdf(buffer);
    } else if (mimeType.startsWith('image/')) {
      const ocrLang = sourceLanguage !== 'auto' ? mapLanguageToTesseract(sourceLanguage) : 'eng';
      text = await performOcr(buffer, ocrLang);
    } else {
      text = buffer.toString('utf8');
    }

    const translatedText = await translateText(text.trim(), sourceLanguage, targetLanguage);
    const translatedPdfBytes = await createTranslatedPdf(buffer, translatedText);

    return NextResponse.json({
      originalText: text.trim(),
      translatedText: translatedText,
      translatedPdf: Buffer.from(translatedPdfBytes).toString('base64')
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ error: 'Error processing document' }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

function mapLanguageToTesseract(lang: string): string {
  const mapping: { [key: string]: string } = {
    'en': 'eng',
    'hi': 'hin',
    'ta': 'tam',
    'te': 'tel',
    'kn': 'kan',
    'ml': 'mal',
    'bn': 'ben',
    'gu': 'guj',
    'mr': 'mar',
    'pa': 'pan',
    'ur': 'urd',
    'or': 'ori',
    'as': 'asm'
  };
  return mapping[lang] || 'eng';
}
