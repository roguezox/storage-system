'use client';

import { useAuthStore } from '@/stores/authStore';
import { FiUser, FiMenu } from 'react-icons/fi';

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const { user } = useAuthStore();

    return (
        <header className="header" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                <button
                    className="mobile-menu-btn"
                    onClick={onMenuClick}
                    style={{
                        display: 'none', // Hidden by default, shown in mobile via CSS
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        padding: '8px',
                        cursor: 'pointer'
                    }}
                >
                    <FiMenu size={20} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 8px 4px 6px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)'
                    }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FiUser size={12} />
                        </div>
                        <span>{user?.email}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
