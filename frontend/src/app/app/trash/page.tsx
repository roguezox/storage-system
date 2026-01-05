'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { filesAPI, foldersAPI } from '@/lib/api';
import { FiTrash2, FiRotateCcw, FiAlertCircle, FiFolder, FiFile } from 'react-icons/fi';

interface TrashedFile {
    _id: string;
    originalName: string;
    size: number;
    deletedAt: string;
    mimeType: string;
}

interface TrashedFolder {
    _id: string;
    name: string;
    deletedAt: string;
}

export default function TrashPage() {
    const [files, setFiles] = useState<TrashedFile[]>([]);
    const [folders, setFolders] = useState<TrashedFolder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEmptyModal, setShowEmptyModal] = useState(false);
    const [isEmptying, setIsEmptying] = useState(false);

    const fetchTrash = useCallback(async () => {
        try {
            const [filesRes, foldersRes] = await Promise.all([
                filesAPI.getTrash(),
                foldersAPI.getTrash()
            ]);
            setFiles(filesRes.data);
            setFolders(foldersRes.data);
        } catch (error) {
            console.error('Failed to fetch trash:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrash();
    }, [fetchTrash]);

    const handleRestoreFile = async (id: string) => {
        try {
            await filesAPI.restore(id);
            fetchTrash();
        } catch (error) {
            console.error('Failed to restore file:', error);
        }
    };

    const handleRestoreFolder = async (id: string) => {
        try {
            await foldersAPI.restore(id);
            fetchTrash();
        } catch (error) {
            console.error('Failed to restore folder:', error);
        }
    };

    const handlePermanentDeleteFile = async (id: string) => {
        if (!confirm('Permanently delete this file? This cannot be undone.')) return;

        try {
            await filesAPI.permanentDelete(id);
            fetchTrash();
        } catch (error) {
            console.error('Failed to delete file:', error);
        }
    };

    const handlePermanentDeleteFolder = async (id: string) => {
        if (!confirm('Permanently delete this folder and all contents? This cannot be undone.')) return;

        try {
            await foldersAPI.permanentDelete(id);
            fetchTrash();
        } catch (error) {
            console.error('Failed to delete folder:', error);
        }
    };

    const handleEmptyTrash = async () => {
        setIsEmptying(true);
        try {
            await Promise.all([
                filesAPI.emptyTrash(),
                foldersAPI.emptyTrash()
            ]);
            setShowEmptyModal(false);
            fetchTrash();
        } catch (error) {
            console.error('Failed to empty trash:', error);
        } finally {
            setIsEmptying(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const getDaysRemaining = (deletedAt: string) => {
        const deletedDate = new Date(deletedAt);
        const now = new Date();
        const daysPassed = Math.floor((now.getTime() - deletedDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = 30 - daysPassed;

        if (daysRemaining > 0) {
            return `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left`;
        }
        return 'Expiring soon';
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
                </div>
            </DashboardLayout>
        );
    }

    const isEmpty = files.length === 0 && folders.length === 0;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)' }}>Trash</h1>
                {!isEmpty && (
                    <Button
                        onClick={() => setShowEmptyModal(true)}
                        style={{
                            background: 'var(--danger)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <FiTrash2 size={16} />
                        Empty Trash
                    </Button>
                )}
            </div>

            {!isEmpty && (
                <div style={{
                    padding: '12px 16px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgb(245, 158, 11)',
                    borderRadius: '8px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <FiAlertCircle size={18} color="rgb(245, 158, 11)" />
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        Items in trash will be permanently deleted after 30 days
                    </span>
                </div>
            )}

            {/* Folders */}
            {folders.length > 0 && (
                <>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Folders ({folders.length})
                    </div>
                    <div style={{ display: 'grid', gap: '12px', marginBottom: folders.length > 0 && files.length > 0 ? '32px' : '0' }}>
                        {folders.map(folder => (
                            <div key={folder._id} style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <FiFolder size={20} color="var(--accent)" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {folder.name}
                                        </h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            Deleted {new Date(folder.deletedAt).toLocaleDateString()} • {getDaysRemaining(folder.deletedAt)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button
                                        onClick={() => handleRestoreFolder(folder._id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
                                    >
                                        <FiRotateCcw size={14} />
                                        Restore
                                    </Button>
                                    <Button
                                        onClick={() => handlePermanentDeleteFolder(folder._id)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--danger)',
                                            color: 'var(--danger)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <FiTrash2 size={14} />
                                        Delete Forever
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Files */}
            {files.length > 0 && (
                <>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: folders.length > 0 ? '0' : '0' }}>
                        Files ({files.length})
                    </div>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        {files.map(file => (
                            <div key={file._id} style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '8px',
                                padding: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <FiFile size={20} color="var(--text-secondary)" />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.originalName}
                                        </h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {formatSize(file.size)} • Deleted {new Date(file.deletedAt).toLocaleDateString()} • {getDaysRemaining(file.deletedAt)}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Button
                                        onClick={() => handleRestoreFile(file._id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '13px' }}
                                    >
                                        <FiRotateCcw size={14} />
                                        Restore
                                    </Button>
                                    <Button
                                        onClick={() => handlePermanentDeleteFile(file._id)}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--danger)',
                                            color: 'var(--danger)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 12px',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <FiTrash2 size={14} />
                                        Delete Forever
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Empty State */}
            {isEmpty && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>Trash is empty</h3>
                    <p style={{ fontSize: '14px' }}>Deleted files and folders will appear here</p>
                </div>
            )}

            {/* Empty Trash Confirmation Modal */}
            {showEmptyModal && (
                <Modal isOpen={showEmptyModal} onClose={() => setShowEmptyModal(false)} title="Empty Trash">
                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.5' }}>
                            Are you sure you want to permanently delete all items in trash?
                        </p>
                        <p style={{
                            color: 'var(--danger)',
                            fontSize: '13px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '8px 12px',
                            borderRadius: '6px'
                        }}>
                            This action cannot be undone. All {files.length + folders.length} items will be permanently deleted.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setShowEmptyModal(false)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleEmptyTrash}
                            style={{ background: 'var(--danger)', color: 'white' }}
                            disabled={isEmptying}
                        >
                            {isEmptying ? 'Emptying...' : 'Empty Trash'}
                        </Button>
                    </div>
                </Modal>
            )}
        </DashboardLayout>
    );
}
