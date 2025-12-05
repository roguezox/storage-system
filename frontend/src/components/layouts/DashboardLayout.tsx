'use client';

import { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';

interface DashboardLayoutProps {
    children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="dashboard-main">
                <Header />
                <main className="dashboard-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
