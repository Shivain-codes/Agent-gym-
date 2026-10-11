import React from 'react';

interface BlackBoxPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  /**
   * If true, renders the title in a "TECHNICAL // LABEL" format
   * e.g. "SENSORS // TELEMETRY"
   */
  technical?: boolean;
}

export const BlackBoxPanel: React.FC<BlackBoxPanelProps> = ({
  children,
  className = '',
  title,
  technical = false
}) => {
  return (
    <div className={`bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl ${className}`}>
      {title && (
        <div className="border-b border-[var(--color-border)] px-4 py-2 text-[11px] font-mono text-[var(--color-micro)] uppercase tracking-widest flex items-center gap-2">
          {technical ? (
            <>
              <span className="text-[var(--color-amber)] opacity-70">SYS_LOG</span>
              <span className="text-[var(--color-border)]">/</span>
              <span className="text-[var(--color-ink)]">{title}</span>
            </>
          ) : (
            <span className="text-[var(--color-ink)]">{title}</span>
          )}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
