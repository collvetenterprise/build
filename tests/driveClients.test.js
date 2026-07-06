const OneDriveClient = require('../src/storage/onedrive/OneDriveClient');
const GoogleDriveClient = require('../src/storage/google/GoogleDriveClient');

describe('OneDriveClient', () => {
    test('isConfigured() is false when credentials are missing', () => {
        const client = new OneDriveClient({});
        expect(client.isConfigured()).toBe(false);
    });

    test('isConfigured() is true when all credentials are provided', () => {
        const client = new OneDriveClient({
            tenantId: 't',
            clientId: 'c',
            clientSecret: 's',
            driveId: 'd'
        });
        expect(client.isConfigured()).toBe(true);
    });

    test('getAccessToken() rejects when not configured', async () => {
        const client = new OneDriveClient({});
        await expect(client.getAccessToken()).rejects.toThrow(/not configured/);
    });
});

describe('GoogleDriveClient', () => {
    test('isConfigured() is false when credentials are missing', () => {
        const client = new GoogleDriveClient({});
        expect(client.isConfigured()).toBe(false);
    });

    test('isConfigured() is true when all credentials are provided', () => {
        const client = new GoogleDriveClient({
            clientId: 'c',
            clientSecret: 's',
            refreshToken: 'r'
        });
        expect(client.isConfigured()).toBe(true);
    });

    test('getAccessToken() rejects when not configured', async () => {
        const client = new GoogleDriveClient({});
        await expect(client.getAccessToken()).rejects.toThrow(/not configured/);
    });
});
