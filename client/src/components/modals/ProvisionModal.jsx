import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Download } from 'lucide-react';

const ProvisionModal = ({ show, onClose }) => {
    if (!show) return null;
    const [os, setOs] = useState('windows');

    const handleDownload = () => {
        window.open(`/api/provision/download/${os}?token=${localStorage.getItem('token')}`);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content glass" style={{ width: '450px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Plus size={20} color="var(--accent-gold)" /> Provision New Node
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '13px', color: '#8b949e', marginBottom: '16px' }}>Select the target Operating System to download the pre-configured Agent package.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div
                            onClick={() => setOs('windows')}
                            style={{
                                padding: '16px', borderRadius: '12px', border: '1px solid',
                                borderColor: os === 'windows' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                background: os === 'windows' ? 'rgba(242,201,76,0.05)' : 'rgba(0,0,0,0.2)',
                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="24" height="24" fill={os === 'windows' ? 'var(--accent-gold)' : '#8b949e'} style={{ marginBottom: '8px' }}>
                                <path d="M0 3.449L9.75 2.1V11.4H0V3.449zm0 8.851h9.75v9.3L0 20.25V12.3zm10.5-10.35L24 0v11.4h-13.5V1.95zM10.5 12.3H24V24l-13.5-1.95V12.3z" />
                            </svg>
                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Windows</div>
                        </div>

                        <div
                            onClick={() => setOs('linux')}
                            style={{
                                padding: '16px', borderRadius: '12px', border: '1px solid',
                                borderColor: os === 'linux' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                                background: os === 'linux' ? 'rgba(86,204,242,0.05)' : 'rgba(0,0,0,0.2)',
                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="24" height="24" fill={os === 'linux' ? 'var(--accent-cyan)' : '#8b949e'} style={{ marginBottom: '8px' }}>
                                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                            </svg>
                            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Linux</div>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>Setup Instructions</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#8b949e', lineHeight: '1.6' }}>
                        <li>Extract the downloaded ZIP package</li>
                        <li>Run <code style={{ color: '#fff' }}>{os === 'windows' ? 'install.ps1' : 'install.sh'}</code> as {os === 'windows' ? 'Administrator' : 'root'}</li>
                        <li>Installer will handle Node.js, Firewall & Services</li>
                        <li>Refresh dashboard to see the new node</li>
                    </ul>
                </div>

                <button
                    onClick={handleDownload}
                    className="auth-submit-btn"
                    style={{ background: os === 'windows' ? 'var(--accent-gold)' : 'var(--accent-cyan)', color: '#000' }}
                >
                    <Download size={18} style={{ marginRight: '8px' }} /> Download Setup Package
                </button>
            </motion.div>
        </div>
    );
};

export default ProvisionModal;
