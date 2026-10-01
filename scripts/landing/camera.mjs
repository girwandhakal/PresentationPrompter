// The automatic zoom behind the landing clips, in the manner of Screen Studio and its open-source
// cousins: the capture keeps a track of pointer moves, clicks, and typing beside the frames, and this
// turns it into a camera. Actions close together become one zoom segment; inside it the camera
// frames the latest action and pans only when the pointer nears the edge of the view, and spring
// smoothing gives every zoom and pan the same unhurried ease in and out.

/** Critically damped springs: ω sets how quickly they settle (about 4.7/ω seconds to 1%). */
const ZOOM_OMEGA = 6;
const PAN_OMEGA = 5;
const STEP = 1 / 240;

/**
 * @param {{ t: number, type: string, x?: number, y?: number, scale?: number, lead?: number, hold?: number }[]} events
 *   Pointer moves ("move"), actions ("click", "key", "focus") in CSS pixels, and "release" (pull
 *   back out now), stamped in seconds.
 * @param {{ from: number, end: number, view: { width: number, height: number }, scale?: number,
 *   lead?: number, hold?: number, merge?: number, settle?: number }} options
 */
export function planCamera(events, { from, end, view, scale = 1.8, lead = 0.9, hold = 1.6, merge = 1, settle = 1.1 }) {
  const moves = events.filter((event) => event.type === "move" || event.type === "click").sort((a, b) => a.t - b.t);
  const inClip = events.filter((event) => event.type !== "move" && event.t >= from && event.t <= end).sort((a, b) => a.t - b.t);

  // Actions that follow on from each other share one segment, so the camera pans between them
  // instead of pulling out and back in. A release ends the segment it falls in.
  const segments = [];
  let released = false;
  for (const action of inClip) {
    const last = segments.at(-1);
    if (action.type === "release") {
      if (last && action.t < last.end) last.end = action.t;
      released = true;
      continue;
    }
    const start = action.t - (action.lead ?? lead);
    const stop = action.t + (action.hold ?? hold);
    if (last && !released && start < last.end + merge) {
      last.end = Math.max(last.end, stop);
      last.actions.push(action);
    } else {
      segments.push({ start: last ? Math.max(start, last.end) : start, end: stop, actions: [action] });
    }
    released = false;
  }
  // Every clip loops, so each one ends back on the whole window, as it began.
  for (const segment of segments) segment.end = Math.min(segment.end, end - settle);

  const pointer = (t) => {
    if (!moves.length) return null;
    if (t <= moves[0].t) return moves[0];
    let index = moves.findIndex((move) => move.t > t);
    if (index < 0) return moves.at(-1);
    const a = moves[index - 1];
    const b = moves[index];
    const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };

  const clampCenter = (value, zoom, size) => {
    const half = size / (2 * zoom);
    return Math.min(size - half, Math.max(half, value));
  };

  const target = (t) => {
    const segment = segments.find((candidate) => t >= candidate.start && t < candidate.end);
    if (!segment) return { s: 1, x: view.width / 2, y: view.height / 2 };
    // Frame the latest action; before the first one, head for where it will happen.
    const anchor = segment.actions.findLast((action) => action.t <= t) ?? segment.actions[0];
    const s = anchor.scale ?? scale;
    let { x, y } = anchor;
    // Keep a moving pointer in view: pan once it leaves the middle of the frame. A focus holds
    // still on its subject wherever the pointer goes.
    const here = anchor.type !== "focus" && t >= segment.actions[0].t ? pointer(t) : null;
    if (here) {
      const marginX = (view.width / s) * 0.3;
      const marginY = (view.height / s) * 0.3;
      if (here.x > x + marginX) x = here.x - marginX;
      if (here.x < x - marginX) x = here.x + marginX;
      if (here.y > y + marginY) y = here.y - marginY;
      if (here.y < y - marginY) y = here.y + marginY;
    }
    return { s, x: clampCenter(x, s, view.width), y: clampCenter(y, s, view.height) };
  };

  const state = { t: from, s: 1, x: view.width / 2, y: view.height / 2, vs: 0, vx: 0, vy: 0 };
  const spring = (value, velocity, goal, omega) => {
    const acceleration = omega * omega * (goal - value) - 2 * omega * velocity;
    const next = velocity + acceleration * STEP;
    return [value + next * STEP, next];
  };

  return {
    segments,
    /** The camera at time t; call with increasing times. */
    at(t) {
      while (state.t < t) {
        const goal = target(state.t);
        [state.s, state.vs] = spring(state.s, state.vs, goal.s, ZOOM_OMEGA);
        [state.x, state.vx] = spring(state.x, state.vx, goal.x, PAN_OMEGA);
        [state.y, state.vy] = spring(state.y, state.vy, goal.y, PAN_OMEGA);
        state.t += STEP;
      }
      const s = Math.max(1, state.s);
      return { s, x: clampCenter(state.x, s, view.width), y: clampCenter(state.y, s, view.height) };
    },
  };
}

/** The source rectangle, in frame pixels, that the camera shows. */
export function cropFor(camera, view, frame) {
  const k = frame.width / view.width;
  const width = Math.min(frame.width, Math.round(frame.width / camera.s));
  const height = Math.min(frame.height, Math.round(frame.height / camera.s));
  const left = Math.min(frame.width - width, Math.max(0, Math.round(camera.x * k - width / 2)));
  const top = Math.min(frame.height - height, Math.max(0, Math.round(camera.y * k - height / 2)));
  return { left, top, width, height };
}
