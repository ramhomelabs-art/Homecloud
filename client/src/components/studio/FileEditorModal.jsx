import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Save, FileCode, Eye, Edit3, 
    Copy, Check, Download, Sparkles, RefreshCw, 
    Maximize2, Minimize2, Terminal, AlertCircle,
    Search, WrapText, ZoomIn, ZoomOut, CheckCircle2,
    Code2, FileText, CornerDownLeft
} from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';

const getLanguage = (fileName) => {
    if (!fileName) return 'text';
    const ext = fileName.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js': case 'jsx': case 'mjs': return 'JavaScript';
        case 'ts': case 'tsx': return 'TypeScript';
        case 'py': return 'Python';
        case 'json': return 'JSON';
        case 'html': case 'htm': return 'HTML';
        case 'css': case 'scss': return 'CSS';
        case 'sql': return 'SQL';
        case 'sh': case 'bash': case 'zsh': return 'Shell Script';
        case 'yml': case 'yaml': return 'YAML';
        case 'md': case 'markdown': return 'Markdown';
        case 'env': case 'ini': case 'conf': return 'Configuration';
        case 'xml': case 'svg': return 'XML / SVG';
        case 'log': return 'Log File';
        default: return 'Plain Text';
    }
};

const FileEditorModal = ({ file, onClose, showToast, onSaved }) => {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState('code'); // 'code', 'preview' (for md)
    const [copied, setCopied] = useState(false);
    const [lineCount, setLineCount] = useState(1);
    const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
    const [fontSize, setFontSize] = useState(13);
    const [wordWrap, setWordWrap] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [jsonError, setJsonError] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);

    const isMarkdown = file?.name?.toLowerCase().endsWith('.md');
    const isJson = file?.name?.toLowerCase().endsWith('.json');
    const isDirty = content !== originalContent;
    const language = getLanguage(file?.name);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get('/api/v1/files/raw-content', {
                    params: { path: file.path },
                    headers
                });
                const fetched = res.data.content || '';
                setContent(fetched);
                setOriginalContent(fetched);
                setLineCount(fetched.split('\n').length || 1);
            } catch (err) {
                if (showToast) showToast('Failed to load file contents: ' + (err.response?.data?.error || err.message), 'error');
            } finally {
                setLoading(false);
            }
        };

        if (file?.path) fetchContent();
    }, [file]);

    // Handle shortcuts
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            setShowSearch(prev => !prev);
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const newContent = content.substring(0, start) + '    ' + content.substring(end);
            setContent(newContent);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                }
            }, 0);
        }
    };

    const updateCursorPosition = () => {
        if (!textareaRef.current) return;
        const text = textareaRef.current.value.substring(0, textareaRef.current.selectionStart);
        const lines = text.split('\n');
        setCursorPos({
            line: lines.length,
            col: lines[lines.length - 1].length + 1
        });
    };

    const handleContentChange = (e) => {
        const text = e.target.value;
        setContent(text);
        setLineCount(text.split('\n').length || 1);
        updateCursorPosition();
        if (jsonError) setJsonError(null);
    };

    const handleScroll = () => {
        if (lineNumbersRef.current && textareaRef.current) {
            lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const handleFormatJson = () => {
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            setContent(formatted);
            setLineCount(formatted.split('\n').length);
            setJsonError(null);
            if (showToast) showToast('JSON formatted & validated successfully', 'success');
        } catch (err) {
            setJsonError(err.message);
            if (showToast) showToast(`Invalid JSON: ${err.message}`, 'error');
        }
    };

    const handleSave = async () => {
        if (!file?.path) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            await axios.post('/api/v1/files/save-content', {
                path: file.path,
                content
            }, { headers });
            setOriginalContent(content);
            if (showToast) showToast(`Saved "${file.name}" to cluster storage`, 'success');
            if (onSaved) onSaved();
        } catch (err) {
            if (showToast) showToast('Save failed: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCopy = async () => {
        const { copyTextToClipboard } = await import('../../utils/clipboard');
        await copyTextToClipboard(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        if (showToast) showToast('Copied to clipboard', 'info');
    };


    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    const handleClose = () => {
        if (isDirty) {
            setShowDiscardConfirm(true);
        } else {
            onClose();
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isFullscreen ? '0' : '20px' }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                style={{ 
                    width: isFullscreen ? '100vw' : '100%', 
                    maxWidth: isFullscreen ? '100vw' : '1200px', 
                    height: isFullscreen ? '100vh' : '88vh', 
                    background: 'var(--bg-surface-0)', 
                    borderRadius: isFullscreen ? '0' : '18px', 
                    border: isFullscreen ? 'none' : '1px solid var(--border-subtle)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.6)' 
                }}
            >
                {/* Editor Header Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileCode size={20} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file?.name}
                                </h3>
                                {isDirty && (
                                    <span style={{ fontSize: '10.5px', fontWeight: '800', padding: '2px 8px', borderRadius: '5px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                                        ● Unsaved
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                                {language} • {lineCount} lines • {(new Blob([content]).size / 1024).toFixed(1)} KB
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isJson && (
                            <button
                                onClick={handleFormatJson}
                                className="btn-secondary"
                                title="Prettify and Validate JSON"
                                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                            >
                                <Sparkles size={13} /> Beautify JSON
                            </button>
                        )}

                        {isMarkdown && (
                            <div style={{ display: 'flex', background: 'var(--bg-surface-2)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
                                <button
                                    onClick={() => setViewMode('code')}
                                    style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'code' ? 'var(--primary)' : 'transparent', color: viewMode === 'code' ? '#fff' : 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    <Edit3 size={13} style={{ display: 'inline', marginRight: '4px' }} /> Editor
                                </button>
                                <button
                                    onClick={() => setViewMode('preview')}
                                    style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'preview' ? 'var(--primary)' : 'transparent', color: viewMode === 'preview' ? '#fff' : 'var(--text-secondary)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    <Eye size={13} style={{ display: 'inline', marginRight: '4px' }} /> Preview
                                </button>
                            </div>
                        )}

                        {/* Word Wrap */}
                        <button
                            onClick={() => setWordWrap(!wordWrap)}
                            title={wordWrap ? "Disable Word Wrap" : "Enable Word Wrap"}
                            style={{ padding: '8px', borderRadius: '8px', background: wordWrap ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: wordWrap ? 'var(--primary)' : 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <WrapText size={15} />
                        </button>

                        {/* Font Size controls */}
                        <button
                            onClick={() => setFontSize(prev => Math.min(22, prev + 1))}
                            title="Zoom In"
                            style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <ZoomIn size={15} />
                        </button>
                        <button
                            onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
                            title="Zoom Out"
                            style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <ZoomOut size={15} />
                        </button>

                        {/* Copy Code */}
                        <button
                            onClick={handleCopy}
                            title="Copy code"
                            style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                        </button>

                        {/* Fullscreen toggle */}
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                            style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                        </button>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving || !isDirty}
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '12.5px', opacity: !isDirty ? 0.7 : 1 }}
                        >
                            {saving ? <RefreshCw size={14} className="spin-anim" /> : <Save size={14} />}
                            {saving ? 'Saving...' : 'Save (Ctrl+S)'}
                        </button>

                        {/* Close button */}
                        <button
                            onClick={handleClose}
                            style={{ padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Editor Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '10px' }}>
                            <RefreshCw size={20} className="spin-anim" /> Loading file contents...
                        </div>
                    ) : viewMode === 'preview' && isMarkdown ? (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px', color: 'var(--text-primary)', lineHeight: '1.75', fontSize: '14.5px', whiteSpace: 'pre-wrap', fontFamily: 'system-ui, sans-serif' }}>
                            {content}
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#0a0d14' }}>
                            {/* Line Numbers Gutter */}
                            <div 
                                ref={lineNumbersRef}
                                style={{ 
                                    width: '58px', 
                                    padding: '16px 12px 16px 0', 
                                    textAlign: 'right', 
                                    fontFamily: 'var(--font-mono, monospace)', 
                                    fontSize: `${fontSize}px`, 
                                    lineHeight: `${fontSize * 1.65}px`, 
                                    color: '#475569', 
                                    background: '#070a0f', 
                                    userSelect: 'none', 
                                    overflowY: 'hidden',
                                    borderRight: '1px solid #1e293b'
                                }}
                            >
                                {Array.from({ length: lineCount }).map((_, i) => (
                                    <div key={i} style={{ color: cursorPos.line === (i + 1) ? 'var(--primary)' : '#475569', fontWeight: cursorPos.line === (i + 1) ? '800' : 'normal' }}>
                                        {i + 1}
                                    </div>
                                ))}
                            </div>

                            {/* Code Textarea */}
                            <textarea
                                ref={textareaRef}
                                value={content}
                                onChange={handleContentChange}
                                onKeyDown={handleKeyDown}
                                onClick={updateCursorPosition}
                                onKeyUp={updateCursorPosition}
                                onScroll={handleScroll}
                                spellCheck="false"
                                style={{
                                    flex: 1,
                                    padding: '16px 20px',
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    resize: 'none',
                                    color: '#f1f5f9',
                                    fontFamily: 'var(--font-mono, "Fira Code", "Cascadia Code", monospace)',
                                    fontSize: `${fontSize}px`,
                                    lineHeight: `${fontSize * 1.65}px`,
                                    tabSize: 4,
                                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                                    wordBreak: wordWrap ? 'break-word' : 'normal',
                                    overflowWrap: wordWrap ? 'break-word' : 'normal',
                                    overflowX: wordWrap ? 'hidden' : 'auto',
                                    overflowY: 'auto'
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Editor Status Footer */}
                <div style={{
                    padding: '6px 20px',
                    background: 'var(--bg-surface-1)',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono, monospace)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                        <span>{lineCount} lines</span>
                        <span>UTF-8</span>
                        {jsonError && (
                            <span style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertCircle size={12} /> {jsonError}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <span>Zoom: {fontSize}px</span>
                        <span>{wordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
                        <span style={{ color: 'var(--primary)', fontWeight: '700' }}>NexaStudio</span>
                    </div>
                </div>
            </motion.div>

            {/* In-UI Confirmation: Discard Unsaved Changes */}
            <ConfirmModal
                show={showDiscardConfirm}
                title="Discard Unsaved Changes?"
                message="You have unsaved edits in this file. Are you sure you want to close without saving?"
                confirmText="Discard & Close"
                cancelText="Keep Editing"
                type="warning"
                onConfirm={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                }}
                onCancel={() => setShowDiscardConfirm(false)}
            />
        </div>
    );
};

export default FileEditorModal;
