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

async function translateText(content: Buffer, sourceLang: string, targetLang: string, mimeType: string) {
  const apiKey = process.env.NEXT_PUBLIC_TRANSLATION_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  // Convert buffer to base64
  const base64Content = content.toString('base64');
  
  const requestBody = {
    contents: [{
      parts: [
        {
          text: `Translate this content from ${sourceLang} to ${targetLang}. Don't add any comments or conclusion. use bold tags wherever it looks necessary.`
        },
        {
          inline_data: {
            mime_type: mimeType,
            data: base64Content
          }
        }
      ]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
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

async function createTranslatedPdf(originalBuffer: Buffer, translatedText: string, mimeType: string) {
  try {
    const pdfDoc = mimeType === 'application/pdf' 
      ? await PDFDocument.load(originalBuffer)
      : await PDFDocument.create();

    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    if (mimeType !== 'application/pdf') {
      pdfDoc.addPage([612, 792]); // Standard US Letter size
    }

    const fontSize = 12;
    const lineHeight = 16;
    const margin = 50;

    const pages = pdfDoc.getPages();
    const currentPage = pages[0];
    let yPosition = currentPage.getSize().height - margin;

    // Clear the page
    const { width, height } = currentPage.getSize();
    currentPage.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(1, 1, 1),
    });

    const lines = translatedText.split('\n');
    for (const line of lines) {
      if (yPosition < margin) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([width, height]);
        yPosition = newPage.getSize().height - margin;
      }

      if (line.trim() !== '') {
        currentPage.drawText(line, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: regularFont,
          color: rgb(0, 0, 0),
        });
      }
      yPosition -= lineHeight;
    }

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error creating PDF:', error);
    // Create a simple PDF with just the text if the original conversion fails
    const fallbackDoc = await PDFDocument.create();
    const page = fallbackDoc.addPage([612, 792]);
    const font = await fallbackDoc.embedFont(StandardFonts.Helvetica);
    
    page.drawText(translatedText, {
      x: 50,
      y: 750,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    return await fallbackDoc.save();
  }
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
    const mimeType = fileTypeResult ? fileTypeResult.mime : file.type || 'text/plain';

    let text = '';
    let translatedText = '';

    // Handle both PDFs and images directly through Gemini API
    if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
      translatedText = await translateText(buffer, sourceLanguage, targetLanguage, mimeType);
      
      // Extract original text for display 
      if (mimeType === 'application/pdf') {
        text = await extractTextFromPdf(buffer);
      } else {
        // For images, use OCR to show original text
        const ocrLang = sourceLanguage !== 'auto' ? mapLanguageToTesseract(sourceLanguage) : 'eng';
        text = await performOcr(buffer, ocrLang);
      }
    } else {
      // Handle plain text files
      text = buffer.toString('utf8');
      translatedText = await translateText(
        Buffer.from(text), 
        sourceLanguage, 
        targetLanguage, 
        'text/plain'
      );
    }

    const translatedPdfBytes = await createTranslatedPdf(buffer, translatedText, mimeType);

    return NextResponse.json({
      originalText: text,
      translatedText: translatedText,
      translatedPdf: Buffer.from(translatedPdfBytes).toString('base64')
    }, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Error processing document'
    }, {
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
