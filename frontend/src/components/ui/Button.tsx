'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    isLoading?: boolean;
}

const variantStyles = {
    primary: cn(
        'bg-[var(--accent)] text-white',
        'border border-white/10',
        'shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(94,106,210,0.25)]',
        'hover:bg-[var(--accent-hover)]',
        'hover:shadow-[0_4px_16px_rgba(94,106,210,0.4)]',
        'active:bg-[var(--accent-active)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
    ),
    secondary: cn(
        'bg-[var(--bg-tertiary)]',
        'text-[var(--text-primary)] border border-[var(--border-default)]',
        'shadow-[var(--shadow-sm)]',
        'hover:bg-[var(--bg-hover)]',
        'hover:border-[var(--border-hover)]',
        'hover:shadow-[var(--shadow-md)]',
        'active:bg-[var(--bg-secondary)]',
        'focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
    ),
    danger: cn(
        'bg-[rgba(239,68,68,0.12)]',
        'text-[var(--danger-color)] border border-[rgba(239,68,68,0.25)]',
        'shadow-[0_1px_3px_rgba(239,68,68,0.15)]',
        'hover:bg-[rgba(239,68,68,0.2)]',
        'hover:border-[rgba(239,68,68,0.4)]',
        'hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)]',
        'hover:text-[var(--danger-hover)]',
        'active:bg-[rgba(239,68,68,0.25)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--danger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
    ),
    ghost: cn(
        'bg-transparent text-[var(--text-secondary)]',
        'hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
        'active:bg-[var(--bg-hover)]',
        'focus-visible:ring-2 focus-visible:ring-white/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
    )
};

const sizeStyles = {
    sm: 'h-7 px-3 text-xs rounded-md',
    md: 'h-8 px-4 text-sm rounded-md',
    lg: 'h-10 px-6 text-sm rounded-md'
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    isLoading,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            className={cn(
                'inline-flex items-center justify-center gap-2 font-medium',
                'transition-all duration-150 cursor-pointer whitespace-nowrap select-none',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
                'active:scale-[0.98]',
                variantStyles[variant],
                sizeStyles[size],
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="flex items-center gap-2">
                    <span className="spinner"></span>
                    <span>Loading...</span>
                </span>
            ) : children}
        </button>
    );
}
