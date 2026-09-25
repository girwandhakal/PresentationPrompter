"use client";

import { useEffect } from "react";

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · Cueframe`;
    return () => { document.title = previous; };
  }, [title]);
}
