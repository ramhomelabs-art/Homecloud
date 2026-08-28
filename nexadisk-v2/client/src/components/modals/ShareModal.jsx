import React, { useState } from 'react';
import axios from 'axios';
import { Link2, Shield, Clock, Eye, Mail, Key, Copy, Check, RefreshCw, X } from 'lucide-react';

const API = '/api/v1/shares';

const EXPIRY_OPTIONS = [
    { label: '1 Hour',   value: 1 },
    { label: '6 Hours',  value: 6 },
    { label: '24 Hours', value: 24 },
    { label: '3 Days',   value: 72 },
    { label: '7 Days',   value: 168 },
    { label: '30 Days',  value: 720 },
];

const ShareModal = ({ path: filePath, onClose, onCreated, showToast, forceUploadOnly }) => {
    if (!filePath) return null;

    const isEdit = typeof filePath === 'object' && filePath !== null;
    const targetPath = isEdit ? filePath.path : filePath;
    const existingToken = isEdit ? filePath.token : null;
    const existingType = isEdit ? filePath.type : (forceUploadOnly ? 'upload' : 'download');

    // Form state
    const [type, setType] = useState(existingType);  // download | upload | exchange
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [expiryHours, setExpiryHours] = useState(24);
    const [maxViews, setMaxViews] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Success state
    const [created, setCreated] = useState(null); // { token, url, type, expiresAt }
    const [copied, setCopied] = useState(false);

    const fileName = String(targetPath || '').split(/[/\\]/).pop() || 'Resource';

    const handleGenerate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let res;
            if (isEdit) {
                res = await axios.put(`${API}/${existingToken}`, {
                    password: password || undefined,
                    email: email || undefined,
                    expiryHours,
                    maxViews: maxViews ? parseInt(maxViews) : undefined,
                });
                res.data = { token: existingToken, type: existingType, expiresAt: new Date(Date.now() + expiryHours * 3600 * 1000).toISOString() };
            } else {
                res = await axios.post(`${API}/create`, {
                    path: targetPath,
                    type,
                    password: password || undefined,
                    email: email || undefined,
                    expiryHours,
                    maxViews: maxViews ? parseInt(maxViews) : undefined,
                });
            }

            const { token, type: shareType, expiresAt } = res.data;

            // Build the portal URL based on type — use window.location.origin so it always works
            let portalRoute;
            if (shareType === 'upload') portalRoute = `/u/${token}`;
            else if (password || email) portalRoute = `/g/${token}`;
            else portalRoute = `/p/${token}`;

            const url = `${window.location.origin}${portalRoute}`;

            setCreated({ token, url, type: shareType, expiresAt });
            if (onCreated) onCreated();
            showToast(isEdit ? 'Share link updated!' : 'Share link created!', 'success');
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Failed to process share';
            showToast('Error: ' + msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const copyUrl = () => {
        navigator.clipboard.writeText(created.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast('Link copied!', 'success');
    };

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        setPassword(Array.from({length: 10}, () => chars[Math.floor(Math.random() * chars.length)]).join(''));
    };

    // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
    if (created) {
        return (
            <div style={styles.overlay} onClick={onClose}>
                <div style={styles.modal} onClick={e => e.stopPropagation()}>
                    <div style={styles.header}>
                        <div style={styles.iconWrap}>
                            <Link2 size={24} color="var(--accent-gold)" />
                        </div>
                        <h2 style={styles.title}>Link Ready</h2>
                        <p style={styles.sub}>Share this link with your recipient</p>
                    </div>

                    {/* URL Box */}
                    <div style={styles.urlBox}>
                        <span style={styles.urlText}>{created.url}</span>
                        <button onClick={copyUrl} style={styles.copyBtn} title="Copy">
                            {copied ? <Check size={16} color="#4ade80" /> : <Copy size={16} />}
                        </button>
                    </div>

                    {/* Details */}
                    <div style={styles.detailsGrid}>
                        <div style={styles.detail}>
                            <span style={styles.detailLabel}>TYPE</span>
                            <span style={{ ...styles.detailValue, textTransform: 'uppercase', color: created.type === 'upload' ? 'var(--accent-gold)' : 'var(--accent-cyan)' }}>{created.type}</span>
                        </div>
                        <div style={styles.detail}>
                            <span style={styles.detailLabel}>TOKEN</span>
                            <span style={styles.detailValue}>{created.token}</span>
                        </div>
                        <div style={styles.detail}>
                            <span style={styles.detailLabel}>EXPIRES</span>
                            <span style={styles.detailValue}>{new Date(created.expiresAt).toLocaleString()}</span>
                        </div>
                        {password && (
                            <div style={styles.detail}>
                                <span style={styles.detailLabel}>PASSKEY</span>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                    <span style={{ ...styles.detailValue, fontFamily: 'monospace', color: '#f2c94c' }}>{password}</span>
                                    <button onClick={() => {
                                        navigator.clipboard.writeText(password);
                                        showToast('Passkey copied!', 'success');
                                    }} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 0 }} title="Copy Password">
                                        <Copy size={13} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {email && (
                            <div style={styles.detail}>
                                <span style={styles.detailLabel}>EMAIL AUTH</span>
                                <span style={styles.detailValue}>Required</span>
                            </div>
                        )}
                    </div>

                    <button onClick={onClose} style={styles.finishBtn}>Done</button>
                </div>
            </div>
        );
    }

    // ── CREATE FORM ───────────────────────────────────────────────────────────
    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <div style={styles.iconWrap}>
                        <Shield size={24} color="var(--accent-gold)" />
                    </div>
                    <h2 style={styles.title}>Create Share Link</h2>
                    <p style={styles.sub} title={filePath}>📁 {fileName}</p>
                    <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
                </div>

                <form onSubmit={handleGenerate}>
                    {/* Share Type */}
                    <div style={styles.field}>
                        <label style={styles.label}>Share Type</label>
                        <div style={styles.typeRow}>
                            {[
                                { v: 'download', label: 'Download', icon: '⬇️' },
                                { v: 'upload',   label: 'Upload',   icon: '⬆️' },
                                { v: 'exchange', label: 'Both',     icon: '↕️' },
                            ].map(opt => (
                                <button key={opt.v} type="button"
                                    onClick={() => !forceUploadOnly && setType(opt.v)}
                                    style={{
                                        ...styles.typeBtn,
                                        ...(type === opt.v ? styles.typeBtnActive : {}),
                                        ...(forceUploadOnly && type !== opt.v ? { opacity: 0.3, cursor: 'not-allowed' } : {})
                                    }}
                                    disabled={forceUploadOnly && type !== opt.v}>
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Expiry */}
                    <div style={styles.field}>
                        <label style={styles.label}><Clock size={13} style={{marginRight:4}}/> Expiry</label>
                        <select value={expiryHours} onChange={e => setExpiryHours(parseInt(e.target.value))} style={styles.input}>
                            {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* Max Views */}
                    <div style={styles.field}>
                        <label style={styles.label}><Eye size={13} style={{marginRight:4}}/> Max Views (blank = unlimited)</label>
                        <input
                            type="number" min="1" placeholder="Unlimited"
                            value={maxViews} onChange={e => setMaxViews(e.target.value)}
                            style={styles.input}
                        />
                    </div>

                    {/* Password */}
                    <div style={styles.field}>
                        <label style={styles.label}><Key size={13} style={{marginRight:4}}/> Passkey Protection (optional)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text" placeholder="Leave blank for no password"
                                value={password} onChange={e => setPassword(e.target.value)}
                                style={{ ...styles.input, flex: 1 }}
                            />
                            <button type="button" onClick={generatePassword} style={styles.iconBtn} title="Auto-generate">
                                <RefreshCw size={14} />
                            </button>
                        </div>
                    </div>


                    <button type="submit" disabled={submitting} style={{
                        ...styles.finishBtn,
                        opacity: submitting ? 0.6 : 1,
                        cursor: submitting ? 'wait' : 'pointer'
                    }}>
                        {submitting ? (isEdit ? 'Updating...' : 'Generating...') : (isEdit ? 'Update Secure Link' : 'Generate Secure Link')}
                    </button>

                    <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
                </form>
            </div>
        </div>
    );
};

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = {
    overlay: {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(4px)',
    },
    modal: {
        background: 'var(--bg-card, #161b22)',
        border: '1px solid var(--border-color, #30363d)',
        borderRadius: '20px',
        width: '480px', maxWidth: '95vw',
        padding: '32px',
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    },
    header: {
        textAlign: 'center', marginBottom: '28px',
    },
    iconWrap: {
        width: '52px', height: '52px',
        background: 'rgba(242,201,76,0.1)',
        border: '1px solid rgba(242,201,76,0.3)',
        borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
    },
    title: {
        fontSize: '20px', fontWeight: 800, margin: '0 0 6px', color: '#e6edf3',
    },
    sub: {
        fontSize: '12px', color: '#8b949e', margin: 0,
        maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        display: 'inline-block',
    },
    closeBtn: {
        position: 'absolute', top: '20px', right: '20px',
        background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: '4px',
    },
    field: { marginBottom: '16px' },
    label: {
        display: 'flex', alignItems: 'center',
        fontSize: '11px', fontWeight: 600, color: '#8b949e',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
    },
    input: {
        width: '100%', padding: '10px 14px', boxSizing: 'border-box',
        background: 'rgba(22,27,34,0.8)', border: '1px solid #30363d',
        borderRadius: '10px', color: '#e6edf3', fontSize: '13px', outline: 'none',
    },
    typeRow: { display: 'flex', gap: '8px' },
    typeBtn: {
        flex: 1, padding: '8px', fontSize: '12px', fontWeight: 600,
        background: 'transparent', border: '1px solid #30363d',
        borderRadius: '8px', color: '#8b949e', cursor: 'pointer',
    },
    typeBtnActive: {
        background: 'rgba(242,201,76,0.1)', border: '1px solid rgba(242,201,76,0.5)',
        color: 'var(--accent-gold, #f2c94c)',
    },
    iconBtn: {
        padding: '10px 12px', background: 'rgba(22,27,34,0.8)',
        border: '1px solid #30363d', borderRadius: '10px',
        color: '#8b949e', cursor: 'pointer',
    },
    finishBtn: {
        width: '100%', padding: '14px',
        background: 'linear-gradient(135deg, #f2c94c, #f2994a)',
        border: 'none', borderRadius: '12px',
        color: '#0d1117', fontWeight: 800, fontSize: '14px',
        cursor: 'pointer', marginTop: '8px',
    },
    cancelBtn: {
        width: '100%', padding: '10px',
        background: 'transparent', border: 'none',
        color: '#8b949e', cursor: 'pointer', fontSize: '13px', marginTop: '8px',
    },
    // Success screen
    urlBox: {
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.2)',
        borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
    },
    urlText: {
        flex: 1, fontSize: '13px', color: 'var(--accent-cyan, #00f2ff)',
        fontFamily: 'monospace', wordBreak: 'break-all',
    },
    copyBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#8b949e', padding: '4px', flexShrink: 0,
    },
    detailsGrid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', marginBottom: '24px',
    },
    detail: {
        background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
        padding: '10px 14px',
    },
    detailLabel: {
        display: 'block', fontSize: '9px', fontWeight: 700,
        color: '#484f58', letterSpacing: '0.1em', marginBottom: '4px',
    },
    detailValue: {
        display: 'block', fontSize: '13px', fontWeight: 600, color: '#e6edf3',
    },
};

export default ShareModal;
