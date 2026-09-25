import { createContext, type Context } from "react";

type Registry = { __cueframeContexts?: Map<string, Context<unknown>> };

/**
 * createContext that survives hot module reloading. When the dev server hot-swaps a module that
 * defines a context, consumers pick up the new module while an already-mounted provider (in a
 * layout that doesn't re-render) keeps the old one, and every consumer throws "must be used
 * inside <Provider>". Keying the context by name makes both copies share one object. In
 * production each module runs once, so this is just createContext.
 */
export function stableContext<T>(key: string, initial: T): Context<T> {
  const registry = globalThis as typeof globalThis & Registry;
  registry.__cueframeContexts ??= new Map();
  const existing = registry.__cueframeContexts.get(key);
  if (existing) return existing as Context<T>;
  const context = createContext(initial);
  registry.__cueframeContexts.set(key, context as Context<unknown>);
  return context;
}
