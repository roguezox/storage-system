'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FolderCard } from '@/components/FolderCard';
import { FileCard } from '@/components/FileCard';
import { Breadcrumb } from '@/components/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DropZone } from '@/components/DropZone';
import { UploadProgress, UploadItem } from '@/components/UploadProgress';
import { foldersAPI, filesAPI } from '@/lib/api';
import { generateUUID } from '@/lib/uuid';
import { FiPlus, FiUpload } from 'react-icons/fi';

interface Folder {
    _id: string;
    name: string;
    createdAt: string;
    isShared: boolean;
    shareId?: string;
}

interface StoredFile {
    _id: string;
    name: string;
    originalName?: string;
    url?: string;
    mimeType: string;
    size: number;
    createdAt: string;
    isShared: boolean;
    shareId?: string;
}

interface BreadcrumbItem {
    id: string;
    name: string;
}

export default function FolderDetailPage() {
    const params = useParams();
    const folderId = params.id as string;

    const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
    const [subfolders, setSubfolders] = useState<Folder[]>([]);
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFolderData = useCallback(async () => {
        try {
            const response = await foldersAPI.getById(folderId);
            setCurrentFolder(response.data.folder);
            setSubfolders(response.data.subfolders);
            setFiles(response.data.files);
            setBreadcrumb(response.data.breadcrumb);
        } catch (error) {
            console.error('Failed to fetch folder:', error);
        } finally {
            setIsLoading(false);
        }
    }, [folderId]);

    useEffect(() => {
        fetchFolderData();
    }, [fetchFolderData]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        setIsCreating(true);
        try {
            await foldersAPI.create(newFolderName, folderId);
            setNewFolderName('');
            setShowCreateFolderModal(false);
            fetchFolderData();
        } catch (error) {
            console.error('Failed to create folder:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleFilesSelected = async (selectedFiles: File[]) => {
        if (selectedFiles.length === 0) return;

        // Initialize upload items
        const newUploads: UploadItem[] = selectedFiles.map(file => ({
            id: generateUUID(),
            file,
            progress: 0,
            status: 'pending' as const,
        }));

        setUploads(prev => [...prev, ...newUploads]);

        // Upload files sequentially
        for (const upload of newUploads) {
            try {
                setUploads(prev => prev.map(u =>
                    u.id === upload.id ? { ...u, status: 'uploading' } : u
                ));

                await filesAPI.upload(folderId, [upload.file], (progress) => {
                    setUploads(prev => prev.map(u =>
                        u.id === upload.id ? { ...u, progress } : u
                    ));
                });

                setUploads(prev => prev.map(u =>
                    u.id === upload.id ? { ...u, status: 'success', progress: 100 } : u
                ));
            } catch (error) {
                console.error('Upload failed:', error);
                setUploads(prev => prev.map(u =>
                    u.id === upload.id
                        ? { ...u, status: 'error', error: 'Upload failed' }
                        : u
                ));
            }
        }

        // Refresh folder data after all uploads
        fetchFolderData();
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            handleFilesSelected(selectedFiles);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDrop = (droppedFiles: File[]) => {
        handleFilesSelected(droppedFiles);
    };

    const clearUploads = () => {
        setUploads([]);
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
            <DropZone onDrop={handleDrop}>
                <Breadcrumb items={breadcrumb} />

                <div className="page-header">
                    <h1 className="page-title">{currentFolder?.name}</h1>
                    <div className="flex gap-3">
                        <Button onClick={() => setShowCreateFolderModal(true)} variant="secondary">
                            <FiPlus size={16} />
                            New Folder
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()}>
                            <FiUpload size={16} />
                            Upload Files
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

            {/* Subfolders */}
            {subfolders.length > 0 && (
                <>
                    <div className="section-title">Folders</div>
                    <div className="folders-grid" style={{ marginBottom: 32 }}>
                        {subfolders.map(folder => (
                            <FolderCard
                                key={folder._id}
                                id={folder._id}
                                name={folder.name}
                                createdAt={folder.createdAt}
                                isShared={folder.isShared}
                                shareId={folder.shareId}
                                onRefresh={fetchFolderData}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Files */}
            {files.length > 0 && (
                <>
                    <div className="section-title">Files</div>
                    <div className="files-grid">
                        {files.map(file => (
                            <FileCard
                                key={file._id}
                                id={file._id}
                                name={file.name}
                                originalName={file.originalName}
                                url={file.url}
                                mimeType={file.mimeType}
                                size={file.size}
                                createdAt={file.createdAt}
                                isShared={file.isShared}
                                shareId={file.shareId}
                                onRefresh={fetchFolderData}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Empty State */}
            {subfolders.length === 0 && files.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📂</div>
                    <h3>This folder is empty</h3>
                    <p>Add folders or upload files to get started</p>
                    <div className="flex gap-3">
                        <Button onClick={() => setShowCreateFolderModal(true)} variant="secondary">
                            <FiPlus size={16} />
                            New Folder
                        </Button>
                        <Button onClick={() => fileInputRef.current?.click()}>
                            <FiUpload size={16} />
                            Upload Files
                        </Button>
                    </div>
                </div>
            )}

                {/* Upload Progress Widget */}
                {uploads.length > 0 && (
                    <div style={{ position: 'fixed', bottom: '24px', right: '24px', width: '400px', maxWidth: 'calc(100vw - 48px)', zIndex: 1000 }}>
                        <UploadProgress uploads={uploads} onClose={clearUploads} />
                    </div>
                )}
            </DropZone>

            {/* Create Folder Modal */}
            <Modal
                isOpen={showCreateFolderModal}
                onClose={() => setShowCreateFolderModal(false)}
                title="Create New Folder"
            >
                <form onSubmit={e => { e.preventDefault(); handleCreateFolder(); }}>
                    <div style={{ marginBottom: 20 }}>
                        <Input
                            label="Folder Name"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="Enter folder name"
                            autoFocus
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateFolderModal(false)}>
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
