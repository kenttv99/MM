// frontend/src/components/FormattedDescription.tsx
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface FormattedDescriptionProps {
  content: string;
  className?: string;
  disableFontSize?: boolean;
  disableLinks?: boolean; // Новый проп для отключения ссылок
}

const FormattedDescription: React.FC<FormattedDescriptionProps> = ({ 
  content, 
  className = '', 
  disableFontSize = false,
  disableLinks = false, // По умолчанию ссылки включены
}) => {
  if (!content) return <div className={className}></div>;

  // Преобразуем кастомные теги в HTML с изоляцией стилей
  const processedContent = content
    .replace(/\{\+size\+}(.*?)\{\+size\+}/g, (_, text) => `<span style="font-size: 1.2em; font-family: inherit; display: inline-block">${text}</span>`)
    .replace(/\{-size-}(.*?)\{-size-}/g, (_, text) => `<span style="font-size: 0.8em; font-family: inherit; display: inline-block">${text}</span>`);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ ...props }) => <h1 className="text-3xl font-bold mb-3" {...props} />,
          h2: ({ ...props }) => <h2 className="text-2xl font-bold mb-2" {...props} />,
          h3: ({ ...props }) => <h3 className="text-xl font-bold mb-2" {...props} />,
          h4: ({ ...props }) => <h4 className="text-lg font-bold mb-2" {...props} />,
          h5: ({ ...props }) => <h5 className="text-base font-bold mb-2" {...props} />,
          h6: ({ ...props }) => <h6 className="text-sm font-bold mb-2" {...props} />,
          p: ({ ...props }) => <p className="mb-2" {...props} />,
          ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2" {...props} />,
          ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2" {...props} />,
          li: ({ ...props }) => <li className="mb-1" {...props} />,
          strong: ({ ...props }) => <strong className="font-bold" {...props} />,
          em: ({ ...props }) => <em className="italic" {...props} />,
          a: ({ children, ...props }) => {
            if (disableLinks) {
              // Если ссылки отключены, рендерим только текст без <a>
              return <span>{children}</span>;
            }
            return (
              <a
                className="text-orange-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            );
          },
          span: ({ style, ...props }) => (
            <span
              style={disableFontSize ? { ...style, fontSize: undefined } : { ...style, fontFamily: 'inherit', display: 'inline-block' }}
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