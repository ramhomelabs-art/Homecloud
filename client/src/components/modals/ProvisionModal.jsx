import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Download, Terminal, Link, ShieldCheck, Check, Copy, Server, 
    Cpu, RefreshCw, AlertTriangle, ShieldAlert, Sparkles, CheckCircle2
} from 'lucide-react';
import axios from 'axios';

const ProvisionModal = ({ show, onClose, onAgentAdded, showToast }) => {
    if (!show) return null;

    const [activeTab, setActiveTab] = useState('quick'); // 'quick' | 'manual' | 'offline'
    const [os, setOs] = useState('windows'); // 'windows' | 'linux'
    const [copied, setCopied] = useState(false);
    const [provisionInfo, setProvisionInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(true);

    // Manual connect state
    const [manualIp, setManualIp] = useState('');
    const [manualPort, setManualPort] = useState('5001');
    const [manualKey, setManualKey] = useState('');
    const [manualLabel, setManualLabel] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [connectResult, setConnectResult] = useState(null);

    const token = localStorage.getItem('token') || '';

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const res = await axios.get(`/api/v1/provision/info?token=${token}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setProvisionInfo(res.data);
                if (res.data?.agentKey) setManualKey(res.data.agentKey);
            } catch (err) {
                const masterUrl = window.location.origin;
                setProvisionInfo({
                    masterUrl,
                    windowsCommand: `irm "${masterUrl}/api/v1/provision/script/windows?token=${token}" | iex`,
                    linuxCommand: `curl -fsSL "${masterUrl}/api/v1/provision/script/linux?token=${token}" | sudo bash`
                });
            } finally {
                setLoadingInfo(false);
            }
        };
        fetchInfo();
    }, [token]);

    const activeCommand = os === 'windows' 
        ? provisionInfo?.windowsCommand || `irm "${window.location.origin}/api/v1/provision/script/windows?token=${token}" | iex`
        : provisionInfo?.linuxCommand || `curl -fsSL "${window.location.origin}/api/v1/provision/script/linux?token=${token}" | sudo bash`;

    const handleCopyCommand = () => {
        navigator.clipboard.writeText(activeCommand);
        setCopied(true);
        if (showToast) showToast('Deployment command copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2500);
    };

    const handleManualConnect = async (e) => {
        e.preventDefault();
        if (!manualIp) {
            if (showToast) showToast('Please enter agent IP address or hostname', 'error');
            return;
        }

        setConnecting(true);
        setConnectResult(null);

        try {
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await axios.post('/api/v1/agents/manual-connect', {
                ip: manualIp,
                port: parseInt(manualPort, 10) || 5001,
                key: manualKey,
                label: manualLabel || manualIp
            }, { headers });

            setConnectResult({ success: true, data: res.data });
            if (showToast) showToast(`Node "${res.data.hostname}" paired and verified!`, 'success');
            if (onAgentAdded) onAgentAdded();
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setConnectResult({ success: false, error: msg });
            if (showToast) showToast(`Connection failed: ${msg}`, 'error');
        } finally {
            setConnecting(false);
        }
    };

    const handleDownloadZip = () => {
        window.open(`/api/v1/provision/download/${os}?token=${token}`);
        if (showToast) showToast(`Downloading NexaDisk Agent package for ${os}...`, 'info');
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <motion.div 
                initial={{ scale: 0.96, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.96, opacity: 0 }}
                className="modal-content glass shadow-premium" 
                style={{ width: '510px', maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', padding: '22px', borderRadius: '16px' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)' }}>
                            <Server size={20} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                                Provision Agent Node
                            </h3>
                            <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>Zero-Touch deployment & instant cluster pairing</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-surface-0)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
                    <button
                        onClick={() => setActiveTab('quick')}
                        style={{
                            flex: 1,
                            padding: '7px 0',
                            borderRadius: '7px',
                            border: 'none',
                            background: activeTab === 'quick' ? 'var(--primary-gradient)' : 'transparent',
                            color: activeTab === 'quick' ? '#ffffff' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Terminal size={13} /> 1-Line Deploy
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        style={{
                            flex: 1,
                            padding: '7px 0',
                            borderRadius: '7px',
                            border: 'none',
                            background: activeTab === 'manual' ? 'var(--primary-gradient)' : 'transparent',
                            color: activeTab === 'manual' ? '#ffffff' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Link size={13} /> Direct Connect
                    </button>
                    <button
                        onClick={() => setActiveTab('offline')}
                        style={{
                            flex: 1,
                            padding: '7px 0',
                            borderRadius: '7px',
                            border: 'none',
                            background: activeTab === 'offline' ? 'var(--primary-gradient)' : 'transparent',
                            color: activeTab === 'offline' ? '#ffffff' : 'var(--text-secondary)',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Download size={13} /> Offline ZIP
                    </button>
                </div>

                {/* TAB 1: 1-Line Quick Deploy */}
                {activeTab === 'quick' && (
                    <div>
                        {/* OS Selection Toggle */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                            <div
                                onClick={() => setOs('windows')}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${os === 'windows' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                    background: os === 'windows' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-0)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill={os === 'windows' ? 'var(--primary)' : 'var(--text-dim)'}>
                                    <path d="M0 3.449L9.75 2.1V11.4H0V3.449zm0 8.851h9.75v9.3L0 20.25V12.3zm10.5-10.35L24 0v11.4h-13.5V1.95zM10.5 12.3H24V24l-13.5-1.95V12.3z" />
                                </svg>
                                <div>
                                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Windows</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>PowerShell (Admin)</div>
                                </div>
                            </div>

                            <div
                                onClick={() => setOs('linux')}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${os === 'linux' ? '#10b981' : 'var(--border-subtle)'}`,
                                    background: os === 'linux' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-0)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill={os === 'linux' ? '#10b981' : 'var(--text-dim)'}>
                                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                                </svg>
                                <div>
                                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Linux</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Bash / sudo</div>
                                </div>
                            </div>
                        </div>

                        {/* Copy Command Box */}
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                    {os === 'windows' ? 'Run in PowerShell (Admin)' : 'Run in Terminal (root / sudo)'}
                                </label>
                                <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <ShieldCheck size={12} /> HMAC Token Secured
                                </span>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <pre style={{
                                    margin: 0,
                                    padding: '12px 42px 12px 12px',
                                    borderRadius: '10px',
                                    background: '#090d16',
                                    border: '1px solid var(--border-subtle)',
                                    color: os === 'windows' ? '#38bdf8' : '#34d399',
                                    fontFamily: 'monospace',
                                    fontSize: '11.5px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all',
                                    lineHeight: '1.4'
                                }}>
                                    {activeCommand}
                                </pre>
                                <button
                                    onClick={handleCopyCommand}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '8px',
                                        background: copied ? '#10b981' : 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        color: '#ffffff',
                                        borderRadius: '6px',
                                        padding: '6px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                    title="Copy Command"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* Micro features list */}
                        <div style={{ background: 'var(--bg-surface-0)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={12} color="#10b981" /> Silent Node.js LTS Install</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={12} color="#10b981" /> Scans All Disk Partitions</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={12} color="#10b981" /> System Background Service</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={12} color="#10b981" /> Zero-Trust Security Audit</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: Direct Manual Connect */}
                {activeTab === 'manual' && (
                    <form onSubmit={handleManualConnect}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '8px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '4px' }}>AGENT HOSTNAME / IP *</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="192.168.1.100"
                                        value={manualIp}
                                        onChange={(e) => setManualIp(e.target.value)}
                                        style={{ width: '100%', height: '34px', fontSize: '12px' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '4px' }}>PORT</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        value={manualPort}
                                        onChange={(e) => setManualPort(e.target.value)}
                                        style={{ width: '100%', height: '34px', fontSize: '12px' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '4px' }}>AGENT SECRET KEY (AGENT_KEY)</label>
                                <input 
                                    type="password" 
                                    className="form-input" 
                                    placeholder="Enter Agent PSK"
                                    value={manualKey}
                                    onChange={(e) => setManualKey(e.target.value)}
                                    style={{ width: '100%', height: '34px', fontSize: '12px', fontFamily: 'monospace' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '4px' }}>NODE LABEL (OPTIONAL)</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. Storage-Node-02"
                                    value={manualLabel}
                                    onChange={(e) => setManualLabel(e.target.value)}
                                    style={{ width: '100%', height: '34px', fontSize: '12px' }}
                                />
                            </div>
                        </div>

                        {connectResult && (
                            <div style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                marginBottom: '14px',
                                background: connectResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                border: `1px solid ${connectResult.success ? '#10b981' : '#f43f5e'}`,
                                color: connectResult.success ? '#10b981' : '#f43f5e',
                                fontSize: '12px'
                            }}>
                                {connectResult.success ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldCheck size={15} />
                                        <span>Node <strong>{connectResult.data?.hostname}</strong> paired and audited ({connectResult.data?.audit?.score || 100}%)!</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldAlert size={15} />
                                        <span>{connectResult.error}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={connecting}
                            style={{ width: '100%', height: '38px', borderRadius: '10px', fontWeight: '800', fontSize: '12.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        >
                            {connecting ? <RefreshCw size={14} className="spin-anim" /> : <Link size={14} />}
                            {connecting ? 'Connecting & Verifying Security...' : 'Pair & Verify Security Compliance'}
                        </button>
                    </form>
                )}

                {/* TAB 3: Offline Standalone ZIP */}
                {activeTab === 'offline' && (
                    <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                            For air-gapped or isolated environments without internet, download the pre-packaged standalone bundle with installer templates.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                            <div
                                onClick={() => setOs('windows')}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${os === 'windows' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                                    background: os === 'windows' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-surface-0)',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ fontSize: '12.5px', fontWeight: '800' }}>Windows Package</div>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>install.ps1 bundled</div>
                            </div>

                            <div
                                onClick={() => setOs('linux')}
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    border: `1.5px solid ${os === 'linux' ? '#10b981' : 'var(--border-subtle)'}`,
                                    background: os === 'linux' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface-0)',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                }}
                            >
                                <div style={{ fontSize: '12.5px', fontWeight: '800' }}>Linux Package</div>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>install.sh bundled</div>
                            </div>
                        </div>

                        <button
                            onClick={handleDownloadZip}
                            className="btn-primary"
                            style={{ width: '100%', height: '38px', borderRadius: '10px', fontWeight: '800', fontSize: '12.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                        >
                            <Download size={14} /> Download {os === 'windows' ? 'Windows' : 'Linux'} ZIP Package
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default ProvisionModal;
