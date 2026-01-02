'use client';

import { useState } from 'react';
import { FiMoreVertical, FiEdit2, FiTrash2, FiShare2, FiLink, FiDownload, FiFileText, FiImage, FiFilm, FiMusic } from 'react-icons/fi';
import { filesAPI } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
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

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getFileIcon = () => {
        const size = 24;
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
            } else {
                const response = await filesAPI.share(id);
                const shareUrl = `${window.location.origin}/app/public/${response.data.shareId}`;
                await copyToClipboard(shareUrl);
                alert(`Share link copied to clipboard:\n${shareUrl}`);
            }
            onRefresh();
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
            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
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
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file');
        }
    };

    return (
        <>
            <div className={`file-card ${isDeleting ? 'opacity-50' : ''}`}>
                <div className="file-card-content" onClick={handleDownload} style={{ flex: 1 }}>
                    <div className="file-icon">
                        {getFileIcon()}
                        {isShared && <span className="shared-badge">Shared</span>}
                    </div>

                    {isRenaming ? (
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onBlur={handleRename}
                            onKeyDown={e => e.key === 'Enter' && handleRename()}
                            onClick={e => e.stopPropagation()}
                            className="input"
                            style={{ height: '24px', padding: '0 4px', fontSize: '13px' }}
                            autoFocus
                        />
                    ) : (
                        <h3 className="file-name">{originalName || name}</h3>
                    )}

                    <p className="file-meta">
                        {formatSize(size)} • {new Date(createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="file-actions">
                    <button
                        className="file-menu-btn"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <FiMoreVertical size={16} />
                    </button>

                    {showMenu && (
                        <div className="file-menu" onClick={e => e.stopPropagation()}>
                            <button onClick={handleDownload}>
                                <FiDownload size={14} /> Download
                            </button>
                            <button onClick={() => { setIsRenaming(true); setShowMenu(false); }}>
                                <FiEdit2 size={14} /> Rename
                            </button>
                            <button onClick={handleShare}>
                                <FiShare2 size={14} /> {isShared ? 'Unshare' : 'Share'}
                            </button>
                            {isShared && (
                                <button onClick={copyShareLink}>
                                    <FiLink size={14} /> Copy Link
                                </button>
                            )}
                            <div style={{ height: '1px', background: 'var(--border-default)', margin: '4px 0' }}></div>
                            <button onClick={(e) => handleDeleteClick(e)} className="danger">
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
                <div style={{ marginBottom: 24 }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                        Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-subtle)', padding: '8px 12px', borderRadius: '6px' }}>
                        This action cannot be undone.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteConfirm}>
                        Delete File
                    </Button>
                </div>
            </Modal>
        </>
    );
}
