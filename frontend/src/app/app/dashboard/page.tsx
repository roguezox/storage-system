'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { foldersAPI } from '@/lib/api';
import { FiFolder, FiFile, FiHardDrive } from 'react-icons/fi';
import Link from 'next/link';

interface Stats {
    totalFolders: number;
    totalFiles: number;
    storageUsed: number;
    recentFolders: Array<{ _id: string; name: string; createdAt: string }>;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({
        totalFolders: 0,
        totalFiles: 0,
        storageUsed: 0,
        recentFolders: []
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch both stats and folders in parallel
                const [statsResponse, foldersResponse] = await Promise.all([
                    foldersAPI.getStats(),
                    foldersAPI.getAll()
                ]);

                setStats({
                    totalFolders: statsResponse.data.totalFolders,
                    totalFiles: statsResponse.data.totalFiles,
                    storageUsed: statsResponse.data.storageUsed,
                    recentFolders: foldersResponse.data.slice(0, 5),
                });
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

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
                <h1 className="page-title">Dashboard</h1>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">
                        <FiFolder size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Total Folders
                    </div>
                    <div className="stat-value">{stats.totalFolders}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">
                        <FiFile size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Total Files
                    </div>
                    <div className="stat-value">{stats.totalFiles}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">
                        <FiHardDrive size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }} />
                        Storage Used
                    </div>
                    <div className="stat-value">{formatBytes(stats.storageUsed)}</div>
                </div>
            </div>

            <div className="section-title">Recent Folders</div>

            {stats.recentFolders.length > 0 ? (
                <div className="folders-grid">
                    {stats.recentFolders.map(folder => (
                        <Link
                            key={folder._id}
                            href={`/app/folders/${folder._id}`}
                            className="folder-card"
                            style={{ textDecoration: 'none' }}
                        >
                            <div className="folder-icon">
                                <FiFolder size={24} />
                            </div>
                            <h3 className="folder-name">{folder.name}</h3>
                            <p className="folder-date">
                                {new Date(folder.createdAt).toLocaleDateString()}
                            </p>
                        </Link>
                    ))}
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '64px', border: '1px dashed var(--border-default)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.5 }}>📁</div>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>No folders yet</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Create your first folder to get started</p>
                    <Link href="/app/folders" className="btn btn-primary">
                        Go to Folders
                    </Link>
                </div>
            )}
        </DashboardLayout>
    );
}
