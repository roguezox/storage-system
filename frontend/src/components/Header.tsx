'use client';

import { useAuthStore } from '@/stores/authStore';
import { FiUser } from 'react-icons/fi';

export function Header() {
    const { user } = useAuthStore();

    return (
        <header className="header">
            <div className="header-content">
                <h2 className="header-title">Storage Platform</h2>

                <div className="header-user">
                    <FiUser size={18} />
                    <span>{user?.email}</span>
                </div>
            </div>
        </header>
    );
}
