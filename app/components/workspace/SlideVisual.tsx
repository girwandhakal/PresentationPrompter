import { ArrowUpRight, ChartNoAxesColumnIncreasing, Circle } from "lucide-react";
import type { Slide } from "./types";

export function SlideVisual({ slide, compact = false }: { slide: Slide; compact?: boolean }) {
  return (
    <div className={`slide-visual slide-visual--${slide.accent} ${compact ? "is-compact" : ""}`}>
      <div className="slide-visual__mesh" />
      <div className="slide-visual__topline">
        <span>{slide.eyebrow}</span>
        <span>0{Math.max(1, Number(slide.id.replace(/\D/g, "")) || 1)}</span>
      </div>
      <div className="slide-visual__content">
        <p className="slide-visual__kicker">{slide.marker}</p>
        <h3>{slide.title}</h3>
        {!compact && (
          <div className="slide-visual__data">
            <div className="slide-visual__metric">
              <strong>{slide.accent === "blue" ? "74%" : "03"}</strong>
              <span>{slide.accent === "blue" ? "clear signal" : "deliberate moves"}</span>
            </div>
            <div className="slide-visual__bars" aria-hidden="true">
              <i style={{ height: "42%" }} />
              <i style={{ height: "58%" }} />
              <i style={{ height: "78%" }} />
              <i style={{ height: "92%" }} />
            </div>
          </div>
        )}
      </div>
      <div className="slide-visual__corner" aria-hidden="true">
        {slide.accent === "blue" ? <ChartNoAxesColumnIncreasing /> : <ArrowUpRight />}
        <Circle />
      </div>
    </div>
  );
}
