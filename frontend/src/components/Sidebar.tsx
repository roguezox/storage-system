'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiHome, FiFolder, FiTrash2, FiLogOut, FiHardDrive, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

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
        { href: '/app/trash', label: 'Trash', icon: FiTrash2 },
    ];

    return (
        <aside className={cn(
            'w-60 flex flex-col flex-shrink-0 transition-all duration-300',
            'bg-[var(--bg-secondary)]',
            'border-r-2 border-[var(--border-subtle)]',
            // Mobile styles
            'fixed md:relative top-0 left-0 bottom-0 z-50',
            'md:translate-x-0',
            isOpen ? 'translate-x-0 shadow-[0_20px_60px_rgba(0,0,0,0.5)]' : '-translate-x-full md:w-60'
        )}>
            <div className="h-14 flex items-center px-4 mb-3 group">
                <div className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all duration-300 group-hover:scale-110">
                        <FiHardDrive size={18} className="text-white" />
                    </div>
                    <span className="gradient-text">OpenDrive</span>
                </div>
                <button
                    onClick={onClose}
                    className="ml-auto md:hidden flex bg-transparent border-none text-[var(--text-secondary)] cursor-pointer p-1 hover:text-[var(--text-primary)] transition-colors"
                >
                    <FiX size={20} />
                </button>
            </div>

            <nav className="px-2 flex-1">
                <div className="px-3 py-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-4 mb-2">
                    Workspace
                </div>
                {navItems.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                            'group flex items-center gap-3 px-3 py-2.5 min-h-[40px] mb-1 rounded-lg',
                            'text-[var(--text-secondary)] text-sm font-medium transition-all duration-200',
                            'border-none bg-transparent w-full cursor-pointer text-left',
                            'hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
                            'hover:pl-4 hover:shadow-sm',
                            'relative overflow-hidden',
                            'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1',
                            'before:bg-[var(--accent)]',
                            'before:rounded-r-full before:opacity-0 before:transition-opacity before:duration-200',
                            (pathname === item.href || pathname.startsWith(item.href + '/')) &&
                            'bg-[var(--bg-hover)] text-[var(--text-primary)] font-semibold before:opacity-100 shadow-sm'
                        )}
                    >
                        <item.icon size={18} className="transition-transform duration-200 group-hover:scale-110" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-3 border-t-2 border-[var(--border-subtle)]">
                <button
                    onClick={logout}
                    className="group flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-lg text-[var(--text-secondary)] text-sm font-medium transition-all duration-200 border-none bg-transparent w-full cursor-pointer text-left hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--danger-color)] hover:shadow-sm"
                >
                    <FiLogOut size={18} className="transition-transform duration-200 group-hover:scale-110" />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
