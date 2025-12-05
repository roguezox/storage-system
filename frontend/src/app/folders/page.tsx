'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FolderCard } from '@/components/FolderCard';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { foldersAPI } from '@/lib/api';
import { FiPlus } from 'react-icons/fi';

interface Folder {
    _id: string;
    name: string;
    createdAt: string;
    isShared: boolean;
    shareId?: string;
}

export default function FoldersPage() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchFolders = useCallback(async () => {
        try {
            const response = await foldersAPI.getAll();
            setFolders(response.data);
        } catch (error) {
            console.error('Failed to fetch folders:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        setIsCreating(true);
        try {
            await foldersAPI.create(newFolderName);
            setNewFolderName('');
            setShowCreateModal(false);
            fetchFolders();
        } catch (error) {
            console.error('Failed to create folder:', error);
        } finally {
            setIsCreating(false);
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="spinner"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="page-header">
                <h1 className="page-title">All Folders</h1>
                <Button onClick={() => setShowCreateModal(true)}>
                    <FiPlus size={18} />
                    New Folder
                </Button>
            </div>

            {folders.length > 0 ? (
                <div className="folders-grid">
                    {folders.map(folder => (
                        <FolderCard
                            key={folder._id}
                            id={folder._id}
                            name={folder.name}
                            createdAt={folder.createdAt}
                            isShared={folder.isShared}
                            shareId={folder.shareId}
                            onRefresh={fetchFolders}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <h3>No folders yet</h3>
                    <p>Create your first folder to start organizing your files</p>
                    <Button onClick={() => setShowCreateModal(true)} style={{ marginTop: 16 }}>
                        <FiPlus size={18} />
                        Create Folder
                    </Button>
                </div>
            )}

            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create New Folder"
            >
                <form onSubmit={e => { e.preventDefault(); handleCreateFolder(); }}>
                    <Input
                        label="Folder Name"
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        placeholder="Enter folder name"
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isCreating}>
                            Create
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
