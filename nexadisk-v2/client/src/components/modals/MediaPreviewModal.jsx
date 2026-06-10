import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Image as ImageIcon, Video, File, ZoomOut, ZoomIn, Save, Download, X,
    ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';

const API_BASE = '/api';

const MediaPreviewModal = ({ media, onClose, onDownload, onNext, onPrev, showToast, shareId }) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

    const [textContent, setTextContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEdited, setIsEdited] = useState(false);
    const [mdMode, setMdMode] = useState('split'); // 'edit', 'split', 'preview'

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

    const tok = localStorage.getItem('token') || '';
    const isGuest = !tok;
    let mediaUrl = '';
    if (media) {
        if (shareId) {
            mediaUrl = `${API_BASE}/share/stream?filePath=${encodeURIComponent(media.path)}&token=${shareId}`;
        } else {
            mediaUrl = `${API_BASE}/files/download?path=${encodeURIComponent(media.path)}&token=${tok}`;
            if (media.agentId) mediaUrl += `&agentId=${media.agentId}`;
        }
    }

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
                                    (() => {
                                        const isMarkdown = media.name?.toLowerCase().endsWith('.md');
                                        const parsedHtml = isMarkdown ? (() => {
                                            if (!textContent) return '';
                                            let html = textContent;

                                            // Escape basic tags to prevent broken layout
                                            html = html
                                                .replace(/&/g, '&amp;')
                                                .replace(/</g, '&lt;')
                                                .replace(/>/g, '&gt;');

                                            // Fenced code blocks
                                            html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
                                                return `<pre style="background: rgba(0,0,0,0.5); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); font-family: 'Consolas', 'Monaco', monospace; overflow-x: auto; margin: 16px 0; white-space: pre-wrap; color: #a9b1d6; font-size: 13px; text-align: left;"><code>${code.trim()}</code></pre>`;
                                            });

                                            // Inline code
                                            html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 3px 6px; border-radius: 6px; font-family: \'Consolas\', \'Monaco\', monospace; color: #f2c94c; font-size: 13px;">$1</code>');

                                            // Headers
                                            html = html.replace(/^######\s+(.+)$/gm, '<h6 style="font-size: 13px; font-weight: 700; margin: 16px 0 8px; color: #fff; text-align: left;">$1</h6>');
                                            html = html.replace(/^#####\s+(.+)$/gm, '<h5 style="font-size: 14px; font-weight: 700; margin: 18px 0 8px; color: #fff; text-align: left;">$1</h5>');
                                            html = html.replace(/^####\s+(.+)$/gm, '<h4 style="font-size: 16px; font-weight: 700; margin: 20px 0 10px; color: #fff; text-align: left;">$1</h4>');
                                            html = html.replace(/^###\s+(.+)$/gm, '<h3 style="font-size: 18px; font-weight: 700; margin: 22px 0 12px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; text-align: left;">$1</h3>');
                                            html = html.replace(/^##\s+(.+)$/gm, '<h2 style="font-size: 22px; font-weight: 800; margin: 26px 0 14px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; text-align: left;">$1</h2>');
                                            html = html.replace(/^#\s+(.+)$/gm, '<h1 style="font-size: 26px; font-weight: 800; margin: 30px 0 16px; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; text-align: left;">$1</h1>');

                                            // Blockquotes
                                            html = html.replace(/^\s*&gt;\s+(.+)$/gm, '<blockquote style="border-left: 4px solid var(--accent-gold); padding: 8px 16px; margin: 16px 0; color: #8b949e; background: rgba(242,201,76,0.03); border-radius: 0 8px 8px 0; text-align: left;">$1</blockquote>');

                                            // Bold & Italic
                                            html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #fff;">$1</strong>');
                                            html = html.replace(/__([^_]+)__/g, '<strong style="color: #fff;">$1</strong>');
                                            html = html.replace(/\*([^*]+)\*/g, '<em style="color: #c9d1d9;">$1</em>');
                                            html = html.replace(/_([^_]+)_/g, '<em style="color: #c9d1d9;">$1</em>');

                                            // Horizontal Rules
                                            html = html.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;" />');

                                            // Images
                                            html = html.replace(/!\[([^\]]*)]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); margin: 16px 0; display: block;" />');

                                            // Links
                                            html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: none; border-bottom: 1px dashed var(--accent-cyan); font-weight: 600;">$1</a>');

                                            // Lists
                                            html = html.replace(/^\s*[-\*+]\s+(.+)$/gm, '<li style="margin-left: 20px; list-style-type: disc; color: #c9d1d9; line-height: 1.6; margin-bottom: 6px; text-align: left;">$1</li>');
                                            html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li style="margin-left: 20px; list-style-type: decimal; color: #c9d1d9; line-height: 1.6; margin-bottom: 6px; text-align: left;">$1</li>');

                                            // Paragraph splits
                                            const lines = html.split('\n');
                                            const processedLines = lines.map(line => {
                                                const trimmed = line.trim();
                                                if (!trimmed) return '<div style="height: 10px;"></div>';
                                                if (line.startsWith('<h') || line.startsWith('<pre') || line.startsWith('<code') || line.startsWith('<blockquote') || line.startsWith('<li') || line.startsWith('<hr') || line.startsWith('<div')) {
                                                    return line;
                                                }
                                                return `<p style="margin: 10px 0; line-height: 1.6; color: #c9d1d9; text-align: left;">${line}</p>`;
                                            });

                                            return processedLines.join('\n');
                                        })() : '';

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                                                {isMarkdown && (
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px 12px', borderRadius: '8px', width: 'fit-content', border: '1px solid var(--border-dim)' }}>
                                                        <button 
                                                            onClick={() => setMdMode('edit')}
                                                            style={{
                                                                background: mdMode === 'edit' ? 'var(--accent-gold-glow)' : 'transparent',
                                                                color: mdMode === 'edit' ? 'var(--accent-gold)' : '#8b949e',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            Editor Only
                                                        </button>
                                                        <button 
                                                            onClick={() => setMdMode('split')}
                                                            style={{
                                                                background: mdMode === 'split' ? 'var(--accent-gold-glow)' : 'transparent',
                                                                color: mdMode === 'split' ? 'var(--accent-gold)' : '#8b949e',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            Split View
                                                        </button>
                                                        <button 
                                                            onClick={() => setMdMode('preview')}
                                                            style={{
                                                                background: mdMode === 'preview' ? 'var(--accent-gold-glow)' : 'transparent',
                                                                color: mdMode === 'preview' ? 'var(--accent-gold)' : '#8b949e',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s'
                                                            }}
                                                        >
                                                            Preview Only
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', flex: 1, gap: '20px', overflow: 'hidden', height: '100%', width: '100%' }}>
                                                    {/* Raw Code Editor Column */}
                                                    {(!isMarkdown || mdMode === 'edit' || mdMode === 'split') && (
                                                        <div className="code-editor-container" style={{
                                                            display: 'flex',
                                                            flex: 1,
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

                                                    {/* Compiled Markdown Preview Column */}
                                                    {isMarkdown && (mdMode === 'preview' || mdMode === 'split') && (
                                                        <div className="glass" style={{
                                                            flex: 1,
                                                            height: '100%',
                                                            background: 'rgba(13,17,23,0.7)',
                                                            borderRadius: '16px',
                                                            border: '1px solid var(--border-bright)',
                                                            padding: '24px 32px',
                                                            overflowY: 'auto',
                                                            boxSizing: 'border-box',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                                                            fontFamily: 'Inter, sans-serif'
                                                        }}
                                                            dangerouslySetInnerHTML={{ __html: parsedHtml }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })() )}
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
