'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
    return (
        <div className="input-group">
            {label && <label className="input-label">{label}</label>}
            <input
                className={`input ${error ? 'input-error' : ''} ${className}`}
                {...props}
            />
            {error && <span className="input-error-text">{error}</span>}
        </div>
    );
}
