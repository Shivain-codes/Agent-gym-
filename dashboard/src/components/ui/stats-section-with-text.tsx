"use client";

import { MoveDownLeft, MoveUpRight } from "lucide-react";
import { Badge } from "./badge";
import { cn } from "../../lib/utils";

export interface StatItem {
  value: string;
  /** small neutral annotation next to the value, e.g. "per task" — never invented deltas */
  annotation?: string;
  label: string;
  /** direction of the trend arrow; "down" renders for fewer-is-better metrics */
  trend: "up" | "down";
}

export interface StatsProps {
  badge: string;
  title: React.ReactNode;
  description: React.ReactNode;
  stats: StatItem[];
  className?: string;
}

function Stats({ badge, title, description, stats, className }: StatsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="flex gap-4 flex-col items-start justify-center">
          <div>
            <Badge>{badge}</Badge>
          </div>
          <div className="flex gap-4 flex-col">
            <h2 className="font-display text-3xl md:text-4xl tracking-tighter font-semibold text-left text-[var(--color-ink)] leading-tight">
              {title}
            </h2>
            <p className="text-base lg:max-w-sm leading-relaxed text-[var(--color-body)] text-left">
              {description}
            </p>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <div className="grid text-left grid-cols-1 sm:grid-cols-2 w-full gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex gap-0 flex-col justify-between p-6 border border-[var(--color-border)] rounded-md bg-[var(--color-panel)]"
              >
                {stat.trend === "up" ? (
                  <MoveUpRight className="w-4 h-4 mb-10 text-[var(--color-accent-ink)]" />
                ) : (
                  <MoveDownLeft className="w-4 h-4 mb-10 text-[var(--color-pass)]" />
                )}
                <h2 className="font-display text-4xl tracking-tighter max-w-xl text-left font-semibold flex flex-row gap-3 items-end text-[var(--color-ink)]">
                  {stat.value}
                  {stat.annotation && (
                    <span className="text-[var(--color-micro)] text-sm tracking-normal font-mono pb-1">
                      {stat.annotation}
                    </span>
                  )}
                </h2>
                <p className="text-sm leading-relaxed tracking-tight text-[var(--color-body)] max-w-xl text-left mt-1">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export { Stats };
