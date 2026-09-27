"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cx } from "./ui";

const ID = String.raw`(?:S|N|W|M|P)\d*(?:\.\d+)?`;
const CITATION = new RegExp(String.raw`\[(${ID}(?:\s*[,，;；]\s*${ID})*)\]`, "g");

/** Turn [N1, P3.2] into citation links the renderer shows as chips. */
export function linkCitations(text: string) {
  return text.replace(CITATION, (_, ids: string) =>
    ids
      .split(/[,，;；]/)
      .map((id) => `[${id.trim()}](#cite-${id.trim()})`)
      .join(" "),
  );
}

export const Markdown = memo(function Markdown({
  text,
  streaming,
  onCite,
  className,
}: {
  text: string;
  streaming?: boolean;
  onCite?: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cx("prose-sc", streaming && "caret", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("#cite-")) {
              const id = href.slice(6);
              return <CiteChip id={id} onClick={() => onCite?.(id)} />;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
                {children}
              </a>
            );
          },
        }}
      >
        {linkCitations(text)}
      </ReactMarkdown>
    </div>
  );
});

export function CiteChip({ id, onClick }: { id: string; onClick?: () => void }) {
  const kind = id[0];
  const tone =
    kind === "P" ? "bg-warn-soft text-warn" : kind === "W" ? "bg-bull-soft text-bull" : kind === "M" ? "bg-neutral-soft text-neutral" : "bg-accent-soft text-accent";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("mx-0.5 inline-flex -translate-y-px items-center rounded px-1 font-mono text-[10.5px] leading-4 font-semibold align-middle hover:opacity-80", tone)}
    >
      {id}
    </button>
  );
}
