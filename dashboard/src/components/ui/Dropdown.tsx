import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  className?: string;
  size?: "md" | "sm";
  ariaLabel?: string;
}

/**
 * Dark-theme dropdown replacing native <select> (which renders with
 * OS-default bevel styling). Button trigger + popover list.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-sm border font-mono text-[var(--color-ink)] transition-colors duration-200",
          size === "md" ? "px-3 py-2.5 text-sm" : "px-2 py-2 text-xs",
          open
            ? "border-[var(--color-amber)] bg-[var(--color-panel)]"
            : "border-[var(--color-hairline)] bg-[var(--color-panel)] hover:border-[var(--color-border)]"
        )}
      >
        <span className="truncate">{selected?.label ?? value}</span>
        <ChevronDown
          className={cn(
            "shrink-0 text-[var(--color-body)] transition-transform duration-200",
            size === "md" ? "h-4 w-4" : "h-3.5 w-3.5",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-sm border border-[var(--color-border)] bg-[var(--color-panel)] shadow-2xl">
          <ul className="max-h-60 overflow-y-auto py-1">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-mono transition-colors duration-150",
                      size === "md" ? "text-sm" : "text-xs",
                      active
                        ? "text-[var(--color-amber)]"
                        : "text-[var(--color-ink)] hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {active && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
