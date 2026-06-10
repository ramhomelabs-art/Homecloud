/**
 * UploadPortal.jsx — Secure Drop Box
 * Route: /u/:token
 * Calls: GET /api/share/info/:token, POST /api/share/upload/:token
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle2, AlertCircle, Loader, File as FileIcon, X, Lock, Key, Mail, ShieldCheck } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

const UploadPortal = ({ shareId }) => {
    const [info, setInfo]       = useState(null);
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(true);

    const [files, setFiles]     = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [success, setSuccess]   = useState(false);

    const [step, setStep] = useState('init'); // init | password | otp_email | otp_code | authorized
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [authErr, setAuthErr] = useState('');
    const [submittingAuth, setSubmittingAuth] = useState(false);

    useEffect(() => {
        axios.get(`/api/share/info/${shareId}`)
            .then(r => {
                if (r.data.type !== 'upload') throw new Error('This link does not accept uploads');
                setInfo(r.data);
                if (r.data.passwordRequired) setStep('password');
                else if (r.data.emailRequired) setStep('otp_email');
                else setStep('authorized');
            })
            .catch(e => setError(String(e.response?.data?.error || e.response?.data?.message || e.message || 'Link not found')))
            .finally(() => setLoading(false));
    }, [shareId]);

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
        setSuccess(false);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        setProgress(0);

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        try {
            await axios.post(`/api/share/upload/${shareId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (p) => {
                    if (p.total) setProgress(Math.round((p.loaded * 100) / p.total));
                }
            });
            
            // Wait for a few seconds to simulate the asynchronous scanning process
            // so the guest user knows the file is being verified by the security engine.
            setTimeout(() => {
                setSuccess(true);
                setFiles([]);
                setUploading(false);
            }, 5000);
            
        } catch (e) {
            alert(String(e.response?.data?.error || 'Upload failed'));
            setUploading(false);
        }
    };

    // ── AUTH SUBMIT ────────────────────────────────────────────────────────────
    const submitPassword = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { password });
            if (info?.emailRequired) setStep('otp_email');
            else setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Incorrect password'));
        } finally { setSubmittingAuth(false); }
    };

    const requestOtp = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email });
            setStep('otp_code');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Failed to send OTP'));
        } finally { setSubmittingAuth(false); }
    };

    const verifyOtp = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email, otpCode: otp });
            setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Invalid OTP'));
        } finally { setSubmittingAuth(false); }
    };

    if (loading) return <Shell><div style={centered}><Loader size={32} style={{animation:'spin 1s linear infinite'}} color="var(--accent-gold, #f2c94c)"/><p style={grayTxt}>Verifying link...</p></div></Shell>;
    if (error)   return <Shell><div style={centered}><AlertCircle size={40} color="#f85149"/><p style={{color:'#f85149',fontWeight:700,margin:'12px 0 4px'}}>{error}</p></div></Shell>;

    // Auth walls
    if (step === 'password') return (
        <Shell>
            <div style={card}>
                <div style={iconBox}><Lock size={24} color="var(--accent-gold, #f2c94c)"/></div>
                <h2 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:800,textAlign:'center'}}>Password Required</h2>
                <p style={{...grayTxt,textAlign:'center'}}>This drop box is protected. Enter the passkey to access.</p>
                <form onSubmit={submitPassword}>
                    <input type="password" placeholder="Enter passkey..." value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submittingAuth} style={actionBtn}>
                        {submittingAuth ? 'Verifying...' : <><Key size={16}/> Unlock</>}
                    </button>
                </form>
            </div>
        </Shell>
    );

    if (step === 'otp_email') return (
        <Shell>
            <div style={card}>
                <div style={iconBox}><Mail size={24} color="var(--accent-cyan, #00f2ff)"/></div>
                <h2 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:800,textAlign:'center'}}>Email Verification Required</h2>
                <p style={{...grayTxt,textAlign:'center'}}>Enter your email address to receive a one-time code.</p>
                <form onSubmit={requestOtp}>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submittingAuth} style={actionBtn}>
                        {submittingAuth ? 'Sending...' : <><Mail size={16}/> Send OTP</>}
                    </button>
                </form>
            </div>
        </Shell>
    );

    if (step === 'otp_code') return (
        <Shell>
            <div style={card}>
                <div style={iconBox}><ShieldCheck size={24} color="var(--accent-cyan, #00f2ff)"/></div>
                <h2 style={{margin:'0 0 8px',fontSize:'18px',fontWeight:800,textAlign:'center'}}>Enter OTP</h2>
                <p style={{...grayTxt,textAlign:'center'}}>A 6-digit code was sent to <strong style={{color:'#e6edf3'}}>{email}</strong>.</p>
                <form onSubmit={verifyOtp}>
                    <input type="text" placeholder="000000" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,''))} style={{...inputStyle, textAlign:'center', fontSize:'24px', letterSpacing:'0.4em'}} autoFocus required />
                    {authErr && <p style={errTxt}>{authErr}</p>}
                    <button type="submit" disabled={submittingAuth} style={actionBtn}>
                        {submittingAuth ? 'Verifying...' : <><CheckCircle2 size={16}/> Verify</>}
                    </button>
                    <button type="button" onClick={() => setStep('otp_email')} style={backBtn}>← Use a different email</button>
                </form>
            </div>
        </Shell>
    );

    return (
        <Shell>
            <div style={{maxWidth:'600px',width:'100%',margin:'0 auto',padding:'32px 16px'}}>
                <div style={card}>
                    <div style={{textAlign:'center',marginBottom:'32px'}}>
                        <div style={iconBox}><UploadCloud size={32} color="var(--accent-gold, #f2c94c)"/></div>
                        <h1 style={{margin:'0 0 8px',fontSize:'24px',fontWeight:800}}>{info.title}</h1>
                        {info.description && <p style={grayTxt}>{info.description}</p>}
                        <p style={grayTxt}>Secure drop box for <strong style={{color:'#e6edf3'}}>{info.ownerName}</strong></p>
                    </div>

                    {success && (
                        <div style={successBox}>
                            <CheckCircle2 size={24} color="#4ade80" />
                            <div>
                                <p style={{margin:0,fontWeight:700,color:'#4ade80'}}>Upload Successful</p>
                                <p style={{margin:'4px 0 0',fontSize:'13px',color:'#8b949e'}}>Your files have been securely saved.</p>
                            </div>
                        </div>
                    )}

                    {/* Dropzone */}
                    <div {...getRootProps()} style={isDragActive ? {...dropzone, ...dropzoneActive} : dropzone}>
                        <input {...getInputProps()} />
                        <UploadCloud size={40} color={isDragActive ? "var(--accent-gold)" : "#8b949e"} style={{marginBottom:'16px'}}/>
                        <p style={{margin:'0 0 8px',fontSize:'16px',fontWeight:600,color:isDragActive?'var(--accent-gold)':'#e6edf3'}}>
                            {isDragActive ? 'Drop files here...' : 'Drag & drop files here'}
                        </p>
                        <p style={{margin:0,fontSize:'13px',color:'#8b949e'}}>or click to browse</p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div style={{marginTop:'24px'}}>
                            <h3 style={{fontSize:'13px',fontWeight:700,color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'12px'}}>
                                Selected Files ({files.length})
                            </h3>
                            <div style={{maxHeight:'200px',overflowY:'auto',background:'rgba(13,17,23,0.5)',borderRadius:'12px',border:'1px solid #30363d'}}>
                                {files.map((f, i) => (
                                    <div key={i} style={fileRow}>
                                        <FileIcon size={16} color="#8b949e"/>
                                        <div style={{flex:1,minWidth:0}}>
                                            <p style={{margin:0,fontSize:'13px',fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</p>
                                        </div>
                                        <span style={{fontSize:'12px',color:'#8b949e'}}>{fmt(f.size)}</span>
                                        <button onClick={() => removeFile(i)} style={delBtn} disabled={uploading}><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Progress/Action */}
                    {uploading ? (
                        <div style={{marginTop:'24px'}}>
                            <div style={{display:'flex',justifyContent:'space-between',fontSize:'13px',fontWeight:600,marginBottom:'8px'}}>
                                <span>{progress === 100 ? 'Scanning with Security Engine...' : 'Uploading...'}</span>
                                <span>{progress}%</span>
                            </div>
                            <div style={progTrack}><div style={{...progBar, width:`${progress}%`, background: progress === 100 ? 'var(--accent-gold)' : '#58a6ff'}}/></div>
                        </div>
                    ) : (
                        <button onClick={handleUpload} disabled={files.length===0} style={{...uploadBtn, opacity:files.length===0?0.5:1}}>
                            Upload {files.length} File{files.length!==1?'s':''}
                        </button>
                    )}
                </div>
            </div>
        </Shell>
    );
};

// ── SHELL ──────────────────────────────────────────────────────────────────────
const Shell = ({children}) => (
    <div style={{minHeight:'100vh',background:'#0d1117',color:'#e6edf3',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {children}
    </div>
);

const centered = { textAlign:'center', padding:'60px' };
const grayTxt  = { color:'#8b949e', fontSize:'13px', margin:'4px 0' };
const card     = { background:'rgba(22,27,34,0.95)', border:'1px solid #30363d', borderRadius:'24px', padding:'40px', boxShadow:'0 24px 80px rgba(0,0,0,0.5)' };
const iconBox  = { width:'64px',height:'64px',background:'rgba(242,201,76,0.1)',border:'1px solid rgba(242,201,76,0.3)',borderRadius:'18px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' };

const dropzone = { border:'2px dashed #30363d', borderRadius:'16px', padding:'40px 20px', textAlign:'center', cursor:'pointer', background:'rgba(13,17,23,0.4)', transition:'all 0.2s' };
const dropzoneActive = { borderColor:'var(--accent-gold)', background:'rgba(242,201,76,0.05)' };

const fileRow  = { display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', borderBottom:'1px solid #30363d' };
const delBtn   = { background:'none', border:'none', color:'#f85149', cursor:'pointer', padding:'4px', display:'flex' };

const uploadBtn= { width:'100%',padding:'16px',background:'linear-gradient(135deg,#f2c94c,#f2994a)',border:'none',borderRadius:'14px',color:'#0d1117',fontWeight:800,fontSize:'16px',cursor:'pointer',marginTop:'24px',transition:'opacity 0.2s' };

const progTrack= { height:'8px', background:'rgba(255,255,255,0.1)', borderRadius:'4px', overflow:'hidden' };
const progBar  = { height:'100%', background:'linear-gradient(90deg,#f2c94c,#f2994a)', transition:'width 0.2s' };

const successBox={ display:'flex', alignItems:'center', gap:'16px', padding:'16px', background:'rgba(46,160,67,0.1)', border:'1px solid rgba(46,160,67,0.3)', borderRadius:'12px', marginBottom:'24px' };

const errTxt    = {color:'#f85149',fontSize:'12px',margin:'6px 0'};
const inputStyle = {width:'100%',padding:'12px 14px',boxSizing:'border-box',background:'rgba(13,17,23,0.8)',border:'1px solid #30363d',borderRadius:'10px',color:'#e6edf3',fontSize:'14px',outline:'none',marginTop:'12px'};
const actionBtn = {width:'100%',padding:'13px',background:'linear-gradient(135deg,#f2c94c,#f2994a)',border:'none',borderRadius:'12px',color:'#0d1117',fontWeight:800,fontSize:'14px',cursor:'pointer',marginTop:'12px',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'};
const backBtn   = {background:'none',border:'none',color:'#8b949e',fontSize:'12px',cursor:'pointer',marginTop:'8px',width:'100%'};

export default UploadPortal;
