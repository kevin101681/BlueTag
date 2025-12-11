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
    
    // IndexedDB can use up to 50-60% of available disk space
    // For most devices, we'll show a conservative estimate of available space
    // Mobile: ~50% of available storage (often 10-50GB available)
    // Desktop: ~50% of available storage (often 100GB+ available)
    // We'll use a conservative estimate of 1GB as a "safe" limit to show users
    const total = 1024 * 1024 * 1024; // 1GB conservative estimate (IndexedDB can actually use much more)
    
    try {
        // Get IndexedDB usage (reports)
        if (IndexedDBService.isAvailable()) {
            const indexedDBUsage = await IndexedDBService.getStorageUsage();
            used += indexedDBUsage.used;
        }
        
        // Get localStorage usage (settings only - reports should be in IndexedDB)
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
        
        const source = IndexedDBService.isAvailable() ? 'IndexedDB (up to GBs)' : 'localStorage (~5MB)';
        
        return {
            used,
            total,
            percentage: Math.min((used / total) * 100, 100),
            source
        };
    } catch (e) {
        console.error("Error calculating storage usage", e);
        return {
            used: 0,
            total,
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
    // Only warn if using more than 80% of our conservative 1GB estimate
    // In practice, IndexedDB can store much more
    const warning = usage.percentage > 80;
    
    return {
        used: formatBytes(usage.used),
        total: formatBytes(usage.total),
        percentage: usage.percentage,
        warning,
        source: usage.source
    };
};

