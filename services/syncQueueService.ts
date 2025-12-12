/**
 * Offline Sync Queue Service
 * Queues cloud operations when offline and processes them when online
 */

import { CloudService } from './cloudService';
import { Report } from '../types';

export interface QueuedOperation {
    id: string;
    type: 'save' | 'delete';
    data?: Report;
    timestamp: number;
    retries: number;
}

const QUEUE_KEY = 'bluetag_sync_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

class SyncQueueService {
    private queue: QueuedOperation[] = [];
    private isProcessing = false;
    private listeners: Array<(isOnline: boolean) => void> = [];
    private onlineStatus = navigator.onLine;

    constructor() {
        this.loadQueue();
        this.setupOnlineListeners();
    }

    private setupOnlineListeners() {
        window.addEventListener('online', () => {
            this.onlineStatus = true;
            this.notifyListeners(true);
            this.processQueue();
        });

        window.addEventListener('offline', () => {
            this.onlineStatus = false;
            this.notifyListeners(false);
        });
    }

    private notifyListeners(isOnline: boolean) {
        this.listeners.forEach(listener => listener(isOnline));
    }

    subscribe(listener: (isOnline: boolean) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    isOnline(): boolean {
        return this.onlineStatus;
    }

    private async loadQueue() {
        try {
            const stored = localStorage.getItem(QUEUE_KEY);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading sync queue', e);
            this.queue = [];
        }
    }

    private async saveQueue() {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
        } catch (e) {
            console.error('Error saving sync queue', e);
        }
    }

    async enqueueSave(report: Report): Promise<boolean> {
        // Remove any existing save operation for this report ID
        this.queue = this.queue.filter(op => !(op.type === 'save' && op.data?.id === report.id));

        const operation: QueuedOperation = {
            id: `${report.id}_${Date.now()}`,
            type: 'save',
            data: report,
            timestamp: Date.now(),
            retries: 0
        };

        this.queue.push(operation);
        await this.saveQueue();

        // Try to process immediately if online
        if (this.isOnline()) {
            this.processQueue();
        }

        return true;
    }

    async enqueueDelete(reportId: string): Promise<boolean> {
        // Remove any save operation for this report (delete takes precedence)
        this.queue = this.queue.filter(op => !(op.data && op.data.id === reportId && op.type === 'save'));

        // Check if delete already queued
        const existingDelete = this.queue.find(op => op.type === 'delete' && op.id === reportId);
        if (existingDelete) {
            return true; // Already queued
        }

        const operation: QueuedOperation = {
            id: reportId,
            type: 'delete',
            timestamp: Date.now(),
            retries: 0
        };

        this.queue.push(operation);
        await this.saveQueue();

        // Try to process immediately if online
        if (this.isOnline()) {
            this.processQueue();
        }

        return true;
    }

    async processQueue(): Promise<void> {
        if (this.isProcessing || !this.isOnline() || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            const operationsToProcess = [...this.queue];
            const successfulOps: string[] = [];
            const failedOps: QueuedOperation[] = [];

            for (const op of operationsToProcess) {
                try {
                    let success = false;

                    if (op.type === 'save' && op.data) {
                        success = await CloudService.saveReport(op.data);
                    } else if (op.type === 'delete') {
                        success = await CloudService.deleteReport(op.id);
                    }

                    if (success) {
                        successfulOps.push(op.id);
                    } else {
                        op.retries++;
                        if (op.retries < MAX_RETRIES) {
                            failedOps.push(op);
                        } else {
                            console.warn(`Operation ${op.id} exceeded max retries, removing from queue`);
                        }
                    }
                } catch (error) {
                    console.error(`Error processing operation ${op.id}`, error);
                    op.retries++;
                    if (op.retries < MAX_RETRIES) {
                        failedOps.push(op);
                    }
                }

                // Small delay between operations to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Remove successful operations
            this.queue = this.queue.filter(op => !successfulOps.includes(op.id));

            // Update failed operations with incremented retries
            for (const failedOp of failedOps) {
                const index = this.queue.findIndex(op => op.id === failedOp.id);
                if (index !== -1) {
                    this.queue[index] = failedOp;
                }
            }

            await this.saveQueue();

            // If there are failed ops and we're still online, retry after delay
            if (failedOps.length > 0 && this.isOnline()) {
                setTimeout(() => this.processQueue(), RETRY_DELAY);
            }
        } catch (error) {
            console.error('Error processing sync queue', error);
        } finally {
            this.isProcessing = false;
        }
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    getQueue(): QueuedOperation[] {
        return [...this.queue];
    }

    async clearQueue(): Promise<void> {
        this.queue = [];
        await this.saveQueue();
    }
}

export const syncQueueService = new SyncQueueService();

