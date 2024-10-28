import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Function to filter out unsupported characters
function filterUnsupportedCharacters(text: string): string {
  const supportedCharsPattern = /[\x20-\x7E]/g; // Basic Latin characters
  return text.match(supportedCharsPattern)?.join('') || '';
}

async function createTranslatedPdf(originalBuffer: Buffer, translatedText: string) {
  const pdfDoc = await PDFDocument.load(originalBuffer);

  // Use standard Helvetica fonts
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
  const lineHeight = 16;
  const margin = 50;

  let currentPageIndex = 0;
  let currentPage = pdfDoc.getPages()[currentPageIndex];
  let yPosition = currentPage.getSize().height - margin;
  const maxWidth = currentPage.getSize().width - (2 * margin);

  // Clear existing content
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

  // Process text line by line
  const lines = translatedText.split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') {
      yPosition -= lineHeight;
      continue;
    }

    // Filter unsupported characters
    const filteredLine = filterUnsupportedCharacters(line);

    const xPosition = margin;
    const parts = filteredLine.split(/(\*\*.*?\*\*)/g);

    for (const part of parts) {
      if (part === '') continue;

      const isBold = part.startsWith('**') && part.endsWith('**');
      const font = isBold ? boldFont : regularFont;
      const text = isBold ? part.slice(2, -2) : part;

      let remainingText = text;

      while (remainingText.length > 0) {
        // Calculate how much text can fit on the current line
        let i = 0;
        let currentLine = '';
        
        while (i < remainingText.length) {
          const testLine = remainingText.slice(0, i + 1);
          const width = font.widthOfTextAtSize(testLine, fontSize);
          
          if (width > maxWidth) {
            // Find last space to break the line
            const lastSpace = remainingText.lastIndexOf(' ', i);
            if (lastSpace !== -1) {
              currentLine = remainingText.slice(0, lastSpace);
              remainingText = remainingText.slice(lastSpace + 1);
            } else {
              currentLine = remainingText.slice(0, i);
              remainingText = remainingText.slice(i);
            }
            break;
          }
          
          i++;
          
          if (i === remainingText.length) {
            currentLine = remainingText;
            remainingText = '';
            break;
          }
        }

        // Draw the current line
        currentPage.drawText(currentLine.trim(), {
          x: xPosition,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });

        // to move to next line
        yPosition -= lineHeight;

        // to Check if new page is needed
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
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const translatedText = formData.get('translatedText') as string;

  if (!file || !translatedText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfBytes = await createTranslatedPdf(buffer, translatedText);

    return NextResponse.json({
      translatedPdf: Buffer.from(pdfBytes).toString('base64')
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Error generating PDF' }, { status: 500 });
  }
}