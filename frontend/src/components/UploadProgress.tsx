'use client';

import { FiFile, FiCheck, FiX, FiLoader } from 'react-icons/fi';
import { cn } from '@/lib/utils';

export interface UploadItem {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}

interface UploadProgressProps {
    uploads: UploadItem[];
    onClose: () => void;
}

export function UploadProgress({ uploads, onClose }: UploadProgressProps) {
    if (uploads.length === 0) return null;

    const totalProgress = uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length;
    const isComplete = uploads.every(u => u.status === 'success' || u.status === 'error');
    const successCount = uploads.filter(u => u.status === 'success').length;
    const errorCount = uploads.filter(u => u.status === 'error').length;

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-[var(--bg-secondary)] rounded-lg shadow-2xl border border-[var(--border)] overflow-hidden z-50">
            <div className="p-4 border-b border-[var(--border)]">
                <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
                        {isComplete ? 'Upload Complete' : 'Uploading Files'}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                        {isComplete
                            ? `${successCount} successful, ${errorCount} failed`
                            : `${Math.round(totalProgress)}% complete`
                        }
                    </p>
                </div>
                {isComplete && (
                    <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <FiX size={18} />
                    </button>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto p-4 space-y-3">
                {uploads.map((upload) => (
                    <div key={upload.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                            {upload.status === 'success' && <FiCheck size={16} color="var(--success)" />}
                            {upload.status === 'error' && <FiX size={16} color="var(--danger)" />}
                            {(upload.status === 'pending' || upload.status === 'uploading') && (
                                <FiLoader size={16} className="animate-spin text-[var(--accent)]" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-[var(--text-primary)] truncate font-medium">{upload.file.name}</div>
                            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                                {formatSize(upload.file.size)}
                                {upload.status === 'error' && upload.error && (
                                    <span className="text-[var(--danger)]"> • {upload.error}</span>
                                )}
                            </div>
                            {upload.status === 'uploading' && (
                                <div className="w-full h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-[var(--accent)] transition-all duration-300"
                                        style={{ width: `${upload.progress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex-shrink-0 text-xs text-[var(--text-secondary)] font-medium">
                            {upload.status === 'uploading' && `${upload.progress}%`}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
