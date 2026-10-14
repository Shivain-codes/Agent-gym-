import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold font-mono uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-amber)] text-[var(--color-bg)] hover:bg-[var(--color-amber)]/80",
        secondary:
          "border-transparent bg-[var(--color-soft-fill)] text-[var(--color-soft-ink)] hover:bg-[var(--color-soft-fill)]/80",
        destructive:
          "border-transparent bg-[var(--color-fail)]/15 text-[var(--color-fail)] hover:bg-[var(--color-fail)]/25",
        outline: "text-[var(--color-body)] border-[var(--color-border)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
