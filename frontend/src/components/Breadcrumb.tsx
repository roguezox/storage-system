'use client';

import Link from 'next/link';
import { FiHome, FiChevronRight } from 'react-icons/fi';

interface BreadcrumbItem {
    id: string;
    name: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
    return (
        <nav className="breadcrumb">
            <Link href="/app/folders" className="breadcrumb-item">
                <FiHome size={16} />
                <span>Root</span>
            </Link>

            {items.map((item, index) => (
                <span key={item.id} className="breadcrumb-segment">
                    <FiChevronRight size={16} className="breadcrumb-separator" />
                    {index === items.length - 1 ? (
                        <span className="breadcrumb-item current">{item.name}</span>
                    ) : (
                        <Link href={`/app/folders/${item.id}`} className="breadcrumb-item">
                            {item.name}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
