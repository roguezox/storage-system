'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const { checkAuth, isLoading, isAuthenticated } = useAuthStore();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        if (isLoading) return;

        const publicPaths = ['/app/login', '/app/register', '/app/public'];
        const isPublicPath = pathname === '/' || publicPaths.some(path => pathname.startsWith(path));

        if (!isAuthenticated && !isPublicPath) {
            router.push('/app/login');
        }

        if (isAuthenticated && (pathname === '/app/login' || pathname === '/app/register')) {
            router.push('/app/dashboard');
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return <>{children}</>;
}
