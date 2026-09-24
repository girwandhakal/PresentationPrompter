"use client";

import type { Slide } from "@/lib/domain/types";
import { useBlobUrl } from "@/lib/store/blob-url";

/**
 * A slide exactly as the audience sees it. Falls back to a plain title card for slides that have no
 * stored image (decks migrated from earlier versions).
 */
export function SlideImage({ slide, aspectRatio, size = "full", className, priority }: {
  slide: Pick<Slide, "imageKey" | "thumbKey" | "title" | "width" | "height">;
  aspectRatio?: number;
  size?: "thumb" | "full";
  className?: string;
  priority?: boolean;
}) {
  const key = size === "thumb" ? slide.thumbKey || slide.imageKey : slide.imageKey || slide.thumbKey;
  const { url, loaded } = useBlobUrl(key);
  const ratio = aspectRatio ?? (slide.width && slide.height ? slide.width / slide.height : 16 / 9);
  return (
    <div className={["slide-image", `slide-image--${size}`, className].filter(Boolean).join(" ")} style={{ aspectRatio: String(ratio) }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URLs can't use next/image
        <img src={url} alt="" draggable={false} loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : loaded ? (
        <div className="slide-image__fallback"><span>{slide.title}</span></div>
      ) : (
        <div className="slide-image__loading" aria-hidden="true" />
      )}
    </div>
  );
}
