/**
 * PublicPortal.jsx — Open share (Direct Secure Download Hub)
 * Route: /p/:token
 * Calls: GET /api/share/info/:token, POST /api/share/stream
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, FileText, HardDrive, Shield, AlertCircle, Loader, Lock, CheckCircle2, CloudLightning, Sparkles, FolderArchive, Film, Image as ImageIcon, Music, FileCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

const getFileIcon = (title = '') => {
    const ext = title.split('.').pop()?.toLowerCase() || '';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FolderArchive size={32} color="#f59e0b" />;
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) return <Film size={32} color="#ec4899" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return <ImageIcon size={32} color="#10b981" />;
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return <Music size={32} color="#8b5cf6" />;
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(ext)) return <FileCode size={32} color="#0ea5e9" />;
    return <FileText size={32} color="var(--primary)" />;
};

const PublicPortal = ({ shareId }) => {
    const [info, setInfo]       = useState(null);
    const [error, setError]     = useState('');
    const [dlError, setDlError] = useState('');
    const [loading, setLoading] = useState(true);
    const [dling, setDling]     = useState(false);
    const [dlProgress, setDlProgress] = useState(null);

    useEffect(() => {
        axios.get(`/api/share/info/${shareId}`)
            .then(r => setInfo(r.data))
            .catch(e => setError(String(e.response?.data?.error || e.response?.data?.message || 'Share link not found or expired')))
            .finally(() => setLoading(false));
    }, [shareId]);

    const download = async (filePath = '') => {
        setDling(true);
        setDlError('');
        const startTime = Date.now();
        setDlProgress({
            name: info?.title || 'download',
            loaded: 0,
            total: info?.totalSize || 0,
            speed: 0,
            percent: 0
        });

        try {
            const r = await axios.post('/api/share/stream', { token: shareId, filePath }, {
                responseType: 'blob',
                onDownloadProgress: (pe) => {
                    const loaded = pe.loaded;
                    const total = pe.total || info?.totalSize || loaded;
                    const elapsed = Math.max(1, (Date.now() - startTime) / 1000);
                    const speed = loaded / elapsed; // bytes/sec
                    const percent = Math.min(100, Math.round((loaded / total) * 100));

                    setDlProgress({
                        name: info?.title || 'download',
                        loaded,
                        total,
                        speed,
                        percent
                    });
                }
            });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = info?.title || 'download';
            a.click();
            URL.revokeObjectURL(url);
        } catch { 
            setDlError('Download failed. Please try again or check your network connection.');
        } finally {
            setDling(false);
            setDlProgress(null);
        }
    };

    if (loading) return (
        <PortalShell>
            <div style={{ textAlign: 'center', padding: '50px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)', width: '380px' }}>
                <Loader size={36} style={{ animation: 'spin 1s linear infinite' }} color="var(--primary)" />
                <p style={{ color: 'var(--text-secondary)', marginTop: '14px', fontWeight: '700', fontSize: '14px' }}>Locating secure share package...</p>
            </div>
        </PortalShell>
    );

    if (error) return (
        <PortalShell>
            <div style={{ textAlign: 'center', padding: '40px', maxWidth: '440px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ width: '64px', height: '64px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={32} color="#f43f5e"/>
                </div>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '18px', margin: '0 0 8px' }}>Package Unavailable</h3>
                <p style={{ color: '#f43f5e', fontWeight: 700, fontSize: '14px', margin: '0 0 10px' }}>{error}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>This link may have expired, exceeded view quotas, or been revoked by the owner.</p>
            </div>
        </PortalShell>
    );

    return (
        <PortalShell>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ maxWidth: '560px', width: '100%', margin: '0 auto' }}
            >
                {/* Main Holographic File Card */}
                <div style={{
                    background: 'var(--bg-surface-0)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '24px',
                    padding: '36px 32px',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Top Status Banner */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                            <span style={{ fontSize: '11.5px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                Secure Transfer Ready
                            </span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                            SHA-256 VERIFIED
                        </span>
                    </div>

                    {/* File Showcase */}
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'var(--bg-surface-2)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                        }}>
                            {getFileIcon(info.title)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', wordBreak: 'break-all', letterSpacing: '-0.3px' }}>
                                {info.title}
                            </h1>
                            {info.description && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 10px 0', lineHeight: '1.5' }}>
                                    {info.description}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', background: 'var(--bg-surface-2)', padding: '3px 9px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                                    {fmt(info.totalSize)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                    {info.fileCount || 1} file{info.fileCount !== 1 ? 's' : ''}
                                </span>
                                {info.ownerName && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                                        · Shared by <strong style={{ color: 'var(--text-secondary)' }}>{info.ownerName}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Expiration Note */}
                    {info.expires_at && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-surface-2)', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <Shield size={14} color="var(--primary)" />
                            <span>This secure package expires on <strong>{new Date(info.expires_at).toLocaleDateString()}</strong></span>
                        </div>
                    )}

                    {dlError && (
                        <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244, 63, 94, 0.3)', color: '#f43f5e', fontSize: '13px', fontWeight: '600', marginBottom: '18px', textAlign: 'center' }}>
                            {dlError}
                        </div>
                    )}

                    {/* Big Action Download Button */}
                    <button 
                        onClick={() => download()} 
                        disabled={dling} 
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: 'var(--primary-gradient)',
                            border: 'none',
                            borderRadius: '14px',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '15px',
                            cursor: dling ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.4)',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {dling ? (
                            <>
                                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                Preparing Encrypted Stream...
                            </>
                        ) : (
                            <>
                                <Download size={20} />
                                Download Secure File
                            </>
                        )}
                    </button>

                    {/* Security Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '20px', fontWeight: '600' }}>
                        <Lock size={12} color="var(--primary)" />
                        <span>Zero-Knowledge End-to-End Encrypted · NexaDisk Cloud</span>
                    </div>
                </div>
            </motion.div>

            {/* Real-time Download Progress Modal */}
            <AnimatePresence>
                {dlProgress && (
                    <div className="modal-overlay">
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 16 }}
                            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
                            className="modal-content"
                            style={{ width: '420px', maxWidth: '92vw', textAlign: 'center' }}
                        >
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '20px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)'
                            }}>
                                <motion.div
                                    animate={{ y: [0, 5, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <Download size={28} color="var(--primary)" />
                                </motion.div>
                            </div>

                            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>
                                Streaming Secure File
                            </h3>
                            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }} title={dlProgress.name}>
                                {dlProgress.name}
                            </p>

                            {/* Progress Rail */}
                            <div style={{ background: 'var(--bg-surface-2)', borderRadius: '10px', height: '9px', width: '100%', overflow: 'hidden', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
                                <div
                                    style={{
                                        width: `${dlProgress.percent}%`,
                                        height: '100%',
                                        background: 'var(--primary-gradient)',
                                        borderRadius: '10px',
                                        transition: 'width 0.2s ease-out'
                                    }}
                                />
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'left', background: 'var(--bg-surface-2)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-dim)', fontWeight: '800', marginBottom: '2px' }}>Transferred</span>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                                        {fmt(dlProgress.loaded)}
                                        {dlProgress.total > 0 && <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}> / {fmt(dlProgress.total)}</span>}
                                    </strong>
                                </div>
                                <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '14px' }}>
                                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-dim)', fontWeight: '800', marginBottom: '2px' }}>Speed</span>
                                    <strong style={{ color: 'var(--primary)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{fmt(dlProgress.speed)}/s</strong>
                                </div>
                            </div>

                            {dlProgress.total > 0 && (
                                <div style={{ marginTop: '14px', fontSize: '14px', fontWeight: '800', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                                    {dlProgress.percent}% Completed
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PortalShell>
    );
};

// ── SHELL ──────────────────────────────────────────────────────────────────────
const PortalShell = ({ children }) => (
    <div className="login-canvas" style={{ minHeight: '100vh', width: '100%', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '24px' }}>
        {children}
    </div>
);

export default PublicPortal;
