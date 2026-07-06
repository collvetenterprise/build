const express = require('express');
const request = require('supertest');
const DriveTransferManager = require('../src/storage/DriveTransferManager');

describe('Drive Transfer API', () => {
    let app;
    let driveTransferManager;

    beforeAll(async () => {
        driveTransferManager = new DriveTransferManager();
        await driveTransferManager.initialize();

        app = express();
        app.use(express.json());
        app.use('/api/drive-transfer', driveTransferManager.getRouter());
    });

    test('should report unconfigured status when no credentials are set', async () => {
        const response = await request(app)
            .get('/api/drive-transfer/status')
            .expect(200);

        expect(response.body.oneDriveConfigured).toBe(false);
        expect(response.body.googleDriveConfigured).toBe(false);
        expect(response.body.configured).toBe(false);
        expect(response.body.jobCount).toBe(0);
    });

    test('should reject a transfer request missing source fields', async () => {
        const response = await request(app)
            .post('/api/drive-transfer/jobs')
            .send({ googleDriveFolderId: 'some-folder' })
            .expect(400);

        expect(response.body.error).toMatch(/oneDriveItemId or oneDriveFolderId/);
    });

    test('should reject a transfer request when credentials are not configured', async () => {
        const response = await request(app)
            .post('/api/drive-transfer/jobs')
            .send({ oneDriveItemId: 'item-123', googleDriveFolderId: 'some-folder' })
            .expect(503);

        expect(response.body.error).toBe('Drive Transfer Manager is not configured');
        expect(response.body.oneDriveConfigured).toBe(false);
        expect(response.body.googleDriveConfigured).toBe(false);
    });

    test('should return 404 for an unknown job', async () => {
        await request(app)
            .get('/api/drive-transfer/jobs/does-not-exist')
            .expect(404);
    });

    test('should list jobs (empty when none created)', async () => {
        const response = await request(app)
            .get('/api/drive-transfer/jobs')
            .expect(200);

        expect(response.body.jobs).toEqual([]);
        expect(response.body.totalCount).toBe(0);
    });
});
