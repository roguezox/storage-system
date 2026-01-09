'use client';

import { ReactNode, useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className={cn(
                    'bg-[var(--bg-elevated)]',
                    'border border-[var(--border-default)]',
                    'shadow-[0_16px_40px_rgba(0,0,0,0.5)]',
                    'rounded-xl w-full overflow-hidden animate-scale-in',
                    maxWidth ? '' : 'max-w-[480px]'
                )}
                style={maxWidth ? { maxWidth } : undefined}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-center">
                    <h2 className="text-base font-semibold m-0 text-[var(--text-primary)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-md transition-all duration-150 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        aria-label="Close modal"
                    >
                        <FiX size={18} />
                    </button>
                </div>
                <div className="p-5">
                    {children}
                </div>
            </div>
        </div>
    );
}
