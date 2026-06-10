/**
 * GuestPortal.jsx — Protected share (password or email OTP)
 * Route: /g/:token
 * Calls: GET /api/share/info/:token, POST /api/share/auth/:token,
 *        GET /api/share/files/:token, POST /api/share/stream
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Folder, File, Download, Key, Mail, HardDrive,
    ArrowLeft, LayoutGrid, LayoutList, Search, ShieldCheck,
    AlertCircle, Loader, ChevronRight, Lock
} from 'lucide-react';
import MediaPreviewModal from '../modals/MediaPreviewModal';

const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

const EXT_ICONS = {
    img: ['jpg','jpeg','png','gif','webp','svg','bmp'],
    vid: ['mp4','mkv','avi','mov','webm'],
    aud: ['mp3','wav','flac','aac'],
    doc: ['pdf','doc','docx','txt','md','xls','xlsx','ppt','pptx'],
    arc: ['zip','tar','gz','rar','7z'],
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
    const [previewMedia, setPreviewMedia] = useState(null);

    // 1. Load share metadata
    useEffect(() => {
        axios.get(`/api/share/info/${shareId}`)
            .then(r => {
                setInfo(r.data);
                if (!r.data.passwordRequired && !r.data.emailRequired) {
                    // Open access even on /g/ — just authorize
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

    const loadFiles = async (subPath) => {
        setFilesLoading(true);
        try {
            const r = await axios.get(`/api/share/files/${shareId}`, { params: { path: subPath } });
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
            const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase();
            let type = 'other';
            if (EXT_ICONS.img.includes(ext)) type = 'image';
            else if (EXT_ICONS.vid.includes(ext)) type = 'video';
            else if (EXT_ICONS.doc.includes(ext) || EXT_ICONS.aud.includes(ext)) type = 'text';

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
        try {
            const r = await axios.post('/api/share/stream', { token: shareId, filePath: item.path || '' }, { responseType: 'blob' });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.name + (item.isDirectory ? '.zip' : '');
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert('Download failed.'); }
        finally { setDownloading(false); }
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
                <p style={grayTxt}>A 6-digit code was sent to <strong style={{color:'#e6edf3'}}>{email}</strong>.</p>
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
                    <div>
                        <h1 style={{margin:0,fontSize:'22px',fontWeight:800}}>{info.title}</h1>
                        <p style={grayTxt}>{info.fileCount} items · {fmt(info.totalSize)} · by {info.ownerName}</p>
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
                        <span style={{fontSize:'13px',color:'#8b949e'}}>{curPath}</span>
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
                                    <p style={{margin:0,fontSize:'11px',color:'#8b949e'}}>{f.isDirectory ? 'Folder' : fmt(f.size)}</p>
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
        </Shell>
    );
};

// ── SUB-COMPONENTS ─────────────────────────────────────────────────────────────
const Shell = ({children}) => (
    <div style={{minHeight: '100vh', width: '100%', background:'#0d1117',color:'#e6edf3',fontFamily:'Inter,sans-serif',display:'flex',flexDirection:'column'}}>
        {children}
    </div>
);
const LoadingView = () => (
    <div style={{textAlign:'center',padding:'60px',margin:'auto'}}>
        <Loader size={32} color="#00f2ff" style={{animation:'spin 1s linear infinite'}}/>
        <p style={{color:'#8b949e',marginTop:'12px'}}>Loading...</p>
    </div>
);
const ErrorView = ({msg}) => (
    <div style={{textAlign:'center',padding:'60px',maxWidth:'400px',margin:'auto'}}>
        <AlertCircle size={48} color="#f85149"/>
        <p style={{color:'#f85149',fontWeight:700,fontSize:'16px',margin:'16px 0 8px'}}>{msg}</p>
        <p style={{color:'#8b949e',fontSize:'13px'}}>The link may have expired or been revoked.</p>
    </div>
);
const AuthCard = ({title, icon, children}) => (
    <div style={{width:'380px',background:'rgba(22,27,34,0.95)',border:'1px solid #30363d',borderRadius:'20px',padding:'40px',textAlign:'center',margin:'auto'}}>
        <div style={{width:'56px',height:'56px',background:'rgba(242,201,76,0.08)',border:'1px solid rgba(242,201,76,0.2)',borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}>{icon}</div>
        <h2 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:800}}>{title}</h2>
        {children}
    </div>
);

// Styles
const grayTxt   = {color:'#8b949e',fontSize:'13px',margin:'4px 0'};
const errTxt    = {color:'#f85149',fontSize:'12px',margin:'6px 0'};
const inputStyle = {width:'100%',padding:'12px 14px',boxSizing:'border-box',background:'rgba(13,17,23,0.8)',border:'1px solid #30363d',borderRadius:'10px',color:'#e6edf3',fontSize:'14px',outline:'none',marginTop:'12px'};
const actionBtn = {width:'100%',padding:'13px',background:'linear-gradient(135deg,#f2c94c,#f2994a)',border:'none',borderRadius:'12px',color:'#0d1117',fontWeight:800,fontSize:'14px',cursor:'pointer',marginTop:'12px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'};
const backBtn   = {background:'none',border:'none',color:'#8b949e',fontSize:'12px',cursor:'pointer',marginTop:'8px',width:'100%'};
const backBtn2  = {display:'flex',alignItems:'center',gap:'4px',background:'rgba(255,255,255,0.05)',border:'1px solid #30363d',borderRadius:'8px',padding:'5px 10px',color:'#8b949e',cursor:'pointer',fontSize:'12px'};
const searchBox = {display:'flex',alignItems:'center',gap:'8px',background:'rgba(22,27,34,0.8)',border:'1px solid #30363d',borderRadius:'10px',padding:'6px 12px'};
const searchInput = {background:'none',border:'none',color:'#e6edf3',fontSize:'13px',outline:'none',width:'140px'};
const iconBtn   = {padding:'8px',background:'rgba(255,255,255,0.05)',border:'1px solid #30363d',borderRadius:'8px',color:'#8b949e',cursor:'pointer'};
const gridStyle = {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px'};
const listStyle = {display:'grid',gridTemplateColumns:'1fr',gap:'8px'};
const fileCardG = {background:'rgba(22,27,34,0.7)',border:'1px solid #21262d',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'10px',transition:'border-color 0.15s'};
const fileCardL = {background:'rgba(22,27,34,0.7)',border:'1px solid #21262d',borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'14px'};
const dlBtnSmall = {padding:'6px',background:'rgba(0,242,255,0.08)',border:'1px solid rgba(0,242,255,0.2)',borderRadius:'6px',color:'#00f2ff',cursor:'pointer',flexShrink:0};
const dlBtnFull = {padding:'13px 32px',background:'linear-gradient(135deg,#f2c94c,#f2994a)',border:'none',borderRadius:'12px',color:'#0d1117',fontWeight:800,fontSize:'14px',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'8px'};

export default GuestPortal;
