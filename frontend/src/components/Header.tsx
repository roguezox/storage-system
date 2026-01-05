'use client';

import { useAuthStore } from '@/stores/authStore';
import { FiUser, FiMenu } from 'react-icons/fi';
import { Search } from './Search';

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const { user } = useAuthStore();

    // Get first letter of email for avatar
    const avatarLetter = user?.email?.charAt(0).toUpperCase() || 'U';

    return (
        <header className="header-container">
            {/* Mobile: Menu button */}
            <button
                className="header-menu-btn"
                onClick={onMenuClick}
                aria-label="Open menu"
            >
                <FiMenu size={20} />
            </button>

            {/* Search - Takes priority and flex-grows */}
            <div className="header-search">
                <Search />
            </div>

            {/* User info - Hidden on mobile, visible on desktop */}
            <div className="header-user">
                <div className="header-user-avatar">
                    {avatarLetter}
                </div>
                <span className="header-user-email">{user?.email}</span>
            </div>

            {/* Mobile: Just avatar */}
            <div className="header-user-mobile">
                <div className="header-user-avatar">
                    {avatarLetter}
                </div>
            </div>
        </header>
    );
}
