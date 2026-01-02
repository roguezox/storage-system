'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiFolder, FiLogOut, FiHardDrive, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { logout } = useAuthStore();

    const navItems = [
        { href: '/app/dashboard', label: 'Dashboard', icon: FiHome },
        { href: '/app/folders', label: 'All Folders', icon: FiFolder },
    ];

    return (
        <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <FiHardDrive size={18} className="text-accent" />
                    <span>OpenDrive</span>
                </div>
                <button
                    onClick={onClose}
                    className="mobile-close-btn"
                    style={{
                        marginLeft: 'auto',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <FiX size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-label">
                    Workspace
                </div>
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose} // Close sidebar on navigation on mobile
                        className={`sidebar-link ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
                    >
                        <item.icon size={16} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button onClick={logout} className="sidebar-link">
                    <FiLogOut size={16} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
