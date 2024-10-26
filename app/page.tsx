'use client';

import { useState } from 'react';
import Head from 'next/head';
import { FiUpload, FiFileText } from 'react-icons/fi';


export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
  
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
  
    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setOriginalText(data.originalText);
      setTranslatedText(data.translatedText);
    } catch (error) {
      console.error('Error processing document:', error);
      setOriginalText(`Error processing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Anuvad - Hindi to English Translation Tool | Extract and Translate Text</title>
        <meta name="description" content="Anuvad is a free online tool to extract and translate text from PDF, images, and plain text files from Hindi to English. Upload your file and get instant translations." />
        <meta name="keywords" content="Hindi translation, English translation, PDF translation, image translation, OCR, text extraction" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://anuvad.vercel.app/" />
        <meta property="og:title" content="Anuvad - Hindi to English Translation Tool" />
        <meta property="og:description" content="Extract and translate text from PDF, images, and plain text files from Hindi to English with Anuvad." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://anuvad.vercel.app/" />
        <meta property="og:image" content="https://anuvad.vercel.app/og-image.jpg" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-12">
        <h1 className="text-6xl font-extrabold text-center text-gray-900 mb-4">
          Anuvad
        </h1>
        <h2 className="text-2xl font-medium text-center text-gray-600 mb-12">
          Extract and Translate Text from PDF, Images and Plain Text Files
        </h2>
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition duration-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FiUpload className="w-10 h-10 mb-3 text-gray-400" aria-hidden="true" />
                  <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-gray-500">PDF, Image, or Text file</p>
                </div>
                <input
                  type="file"
                  id="file"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Upload file for translation"
                />
              </label>
            </div>
            {file && (
              <p className="text-sm text-gray-600 text-center">
                Selected file: {file.name}
              </p>
            )}
            <button
              type="submit"
              disabled={!file || isLoading}
              className="w-full bg-black text-white py-3 px-4 rounded-md hover:bg-gray-800 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <FiFileText className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Processing...' : 'Extract and Translate'}
            </button>
          </form>
        </div>
        {(originalText || translatedText) && (
          <div className="mt-12 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">Extracted and Translated Text:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Original Text (Hindi):</h3>
                <p className="whitespace-pre-wrap text-gray-700">{originalText}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">Translated Text (English):</h3>
                <p className="whitespace-pre-wrap text-gray-700">{translatedText}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
