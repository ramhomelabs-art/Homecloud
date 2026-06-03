import React, { useState } from 'react';
import axios from 'axios';
import { RefreshCw, Copy } from 'lucide-react';

const API_BASE = '/api';

const ShareModal = ({ path, agentId, onClose, onCreated, showToast }) => {
    if (!path) return null;
    const isEdit = typeof path === 'object';
    const [shr, setShr] = useState(null);
    const [email, setEmail] = useState(isEdit ? (path.email || '') : '');
    const [password, setPassword] = useState('');
    const [maxViews, setMaxViews] = useState(isEdit ? path.max_views : 1);
    const [permissions, setPermissions] = useState(isEdit ? (path.permissions || 'Full Access') : 'Full Access');

    const handleShare = async (e) => {
        e.preventDefault();
        try {
            if (isEdit) {
                await axios.put(`${API_BASE}/share/${path.id}`, {
                    password,
                    email,
                    expiryHours: e.target.expiry.value,
                    maxViews: parseInt(maxViews) || 1,
                    permissions
                });
                onCreated();
                onClose();
            } else {
                const res = await axios.post(`${API_BASE}/share/create`, {
                    path,
                    agentId,
                    password,
                    email,
                    expiryHours: e.target.expiry.value,
                    maxViews: parseInt(maxViews) || 1,
                    permissions
                });
                setShr(res.data);
                onCreated();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass">
                <h3>{isEdit ? 'Update Secure Share' : 'Secure Share Gate'}</h3>
                <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '20px' }}>Sharing: {isEdit ? path.path : path}</p>
                {!shr ? (
                    <>
                        <form onSubmit={handleShare}>
                            <div style={{ marginBottom: '16px' }}>
                                <label className="m-label">Recipient Email</label>
                                <input name="email" placeholder="Optional" className="m-input" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label className="m-label">Passkey Protection</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        name="password"
                                        type="text"
                                        placeholder={isEdit ? "Set New Passkey" : "Optional"}
                                        className="m-input"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <div
                                        onClick={() => setPassword(Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8))}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-gold)', cursor: 'pointer' }}
                                        title="Generate Random Passkey"
                                    >
                                        <RefreshCw size={14} />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="m-label">Expiration</label>
                                    <select name="expiry" className="m-input" defaultValue="24">
                                        <option value="1">1 Hour</option>
                                        <option value="24">24 Hours</option>
                                        <option value="168">7 Days</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="m-label">Max Views</label>
                                    <input name="maxViews" type="number" min="1" placeholder="Limits opens" className="m-input" value={maxViews} onChange={e => setMaxViews(e.target.value)} />
                                </div>
                            </div>

                            <button className="auth-submit-btn" style={{ fontWeight: 'bold' }}>{isEdit ? 'Update Link Parameters' : 'Generate Secure Link'}</button>
                            <button type="button" onClick={onClose} style={{ marginTop: '12px', background: 'transparent', color: '#f85149', border: 'none', width: '100%', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                        </form>
                    </>
                ) : (
                    <div>
                        <h3 style={{ marginBottom: '24px', textAlign: 'center' }}>Secure Share Gate</h3>

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#8b949e' }}>Share URL</span>
                                <button
                                    onClick={() => {
                                        const textToCopy = shr.url;
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                            navigator.clipboard.writeText(textToCopy).then(() => {
                                                showToast('Link copied to clipboard', 'success');
                                            }).catch(() => {
                                                const textArea = document.createElement("textarea");
                                                textArea.value = textToCopy;
                                                document.body.appendChild(textArea);
                                                textArea.select();
                                                try {
                                                    document.execCommand('copy');
                                                    showToast('Link copied (Legacy)', 'success');
                                                } catch (err) {
                                                    showToast('Copy failed. Please manually select the URL.', 'error');
                                                }
                                                document.body.removeChild(textArea);
                                            });
                                        } else {
                                            const textArea = document.createElement("textarea");
                                            textArea.value = textToCopy;
                                            document.body.appendChild(textArea);
                                            textArea.select();
                                            try {
                                                document.execCommand('copy');
                                                showToast('Link copied (Legacy)', 'success');
                                            } catch (err) {
                                                showToast('Copy failed. Please manually select the URL.', 'error');
                                            }
                                            document.body.removeChild(textArea);
                                        }
                                    }}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <div style={{ background: 'rgba(0,0,0,0.5)', padding: '12px', borderRadius: '8px', border: '1px solid var(--accent-cyan)', color: 'var(--accent-cyan)', fontSize: '13px', wordBreak: 'break-all' }}>
                                {shr.url}
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontSize: '12px', fontWeight: '600', color: '#8b949e' }}>Credentials</span>
                                <button
                                    onClick={() => {
                                        const text = `Secure Share Link: ${shr.url}\nEmail: ${shr.credentials?.email || 'N/A'}\nPasskey: ${shr.credentials?.passkey || 'N/A'}`;
                                        navigator.clipboard.writeText(text);
                                        showToast('All credentials copied', 'success');
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        color: 'var(--accent-gold)', fontSize: '12px', fontWeight: 'bold'
                                    }}
                                >
                                    <Copy size={14} /> Copy All
                                </button>
                            </div>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>Email:</span>
                                    <span style={{ fontWeight: '600' }}>{shr.credentials?.email || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>None</span>}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#8b949e' }}>Passkey:</span>
                                    <span style={{ fontWeight: '600' }}>{shr.credentials?.passkey || <span style={{ fontStyle: 'italic', opacity: 0.5 }}>None</span>}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="auth-submit-btn"
                            style={{ background: 'var(--accent-gold)', color: '#000', fontWeight: 'bold' }}
                        >
                            Finish
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShareModal;
