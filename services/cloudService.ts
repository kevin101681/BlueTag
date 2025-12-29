import { Report } from '../types';
import { syncQueueService } from './syncQueueService';

// Helper to get the JWT token from Netlify Identity
const getAuthHeaders = async () => {
    if (window.netlifyIdentity && window.netlifyIdentity.currentUser()) {
        const token = await window.netlifyIdentity.currentUser().jwt();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
    return {};
};

export const CloudService = {
    // Return null if fetch fails, empty array if successful but no reports
    async fetchReports(): Promise<Report[] | null> {
        // If offline, return null to use local data
        if (!syncQueueService.isOnline()) {
            return null;
        }

        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return null;

        try {
            const response = await fetch('/.netlify/functions/reports', {
                method: 'GET',
                headers
            });
            
            if (!response.ok) throw new Error("Failed to fetch reports");
            return await response.json();
        } catch (e) {
            console.error("Cloud Fetch Error:", e);
            return null;
        }
    },

    async saveReport(report: Report): Promise<boolean> {
        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return false;

        // If offline, queue the operation
        if (!syncQueueService.isOnline()) {
            return await syncQueueService.enqueueSave(report);
        }

        try {
            const response = await fetch('/.netlify/functions/reports', {
                method: 'POST',
                headers,
                body: JSON.stringify(report)
            });
            
            if (response.ok) {
                return true;
            } else {
                // If save fails, queue it for retry
                return await syncQueueService.enqueueSave(report);
            }
        } catch (e) {
            console.error("Cloud Save Error:", e);
            // Queue for retry when back online
            return await syncQueueService.enqueueSave(report);
        }
    },

    async deleteReport(id: string): Promise<boolean> {
        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return false;

        // If offline, queue the operation
        if (!syncQueueService.isOnline()) {
            return await syncQueueService.enqueueDelete(id);
        }

        try {
            const response = await fetch(`/.netlify/functions/reports?id=${id}`, {
                method: 'DELETE',
                headers
            });
            
            if (response.ok) {
                return true;
            } else {
                // If delete fails, queue it for retry
                return await syncQueueService.enqueueDelete(id);
            }
        } catch (e) {
            console.error("Cloud Delete Error:", e);
            // Queue for retry when back online
            return await syncQueueService.enqueueDelete(id);
        }
    }
};

// Initialize the sync queue service with CloudService after it's defined
syncQueueService.setCloudService(CloudService);