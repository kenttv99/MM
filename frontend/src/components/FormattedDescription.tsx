"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface FormattedDescriptionProps {
  content: string;
  className?: string;
  disableFontSize?: boolean;
  disableLinks?: boolean;
}

const FormattedDescription: React.FC<FormattedDescriptionProps> = ({
  content,
  className = "",
  disableFontSize = false,
  disableLinks = false,
}) => {
  if (!content) return <div className={className}></div>;

  const processedContent = content
    .replace(/\{\+size\+}(.*?)\{\+size\+}/g, (_, text) => `<span style="font-size: 1.2em; font-family: inherit; display: inline-block">${text}</span>`)
    .replace(/\{-size-}(.*?)\{-size-}/g, (_, text) => `<span style="font-size: 0.8em; font-family: inherit; display: inline-block">${text}</span>`);

  return (
    <div className={`${className} overflow-wrap-break-word max-w-full`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-3" {...props} /> : 
            <h1 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontSize: "clamp(1.5rem, 4vw, 1.875rem)" }} {...props} />,
          h2: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-2" {...props} /> : 
            <h2 className="text-xl sm:text-2xl font-bold mb-2" style={{ fontSize: "clamp(1.25rem, 3vw, 1.5rem)" }} {...props} />,
          h3: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-2" {...props} /> : 
            <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ fontSize: "clamp(1.125rem, 2.5vw, 1.25rem)" }} {...props} />,
          h4: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-2" {...props} /> : 
            <h4 className="text-base sm:text-lg font-bold mb-2" style={{ fontSize: "clamp(1rem, 2vw, 1.125rem)" }} {...props} />,
          h5: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-2" {...props} /> : 
            <h5 className="text-sm sm:text-base font-bold mb-2" style={{ fontSize: "clamp(0.875rem, 1.5vw, 1rem)" }} {...props} />,
          h6: ({ ...props }) => disableFontSize ? 
            <p className="font-bold mb-2" {...props} /> : 
            <h6 className="text-xs sm:text-sm font-bold mb-2" style={{ fontSize: "clamp(0.75rem, 1vw, 0.875rem)" }} {...props} />,
          p: ({ ...props }) => <p className="mb-2" style={disableFontSize ? {} : { fontSize: "clamp(0.875rem, 2vw, 1rem)" }} {...props} />,
          ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
          li: ({ ...props }) => <li className="mb-1" style={disableFontSize ? {} : { fontSize: "clamp(0.875rem, 2vw, 1rem)" }} {...props} />,
          strong: ({ ...props }) => <strong className="font-bold" {...props} />,
          em: ({ ...props }) => <em className="italic" {...props} />,
          a: ({ children, ...props }) =>
            disableLinks ? (
              <span className="word-break">{children}</span>
            ) : (
              <a
                className="text-orange-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                style={disableFontSize ? {} : { fontSize: "clamp(0.875rem, 2vw, 1rem)" }}
                {...props}
              >
                {children}
              </a>
            ),
          span: ({ style, ...props }) => (
            <span
              style={disableFontSize ? { ...style, fontSize: undefined } : style}
              {...props}
            />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedDescription;