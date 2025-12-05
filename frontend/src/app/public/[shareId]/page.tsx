'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicAPI } from '@/lib/api';
import { FiFolder, FiFile, FiDownload, FiAlertCircle } from 'react-icons/fi';

interface SharedFolder {
    id: string;
    name: string;
    createdAt: string;
    subfolders: Array<{ name: string; createdAt: string; shareId?: string }>;
    files: Array<{ name: string; url: string; mimeType: string; size: number; createdAt: string }>;
}

interface SharedFile {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
    createdAt: string;
}

type SharedData =
    | { type: 'folder'; data: SharedFolder }
    | { type: 'file'; data: SharedFile };

export default function PublicSharePage() {
    const params = useParams();
    const shareId = params.shareId as string;

    const [sharedData, setSharedData] = useState<SharedData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSharedData = async () => {
            try {
                const response = await publicAPI.getShared(shareId);
                setSharedData(response.data);
            } catch (err: unknown) {
                const axiosError = err as { response?: { data?: { error?: string } } };
                setError(axiosError.response?.data?.error || 'Failed to load shared content');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSharedData();
    }, [shareId]);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleDownload = (url: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        window.open(`${baseUrl}${url}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="public-page">
                <div className="flex items-center justify-center h-64">
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
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                <FiFolder size={32} color="var(--primary)" />
                                <h2 style={{ fontSize: 20, fontWeight: 600 }}>{sharedData.data.name}</h2>
                            </div>
                            <p style={{ color: 'var(--foreground-muted)', fontSize: 14 }}>
                                Shared on {new Date(sharedData.data.createdAt).toLocaleDateString()}
                            </p>
                        </div>

                        {sharedData.data.subfolders.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, color: 'var(--foreground-secondary)', marginBottom: 12 }}>
                                    Folders ({sharedData.data.subfolders.length})
                                </h3>
                                {sharedData.data.subfolders.map((folder, idx) => (
                                    <div key={idx} className="public-folder-item">
                                        <span className="public-item-icon"><FiFolder /></span>
                                        <span className="public-item-name">{folder.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {sharedData.data.files.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: 14, color: 'var(--foreground-secondary)', marginBottom: 12 }}>
                                    Files ({sharedData.data.files.length})
                                </h3>
                                {sharedData.data.files.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="public-file-item"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleDownload(file.url)}
                                    >
                                        <span className="public-item-icon"><FiFile /></span>
                                        <div style={{ flex: 1 }}>
                                            <span className="public-item-name">{file.name}</span>
                                            <p style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                                                {formatSize(file.size)}
                                            </p>
                                        </div>
                                        <FiDownload size={18} color="var(--foreground-muted)" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {sharedData.data.subfolders.length === 0 && sharedData.data.files.length === 0 && (
                            <div className="empty-state">
                                <p>This folder is empty</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="public-card">
                        <div
                            className="public-file-item"
                            style={{ cursor: 'pointer', padding: 24 }}
                            onClick={() => handleDownload(sharedData.data.url)}
                        >
                            <span style={{ fontSize: 48 }}><FiFile /></span>
                            <div style={{ flex: 1 }}>
                                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                                    {sharedData.data.name}
                                </h2>
                                <p style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                                    {formatSize(sharedData.data.size)} • {sharedData.data.mimeType}
                                </p>
                                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4 }}>
                                    Shared on {new Date(sharedData.data.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <button className="btn btn-primary">
                                <FiDownload size={18} />
                                Download
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
