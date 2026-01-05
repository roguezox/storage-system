'use client';

import { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-xs text-[var(--text-secondary)] mb-1.5 font-medium tracking-wide">
                    {label}
                </label>
            )}
            <input
                className={cn(
                    'w-full h-10 px-3.5 rounded-lg',
                    'bg-[var(--bg-secondary)]',
                    'border border-[var(--border-default)]',
                    'text-[var(--text-primary)] text-sm',
                    'placeholder:text-[var(--text-muted)]',
                    'transition-all duration-200',
                    'hover:border-[var(--border-hover)]',
                    'focus:outline-none',
                    'focus:border-[var(--accent)]',
                    'focus:bg-[var(--bg-primary)]',
                    'focus:shadow-[0_0_0_1px_var(--accent),0_0_0_4px_var(--accent-subtle)]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    error && 'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_1px_var(--danger),0_0_0_4px_var(--danger-subtle)]',
                    className
                )}
                {...props}
            />
            {error && (
                <span className="block text-xs text-[var(--danger-color)] mt-1.5 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0">
                        <path d="M6 1L1 11H11L6 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M6 5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <circle cx="6" cy="9" r="0.5" fill="currentColor"/>
                    </svg>
                    {error}
                </span>
            )}
        </div>
    );
}
