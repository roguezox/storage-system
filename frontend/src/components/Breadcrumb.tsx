'use client';

import Link from 'next/link';
import { FiHome, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
    id: string;
    name: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
    return (
        <nav className="flex items-center gap-1 text-sm text-[var(--text-secondary)] mb-6">
            <Link
                href="/app/folders"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
                <FiHome size={16} />
                <span>Root</span>
            </Link>

            {items.map((item, index) => (
                <span key={item.id} className="flex items-center gap-1">
                    <FiChevronRight size={16} className="text-[var(--text-muted)]" />
                    {index === items.length - 1 ? (
                        <span className="px-2 py-1 text-[var(--text-primary)] font-medium">
                            {item.name}
                        </span>
                    ) : (
                        <Link
                            href={`/app/folders/${item.id}`}
                            className="px-2 py-1 rounded-md transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                        >
                            {item.name}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
