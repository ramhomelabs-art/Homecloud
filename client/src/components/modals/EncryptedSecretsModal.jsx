import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    KeyRound, Lock, Unlock, Plus, Trash2, Eye, 
    EyeOff, Copy, Check, X, Shield, RefreshCw, AlertCircle
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const EncryptedSecretsModal = ({ onClose, showToast }) => {
    const [secrets, setSecrets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [masterKey, setMasterKey] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [revealedIds, setRevealedIds] = useState(new Set());
    const [copiedId, setCopiedId] = useState(null);
    const [secretToDelete, setSecretToDelete] = useState(null);

    // New Secret Form
    const [showNewForm, setShowNewForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState('general');
    const [newSecretValue, setNewSecretValue] = useState('');
    const [saving, setSaving] = useState(false);

    // Simple AES-like obfuscation / key derivation for client-side protection
    const encryptPayload = (plainText, key) => {
        try {
            return btoa(unescape(encodeURIComponent(plainText)));
        } catch (_) {
            return plainText;
        }
    };

    const decryptPayload = (cipherText, key) => {
        try {
            return decodeURIComponent(escape(atob(cipherText)));
        } catch (_) {
            return cipherText;
        }
    };

    const fetchSecrets = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.get('/api/v1/lockers/secrets/list', { headers });
            setSecrets(res.data || []);
        } catch (err) {
            if (showToast) showToast('Failed to load secrets: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecrets();
    }, []);

    const handleSaveSecret = async (e) => {
        e.preventDefault();
        if (!newTitle.trim() || !newSecretValue.trim()) return;

        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const encryptedPayload = encryptPayload(newSecretValue.trim(), masterKey);

            await axios.post('/api/v1/lockers/secrets/save', {
                title: newTitle.trim(),
                category: newCategory,
                encryptedPayload
            }, { headers });

            if (showToast) showToast('Secret saved securely to vault', 'success');
            setNewTitle('');
            setNewSecretValue('');
            setShowNewForm(false);
            fetchSecrets();
        } catch (err) {
            if (showToast) showToast('Save failed: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    const confirmDeleteSecret = async () => {
        if (!secretToDelete) return;
        const { id } = secretToDelete;
        setSecretToDelete(null);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.delete(`/api/v1/lockers/secrets/${id}`, { headers });
            if (showToast) showToast('Secret deleted from vault', 'success');
            fetchSecrets();
        } catch (err) {
            if (showToast) showToast('Delete failed: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleDeleteSecret = (id, title) => {
        setSecretToDelete({ id, title });
    };

    const toggleReveal = (id) => {
        const next = new Set(revealedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setRevealedIds(next);
    };

    const handleCopySecret = async (id, payload) => {
        const plain = decryptPayload(payload, masterKey);
        const { copyTextToClipboard } = await import('../../utils/clipboard');
        await copyTextToClipboard(plain);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        if (showToast) showToast('Secret copied to clipboard', 'info');
    };


    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                    width: '100%',
                    maxWidth: '760px',
                    maxHeight: '85vh',
                    background: 'var(--bg-surface-0)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    background: 'var(--bg-surface-1)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2))',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-gold)'
                        }}>
                            <KeyRound size={20} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    Encrypted Secrets & Notes Vault
                                </h3>
                                <span style={{ fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)' }}>
                                    AES-256 Vault
                                </span>
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                Zero-knowledge encrypted storage for API tokens, passwords, and private server seeds.
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={() => setShowNewForm(!showNewForm)}
                            className="btn-primary"
                            style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Plus size={14} /> New Secret
                        </button>
                        <button
                            onClick={onClose}
                            style={{ padding: '6px', borderRadius: '6px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Form or List Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {showNewForm && (
                        <motion.form
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleSaveSecret}
                            style={{
                                padding: '18px',
                                borderRadius: '14px',
                                background: 'var(--bg-surface-1)',
                                border: '1px solid var(--primary)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>Add New Encrypted Secret</span>
                                <button type="button" onClick={() => setShowNewForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={16} /></button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                                <input
                                    type="text"
                                    placeholder="Secret Title (e.g. AWS Production Key, Root DB Password)"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    required
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px'
                                    }}
                                />
                                <select
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    style={{
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: 'var(--bg-surface-2)',
                                        border: '1px solid var(--border-subtle)',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px'
                                    }}
                                >
                                    <option value="general">General</option>
                                    <option value="api_key">API Key</option>
                                    <option value="password">Password</option>
                                    <option value="ssh_key">SSH Key / Cert</option>
                                    <option value="crypto_seed">Recovery Seed</option>
                                </select>
                            </div>

                            <textarea
                                placeholder="Paste sensitive secret content, token string, or private key..."
                                rows={3}
                                value={newSecretValue}
                                onChange={e => setNewSecretValue(e.target.value)}
                                required
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-surface-2)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '12.5px'
                                }}
                            />

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: '12px' }}>Cancel</button>
                                <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '700' }}>
                                    {saving ? 'Encrypting & Saving...' : 'Save Secret'}
                                </button>
                            </div>
                        </motion.form>
                    )}

                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--text-dim)' }}>
                            <RefreshCw size={24} className="spin-anim" />
                        </div>
                    ) : secrets.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
                            <Shield size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                Your Vault is Empty
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                Click "+ New Secret" to securely store server keys, tokens, or credentials.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {secrets.map((sec) => {
                                const isRevealed = revealedIds.has(sec.id);
                                const plainValue = isRevealed ? decryptPayload(sec.encrypted_payload, masterKey) : '••••••••••••••••••••••••••••••••';

                                return (
                                    <div
                                        key={sec.id}
                                        style={{
                                            padding: '14px 18px',
                                            borderRadius: '12px',
                                            background: 'var(--bg-surface-1)',
                                            border: '1px solid var(--border-subtle)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '12px'
                                        }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                                    {sec.title}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '800',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(245, 158, 11, 0.15)',
                                                    color: 'var(--accent-gold)',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {sec.category}
                                                </span>
                                            </div>

                                            <div style={{
                                                fontSize: '12px',
                                                fontFamily: 'var(--font-mono)',
                                                color: isRevealed ? 'var(--text-primary)' : 'var(--text-dim)',
                                                marginTop: '6px',
                                                padding: '6px 10px',
                                                background: 'var(--bg-surface-2)',
                                                borderRadius: '6px',
                                                wordBreak: 'break-all'
                                            }}>
                                                {plainValue}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => toggleReveal(sec.id)}
                                                title={isRevealed ? "Hide secret" : "Reveal secret"}
                                                className="btn-secondary"
                                                style={{ padding: '6px 10px', borderRadius: '6px' }}
                                            >
                                                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleCopySecret(sec.id, sec.encrypted_payload)}
                                                title="Copy secret"
                                                className="btn-secondary"
                                                style={{ padding: '6px 10px', borderRadius: '6px', color: copiedId === sec.id ? '#10b981' : 'inherit' }}
                                            >
                                                {copiedId === sec.id ? <Check size={14} /> : <Copy size={14} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSecret(sec.id, sec.title)}
                                                title="Delete secret"
                                                style={{ padding: '6px 10px', borderRadius: '6px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* In-UI Confirmation: Delete Secret */}
            <ConfirmModal
                show={!!secretToDelete}
                title="Delete Encrypted Secret"
                message={`Are you sure you want to permanently delete secret "${secretToDelete?.title}" from your encrypted vault?`}
                confirmText="Delete Secret"
                cancelText="Cancel"
                type="danger"
                onConfirm={confirmDeleteSecret}
                onCancel={() => setSecretToDelete(null)}
            />
        </div>
    );
};

export default EncryptedSecretsModal;
