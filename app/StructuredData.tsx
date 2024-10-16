import Script from 'next/script'

export default function StructuredData() {
  return (
    <Script id="structured-data" type="application/ld+json">
      {JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": "Anuvad",
        "url": "https://your-domain.com",
        "description": "Extract and translate text from PDF, images, and plain text files from Hindi to English.",
        "applicationCategory": "TranslationApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0"
        }
      })}
    </Script>
  )
}