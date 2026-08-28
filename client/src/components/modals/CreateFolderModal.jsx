import React from 'react';

const CreateFolderModal = ({ show, onClose, onSubmit }) => {
    if (!show) return null;
    return (
        <div className="modal-overlay">
            <form className="modal-content glass" style={{ width: '320px' }} onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e.target.folderName.value);
            }}>
                <h3>New Folder</h3>
                <input name="folderName" className="m-input" placeholder="Folder name" autoFocus required style={{ marginTop: '20px' }} />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="submit" className="auth-submit-btn">Create</button>
                    <button type="button" className="auth-submit-btn" style={{ background: 'transparent', color: '#f85149' }} onClick={onClose}>Cancel</button>
                </div>
            </form>
        </div>
    );
};

export default CreateFolderModal;
