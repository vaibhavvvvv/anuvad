'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { FiUpload, FiFileText, FiFile } from 'react-icons/fi';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'bn', name: 'Bengali' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'mr', name: 'Marathi' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'or', name: 'Odia' },
  { code: 'as', name: 'Assamese' },
];

const FormattedText = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSourceLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceLanguage(e.target.value);
  };

  const handleTargetLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTargetLanguage(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceLanguage', sourceLanguage);
    formData.append('targetLanguage', targetLanguage);

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
      setEditedText(data.translatedText);

    } catch (error) {
      console.error('Error processing document:', error);
      setOriginalText(`Error processing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTranslatedText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedText(translatedText);
  };

  const handleSaveEdit = () => {
    setTranslatedText(editedText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText('');
  };

  const handleDownloadPDF = async () => {
    try {
      const formData = new FormData();
      formData.append('file', file!);
      formData.append('translatedText', isEditing ? editedText : translatedText);

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const data = await response.json();
      
      // Create and download the PDF
      const pdfBlob = new Blob(
        [Buffer.from(data.translatedPdf, 'base64')],
        { type: 'application/pdf' }
      );
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'translated-document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-slate-900 via-slate-400 to-slate-900">
      <Head>
        <title>Anuvad - Indian Languages Translation Tool</title>
        <meta name="description" content="Anuvad is a free online tool to extract and translate text from PDF, images, and plain text files." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <nav className="bg-black text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="#" className="text-3xl font-bold text-slate-200">Anuvad</a>
          <div>
            <a href="#" className="text-white hover:text-slate-400 mx-2">Home</a>
            <a href="#" className="text-white hover:text-slate-400 mx-2">About</a>
            <a href="#" className="text-white hover:text-slate-400 mx-2">Contact</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <h1 className="text-6xl font-extrabold text-center text-white mb-4">
          Anuvad
        </h1>
        <h2 className="text-2xl font-medium text-center text-slate-100 mb-12">
          Extract and Translate Text from PDF, Images, and Plain Text Files
        </h2>
        <div className="max-w-3xl mx-auto bg-black rounded-lg shadow-lg p-8 border border-slate-400">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-center w-full">
              <label htmlFor="file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-800 hover:bg-gray-700 transition duration-300 relative overflow-hidden">
                {preview ? (
                  <img src={preview} alt="File preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : file ? (
                  <div className="flex flex-col items-center justify-center absolute inset-0 bg-gray-800 bg-opacity-75">
                    {file.type === 'application/pdf' ? (
                      <FiFileText className="w-16 h-16 text-slate-400 mb-2" />
                    ) : (
                      <FiFile className="w-16 h-16 text-slate-400 mb-2" />
                    )}
                    <p className="text-sm text-slate-400 mt-2">{file.name}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FiUpload className="w-10 h-10 mb-3 text-slate-400" aria-hidden="true" />
                    <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-slate-400">PDF, Image, or Text file</p>
                  </div>
                )}
                <input
                  type="file"
                  id="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.txt,image/*"
                  aria-label="Upload file for translation"
                />
              </label>
            </div>
            <div className="flex justify-between">
              <div className="w-1/2 pr-2">
                <label htmlFor="sourceLanguage" className="block text-sm font-medium text-slate-400">Source Language</label>
                <select
                  id="sourceLanguage"
                  value={sourceLanguage}
                  onChange={handleSourceLanguageChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-slate-400 focus:border-slate-400 sm:text-sm rounded-md bg-gray-800 text-slate-400"
                >
                  <option value="auto">Select Language</option>
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-1/2 pl-2">
                <label htmlFor="targetLanguage" className="block text-sm font-medium text-slate-400">Target Language</label>
                <select
                  id="targetLanguage"
                  value={targetLanguage}
                  onChange={handleTargetLanguageChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-slate-400 focus:border-slate-400 sm:text-sm rounded-md bg-gray-800 text-slate-400"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={!file || isLoading}
              className="w-full bg-slate-400 text-black py-3 px-4 rounded-md hover:bg-slate-400 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <div className="loader"></div>
              ) : (
                <FiFileText className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Processing...' : 'Extract and Translate'}
            </button>
          </form>
        </div>
        {(originalText || translatedText) && (
          <div className="mt-12 max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-white">Extracted and Translated Text:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-900 p-6 rounded-lg shadow-lg border border-slate-400">
                <h3 className="text-xl font-semibold mb-4 text-slate-300">Original Text:</h3>
                <p className="whitespace-pre-wrap text-slate-200 leading-relaxed">{originalText}</p>
              </div>
              <div className="bg-gray-900 p-6 rounded-lg shadow-lg border border-slate-400">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-slate-300">Translated Text:</h3>
                  <div className="flex space-x-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-md hover:bg-emerald-500 transition-colors duration-200 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 bg-rose-600 text-white text-sm rounded-md hover:bg-rose-500 transition-colors duration-200 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleEdit}
                          className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-md hover:bg-slate-600 transition-colors duration-200 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={handleDownloadPDF}
                          className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded-md hover:bg-slate-600 transition-colors duration-200 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Download PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full h-[calc(100%-2rem)] min-h-[300px] p-4 bg-gray-800 text-slate-200 rounded-md border border-slate-600 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-colors duration-200 resize-none font-mono text-sm leading-relaxed"
                    placeholder="Edit translated text here... Use **text** for bold formatting"
                  />
                ) : (
                  <div className="text-slate-200 leading-relaxed">
                    <FormattedText text={translatedText} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .loader {
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 4px solid #fff;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
