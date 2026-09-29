"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";

export type Step = { title: string; body: string; image: StaticImageData; alt: string };

/**
 * Three real steps in order. On wide screens the screenshot stays pinned and follows the step being
 * read; on narrow screens each step carries its own screenshot.
 */
export function Steps({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const item of items.current) if (item) observer.observe(item);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="steps">
      <ol className="steps__list">
        {steps.map((step, index) => (
          <li key={step.title} ref={(node) => { items.current[index] = node; }} data-index={index} className="steps__item" data-active={index === active || undefined}>
            <span className="steps__number tabular" aria-hidden="true">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="steps__inline frame">
              <Image src={step.image} alt={step.alt} sizes="100vw" placeholder="blur" />
            </div>
          </li>
        ))}
      </ol>
      <div className="steps__pinned" aria-hidden="true">
        <div className="steps__stack frame">
          {steps.map((step, index) => (
            <Image key={step.title} src={step.image} alt="" data-active={index === active || undefined} sizes="(max-width: 1240px) 60vw, 720px" placeholder="blur" />
          ))}
        </div>
      </div>
    </div>
  );
}
