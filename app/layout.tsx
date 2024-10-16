import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";


const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: 'Anuvad - Hindi to English Translation Tool | Extract and Translate Text',
  description: 'Anuvad is a free online tool to extract and translate text from PDF, images, and plain text files from Hindi to English. Upload your file and get instant translations.',
  keywords: 'Hindi translation, English translation, PDF translation, image translation, OCR, text extraction',
  openGraph: {
    title: 'Anuvad - Hindi to English Translation Tool',
    description: 'Extract and translate text from PDF, images, and plain text files from Hindi to English with Anuvad.',
    url: 'https://your-domain.com',
    siteName: 'Anuvad',
    images: [
      {
        url: 'https://your-domain.com/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
