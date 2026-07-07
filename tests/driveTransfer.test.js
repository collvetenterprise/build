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

describe('DriveTransferManager transfer logic', () => {
    function fakeConfiguredClient(overrides = {}) {
        return { isConfigured: () => true, ...overrides };
    }

    test('transferSingleFile rejects files larger than the 5MB simple-upload limit', async () => {
        const oneDriveClient = fakeConfiguredClient({
            downloadItemStream: async () => ({
                name: 'big-file.bin',
                mimeType: 'application/octet-stream',
                size: 6 * 1024 * 1024
            })
        });
        const googleDriveClient = fakeConfiguredClient({ uploadFile: jest.fn() });

        const manager = new DriveTransferManager(oneDriveClient, googleDriveClient);

        await expect(manager.transferSingleFile('item-1', 'folder-1')).rejects.toThrow(/5MB limit/);
        expect(googleDriveClient.uploadFile).not.toHaveBeenCalled();
    });

    test('runJob records totalFiles once the folder listing resolves', async () => {
        const { Readable } = require('stream');
        const oneDriveClient = fakeConfiguredClient({
            listChildren: async () => [
                { id: 'a', isFolder: false },
                { id: 'b', isFolder: false },
                { id: 'sub-folder', isFolder: true }
            ],
            downloadItemStream: async (itemId) => ({
                name: `${itemId}.txt`,
                mimeType: 'text/plain',
                size: 3,
                stream: Readable.from([Buffer.from('hi!')])
            })
        });
        const googleDriveClient = fakeConfiguredClient({
            uploadFile: async () => ({ id: 'uploaded-id' })
        });

        const manager = new DriveTransferManager(oneDriveClient, googleDriveClient);
        const job = manager.createJob({ oneDriveFolderId: 'folder-1', googleDriveFolderId: 'dest' });

        await manager.runJob(job);

        expect(job.totalFiles).toBe(2);
        expect(job.status).toBe('completed');
        expect(job.results).toHaveLength(2);
    });

    test('pruneOldJobs removes terminal jobs past the retention window but keeps recent ones', () => {
        const manager = new DriveTransferManager(fakeConfiguredClient(), fakeConfiguredClient());

        const oldJob = manager.createJob({ oneDriveItemId: 'old' });
        manager.updateJob(oldJob.id, { status: 'completed' });
        manager.jobs.get(oldJob.id).updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);

        const recentJob = manager.createJob({ oneDriveItemId: 'recent' });
        manager.updateJob(recentJob.id, { status: 'completed' });

        manager.pruneOldJobs();

        expect(manager.jobs.has(oldJob.id)).toBe(false);
        expect(manager.jobs.has(recentJob.id)).toBe(true);
    });
});
