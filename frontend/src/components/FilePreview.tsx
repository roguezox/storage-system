'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { FiX, FiDownload } from 'react-icons/fi';
import { Button } from './ui/Button';
import { getApiUrl } from '@/lib/config';
import Cookies from 'js-cookie';

interface FilePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    fileId: string;
    fileName: string;
    mimeType: string;
}

export function FilePreview({ isOpen, onClose, fileId, fileName, mimeType }: FilePreviewProps) {
    const [previewUrl, setPreviewUrl] = useState('');
    const [textContent, setTextContent] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const isImage = mimeType.startsWith('image/');
    const isPDF = mimeType === 'application/pdf';
    const isVideo = mimeType.startsWith('video/');
    const isText = mimeType.startsWith('text/') || ['application/json', 'application/javascript', 'application/xml'].includes(mimeType);

    useEffect(() => {
        if (isOpen && fileId) {
            loadPreview();
        }

        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [isOpen, fileId]);

    const loadPreview = async () => {
        setIsLoading(true);
        setError('');

        try {
            const token = Cookies.get('token');
            const response = await fetch(`${getApiUrl()}/api/files/${fileId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load file');
            }

            if (isText) {
                const text = await response.text();
                setTextContent(text);
            } else {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
            }
        } catch (err) {
            console.error('Preview error:', err);
            setError('Failed to load preview');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const token = Cookies.get('token');
            const response = await fetch(`${getApiUrl()}/api/files/${fileId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';

            document.body.appendChild(link);

            // Trigger download with a small delay for mobile
            setTimeout(() => {
                link.click();

                // Clean up after a delay to ensure download starts
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    document.body.removeChild(link);
                }, 100);
            }, 0);
        } catch (error) {
            console.error('Download error:', error);
            setError('Failed to download file');
        }
    };

    const renderPreviewContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-[var(--text-secondary)]">Loading preview...</div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                    <div className="text-[var(--danger)]">{error}</div>
                    <Button onClick={handleDownload} variant="primary">
                        <FiDownload size={16} />
                        Download File
                    </Button>
                </div>
            );
        }

        if (isImage) {
            return (
                <div className="max-h-[80vh] overflow-auto flex justify-center bg-[var(--bg-primary)] rounded-lg">
                    <img
                        src={previewUrl}
                        alt={fileName}
                        className="max-w-full h-auto rounded-lg"
                    />
                </div>
            );
        }

        if (isPDF) {
            return (
                <div className="h-[80vh] w-full">
                    <iframe
                        src={previewUrl}
                        className="w-full h-full border-none rounded-lg"
                        title={fileName}
                    />
                </div>
            );
        }

        if (isVideo) {
            return (
                <div className="max-h-[80vh] flex justify-center bg-[var(--bg-primary)] rounded-lg">
                    <video
                        src={previewUrl}
                        controls
                        className="max-w-full h-auto rounded-lg"
                    >
                        Your browser does not support video playback.
                    </video>
                </div>
            );
        }

        if (isText) {
            return (
                <div className="max-h-[80vh] overflow-auto bg-[var(--bg-primary)] p-4 rounded-lg">
                    <pre className="m-0 font-mono text-[13px] text-[var(--text-primary)] whitespace-pre-wrap break-words">
                        {textContent}
                    </pre>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="text-5xl">📄</div>
                <div className="text-[var(--text-secondary)] text-center">
                    <p>Preview not available for this file type</p>
                    <p className="text-xs mt-2">({mimeType})</p>
                </div>
                <Button onClick={handleDownload} variant="primary" className="mt-4">
                    <FiDownload size={16} />
                    Download File
                </Button>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={fileName} maxWidth="1000px">
            <div className="mb-4 flex justify-end">
                <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-[var(--text-primary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-md transition-colors hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)]"
                >
                    <FiDownload size={14} />
                    Download
                </button>
            </div>
            {renderPreviewContent()}
        </Modal>
    );
}
