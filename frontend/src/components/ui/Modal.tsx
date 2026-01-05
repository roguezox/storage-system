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
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in p-4"
            onClick={onClose}
        >
            <div
                className={cn(
                    'bg-[var(--bg-elevated)]',
                    'border-2 border-[var(--border-default)]',
                    'shadow-[0_20px_60px_rgba(0,0,0,0.6)]',
                    'rounded-2xl w-full overflow-hidden animate-scale-in',
                    maxWidth ? '' : 'max-w-[480px]'
                )}
                style={maxWidth ? { maxWidth } : undefined}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b-2 border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-secondary)]/50 backdrop-blur-sm relative z-10">
                    <h2 className="text-lg font-semibold m-0 text-[var(--text-primary)]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-all duration-200 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:shadow-md"
                        aria-label="Close modal"
                    >
                        <FiX size={20} />
                    </button>
                </div>
                <div className="p-6 relative z-10">
                    {children}
                </div>
            </div>
        </div>
    );
}
