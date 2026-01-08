// Runtime config utility
// This allows API_URL to be injected at container startup instead of build time

// For server-side (SSR) - read from environment
// For client-side - read from window.__API_URL__ (injected by config.js)

export function getApiUrl(): string {
    // Client-side: read from window (injected by /config.js at runtime)
    if (typeof window !== 'undefined') {
        return (window as unknown as { __API_URL__?: string }).__API_URL__ || 'http://localhost:5000';
    }

    // Server-side: read from environment variable
    return process.env.API_URL || 'http://localhost:5000';
}

// Type declaration for window augmentation
declare global {
    interface Window {
        __API_URL__?: string;
    }
}
