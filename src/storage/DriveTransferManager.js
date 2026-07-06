const express = require('express');
const crypto = require('crypto');

const OneDriveClient = require('./onedrive/OneDriveClient');
const GoogleDriveClient = require('./google/GoogleDriveClient');

function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

class DriveTransferManager {
    constructor(oneDriveClient = new OneDriveClient(), googleDriveClient = new GoogleDriveClient()) {
        this.router = express.Router();
        this.oneDriveClient = oneDriveClient;
        this.googleDriveClient = googleDriveClient;
        this.jobs = new Map();
        this.setupRoutes();
    }

    async initialize() {
        console.log('Initializing Drive Transfer Manager...');
        if (!this.isConfigured()) {
            console.warn('Drive Transfer Manager started without OneDrive/Google Drive credentials configured. Transfers will be rejected until configuration is provided.');
        }
        console.log('Drive Transfer Manager initialized');
    }

    isConfigured() {
        return this.oneDriveClient.isConfigured() && this.googleDriveClient.isConfigured();
    }

    createJob({ oneDriveItemId, oneDriveFolderId, googleDriveFolderId }) {
        const job = {
            id: crypto.randomUUID(),
            status: 'pending',
            source: oneDriveItemId ? { itemId: oneDriveItemId } : { folderId: oneDriveFolderId },
            destination: { googleDriveFolderId: googleDriveFolderId || null },
            results: [],
            error: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.jobs.set(job.id, job);
        return job;
    }

    updateJob(jobId, updates) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return undefined;
        }

        Object.assign(job, updates, { updatedAt: new Date() });
        return job;
    }

    async transferSingleFile(itemId, googleDriveFolderId) {
        const file = await this.oneDriveClient.downloadItemStream(itemId);
        const buffer = await streamToBuffer(file.stream);

        const uploaded = await this.googleDriveClient.uploadFile({
            name: file.name,
            mimeType: file.mimeType,
            parentFolderId: googleDriveFolderId,
            buffer
        });

        return {
            oneDriveItemId: itemId,
            name: file.name,
            googleDriveFileId: uploaded.id,
            status: 'completed'
        };
    }

    async runJob(job) {
        this.updateJob(job.id, { status: 'running' });

        try {
            const itemIds = [];

            if (job.source.itemId) {
                itemIds.push(job.source.itemId);
            } else {
                const children = await this.oneDriveClient.listChildren(job.source.folderId);
                for (const child of children) {
                    if (!child.isFolder) {
                        itemIds.push(child.id);
                    }
                }
            }

            const results = [];
            for (const itemId of itemIds) {
                try {
                    const result = await this.transferSingleFile(itemId, job.destination.googleDriveFolderId);
                    results.push(result);
                } catch (error) {
                    results.push({
                        oneDriveItemId: itemId,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            const hasFailures = results.some((result) => result.status === 'failed');
            this.updateJob(job.id, {
                status: hasFailures ? 'completed_with_errors' : 'completed',
                results
            });
        } catch (error) {
            this.updateJob(job.id, { status: 'failed', error: error.message });
        }
    }

    setupRoutes() {
        // Service status, including whether credentials are configured
        this.router.get('/status', (req, res) => {
            res.json(this.getStatus());
        });

        // List transfer jobs
        this.router.get('/jobs', (req, res) => {
            res.json({
                jobs: Array.from(this.jobs.values()),
                totalCount: this.jobs.size
            });
        });

        // Get a single transfer job
        this.router.get('/jobs/:jobId', (req, res) => {
            const job = this.jobs.get(req.params.jobId);

            if (!job) {
                return res.status(404).json({
                    error: 'Transfer job not found',
                    jobId: req.params.jobId
                });
            }

            res.json(job);
        });

        // Create and start a new OneDrive -> Google Drive transfer job
        this.router.post('/jobs', (req, res) => {
            const { oneDriveItemId, oneDriveFolderId, googleDriveFolderId } = req.body || {};

            if (!oneDriveItemId && !oneDriveFolderId) {
                return res.status(400).json({
                    error: 'Missing required field: either oneDriveItemId or oneDriveFolderId must be provided'
                });
            }

            if (!this.isConfigured()) {
                return res.status(503).json({
                    error: 'Drive Transfer Manager is not configured',
                    details: 'Set the OneDrive and Google Drive credentials described in .env.example before starting a transfer',
                    oneDriveConfigured: this.oneDriveClient.isConfigured(),
                    googleDriveConfigured: this.googleDriveClient.isConfigured()
                });
            }

            const job = this.createJob({ oneDriveItemId, oneDriveFolderId, googleDriveFolderId });

            // Run the transfer asynchronously; job status/results are polled via GET /jobs/:jobId
            this.runJob(job).catch((error) => {
                this.updateJob(job.id, { status: 'failed', error: error.message });
            });

            res.status(202).json({
                message: 'Transfer job created',
                job
            });
        });
    }

    getStatus() {
        return {
            oneDriveConfigured: this.oneDriveClient.isConfigured(),
            googleDriveConfigured: this.googleDriveClient.isConfigured(),
            configured: this.isConfigured(),
            jobCount: this.jobs.size,
            activeJobs: Array.from(this.jobs.values()).filter((job) => job.status === 'pending' || job.status === 'running').length
        };
    }

    getRouter() {
        return this.router;
    }
}

module.exports = DriveTransferManager;
