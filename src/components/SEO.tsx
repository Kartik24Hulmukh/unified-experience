import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  type?: string;
  name?: string;
  image?: string;
}

export function SEO({ title, description, type = 'website', name = 'BErozgar', image = 'https://berozgar.in/logo.jpeg' }: SEOProps) {
  const isOrganization = type === 'website';
  const location = useLocation();
  const currentUrl = `https://berozgar.in${location.pathname}`;
  
  // Base Schema for the entire Campus Platform
  const schemaData = {
    "@context": "https://schema.org",
    "@type": isOrganization ? "Organization" : "WebPage",
    "name": name,
    "url": currentUrl,
    "logo": "https://berozgar.in/logo.jpeg",
    "description": description,
    "sameAs": [
      "https://twitter.com/Berozgar",
      "https://github.com/Berozgar"
    ]
  };

  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{`${title} | ${name}`}</title>
      <meta name="description" content={description} />
      
      {/* Facebook & LinkedIn tags */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:image" content={image} />
      
      {/* Twitter tags */}
      <meta name="twitter:creator" content={name} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Preloads and Performance */}
      <link rel="canonical" href={currentUrl} />

      {/* JSON-LD Structured Data for maximum Google SERP traction */}
      <script type="application/ld+json">
        {JSON.stringify(schemaData)}
      </script>
    </Helmet>
  );
}
