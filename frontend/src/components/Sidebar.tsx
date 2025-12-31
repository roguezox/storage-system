'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiFolder, FiLogOut, FiHardDrive } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';

export function Sidebar() {
    const pathname = usePathname();
    const { logout } = useAuthStore();

    const navItems = [
        { href: '/app/dashboard', label: 'Dashboard', icon: FiHome },
        { href: '/app/folders', label: 'All Folders', icon: FiFolder },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <FiHardDrive size={18} className="text-accent" />
                    <span>OpenDrive</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-label">
                    Workspace
                </div>
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
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
