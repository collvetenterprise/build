const { Readable } = require('stream');

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

class OneDriveClient {
    constructor(config = {}) {
        this.tenantId = config.tenantId || process.env.ONEDRIVE_TENANT_ID;
        this.clientId = config.clientId || process.env.ONEDRIVE_CLIENT_ID;
        this.clientSecret = config.clientSecret || process.env.ONEDRIVE_CLIENT_SECRET;
        this.driveId = config.driveId || process.env.ONEDRIVE_DRIVE_ID;

        this.cachedToken = null;
        this.cachedTokenExpiresAt = 0;
        this.tokenPromise = null;
    }

    isConfigured() {
        return Boolean(this.tenantId && this.clientId && this.clientSecret && this.driveId);
    }

    async getAccessToken() {
        if (!this.isConfigured()) {
            throw new Error('OneDrive client is not configured. Set ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET and ONEDRIVE_DRIVE_ID.');
        }

        if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
            return this.cachedToken;
        }

        if (this.tokenPromise) {
            return this.tokenPromise;
        }

        this.tokenPromise = (async () => {
            try {
                const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
                const body = new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    scope: 'https://graph.microsoft.com/.default',
                    grant_type: 'client_credentials'
                });

                const response = await fetch(tokenUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to obtain OneDrive access token: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                this.cachedToken = data.access_token;
                // Refresh a little before actual expiry
                const expiresIn = data.expires_in || 3600;
                this.cachedTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;

                return this.cachedToken;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise;
    }

    async graphRequest(path, options = {}) {
        const token = await this.getAccessToken();
        const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            }
        });

        return response;
    }

    async listChildren(folderId = 'root') {
        const path = folderId === 'root'
            ? `/drives/${this.driveId}/root/children`
            : `/drives/${this.driveId}/items/${folderId}/children`;

        const response = await this.graphRequest(path);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list OneDrive folder contents: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return (data.value || []).map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            isFolder: Boolean(item.folder),
            mimeType: item.file ? item.file.mimeType : undefined
        }));
    }

    async getItemMetadata(itemId) {
        const response = await this.graphRequest(`/drives/${this.driveId}/items/${itemId}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to get OneDrive item metadata: ${response.status} ${errorText}`);
        }

        const item = await response.json();
        return {
            id: item.id,
            name: item.name,
            size: item.size,
            isFolder: Boolean(item.folder),
            mimeType: item.file ? item.file.mimeType : undefined
        };
    }

    async downloadItemStream(itemId) {
        const metadata = await this.getItemMetadata(itemId);
        if (metadata.isFolder) {
            throw new Error(`OneDrive item ${itemId} is a folder, not a file`);
        }

        const response = await this.graphRequest(`/drives/${this.driveId}/items/${itemId}/content`, {
            redirect: 'follow'
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to download OneDrive item content: ${response.status} ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Failed to download OneDrive item content: response body is empty');
        }

        return {
            name: metadata.name,
            mimeType: metadata.mimeType || 'application/octet-stream',
            size: metadata.size,
            stream: Readable.fromWeb(response.body)
        };
    }
}

module.exports = OneDriveClient;
