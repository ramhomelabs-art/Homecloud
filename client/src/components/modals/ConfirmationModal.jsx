import React from 'react';

const ConfirmationModal = ({ show, message, onClose, onConfirm }) => {
    if (!show) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '380px', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Confirmation</h3>
                <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>{message}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={onClose} style={{ flex: 1, color: '#f85149', borderColor: 'rgba(248, 81, 73, 0.2)' }}>Cancel</button>
                    <button className="btn-danger" onClick={onConfirm} style={{ flex: 1 }}>Confirm</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
