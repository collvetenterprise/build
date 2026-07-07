const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

class GoogleDriveClient {
    constructor(config = {}) {
        this.clientId = config.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID;
        this.clientSecret = config.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
        this.refreshToken = config.refreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

        this.cachedToken = null;
        this.cachedTokenExpiresAt = 0;
        this.tokenPromise = null;
    }

    isConfigured() {
        return Boolean(this.clientId && this.clientSecret && this.refreshToken);
    }

    async getAccessToken() {
        if (!this.isConfigured()) {
            throw new Error('Google Drive client is not configured. Set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN.');
        }

        if (this.cachedToken && Date.now() < this.cachedTokenExpiresAt) {
            return this.cachedToken;
        }

        if (this.tokenPromise) {
            return this.tokenPromise;
        }

        this.tokenPromise = (async () => {
            try {
                const body = new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token'
                });

                const response = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to obtain Google Drive access token: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                this.cachedToken = data.access_token;
                const expiresIn = data.expires_in || 3600;
                this.cachedTokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;

                return this.cachedToken;
            } finally {
                this.tokenPromise = null;
            }
        })();

        return this.tokenPromise;
    }

    async uploadFile({ name, mimeType, parentFolderId, buffer }) {
        const token = await this.getAccessToken();

        const metadata = {
            name,
            ...(parentFolderId ? { parents: [parentFolderId] } : {})
        };

        const boundary = `drive-transfer-${Date.now()}`;
        const multipartBody = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
            Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
            buffer,
            Buffer.from(`\r\n--${boundary}--`)
        ]);

        const response = await fetch(DRIVE_UPLOAD_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to upload file to Google Drive: ${response.status} ${errorText}`);
        }

        return response.json();
    }
}

module.exports = GoogleDriveClient;
