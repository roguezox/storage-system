'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    children: ReactNode;
    isLoading?: boolean;
}

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
            className={`btn btn-${variant} btn-${size} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <span className="btn-loading">
                    <span className="spinner"></span>
                    Loading...
                </span>
            ) : children}
        </button>
    );
}
