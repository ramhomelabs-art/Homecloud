const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const vaultService = require('../services/vaultService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

router.use(authenticateToken);

// ── GET /api/v1/lockers ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, parent_path, vault_path, size_mb, encryption_algorithm, auto_lock_timeout, created_at FROM lockers WHERE user_id = $1 ORDER BY created_at DESC',
            [req.user.id]
        );
        
        const lockers = result.rows.map(locker => ({
            ...locker,
            isLocked: !vaultService.hasKeys(locker.id)
        }));
        
        res.json(lockers);
    } catch (err) {
        logger.error(`Failed to list lockers: ${err.message}`);
        res.status(500).json({ error: 'Failed to retrieve lockers list' });
    }
});

// ── POST /api/v1/lockers/create ──────────────────────────────────────────────
router.post('/create', async (req, res) => {
    const { name, parentPath, sizeMb, password, encryptionAlgorithm, autoLockTimeout } = req.body;
    
    if (!name || !parentPath || !password) {
        return res.status(400).json({ error: 'Name, parent path, and passphrase are required.' });
    }

    const cleanName = name.trim().replace(/[\\\/:\*\?"<>\|]/g, '');
    if (!cleanName) {
        return res.status(400).json({ error: 'Invalid locker name.' });
    }

    const lockerFolderName = `${cleanName}.ndv`;
    const vaultPath = path.join(parentPath, lockerFolderName);

    try {
        // Double check if folder already exists on disk
        if (fs.existsSync(vaultPath)) {
            return res.status(400).json({ error: `A folder named '${lockerFolderName}' already exists in the selected location.` });
        }

        // Create the physical vault folder
        fs.mkdirSync(vaultPath, { recursive: true });

        // Generate cryptography tokens
        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = await bcrypt.hash(password, 10);
        
        const algo = encryptionAlgorithm || 'aes-256-ctr';
        const timeout = autoLockTimeout !== undefined ? parseInt(autoLockTimeout, 10) : 15;
        const limitMb = sizeMb !== undefined ? parseInt(sizeMb, 10) : -1;

        // Insert metadata in DB
        const dbResult = await db.query(
            `INSERT INTO lockers (name, parent_path, vault_path, size_mb, salt, password_hash, encryption_algorithm, auto_lock_timeout, user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [cleanName, parentPath, vaultPath, limitMb, salt, passwordHash, algo, timeout, req.user.id]
        );

        const newLockerId = dbResult.rows[0].id;
        
        logger.info(`Vault '${cleanName}' created successfully at '${vaultPath}'`);
        
        res.status(201).json({
            message: 'Cryptographic vault created successfully.',
            locker: {
                id: newLockerId,
                name: cleanName,
                vaultPath,
                sizeMb: limitMb,
                encryptionAlgorithm: algo,
                autoLockTimeout: timeout,
                isLocked: true
            }
        });
    } catch (err) {
        logger.error(`Failed to create locker: ${err.message}`);
        // Cleanup folder on DB failure
        try {
            if (fs.existsSync(vaultPath)) {
                fs.rmSync(vaultPath, { recursive: true, force: true });
            }
        } catch (e) {}
        res.status(500).json({ error: err.message || 'Failed to create locker directory.' });
    }
});

// ── POST /api/v1/lockers/:id/unlock ──────────────────────────────────────────
router.post('/:id/unlock', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Passphrase is required.' });
    }

    try {
        const result = await db.query('SELECT * FROM lockers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Locker not found.' });
        }

        const locker = result.rows[0];
        
        // Verify password hash
        const isMatch = await bcrypt.compare(password, locker.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid passphrase. Decryption key rejection.' });
        }

        // Derive keys and unlock vault
        const { fileKey, filenameKey } = vaultService.deriveKeys(password, locker.salt);
        vaultService.unlockLocker(locker.id, fileKey, filenameKey, locker.auto_lock_timeout);

        logger.info(`Vault '${locker.name}' unlocked successfully.`);
        res.json({ message: 'Vault decrypted and unlocked.', isLocked: false });
    } catch (err) {
        logger.error(`Unlock failed: ${err.message}`);
        res.status(500).json({ error: 'Decryption pipeline initialization failure.' });
    }
});

// ── POST /api/v1/lockers/:id/lock ────────────────────────────────────────────
router.post('/:id/lock', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.query('SELECT id, name FROM lockers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Locker not found.' });
        }

        const locker = result.rows[0];
        vaultService.lockLocker(locker.id);

        logger.info(`Vault '${locker.name}' locked manually.`);
        res.json({ message: 'Vault locked successfully.', isLocked: true });
    } catch (err) {
        logger.error(`Lock failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to lock vault.' });
    }
});

// ── DELETE /api/v1/lockers/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { deletePhysical } = req.query;

    try {
        const result = await db.query('SELECT * FROM lockers WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Locker not found.' });
        }

        const locker = result.rows[0];
        
        // Remove active keys if unlocked
        vaultService.lockLocker(locker.id);

        // Delete from database
        await db.query('DELETE FROM lockers WHERE id = $1', [id]);

        // Optionally delete physical directory
        if (deletePhysical === 'true') {
            if (fs.existsSync(locker.vault_path)) {
                fs.rmSync(locker.vault_path, { recursive: true, force: true });
                logger.info(`Locker registry & physical folder deleted for: ${locker.name}`);
            }
        } else {
            logger.info(`Locker registry deleted (files left encrypted on disk) for: ${locker.name}`);
        }

        res.json({ message: 'Vault registry deleted successfully.' });
    } catch (err) {
        logger.error(`Locker deletion failed: ${err.message}`);
        res.status(500).json({ error: 'Failed to delete vault registry.' });
    }
});

// ── GET /api/v1/lockers/secrets/list ─────────────────────────────────────────
router.get('/secrets/list', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, title, category, encrypted_payload, iv, auth_tag, created_at, updated_at FROM encrypted_secrets WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/v1/lockers/secrets/save ────────────────────────────────────────
router.post('/secrets/save', async (req, res) => {
    try {
        const { id, title, category, encryptedPayload, iv, authTag } = req.body;
        if (!title || !encryptedPayload) return res.status(400).json({ error: 'Title and payload required' });

        if (id) {
            await db.query(
                'UPDATE encrypted_secrets SET title = $1, category = $2, encrypted_payload = $3, iv = $4, auth_tag = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7',
                [title, category || 'general', encryptedPayload, iv || '', authTag || '', id, req.user.id]
            );
            res.json({ message: 'Secret updated successfully', id });
        } else {
            const insertRes = await db.query(
                'INSERT INTO encrypted_secrets (user_id, title, category, encrypted_payload, iv, auth_tag) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [req.user.id, title, category || 'general', encryptedPayload, iv || '', authTag || '']
            );
            res.json({ message: 'Secret created successfully', id: insertRes.rows[0].id });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /api/v1/lockers/secrets/:id ───────────────────────────────────────
router.delete('/secrets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM encrypted_secrets WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        res.json({ message: 'Secret deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
