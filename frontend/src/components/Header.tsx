'use client';

import { useAuthStore } from '@/stores/authStore';
import { FiUser } from 'react-icons/fi';

export function Header() {
    const { user } = useAuthStore();

    return (
        <header className="header" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%' }}>
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
        </header>
    );
}
