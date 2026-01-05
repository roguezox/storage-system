'use client';

import { useState, DragEvent } from 'react';
import { FiUploadCloud } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface DropZoneProps {
    onDrop: (files: File[]) => void;
    children: React.ReactNode;
}

export function DropZone({ onDrop, children }: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragCounter, setDragCounter] = useState(0);

    const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setDragCounter(prev => prev + 1);

        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setDragCounter(prev => prev - 1);

        if (dragCounter - 1 === 0) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setIsDragging(false);
        setDragCounter(0);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            onDrop(files);
        }
    };

    return (
        <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="relative min-h-full"
        >
            {children}

            {isDragging && (
                <div className="fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center backdrop-blur-sm">
                    <div className="text-center space-y-4 p-8 bg-[var(--bg-secondary)] rounded-xl border-2 border-dashed border-[var(--accent)] shadow-2xl">
                        <FiUploadCloud size={48} className="mx-auto text-[var(--accent)]" />
                        <h3 className="text-xl font-semibold text-[var(--text-primary)]">Drop files to upload</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Release to start uploading</p>
                    </div>
                </div>
            )}
        </div>
    );
}
