import { Report } from '../types';
import { syncQueueService } from './syncQueueService';
import type { NetlifyIdentityUser } from '../types/netlify-identity';

// Helper to get the JWT token from Netlify Identity
const getAuthHeaders = async (user?: NetlifyIdentityUser | null) => {
    const identity = window.netlifyIdentity;
    const currentUser = user ?? identity?.currentUser?.() ?? null;
    if (!identity || !currentUser) return null;

    try {
        const token = await currentUser.jwt();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    } catch (e) {
        // Token can fail if the session is stale. Try to refresh once.
        try {
            const refreshed = await identity.refresh(true);
            if (!refreshed) return null;
            const token = await refreshed.jwt(true);
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
        } catch {
            console.warn('Failed to refresh Netlify Identity session');
            return null;
        }
    }
};

export type CloudFetchFailureReason = 'offline' | 'unauthorized' | 'server' | 'network';
export type CloudFetchResult =
    | { ok: true; reports: Report[] }
    | { ok: false; reason: CloudFetchFailureReason; status?: number; message: string };

export interface ReportSummary {
    id: string;
    lastModified: number;
}

export type CloudIndexResult =
    | { ok: true; summaries: ReportSummary[] }
    | { ok: false; reason: CloudFetchFailureReason; status?: number; message: string };

export type CloudSingleReportResult =
    | { ok: true; report: Report }
    | { ok: false; reason: CloudFetchFailureReason; status?: number; message: string };

const safeJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

export const CloudService = {
    // Return null if fetch fails, empty array if successful but no reports
    async fetchReports(user?: NetlifyIdentityUser | null): Promise<CloudFetchResult> {
        // If offline, return null to use local data
        if (!syncQueueService.isOnline()) {
            return { ok: false, reason: 'offline', message: 'Offline' };
        }

        const headers = await getAuthHeaders(user);
        if (!headers?.Authorization) {
            return { ok: false, reason: 'unauthorized', status: 401, message: 'Not logged in' };
        }

        try {
            const response = await fetch('/.netlify/functions/reports', {
                method: 'GET',
                headers
            });

            if (response.status === 401 || response.status === 403) {
                const body = await safeJson(response);
                const message = body?.error || 'Unauthorized';
                return { ok: false, reason: 'unauthorized', status: response.status, message };
            }

            if (!response.ok) {
                const body = await safeJson(response);
                const message = body?.error || `Sync server error (${response.status})`;
                return { ok: false, reason: 'server', status: response.status, message };
            }

            const reports = (await response.json()) as Report[];
            return { ok: true, reports };
        } catch (e: any) {
            console.error("Cloud Fetch Error:", e);
            const message = e?.message || 'Network error';
            return { ok: false, reason: 'network', message };
        }
    },

    async fetchReportIndex(user?: NetlifyIdentityUser | null): Promise<CloudIndexResult> {
        if (!syncQueueService.isOnline()) {
            return { ok: false, reason: 'offline', message: 'Offline' };
        }

        const headers = await getAuthHeaders(user);
        if (!headers?.Authorization) {
            return { ok: false, reason: 'unauthorized', status: 401, message: 'Not logged in' };
        }

        try {
            const response = await fetch('/.netlify/functions/reports?summary=1', {
                method: 'GET',
                headers
            });

            if (response.status === 401 || response.status === 403) {
                const body = await safeJson(response);
                const message = body?.error || 'Unauthorized';
                return { ok: false, reason: 'unauthorized', status: response.status, message };
            }

            if (!response.ok) {
                const body = await safeJson(response);
                const message = body?.error || `Sync server error (${response.status})`;
                return { ok: false, reason: 'server', status: response.status, message };
            }

            const summaries = (await response.json()) as ReportSummary[];
            return { ok: true, summaries };
        } catch (e: any) {
            console.error("Cloud Index Error:", e);
            const message = e?.message || 'Network error';
            return { ok: false, reason: 'network', message };
        }
    },

    async fetchReportById(id: string, user?: NetlifyIdentityUser | null): Promise<CloudSingleReportResult> {
        if (!syncQueueService.isOnline()) {
            return { ok: false, reason: 'offline', message: 'Offline' };
        }

        const headers = await getAuthHeaders(user);
        if (!headers?.Authorization) {
            return { ok: false, reason: 'unauthorized', status: 401, message: 'Not logged in' };
        }

        try {
            const response = await fetch(`/.netlify/functions/reports?id=${encodeURIComponent(id)}`, {
                method: 'GET',
                headers
            });

            if (response.status === 401 || response.status === 403) {
                const body = await safeJson(response);
                const message = body?.error || 'Unauthorized';
                return { ok: false, reason: 'unauthorized', status: response.status, message };
            }

            if (response.status === 404) {
                const body = await safeJson(response);
                const message = body?.error || 'Report not found';
                return { ok: false, reason: 'server', status: 404, message };
            }

            if (!response.ok) {
                const body = await safeJson(response);
                const message = body?.error || `Sync server error (${response.status})`;
                return { ok: false, reason: 'server', status: response.status, message };
            }

            const report = (await response.json()) as Report;
            return { ok: true, report };
        } catch (e: any) {
            console.error("Cloud Fetch Report Error:", e);
            const message = e?.message || 'Network error';
            return { ok: false, reason: 'network', message };
        }
    },

    async saveReport(report: Report, opts?: { fromQueue?: boolean; user?: NetlifyIdentityUser | null }): Promise<boolean> {
        const headers = await getAuthHeaders(opts?.user);
        if (!headers?.Authorization) return false;

        // If offline, queue the operation
        if (!syncQueueService.isOnline()) {
            return opts?.fromQueue ? false : await syncQueueService.enqueueSave(report);
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
                return opts?.fromQueue ? false : await syncQueueService.enqueueSave(report);
            }
        } catch (e) {
            console.error("Cloud Save Error:", e);
            // Queue for retry when back online
            return opts?.fromQueue ? false : await syncQueueService.enqueueSave(report);
        }
    },

    async deleteReport(id: string, opts?: { fromQueue?: boolean; user?: NetlifyIdentityUser | null }): Promise<boolean> {
        const headers = await getAuthHeaders(opts?.user);
        if (!headers?.Authorization) return false;

        // If offline, queue the operation
        if (!syncQueueService.isOnline()) {
            return opts?.fromQueue ? false : await syncQueueService.enqueueDelete(id);
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
                return opts?.fromQueue ? false : await syncQueueService.enqueueDelete(id);
            }
        } catch (e) {
            console.error("Cloud Delete Error:", e);
            // Queue for retry when back online
            return opts?.fromQueue ? false : await syncQueueService.enqueueDelete(id);
        }
    }
};