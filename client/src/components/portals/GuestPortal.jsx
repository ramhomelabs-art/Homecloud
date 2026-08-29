/**
 * GuestPortal.jsx — Protected share (password or email OTP)
 * Route: /g/:token
 * Calls: GET /api/share/info/:token, POST /api/share/auth/:token,
 *        GET /api/share/files/:token, POST /api/share/stream
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Folder, File, Download, Key, Mail, HardDrive,
    ArrowLeft, LayoutGrid, LayoutList, Search, ShieldCheck,
    AlertCircle, Loader, ChevronRight, Lock
} from 'lucide-react';
import MediaPreviewModal from '../modals/MediaPreviewModal';

const getCleanPortalTitle = (rawTitle, rawPath) => {
    const candidate = rawTitle || rawPath || '';
    if (!candidate) return 'Shared Item';
    if (candidate.includes('\\') || candidate.includes('/')) {
        const parts = candidate.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean);
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
    }
    return candidate;
};

const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

const EXT_ICONS = {
    img: ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','tif'],
    vid: ['mp4','mkv','avi','mov','webm','flv','wmv'],
    aud: ['mp3','wav','flac','aac','ogg','m4a','wma','opus'],
    doc: [
        'pdf','doc','docx','txt','text','md','markdown','xls','xlsx','ppt','pptx',
        'yml','yaml','json','json5','jsonc','toml','xml','csv','tsv','ini','conf','config','cfg','cnf',
        'env','properties','desktop','repo','list','rules','service','timer','mount','socket',
        'sh','bash','zsh','fish','ps1','bat','cmd','py','js','jsx','ts','tsx','c','cpp','h','hpp','cs',
        'java','go','rs','kt','swift','dart','rb','php','lua','sql','css','scss','html','htm','dockerfile',
        'makefile','vagrantfile','lock','log'
    ],
    arc: ['zip','tar','gz','rar','7z','bz2','xz','tgz'],
};
const getColor = (ext) => {
    if (EXT_ICONS.img.includes(ext)) return '#f78166';
    if (EXT_ICONS.vid.includes(ext)) return '#d2a8ff';
    if (EXT_ICONS.aud.includes(ext)) return '#ffa657';
    if (EXT_ICONS.doc.includes(ext)) return '#79c0ff';
    if (EXT_ICONS.arc.includes(ext)) return '#f2c94c';
    return '#8b949e';
};

const GuestPortal = ({ shareId, showToast }) => {
    const [info, setInfo]         = useState(null);
    const [infoErr, setInfoErr]   = useState('');
    const [loading, setLoading]   = useState(true);

    // Auth state
    const [authed, setAuthed]     = useState(false);
    const [step, setStep]         = useState('idle'); // idle | password | otp_email | otp_code
    const [password, setPassword] = useState('');
    const [email, setEmail]       = useState('');
    const [otp, setOtp]           = useState('');
    const [authErr, setAuthErr]   = useState('');
    const [submitting, setSubmitting] = useState(false);

    // File explorer state
    const [files, setFiles]       = useState([]);
    const [curPath, setCurPath]   = useState('');
    const [pathStack, setPathStack] = useState([]);
    const [filesLoading, setFilesLoading] = useState(false);
    const [viewMode, setViewMode] = useState('grid');
    const [search, setSearch]     = useState('');
    const [downloading, setDownloading] = useState(false);
    const [dlProgress, setDlProgress]   = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null);

    // 1. Load share metadata
    useEffect(() => {
        axios.get(`/api/share/info/${shareId}`)
            .then(r => {
                setInfo(r.data);
                if (!r.data.passwordRequired && !r.data.emailRequired) {
                    // Open access even on /g/ — just authorize
                    localStorage.setItem('guestToken', r.data.token);
                    // Set authentication cookie for share access
                    document.cookie = `share_auth_${shareId}=true; path=/; SameSite=Strict`;
                    setAuthed(true);
                    setStep('authorized');
                } else if (r.data.passwordRequired) {
                    setStep('password');
                } else if (r.data.emailRequired) {
                    setStep('otp_email');
                }
            })
            .catch(e => setInfoErr(String(e.response?.data?.error || e.response?.data?.message || 'Share not found or expired')))
            .finally(() => setLoading(false));
    }, [shareId]);

    // 2. Load files when authed
    useEffect(() => {
        if (authed) loadFiles('');
    }, [authed]);

    // 3. Idle Session Auto-Timeout (15 minutes inactivity watchdog)
    useEffect(() => {
        if (!authed) return;
        let idleTimer = null;
        const IDLE_LIMIT = 15 * 60 * 1000; // 15 minutes

        const handleTimeout = () => {
            localStorage.removeItem('guestToken');
            document.cookie = `share_auth_${shareId}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            setAuthed(false);
            if (info?.passwordRequired) {
                setStep('password');
            } else if (info?.emailRequired) {
                setStep('otp_email');
            } else {
                setStep('idle');
            }
            setAuthErr('Session expired due to inactivity. Please authenticate to continue.');
            if (showToast) showToast('Session expired due to inactivity.', 'warning');
        };

        const resetTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(handleTimeout, IDLE_LIMIT);
        };

        resetTimer();

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
        events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

        return () => {
            if (idleTimer) clearTimeout(idleTimer);
            events.forEach(e => window.removeEventListener(e, resetTimer));
        };
    }, [authed, shareId, info, showToast]);

    const loadFiles = async (subPath) => {
        setFilesLoading(true);
        try {
            const headers = {};
            const guestTok = localStorage.getItem('guestToken');
            if (guestTok) headers['Authorization'] = `Bearer ${guestTok}`;
            const r = await axios.get(`/api/share/files/${shareId}`, { params: { path: subPath }, headers });
            setFiles(r.data);
            setCurPath(subPath);
        } catch (e) {
            setFiles([]);
        } finally {
            setFilesLoading(false);
        }
    };

    // ── ACTIONS ────────────────────────────────────────────────────────────────
    const navigate = (item) => {
        if (!item.isDirectory) {
            const fileNameLower = (item.name || '').toLowerCase();
            const ext = (item.extension || fileNameLower.split('.').pop() || '').toLowerCase();
            let type = 'other';
            if (ext === 'pdf') type = 'pdf';
            else if (EXT_ICONS.img.includes(ext)) type = 'image';
            else if (EXT_ICONS.vid.includes(ext)) type = 'video';
            else if (EXT_ICONS.aud.includes(ext)) type = 'audio';
            else if (EXT_ICONS.doc.includes(ext) || fileNameLower.startsWith('.') || !ext) type = 'text';

            if (type !== 'other') {
                setPreviewMedia({ ...item, type });
            } else {
                downloadItem(item);
            }
            return;
        }
        setPathStack(s => [...s, curPath]);
        loadFiles(item.path);
    };

    const goBack = () => {
        const prev = pathStack[pathStack.length - 1] || '';
        setPathStack(s => s.slice(0, -1));
        loadFiles(prev);
    };

    const downloadItem = async (item) => {
        setDownloading(true);
        const startTime = Date.now();
        const dlName = item.name + (item.isDirectory ? '.zip' : '');
        setDlProgress({
            name: dlName,
            loaded: 0,
            total: 0,
            speed: 0,
            percent: 0
        });

        try {
            const r = await axios.post('/api/share/stream', { token: shareId, filePath: item.path || '' }, {
                responseType: 'blob',
                onDownloadProgress: (progressEvent) => {
                    const loaded = progressEvent.loaded || 0;
                    const total = progressEvent.total || 0;
                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = elapsed > 0 ? (loaded / elapsed) : 0;
                    const percent = total > 0 ? Math.round((loaded * 100) / total) : 0;

                    setDlProgress({
                        name: dlName,
                        loaded,
                        total,
                        speed,
                        percent
                    });
                }
            });

            // Check if server returned an error inside the blob
            if (r.data.type && (r.data.type.includes('application/json') || r.data.type.includes('text/xml') || r.data.type.includes('application/xml'))) {
                const text = await r.data.text();
                try {
                    const errJson = JSON.parse(text);
                    if (errJson.error) {
                        if (showToast) showToast(`Download failed: ${errJson.error}`, 'error');
                        return;
                    }
                } catch (e) {
                    if (text.includes('<Error>') || text.includes('AccessDenied')) {
                        if (showToast) showToast('Access denied or file expired', 'error');
                        return;
                    }
                }
            }

            const mimeType = r.headers['content-type'] || (item.isDirectory ? 'application/zip' : 'application/octet-stream');
            const blob = new Blob([r.data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = dlName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 5000);
            if (showToast) showToast(`Downloaded ${dlName}`, 'success');
        } catch { 
            if (showToast) showToast('Download failed. Please check your network connection.', 'error'); 
        } finally {
            setDownloading(false);
            setDlProgress(null);
        }
    };

    // ── AUTH SUBMIT ────────────────────────────────────────────────────────────
    const submitPassword = async (e) => {
        e.preventDefault();
        setSubmitting(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { password });
            setAuthed(true); setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Incorrect password'));
        } finally { setSubmitting(false); }
    };

    const requestOtp = async (e) => {
        e.preventDefault();
        setSubmitting(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email });
            setStep('otp_code');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Failed to send OTP'));
        } finally { setSubmitting(false); }
    };

    const verifyOtp = async (e) => {
        e.preventDefault();
        setSubmitting(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email, otpCode: otp });
            setAuthed(true); setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Invalid OTP'));
        } finally { setSubmitting(false); }
    };

    // ── RENDERS ────────────────────────────────────────────────────────────────
    if (loading) return <Shell><LoadingView /></Shell>;
    if (infoErr) return <Shell><ErrorView msg={infoErr} /></Shell>;

    // Auth walls
    if (step === 'password') return (
        <Shell>
            <AuthCard title="Password Required" icon={<Lock size={24} color="var(--accent-gold, #f2c94c)"/>}>
                <p style={grayTxt}>This share is protected. Enter the passkey to access.</p>
                <form onSubmit={submitPassword}>
                    <input type="password" placeholder="Enter passkey..." value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={inputStyle} autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submitting} style={actionBtn}>
                        {submitting ? 'Verifying...' : <><Key size={16}/> Unlock</>}
                    </button>
                </form>
            </AuthCard>
        </Shell>
    );

    if (step === 'otp_email') return (
        <Shell>
            <AuthCard title="Email Verification Required" icon={<Mail size={24} color="var(--accent-cyan, #00f2ff)"/>}>
                <p style={grayTxt}>Enter your email address to receive a one-time code.</p>
                <form onSubmit={requestOtp}>
                    <input type="email" placeholder="your@email.com" value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={inputStyle} autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submitting} style={actionBtn}>
                        {submitting ? 'Sending...' : <><Mail size={16}/> Send OTP</>}
                    </button>
                </form>
            </AuthCard>
        </Shell>
    );

    if (step === 'otp_code') return (
        <Shell>
            <AuthCard title="Enter OTP" icon={<ShieldCheck size={24} color="var(--accent-cyan, #00f2ff)"/>}>
                <p style={grayTxt}>A 6-digit code was sent to <strong style={{color: 'var(--text-primary)'}}>{email}</strong>.</p>
                <form onSubmit={verifyOtp}>
                    <input type="text" placeholder="000000" maxLength={6} value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g,''))}
                        style={{...inputStyle, textAlign:'center', fontSize:'24px', letterSpacing:'0.4em'}}
                        autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submitting} style={actionBtn}>
                        {submitting ? 'Verifying...' : <><ShieldCheck size={16}/> Verify</>}
                    </button>
                    <button type="button" onClick={() => setStep('otp_email')} style={backBtn}>← Use a different email</button>
                </form>
            </AuthCard>
        </Shell>
    );

    // ── FILE EXPLORER ──────────────────────────────────────────────────────────
    const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

    const handleNextPreview = () => {
        if (!previewMedia) return;
        const mediaFiles = files.filter(f => !f.isDirectory && EXT_ICONS.img.concat(EXT_ICONS.vid, EXT_ICONS.doc, EXT_ICONS.aud).includes((f.extension || f.name.split('.').pop() || '').toLowerCase()));
        const idx = mediaFiles.findIndex(f => f.name === previewMedia.name);
        if (idx >= 0 && idx < mediaFiles.length - 1) navigate(mediaFiles[idx + 1]);
    };

    const handlePrevPreview = () => {
        if (!previewMedia) return;
        const mediaFiles = files.filter(f => !f.isDirectory && EXT_ICONS.img.concat(EXT_ICONS.vid, EXT_ICONS.doc, EXT_ICONS.aud).includes((f.extension || f.name.split('.').pop() || '').toLowerCase()));
        const idx = mediaFiles.findIndex(f => f.name === previewMedia.name);
        if (idx > 0) navigate(mediaFiles[idx - 1]);
    };

    return (
        <Shell>
            <div style={{maxWidth:'900px',width:'100%',margin:'0 auto',padding:'32px 16px'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px',gap:'16px',flexWrap:'wrap'}}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ 
                            margin: 0, 
                            fontSize: '22px', 
                            fontWeight: 800, 
                            color: 'var(--text-primary)',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            lineHeight: 1.35
                        }}>
                            {getCleanPortalTitle(info.title, info.path)}
                        </h1>
                        {info.description && (
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {info.description}
                            </p>
                        )}
                        <p style={grayTxt}>
                            {(files.length > 0 ? files.length : (info.fileCount || 1))} item{(files.length > 0 ? files.length : (info.fileCount || 1)) === 1 ? '' : 's'} · {fmt(files.length > 0 ? files.reduce((acc, f) => acc + (f.size || 0), 0) : (info.totalSize || 0))} · Shared by {info.ownerName || 'admin'}
                        </p>
                    </div>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                        <div style={searchBox}>
                            <Search size={14} color="#8b949e"/>
                            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={searchInput}/>
                        </div>
                        <button onClick={() => setViewMode(m => m==='grid'?'list':'grid')} style={iconBtn}>
                            {viewMode==='grid' ? <LayoutList size={16}/> : <LayoutGrid size={16}/>}
                        </button>
                    </div>
                </div>

                {/* Breadcrumb */}
                {curPath && (
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'16px'}}>
                        <button onClick={goBack} style={backBtn2}><ArrowLeft size={14}/> Back</button>
                        <ChevronRight size={14} color="#484f58"/>
                        <span style={{fontSize:'13px',color: 'var(--text-secondary)'}}>{curPath}</span>
                    </div>
                )}

                {/* Files */}
                {filesLoading ? <LoadingView/> : (
                    <div style={viewMode==='grid' ? gridStyle : listStyle}>
                        {filtered.map(f => (
                            <div key={f.name}
                                onClick={() => navigate(f)}
                                style={viewMode==='grid'
                                    ? {...fileCardG, cursor: f.isDirectory ? 'pointer' : 'default'}
                                    : {...fileCardL, cursor: f.isDirectory ? 'pointer' : 'default'}
                                }
                            >
                                <div style={{fontSize:'28px', lineHeight:1}}>
                                    {f.isDirectory
                                        ? <Folder size={28} color="var(--accent-cyan,#00f2ff)"/>
                                        : <File size={28} color={getColor(f.extension)}/>}
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                    <p style={{margin:0,fontWeight:600,fontSize:'13px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</p>
                                    <p style={{margin:0,fontSize:'11px',color: 'var(--text-secondary)'}}>{f.isDirectory ? 'Folder' : fmt(f.size)}</p>
                                </div>
                                {!f.isDirectory && (
                                    <button onClick={e=>{e.stopPropagation();downloadItem(f);}} style={dlBtnSmall} disabled={downloading}>
                                        <Download size={14}/>
                                    </button>
                                )}
                            </div>
                        ))}
                        {filtered.length === 0 && <p style={{...grayTxt,textAlign:'center',padding:'40px'}}>No files found</p>}
                    </div>
                )}

                {/* Download all */}
                <div style={{marginTop:'24px',textAlign:'center'}}>
                    <button onClick={() => downloadItem({name: info.title, path:'', isDirectory:true})} disabled={downloading} style={dlBtnFull}>
                        <Download size={18}/> {downloading ? 'Preparing...' : 'Download All as ZIP'}
                    </button>
                </div>
            </div>
            {previewMedia && (
                <MediaPreviewModal
                    media={previewMedia}
                    onClose={() => setPreviewMedia(null)}
                    onNext={handleNextPreview}
                    onPrev={handlePrevPreview}
                    onDownload={(f) => {
                        downloadItem(f);
                        setPreviewMedia(null);
                    }}
                    showToast={showToast}
                    shareId={shareId}
                />
            )}
            <AnimatePresence>
                {dlProgress && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(10, 12, 16, 0.85)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            padding: '20px'
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            style={{
                                width: '100%',
                                maxWidth: '420px',
                                background: 'rgba(22, 27, 34, 0.95)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '24px',
                                padding: '32px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                                textAlign: 'center',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                position: 'absolute',
                                top: '-40%',
                                left: '-20%',
                                width: '140%',
                                height: '100%',
                                background: 'radial-gradient(ellipse at top, rgba(0, 242, 255, 0.12), transparent 60%)',
                                pointerEvents: 'none'
                            }} />

                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '20px',
                                background: 'rgba(0, 242, 255, 0.08)',
                                border: '1px solid rgba(0, 242, 255, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 24px',
                                position: 'relative'
                            }}>
                                <motion.div
                                    animate={{ y: [0, 6, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                    <Download size={28} color="#00f2ff" />
                                </motion.div>
                            </div>

                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Downloading</h3>
                            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', padding: '0 4px' }} title={dlProgress.name}>
                                {dlProgress.name}
                            </p>

                            <div style={{ background: 'var(--bg-surface-2)', borderRadius: '10px', height: '10px', width: '100%', overflow: 'hidden', marginBottom: '16px', position: 'relative', border: '1px solid var(--border-subtle)' }}>
                                {dlProgress.total > 0 ? (
                                    <div
                                        style={{
                                            width: `${dlProgress.percent}%`,
                                            height: '100%',
                                            background: 'linear-gradient(90deg, #00f2ff, #0072ff)',
                                            borderRadius: '10px',
                                            boxShadow: '0 0 10px rgba(0, 242, 255, 0.5)',
                                            transition: 'width 0.2s ease-out'
                                        }}
                                    />
                                ) : (
                                    <motion.div
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        style={{
                                            height: '100%',
                                            width: '50%',
                                            background: 'linear-gradient(90deg, transparent, #00f2ff, transparent)',
                                            borderRadius: '10px',
                                            position: 'absolute',
                                            top: 0
                                        }}
                                    />
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'left', background: 'rgba(0,0,0,0.15)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6e7681', marginBottom: '2px' }}>Downloaded</span>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
                                        {fmt(dlProgress.loaded)}
                                        {dlProgress.total > 0 && <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}> / {fmt(dlProgress.total)}</span>}
                                    </strong>
                                </div>
                                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: '16px' }}>
                                    <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6e7681', marginBottom: '2px' }}>Speed</span>
                                    <strong style={{ color: '#00f2ff', fontSize: '13px' }}>{fmt(dlProgress.speed)}/s</strong>
                                </div>
                            </div>

                            {dlProgress.total > 0 && (
                                <div style={{ marginTop: '16px', fontSize: '14px', fontWeight: 'bold', color: '#00f2ff' }}>
                                    {dlProgress.percent}% Completed
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Shell>
    );
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────
const Shell = ({children}) => (
    <div className="login-canvas" style={{minHeight: '100vh', width: '100%', color: 'var(--text-primary)', fontFamily:'Inter,sans-serif', display:'flex', flexDirection:'column', position:'relative', overflowX:'hidden'}}>
        {children}
    </div>
);
const LoadingView = () => (
    <div style={{textAlign:'center',padding:'60px',margin:'auto', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '20px', boxShadow: 'var(--shadow-md)'}}>
        <Loader size={36} color="var(--primary)" style={{animation:'spin 1s linear infinite'}}/>
        <p style={{color: 'var(--text-secondary)',marginTop:'14px', fontWeight: '700'}}>Decrypting secure link...</p>
    </div>
);
const ErrorView = ({msg}) => (
    <div style={{textAlign:'center',padding:'40px',maxWidth:'440px',margin:'auto', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)'}}>
        <div style={{width:'64px',height:'64px',background:'rgba(244,63,94,0.12)',border:'1px solid rgba(244,63,94,0.25)',borderRadius:'20px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>
            <AlertCircle size={32} color="#f43f5e"/>
        </div>
        <h3 style={{color:'var(--text-primary)',fontWeight:900,fontSize:'18px',margin:'0 0 8px'}}>Access Denied</h3>
        <p style={{color:'#f43f5e',fontWeight:700,fontSize:'14px',margin:'0 0 10px'}}>{msg}</p>
        <p style={{color: 'var(--text-secondary)',fontSize:'13px',margin:0}}>This secure link may have expired, reached maximum view limits, or been revoked by the owner.</p>
    </div>
);
const AuthCard = ({title, icon, children}) => (
    <div style={{width:'400px',maxWidth:'92vw',background:'var(--bg-surface-0)',border: '1px solid var(--border-subtle)',borderRadius:'24px',padding:'36px 32px',textAlign:'center',margin:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.45)'}}>
        <div style={{width:'56px',height:'56px',background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 4px 14px rgba(99,102,241,0.15)'}}>{icon}</div>
        <h2 style={{margin:'0 0 8px',fontSize:'20px',fontWeight:900,color:'var(--text-primary)',letterSpacing:'-0.3px'}}>{title}</h2>
        {children}
    </div>
);

// Styles
const grayTxt   = {color: 'var(--text-secondary)',fontSize:'13px',margin:'4px 0 16px'};
const errTxt    = {color:'#f43f5e',fontSize:'12.5px',margin:'8px 0',fontWeight:700};
const inputStyle = {width:'100%',padding:'12px 16px',boxSizing:'border-box',background: 'var(--bg-surface-2)',border: '1px solid var(--border-subtle)',borderRadius:'12px',color: 'var(--text-primary)',fontSize:'14px',outline:'none',marginTop:'4px',transition:'all 0.15s ease'};
const actionBtn = {width:'100%',padding:'14px',background:'var(--primary-gradient)',border:'none',borderRadius:'12px',color:'#ffffff',fontWeight:800,fontSize:'14px',cursor:'pointer',marginTop:'16px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',boxShadow:'0 6px 20px rgba(79, 70, 229, 0.35)',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'};
const backBtn   = {background:'none',border:'none',color: 'var(--text-secondary)',fontSize:'12.5px',fontWeight:700,cursor:'pointer',marginTop:'12px',width:'100%'};
const backBtn2  = {display:'flex',alignItems:'center',gap:'6px',background: 'var(--bg-surface-2)',border: '1px solid var(--border-subtle)',borderRadius:'8px',padding:'6px 12px',color: 'var(--text-secondary)',cursor:'pointer',fontSize:'12px',fontWeight:700};
const searchBox = {display:'flex',alignItems:'center',gap:'8px',background:'var(--bg-surface-2)',border: '1px solid var(--border-subtle)',borderRadius:'10px',padding:'8px 14px'};
const searchInput = {background:'none',border:'none',color: 'var(--text-primary)',fontSize:'13px',outline:'none',width:'160px'};
const iconBtn   = {padding:'8px 10px',background: 'var(--bg-surface-2)',border: '1px solid var(--border-subtle)',borderRadius:'8px',color: 'var(--text-secondary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'};
const gridStyle = {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'14px'};
const listStyle = {display:'grid',gridTemplateColumns:'1fr',gap:'8px'};
const fileCardG = {background:'var(--bg-surface-0)',border: '1px solid var(--border-subtle)',borderRadius:'14px',padding:'18px',display:'flex',flexDirection:'column',gap:'12px',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',boxShadow:'var(--shadow-sm)'};
const fileCardL = {background:'var(--bg-surface-0)',border: '1px solid var(--border-subtle)',borderRadius:'12px',padding:'12px 18px',display:'flex',alignItems:'center',gap:'14px',transition:'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',boxShadow:'var(--shadow-sm)'};
const dlBtnSmall = {padding:'7px 10px',background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:'8px',color:'var(--primary)',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'};
const dlBtnFull = {padding:'14px 32px',background:'var(--primary-gradient)',border:'none',borderRadius:'12px',color:'#ffffff',fontWeight:800,fontSize:'14px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'8px',boxShadow:'0 6px 20px rgba(79, 70, 229, 0.35)'};

export default GuestPortal;
