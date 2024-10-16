import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { fileTypeFromBuffer } from 'file-type';

async function extractTextFromPdf(dataBuffer: Buffer) {
  try {
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return '';
  }
}

async function performOcr(dataBuffer: Buffer) {
  const worker = await createWorker('hin');
  try {
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
      text = await performOcr(buffer);
    } else {
      // Assume it's a text file
      text = buffer.toString('utf8');
    }

    // Translate the extracted text
    const translatedText = await translateText(text.trim());

    return NextResponse.json({ 
      originalText: text.trim(),
      translatedText: translatedText
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json({ error: 'Error processing document' }, { status: 500 });
  }
}

async function translateText(text: string, sourceLang: string = 'hi', targetLang: string = 'en') {
  const chunkSize = 100; // Google Translate API typically allows up to 2000 characters, but we'll use 1000 to be safe
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  const translatedChunks = await Promise.all(chunks.map(async (chunk) => {
    const encodedText = encodeURIComponent(chunk);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodedText}`;

    const response = await fetch(url);
    const data = await response.json();

    // The translation is in the first element of the first array
    return data[0].map((item: any[]) => item[0]).join(' ');
  }));

  return translatedChunks.join(' ');
}