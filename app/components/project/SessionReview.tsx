"use client";

import { BarChart3, PenLine, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { formatClock } from "@/lib/domain/format";
import type { PresenterSession, Project } from "@/lib/domain/types";
import { listSessions } from "@/lib/store/db";
import { ButtonLink } from "../ui/button";
import { EmptyState, Spinner } from "../ui/controls";

function when(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A slide within this many seconds of its plan counts as on plan. */
const ON_PLAN = 3;

/**
 * Post-session review: how each slide's time compared with its plan. Framed as observations,
 * never as a score.
 */
export function SessionReview({ project, sessionId }: { project: Project; sessionId: string | null }) {
  const [sessions, setSessions] = useState<PresenterSession[] | null>(null);
  const [selected, setSelected] = useState<string | null>(sessionId);

  useEffect(() => {
    let active = true;
    listSessions(project.id).then((items) => { if (active) setSessions(items.filter((item) => item.totalSeconds > 0)); }).catch(() => { if (active) setSessions([]); });
    return () => { active = false; };
  }, [project.id]);

  if (!sessions) return <div className="center-state"><Spinner label="Loading sessions" /></div>;
  if (!sessions.length) {
    return (
      <div className="center-state">
        <EmptyState icon={<BarChart3 />} title="No sessions yet" action={<ButtonLink href={`/p/${project.id}/present`} variant="accent" icon={<Play />}>Present</ButtonLink>}>
          After you practice or present, you&apos;ll see how long each slide took compared with your plan.
        </EmptyState>
      </div>
    );
  }

  const session = sessions.find((item) => item.id === selected) ?? sessions[0];
  const titles = new Map(project.slides.map((slide, index) => [slide.id, { title: slide.title, number: index + 1 }]));
  const rows = session.slides.filter((row) => titles.has(row.slideId));
  const difference = session.totalSeconds - session.targetSeconds;
  // Diverging scale: the centre is the plan; each half spans the largest miss (at least 10s).
  const scale = Math.max(10, ...rows.filter((row) => row.visits > 0 && row.targetSeconds > 0).map((row) => Math.abs(row.seconds - row.targetSeconds)));

  return (
    <div className="page review">
      <header className="review__header">
        <div>
          <h1 className="page-title">Session review</h1>
          <p className="review__when">{when(session.startedAt)}{session.completed ? "" : " · ended early"}</p>
        </div>
        <div className="review__actions">
          <ButtonLink href={`/p/${project.id}/edit`} variant="secondary" icon={<PenLine />}>Edit script</ButtonLink>
          <ButtonLink href={`/p/${project.id}/present`} variant="accent" icon={<Play />}>Present again</ButtonLink>
        </div>
      </header>

      <dl className="review__summary tabular">
        <div><dt>Total time</dt><dd>{formatClock(session.totalSeconds)}</dd><p>{Math.abs(difference) < 15 ? "Right on your plan" : difference > 0 ? `${formatClock(difference)} over the ${formatClock(session.targetSeconds)} plan` : `${formatClock(-difference)} under the ${formatClock(session.targetSeconds)} plan`}</p></div>
      </dl>

      <section className="review__section" aria-labelledby="review-timing">
        <div className="review__section-head">
          <h2 id="review-timing" className="section-title">Time against plan</h2>
          <ul className="review__legend" aria-label="Legend">
            <li><span className="review__swatch review__swatch--under" aria-hidden="true" /> Under plan</li>
            <li><span className="review__swatch review__swatch--over" aria-hidden="true" /> Over plan</li>
          </ul>
        </div>
        <ol className="plan-chart">
          <li className="plan-chart__scale" aria-hidden="true">
            <span />
            <span className="plan-chart__axis-labels tabular"><span>−{formatClock(scale)}</span><span>Plan</span><span>+{formatClock(scale)}</span></span>
            <span />
          </li>
          {rows.map((row) => {
            const info = titles.get(row.slideId)!;
            const reached = row.visits > 0;
            const planned = row.targetSeconds > 0;
            const delta = row.seconds - row.targetSeconds;
            const state = !reached ? "unreached" : !planned ? "unplanned" : Math.abs(delta) <= ON_PLAN ? "on" : delta > 0 ? "over" : "under";
            const width = `${Math.min(50, (Math.abs(delta) / scale) * 50)}%`;
            const value = state === "unreached" ? "Not reached"
              : state === "unplanned" ? formatClock(row.seconds)
                : state === "on" ? "On plan"
                  : `${delta > 0 ? "+" : "−"}${formatClock(Math.abs(delta))}`;
            return (
              <li
                key={row.slideId}
                className="plan-row"
                data-state={state}
                data-tooltip={reached ? `${formatClock(row.seconds)} spoken · ${planned ? `${formatClock(row.targetSeconds)} planned` : "optional"}${row.visits > 1 ? ` · ${row.visits} visits` : ""}` : "Not shown in this session"}
                data-tooltip-side="top"
              >
                <span className="plan-row__label"><span className="tabular faint">{info.number}</span> {info.title}</span>
                <span className="plan-row__track" aria-hidden="true">
                  {(state === "over" || state === "under") && <span className="plan-row__bar" style={{ width }} />}
                </span>
                <span className="plan-row__value tabular">{value}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {sessions.length > 1 && (
        <section className="review__section" aria-labelledby="review-history">
          <h2 id="review-history" className="section-title">Earlier sessions</h2>
          <ul className="review__history">
            {sessions.map((item) => (
              <li key={item.id}>
                <button type="button" aria-current={item.id === session.id ? "true" : undefined} onClick={() => setSelected(item.id)}>
                  <span>{when(item.startedAt)}</span>
                  <span className="tabular faint">{formatClock(item.totalSeconds)}{item.completed ? "" : " · ended early"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
