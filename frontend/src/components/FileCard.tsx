'use client';

import { useState } from 'react';
import { FiFile, FiMoreVertical, FiEdit2, FiTrash2, FiShare2, FiLink, FiDownload } from 'react-icons/fi';
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
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎬';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
        if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
        return '📁';
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
                const shareUrl = `${window.location.origin}/public/${response.data.shareId}`;
                await navigator.clipboard.writeText(shareUrl);
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
            const shareUrl = `${window.location.origin}/public/${shareId}`;
            await navigator.clipboard.writeText(shareUrl);
            alert('Share link copied to clipboard!');
        }
    };

    const handleDownload = async () => {
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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

    const displayName = originalName || name;

    return (
        <>
            <div className={`file-card ${isDeleting ? 'opacity-50' : ''}`}>
                <div className="file-card-content" onClick={handleDownload}>
                    <div className="file-icon">
                        <span className="file-emoji">{getFileIcon()}</span>
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
                            className="file-rename-input"
                            autoFocus
                        />
                    ) : (
                        <h3 className="file-name">{name}</h3>
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
                        <FiMoreVertical size={18} />
                    </button>

                    {showMenu && (
                        <div className="file-menu" onClick={e => e.stopPropagation()}>
                            <button onClick={handleDownload}>
                                <FiDownload size={16} /> Download
                            </button>
                            <button onClick={() => { setIsRenaming(true); setShowMenu(false); }}>
                                <FiEdit2 size={16} /> Rename
                            </button>
                            <button onClick={handleShare}>
                                <FiShare2 size={16} /> {isShared ? 'Unshare' : 'Share'}
                            </button>
                            {isShared && (
                                <button onClick={copyShareLink}>
                                    <FiLink size={16} /> Copy Link
                                </button>
                            )}
                            <button onClick={(e) => handleDeleteClick(e)} className="danger">
                                <FiTrash2 size={16} /> Delete
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
                <div style={{ marginBottom: 20 }}>
                    <p style={{ color: 'var(--foreground-secondary)', marginBottom: 8 }}>
                        Are you sure you want to delete <strong>&quot;{name}&quot;</strong>?
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: 14 }}>
                        ⚠️ This action cannot be undone.
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
