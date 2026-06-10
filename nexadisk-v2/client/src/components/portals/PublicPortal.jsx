/**
 * PublicPortal.jsx — Open share (no auth required)
 * Route: /p/:token
 * Calls: GET /api/share/info/:token, POST /api/share/stream
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, FileText, Folder, HardDrive, Shield, AlertCircle, Loader } from 'lucide-react';

const fmt = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B','KB','MB','GB','TB','PB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
};

const PublicPortal = ({ shareId }) => {
    const [info, setInfo]       = useState(null);
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(true);
    const [dling, setDling]     = useState(false);

    useEffect(() => {
        axios.get(`/api/share/info/${shareId}`)
            .then(r => setInfo(r.data))
            .catch(e => setError(String(e.response?.data?.error || e.response?.data?.message || 'Share not found or expired')))
            .finally(() => setLoading(false));
    }, [shareId]);

    const download = async (filePath = '') => {
        setDling(true);
        try {
            const r = await axios.post('/api/share/stream', { token: shareId, filePath }, { responseType: 'blob' });
            const url = URL.createObjectURL(r.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = info?.title || 'download';
            a.click();
            URL.revokeObjectURL(url);
        } catch { alert('Download failed. Please try again.'); }
        finally { setDling(false); }
    };

    if (loading) return <PortalShell><div style={centered}><Loader size={32} style={{animation:'spin 1s linear infinite'}} color="#00f2ff"/><p style={grayTxt}>Loading...</p></div></PortalShell>;
    if (error)   return <PortalShell><div style={centered}><AlertCircle size={40} color="#f85149"/><p style={{color:'#f85149',fontWeight:700,margin:'12px 0 4px'}}>{error}</p></div></PortalShell>;

    return (
        <PortalShell>
            <div style={{maxWidth:'540px',margin:'0 auto',padding:'32px 16px'}}>
                {/* File card */}
                <div style={card}>
                    <div style={iconBox}><FileText size={32} color="#00f2ff"/></div>
                    <div style={{flex:1}}>
                        <h2 style={{margin:'0 0 4px',fontSize:'20px',fontWeight:800}}>{info.title}</h2>
                        {info.description && <p style={grayTxt}>{info.description}</p>}
                        <div style={metaRow}>
                            <span style={badge}>{info.type?.toUpperCase()}</span>
                            <span style={grayTxt}>{info.fileCount || 0} file{info.fileCount !== 1 ? 's' : ''}</span>
                            <span style={grayTxt}>{fmt(info.totalSize)}</span>
                        </div>
                    </div>
                </div>

                {/* Shared by */}
                <p style={{...grayTxt, textAlign:'center', marginBottom:'24px'}}>
                    Shared by <strong style={{color:'#e6edf3'}}>{info.ownerName}</strong>
                    {info.expires_at && <> · Expires {new Date(info.expires_at).toLocaleDateString()}</>}
                </p>

                {/* Download button */}
                <button onClick={() => download()} disabled={dling} style={dlBtn}>
                    {dling ? <><Loader size={18} style={{animation:'spin 1s linear infinite'}}/> Preparing...</>
                           : <><Download size={18}/> Download All</>}
                </button>

                <p style={{...grayTxt, textAlign:'center', fontSize:'11px', marginTop:'16px'}}>
                    <Shield size={11} style={{marginRight:4}}/>Secured by NexaDisk
                </p>
            </div>
        </PortalShell>
    );
};

// ── SHELL ──────────────────────────────────────────────────────────────────────
const PortalShell = ({ children }) => (
    <div style={{minHeight:'100vh',background:'#0d1117',color:'#e6edf3',fontFamily:'Inter,sans-serif',display:'flex',alignItems:'center',justifyContent:'center'}}>
        {children}
    </div>
);

const card       = { display:'flex', gap:'20px', background:'rgba(22,27,34,0.9)', border:'1px solid #30363d', borderRadius:'16px', padding:'24px', marginBottom:'20px', alignItems:'flex-start' };
const iconBox    = { width:'56px',height:'56px',background:'rgba(0,242,255,0.08)',border:'1px solid rgba(0,242,255,0.2)',borderRadius:'14px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 };
const metaRow    = { display:'flex', gap:'12px', alignItems:'center', marginTop:'8px', flexWrap:'wrap' };
const badge      = { padding:'2px 8px', background:'rgba(0,242,255,0.1)', border:'1px solid rgba(0,242,255,0.3)', borderRadius:'6px', color:'#00f2ff', fontSize:'11px', fontWeight:700 };
const grayTxt    = { color:'#8b949e', fontSize:'13px', margin:'4px 0' };
const centered   = { textAlign:'center', padding:'40px' };
const dlBtn      = { width:'100%',padding:'16px',background:'linear-gradient(135deg,#f2c94c,#f2994a)',border:'none',borderRadius:'14px',color:'#0d1117',fontWeight:800,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'10px' };

export default PublicPortal;
