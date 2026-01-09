'use client';

import { useState } from 'react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiShare2, FiLink, FiDownload, FiFileText, FiImage, FiFilm, FiMusic } from 'react-icons/fi';
import { filesAPI } from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FilePreview } from '@/components/FilePreview';
import { cn } from '@/lib/utils';
import Cookies from 'js-cookie';

interface FileCardProps {
    id: string;
    name: string;
    originalName?: string;
    url?: string;
    mimeType: string;
    size: number;
    createdAt: string;
    isShared?: boolean;
    shareId?: string;
    onRefresh: () => void;
}

export function FileCard({ id, name, originalName, url, mimeType, size, createdAt, isShared, shareId, onRefresh }: FileCardProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(name);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = () => {
        const size = 20;
        const color = 'var(--text-secondary)';

        if (mimeType.startsWith('image/')) return <FiImage size={size} color={color} />;
        if (mimeType.startsWith('video/')) return <FiFilm size={size} color={color} />;
        if (mimeType.startsWith('audio/')) return <FiMusic size={size} color={color} />;
        return <FiFileText size={size} color={color} />;
    };

    const copyToClipboard = async (text: string) => {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Unable to copy to clipboard', err);
            }
            document.body.removeChild(textArea);
        }
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === name) {
            setIsRenaming(false);
            return;
        }

        try {
            await filesAPI.rename(id, newName);
            onRefresh();
            setIsRenaming(false);
        } catch (error) {
            console.error('Failed to rename file:', error);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(false);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true);
        setShowDeleteModal(false);
        try {
            await filesAPI.delete(id);
            onRefresh();
        } catch (error) {
            console.error('Failed to delete file:', error);
            alert('Failed to delete file. Please try again.');
            setIsDeleting(false);
        }
    };

    const handleShare = async () => {
        try {
            if (isShared) {
                await filesAPI.unshare(id);
                onRefresh();
            } else {
                const response = await filesAPI.share(id);
                const shareUrl = `${window.location.origin}/app/public/${response.data.shareId}`;
                await copyToClipboard(shareUrl);
                onRefresh();
                alert(`Share link copied to clipboard:\n${shareUrl}`);
            }
        } catch (error) {
            console.error('Failed to toggle share:', error);
        }
        setShowMenu(false);
    };

    const copyShareLink = async () => {
        if (shareId) {
            const shareUrl = `${window.location.origin}/app/public/${shareId}`;
            await copyToClipboard(shareUrl);
            alert('Share link copied to clipboard!');
        }
    };

    const handleDownload = async () => {
        try {
            const baseUrl = getApiUrl();
            const token = Cookies.get('token');

            const response = await fetch(`${baseUrl}/api/files/${id}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = originalName || name || 'download';
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            document.body.appendChild(a);

            // Trigger download with a small delay for mobile
            setTimeout(() => {
                a.click();

                // Clean up after a delay to ensure download starts
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 100);
            }, 0);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file');
        }
    };

    return (
        <>
            <div className={cn(
                'group relative flex items-start gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)]',
                'rounded-lg p-4 transition-all duration-150',
                'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-default)]',
                'hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
                isDeleting && 'opacity-50'
            )}>
                <div
                    className="flex-1 cursor-pointer relative z-10"
                    onClick={() => setShowPreview(true)}
                >
                    <div className="relative mb-3 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center transition-all duration-150">
                            {getFileIcon()}
                        </div>
                        {isShared && (
                            <span className="px-2 py-0.5 text-[10px] font-medium text-[var(--accent-color)] bg-[var(--accent-bg)] border border-[var(--accent-border)] rounded-md">
                                Shared
                            </span>
                        )}
                    </div>

                    {isRenaming ? (
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            onClick={e => e.stopPropagation()}
                            className="w-full h-6 px-1 text-[13px] text-[var(--text-primary)] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded outline-none focus:border-[var(--accent-color)]"
                            autoFocus
                        />
                    ) : (
                        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1.5 truncate">
                            {originalName || name}
                        </h3>
                    )}

                    <p className="text-xs text-[var(--text-secondary)]">
                        {formatSize(size)} • {new Date(createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="relative z-10">
                    <button
                        className={cn(
                            'p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                            'hover:bg-[var(--bg-elevated)] rounded-md transition-all duration-150',
                            'opacity-0 group-hover:opacity-100'
                        )}
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <FiMoreVertical size={16} />
                    </button>

                    {showMenu && (
                        <div
                            className="absolute right-0 top-8 min-w-[160px] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl overflow-hidden z-50 animate-scale-in"
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                onClick={handleDownload}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left"
                            >
                                <FiDownload size={14} /> Download
                            </button>
                            <button
                                onClick={() => { setIsRenaming(true); setShowMenu(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left"
                            >
                                <FiEdit2 size={14} /> Rename
                            </button>
                            <button
                                onClick={handleShare}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left"
                            >
                                <FiShare2 size={14} /> {isShared ? 'Unshare' : 'Share'}
                            </button>
                            {isShared && (
                                <button
                                    onClick={copyShareLink}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors text-left"
                                >
                                    <FiLink size={14} /> Copy Link
                                </button>
                            )}
                            <div className="h-px bg-[var(--border-default)] my-1"></div>
                            <button
                                onClick={(e) => handleDeleteClick(e)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--danger-color)] hover:bg-[var(--danger-bg)] transition-colors text-left"
                            >
                                <FiTrash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                title="Delete File"
            >
                <div className="mb-6">
                    <p className="text-[var(--text-secondary)] mb-3 leading-relaxed">
                        Are you sure you want to delete <strong className="text-[var(--text-primary)]">{name}</strong>?
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-2 rounded-md">
                        This file will be moved to trash and can be restored within 30 days.
                    </p>
                </div>
                <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteConfirm}>
                        Delete File
                    </Button>
                </div>
            </Modal>

            {/* File Preview Modal */}
            <FilePreview
                isOpen={showPreview}
                onClose={() => setShowPreview(false)}
                fileId={id}
                fileName={originalName || name}
                mimeType={mimeType}
            />
        </>
    );
}
