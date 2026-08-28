import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, Sparkles, FileText, Folder, Tag, X, 
    ArrowRight, Clock, FileCode, HardDrive, Check, Filter, RefreshCw
} from 'lucide-react';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SmartSearchModal = ({ currentPath = '', onClose, onOpenFile, showToast }) => {
    const [query, setQuery] = useState('');
    const [searchScope, setSearchScope] = useState('all'); // 'all' or 'current'
    const [searchContent, setSearchContent] = useState(true);
    const [searchTags, setSearchTags] = useState(true);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentScanningFolder, setCurrentScanningFolder] = useState('');
    const [filesScannedCount, setFilesScannedCount] = useState(0);
    const [progressPercent, setProgressPercent] = useState(0);

    const inputRef = useRef(null);
    const eventSourceRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, []);

    const stopActiveSearch = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setLoading(false);
    };

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        stopActiveSearch();
        setLoading(true);
        setHasSearched(true);
        setResults([]);
        setFilesScannedCount(0);
        setCurrentScanningFolder('');
        setProgressPercent(5);

        const token = localStorage.getItem('token') || '';
        const params = new URLSearchParams({
            query: query.trim(),
            currentPath: currentPath || '',
            searchScope,
            searchContent: String(searchContent),
            searchTags: String(searchTags)
        });

        // Use EventSource for live SSE streaming
        try {
            const es = new EventSource(`/api/v1/files/smart-search/stream?${params.toString()}`);
            eventSourceRef.current = es;

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'start') {
                        setProgressPercent(10);
                    } else if (data.type === 'progress') {
                        if (data.currentFolder) setCurrentScanningFolder(data.currentFolder);
                        if (data.filesScanned) setFilesScannedCount(data.filesScanned);
                        setProgressPercent(prev => Math.min(95, prev + 1));
                    } else if (data.type === 'match') {
                        if (data.match) {
                            setResults(prev => {
                                if (prev.some(p => p.path === data.match.path)) return prev;
                                return [...prev, data.match];
                            });
                        }
                    } else if (data.type === 'done') {
                        if (data.results && data.results.length > 0) {
                            setResults(data.results);
                        }
                        if (data.filesScanned) setFilesScannedCount(data.filesScanned);
                        setProgressPercent(100);
                        stopActiveSearch();
                    } else if (data.type === 'error') {
                        if (showToast) showToast('Search error: ' + data.error, 'error');
                        stopActiveSearch();
                    }
                } catch (_) {}
            };

            es.onerror = async () => {
                es.close();
                eventSourceRef.current = null;
                // Fallback to batch POST API if SSE fails
                try {
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    const res = await axios.post('/api/v1/files/smart-search', {
                        query: query.trim(),
                        currentPath,
                        searchScope,
                        searchContent,
                        searchTags
                    }, { headers });
                    setResults(res.data.results || []);
                    if (res.data.filesScanned) setFilesScannedCount(res.data.filesScanned);
                    setProgressPercent(100);
                } catch (err) {
                    if (showToast) showToast('Smart search failed: ' + (err.response?.data?.error || err.message), 'error');
                } finally {
                    setLoading(false);
                }
            };
        } catch (err) {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                stopActiveSearch();
                if (onClose) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div 
            onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(12px)',
                zIndex: 3000,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '80px',
                paddingBottom: '40px'
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                style={{
                    width: '100%',
                    maxWidth: '820px',
                    maxHeight: '80vh',
                    background: 'var(--bg-surface-0)',
                    borderRadius: '20px',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.7)'
                }}
            >
                {/* Search Bar Header */}
                <form onSubmit={handleSearch} style={{
                    padding: '18px 24px',
                    background: 'var(--bg-surface-1)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-cyan)',
                        flexShrink: 0
                    }}>
                        <Sparkles size={20} />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="AI Smart Search: search filenames, tags, or text inside documents..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '15.5px',
                            fontWeight: '600',
                            color: 'var(--text-primary)'
                        }}
                    />

                    {query && (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                            title="Clear search text"
                        >
                            <X size={18} />
                        </button>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="btn-primary"
                        style={{ padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: '0.2s'
                        }}
                        title="Close (Esc)"
                    >
                        <X size={18} />
                    </button>
                </form>

                {/* Filters & Scope Row */}
                <div style={{
                    padding: '10px 24px',
                    background: 'var(--bg-surface-2)',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: 'var(--text-dim)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', background: 'var(--bg-surface-1)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border-subtle)' }}>
                            <button
                                type="button"
                                onClick={() => setSearchScope('all')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: searchScope === 'all' ? 'var(--primary)' : 'transparent',
                                    color: searchScope === 'all' ? '#fff' : 'var(--text-secondary)',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                All Volumes
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchScope('current')}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: searchScope === 'current' ? 'var(--primary)' : 'transparent',
                                    color: searchScope === 'current' ? '#fff' : 'var(--text-secondary)',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                {currentPath ? `Folder: ${currentPath.split(/[\\/]/).filter(Boolean).pop() || currentPath}` : 'Current Folder'}
                            </button>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={searchContent}
                                onChange={(e) => setSearchContent(e.target.checked)}
                            />
                            <span>Deep Document Text</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={searchTags}
                                onChange={(e) => setSearchTags(e.target.checked)}
                            />
                            <span>Social Tags</span>
                        </label>
                    </div>

                    {hasSearched && (
                        <div style={{ fontSize: '11.5px' }}>
                            Found <strong style={{ color: 'var(--text-primary)' }}>{results.length}</strong> matches
                        </div>
                    )}
                </div>

                {/* Live Scanning Progress Header */}
                {loading && (
                    <div style={{
                        padding: '12px 24px',
                        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(6, 182, 212, 0.08))',
                        borderBottom: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <RefreshCw size={14} className="spin-anim" color="var(--accent-cyan)" />
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                                    Scanning Storage:
                                </span>
                                <span style={{
                                    color: 'var(--text-secondary)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '380px'
                                }}>
                                    {currentScanningFolder || 'Initializing storage hierarchy scan...'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                                <span>{filesScannedCount > 0 ? `${filesScannedCount.toLocaleString()} files inspected` : 'Searching...'}</span>
                                <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'rgba(6, 182, 212, 0.15)' }}>
                                    {progressPercent}%
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar Track */}
                        <div style={{
                            width: '100%',
                            height: '4px',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            overflow: 'hidden'
                        }}>
                            <motion.div
                                initial={{ width: '5%' }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ ease: 'easeOut', duration: 0.3 }}
                                style={{
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--primary), var(--accent-cyan))',
                                    borderRadius: '4px'
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Results Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    {!hasSearched ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                            <Search size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                Query Across Files & Full Text
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                Searches file names, tagged labels, and content inside text, code, JSON, logs, and configs.
                            </div>
                        </div>
                    ) : results.length === 0 && loading ? (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-secondary)' }}>
                            <Sparkles size={36} className="spin-anim" style={{ margin: '0 auto 14px', color: 'var(--accent-cyan)' }} />
                            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                Inspecting Files & Documents...
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                                Searching across {currentScanningFolder || 'cluster storage'} for "{query}"
                            </div>
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                            <FileText size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                                No results matching "{query}"
                            </div>
                            <div style={{ fontSize: '12px', marginTop: '6px' }}>
                                Inspected {filesScannedCount.toLocaleString()} files across storage volumes.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {results.map((res, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (onOpenFile) onOpenFile(res);
                                        onClose();
                                    }}
                                    style={{
                                        padding: '14px 18px',
                                        borderRadius: '12px',
                                        background: 'var(--bg-surface-1)',
                                        border: '1px solid var(--border-subtle)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '14px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: res.matchType === 'content' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                                            color: res.matchType === 'content' ? 'var(--accent-cyan)' : 'var(--primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {res.matchType === 'content' ? <FileText size={16} /> : <FileCode size={16} />}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                    {res.name}
                                                </span>
                                                <span style={{
                                                    fontSize: '10px',
                                                    fontWeight: '800',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    background: res.matchType === 'content' ? 'rgba(6, 182, 212, 0.2)' : res.matchType === 'exact_name' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                                                    color: res.matchType === 'content' ? 'var(--accent-cyan)' : res.matchType === 'exact_name' ? '#10b981' : 'var(--primary)',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {res.matchType === 'content' ? 'In-Document Match' : res.matchType === 'exact_name' ? 'Exact Match' : res.matchType}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', wordBreak: 'break-all' }}>
                                                {res.displayPath || res.path} • {formatBytes(res.size)}
                                            </div>
                                            {res.snippet && (
                                                <div style={{
                                                    fontSize: '11px',
                                                    color: 'var(--text-secondary)',
                                                    marginTop: '6px',
                                                    padding: '4px 8px',
                                                    background: 'var(--bg-surface-2)',
                                                    borderRadius: '6px',
                                                    fontFamily: 'var(--font-mono)'
                                                }}>
                                                    {res.snippet}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <ArrowRight size={16} color="var(--text-dim)" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default SmartSearchModal;
