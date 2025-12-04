import { Report } from '../types';

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
    async fetchReports(): Promise<Report[]> {
        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return [];

        try {
            const response = await fetch('/.netlify/functions/reports', {
                method: 'GET',
                headers
            });
            
            if (!response.ok) throw new Error("Failed to fetch reports");
            return await response.json();
        } catch (e) {
            console.error("Cloud Fetch Error:", e);
            return [];
        }
    },

    async saveReport(report: Report): Promise<boolean> {
        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return false;

        try {
            const response = await fetch('/.netlify/functions/reports', {
                method: 'POST',
                headers,
                body: JSON.stringify(report)
            });
            return response.ok;
        } catch (e) {
            console.error("Cloud Save Error:", e);
            return false;
        }
    },

    async deleteReport(id: string): Promise<boolean> {
        const headers = await getAuthHeaders();
        if (!headers['Authorization']) return false;

        try {
            const response = await fetch(`/.netlify/functions/reports?id=${id}`, {
                method: 'DELETE',
                headers
            });
            return response.ok;
        } catch (e) {
            console.error("Cloud Delete Error:", e);
            return false;
        }
    }
};
