'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicAPI } from '@/lib/api';
import { getApiUrl } from '@/lib/config';
import { FiFolder, FiFile, FiDownload, FiAlertCircle, FiChevronRight, FiArrowLeft } from 'react-icons/fi';

interface SharedFolder {
    _id: string;
    name: string;
    createdAt: string;
    parentId?: string;
}

interface SharedFile {
    _id: string;
    name: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
}

interface BreadcrumbItem {
    _id: string;
    name: string;
}

interface FolderResponse {
    type: 'folder';
    folder: SharedFolder;
    subfolders: SharedFolder[];
    files: SharedFile[];
    breadcrumb?: BreadcrumbItem[];
    rootShareId: string;
    rootFolderId?: string;
}

interface FileResponse {
    type: 'file';
    file: SharedFile;
}

type SharedData = FolderResponse | FileResponse;

export default function PublicSharePage() {
    const params = useParams();
    const shareId = params.shareId as string;

    const [sharedData, setSharedData] = useState<SharedData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [navigationStack, setNavigationStack] = useState<BreadcrumbItem[]>([]);

    useEffect(() => {
        fetchData();
    }, [shareId]);

    const fetchData = async (folderId?: string) => {
        setIsLoading(true);
        setError(null);
        try {
            let response;
            if (folderId) {
                response = await publicAPI.getSubfolder(shareId, folderId);
            } else {
                response = await publicAPI.getShared(shareId);
            }
            setSharedData(response.data);
            setCurrentFolderId(folderId || null);

            if (response.data.breadcrumb) {
                setNavigationStack(response.data.breadcrumb);
            }
        } catch (err: unknown) {
            const axiosError = err as { response?: { data?: { error?: string } } };
            setError(axiosError.response?.data?.error || 'Failed to load shared content');
        } finally {
            setIsLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleDownloadFile = (fileId: string) => {
        const baseUrl = getApiUrl();
        window.open(`${baseUrl}/api/public/${shareId}/file/${fileId}/download`, '_blank');
    };

    const handleDownloadSharedFile = () => {
        const baseUrl = getApiUrl();
        window.open(`${baseUrl}/api/public/${shareId}/download`, '_blank');
    };

    const navigateToFolder = (folderId: string) => {
        fetchData(folderId);
    };

    const navigateBack = () => {
        if (navigationStack.length > 1) {
            const parentIdx = navigationStack.length - 2;
            const parentId = navigationStack[parentIdx]._id;
            fetchData(parentId);
        } else {
            // Go back to root
            fetchData();
        }
    };

    const navigateToBreadcrumb = (folderId: string, index: number) => {
        if (index === 0 && !currentFolderId) return;
        fetchData(folderId);
    };

    if (isLoading) {
        return (
            <div className="public-page">
                <div className="public-header">
                    <h1 className="public-title">📁 OpenDrive</h1>
                    <p className="public-subtitle">Loading...</p>
                </div>
                <div className="public-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="public-page">
                <div className="public-header">
                    <h1 className="public-title">📁 OpenDrive</h1>
                    <p className="public-subtitle">Shared Content</p>
                </div>
                <div className="public-content">
                    <div className="empty-state">
                        <div className="empty-state-icon-wrapper">
                            <FiAlertCircle size={48} />
                        </div>
                        <h3>{error}</h3>
                        <p>The share link may have expired or been revoked</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!sharedData) return null;

    return (
        <div className="public-page">
            <div className="public-header">
                <h1 className="public-title">📁 OpenDrive</h1>
                <p className="public-subtitle">Shared Content (Read-Only)</p>
            </div>

            <div className="public-content">
                {sharedData.type === 'folder' ? (
                    <div className="public-card">
                        {/* Back button */}
                        {currentFolderId && (
                            <button onClick={navigateBack} className="public-back-button">
                                <FiArrowLeft size={18} />
                                Back
                            </button>
                        )}

                        {/* Breadcrumb navigation */}
                        {navigationStack.length > 0 && (
                            <div className="public-breadcrumb">
                                {navigationStack.map((item, idx) => (
                                    <div key={item._id} className="public-breadcrumb-item">
                                        {idx > 0 && (
                                            <FiChevronRight size={14} className="public-breadcrumb-separator" />
                                        )}
                                        <button
                                            onClick={() => navigateToBreadcrumb(item._id, idx)}
                                            className="public-breadcrumb-button"
                                            disabled={idx === navigationStack.length - 1}
                                        >
                                            {item.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Folder header */}
                        <div className="public-item-header">
                            <FiFolder size={36} color="var(--accent)" />
                            <h2>{sharedData.folder.name}</h2>
                        </div>
                        <p className="public-item-meta">
                            Shared on {new Date(sharedData.folder.createdAt).toLocaleDateString()}
                        </p>

                        {/* Subfolders */}
                        {sharedData.subfolders && sharedData.subfolders.length > 0 && (
                            <div>
                                <h3 className="public-section-title">
                                    Folders ({sharedData.subfolders.length})
                                </h3>
                                <div className="public-list">
                                    {sharedData.subfolders.map((folder) => (
                                        <div
                                            key={folder._id}
                                            onClick={() => navigateToFolder(folder._id)}
                                            className="public-list-item clickable"
                                        >
                                            <div className="public-list-item-icon">
                                                <FiFolder size={20} color="var(--accent)" />
                                            </div>
                                            <div className="public-list-item-content">
                                                <div className="public-list-item-title">{folder.name}</div>
                                            </div>
                                            <FiChevronRight size={16} color="var(--text-muted)" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files */}
                        {sharedData.files && sharedData.files.length > 0 && (
                            <div>
                                <h3 className="public-section-title">
                                    Files ({sharedData.files.length})
                                </h3>
                                <div className="public-list">
                                    {sharedData.files.map((file) => (
                                        <div key={file._id} className="public-list-item">
                                            <div className="public-list-item-icon">
                                                <FiFile size={20} color="var(--text-muted)" />
                                            </div>
                                            <div className="public-list-item-content">
                                                <div className="public-list-item-title">
                                                    {file.originalName || file.name}
                                                </div>
                                                <div className="public-list-item-meta">
                                                    {formatSize(file.size)}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDownloadFile(file._id)}
                                                className="public-download-button"
                                            >
                                                <FiDownload size={14} />
                                                Download
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {(!sharedData.subfolders || sharedData.subfolders.length === 0) &&
                            (!sharedData.files || sharedData.files.length === 0) && (
                                <div className="empty-state">
                                    <div className="empty-state-icon-wrapper">
                                        <FiFolder size={48} />
                                    </div>
                                    <h3>This folder is empty</h3>
                                    <p>No files or subfolders to display</p>
                                </div>
                            )}
                    </div>
                ) : (
                    // Single file share
                    <div className="public-card">
                        <div className="public-file-preview">
                            <div className="public-file-icon">
                                <FiFile size={64} />
                            </div>
                            <h2 className="public-file-name">
                                {sharedData.file.originalName || sharedData.file.name}
                            </h2>
                            <p className="public-file-info">
                                {formatSize(sharedData.file.size)} • {sharedData.file.mimeType}
                            </p>
                            <p className="public-file-date">
                                Shared on {new Date(sharedData.file.createdAt).toLocaleDateString()}
                            </p>
                            <button
                                onClick={handleDownloadSharedFile}
                                className="public-download-button large"
                            >
                                <FiDownload size={18} />
                                Download File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
