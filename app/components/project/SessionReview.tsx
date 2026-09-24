"use client";

import { BarChart3, Flag, LifeBuoy, PenLine, Play, Repeat, SkipForward } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatClock } from "@/lib/domain/format";
import type { PresenterSession, Project } from "@/lib/domain/types";
import { listSessions } from "@/lib/store/db";
import { ButtonLink } from "../ui/button";
import { EmptyState, Spinner } from "../ui/controls";

function when(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * Post-session review: time per slide against plan and a short list of things worth a look.
 * Framed as observations, never as a score.
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
  const scale = Math.max(1, ...rows.map((row) => Math.max(row.seconds, row.targetSeconds)));
  const difference = session.totalSeconds - session.targetSeconds;

  const long = rows.filter((row) => row.targetSeconds >= 15 && row.seconds > row.targetSeconds * 1.25 && row.seconds - row.targetSeconds >= 10);
  const repeated = rows.filter((row) => row.visits > 1);
  const skipped = session.skipped.filter((id) => titles.has(id));
  const marked = session.marked.filter((id) => titles.has(id));

  const notes: { icon: React.ReactNode; text: React.ReactNode }[] = [
    ...long.map((row) => ({
      icon: <BarChart3 />,
      text: <>Slide {titles.get(row.slideId)!.number}, <Link href={`/p/${project.id}/edit?slide=${row.slideId}`}>{titles.get(row.slideId)!.title}</Link>, ran {formatClock(row.seconds - row.targetSeconds)} over its plan. The editor&apos;s <em>Improve → Shorten</em> can trim it.</>,
    })),
    ...marked.map((id) => ({ icon: <Flag />, text: <>You marked slide {titles.get(id)!.number}, <Link href={`/p/${project.id}/edit?slide=${id}`}>{titles.get(id)!.title}</Link>, for review.</> })),
    ...repeated.map((row) => ({ icon: <Repeat />, text: <>You returned to slide {titles.get(row.slideId)!.number} {row.visits - 1 === 1 ? "once" : `${row.visits - 1} times`}. A clearer transition into it might help.</> })),
    ...skipped.map((id) => ({ icon: <SkipForward />, text: <>Slide {titles.get(id)!.number}, {titles.get(id)!.title}, wasn&apos;t shown. Mark it optional if that&apos;s intended.</> })),
    ...(session.recoveries ? [{ icon: <LifeBuoy />, text: <>You used “I lost my place” {session.recoveries === 1 ? "once" : `${session.recoveries} times`}. The recovery line for each slide is editable in the Notes tab.</> }] : []),
  ];

  return (
    <div className="page review">
      <header className="review__header">
        <div>
          <p className="eyebrow">Session review</p>
          <h1 className="page-title">How it went</h1>
          <p className="review__when">{when(session.startedAt)}{session.completed ? "" : " · ended early"}</p>
        </div>
        <div className="review__actions">
          <ButtonLink href={`/p/${project.id}/edit`} variant="secondary" icon={<PenLine />}>Edit script</ButtonLink>
          <ButtonLink href={`/p/${project.id}/present`} variant="accent" icon={<Play />}>Present again</ButtonLink>
        </div>
      </header>

      <dl className="review__summary tabular">
        <div><dt>Total time</dt><dd>{formatClock(session.totalSeconds)}</dd><p>{Math.abs(difference) < 15 ? "Right on your plan" : difference > 0 ? `${formatClock(difference)} over the ${formatClock(session.targetSeconds)} plan` : `${formatClock(-difference)} under the ${formatClock(session.targetSeconds)} plan`}</p></div>
        <div><dt>Slides shown</dt><dd>{rows.filter((row) => row.visits > 0).length} of {rows.length}</dd></div>
        <div><dt>Marked for review</dt><dd>{marked.length}</dd></div>
      </dl>

      <section className="review__section" aria-labelledby="review-timing">
        <div className="review__section-head">
          <h2 id="review-timing" className="section-title">Time on each slide</h2>
          <p className="review__legend"><span className="review__legend-tick" aria-hidden="true" /> Planned time</p>
        </div>
        <ol className="timing-chart">
          {rows.map((row) => {
            const info = titles.get(row.slideId)!;
            const over = row.targetSeconds > 0 && row.seconds > row.targetSeconds;
            const within = Math.min(row.seconds, row.targetSeconds || row.seconds);
            return (
              <li key={row.slideId} className="timing-row" data-tooltip={`${formatClock(row.seconds)} spoken · ${row.targetSeconds ? `${formatClock(row.targetSeconds)} planned` : "no plan"}${row.visits > 1 ? ` · ${row.visits} visits` : ""}`} data-tooltip-side="top">
                <span className="timing-row__label"><span className="tabular faint">{info.number}</span> {info.title}</span>
                <span className="timing-row__track" aria-hidden="true">
                  <span className="timing-row__bar" style={{ width: `${(within / scale) * 100}%` }} />
                  {over && <span className="timing-row__over" style={{ left: `calc(${(row.targetSeconds / scale) * 100}% + 2px)`, width: `calc(${((row.seconds - row.targetSeconds) / scale) * 100}% - 2px)` }} />}
                  {row.targetSeconds > 0 && <span className="timing-row__target" style={{ left: `${(row.targetSeconds / scale) * 100}%` }} />}
                </span>
                <span className="timing-row__value tabular">
                  {formatClock(row.seconds)}
                  {over && <span className="timing-row__delta"> +{formatClock(row.seconds - row.targetSeconds)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="review__section" aria-labelledby="review-notes">
        <h2 id="review-notes" className="section-title">Worth a look</h2>
        {notes.length ? (
          <ul className="review__notes">{notes.map((note, index) => <li key={index}><span aria-hidden="true">{note.icon}</span><p>{note.text}</p></li>)}</ul>
        ) : (
          <p className="review__calm">Nothing stood out. Your timing stayed close to the plan on every slide.</p>
        )}
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
