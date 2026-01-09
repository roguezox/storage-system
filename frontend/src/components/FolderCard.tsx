'use client';

import { useState } from 'react';
import { FiFolder, FiMoreVertical, FiEdit2, FiTrash2, FiShare2, FiLink } from 'react-icons/fi';
import { useRouter } from 'next/navigation';
import { foldersAPI } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

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
                onRefresh();
            } else {
                const response = await foldersAPI.share(id);
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

    return (
        <>
            <div className={cn(
                'group relative flex items-start gap-3 bg-[var(--bg-secondary)] border border-[var(--border-subtle)]',
                'rounded-lg p-4 cursor-pointer transition-all duration-150',
                'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-default)]',
                'hover:-translate-y-0.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
                isDeleting && 'opacity-50'
            )}>
                <div
                    className="flex-1 relative z-10"
                    onClick={handleOpen}
                >
                    <div className="relative mb-3 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-[var(--accent-bg)] flex items-center justify-center transition-all duration-150">
                            <FiFolder size={18} color="var(--accent-color)" />
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
                            {name}
                        </h3>
                    )}

                    <p className="text-xs text-[var(--text-secondary)]">
                        {new Date(createdAt).toLocaleDateString()}
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
                title="Delete Folder"
            >
                <div className="mb-6">
                    <p className="text-[var(--text-secondary)] mb-3 leading-relaxed">
                        Are you sure you want to delete <strong className="text-[var(--text-primary)]">{name}</strong>?
                    </p>
                    <p className="text-[13px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-3 py-2 rounded-md">
                        This folder and its contents will be moved to trash and can be restored within 30 days.
                    </p>
                </div>
                <div className="flex gap-3 justify-end">
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
