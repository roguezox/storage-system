'use client';

import { useState } from 'react';
import { FiFolder, FiMoreVertical, FiEdit2, FiTrash2, FiShare2, FiLink } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { foldersAPI } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface FolderCardProps {
    id: string;
    name: string;
    createdAt: string;
    isShared?: boolean;
    shareId?: string;
    onRefresh: () => void;
}

export function FolderCard({ id, name, createdAt, isShared, shareId, onRefresh }: FolderCardProps) {
    const router = useRouter();
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(name);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const handleOpen = () => {
        router.push(`/app/folders/${id}`);
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === name) {
            setIsRenaming(false);
            return;
        }

        try {
            await foldersAPI.rename(id, newName);
            onRefresh();
            setIsRenaming(false);
        } catch (error) {
            console.error('Failed to rename folder:', error);
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
            await foldersAPI.delete(id);
            onRefresh();
        } catch (error) {
            console.error('Failed to delete folder:', error);
            alert('Failed to delete folder. Please try again.');
            setIsDeleting(false);
        }
    };

    const handleShare = async () => {
        try {
            if (isShared) {
                await foldersAPI.unshare(id);
            } else {
                const response = await foldersAPI.share(id);
                const shareUrl = `${window.location.origin}/app/public/${response.data.shareId}`;
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
            const shareUrl = `${window.location.origin}/app/public/${shareId}`;
            await navigator.clipboard.writeText(shareUrl);
            alert('Share link copied to clipboard!');
        }
    };

    return (
        <>
            <div className={`folder-card ${isDeleting ? 'opacity-50' : ''}`}>
                <div className="folder-card-content" onClick={handleOpen} style={{ flex: 1 }}>
                    <div className="folder-icon">
                        <FiFolder size={24} />
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
                        <h3 className="folder-name">{name}</h3>
                    )}

                    <p className="folder-date">
                        {new Date(createdAt).toLocaleDateString()}
                    </p>
                </div>

                <div className="folder-actions">
                    <button
                        className="folder-menu-btn"
                        onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <FiMoreVertical size={16} />
                    </button>

                    {showMenu && (
                        <div className="folder-menu" onClick={e => e.stopPropagation()}>
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
                title="Delete Folder"
            >
                <div style={{ marginBottom: 24 }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                        Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>?
                    </p>
                    <p style={{ color: 'var(--danger)', fontSize: 13, background: 'var(--danger-subtle)', padding: '8px 12px', borderRadius: '6px' }}>
                        This will permanently delete the folder and all its contents.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDeleteConfirm}>
                        Delete Folder
                    </Button>
                </div>
            </Modal>
        </>
    );
}
