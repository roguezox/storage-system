'use client';

import { useAuthStore } from '@/stores/authStore';
import { FiUser, FiMenu } from 'react-icons/fi';
import { Search } from './Search';

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const { user } = useAuthStore();

    return (
        <header className="min-h-[72px] border-b-2 border-[var(--border-subtle)] flex items-center justify-between px-6 py-3 bg-[rgba(10,10,11,0.95)] backdrop-blur-xl sticky top-0 z-20 w-full shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
            <div className="flex items-center w-full gap-4">
                <button
                    className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-secondary)] cursor-pointer flex-shrink-0 hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)] hover:shadow-md transition-all duration-200"
                    onClick={onMenuClick}
                >
                    <FiMenu size={20} />
                </button>

                <div className="flex-1 max-w-[600px]">
                    <Search />
                </div>

                <div className="flex items-center gap-2">
                    <div className="group flex items-center gap-2.5 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded-lg text-[13px] text-[var(--text-secondary)] shadow-sm hover:shadow-md transition-all duration-200 hover:border-[var(--border-hover)]">
                        <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110">
                            <FiUser size={14} className="text-white" />
                        </div>
                        <span className="font-medium">{user?.email}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
