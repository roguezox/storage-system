'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { foldersAPI } from '@/lib/api';
import { FiFolder, FiFile, FiHardDrive } from 'react-icons/fi';
import Link from 'next/link';

interface Stats {
    totalFolders: number;
    recentFolders: Array<{ _id: string; name: string; createdAt: string }>;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats>({ totalFolders: 0, recentFolders: [] });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await foldersAPI.getAll();
                setStats({
                    totalFolders: response.data.length,
                    recentFolders: response.data.slice(0, 5),
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
                        <FiFolder size={16} style={{ display: 'inline', marginRight: 8 }} />
                        Total Folders
                    </div>
                    <div className="stat-value">{stats.totalFolders}</div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">
                        <FiHardDrive size={16} style={{ display: 'inline', marginRight: 8 }} />
                        Storage Used
                    </div>
                    <div className="stat-value">--</div>
                </div>
            </div>

            <div className="section-title">Recent Folders</div>

            {stats.recentFolders.length > 0 ? (
                <div className="folders-grid">
                    {stats.recentFolders.map(folder => (
                        <Link
                            key={folder._id}
                            href={`/folders/${folder._id}`}
                            className="folder-card"
                            style={{ textDecoration: 'none' }}
                        >
                            <div className="folder-icon">
                                <FiFolder size={40} />
                            </div>
                            <h3 className="folder-name">{folder.name}</h3>
                            <p className="folder-date">
                                {new Date(folder.createdAt).toLocaleDateString()}
                            </p>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <h3>No folders yet</h3>
                    <p>Create your first folder to get started</p>
                    <Link href="/folders">
                        <button className="btn btn-primary" style={{ marginTop: 16 }}>
                            Go to Folders
                        </button>
                    </Link>
                </div>
            )}
        </DashboardLayout>
    );
}
