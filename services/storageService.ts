/**
 * Storage Management Service
 * Handles localStorage quota checking, cleanup, and cache management
 */

// Calculate the size of data in bytes (approximate)
const calculateSize = (data: string): number => {
    return new Blob([data]).size;
};

// Get total localStorage usage
export const getStorageUsage = (): { used: number; total: number; percentage: number } => {
    let used = 0;
    const total = 5 * 1024 * 1024; // Approximate 5MB limit for localStorage
    
    try {
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                if (value) {
                    used += calculateSize(key + value);
                }
            }
        }
    } catch (e) {
        console.error("Error calculating storage usage", e);
    }
    
    return {
        used,
        total,
        percentage: (used / total) * 100
    };
};

// Format bytes to human readable string
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Clear all caches (localStorage + Service Worker cache)
export const clearAllCaches = async (): Promise<void> => {
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
export const clearOldReports = (reports: any[], daysOld: number = 30): { removed: number; freedSpace: number } => {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let freedSpace = 0;
    let removed = 0;
    
    try {
        const oldReports = reports.filter(r => r.lastModified < cutoffTime);
        const reportsData = localStorage.getItem('punchlist_reports');
        
        if (reportsData) {
            const allReports: any[] = JSON.parse(reportsData);
            const newReports = allReports.filter(r => r.lastModified >= cutoffTime);
            
            if (newReports.length < allReports.length) {
                const oldReportsData = JSON.stringify(oldReports);
                freedSpace = calculateSize(oldReportsData);
                removed = oldReports.length;
                
                localStorage.setItem('punchlist_reports', JSON.stringify(newReports));
                console.log(`Removed ${removed} old reports, freed approximately ${formatBytes(freedSpace)}`);
            }
        }
    } catch (e) {
        console.error('Error clearing old reports', e);
    }
    
    return { removed, freedSpace };
};

// Try to save data with automatic cleanup on quota exceeded
export const saveWithCleanup = (key: string, data: any, reports?: any[]): boolean => {
    try {
        const jsonData = JSON.stringify(data);
        localStorage.setItem(key, jsonData);
        return true;
    } catch (e: any) {
        // Check if it's a quota exceeded error
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
            console.warn('Storage quota exceeded, attempting cleanup...');
            
            // Try clearing old reports first
            if (reports && key === 'punchlist_reports') {
                const result = clearOldReports(reports, 30);
                if (result.removed > 0) {
                    try {
                        const jsonData = JSON.stringify(data);
                        localStorage.setItem(key, jsonData);
                        console.log('Successfully saved after cleanup');
                        return true;
                    } catch (retryError) {
                        console.error('Still quota exceeded after cleanup', retryError);
                    }
                }
            }
            
            // If still failing, try clearing more aggressively
            try {
                clearOldReports(reports || [], 7); // Clear reports older than 7 days
                const jsonData = JSON.stringify(data);
                localStorage.setItem(key, jsonData);
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
export const getStorageInfo = (): { used: string; total: string; percentage: number; warning: boolean } => {
    const usage = getStorageUsage();
    const warning = usage.percentage > 80;
    
    return {
        used: formatBytes(usage.used),
        total: formatBytes(usage.total),
        percentage: usage.percentage,
        warning
    };
};

