'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiFolder, FiLogOut } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';

export function Sidebar() {
    const pathname = usePathname();
    const { logout } = useAuthStore();

    const navItems = [
        { href: '/dashboard', label: 'Dashboard', icon: FiHome },
        { href: '/folders', label: 'All Folders', icon: FiFolder },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h1 className="sidebar-logo">📁 Drive</h1>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link ${pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}`}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="sidebar-footer">
                <button onClick={logout} className="sidebar-link logout">
                    <FiLogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
