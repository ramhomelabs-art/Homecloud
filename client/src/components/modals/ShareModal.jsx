import React, { useState } from 'react';
import axios from 'axios';
import { Link2, Shield, Clock, Eye, Mail, Key, Copy, Check, RefreshCw, X } from 'lucide-react';
import { copyTextToClipboard } from '../../utils/clipboard';

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

    const copyUrl = async () => {
        const success = await copyTextToClipboard(created.url);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            showToast('Link copied!', 'success');
        } else {
            showToast('Failed to copy link', 'error');
        }
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
                                    <button onClick={async () => {
                                        const success = await copyTextToClipboard(password);
                                        if (success) {
                                            showToast('Passkey copied!', 'success');
                                        } else {
                                            showToast('Failed to copy passkey', 'error');
                                        }
                                    }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }} title="Copy Password">
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
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 7, 16, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        padding: '20px',
    },
    modal: {
        background: 'var(--bg-surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '20px',
        width: '460px',
        maxWidth: '95vw',
        padding: '30px',
        position: 'relative',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
        color: 'var(--text-primary)',
    },
    header: {
        textAlign: 'center',
        marginBottom: '24px',
    },
    iconWrap: {
        width: '54px',
        height: '54px',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 14px',
        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)',
    },
    title: {
        fontSize: '22px',
        fontWeight: 900,
        margin: '0 0 6px',
        color: 'var(--text-primary)',
        letterSpacing: '-0.3px',
    },
    sub: {
        fontSize: '13px',
        color: 'var(--text-secondary)',
        margin: 0,
        maxWidth: '320px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'inline-block',
        fontFamily: 'var(--font-mono)',
    },
    closeBtn: {
        position: 'absolute',
        top: '18px',
        right: '18px',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        padding: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    field: {
        marginBottom: '16px',
    },
    label: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '11px',
        fontWeight: 800,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '6px',
    },
    input: {
        width: '100%',
        padding: '11px 14px',
        boxSizing: 'border-box',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        color: 'var(--text-primary)',
        fontSize: '13.5px',
        outline: 'none',
        transition: 'all 0.15s ease',
    },
    typeRow: {
        display: 'flex',
        gap: '8px',
        background: 'var(--bg-surface-2)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
    },
    typeBtn: {
        flex: 1,
        padding: '8px 10px',
        fontSize: '12.5px',
        fontWeight: 700,
        background: 'transparent',
        border: 'none',
        borderRadius: '7px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
    },
    typeBtnActive: {
        background: 'var(--primary-gradient)',
        color: '#ffffff',
        boxShadow: '0 3px 10px rgba(79, 70, 229, 0.35)',
        fontWeight: 800,
    },
    iconBtn: {
        padding: '10px 14px',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    finishBtn: {
        width: '100%',
        padding: '13px',
        background: 'var(--primary-gradient)',
        border: 'none',
        borderRadius: '12px',
        color: '#ffffff',
        fontWeight: 800,
        fontSize: '14px',
        cursor: 'pointer',
        marginTop: '10px',
        boxShadow: '0 6px 20px rgba(79, 70, 229, 0.35)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    },
    cancelBtn: {
        width: '100%',
        padding: '10px',
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 700,
        marginTop: '6px',
        transition: 'color 0.15s ease',
    },
    // Success screen
    urlBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--bg-surface-2)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '20px',
    },
    urlText: {
        flex: 1,
        fontSize: '13px',
        color: 'var(--primary)',
        fontFamily: 'var(--font-mono)',
        wordBreak: 'break-all',
        fontWeight: 600,
    },
    copyBtn: {
        background: 'var(--bg-surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        padding: '6px 8px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
    },
    detailsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '24px',
    },
    detail: {
        background: 'var(--bg-surface-2)',
        borderRadius: '10px',
        padding: '10px 14px',
        border: '1px solid var(--border-subtle)',
    },
    detailLabel: {
        display: 'block',
        fontSize: '10px',
        fontWeight: 800,
        color: 'var(--text-dim)',
        letterSpacing: '0.08em',
        marginBottom: '4px',
    },
    detailValue: {
        display: 'block',
        fontSize: '13px',
        fontWeight: 700,
        color: 'var(--text-primary)',
    },
};

export default ShareModal;
