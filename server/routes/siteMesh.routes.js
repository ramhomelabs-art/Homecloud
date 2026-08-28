const express = require('express');
const router = express.Router();
const siteMeshService = require('../services/siteMeshService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Generate Pairing Token for a new remote site
router.post('/token', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const { siteName, location } = req.body;
        if (!siteName) return res.status(400).json({ error: 'Site name is required' });

        const tokenData = siteMeshService.generatePairingToken(siteName, location);
        res.json(tokenData);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to generate token: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Secondary Site Pairing Handshake
router.post('/pair', async (req, res) => {
    try {
        const { token, siteName, location, endpointUrl, storageCapacityBytes, storageUsedBytes, details } = req.body;
        if (!token) return res.status(400).json({ error: 'Pairing token is required' });

        const site = await siteMeshService.registerSite({
            name: siteName || 'Remote Node',
            location: location || 'Edge Datacenter',
            endpointUrl: endpointUrl || 'wss://tunnel.nexadisk.internal',
            tunnelToken: token,
            storageCapacityBytes: Number(storageCapacityBytes) || 1099511627776, // 1TB default
            storageUsedBytes: Number(storageUsedBytes) || 214748364800, // 200GB default
            details: details || {}
        });

        res.json({
            message: 'Site successfully paired to NexaDisk Global Cluster',
            siteId: site.id,
            status: site.status
        });
    } catch (err) {
        logger.error(`[SiteMesh Routes] Pairing failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Provision Instant Demo Proxmox VE Site for Demonstration
router.post('/demo-site', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const site = await siteMeshService.provisionDemoProxmoxSite();
        res.json({
            message: 'Proxmox VE Cluster-02 secondary site provisioned and connected',
            site
        });
    } catch (err) {
        logger.error(`[SiteMesh Routes] Demo site provisioning failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// List Connected Sites
router.get('/sites', authenticateToken, async (req, res) => {
    try {
        const sites = await siteMeshService.getSites();
        res.json(sites);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to list sites: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Remove / Unregister a Site
router.delete('/sites/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const removed = await siteMeshService.removeSite(req.params.id);
        res.json({ message: 'Site removed from cluster', site: removed });
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to remove site: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// List Cross-Site Sync Jobs
router.get('/sync-jobs', authenticateToken, async (req, res) => {
    try {
        const jobs = await siteMeshService.getSyncJobs();
        res.json(jobs);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to fetch sync jobs: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Create Cross-Site Replication Job
router.post('/sync-jobs', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const { name, sourceSiteId, sourcePath, targetSiteId, targetPath, syncMode, scheduleCron } = req.body;
        if (!name || !sourceSiteId || !targetSiteId) {
            return res.status(400).json({ error: 'Name, source site, and target site are required' });
        }

        const job = await siteMeshService.createSyncJob({
            name,
            sourceSiteId,
            sourcePath: sourcePath || '/',
            targetSiteId,
            targetPath: targetPath || '/',
            syncMode: syncMode || 'mirror',
            scheduleCron: scheduleCron || '0 */6 * * *'
        });

        res.json(job);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to create sync job: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Trigger Cross-Site Replication Job
router.post('/sync-jobs/:id/run', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const result = await siteMeshService.triggerSyncJob(req.params.id);
        res.json(result);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to run sync job: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Delete Sync Job
router.delete('/sync-jobs/:id', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const result = await siteMeshService.deleteSyncJob(req.params.id);
        res.json(result);
    } catch (err) {
        logger.error(`[SiteMesh Routes] Failed to delete sync job: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Generate Join Script
router.get('/join-script', authenticateToken, requireRole(['Admin']), (req, res) => {
    try {
        const { token, siteName } = req.query;
        const masterUrl = `${req.protocol}://${req.get('host')}`;
        const script = siteMeshService.generateJoinScript(masterUrl, token || 'SAMPLE_TOKEN', siteName || 'Secondary-Site');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(script);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
