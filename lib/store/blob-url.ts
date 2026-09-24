"use client";

import { useEffect, useState } from "react";
import { getBlob } from "./db";

/** Object URLs are cached for the page lifetime; slide images are immutable once imported. */
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function loadBlobUrl(key: string): Promise<string | null> {
  if (!key) return Promise.resolve(null);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  let pending = inflight.get(key);
  if (!pending) {
    pending = getBlob(key)
      .then((blob) => {
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        cache.set(key, url);
        return url;
      })
      .catch(() => null)
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

export function useBlobUrl(key: string | undefined) {
  const [state, setState] = useState<{ key: string; url: string | null; loaded: boolean }>(() => ({
    key: key ?? "",
    url: key ? cache.get(key) ?? null : null,
    loaded: key ? cache.has(key) : true,
  }));

  useEffect(() => {
    if (!key) return;
    if (cache.has(key)) return;
    let active = true;
    loadBlobUrl(key).then((url) => { if (active) setState({ key, url, loaded: true }); });
    return () => { active = false; };
  }, [key]);

  if (!key) return { url: null, loaded: true };
  if (state.key !== key) return { url: cache.get(key) ?? null, loaded: cache.has(key) };
  return { url: state.url, loaded: state.loaded };
}
