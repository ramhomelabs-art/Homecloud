import React from 'react';
import { Plus, Link2, Key, Copy, Edit, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { CountdownTimer } from './UiUtils';
import { copyTextToClipboard } from '../../utils/clipboard';

export default function ActiveSharesView({
    activeShares = [],
    setShowFolderPicker,
    revokeShare,
    setShareModal,
    showToast
}) {
    return (
        <motion.div key="ash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Secure Link Control</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Monitor and revoke active external sharing links</p>
                </div>
                <button 
                    className="btn-primary shadow-premium" 
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800' }} 
                    onClick={() => setShowFolderPicker(true)}
                >
                    <Plus size={16} /> Generate Upload Link
                </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                {activeShares.map(s => {
                    const isExpired = (s.expires_at && new Date(s.expires_at) < new Date()) || (s.max_views !== -1 && s.max_views != null && s.view_count >= s.max_views);
                    return (
                        <div 
                            key={s.token || s.id} 
                            className="st-card-wide" 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                ...(isExpired 
                                    ? { border: '1px solid rgba(248, 81, 73, 0.4)', background: 'rgba(248, 81, 73, 0.04)' } 
                                    : { border: '1px solid rgba(74, 222, 128, 0.3)', background: 'rgba(74, 222, 128, 0.03)' }
                                ) 
                            }}
                        >
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                <div style={{ width: '40px', height: '40px', background: isExpired ? 'rgba(248, 81, 73, 0.1)' : 'rgba(74, 222, 128, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Link2 size={20} color={isExpired ? '#f85149' : '#4ade80'} />
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <p style={{ fontWeight: '700', margin: 0, color: isExpired ? '#f85149' : '#4ade80' }}>
                                        {(s.path || '').split(/[/\\]/).pop() || 'Shared Resource'}
                                        {isExpired ? (
                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#f85149', color: 'var(--text-primary)', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>EXPIRED</span>
                                        ) : (
                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#4ade80', color: '#000', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>ACTIVE</span>
                                        )}
                                    </p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                                        {s.email_verification ? 'Email Required' : 'Public'} | Views: {String(s.view_count || 0)} / {(s.max_views === -1 || s.max_views == null) ? '∞' : String(s.max_views)}
                                        {s.type && <span style={{ marginLeft: '8px', padding: '1px 6px', background: s.type === 'upload' ? 'rgba(242,201,76,0.15)' : 'rgba(0,242,255,0.1)', border: `1px solid ${s.type === 'upload' ? 'rgba(242,201,76,0.4)' : 'rgba(0,242,255,0.3)'}`, borderRadius: '4px', color: s.type === 'upload' ? 'var(--accent-gold)' : 'var(--accent-cyan)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{s.type}</span>}
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                                {!isExpired && (
                                    <>
                                        <CountdownTimer expiry={s.expires_at} />
                                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#484f58' }}>
                                            <div>ID: {s.token || s.id}</div>
                                            <div>Exp: {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : 'Never'}</div>
                                        </div>
                                    </>
                                )}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {!isExpired && s.has_password && (
                                        <button 
                                            onClick={async () => {
                                                if (s.password) {
                                                    const success = await copyTextToClipboard(s.password);
                                                    if (success) {
                                                        showToast('Passkey copied!', 'success');
                                                    } else {
                                                        showToast('Failed to copy passkey', 'error');
                                                    }
                                                } else {
                                                    showToast('Legacy encrypted passkey. Please Edit to reset.', 'error');
                                                }
                                            }} 
                                            style={{ padding: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} 
                                            title="Copy Passkey"
                                        >
                                            <Key size={16} /> Copy Passkey
                                        </button>
                                    )}
                                    {!isExpired && (
                                        <>
                                            <button 
                                                onClick={async () => {
                                                    let portalPrefix = '/g/';
                                                    if (s.type === 'upload') portalPrefix = '/u/';
                                                    else if (!s.has_password && !s.email_verification && s.type !== 'exchange') portalPrefix = '/p/';
                                                    
                                                    const shareUrl = s.url || `${window.location.protocol}//${window.location.host}${portalPrefix}${s.token || s.id}`;
                                                    const success = await copyTextToClipboard(shareUrl);
                                                    if (success) {
                                                        showToast('Link copied to clipboard', 'success');
                                                    } else {
                                                        showToast('Failed to copy link', 'error');
                                                    }
                                                }} 
                                                style={{ padding: '8px 16px', background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '12px' }}
                                            >
                                                <Copy size={16} /> Copy Link
                                            </button>
                                            <button 
                                                onClick={() => setShareModal(s)} 
                                                style={{ padding: '8px', background: 'rgba(242, 201, 76, 0.1)', border: '1px solid rgba(242, 201, 76, 0.3)', borderRadius: '8px', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <Edit size={16} /> Edit
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        onClick={() => revokeShare(s.token || s.id)} 
                                        style={{ padding: '8px', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <Trash2 size={16} /> Revoke
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {activeShares.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px', opacity: 0.3 }}>
                        <Link2 size={48} />
                        <p>No active shares found</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
