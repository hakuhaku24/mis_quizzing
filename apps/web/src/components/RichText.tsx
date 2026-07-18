"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/**
 * Renders question/solution text that may contain Markdown and LaTeX
 * (real-exam transcripts use $...$ math, **bold**, tables, matrices).
 * Single newlines become hard breaks — exam text relies on line layout.
 */
export default function RichText({ children, className }: { children: string; className?: string }) {
  const text = children.replace(/\n/g, "  \n");
  return (
    <div className={`rich-text ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
