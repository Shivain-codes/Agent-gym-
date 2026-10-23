import React from 'react';

interface BlackBoxPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const BlackBoxPanel: React.FC<BlackBoxPanelProps> = ({
  children,
  className = '',
  title,
}) => {
  return (
    <div className={`bg-[var(--color-panel)] border border-[var(--color-border)] ${className}`}>
      {title && (
        <div className="border-b border-[var(--color-border)] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-micro)]">
          {title}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  );
};
