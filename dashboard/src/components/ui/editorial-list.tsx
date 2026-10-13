"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorialItem = {
  id: string;
  /** Row number, e.g. "01" */
  index: string;
  /** Large display title */
  title: React.ReactNode;
  /** Short right-aligned descriptor, e.g. status */
  descriptor?: React.ReactNode;
  /** Mono line under the title, e.g. metadata */
  meta?: React.ReactNode;
  /** Smoothly expanding detail revealed on click */
  detail?: React.ReactNode;
};

/**
 * Editorial index list (21st.dev "Editorial service list" pattern):
 * numbered rows, subtle hover offset on the title, and smoothly
 * expanding descriptions. Dark-theme adapted.
 */
export const EditorialList: React.FC<{
  items: EditorialItem[];
  className?: string;
}> = ({ items, className }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={cn("border-t border-[var(--color-border)]", className)}>
      {items.map((item) => {
        const open = openId === item.id;
        const expandable = !!item.detail;
        return (
          <div key={item.id} className="border-b border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => expandable && setOpenId(open ? null : item.id)}
              aria-expanded={open}
              className={cn(
                "group flex w-full items-center gap-6 px-2 py-7 text-left md:gap-10 md:px-4 md:py-9",
                expandable && "cursor-pointer"
              )}
            >
              <span className="w-8 shrink-0 font-mono text-xs text-[var(--color-micro)]">
                {item.index}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-semibold tracking-tight text-[var(--color-ink)] transition-transform duration-300 ease-out group-hover:translate-x-2 md:text-4xl">
                  {item.title}
                </span>
                {item.meta && (
                  <span className="mt-3 block font-mono text-[11px] text-[var(--color-micro)]">
                    {item.meta}
                  </span>
                )}
              </span>
              {item.descriptor && (
                <span className="hidden shrink-0 font-mono text-[11px] sm:block">
                  {item.descriptor}
                </span>
              )}
              {expandable && (
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--color-micro)] transition-all duration-300 group-hover:translate-x-1 group-hover:text-[var(--color-ink)]",
                    open && "rotate-90"
                  )}
                />
              )}
            </button>
            {expandable && (
              <div
                className={cn(
                  "grid transition-all duration-300 ease-out",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="px-2 pb-8 pl-16 pr-4 md:px-4 md:pl-[4.5rem]">
                    {item.detail}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EditorialList;
