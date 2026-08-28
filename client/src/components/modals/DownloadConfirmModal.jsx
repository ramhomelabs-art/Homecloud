import React from 'react';
import { Download, File } from 'lucide-react';

const DownloadConfirmModal = ({ file, onClose, onConfirm }) => {
    if (!file) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content glass" style={{ width: '400px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <Download size={48} color="var(--accent-gold)" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ marginBottom: '12px' }}>Download File</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Do you want to download this file?</p>
                </div>
                <div style={{ background: 'var(--bg-surface-2)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <File size={32} color="#8b949e" />
                        <div style={{ flex: 1, textAlign: 'left' }}>
                            <div style={{ fontWeight: '600', marginBottom: '4px' }}>{file.name}</div>
                            <div style={{ fontSize: '12px', color: '#484f58' }}>{file.path}</div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="auth-submit-btn" onClick={() => onConfirm(file)}>Download</button>
                    <button className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }} onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
};

export default DownloadConfirmModal;
