import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Image as ImageIcon, Video, File, ZoomOut, ZoomIn, Save, Download, X,
    ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

const API_BASE = '/api';

const MediaPreviewModal = ({ media, onClose, onDownload, onNext, onPrev, showToast }) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    const [textContent, setTextContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEdited, setIsEdited] = useState(false);

    const lineCounterRef = useRef(null);
    const textareaRef = useRef(null);

    // Reset zoom and offset when media changes
    useEffect(() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    }, [media?.path]);

    // Reset offset when zoom is reset to 1
    useEffect(() => {
        if (zoom === 1) setOffset({ x: 0, y: 0 });
    }, [zoom]);

    const tok = localStorage.getItem('token') || localStorage.getItem('guestToken') || '';
    let mediaUrl = '';
    if (media) {
        mediaUrl = `${API_BASE}/files/download?path=${encodeURIComponent(media.path)}&token=${tok}`;
        if (media.agentId) mediaUrl += `&agentId=${media.agentId}`;
    }

    const isGuest = !localStorage.getItem('token');

    useEffect(() => {
        if (media && media.type === 'text') {
            setIsLoading(true);
            setTextContent('');
            setIsEdited(false);
            axios.get(mediaUrl)
                .then(res => {
                    const dataStr = typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : res.data;
                    setTextContent(dataStr || '');
                })
                .catch(err => {
                    console.error('Failed to load text content', err);
                    if (showToast) showToast('Failed to load text content', 'error');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [media?.path, mediaUrl]);

    if (!media) return null;

    const handleSave = async () => {
        if (isGuest || !isEdited || isSaving) return;
        setIsSaving(true);
        try {
            const token = localStorage.getItem('token') || '';
            await axios.post(`${API_BASE}/files/save`, {
                path: media.path,
                content: textContent,
                agentId: media.agentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEdited(false);
            if (showToast) showToast('File saved successfully', 'success');
        } catch (err) {
            console.error('Failed to save file', err);
            const errMsg = err.response?.data?.error || err.message || 'Unknown error';
            if (showToast) showToast(`Failed to save file: ${errMsg}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const checkUnsaved = (callback) => {
        if (isEdited) {
            if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                callback();
            }
        } else {
            callback();
        }
    };

    const handleClose = () => checkUnsaved(onClose);
    const handleNext = (e) => checkUnsaved(() => onNext(e));
    const handlePrev = (e) => checkUnsaved(() => onPrev(e));

    const handleScroll = () => {
        if (lineCounterRef.current && textareaRef.current) {
            lineCounterRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
    const handleResetZoom = () => setZoom(1);

    const handleMouseDown = (e) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        setLastPos({ x: e.clientX, y: e.clientY });
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!isDragging || zoom <= 1) return;
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastPos({ x: e.clientX, y: e.clientY });
    };

    const stopDragging = () => setIsDragging(false);

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="media-preview-container" onClick={(e) => e.stopPropagation()}>
                <div className="media-preview-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ flexShrink: 0 }}>
                            {media.type === 'image' ? (
                                <ImageIcon size={24} color="var(--accent-gold)" />
                            ) : media.type === 'video' ? (
                                <Video size={24} color="var(--accent-gold)" />
                            ) : (
                                <File size={24} color="var(--accent-gold)" />
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ margin: 0, fontSize: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.name}</h3>
                            <p style={{ margin: 0, fontSize: '12px', color: '#8b949e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.path}</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                        {media.type === 'image' && (
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px' }}>
                                <button className="nav-btn-preview" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={20} /></button>
                                <button className="nav-btn-preview" style={{ width: 'auto', padding: '0 8px', fontSize: '12px', fontWeight: 'bold' }} onClick={handleResetZoom}>{Math.round(zoom * 100)}%</button>
                                <button className="nav-btn-preview" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={20} /></button>
                            </div>
                        )}
                        {!isGuest && media.type === 'text' && (
                            <button 
                                className="btn-primary shadow-premium" 
                                onClick={handleSave} 
                                disabled={isSaving || !isEdited}
                                style={{ 
                                    opacity: !isEdited ? 0.6 : 1, 
                                    cursor: !isEdited ? 'not-allowed' : 'pointer',
                                    border: isEdited ? '1px solid var(--accent-gold)' : 'none',
                                    boxShadow: isEdited ? '0 0 12px var(--accent-gold-glow)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Save size={16} /> {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}
                        <button className="btn-primary" onClick={() => onDownload(media)}>
                            <Download size={16} /> Download
                        </button>
                        <button className="btn-outline" onClick={handleClose}>
                            <X size={16} /> Close
                        </button>
                    </div>
                </div>
                <div className="media-preview-content">
                    <button className="side-nav-preview prev" onClick={handlePrev}><ChevronLeft size={48} /></button>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', height: '100%', width: '100%' }}>
                        {media.type === 'image' ? (
                            <img
                                key={mediaUrl}
                                src={mediaUrl}
                                alt={media.name}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={stopDragging}
                                onMouseLeave={stopDragging}
                                style={{
                                    width: zoom > 1 ? 'auto' : 'auto',
                                    height: zoom > 1 ? 'auto' : 'auto',
                                    maxWidth: zoom > 1 ? 'none' : '100%',
                                    maxHeight: zoom > 1 ? 'none' : '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                    margin: 'auto',
                                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                                    transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)',
                                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                    userSelect: 'none',
                                    WebkitUserDrag: 'none',
                                    touchAction: 'none'
                                }}
                            />
                        ) : media.type === 'video' ? (
                            <video
                                src={mediaUrl}
                                controls
                                autoPlay
                                style={{ maxHeight: '100%', maxWidth: '100%', pointerEvents: 'auto' }}
                            />
                        ) : (
                            <div style={{ width: '100%', height: '100%', padding: '24px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                                {isLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--accent-gold)', gap: '12px' }}>
                                        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={24} />
                                        <span>Loading contents...</span>
                                    </div>
                                ) : (
                                    <div className="code-editor-container" style={{
                                        display: 'flex',
                                        width: '100%',
                                        height: '100%',
                                        background: '#070a13',
                                        borderRadius: '16px',
                                        border: '1px solid var(--border-bright)',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                    }}>
                                        <div 
                                            ref={lineCounterRef}
                                            className="line-numbers"
                                            style={{
                                                width: '50px',
                                                padding: '16px 8px',
                                                background: 'rgba(0, 0, 0, 0.3)',
                                                color: '#8b949e',
                                                textAlign: 'right',
                                                userSelect: 'none',
                                                overflow: 'hidden',
                                                borderRight: '1px solid var(--border-dim)',
                                                whiteSpace: 'pre',
                                                fontFamily: 'Consolas, Monaco, monospace',
                                                fontSize: '14px',
                                                lineHeight: '1.5'
                                            }}
                                        >
                                            {textContent.split('\n').map((_, idx) => idx + 1).join('\n')}
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            value={textContent}
                                            onChange={(e) => {
                                                setTextContent(e.target.value);
                                                setIsEdited(true);
                                            }}
                                            onScroll={handleScroll}
                                            readOnly={isGuest}
                                            spellCheck="false"
                                            style={{
                                                flex: 1,
                                                background: 'transparent',
                                                color: '#e6edf3',
                                                border: 'none',
                                                outline: 'none',
                                                padding: '16px',
                                                resize: 'none',
                                                fontFamily: 'Consolas, Monaco, monospace',
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                                overflowY: 'auto',
                                                whiteSpace: 'pre',
                                                wordWrap: 'normal'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <button className="side-nav-preview next" onClick={handleNext}><ChevronRight size={48} /></button>
                </div>
            </div>
        </div>
    );
};

export default MediaPreviewModal;
