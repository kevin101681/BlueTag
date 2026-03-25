/**
 * Storage Management Service
 * Handles storage quota checking, cleanup, and cache management
 * Uses IndexedDB for reports (large capacity) and localStorage for settings
 */

import { IndexedDBService } from './indexedDBService';

// Calculate the size of data in bytes (approximate)
const calculateSize = (data: string): number => {
    return new Blob([data]).size;
};

// Get storage usage (IndexedDB + localStorage settings)
export const getStorageUsage = async (): Promise<{ used: number; total: number; percentage: number; source: string }> => {
    let used = 0;
    let total = 0;
    let estimateAvailable = false;
    
    try {
        // Prefer navigator.storage.estimate() — it returns actual on-disk bytes
        // used by this origin (IndexedDB + caches + localStorage), and the real
        // quota the browser has granted. This is far more accurate than
        // JSON.stringify length, which ignores IndexedDB indexes, B-tree
        // overhead, and service-worker caches.
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                if (estimate.quota && estimate.quota > 0) {
                    total = estimate.quota;
                }
                if (estimate.usage && estimate.usage > 0) {
                    used = estimate.usage;
                    estimateAvailable = true;
                }
            } catch (e) {
                console.warn('Could not get storage estimate', e);
            }
        }
        
        // Fallback total when StorageManager is unavailable / returns 0
        if (total === 0) {
            total = 10 * 1024 * 1024 * 1024; // 10 GB conservative guess
        }

        // Fallback used when estimate.usage was not available — use JSON
        // stringify length plus localStorage settings as a rough floor.
        if (!estimateAvailable) {
            if (IndexedDBService.isAvailable()) {
                const indexedDBUsage = await IndexedDBService.getStorageUsage();
                used += indexedDBUsage.used;
            }
            
            const settingsToInclude = [
                'cbs_punch_theme',
                'cbs_color_theme',
                'cbs_company_logo',
                'cbs_partner_logo',
                'cbs_sign_off_templates'
            ];
            
            for (const key of settingsToInclude) {
                const value = localStorage.getItem(key);
                if (value) {
                    used += calculateSize(key + value);
                }
            }
        }
        
        const source = estimateAvailable
            ? 'IndexedDB'
            : IndexedDBService.isAvailable() ? 'IndexedDB (estimated)' : 'localStorage (~5MB)';
        
        const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;
        
        return { used, total, percentage, source };
    } catch (e) {
        console.error("Error calculating storage usage", e);
        return {
            used: 0,
            total: total || 10 * 1024 * 1024 * 1024,
            percentage: 0,
            source: 'Unknown'
        };
    }
};

// Format bytes to human readable string
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Clear all caches (IndexedDB + localStorage + Service Worker cache)
export const clearAllCaches = async (): Promise<void> => {
    // Clear IndexedDB (reports)
    if (IndexedDBService.isAvailable()) {
        try {
            await IndexedDBService.clearAll();
            console.log('IndexedDB cleared');
        } catch (e) {
            console.error('Error clearing IndexedDB', e);
        }
    }
    
    // Clear service worker cache
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            console.log('Service worker caches cleared');
        } catch (e) {
            console.error('Error clearing service worker cache', e);
        }
    }
    
    // Clear localStorage except essential settings
    const settingsToKeep = [
        'cbs_punch_theme',
        'cbs_color_theme',
        'cbs_company_logo',
        'cbs_partner_logo',
        'cbs_sign_off_templates'
    ];
    
    try {
        const keysToRemove: string[] = [];
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && !settingsToKeep.includes(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} localStorage keys`);
    } catch (e) {
        console.error('Error clearing localStorage', e);
        throw e;
    }
};

// Clear only old reports (older than X days) to free up space
export const clearOldReports = async (reports: any[], daysOld: number = 30): Promise<{ removed: number; freedSpace: number }> => {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let freedSpace = 0;
    let removed = 0;
    
    try {
        const oldReports = reports.filter(r => r.lastModified < cutoffTime);
        const newReports = reports.filter(r => r.lastModified >= cutoffTime);
        
        if (oldReports.length > 0) {
            const oldReportsData = JSON.stringify(oldReports);
            freedSpace = calculateSize(oldReportsData);
            removed = oldReports.length;
            
            // Save to IndexedDB if available, otherwise localStorage
            if (IndexedDBService.isAvailable()) {
                await IndexedDBService.saveReports(newReports);
            } else {
                localStorage.setItem('punchlist_reports', JSON.stringify(newReports));
            }
            
            console.log(`Removed ${removed} old reports, freed approximately ${formatBytes(freedSpace)}`);
        }
    } catch (e) {
        console.error('Error clearing old reports', e);
    }
    
    return { removed, freedSpace };
};

// Try to save data with automatic cleanup on quota exceeded
export const saveWithCleanup = async (key: string, data: any, reports?: any[]): Promise<boolean> => {
    try {
        // Use IndexedDB for reports if available
        if (key === 'punchlist_reports' && IndexedDBService.isAvailable()) {
            await IndexedDBService.saveReports(data);
            return true;
        }
        
        // Fallback to localStorage for settings
        const jsonData = JSON.stringify(data);
        localStorage.setItem(key, jsonData);
        return true;
    } catch (e: any) {
        // Check if it's a quota exceeded error
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            console.warn('Storage quota exceeded, attempting cleanup...');
            
            // Try clearing old reports first
            if (reports && key === 'punchlist_reports') {
                const result = await clearOldReports(reports, 30);
                if (result.removed > 0) {
                    try {
                        if (IndexedDBService.isAvailable()) {
                            await IndexedDBService.saveReports(data);
                        } else {
                            const jsonData = JSON.stringify(data);
                            localStorage.setItem(key, jsonData);
                        }
                        console.log('Successfully saved after cleanup');
                        return true;
                    } catch (retryError) {
                        console.error('Still quota exceeded after cleanup', retryError);
                    }
                }
            }
            
            // If still failing, try clearing more aggressively
            try {
                await clearOldReports(reports || [], 7); // Clear reports older than 7 days
                if (IndexedDBService.isAvailable()) {
                    await IndexedDBService.saveReports(data);
                } else {
                    const jsonData = JSON.stringify(data);
                    localStorage.setItem(key, jsonData);
                }
                console.log('Successfully saved after aggressive cleanup');
                return true;
            } catch (finalError) {
                console.error('Could not save even after aggressive cleanup', finalError);
                return false;
            }
        }
        
        // Re-throw other errors
        throw e;
    }
};

// Get storage info for display
export const getStorageInfo = async (): Promise<{ used: string; total: string; percentage: number; warning: boolean; source: string }> => {
    const usage = await getStorageUsage();
    // Only warn if using more than 90% of actual quota (if available)
    // If we're using estimated quota, only warn if usage is very high (>95%)
    // This prevents false warnings since IndexedDB can typically store much more
    const warning = usage.percentage > (usage.total > 5 * 1024 * 1024 * 1024 ? 90 : 95);
    
    return {
        used: formatBytes(usage.used),
        total: formatBytes(usage.total),
        percentage: usage.percentage,
        warning,
        source: usage.source
    };
};

