import { Fragment, type CSSProperties } from "react";

/**
 * Splits a heading into words that CSS can time one after another (`--i` is the word's position).
 * The text content is unchanged, so it reads and searches exactly like the plain heading.
 */
export function Words({ text, from = 0, className = "word" }: { text: string; from?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => (
        <Fragment key={index}>
          <span className={className} style={{ "--i": from + index } as CSSProperties}>{word}</span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
