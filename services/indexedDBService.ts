/**
 * IndexedDB Service for storing reports
 * Provides much larger storage capacity than localStorage (can use GBs)
 */

const DB_NAME = 'bluetag_db';
const DB_VERSION = 1;
const STORE_NAME = 'reports';
const DELETED_STORE_NAME = 'deleted_ids';

interface DBInstance {
    db: IDBDatabase;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create reports store
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const reportStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                reportStore.createIndex('lastModified', 'lastModified', { unique: false });
            }

            // Create deleted IDs store
            if (!db.objectStoreNames.contains(DELETED_STORE_NAME)) {
                db.createObjectStore(DELETED_STORE_NAME, { keyPath: 'id' });
            }
        };
    });

    return dbPromise;
};

export const IndexedDBService = {
    // Save all reports
    async saveReports(reports: any[]): Promise<void> {
        const db = await getDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Clear existing reports
        await new Promise<void>((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });

        // Add all reports
        for (const report of reports) {
            await new Promise<void>((resolve, reject) => {
                const addRequest = store.add(report);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => {
                    const error = addRequest.error;
                    
                    // If key already exists, use put instead
                    if (error?.name === 'ConstraintError') {
                        const putRequest = store.put(report);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => {
                            // Check if it's a quota error
                            if (putRequest.error?.name === 'QuotaExceededError') {
                                reject(new Error('Storage quota exceeded. Please delete old reports or clear cache.'));
                            } else {
                                reject(putRequest.error);
                            }
                        };
                    } else if (error?.name === 'QuotaExceededError') {
                        reject(new Error('Storage quota exceeded. Please delete old reports or clear cache.'));
                    } else {
                        reject(error);
                    }
                };
            });
        }
    },

    // Load all reports
    async loadReports(): Promise<any[]> {
        try {
            const db = await getDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error loading reports from IndexedDB', error);
            return [];
        }
    },

    // Save deleted report IDs
    async saveDeletedIds(ids: string[]): Promise<void> {
        const db = await getDB();
        const transaction = db.transaction([DELETED_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(DELETED_STORE_NAME);

        // Clear and re-add
        await new Promise<void>((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });

        for (const id of ids) {
            await new Promise<void>((resolve, reject) => {
                const addRequest = store.add({ id, timestamp: Date.now() });
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => {
                    const putRequest = store.put({ id, timestamp: Date.now() });
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                };
            });
        }
    },

    // Load deleted report IDs
    async loadDeletedIds(): Promise<string[]> {
        try {
            const db = await getDB();
            const transaction = db.transaction([DELETED_STORE_NAME], 'readonly');
            const store = transaction.objectStore(DELETED_STORE_NAME);
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => {
                    const results = request.result || [];
                    resolve(results.map((r: any) => r.id));
                };
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Error loading deleted IDs from IndexedDB', error);
            return [];
        }
    },

    // Get storage usage estimate
    async getStorageUsage(): Promise<{ used: number; estimate: string }> {
        try {
            const db = await getDB();
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            const reports = await new Promise<any[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });

            // Estimate size by stringifying all reports
            const totalSize = JSON.stringify(reports).length;
            
            return {
                used: totalSize,
                estimate: formatBytes(totalSize)
            };
        } catch (error) {
            console.error('Error calculating IndexedDB usage', error);
            return { used: 0, estimate: '0 Bytes' };
        }
    },

    // Clear all data
    async clearAll(): Promise<void> {
        const db = await getDB();
        const transaction = db.transaction([STORE_NAME, DELETED_STORE_NAME], 'readwrite');
        
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const request = transaction.objectStore(STORE_NAME).clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise<void>((resolve, reject) => {
                const request = transaction.objectStore(DELETED_STORE_NAME).clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    },

    // Check if IndexedDB is available
    isAvailable(): boolean {
        return 'indexedDB' in window && indexedDB !== null;
    }
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

// Migrate data from localStorage to IndexedDB
export const migrateFromLocalStorage = async (): Promise<boolean> => {
    if (!IndexedDBService.isAvailable()) {
        console.warn('IndexedDB not available, cannot migrate');
        return false;
    }

    try {
        // Check if migration already done
        const existing = await IndexedDBService.loadReports();
        if (existing.length > 0) {
            return true; // Already migrated
        }

        // Load from localStorage
        const reportsData = localStorage.getItem('punchlist_reports');
        const deletedData = localStorage.getItem('punchlist_deleted_ids');

        if (reportsData) {
            const reports = JSON.parse(reportsData);
            await IndexedDBService.saveReports(reports);
            console.log(`Migrated ${reports.length} reports to IndexedDB`);
        }

        if (deletedData) {
            const deletedIds = JSON.parse(deletedData);
            await IndexedDBService.saveDeletedIds(deletedIds);
        }

        return true;
    } catch (error) {
        console.error('Migration error', error);
        return false;
    }
};

