/**
 * Generate a UUID v4
 * Falls back to a custom implementation if crypto.randomUUID is not available
 * (e.g., in non-secure contexts or older browsers)
 */
export function generateUUID(): string {
    // Try using crypto.randomUUID if available (requires HTTPS or localhost)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fall through to fallback
        }
    }

    // Fallback implementation (RFC4122 version 4 compliant)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
