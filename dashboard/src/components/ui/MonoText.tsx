import React from 'react';

interface MonoTextProps {
  children: React.ReactNode;
  className?: string;
  color?: 'ink' | 'soft' | 'amber' | 'pass' | 'fail';
}

const colorMap = {
  ink: 'text-[var(--color-ink)]',
  soft: 'text-[var(--color-soft-ink)]',
  amber: 'text-[var(--color-amber)]',
  pass: 'text-[var(--color-pass)]',
  fail: 'text-[var(--color-fail)]',
};

export const MonoText: React.FC<MonoTextProps> = ({ children, className = '', color = 'ink' }) => {
  return (
    <span className={`font-mono ${colorMap[color]} ${className}`}>
      {children}
    </span>
  );
};
