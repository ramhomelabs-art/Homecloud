import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Lock, Unlock, Plus, Folder, Trash2, Eye, ExternalLink, ShieldCheck, 
    Settings, Info, Server, HelpCircle, HardDrive, KeyRound, Clock, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import FolderPickerModal from '../modals/FolderPickerModal';

const API_BASE = '/api';

export default function VaultsView({ showToast, setView, setPath, setExplorerMode }) {
    const [vaults, setVaults] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Create Vault State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createConfirmPassword, setCreateConfirmPassword] = useState('');
    const [selectedParentPath, setSelectedParentPath] = useState('');
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    
    // Advanced Options State
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [sizeLimitOption, setSizeLimitOption] = useState('unlimited'); // 'unlimited' or 'custom'
    const [sizeLimitValue, setSizeLimitValue] = useState(100);
    const [sizeLimitUnit, setSizeLimitUnit] = useState('MB'); // 'MB' or 'GB'
    const [algorithm, setAlgorithm] = useState('aes-256-ctr');
    const [timeoutOption, setTimeoutOption] = useState('15'); // '5', '15', '30', '60', '0' (never)
    
    // Unlock Modal State
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [activeLocker, setActiveLocker] = useState(null);
    const [unlockPassword, setUnlockPassword] = useState('');

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteLocker, setDeleteLocker] = useState(null);
    const [deletePhysical, setDeletePhysical] = useState(false);

    useEffect(() => {
        fetchVaults();
    }, []);

    const fetchVaults = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/v1/lockers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVaults(res.data || []);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to fetch vaults.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateVault = async (e) => {
        e.preventDefault();
        if (!createName.trim()) {
            return showToast('Locker name is required.', 'warning');
        }
        if (!selectedParentPath) {
            return showToast('Please select a parent storage directory.', 'warning');
        }
        if (!createPassword) {
            return showToast('Passphrase is required.', 'warning');
        }
        if (createPassword !== createConfirmPassword) {
            return showToast('Passphrases do not match.', 'error');
        }

        let sizeMb = -1;
        if (sizeLimitOption === 'custom') {
            const val = parseInt(sizeLimitValue, 10);
            if (isNaN(val) || val <= 0) {
                return showToast('Please enter a valid size limit.', 'warning');
            }
            sizeMb = sizeLimitUnit === 'GB' ? val * 1024 : val;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/v1/lockers/create`, {
                name: createName,
                parentPath: selectedParentPath,
                sizeMb,
                password: createPassword,
                encryptionAlgorithm: algorithm,
                autoLockTimeout: timeoutOption === '0' ? -1 : parseInt(timeoutOption, 10)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showToast('Encrypted vault created successfully.', 'success');
            setShowCreateModal(false);
            resetCreateForm();
            fetchVaults();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to create vault.', 'error');
        }
    };

    const resetCreateForm = () => {
        setCreateName('');
        setCreatePassword('');
        setCreateConfirmPassword('');
        setSelectedParentPath('');
        setSizeLimitOption('unlimited');
        setSizeLimitValue(100);
        setSizeLimitUnit('MB');
        setAlgorithm('aes-256-ctr');
        setTimeoutOption('15');
        setShowAdvanced(false);
    };

    const handleUnlockSubmit = async (e) => {
        e.preventDefault();
        if (!unlockPassword) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/v1/lockers/${activeLocker.id}/unlock`, {
                password: unlockPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showToast(`Vault '${activeLocker.name}' unlocked successfully.`, 'success');
            setShowUnlockModal(false);
            setUnlockPassword('');
            setActiveLocker(null);
            fetchVaults();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to decrypt vault. Incorrect passphrase.', 'error');
        }
    };

    const handleLockLocker = async (locker) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/v1/lockers/${locker.id}/lock`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showToast(`Vault '${locker.name}' locked manually. Keys purged from memory.`, 'success');
            fetchVaults();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to lock vault.', 'error');
        }
    };

    const handleDeleteSubmit = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE}/v1/lockers/${deleteLocker.id}?deletePhysical=${deletePhysical}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showToast(`Vault registry deleted. ${deletePhysical ? 'Physical files destroyed.' : 'Encrypted files left on disk.'}`, 'success');
            setShowDeleteModal(false);
            setDeleteLocker(null);
            setDeletePhysical(false);
            fetchVaults();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to delete vault.', 'error');
        }
    };

    const openInExplorer = (locker) => {
        if (locker.isLocked) {
            setActiveLocker(locker);
            setShowUnlockModal(true);
        } else {
            // Set explorer view path and navigate
            setView('browse');
            if (setExplorerMode) setExplorerMode('files');
            if (setPath) setPath(locker.vault_path);
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getLockerFolderSize = (locker) => {
        // Vault file size logic or standard calculation (in general metadata sizes are handled in backend)
        return 'Calculated in explorer';
    };

    return (
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={24} color="var(--primary)" /> Cryptographic Vaults
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Secure directory lockers with transient RAM ciphers, filename obfuscation, size throttling, and autolock timeouts.
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', fontWeight: '700' }}>
                    <Plus size={16} /> Create Vault
                </button>
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="glass" style={{ padding: '16px', borderRadius: '14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-0)' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.12)', padding: '10px', borderRadius: '10px' }}>
                        <Lock size={20} color="var(--primary)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '700' }}>Total Lockers</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{vaults.length}</div>
                    </div>
                </div>
                
                <div className="glass" style={{ padding: '16px', borderRadius: '14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-0)' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.12)', padding: '10px', borderRadius: '10px' }}>
                        <Unlock size={20} color="#f59e0b" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '700' }}>Unlocked Now</div>
                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b' }}>
                            {vaults.filter(v => !v.isLocked).length}
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '16px', borderRadius: '14px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-surface-0)' }}>
                    <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '10px', borderRadius: '10px' }}>
                        <ShieldCheck size={20} color="#10b981" />
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: '700' }}>Security Level</div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#10b981' }}>Military AES-256</div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <div className="spinner" style={{ borderTopColor: 'var(--primary)' }}></div>
                </div>
            ) : vaults.length === 0 ? (
                <div className="glass" style={{ padding: '48px', borderRadius: '16px', border: '1px solid var(--border-subtle)', textAlign: 'center', maxWidth: '600px', margin: '40px auto', background: 'var(--bg-surface-0)' }}>
                    <div style={{ display: 'inline-flex', background: 'rgba(99, 102, 241, 0.12)', padding: '20px', borderRadius: '50%', marginBottom: '16px' }}>
                        <Lock size={48} color="var(--primary)" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px', color: 'var(--text-primary)' }}>No Cryptographic Vaults</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '24px' }}>
                        Encrypt critical files, documents, and private directory folders. Unlocked vaults integrate transparently inside NexaDisk File Explorer. Lock them to instantly erase ciphers from RAM.
                    </p>
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ padding: '12px 24px', borderRadius: '12px', fontWeight: '700' }}>
                        Create Your First Vault
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {vaults.map(locker => (
                        <motion.div 
                            key={locker.id}
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            className="glass" 
                            style={{ 
                                padding: '20px', 
                                borderRadius: '16px', 
                                border: '1px solid',
                                borderColor: locker.isLocked ? 'var(--border-subtle)' : 'rgba(245, 158, 11, 0.4)',
                                position: 'relative',
                                overflow: 'hidden',
                                background: locker.isLocked ? 'var(--bg-surface-0)' : 'rgba(245, 158, 11, 0.03)',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            {/* Glow status light */}
                            <div style={{ 
                                position: 'absolute', 
                                top: '16px', 
                                right: '16px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                fontSize: '11px',
                                background: locker.isLocked ? 'rgba(244, 63, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                color: locker.isLocked ? '#f43f5e' : '#f59e0b',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontWeight: '800'
                            }}>
                                <span style={{ 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    background: locker.isLocked ? '#f43f5e' : '#f59e0b',
                                    boxShadow: locker.isLocked ? '0 0 8px #f43f5e' : '0 0 8px #f59e0b'
                                }}></span>
                                {locker.isLocked ? 'LOCKED' : 'UNLOCKED'}
                            </div>

                            {/* Main Content */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ 
                                    background: locker.isLocked ? 'var(--bg-surface-2)' : 'rgba(245, 158, 11, 0.12)', 
                                    padding: '12px', 
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: locker.isLocked ? 'var(--border-subtle)' : 'rgba(245, 158, 11, 0.3)'
                                }}>
                                    {locker.isLocked ? <Lock size={24} color="var(--text-secondary)" /> : <Unlock size={24} color="#f59e0b" />}
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{locker.name}</h4>
                                    <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                                        <HardDrive size={11} />
                                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                            {locker.vault_path}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-dim)', fontWeight: '700' }}>Size Limit</span>
                                    <span style={{ fontWeight: '800', color: 'var(--text-primary)' }}>
                                        {locker.size_mb === -1 ? 'Unlimited' : `${(locker.size_mb >= 1024 ? (locker.size_mb / 1024).toFixed(1) + ' GB' : locker.size_mb + ' MB')}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                    <span style={{ color: 'var(--text-dim)', fontWeight: '700' }}>Algorithm</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '800', color: 'var(--primary)' }}>{locker.encryption_algorithm.toUpperCase()}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <span style={{ color: 'var(--text-dim)', fontWeight: '700' }}>Auto-Lock</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                        <Clock size={11} color="var(--text-dim)" />
                                        {locker.auto_lock_timeout === -1 ? 'Never' : `${locker.auto_lock_timeout} mins`}
                                    </span>
                                </div>
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                {locker.isLocked ? (
                                    <button 
                                        className="btn-primary" 
                                        onClick={() => { setActiveLocker(locker); setShowUnlockModal(true); }}
                                        style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '700' }}
                                    >
                                        <Unlock size={14} /> Unlock
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleLockLocker(locker)}
                                        style={{ flex: 1, padding: '8px', fontSize: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: '700', background: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)', cursor: 'pointer' }}
                                    >
                                        <Lock size={14} /> Lock Vault
                                    </button>
                                )}
                                
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => openInExplorer(locker)}
                                    style={{ padding: '8px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700' }}
                                    title="Open Folder Explorer"
                                >
                                    <ExternalLink size={14} /> Browse
                                </button>

                                <button 
                                    onClick={() => { setDeleteLocker(locker); setShowDeleteModal(true); }}
                                    style={{ padding: '8px 12px', borderRadius: '10px', display: 'flex', alignItems: 'center', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', cursor: 'pointer', transition: 'color 0.15s' }}
                                    title="Delete Vault"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* CREATE VAULT MODAL */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="modal-overlay" style={{ zIndex: 1050 }}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content glass" style={{ width: '450px', padding: '24px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Lock size={18} color="var(--accent-cyan)" /> Create Cryptographic Vault
                                </h3>
                                <button onClick={() => { setShowCreateModal(false); resetCreateForm(); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                            </div>

                            <form onSubmit={handleCreateVault}>
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Vault Name</label>
                                    <input 
                                        type="text" 
                                        className="m-input" 
                                        placeholder="e.g. PersonalVault" 
                                        value={createName} 
                                        onChange={e => setCreateName(e.target.value)}
                                        required 
                                    />
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                    <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Parent Drive Path</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            type="text" 
                                            className="m-input" 
                                            placeholder="Choose location on local filesystem..." 
                                            value={selectedParentPath}
                                            readOnly 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            className="btn-secondary" 
                                            onClick={() => setShowFolderPicker(true)} 
                                            style={{ padding: '0 16px', borderRadius: '10px' }}
                                        >
                                            Browse
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                    <div>
                                        <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Passphrase</label>
                                        <input 
                                            type="password" 
                                            className="m-input" 
                                            placeholder="••••••••" 
                                            value={createPassword} 
                                            onChange={e => setCreatePassword(e.target.value)}
                                            required 
                                        />
                                    </div>
                                    <div>
                                        <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Confirm Passphrase</label>
                                        <input 
                                            type="password" 
                                            className="m-input" 
                                            placeholder="••••••••" 
                                            value={createConfirmPassword} 
                                            onChange={e => setCreateConfirmPassword(e.target.value)}
                                            required 
                                        />
                                    </div>
                                </div>

                                {/* Expandable Advanced Options */}
                                <div style={{ marginBottom: '16px' }}>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowAdvanced(!showAdvanced)} 
                                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: 0, fontWeight: '600' }}
                                    >
                                        <Settings size={14} /> {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
                                    </button>

                                    {showAdvanced && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '10px', marginTop: '10px', border: '1px solid var(--border-subtle)' }}>
                                            {/* Size limit */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Storage size limit</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                        <input 
                                                            type="radio" 
                                                            checked={sizeLimitOption === 'unlimited'} 
                                                            onChange={() => setSizeLimitOption('unlimited')} 
                                                        />
                                                        Unlimited
                                                    </label>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                        <input 
                                                            type="radio" 
                                                            checked={sizeLimitOption === 'custom'} 
                                                            onChange={() => setSizeLimitOption('custom')} 
                                                        />
                                                        Custom Limit
                                                    </label>
                                                </div>
                                                {sizeLimitOption === 'custom' && (
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                        <input 
                                                            type="number" 
                                                            className="m-input" 
                                                            value={sizeLimitValue} 
                                                            onChange={e => setSizeLimitValue(e.target.value)} 
                                                            style={{ width: '100px' }} 
                                                        />
                                                        <select 
                                                            className="m-input" 
                                                            value={sizeLimitUnit} 
                                                            onChange={e => setSizeLimitUnit(e.target.value)}
                                                            style={{ flex: 1 }}
                                                        >
                                                            <option value="MB">Megabytes (MB)</option>
                                                            <option value="GB">Gigabytes (GB)</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Encryption type */}
                                            <div style={{ marginBottom: '10px' }}>
                                                <label className="m-label" style={{ display: 'block', marginBottom: '4px' }}>Encryption Stream Algorithm</label>
                                                <select 
                                                    className="m-input" 
                                                    value={algorithm} 
                                                    onChange={e => setAlgorithm(e.target.value)}
                                                    style={{ width: '100%' }}
                                                >
                                                    <option value="aes-256-ctr">AES-256-CTR (Recommended - High Speed Stream)</option>
                                                    <option value="aes-256-cbc">AES-256-CBC (Block Cipher Standard)</option>
                                                </select>
                                            </div>

                                            {/* Auto lock timeout */}
                                            <div>
                                                <label className="m-label" style={{ display: 'block', marginBottom: '4px' }}>Auto-Lock Inactivity Timeout</label>
                                                <select 
                                                    className="m-input" 
                                                    value={timeoutOption} 
                                                    onChange={e => setTimeoutOption(e.target.value)}
                                                    style={{ width: '100%' }}
                                                >
                                                    <option value="5">5 Minutes</option>
                                                    <option value="15">15 Minutes (Default)</option>
                                                    <option value="30">30 Minutes</option>
                                                    <option value="60">1 Hour</option>
                                                    <option value="0">Never Autolock (Lower Security)</option>
                                                </select>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => { setShowCreateModal(false); resetCreateForm(); }}>Cancel</button>
                                    <button type="submit" className="btn-primary" style={{  padding: '0 20px' , color: '#ffffff' }}>Create</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* UNLOCK PASSWORD DIALOG */}
            <AnimatePresence>
                {showUnlockModal && activeLocker && (
                    <div className="modal-overlay" style={{ zIndex: 1060 }}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content glass" style={{ width: '380px', padding: '24px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Unlock size={18} color="var(--accent-gold)" /> Decrypt Vault '{activeLocker.name}'
                                </h3>
                                <button onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setActiveLocker(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                            </div>

                            <form onSubmit={handleUnlockSubmit}>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                                    Enter your master passphrase to derive the active keys and load the filesystem locker into RAM.
                                </p>
                                
                                <div style={{ marginBottom: '20px' }}>
                                    <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Passphrase</label>
                                    <input 
                                        type="password" 
                                        className="m-input" 
                                        placeholder="••••••••" 
                                        value={unlockPassword} 
                                        onChange={e => setUnlockPassword(e.target.value)}
                                        autoFocus
                                        required 
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => { setShowUnlockModal(false); setUnlockPassword(''); setActiveLocker(null); }}>Cancel</button>
                                    <button type="submit" className="btn-primary" style={{ background: 'var(--accent-gold)', borderColor: 'var(--accent-gold)', color: '#000', padding: '0 20px', fontWeight: '700' }}>Unlock</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* DELETE CONFIRM MODAL */}
            <AnimatePresence>
                {showDeleteModal && deleteLocker && (
                    <div className="modal-overlay" style={{ zIndex: 1060 }}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content glass" style={{ width: '400px', padding: '24px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldAlert size={18} /> Delete Vault Registry
                                </h3>
                                <button onClick={() => { setShowDeleteModal(false); setDeleteLocker(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6' }}>
                                    You are deleting the locker registry for **{deleteLocker.name}**. Choose if you want to also destroy the physical folders or keep them encrypted on your drive.
                                </p>

                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '10px', marginTop: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={deletePhysical}
                                            onChange={e => setDeletePhysical(e.target.checked)}
                                        />
                                        <span>Permanently destroy physical folder & files</span>
                                    </label>
                                    {deletePhysical && (
                                        <p style={{ color: '#ef4444', fontSize: '11px', margin: '6px 0 0 24px', fontWeight: '600' }}>
                                            ⚠️ Warning: This will delete '{deleteLocker.vault_path}' and all files inside permanently. This action cannot be undone.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" className="btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteLocker(null); }}>Cancel</button>
                                <button type="button" onClick={handleDeleteSubmit} style={{ background: '#ef4444', border: 'none', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700' }}>
                                    Confirm Delete
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* NESTED FOLDER PICKER MODAL */}
            {showFolderPicker && (
                <FolderPickerModal 
                    agents={[]}
                    lockNode={true}
                    onClose={() => setShowFolderPicker(false)}
                    onSelect={(folderPath) => {
                        setSelectedParentPath(folderPath);
                        setShowFolderPicker(false);
                    }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
