"use client";

import { AnimatePresence, LayoutGroup, m, useIsPresent } from "motion/react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { EXIT, GLIDE } from "./motion";

export type MenuEntry =
  | { type?: "item"; label: string; icon?: ReactNode; onSelect: () => void; disabled?: boolean; hint?: string; tone?: "default" | "danger" }
  | { type: "separator" }
  | { type: "label"; label: string };

export type MenuTriggerProps = {
  ref: (node: HTMLButtonElement | null) => void;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
};

/** Accessible dropdown menu with arrow-key navigation. Rendered in a portal so it is never clipped. */
export function Menu({ trigger, items, align = "start", label }: {
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuEntry[];
  align?: "start" | "end";
  label: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; origin: string } | null>(null);
  const [triggerElement, setTrigger] = useState<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusTarget, setFocusTarget] = useState<"first" | "last">("first");
  // Which item the highlight sits under: follows the pointer and keyboard focus alike.
  const [active, setActive] = useState<number | null>(null);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  // The portal target only exists in the browser; resolving it after mount keeps SSR output stable.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPortal(document.body), []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerElement?.focus();
  }, [triggerElement]);

  useLayoutEffect(() => {
    if (!open || !triggerElement || !menuRef.current) return;
    const rect = triggerElement.getBoundingClientRect();
    // offsetWidth/Height ignore the entrance scale transform, which would otherwise make the menu measure small.
    const menu = { width: menuRef.current.offsetWidth, height: menuRef.current.offsetHeight };
    const gap = 6;
    const below = rect.bottom + gap + menu.height <= window.innerHeight - 8;
    const top = below ? rect.bottom + gap : Math.max(8, rect.top - gap - menu.height);
    let left = align === "end" ? rect.right - menu.width : rect.left;
    left = Math.min(Math.max(8, left), window.innerWidth - menu.width - 8);
    // Measuring the rendered menu is the only way to place it; this runs before paint.
    setPosition({ top, left, origin: `${align === "end" ? "right" : "left"} ${below ? "top" : "bottom"}` });
  }, [open, align, triggerElement]);

  useEffect(() => {
    if (!open || !position) return;
    const buttons = menuItems(menuRef.current);
    if (focusTarget === "last") buttons.at(-1)?.focus();
    else buttons[0]?.focus();
  }, [open, position, focusTarget]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerElement?.contains(target)) close(false);
    };
    const onViewport = (event: Event) => {
      if (event.type === "scroll" && menuRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onViewport);
    window.addEventListener("scroll", onViewport, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("scroll", onViewport, true);
    };
  }, [open, close, triggerElement]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const buttons = menuItems(menuRef.current);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const move = (next: number) => {
      event.preventDefault();
      buttons[(next + buttons.length) % buttons.length]?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(buttons.length - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") close(false);
  }

  return (
    <>
      {trigger({
        ref: setTrigger,
        onClick: () => {
          setPosition(null);
          setFocusTarget("first");
          setOpen((value) => !value);
        },
        onKeyDown: (event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setFocusTarget(event.key === "ArrowUp" ? "last" : "first");
            setPosition(null);
            setOpen(true);
          }
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
      })}
      {portal && createPortal(
        <AnimatePresence onExitComplete={() => setActive(null)}>
          {open && (
            <MenuPanel
              key="menu"
              ref={menuRef}
              id={id}
              label={label}
              position={position}
              onKeyDown={onMenuKeyDown}
              onPointerLeave={() => setActive(null)}
            >
              <LayoutGroup id={id}>
                {items.map((item, index) => {
                  if (item.type === "separator") return <div key={index} className="menu__separator" role="separator" />;
                  if (item.type === "label") return <div key={index} className="menu__label" role="presentation">{item.label}</div>;
                  return (
                    <button
                      key={index}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={`menu__item${item.tone === "danger" ? " menu__item--danger" : ""}`}
                      data-active={active === index || undefined}
                      disabled={item.disabled}
                      onPointerEnter={() => !item.disabled && setActive(index)}
                      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setActive(index); }}
                      onClick={() => {
                        close();
                        item.onSelect();
                      }}
                    >
                      {active === index && <m.span layoutId="highlight" className="menu__highlight" transition={GLIDE} aria-hidden="true" />}
                      {item.icon && <span className="menu__icon" aria-hidden="true">{item.icon}</span>}
                      <span className="menu__text">{item.label}</span>
                      {item.hint && <span className="menu__hint">{item.hint}</span>}
                    </button>
                  );
                })}
              </LayoutGroup>
            </MenuPanel>
          )}
        </AnimatePresence>,
        portal,
      )}
    </>
  );
}

/** The floating panel. Grows from the corner nearest its trigger; ignores the pointer while leaving. */
function MenuPanel({ ref, id, label, position, onKeyDown, onPointerLeave, children }: {
  ref: React.Ref<HTMLDivElement>;
  id: string;
  label: string;
  position: { top: number; left: number; origin: string } | null;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onPointerLeave: () => void;
  children: ReactNode;
}) {
  const present = useIsPresent();
  return (
    <m.div
      ref={ref}
      id={id}
      role="menu"
      aria-label={label}
      className="menu"
      data-placed={position ? "true" : "false"}
      style={position
        ? { top: position.top, left: position.left, transformOrigin: position.origin, pointerEvents: present ? undefined : "none" }
        : { top: 0, left: 0, visibility: "hidden" }}
      initial={{ opacity: 0, scale: 0.95, y: -2 }}
      animate={position ? { opacity: 1, scale: 1, y: 0, transition: { type: "spring", duration: 0.28, bounce: 0.08 } } : undefined}
      exit={{ opacity: 0, scale: 0.97, transition: EXIT }}
      onKeyDown={onKeyDown}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </m.div>
  );
}

function menuItems(menu: HTMLElement | null) {
  return Array.from(menu?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? []);
}
