/**
 * UploadPortal.jsx — Cyber Secure Drop Box & File Ingestion Portal
 * Route: /u/:token
 * Calls: GET /api/share/info/:token, POST /api/share/upload/:token, POST /api/share/auth/:token
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
    UploadCloud, CheckCircle2, AlertCircle, Loader, File as FileIcon, X, Lock, Key, 
    Mail, ShieldCheck, HardDrive, Sparkles, FolderUp, Trash2, ArrowUpRight,
    Shield, Eye, EyeOff, Check, Cpu, Cloud, Zap
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

const getCleanPortalTitle = (rawTitle, rawPath) => {
    const candidate = rawTitle || rawPath || '';
    if (!candidate) return 'Secure File Drop Box';
    if (candidate.includes('\\') || candidate.includes('/')) {
        const parts = candidate.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean);
        if (parts.length > 0) {
            return parts[parts.length - 1];
        }
    }
    return candidate;
};

const fmt = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
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
    const [uploadSpeed, setUploadSpeed] = useState('');
    const [success, setSuccess]   = useState(false);

    const [step, setStep] = useState('init'); // init | password | otp_email | otp_code | authorized
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [authErr, setAuthErr] = useState('');
    const [submittingAuth, setSubmittingAuth] = useState(false);

    const fetchInfo = useCallback(() => {
        setLoading(true);
        axios.get(`/api/share/info/${shareId}`, { timeout: 8000 })
            .then(r => {
                if (r.data.type !== 'upload') throw new Error('This link is not configured as a file drop box');
                setInfo(r.data);
                if (r.data.passwordRequired) setStep('password');
                else if (r.data.emailRequired) setStep('otp_email');
                else setStep('authorized');
            })
            .catch(e => setError(String(e.response?.data?.error || e.response?.data?.message || e.message || 'Drop box not found or expired')))
            .finally(() => setLoading(false));
    }, [shareId]);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    const onDrop = useCallback(acceptedFiles => {
        setFiles(prev => [...prev, ...acceptedFiles]);
        setSuccess(false);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    const handleUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        setProgress(0);
        const startTime = Date.now();

        const formData = new FormData();
        files.forEach(f => formData.append('files', f));

        try {
            await axios.post(`/api/share/upload/${shareId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (p) => {
                    if (p.total) {
                        const pct = Math.round((p.loaded * 100) / p.total);
                        setProgress(pct);
                        const elapsed = (Date.now() - startTime) / 1000;
                        if (elapsed > 0) {
                            setUploadSpeed(`${fmt(p.loaded / elapsed)}/s`);
                        }
                    }
                }
            });
            
            // Show verification success animation
            setTimeout(() => {
                setSuccess(true);
                setFiles([]);
                setUploading(false);
            }, 1200);
            
        } catch (e) {
            setError(String(e.response?.data?.error || 'Upload failed. Please check file sizes or connection.'));
            setUploading(false);
        }
    };

    // ── AUTH SUBMIT ────────────────────────────────────────────────────────────
    const computePasskeyDigest = async (plainPassword, token) => {
        try {
            if (!window.crypto?.subtle) return { password: plainPassword };
            const encoder = new TextEncoder();
            const data = encoder.encode(`${plainPassword}:${token}:nexadisk-vault-auth`);
            const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
            const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            return { password: plainPassword, authDigest: hashHex };
        } catch {
            return { password: plainPassword };
        }
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            const authPayload = await computePasskeyDigest(password, shareId);
            await axios.post(`/api/share/auth/${shareId}`, authPayload);
            if (info?.emailRequired) setStep('otp_email');
            else setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Incorrect authorization passkey'));
        } finally { setSubmittingAuth(false); }
    };

    const requestOtp = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email });
            setStep('otp_code');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Failed to send OTP code'));
        } finally { setSubmittingAuth(false); }
    };

    const verifyOtp = async (e) => {
        e.preventDefault();
        setSubmittingAuth(true); setAuthErr('');
        try {
            await axios.post(`/api/share/auth/${shareId}`, { email, otpCode: otp });
            setStep('authorized');
        } catch (e) {
            setAuthErr(String(e.response?.data?.error || 'Invalid or expired OTP code'));
        } finally { setSubmittingAuth(false); }
    };

    if (loading) return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '48px', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '420px' }}
            >
                <div style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                    <UploadCloud size={28} color="var(--primary)" />
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>NexaDisk Drop Box</h3>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontWeight: '600', fontSize: '13px' }}>Verifying permissions and storage quotas...</p>
            </motion.div>
        </Shell>
    );

    if (error) return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center', padding: '44px 36px', maxWidth: '460px', width: '100%', background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}
            >
                <div style={{ width: '64px', height: '64px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <AlertCircle size={32} color="#f43f5e"/>
                </div>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '20px', margin: '0 0 8px' }}>Drop Box Unavailable</h3>
                <p style={{ color: '#f43f5e', fontWeight: 700, fontSize: '14px', margin: '0 0 12px' }}>{error}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0', lineHeight: '1.5' }}>This upload link may have reached its max limit, expired, or been revoked by the owner.</p>
                <button onClick={fetchInfo} className="btn-secondary" style={{ padding: '8px 18px', borderRadius: '10px', fontWeight: '700', fontSize: '13px' }}>
                    Retry Connection
                </button>
            </motion.div>
        </Shell>
    );

    // ── PASSKEY AUTHENTICATION SCREEN ──────────────────────────────────────────
    if (step === 'password') return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={cardStyle}
            >
                <div style={iconBadgeStyle}><Lock size={26} color="var(--primary)"/></div>
                <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px', textAlign: 'center' }}>Passkey Protected</h2>
                <p style={{ ...subTextStyle, textAlign: 'center' }}>Enter the authorization passkey to upload files to this drop box.</p>
                
                <form onSubmit={submitPassword} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                        <input 
                            type={showPass ? 'text' : 'password'} 
                            placeholder="Enter passkey..." 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="m-input"
                            style={{ paddingRight: '42px', fontSize: '14px' }}
                            autoFocus 
                            required 
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {authErr && <p style={errTextStyle}>{authErr}</p>}
                    
                    <button type="submit" disabled={submittingAuth} className="btn-primary" style={{ padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        {submittingAuth ? <Loader size={16} className="spin-anim" /> : <Key size={16}/>}
                        {submittingAuth ? 'Verifying Passkey...' : 'Unlock Drop Box'}
                    </button>
                </form>
            </motion.div>
        </Shell>
    );

    // ── OTP EMAIL SCREEN ───────────────────────────────────────────────────────
    if (step === 'otp_email') return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={cardStyle}
            >
                <div style={iconBadgeStyle}><Mail size={26} color="var(--primary)"/></div>
                <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px', textAlign: 'center' }}>Identity Verification</h2>
                <p style={{ ...subTextStyle, textAlign: 'center' }}>Provide your email address to receive an access verification code.</p>
                
                <form onSubmit={requestOtp} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input 
                        type="email" 
                        placeholder="your.email@company.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        className="m-input"
                        autoFocus 
                        required 
                    />
                    {authErr && <p style={errTextStyle}>{authErr}</p>}
                    <button type="submit" disabled={submittingAuth} className="btn-primary" style={{ padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        {submittingAuth ? <Loader size={16} className="spin-anim" /> : <Mail size={16}/>}
                        {submittingAuth ? 'Sending Code...' : 'Send Security Code'}
                    </button>
                </form>
            </motion.div>
        </Shell>
    );

    // ── OTP CODE SCREEN ────────────────────────────────────────────────────────
    if (step === 'otp_code') return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                style={cardStyle}
            >
                <div style={iconBadgeStyle}><ShieldCheck size={26} color="var(--primary)"/></div>
                <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px', textAlign: 'center' }}>Enter 6-Digit Code</h2>
                <p style={{ ...subTextStyle, textAlign: 'center' }}>A security code was sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.</p>
                
                <form onSubmit={verifyOtp} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input 
                        type="text" 
                        placeholder="000000" 
                        maxLength={6} 
                        value={otp} 
                        onChange={e => setOtp(e.target.value.replace(/\D/g,''))} 
                        className="m-input"
                        style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '0.35em', fontFamily: 'var(--font-mono)' }} 
                        autoFocus 
                        required 
                    />
                    {authErr && <p style={errTextStyle}>{authErr}</p>}
                    <button type="submit" disabled={submittingAuth} className="btn-primary" style={{ padding: '12px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                        {submittingAuth ? <Loader size={16} className="spin-anim" /> : <CheckCircle2 size={16}/>}
                        {submittingAuth ? 'Verifying...' : 'Verify & Unlock'}
                    </button>
                    <button type="button" onClick={() => setStep('otp_email')} style={backLinkStyle}>← Use a different email</button>
                </form>
            </motion.div>
        </Shell>
    );

    // ── AUTHORIZED INGESTION PORTAL ────────────────────────────────────────────
    const displayTitle = getCleanPortalTitle(info.title, info.path);
    const hasPathInfo = (info.path && (info.path.includes('\\') || info.path.includes('/'))) || (info.title && (info.title.includes('\\') || info.title.includes('/')));
    const fullPath = info.path || info.title;

    return (
        <Shell>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                style={{ maxWidth: '580px', width: '100%', margin: '0 auto' }}
            >
                <div style={cardStyle}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={iconBadgeStyle}>
                            <UploadCloud size={28} color="var(--primary)"/>
                        </div>
                        <h1 style={{ 
                            margin: '0 0 8px', 
                            fontSize: '24px', 
                            fontWeight: 900, 
                            color: 'var(--text-primary)', 
                            letterSpacing: '-0.3px',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                            lineHeight: 1.35,
                            maxWidth: '100%'
                        }}>
                            {displayTitle}
                        </h1>

                        {hasPathInfo && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11.5px',
                                fontFamily: 'var(--font-mono, monospace)',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-surface-2, rgba(0,0,0,0.03))',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)',
                                marginBottom: '12px',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }} title={fullPath}>
                                <HardDrive size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullPath}</span>
                            </div>
                        )}

                        {info.description && <p style={{ ...subTextStyle, marginBottom: '10px' }}>{info.description}</p>}
                        
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-surface-2)', padding: '5px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                <span>Recipient:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{info.ownerName || 'Cluster Operator'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Drag and Drop Box */}
                    <div 
                        {...getRootProps()} 
                        style={{
                            border: `2px dashed ${isDragActive ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            borderRadius: '16px',
                            padding: '36px 20px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: isDragActive ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-2)',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px'
                        }}
                    >
                        <input {...getInputProps()} />
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', boxShadow: 'var(--shadow-sm)' }}>
                            <FolderUp size={24} />
                        </div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)' }}>
                            {isDragActive ? 'Drop files here immediately...' : 'Drag & drop files here, or click to browse'}
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Supports all documents, archives, code, and multimedia payloads
                        </p>
                    </div>

                    {/* File Queue List */}
                    {files.length > 0 && (
                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', padding: '0 4px' }}>
                                <span>Selected Files ({files.length})</span>
                                <span>Total: {fmt(totalBytes)}</span>
                            </div>

                            {files.map((f, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                        <FileIcon size={16} color="var(--primary)" />
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {f.name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmt(f.size)}</span>
                                        <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}>
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload Progress Bar */}
                    {uploading && (
                        <div style={{ marginTop: '20px', padding: '14px', borderRadius: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                                <span>Uploading & Encrypting...</span>
                                <span>{progress}% {uploadSpeed && `(${uploadSpeed})`}</span>
                            </div>
                            <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--bg-surface-0)', overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-gradient)', transition: 'width 0.2s ease' }} />
                            </div>
                        </div>
                    )}

                    {/* Success Confirmation */}
                    {success && (
                        <div style={{ marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <CheckCircle2 size={24} color="#10b981" />
                            <div>
                                <strong style={{ fontSize: '14px', color: '#10b981', display: 'block' }}>Payload Ingested Successfully!</strong>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Files have been secured in the recipient's vault.</span>
                            </div>
                        </div>
                    )}

                    {/* Submit Action Button */}
                    <div style={{ marginTop: '24px' }}>
                        <button
                            onClick={handleUpload}
                            disabled={uploading || files.length === 0}
                            className="btn-primary"
                            style={{
                                width: '100%',
                                padding: '14px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: files.length === 0 ? 0.6 : 1
                            }}
                        >
                            {uploading ? <Loader size={18} className="spin-anim" /> : <UploadCloud size={18} />}
                            {uploading ? 'Ingesting Files to Vault...' : `Upload ${files.length > 0 ? `(${files.length} Files • ${fmt(totalBytes)})` : 'Files'}`}
                        </button>
                    </div>

                    {/* Security Footer Badge */}
                    <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <Shield size={12} color="#10b981" />
                        <span>Protected by NexaDisk Military-Grade Ingestion & Antivirus Scanners</span>
                    </div>
                </div>
            </motion.div>
        </Shell>
    );
};

// ── CYBER SHELL WRAPPER ────────────────────────────────────────────────────────
const Shell = ({ children }) => (
    <div 
        style={{ 
            minHeight: '100vh', 
            width: '100%', 
            background: 'var(--bg-deep)', 
            backgroundImage: 'radial-gradient(ellipse at 50% 10%, rgba(99, 102, 241, 0.15), transparent 70%), radial-gradient(ellipse at 80% 90%, rgba(14, 165, 233, 0.1), transparent 60%)',
            color: 'var(--text-primary)', 
            fontFamily: 'Inter, system-ui, sans-serif', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            position: 'relative', 
            padding: '24px',
            boxSizing: 'border-box'
        }}
    >
        {children}
    </div>
);

const cardStyle = {
    background: 'var(--bg-surface-0)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '24px',
    padding: '36px 32px',
    boxShadow: 'var(--shadow-lg)',
    position: 'relative',
    maxWidth: '580px',
    width: '100%',
    boxSizing: 'border-box'
};

const iconBadgeStyle = {
    width: '58px',
    height: '58px',
    background: 'rgba(99, 102, 241, 0.12)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.15)'
};

const subTextStyle = { color: 'var(--text-secondary)', fontSize: '13.5px', margin: '4px 0 0 0' };
const errTextStyle = { color: '#f43f5e', fontSize: '12.5px', margin: '6px 0 0 0', fontWeight: 700, textAlign: 'center' };

const backLinkStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '12.5px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '10px',
    width: '100%',
    textAlign: 'center'
};

export default UploadPortal;
