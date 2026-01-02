'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicAPI } from '@/lib/api';
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
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') : '';
        window.open(`${baseUrl}/api/public/${shareId}/file/${fileId}/download`, '_blank');
    };

    const handleDownloadSharedFile = () => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') : '';
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '64vh' }}>
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="public-page">
                <div className="public-header">
                    <h1 className="public-title">📁 Drive</h1>
                    <p className="public-subtitle">Shared Content</p>
                </div>
                <div className="public-content">
                    <div className="empty-state">
                        <div className="empty-state-icon"><FiAlertCircle size={48} /></div>
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
                <h1 className="public-title">📁 Drive</h1>
                <p className="public-subtitle">Shared Content (Read-Only)</p>
            </div>

            <div className="public-content">
                {sharedData.type === 'folder' ? (
                    <div className="public-card">
                        {/* Navigation */}
                        <div style={{ marginBottom: 24 }}>
                            {currentFolderId && (
                                <button
                                    onClick={navigateBack}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent)',
                                        cursor: 'pointer',
                                        padding: '8px 0',
                                        marginBottom: 12
                                    }}
                                >
                                    <FiArrowLeft size={18} />
                                    Back
                                </button>
                            )}

                            {/* Breadcrumb */}
                            {navigationStack.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                                    {navigationStack.map((item, idx) => (
                                        <span key={item._id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            {idx > 0 && <FiChevronRight size={14} color="var(--text-muted)" />}
                                            <button
                                                onClick={() => navigateToBreadcrumb(item._id, idx)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: idx === navigationStack.length - 1 ? 'var(--text-primary)' : 'var(--accent)',
                                                    cursor: idx === navigationStack.length - 1 ? 'default' : 'pointer',
                                                    padding: 0,
                                                    fontSize: 14
                                                }}
                                            >
                                                {item.name}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <FiFolder size={32} color="var(--accent)" />
                                <h2 style={{ fontSize: 20, fontWeight: 600 }}>{sharedData.folder.name}</h2>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                Shared on {new Date(sharedData.folder.createdAt).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Subfolders */}
                        {sharedData.subfolders && sharedData.subfolders.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Folders ({sharedData.subfolders.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sharedData.subfolders.map((folder) => (
                                        <div
                                            key={folder._id}
                                            onClick={() => navigateToFolder(folder._id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: 12,
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <FiFolder size={20} color="var(--accent)" />
                                            <span style={{ flex: 1 }}>{folder.name}</span>
                                            <FiChevronRight size={16} color="var(--text-muted)" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Files */}
                        {sharedData.files && sharedData.files.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Files ({sharedData.files.length})
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sharedData.files.map((file) => (
                                        <div
                                            key={file._id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: 12,
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                            }}
                                        >
                                            <FiFile size={20} color="var(--text-muted)" />
                                            <div style={{ flex: 1 }}>
                                                <span>{file.originalName || file.name}</span>
                                                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    {formatSize(file.size)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDownloadFile(file._id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '6px 12px',
                                                    background: 'var(--accent)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    fontSize: 13
                                                }}
                                            >
                                                <FiDownload size={14} />
                                                Download
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(!sharedData.subfolders || sharedData.subfolders.length === 0) &&
                            (!sharedData.files || sharedData.files.length === 0) && (
                                <div className="empty-state">
                                    <p>This folder is empty</p>
                                </div>
                            )}
                    </div>
                ) : (
                    <div className="public-card">
                        <div style={{ padding: 24, textAlign: 'center' }}>
                            <FiFile size={64} color="var(--text-muted)" style={{ marginBottom: 16 }} />
                            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                                {sharedData.file.originalName || sharedData.file.name}
                            </h2>
                            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
                                {formatSize(sharedData.file.size)} • {sharedData.file.mimeType}
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                                Shared on {new Date(sharedData.file.createdAt).toLocaleDateString()}
                            </p>
                            <button
                                onClick={handleDownloadSharedFile}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '12px 24px',
                                    background: 'var(--accent)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 15,
                                    fontWeight: 500
                                }}
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
