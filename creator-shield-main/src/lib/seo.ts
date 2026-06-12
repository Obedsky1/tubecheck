import type { SEOPageData } from "@/data/seo-pages";

export function generateSEOSchemas(pageData: SEOPageData) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": pageData.faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": pageData.h1,
    "operatingSystem": "Web Application",
    "applicationCategory": "BusinessApplication",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };

  return [
    { type: "application/ld+json", children: JSON.stringify(faqSchema) },
    { type: "application/ld+json", children: JSON.stringify(softwareSchema) }
  ];
}
