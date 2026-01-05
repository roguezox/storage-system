'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { foldersAPI } from '@/lib/api';
import { FiFolder, FiFile, FiHardDrive, FiArrowRight, FiPlus, FiUpload, FiClock } from 'react-icons/fi';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

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

// Get greeting based on time of day
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export default function DashboardPage() {
    const { user } = useAuthStore();
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
                const [statsResponse, foldersResponse] = await Promise.all([
                    foldersAPI.getStats(),
                    foldersAPI.getAll()
                ]);

                setStats({
                    totalFolders: statsResponse.data.totalFolders,
                    totalFiles: statsResponse.data.totalFiles,
                    storageUsed: statsResponse.data.storageUsed,
                    recentFolders: foldersResponse.data.slice(0, 4),
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
                <div className="dashboard-loading">
                    <div className="spinner" style={{ width: 32, height: 32 }}></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            {/* Welcome Section */}
            <div className="dashboard-welcome">
                <div className="welcome-content">
                    <h1 className="welcome-title">
                        {getGreeting()}, <span className="welcome-name">{user?.email?.split('@')[0] || 'there'}</span>
                    </h1>
                    <p className="welcome-subtitle">
                        Here&apos;s what&apos;s happening with your storage today
                    </p>
                </div>
                <div className="welcome-actions">
                    <Link href="/app/folders" className="btn-quick-action">
                        <FiPlus size={18} />
                        <span>New Folder</span>
                    </Link>
                    <Link href="/app/folders" className="btn-quick-action btn-quick-action-primary">
                        <FiUpload size={18} />
                        <span>Upload</span>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="dashboard-stats">
                <div className="stat-card stat-card-folders">
                    <div className="stat-card-icon">
                        <FiFolder size={24} />
                    </div>
                    <div className="stat-card-content">
                        <span className="stat-card-value">{stats.totalFolders}</span>
                        <span className="stat-card-label">Total Folders</span>
                    </div>
                    <div className="stat-card-decoration"></div>
                </div>

                <div className="stat-card stat-card-files">
                    <div className="stat-card-icon">
                        <FiFile size={24} />
                    </div>
                    <div className="stat-card-content">
                        <span className="stat-card-value">{stats.totalFiles}</span>
                        <span className="stat-card-label">Total Files</span>
                    </div>
                    <div className="stat-card-decoration"></div>
                </div>

                <div className="stat-card stat-card-storage">
                    <div className="stat-card-icon">
                        <FiHardDrive size={24} />
                    </div>
                    <div className="stat-card-content">
                        <span className="stat-card-value">{formatBytes(stats.storageUsed)}</span>
                        <span className="stat-card-label">Storage Used</span>
                    </div>
                    <div className="stat-card-decoration"></div>
                </div>
            </div>

            {/* Recent Folders Section */}
            <div className="dashboard-section">
                <div className="section-header">
                    <div className="section-header-left">
                        <FiClock size={18} className="section-header-icon" />
                        <h2 className="section-header-title">Recent Folders</h2>
                    </div>
                    <Link href="/app/folders" className="section-header-link">
                        View all <FiArrowRight size={14} />
                    </Link>
                </div>

                {stats.recentFolders.length > 0 ? (
                    <div className="recent-folders-grid">
                        {stats.recentFolders.map((folder, index) => (
                            <Link
                                key={folder._id}
                                href={`/app/folders/${folder._id}`}
                                className="recent-folder-card"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="recent-folder-icon">
                                    <FiFolder size={20} />
                                </div>
                                <div className="recent-folder-info">
                                    <h3 className="recent-folder-name">{folder.name}</h3>
                                    <p className="recent-folder-date">
                                        {new Date(folder.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </p>
                                </div>
                                <FiArrowRight className="recent-folder-arrow" size={16} />
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state-dashboard">
                        <div className="empty-state-icon-wrapper">
                            <FiFolder size={32} />
                        </div>
                        <h3>No folders yet</h3>
                        <p>Create your first folder to organize your files</p>
                        <Link href="/app/folders" className="btn-get-started">
                            <FiPlus size={18} />
                            Create First Folder
                        </Link>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
