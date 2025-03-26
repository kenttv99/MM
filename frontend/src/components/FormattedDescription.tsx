// frontend/src/components/FormattedDescription.tsx
"use client";

import React, { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';

interface FormattedDescriptionProps {
  content: string;
  className?: string;
}

/**
 * Component to safely render HTML content from the description field
 * Uses DOMPurify to sanitize HTML and prevent XSS attacks
 */
const FormattedDescription: React.FC<FormattedDescriptionProps> = ({ 
  content, 
  className = '' 
}) => {
  // State to hold sanitized content
  const [sanitizedContent, setSanitizedContent] = useState("");
  
  // Use useEffect to sanitize content on client side
  useEffect(() => {
    if (typeof window !== 'undefined' && content) {
      // Only run sanitization on client side where DOMPurify is available
      const clean = DOMPurify.sanitize(content, {
        // Allow these tags
        ALLOWED_TAGS: [
          'b', 'i', 'u', 's', 'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'a', 'span', 'strong', 'em'
        ],
        // Allow these attributes
        ALLOWED_ATTR: ['href', 'target', 'style', 'class'],
      });
      
      setSanitizedContent(clean);
    }
  }, [content]);
  
  // If there's no content, return an empty div with the same classname for consistency
  if (!content) {
    return <div className={className}></div>;
  }
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};

export default FormattedDescription;