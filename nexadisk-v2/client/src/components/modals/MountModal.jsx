import React, { useState } from 'react';
import axios from 'axios';
import { Server, Globe, Activity } from 'lucide-react';

const API_BASE = '/api';

const MountModal = ({ show, onClose, onMounted, showToast }) => {
    if (!show) return null;
    const [step, setStep] = useState('search'); // search, select, credentials, manual
    const [ip, setIp] = useState('');
    const [discoveredShares, setDiscoveredShares] = useState([]);
    const [selectedShare, setSelectedShare] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [manualMode, setManualMode] = useState(false);
    const [rawOutput, setRawOutput] = useState('');
    const [showDebug, setShowDebug] = useState(false);

    const handleDiscover = async (e) => {
        e.preventDefault();
        setLoading(true);
        setShowDebug(false);
        try {
            const res = await axios.post(`${API_BASE}/network/discover`, { ip, username, password });
            const { items, error, raw } = res.data || {};
            setRawOutput(raw || '');

            if (error) {
                showToast(`Discovery Issue: ${error}`, 'error');
            }

            const safeItems = items || [];
            if (safeItems.length === 0) {
                showToast('No shares found. Try manual mode.', 'info');
                setDiscoveredShares([]);
            } else {
                setDiscoveredShares(safeItems);
            }
            setStep('select');
        } catch (err) {
            showToast(`Discovery failed: ${err.message}`, 'error');
        } finally { setLoading(false); }
    };

    const handleFinalize = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = Object.fromEntries(fd.entries());
        try {
            const mountPath = manualMode ? data.manualPath : `\\\\${ip}\\${selectedShare}`;
            const mountLabel = manualMode ? data.manualLabel : selectedShare;

            await axios.post(`${API_BASE}/network/mount`, {
                path: mountPath,
                label: mountLabel,
                username: data.username,
                password: data.password,
                type: data.type || 'SMB'
            });
            showToast('Share mounted successfully', 'success');
            onMounted();
            onClose();
            // Reset state
            setManualMode(false);
            setStep('search');
        } catch (err) {
            showToast(err.response?.data?.error || 'Mount failed', 'error');
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
            <div className="modal-content glass" style={{ width: '420px', textAlign: 'left' }}>
                <h3 style={{ marginBottom: '8px' }}>Provision Network Share</h3>
                {step === 'search' && (
                    <form onSubmit={handleDiscover}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', color: '#8b949e', margin: 0 }}>Enter an IP to find its shares, or leave blank to scan the network.</p>
                            <span onClick={() => { setManualMode(true); setStep('credentials'); }} style={{ fontSize: '11px', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '700' }}>Manual Entry</span>
                        </div>
                        <label className="m-label">Host IP Address</label>
                        <input className="m-input" value={ip} onChange={e => setIp(e.target.value)} placeholder="e.g. 10.10.20.23 (Optional)" />

                        <div style={{ marginTop: '12px' }}>
                            <label className="m-label">Discovery Credentials (Optional)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input className="m-input" style={{ marginBottom: 0 }} value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
                                <input className="m-input" style={{ marginBottom: 0 }} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button type="submit" className="auth-submit-btn" disabled={loading}>{loading ? 'Probing...' : (ip ? 'Search Shares' : 'Scan Entire Network')}</button>
                            <button type="button" onClick={onClose} className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }}>Cancel</button>
                        </div>
                    </form>
                )}
                {step === 'select' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', color: '#8b949e', margin: 0 }}>
                                {discoveredShares?.length > 0 && discoveredShares[0]?.startsWith('\\\\')
                                    ? 'Detected machines on network. Select a server to browse:'
                                    : `Detected shares on ${ip || 'selected host'}. Select a target volume:`}
                            </p>
                            <span onClick={() => { setManualMode(true); setStep('credentials'); }} style={{ fontSize: '11px', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '700' }}>Manual Entry</span>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {discoveredShares.map(s => {
                                const isServer = s.startsWith('\\\\');
                                return (
                                    <div key={s}
                                        onClick={() => {
                                            if (isServer) {
                                                const cleanIp = s.replace(/\\/g, '');
                                                setIp(cleanIp);
                                                setLoading(true);
                                                axios.post(`${API_BASE}/network/discover`, { ip: cleanIp, username, password }).then(res => {
                                                    const { items, error, raw } = res.data || {};
                                                    setRawOutput(raw || '');
                                                    if (error) showToast(`Scan Error: ${error}`, 'error');
                                                    setDiscoveredShares(items || []);
                                                    setLoading(false);
                                                }).catch((err) => {
                                                    showToast(`Discovery failed: ${err.message}`, 'error');
                                                    setLoading(false);
                                                });
                                            } else {
                                                setSelectedShare(s);
                                                setManualMode(false);
                                                setStep('credentials');
                                            }
                                        }}
                                        className="st-card-wide"
                                        style={{ cursor: 'pointer', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}
                                    >
                                        {isServer ? <Server size={18} color="var(--accent-gold)" /> : <Globe size={18} color="var(--accent-cyan)" />}
                                        <span>{isServer ? s.replace(/\\/g, '') : s}</span>
                                    </div>
                                );
                            })}
                            {(!discoveredShares || discoveredShares.length === 0) && (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#484f58', fontSize: '13px' }}>
                                    No items detected. Use Manual Entry above.
                                    {rawOutput && (
                                        <div style={{ marginTop: '10px' }}>
                                            <span onClick={() => setShowDebug(!showDebug)} style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}>
                                                {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
                                            </span>
                                            {showDebug && (
                                                <pre style={{ textAlign: 'left', background: '#0d1117', padding: '10px', marginTop: '8px', fontSize: '10px', color: '#8b949e', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto', border: '1px solid #30363d' }}>
                                                    {rawOutput}
                                                </pre>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {loading && <div style={{ textAlign: 'center', padding: '10px' }}><Activity size={16} color="var(--accent-gold)" style={{ animation: 'spin 2s linear infinite' }} /></div>}
                        </div>
                        <button onClick={() => setStep('search')} className="auth-submit-btn" style={{ background: 'transparent', width: 'auto', marginTop: '16px', color: '#f85149' }}>Back to Search</button>
                    </div>
                )}
                {step === 'credentials' && (
                    <form onSubmit={handleFinalize}>
                        {manualMode ? (
                            <>
                                <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '24px' }}>Enter the exact folder path to mount.</p>
                                <label className="m-label">Full UNC Path</label>
                                <input name="manualPath" placeholder="\\10.10.20.23\Shared\SpecificFolder" className="m-input" required autoFocus />
                                <label className="m-label">Identify As (Label)</label>
                                <input name="manualLabel" placeholder="Work Shared Drive" className="m-input" required />
                            </>
                        ) : (
                            <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '24px' }}>Connecting to <b>\\{ip}\{selectedShare}</b>. Enter credentials if required.</p>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label className="m-label">Username</label>
                                <input name="username" placeholder="Optional" className="m-input" />
                            </div>
                            <div>
                                <label className="m-label">Password</label>
                                <input name="password" type="password" placeholder="Passkey" className="m-input" />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            <button type="submit" className="auth-submit-btn">Execute Mount</button>
                            <button type="button" onClick={() => {
                                if (manualMode) setStep('search');
                                else setStep('select');
                            }} className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }}>Back</button>
                            <button type="button" onClick={onClose} className="auth-submit-btn" style={{ background: 'transparent', color: '#484f58' }}>Cancel</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default MountModal;
