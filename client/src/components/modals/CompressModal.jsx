import React, { useState } from 'react';

const CompressModal = ({ show, onClose, onSubmit, defaultName = 'archive' }) => {
    if (!show) return null;
    const [name, setName] = useState(defaultName);
    const [format, setFormat] = useState('zip');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        onSubmit(name, format);
    };

    return (
        <div className="modal-overlay">
            <form className="modal-content glass" style={{ width: '360px' }} onSubmit={handleFormSubmit}>
                <h3>Create Archive</h3>
                <div style={{ marginTop: '20px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Archive Name</label>
                    <input 
                        className="m-input" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="Archive name" 
                        autoFocus 
                        required 
                    />
                </div>
                <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Archive Format</label>
                    <select 
                        className="m-input" 
                        value={format} 
                        onChange={(e) => setFormat(e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '8px', borderRadius: '4px', outline: 'none' }}
                    >
                        <option value="zip">.zip (Standard ZIP)</option>
                        <option value="tar.gz">.tar.gz (Gzipped Tarball)</option>
                        <option value="tar">.tar (Tape Archive)</option>
                        <option value="7z">.7z (7-Zip Archive)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                    <button type="submit" className="auth-submit-btn">Compress</button>
                    <button type="button" className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }} onClick={onClose}>Cancel</button>
                </div>
            </form>
        </div>
    );
};

export default CompressModal;
