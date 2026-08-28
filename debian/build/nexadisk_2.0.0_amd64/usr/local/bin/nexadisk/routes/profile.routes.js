const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const profileService = require('../services/profileService');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

// Setup multer for temporary staging
const stagingDir = path.join(process.cwd(), 'security_staging', 'profiles');
if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
}

const upload = multer({
    dest: stagingDir,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB limit
});

// GET /api/v1/profile
router.get('/', authenticateToken, async (req, res) => {
    try {
        const profile = await profileService.getUserProfile(req.user.id);
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        
        // Don't send sensitive password hashes
        delete profile.password_hash;
        res.json(profile);
    } catch (err) {
        logger.error(`[Profile] GET error: ${err.message}`);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// PUT /api/v1/profile
router.put('/', authenticateToken, async (req, res) => {
    try {
        const updatedProfile = await profileService.updateUserProfile(req.user.id, req.body);
        delete updatedProfile.password_hash;
        res.json({ success: true, profile: updatedProfile });
    } catch (err) {
        logger.error(`[Profile] PUT error: ${err.message}`);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// POST /api/v1/profile/avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const result = await profileService.processAvatar(req.user.id, req.file);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error(`[Profile] Avatar upload error: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// DELETE /api/v1/profile/avatar
router.delete('/avatar', authenticateToken, async (req, res) => {
    try {
        await profileService.removeAvatar(req.user.id);
        res.json({ success: true, message: 'Avatar removed' });
    } catch (err) {
        logger.error(`[Profile] Avatar delete error: ${err.message}`);
        res.status(500).json({ error: 'Failed to remove avatar' });
    }
});

// GET /api/v1/profile/avatar/:userId
// Serve the physical image file
router.get('/avatar/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const size = req.query.size || 'original'; // original, 256, 128, 64
        
        const profile = await profileService.getUserProfile(userId);
        if (!profile || !profile.avatar_path) {
            // Return 404, frontend should show initials fallback
            return res.status(404).json({ error: 'No avatar found' });
        }

        const sizeMap = {
            'original': 'avatar.webp',
            '256': 'avatar-256.webp',
            '128': 'avatar-128.webp',
            '64': 'avatar-64.webp'
        };

        const fileName = sizeMap[size] || 'avatar.webp';
        const absolutePath = path.resolve(process.env.PROFILE_STORAGE_ROOT || '/var/lib/nexadisk/profiles', userId, fileName);

        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ error: 'Avatar file missing on disk' });
        }

        res.sendFile(absolutePath);
    } catch (err) {
        logger.error(`[Profile] GET avatar error: ${err.message}`, err);
        res.status(500).json({ error: 'Failed to serve avatar' });
    }
});

// PUT /api/v1/profile/admin/update
// Admin bulk updates
router.put('/admin/update', authenticateToken, requireRole(['Admin']), async (req, res) => {
    try {
        const { userId, data } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID required' });
        
        const updatedProfile = await profileService.updateUserProfile(userId, data);
        res.json({ success: true, profile: updatedProfile });
    } catch (err) {
        res.status(500).json({ error: 'Admin update failed' });
    }
});

module.exports = router;
