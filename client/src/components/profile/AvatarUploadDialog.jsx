import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check } from 'lucide-react';
import axios from 'axios';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
    return centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
        mediaWidth,
        mediaHeight
    );
}

const AvatarUploadDialog = ({ user, onClose, onSuccess }) => {
    const [imgSrc, setImgSrc] = useState('');
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const imgRef = useRef(null);
    const fileInputRef = useRef(null);

    const onSelectFile = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert('File is too large (Max 5MB)');
                return;
            }
            setCrop(undefined);
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
            reader.readAsDataURL(file);
        }
    };

    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height, 1));
    };

    const handleSave = async () => {
        if (!completedCrop || !imgRef.current) return;
        
        setIsUploading(true);
        try {
            const image = imgRef.current;
            const canvas = document.createElement('canvas');
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            const ctx = canvas.getContext('2d');

            canvas.width = completedCrop.width * scaleX;
            canvas.height = completedCrop.height * scaleY;

            ctx.drawImage(
                image,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0,
                0,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY
            );

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('Canvas is empty');
                
                const formData = new FormData();
                formData.append('avatar', blob, 'avatar.png');

                const res = await axios.post('/api/v1/profile/avatar', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (res.data.success) {
                    onSuccess(res.data);
                }
            }, 'image/png');
        } catch (err) {
            alert(err.response?.data?.error || err.message || 'Upload failed');
            setIsUploading(false);
        }
    };

    const styles = {
        overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
        modal: { background: 'var(--bg-surface-0)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', color: 'var(--text-secondary)' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
        title: { margin: 0, fontSize: '18px', color: 'var(--text-primary)' },
        closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' },
        uploadBox: { border: '2px dashed #30363d', borderRadius: '8px', padding: '40px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: '20px' },
        actions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' },
        btnCancel: { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' },
        btnSave: { background: '#238636', border: 'none', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h2 style={styles.title}>Update Profile Photo</h2>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>

                {!imgSrc ? (
                    <div 
                        style={styles.uploadBox} 
                        onClick={() => fileInputRef.current?.click()}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#58a6ff'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#30363d'}
                    >
                        <Upload size={32} color="#8b949e" style={{ marginBottom: '12px' }} />
                        <div>Click or drag image to upload</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>JPG, PNG or WEBP (Max 5MB)</div>
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-surface-0)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}>
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={1}
                            circularCrop
                        >
                            <img
                                ref={imgRef}
                                alt="Crop me"
                                src={imgSrc}
                                style={{ maxHeight: '400px' }}
                                onLoad={onImageLoad}
                            />
                        </ReactCrop>
                    </div>
                )}

                <input type="file" accept="image/jpeg, image/png, image/webp" ref={fileInputRef} onChange={onSelectFile} style={{ display: 'none' }} />

                <div style={styles.actions}>
                    {imgSrc && <button onClick={() => setImgSrc('')} style={styles.btnCancel}>Choose Another</button>}
                    <button onClick={onClose} style={styles.btnCancel}>Cancel</button>
                    <button onClick={handleSave} style={{ ...styles.btnSave, opacity: (!completedCrop || isUploading) ? 0.5 : 1 }} disabled={!completedCrop || isUploading}>
                        {isUploading ? 'Uploading...' : <><Check size={16} /> Save Photo</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarUploadDialog;
