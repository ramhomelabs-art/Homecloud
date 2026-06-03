import React, { useState } from 'react';

const RenameModal = ({ data, onClose, onRename }) => {
    if (!data) return null;
    const [val, setVal] = useState(data.name);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRenameClick = async (e) => {
        if (e) e.preventDefault();
        if (!val || val.trim() === '') return;
        setLoading(true);
        setError('');
        try {
            await onRename(val);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to rename');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass" style={{ width: '320px' }} onClick={e => e.stopPropagation()}>
                <h3>Rename Item</h3>
                {error && <div style={{ color: '#f85149', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
                <form onSubmit={handleRenameClick}>
                    <input
                        className="m-input"
                        value={val}
                        onChange={e => setVal(e.target.value)}
                        autoFocus
                        style={{ marginTop: '20px', width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                        <button type="submit" className="auth-submit-btn" disabled={loading}>
                            {loading ? 'Renaming...' : 'Rename'}
                        </button>
                        <button type="button" className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }} onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenameModal;
