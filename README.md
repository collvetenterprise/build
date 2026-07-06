# Dynamic Build Environment

A comprehensive system implementing dynamic build environment tier structuring with CI/CD pipeline, MCP access points, Signal GIS focus points, agent portal, and MGRS functionality.

## Features

### 🏗️ Dynamic Build Environment Tier Structuring
- Multi-tier build configuration system
- Environment-specific build scripts
- Automated artifact management

### 🔄 CI/CD Pipeline
- Automated build, test, and deployment workflows
- Multi-environment promotion pipeline
- Integrated quality gates

### 🔌 MCP Access Points
- Message Control Protocol integration
- Configurable access point management
- Protocol handler architecture

### 🗺️ Signal GIS Focus Points
- Geographic Information System integration
- Signal processing and analysis
- Location-based focus point management

### 🤖 Agent Portal & Trace Referencing
- Agent management system
- Comprehensive trace logging
- Reference tracking and correlation

### 📍 MGRS Ping Functionality
- Military Grid Reference System support
- Connectivity testing and monitoring
- Location-based service discovery

### ☁️ Drive Transfer (OneDrive → Google Drive)
- Transfers files or entire folders from a Microsoft OneDrive drive into Google Drive
- Job-based API: create a transfer job, then poll it for progress and results
- Requires Microsoft Graph and Google Drive credentials (see Configuration below); returns a clear `503` error until configured

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Build for different environments
npm run build:dev      # Development build
npm run build:staging  # Staging build
npm run build:prod     # Production build
```

## Architecture

The system is organized into the following modules:

- `src/core/` - Core system functionality
- `src/build/` - Build environment management
- `src/mcp/` - MCP access point implementation
- `src/gis/` - GIS and signal processing
- `src/agents/` - Agent portal and management
- `src/mgrs/` - MGRS coordinate system support
- `src/storage/` - OneDrive to Google Drive transfer (`DriveTransferManager`, with `onedrive/` and `google/` API clients)

## Configuration

Environment-specific configurations are managed through:
- `.env` files for environment variables
- `config/` directory for structured configuration
- `build-tiers/` for tier-specific build configurations

### Drive Transfer credentials

The `/api/drive-transfer` endpoints require:
- **Microsoft Graph** (app-only, client credentials grant): `ONEDRIVE_TENANT_ID`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_DRIVE_ID`
- **Google Drive** (OAuth2 refresh token grant): `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`

Without these set, `GET /api/drive-transfer/status` reports which side is unconfigured, and `POST /api/drive-transfer/jobs` responds with `503` instead of attempting a transfer.

#### API

- `GET /api/drive-transfer/status` - configuration and job counts
- `GET /api/drive-transfer/jobs` - list transfer jobs
- `GET /api/drive-transfer/jobs/:jobId` - get a single job's status and results
- `POST /api/drive-transfer/jobs` - start a transfer; body is `{ "oneDriveItemId": "..." }` or `{ "oneDriveFolderId": "..." }` (transfers all files directly inside the folder, non-recursive), plus an optional `"googleDriveFolderId"` destination folder