import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { fileTypeFromBuffer } from 'file-type';

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
    try {
      await worker.load(lang);
      await worker.reinitialize(lang);
    } catch (langError) {
      console.warn(`Language ${lang} not available for OCR. Falling back to English.`);
      console.warn(langError);
      await worker.load('eng');
      await worker.reinitialize('eng');
    }

    const { data: { text } } = await worker.recognize(dataBuffer);
    await worker.terminate();
    return text;
  } catch (error) {
    await worker.terminate();
    console.error('OCR failed:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
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
      // Assume it's a text file
      text = buffer.toString('utf8');
    }

    // Translate the extracted text
    const translatedText = await translateText(text.trim(), sourceLanguage, targetLanguage);

    return NextResponse.json({ 
      originalText: text.trim(),
      translatedText: translatedText
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ error: 'Error processing document' }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
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

  // Parse the response to extract the translated text
  if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
    const translatedText = data.candidates[0].content.parts[0].text;
    return translatedText.trim(); // Trim to remove any extra whitespace or newlines
  } else {
    console.error('Unexpected response structure:', data);
    throw new Error('Translation failed due to unexpected response structure');
  }
}

// Helper function to map language codes to Tesseract-compatible codes
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
  return mapping[lang] || 'eng'; // Default to English if no mapping found
}
