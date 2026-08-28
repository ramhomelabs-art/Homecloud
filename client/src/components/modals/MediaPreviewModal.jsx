import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Image as ImageIcon, Video, File, ZoomOut, ZoomIn, Save, Download, X,
    ChevronLeft, ChevronRight, RefreshCw, FileText, ExternalLink, Printer,
    RotateCw, BookOpen, Eye, Music
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

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
    const tok = localStorage.getItem('token') || '';
    const isGuest = !tok || !!shareId || !!localStorage.getItem('guestToken');
    const [mdMode, setMdMode] = useState(isGuest ? 'preview' : 'split'); // 'edit', 'split', 'preview'
    const [pendingDiscardAction, setPendingDiscardAction] = useState(null);

    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    const lineCounterRef = useRef(null);
    const textareaRef = useRef(null);
    const pdfFrameRef = useRef(null);

    // Reset zoom and offset when media changes
    useEffect(() => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    }, [media?.path]);

    // Reset offset when zoom is reset to 1
    useEffect(() => {
        if (zoom === 1) setOffset({ x: 0, y: 0 });
    }, [zoom]);
    let mediaUrl = '';
    if (media) {
        if (shareId) {
            mediaUrl = `${API_BASE}/share/stream?filePath=${encodeURIComponent(media.path)}&token=${shareId}&intent=stream`;
        } else {
            mediaUrl = `${API_BASE}/files/download?path=${encodeURIComponent(media.path)}&token=${tok}&intent=stream`;
            if (media.agentId) mediaUrl += `&agentId=${media.agentId}`;
        }
    }

    const isPdf = media?.type === 'pdf' || (media?.name && media.name.toLowerCase().endsWith('.pdf'));

    // Fetch PDF as blob for secure and CSP-free iframe viewing
    useEffect(() => {
        let active = true;
        let createdUrl = null;
        if (isPdf && mediaUrl) {
            setPdfLoading(true);
            setPdfError(null);
            setPdfBlobUrl(null);
            axios.get(mediaUrl, { responseType: 'blob' })
                .then(res => {
                    if (!active) return;
                    const blob = new Blob([res.data], { type: 'application/pdf' });
                    createdUrl = URL.createObjectURL(blob);
                    setPdfBlobUrl(createdUrl);
                })
                .catch(err => {
                    if (!active) return;
                    console.error('Failed to load PDF blob', err);
                    setPdfError(err.response?.data?.error || err.message || 'Failed to load PDF document');
                })
                .finally(() => {
                    if (active) setPdfLoading(false);
                });
        }
        return () => {
            active = false;
            if (createdUrl) {
                URL.revokeObjectURL(createdUrl);
            }
        };
    }, [media?.path, mediaUrl, isPdf]);

    useEffect(() => {
        if (media && media?.type === 'text') {
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
    }, [media?.path, mediaUrl, media?.type]);

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

    // Hotkey handler: Ctrl+S / Cmd+S to save changes
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                if (media?.type === 'text' && !isGuest && isEdited && !isSaving) {
                    handleSave();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [media, isGuest, isEdited, isSaving, textContent]);

    const handleTextareaKeyDown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            const spaces = '  '; // 2 spaces standard for yaml/linux configs
            const updated = textContent.substring(0, start) + spaces + textContent.substring(end);
            setTextContent(updated);
            setIsEdited(true);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + spaces.length;
                }
            }, 0);
        }
    };

    const getFileLanguageBadge = (filename) => {
        if (!filename) return 'TEXT';
        const lower = filename.toLowerCase();
        const ext = lower.includes('.') ? lower.split('.').pop() : '';
        
        if (ext === 'yml' || ext === 'yaml') return 'YAML';
        if (ext === 'json' || ext === 'json5' || ext === 'jsonc') return 'JSON';
        if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || ext === 'fish') return 'BASH / SHELL';
        if (ext === 'py' || ext === 'pyw') return 'PYTHON';
        if (ext === 'js' || ext === 'mjs' || ext === 'cjs' || ext === 'jsx') return 'JAVASCRIPT';
        if (ext === 'ts' || ext === 'tsx' || ext === 'mts' || ext === 'cts') return 'TYPESCRIPT';
        if (ext === 'service' || ext === 'timer' || ext === 'mount' || ext === 'socket') return 'SYSTEMD';
        if (ext === 'toml') return 'TOML';
        if (ext === 'ini' || ext === 'conf' || ext === 'config' || ext === 'cfg' || ext === 'cnf') return 'CONFIG';
        if (ext === 'env' || lower.startsWith('.env')) return 'ENV';
        if (ext === 'dockerfile' || lower === 'dockerfile' || lower === 'containerfile') return 'DOCKERFILE';
        if (lower === 'makefile' || lower === 'gnumakefile') return 'MAKEFILE';
        if (ext === 'sql') return 'SQL';
        if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') return 'CSS';
        if (ext === 'html' || ext === 'htm' || ext === 'svg' || ext === 'xml') return 'MARKUP';
        if (ext === 'md' || ext === 'markdown') return 'MARKDOWN';
        if (ext === 'rs' || ext === 'rust') return 'RUST';
        if (ext === 'go') return 'GOLANG';
        if (ext === 'c' || ext === 'h' || ext === 'cpp' || ext === 'hpp') return 'C/C++';
        if (ext === 'java') return 'JAVA';
        if (ext === 'php') return 'PHP';
        if (ext === 'rb') return 'RUBY';
        if (ext === 'ps1' || ext === 'psm1') return 'POWERSHELL';
        if (lower.startsWith('.')) return 'DOTFILE';
        return (ext || 'FILE').toUpperCase();
    };

    const checkUnsaved = (callback) => {
        if (isEdited) {
            setPendingDiscardAction(() => callback);
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

    const handleOpenInNewTab = () => {
        window.open(pdfBlobUrl || mediaUrl, '_blank');
    };

    const handlePrintPdf = () => {
        if (pdfFrameRef.current) {
            try {
                pdfFrameRef.current.contentWindow.print();
                return;
            } catch (e) {}
        }
        window.open(pdfBlobUrl || mediaUrl, '_blank');
    };

    const lineCount = textContent ? textContent.split('\n').length : 0;
    const charCount = textContent ? textContent.length : 0;

    if (!media) return null;

    return (
        <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 99999 }}>
            <div className="media-preview-container" onClick={(e) => e.stopPropagation()} style={{ width: '94vw', maxWidth: '1360px', height: '90vh', maxHeight: '960px', background: 'var(--bg-surface-0)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-subtle)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {/* Modal Header */}
                <div className="media-preview-header" style={{ padding: '14px 20px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ 
                            width: '38px', 
                            height: '38px', 
                            borderRadius: '10px', 
                            background: isPdf ? 'rgba(244, 63, 94, 0.12)' : media?.type === 'image' ? 'rgba(99, 102, 241, 0.12)' : media?.type === 'video' ? 'rgba(217, 119, 6, 0.12)' : media?.type === 'audio' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(14, 165, 233, 0.12)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: `1px solid ${isPdf ? 'rgba(244, 63, 94, 0.25)' : 'var(--border-subtle)'}`,
                            flexShrink: 0 
                        }}>
                            {isPdf ? (
                                <FileText size={20} color="#f43f5e" />
                            ) : media?.type === 'image' ? (
                                <ImageIcon size={20} color="var(--primary)" />
                            ) : media?.type === 'video' ? (
                                <Video size={20} color="var(--accent-gold)" />
                            ) : media?.type === 'audio' ? (
                                <Music size={20} color="#10b981" />
                            ) : (
                                <File size={20} color="var(--accent-cyan)" />
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {media?.name}
                                </h3>
                                {isPdf ? (
                                    <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        PDF Viewer
                                    </span>
                                ) : media?.type === 'text' ? (
                                    <>
                                        <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(14, 165, 233, 0.15)', color: 'var(--accent-cyan)', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {getFileLanguageBadge(media?.name)}
                                        </span>
                                        {isGuest && (
                                            <span style={{ fontSize: '10px', fontWeight: '800', background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                🔒 Read Only
                                            </span>
                                        )}
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                            {lineCount} lines • {charCount.toLocaleString()} chars
                                        </span>
                                        {!isGuest && isEdited && (
                                            <span style={{ fontSize: '10px', fontWeight: '700', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                                                Unsaved (Ctrl+S)
                                            </span>
                                        )}
                                    </>
                                ) : null}
                            </div>
                            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
                                {media?.path}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {media?.type === 'image' && (
                            <div style={{ display: 'flex', background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
                                <button className="nav-btn-preview" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={16} /></button>
                                <button className="nav-btn-preview" style={{ width: 'auto', padding: '0 8px', fontSize: '11px', fontWeight: 'bold' }} onClick={handleResetZoom}>{Math.round(zoom * 100)}%</button>
                                <button className="nav-btn-preview" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={16} /></button>
                            </div>
                        )}

                        {isPdf && (
                            <>
                                <button
                                    className="btn-secondary"
                                    onClick={handleOpenInNewTab}
                                    style={{ padding: '7px 12px', fontSize: '12px', fontWeight: '700' }}
                                    title="Open in new browser tab"
                                >
                                    <ExternalLink size={14} /> Open in Tab
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={handlePrintPdf}
                                    style={{ padding: '7px 12px', fontSize: '12px', fontWeight: '700' }}
                                    title="Print Document"
                                >
                                    <Printer size={14} /> Print
                                </button>
                            </>
                        )}

                        {!isGuest && media?.type === 'text' && (
                            <button 
                                className="btn-primary shadow-premium" 
                                onClick={handleSave} 
                                disabled={isSaving || !isEdited}
                                style={{ 
                                    opacity: !isEdited ? 0.6 : 1, 
                                    cursor: !isEdited ? 'not-allowed' : 'pointer',
                                    border: isEdited ? '1px solid var(--accent-gold)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '7px 14px',
                                    fontSize: '12px'
                                }}
                            >
                                <Save size={14} /> {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        )}

                        <button 
                            className="btn-primary" 
                            onClick={() => onDownload(media)}
                            style={{ padding: '7px 14px', fontSize: '12px' }}
                        >
                            <Download size={14} /> Download
                        </button>
                        <button 
                            className="btn-outline" 
                            onClick={handleClose}
                            style={{ padding: '7px 12px', fontSize: '12px' }}
                        >
                            <X size={14} /> Close
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="media-preview-content" style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface-2)', width: '100%', height: 'calc(100% - 65px)' }}>
                    {media?.type !== 'text' && !isPdf && onPrev && (
                        <button className="side-nav-preview prev" onClick={handlePrev} title="Previous file">
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', height: '100%', width: '100%' }}>
                        {isPdf ? (
                            /* PDF EMBEDDED VIEWER */
                            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', position: 'relative' }}>
                                {pdfLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--primary)', gap: '12px' }}>
                                        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={24} />
                                        <span style={{ fontWeight: '700', color: '#f8fafc' }}>Loading PDF document...</span>
                                    </div>
                                ) : pdfError ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', padding: '32px', textAlign: 'center' }}>
                                        <FileText size={48} color="#f43f5e" />
                                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>Unable to preview PDF document</div>
                                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>{pdfError}</div>
                                        <button className="btn-primary" onClick={() => onDownload(media)}>
                                            <Download size={14} /> Download PDF
                                        </button>
                                    </div>
                                ) : pdfBlobUrl ? (
                                    <iframe
                                        ref={pdfFrameRef}
                                        key={pdfBlobUrl}
                                        src={`${pdfBlobUrl}#toolbar=1&navpanes=1`}
                                        title={media?.name || 'PDF Document'}
                                        width="100%"
                                        height="100%"
                                        style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a' }}
                                    />
                                ) : null}
                            </div>
                        ) : media?.type === 'image' ? (
                            <img
                                key={mediaUrl}
                                src={mediaUrl}
                                alt={media?.name || 'Image'}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={stopDragging}
                                onMouseLeave={stopDragging}
                                style={{
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
                        ) : media?.type === 'video' ? (
                            <video
                                src={mediaUrl}
                                controls
                                autoPlay
                                style={{ maxHeight: '100%', maxWidth: '100%', pointerEvents: 'auto' }}
                            />
                        ) : media?.type === 'audio' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', padding: '40px', background: 'var(--bg-surface-0)', borderRadius: '16px', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                                    <Music size={32} color="#10b981" />
                                </div>
                                <div style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', textAlign: 'center', wordBreak: 'break-all' }}>
                                    {media?.name}
                                </div>
                                <audio
                                    src={mediaUrl}
                                    controls
                                    autoPlay
                                    style={{ width: '360px', pointerEvents: 'auto' }}
                                />
                            </div>
                        ) : (
                            <div style={{ width: '100%', height: '100%', padding: '16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: 'var(--bg-surface-2)' }}>
                                {isLoading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--primary)', gap: '12px' }}>
                                        <RefreshCw style={{ animation: 'spin 1s linear infinite' }} size={24} />
                                        <span style={{ fontWeight: '700' }}>Loading file contents...</span>
                                    </div>
                                ) : (
                                    (() => {
                                        const isMarkdown = media?.name?.toLowerCase().endsWith('.md');
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
                                            html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, (match, text, url) => {
                                                const cleanUrl = url.trim();
                                                if (/^javascript:/i.test(cleanUrl)) {
                                                    return `<span style="color: #ff7b72; font-weight: 600;">${text} (insecure link)</span>`;
                                                }
                                                return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: none; border-bottom: 1px dashed var(--accent-cyan); font-weight: 600;">${text}</a>`;
                                            });

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
                                                {isMarkdown && !isGuest && (
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'var(--bg-surface-0)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid var(--border-subtle)' }}>
                                                        <button 
                                                            onClick={() => setMdMode('edit')}
                                                            style={{
                                                                background: mdMode === 'edit' ? 'var(--primary-gradient)' : 'transparent',
                                                                color: mdMode === 'edit' ? '#ffffff' : 'var(--text-secondary)',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '800', transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            Editor Only
                                                        </button>
                                                        <button 
                                                            onClick={() => setMdMode('split')}
                                                            style={{
                                                                background: mdMode === 'split' ? 'var(--primary-gradient)' : 'transparent',
                                                                color: mdMode === 'split' ? '#ffffff' : 'var(--text-secondary)',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '800', transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            Split View
                                                        </button>
                                                        <button 
                                                            onClick={() => setMdMode('preview')}
                                                            style={{
                                                                background: mdMode === 'preview' ? 'var(--primary-gradient)' : 'transparent',
                                                                color: mdMode === 'preview' ? '#ffffff' : 'var(--text-secondary)',
                                                                border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '800', transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            Preview Only
                                                        </button>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', flex: 1, gap: '16px', overflow: 'hidden', height: '100%', width: '100%' }}>
                                                    {/* Raw Code Editor Column */}
                                                    {(!isMarkdown || mdMode === 'edit' || mdMode === 'split') && (
                                                        <div className="code-editor-container" style={{
                                                            display: 'flex',
                                                            flex: 1,
                                                            height: '100%',
                                                            background: '#0a0e17',
                                                            borderRadius: '14px',
                                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                                            overflow: 'hidden',
                                                            position: 'relative',
                                                            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
                                                        }}>
                                                            <div 
                                                                ref={lineCounterRef}
                                                                className="line-numbers"
                                                                style={{
                                                                    width: '54px',
                                                                    padding: '16px 10px',
                                                                    background: '#060911',
                                                                    color: '#475569',
                                                                    textAlign: 'right',
                                                                    userSelect: 'none',
                                                                    overflow: 'hidden',
                                                                    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                                                                    whiteSpace: 'pre',
                                                                    fontFamily: 'Consolas, Monaco, monospace',
                                                                    fontSize: '13px',
                                                                    lineHeight: '1.6'
                                                                }}
                                                            >
                                                                {textContent.split('\n').map((_, idx) => idx + 1).join('\n')}
                                                            </div>
                                                            <textarea
                                                                ref={textareaRef}
                                                                value={textContent}
                                                                onChange={(e) => {
                                                                    if (isGuest) return;
                                                                    setTextContent(e.target.value);
                                                                    setIsEdited(true);
                                                                }}
                                                                onKeyDown={handleTextareaKeyDown}
                                                                onScroll={handleScroll}
                                                                readOnly={isGuest}
                                                                spellCheck="false"
                                                                style={{
                                                                    flex: 1,
                                                                    background: 'transparent',
                                                                    color: '#f8fafc',
                                                                    border: 'none',
                                                                    outline: 'none',
                                                                    padding: '16px',
                                                                    resize: 'none',
                                                                    fontFamily: 'Consolas, Monaco, monospace',
                                                                    fontSize: '13px',
                                                                    lineHeight: '1.6',
                                                                    overflowY: 'auto',
                                                                    whiteSpace: 'pre',
                                                                    wordWrap: 'normal'
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Compiled Markdown Preview Column */}
                                                    {isMarkdown && (mdMode === 'preview' || mdMode === 'split') && (
                                                        <div style={{
                                                            flex: 1,
                                                            height: '100%',
                                                            background: 'var(--bg-surface-0)',
                                                            borderRadius: '14px',
                                                            border: '1px solid var(--border-subtle)',
                                                            padding: '24px 32px',
                                                            overflowY: 'auto',
                                                            boxSizing: 'border-box',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
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
                    {media?.type !== 'text' && !isPdf && onNext && (
                        <button className="side-nav-preview next" onClick={handleNext} title="Next file">
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>
            </div>

            {/* In-UI Confirmation: Discard Unsaved Changes */}
            <ConfirmModal
                show={!!pendingDiscardAction}
                title="Discard Unsaved Changes?"
                message="You have unsaved edits in this file. Are you sure you want to discard them?"
                confirmText="Discard Changes"
                cancelText="Keep Editing"
                type="warning"
                onConfirm={() => {
                    if (pendingDiscardAction) pendingDiscardAction();
                    setPendingDiscardAction(null);
                }}
                onCancel={() => setPendingDiscardAction(null)}
            />
        </div>
    );
};

export default MediaPreviewModal;
