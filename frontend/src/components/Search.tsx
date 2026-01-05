'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiSearch, FiFile, FiFolder, FiX, FiCommand, FiCornerDownLeft } from 'react-icons/fi';
import { searchAPI } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SearchResult {
    files: Array<{
        _id: string;
        originalName: string;
        size: number;
        folderId: { _id: string; name: string; path: string };
    }>;
    folders: Array<{
        _id: string;
        name: string;
        path: string;
    }>;
}

export function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult>({ files: [], folders: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Keyboard shortcut: Cmd/Ctrl + K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            if (query.trim().length >= 1) {
                handleSearch();
            } else {
                setResults({ files: [], folders: [] });
                setShowResults(false);
            }
        }, 200);

        return () => clearTimeout(delayDebounce);
    }, [query]);

    const handleSearch = async () => {
        setIsSearching(true);
        setSelectedIndex(-1);
        try {
            const response = await searchAPI.search(query, 'all');
            setResults(response.data);
            setShowResults(true);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const allResults = [...results.folders, ...results.files];
    const totalResults = allResults.length;

    const handleResultClick = (index: number) => {
        const item = allResults[index];
        if ('path' in item) {
            router.push(`/app/folders/${item._id}`);
        } else {
            router.push(`/app/folders/${item.folderId._id}`);
        }
        setShowResults(false);
        setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showResults || totalResults === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < totalResults - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    handleResultClick(selectedIndex);
                }
                break;
            case 'Escape':
                setShowResults(false);
                inputRef.current?.blur();
                break;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const highlightMatch = (text: string, query: string) => {
        if (!query.trim()) return text;

        const parts = text.split(new RegExp(`(${query})`, 'gi'));
        return (
            <>
                {parts.map((part, index) =>
                    part.toLowerCase() === query.toLowerCase() ? (
                        <mark key={index} className="bg-[var(--accent-glass)] text-[var(--accent-hover)] px-0.5 rounded-sm font-semibold">{part}</mark>
                    ) : (
                        <span key={index}>{part}</span>
                    )
                )}
            </>
        );
    };

    return (
        <div ref={searchRef} className="relative w-full max-w-[560px] m-0">
            <div className="relative flex items-center bg-gradient-to-br from-white/[0.03] to-white/[0.01] rounded-[14px] p-0.5 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] before:content-[''] before:absolute before:inset-0 before:rounded-[14px] before:p-px before:bg-gradient-to-br before:from-white/8 before:via-white/2 before:to-white/5 before:transition-all before:duration-300 before:pointer-events-none hover:before:from-white/12 hover:before:via-white/4 hover:before:to-white/8 focus-within:before:from-[var(--accent)] focus-within:before:via-[#60a5fa]/50 focus-within:before:to-[var(--accent-hover)] focus-within:before:opacity-80 focus-within:shadow-[0_0_24px_-4px_rgba(37,99,235,0.25),0_4px_16px_-2px_rgba(0,0,0,0.2)]">
                <FiSearch
                    size={18}
                    className={cn(
                        "absolute left-[18px] text-[var(--text-muted)] pointer-events-none transition-all duration-200 z-10",
                        query && "text-[var(--text-secondary)]"
                    )}
                />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search files and folders..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 1 && setShowResults(true)}
                    onKeyDown={handleKeyDown}
                    className="w-full h-[46px] px-12 pr-[90px] border-none rounded-xl bg-[rgba(25,25,25,0.9)] backdrop-blur-[20px] text-[var(--text-primary)] text-sm font-normal tracking-[0.01em] transition-all duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)] placeholder:text-[var(--text-muted)] placeholder:transition-colors focus:outline-none focus:bg-[rgba(20,20,20,0.98)] focus:placeholder:text-[var(--text-secondary)] hover:bg-[rgba(32,32,32,0.95)]"
                />
                {!query && (
                    <div className="absolute right-[14px] flex items-center gap-1 px-2.5 py-1.25 bg-gradient-to-br from-[rgba(47,47,47,0.9)] to-[rgba(37,37,37,0.9)] border border-white/[0.06] rounded-lg text-[11px] text-[var(--text-secondary)] font-semibold pointer-events-none font-mono shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-white/10 hover:text-[var(--text-primary)]">
                        <FiCommand size={12} />
                        <span>K</span>
                    </div>
                )}
                {query && (
                    <button
                        onClick={() => { setQuery(''); setShowResults(false); }}
                        className="absolute right-[14px] bg-gradient-to-br from-[rgba(47,47,47,0.9)] to-[rgba(37,37,37,0.9)] border border-white/[0.06] text-[var(--text-secondary)] cursor-pointer p-1.5 flex items-center justify-center transition-all duration-200 rounded-lg w-[30px] h-[30px] shadow-[0_2px_4px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-gradient-to-br hover:from-[rgba(60,60,60,0.95)] hover:to-[rgba(50,50,50,0.95)] hover:border-white/[0.12] hover:text-[var(--text-primary)] hover:scale-105 active:scale-95"
                        aria-label="Clear search"
                    >
                        <FiX size={18} />
                    </button>
                )}
            </div>

            {showResults && (
                <div className="absolute top-[calc(100%+10px)] left-0 right-0 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.03)] max-h-[480px] overflow-hidden z-[1000] animate-slide-in">
                    {isSearching ? (
                        <div className="p-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-3 p-3 animate-pulse-slow">
                                    <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex-shrink-0" />
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="h-2.5 bg-[var(--bg-tertiary)] rounded w-3/5" />
                                        <div className="h-2.5 bg-[var(--bg-tertiary)] rounded w-2/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : totalResults > 0 ? (
                        <>
                            <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                                <span className="text-xs text-[var(--text-secondary)] font-medium">
                                    {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
                                </span>
                            </div>

                            {results.folders.length > 0 && (
                                <>
                                    <div className="px-4 py-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)] flex items-center gap-1.5 border-t border-[var(--border-subtle)] first:border-t-0">
                                        <FiFolder size={12} />
                                        <span>Folders ({results.folders.length})</span>
                                    </div>
                                    {results.folders.map((folder, index) => (
                                        <div
                                            key={folder._id}
                                            className={cn(
                                                'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 border-b border-[var(--border-subtle)] last-of-type:border-b-0 relative',
                                                'hover:bg-[var(--bg-secondary)] active:scale-[0.99]',
                                                selectedIndex === index && 'bg-[var(--accent-subtle)] border-l-[3px] border-l-[var(--accent)] pl-[13px]'
                                            )}
                                            onClick={() => handleResultClick(index)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                        >
                                            <div className={cn(
                                                'flex items-center justify-center w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex-shrink-0 transition-all duration-200',
                                                selectedIndex === index && 'bg-[var(--accent-glass)]'
                                            )}>
                                                <FiFolder size={18} className={cn(
                                                    'text-[var(--text-secondary)] transition-colors duration-200',
                                                    selectedIndex === index && 'text-[var(--accent)]'
                                                )} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-[var(--text-primary)] font-medium whitespace-nowrap overflow-hidden text-ellipsis leading-snug">
                                                    {highlightMatch(folder.name, query)}
                                                </div>
                                                <div className="text-xs text-[var(--text-secondary)] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                                    {folder.path || '/'}
                                                </div>
                                            </div>
                                            {selectedIndex === index && (
                                                <div className="flex items-center justify-center w-5 h-5 bg-[var(--accent)] rounded text-white opacity-90 flex-shrink-0">
                                                    <FiCornerDownLeft size={12} />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}

                            {results.files.length > 0 && (
                                <>
                                    <div className="px-4 py-2 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-primary)] flex items-center gap-1.5 border-t border-[var(--border-subtle)]">
                                        <FiFile size={12} />
                                        <span>Files ({results.files.length})</span>
                                    </div>
                                    {results.files.map((file, index) => {
                                        const resultIndex = results.folders.length + index;
                                        return (
                                            <div
                                                key={file._id}
                                                className={cn(
                                                    'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all duration-150 border-b border-[var(--border-subtle)] last-of-type:border-b-0 relative',
                                                    'hover:bg-[var(--bg-secondary)] active:scale-[0.99]',
                                                    selectedIndex === resultIndex && 'bg-[var(--accent-subtle)] border-l-[3px] border-l-[var(--accent)] pl-[13px]'
                                                )}
                                                onClick={() => handleResultClick(resultIndex)}
                                                onMouseEnter={() => setSelectedIndex(resultIndex)}
                                            >
                                                <div className={cn(
                                                    'flex items-center justify-center w-8 h-8 bg-[var(--bg-tertiary)] rounded-md flex-shrink-0 transition-all duration-200',
                                                    selectedIndex === resultIndex && 'bg-[var(--accent-glass)]'
                                                )}>
                                                    <FiFile size={18} className={cn(
                                                        'text-[var(--text-secondary)] transition-colors duration-200',
                                                        selectedIndex === resultIndex && 'text-[var(--accent)]'
                                                    )} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-[var(--text-primary)] font-medium whitespace-nowrap overflow-hidden text-ellipsis leading-snug">
                                                        {highlightMatch(file.originalName, query)}
                                                    </div>
                                                    <div className="text-xs text-[var(--text-secondary)] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                                        {file.folderId.name} • {formatSize(file.size)}
                                                    </div>
                                                </div>
                                                {selectedIndex === resultIndex && (
                                                    <div className="flex items-center justify-center w-5 h-5 bg-[var(--accent)] rounded text-white opacity-90 flex-shrink-0">
                                                        <FiCornerDownLeft size={12} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </>
                            )}

                            <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center gap-4 text-[11px] text-[var(--text-muted)] font-medium">
                                <span className="flex items-center gap-1">↑↓ Navigate</span>
                                <span className="flex items-center gap-1">↵ Select</span>
                                <span className="flex items-center gap-1">ESC Close</span>
                            </div>
                        </>
                    ) : (
                        <div className="py-12 px-6 text-center flex flex-col items-center gap-3">
                            <div className="w-16 h-16 flex items-center justify-center bg-[var(--bg-tertiary)] rounded-full text-[var(--text-muted)] mb-2">
                                <FiSearch size={32} />
                            </div>
                            <div className="text-[15px] font-semibold text-[var(--text-primary)]">No results found</div>
                            <div className="text-[13px] text-[var(--text-secondary)] max-w-[300px]">
                                Try searching with different keywords
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
