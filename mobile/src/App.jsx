const { useState, useEffect, useRef } = React;

// Safe Icon Component that checks for Lucide at render time
const SafeIcon = (props) => {
    const { name, size = 24, color = 'currentColor', ...rest } = props;
    const LucideIcons = (typeof lucide !== 'undefined' ? lucide.icons : {}) || {};
    const iconData = LucideIcons[name] || LucideIcons['Circle'];

    if (iconData) {
        const svgContent = iconData.toSvg({
            width: size,
            height: size,
            stroke: color,
            'stroke-width': 2,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            ...rest
        });
        return <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} />;
    }
    return <div style={{ width: size, height: size, background: '#eee', borderRadius: '50%', display: 'inline-block' }} />;
};

const Database = (p) => <SafeIcon name="database" {...p} />;
const Server = (p) => <SafeIcon name="server" {...p} />;
const HardDrive = (p) => <SafeIcon name="hard-drive" {...p} />;
const Search = (p) => <SafeIcon name="search" {...p} />;
const File = (p) => <SafeIcon name="file" {...p} />;
const Folder = (p) => <SafeIcon name="folder" {...p} />;
const Image = (p) => <SafeIcon name="image" {...p} />;
const Video = (p) => <SafeIcon name="video" {...p} />;
const FileText = (p) => <SafeIcon name="file-text" {...p} />;
const Download = (p) => <SafeIcon name="download" {...p} />;
const MoreVertical = (p) => <SafeIcon name="more-vertical" {...p} />;
const ChevronRight = (p) => <SafeIcon name="chevron-right" {...p} />;
const Settings = (p) => <SafeIcon name="settings" {...p} />;
const Clock = (p) => <SafeIcon name="clock" {...p} />;
const LayoutGrid = (p) => <SafeIcon name="layout-grid" {...p} />;
const LogOut = (p) => <SafeIcon name="log-out" {...p} />;
const Link2 = (p) => <SafeIcon name="link-2" {...p} />;
const Plus = (p) => <SafeIcon name="plus" {...p} />;
const ArrowLeft = (p) => <SafeIcon name="arrow-left" {...p} />;
const Trash2 = (p) => <SafeIcon name="trash-2" {...p} />;
const Edit = (p) => <SafeIcon name="edit" {...p} />;
const Share2 = (p) => <SafeIcon name="share-2" {...p} />;
const Globe = (p) => <SafeIcon name="globe" {...p} />;
const RefreshCw = (p) => <SafeIcon name="refresh-cw" {...p} />;

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'Roboto, sans-serif' }}>
                    <div style={{ marginBottom: 20 }}>
                        <SafeIcon name="alert-triangle" size={48} color="var(--md-error)" />
                    </div>
                    <h3>Something went wrong.</h3>
                    <p style={{ color: '#666', fontSize: '14px', margin: '10px 0' }}>
                        {this.state.error && this.state.error.toString()}
                    </p>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="md-button" style={{ background: 'var(--md-error)', color: 'white', marginTop: 20 }}>
                        Reset & Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

const App = () => {
    const currentOrigin = window.location.origin;
    const [serverUrl, setServerUrl] = useState(currentOrigin);
    const existingToken = localStorage.getItem('mobile_token');
    const [token, setToken] = useState(existingToken);
    const [username, setUserName] = useState(localStorage.getItem('mobile_username'));
    const [view, setView] = useState(existingToken ? 'browse' : 'login');
    const [sessionLoading, setSessionLoading] = useState(!!existingToken);
    const [path, setPath] = useState('/');
    const [files, setFiles] = useState([]);
    const [activeShares, setActiveShares] = useState([]);
    const [networkDrives, setNetworkDrives] = useState([]);
    const [summary, setSummary] = useState({ images: 0, videos: 0, docs: 0, links: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [devices, setDevices] = useState([]);
    const [contextFile, setContextFile] = useState(null);
    const [renameFile, setRenameFile] = useState(null);
    const [shareModalFile, setShareModalFile] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const validateSession = async () => {
            if (!token) {
                setSessionLoading(false);
                return;
            }
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                await axios.get(`${serverUrl}/api/mobile/summary`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                setSessionLoading(false);
            } catch (err) {
                console.error('Session validation failed', err);
                if (err.response?.status === 401 || err.name === 'AbortError') {
                    handleLogout();
                }
                setSessionLoading(false);
            }
        };
        validateSession();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post(`${serverUrl}/api/login`, {
                username: e.target.username.value,
                password: e.target.password.value
            });
            setToken(res.data.token);
            setUserName(res.data.username);
            localStorage.setItem('mobile_token', res.data.token);
            localStorage.setItem('mobile_username', res.data.username);
            setView('browse');
        } catch (err) {
            setError('Login failed. Check credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.removeItem('mobile_token');
        localStorage.removeItem('mobile_username');
        setView('login');
    };

    const fetchFiles = async (currentPath, device = selectedDevice) => {
        if (!token) return;
        setLoading(true);
        try {
            let url = `${serverUrl}/api/files/list?path=${encodeURIComponent(currentPath)}`;
            if (device?.type === 'Agent') url += `&agentId=${device.id}`;
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(res.data);
            setPath(currentPath);
            setSelectedDevice(device);
        } catch (err) {
            setError('Failed to fetch files');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${serverUrl}/api/mobile/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSummary(res.data);
        } catch (err) { console.error('Summary fetch failed'); }
    };

    const fetchDevices = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${serverUrl}/api/storage/devices`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDevices(res.data);
        } catch (err) { }
    };

    const fetchActiveShares = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${serverUrl}/api/share/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setActiveShares(res.data);
        } catch (err) { }
    };

    const fetchNetworkDrives = async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${serverUrl}/api/network/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNetworkDrives(res.data);
        } catch (err) { }
    };

    useEffect(() => {
        if (token && view === 'browse') {
            fetchFiles(path);
            fetchSummary();
        }
        if (token && view === 'machines') fetchDevices();
        if (token && view === 'shares') fetchActiveShares();
        if (token && view === 'network') fetchNetworkDrives();
    }, [token, view, path]);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (!query) {
            setView('browse');
            setSearchResults([]);
            return;
        }
        setView('search');
        try {
            const res = await axios.get(`${serverUrl}/api/search?query=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(res.data);
        } catch (err) { }
    };

    const handleAction = async (action, file, extra = {}) => {
        setContextFile(null);
        setRenameFile(null);
        setShareModalFile(null);
        setLoading(true);
        try {
            let url = `${serverUrl}/api/files/${action}`;
            if (selectedDevice?.type === 'Agent') url += `?agentId=${selectedDevice.id}`;

            if (action === 'delete') {
                if (!confirm(`Delete ${file.name}?`)) { setLoading(false); return; }
                await axios.post(url, { path: file.path }, { headers: { Authorization: `Bearer ${token}` } });
            } else if (action === 'rename') {
                await axios.post(url, { path: file.path, newName: extra.newName }, { headers: { Authorization: `Bearer ${token}` } });
            } else if (action === 'download') {
                window.location.href = `${serverUrl}/api/download?path=${encodeURIComponent(file.path)}&token=${token}${selectedDevice?.type === 'Agent' ? `&agentId=${selectedDevice.id}` : ''}`;
                setLoading(false);
                return;
            } else if (action === 'share') {
                const res = await axios.post(`${serverUrl}/api/share/create`, {
                    path: file.path,
                    password: extra.password || '',
                    email: extra.email || '',
                    expiry: extra.expiry || new Date(Date.now() + 86400000).toISOString(),
                    maxViews: extra.maxViews || -1,
                    agentId: selectedDevice?.id || null
                }, { headers: { Authorization: `Bearer ${token}` } });
                alert(`Share Created: ${res.data.url}`);
            } else if (action === 'revoke-share') {
                await axios.delete(`${serverUrl}/api/share/${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
                fetchActiveShares();
            }
            fetchFiles(path);
        } catch (err) { alert(`Action ${action} failed`); }
        finally { setLoading(false); }
    };

    const Breadcrumbs = () => {
        const parts = path.split('/').filter(p => p);
        return (
            <div className="breadcrumb-bar">
                <div className={`breadcrumb-item ${path === '/' ? 'active' : ''}`} onClick={() => fetchFiles('/')}>
                    <SafeIcon name="hard-drive" size={16} /> Home
                </div>
                {parts.map((p, i) => (
                    <React.Fragment key={p}>
                        <SafeIcon name="chevron-right" size={14} color="var(--md-on-surface-variant)" />
                        <div
                            className={`breadcrumb-item ${i === parts.length - 1 ? 'active' : ''}`}
                            onClick={() => fetchFiles('/' + parts.slice(0, i + 1).join('/'))}
                        >
                            {p.length > 15 ? p.substring(0, 12) + '...' : p}
                        </div>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    if (sessionLoading) return (
        <div className="mobile-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="logo-icon" style={{ background: 'var(--md-surface-variant)', width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
                    <SafeIcon name="refresh-cw" size={32} color="var(--md-primary)" className="spin" />
                </div>
                <p className="text-label">Verifying session...</p>
            </div>
            <style>{`
                @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );

    if (view === 'login') return (
        <div className="mobile-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div className="logo-icon" style={{ background: 'var(--md-primary)', width: '64px', height: '64px', borderRadius: '16px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={32} color="white" />
                    </div>
                    <h2>Welcome</h2>
                    <p className="text-label" style={{ marginTop: '8px' }}>Sign in to NexaDisk</p>
                </div>
                <form onSubmit={handleLogin}>
                    <input name="username" className="md-input" placeholder="Username" required />
                    <input name="password" type="password" className="md-input" placeholder="Passkey" required />
                    {error && <p style={{ color: 'var(--md-error)', fontSize: '12px', marginBottom: '16px' }}>{error}</p>}
                    <button type="submit" className="md-button" disabled={loading}>
                        {loading ? 'Authorizing...' : 'Authorize'}
                    </button>
                    <div style={{ marginTop: '16px', textAlign: 'center' }}>
                        <a href="/?ui=desktop" style={{ color: 'var(--md-primary)', fontSize: '13px', textDecoration: 'none' }}>Switch to Desktop</a>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="mobile-container">
            <div className="search-bar-container">
                <div onClick={() => view !== 'browse' && setView('browse')}>
                    {view === 'browse' ? <Search size={20} color="var(--md-on-surface-variant)" /> : <ArrowLeft size={20} color="var(--md-on-surface-variant)" />}
                </div>
                <input
                    className="search-input"
                    placeholder="Search your files..."
                    value={searchQuery}
                    onChange={handleSearch}
                />
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--md-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '12px' }}>
                    {username ? username[0].toUpperCase() : 'U'}
                </div>
            </div>

            {view === 'browse' && path !== '/' && <Breadcrumbs />}

            <div className="scroll-area">
                {view === 'browse' && (
                    <>
                        {path === '/' && (
                            <>
                                <h3 className="text-label" style={{ marginBottom: '16px' }}>CATEGORIES</h3>
                                <div className="category-grid">
                                    {[
                                        { id: 'images', name: 'Images', icon: <Image size={20} color="#1a73e8" />, bg: '#e8f0fe', count: summary.images },
                                        { id: 'videos', name: 'Videos', icon: <Video size={20} color="#d93025" />, bg: '#fce8e6', count: summary.videos },
                                        { id: 'shares', name: 'Sharing', icon: <Share2 size={20} color="#188038" />, bg: '#e6f4ea', count: summary.links },
                                        { id: 'network', name: 'Network', icon: <Globe size={20} color="#f29900" />, bg: '#fef7e0', count: 'Drives' }
                                    ].map(cat => (
                                        <div key={cat.id} className="category-card" onClick={() => setView(cat.id === 'network' ? 'network' : cat.id === 'shares' ? 'shares' : 'browse')}>
                                            <div className="category-icon" style={{ background: cat.bg }}>{cat.icon}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px', fontWeight: '500' }}>{cat.name}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--md-on-surface-variant)' }}>{cat.count} {cat.id === 'network' ? '' : 'items'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 className="text-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                {path === '/' ? <><HardDrive size={16} /> STORAGE DEVICES</> : <><Folder size={16} /> {path.split('/').pop()}</>}
                            </h3>
                        </div>

                        <div className="file-list">
                            {loading && files.length === 0 ? <p>Loading...</p> : files.map(file => (
                                <div key={file.path} className="file-list-item" onClick={() => file.isDirectory ? fetchFiles(file.path) : null}>
                                    <div className="file-icon-circle">
                                        {file.isDirectory ? <Folder size={24} color="#5f6368" /> : <File size={24} color="#5f6368" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '16px', fontWeight: '400' }}>{file.name}</div>
                                        <div className="text-label" style={{ fontSize: '12px' }}>
                                            {file.isDirectory ? 'Folder' : `${(file.size / 1024 / 1024).toFixed(1)} MB`} • {new Date(file.modified).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div onClick={(e) => { e.stopPropagation(); setContextFile(file); }}>
                                        <MoreVertical size={20} color="#5f6368" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {view === 'shares' && (
                    <div className="file-list">
                        <h3 className="text-label" style={{ marginBottom: '16px' }}>ACTIVE PUBLIC LINKS</h3>
                        {activeShares.length === 0 ? <p className="text-label">No active links</p> : activeShares.map(share => (
                            <div key={share.id} className="file-list-item" onClick={() => { }}>
                                <div className="file-icon-circle"><Link2 size={24} color="var(--md-primary)" /></div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{share.path.split(/[\/\\]/).pop()}</div>
                                    <div className="text-label" style={{ fontSize: '11px' }}>ID: {share.id} • Views: {share.view_count}</div>
                                </div>
                                <div onClick={() => handleAction('revoke-share', share)} style={{ color: 'var(--md-error)' }}>
                                    <Trash2 size={20} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {view === 'network' && (
                    <div className="file-list">
                        <h3 className="text-label" style={{ marginBottom: '16px' }}>NETWORK DRIVES (SMB / SFTP)</h3>
                        {networkDrives.length === 0 ? <p className="text-label">No network drives connected</p> : networkDrives.map(drive => (
                            <div key={drive.id} className="file-list-item">
                                <div className="file-icon-circle"><Globe size={24} color="#1a73e8" /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{drive.label || drive.path}</div>
                                    <div className="text-label" style={{ fontSize: '12px' }}>{drive.type.toUpperCase()} • {drive.username}</div>
                                </div>
                                <ChevronRight size={20} color="#5f6368" />
                            </div>
                        ))}
                    </div>
                )}

                {view === 'machines' && (
                    <div className="file-list">
                        <h3 className="text-label" style={{ marginBottom: '16px' }}>AVAILABLE MACHINES</h3>
                        {devices.map(dev => (
                            <div key={dev.id} className="file-list-item" onClick={() => { fetchFiles('/', dev); setView('browse'); }}>
                                <div className="file-icon-circle" style={{ background: dev.status === 'online' ? '#e6f4ea' : '#fce8e6' }}>
                                    <Server size={24} color={dev.status === 'online' ? '#188038' : '#d93025'} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '16px', fontWeight: '500' }}>{dev.hostname || dev.name}</div>
                                    <div className="text-label" style={{ fontSize: '12px' }}>{dev.type} • {dev.status}</div>
                                </div>
                                <ChevronRight size={20} color="#5f6368" />
                            </div>
                        ))}
                    </div>
                )}

                {view === 'settings' && (
                    <div style={{ padding: '0 8px' }}>
                        <h2 style={{ marginBottom: '24px' }}>Settings</h2>
                        <div className="file-list-item" onClick={handleLogout} style={{ color: 'var(--md-error)' }}>
                            <LogOut size={24} />
                            <span>Sign Out</span>
                        </div>
                    </div>
                )}
            </div>

            {contextFile && (
                <div className="mobile-modal-overlay" onClick={() => setContextFile(null)}>
                    <div className="mobile-bottom-sheet" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                            <div className="file-icon-circle">{contextFile.isDirectory ? <Folder size={24} color="#5f6368" /> : <File size={24} color="#5f6368" />}</div>
                            <div style={{ fontWeight: '500', fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contextFile.name}</div>
                        </div>
                        <div className="bottom-sheet-item" onClick={() => handleAction('download', contextFile)}>
                            <Download size={24} color="#5f6368" /> <span>Download</span>
                        </div>
                        <div className="bottom-sheet-item" onClick={() => { setShareModalFile(contextFile); setContextFile(null); }}>
                            <Share2 size={24} color="#188038" /> <span>Create Share Link</span>
                        </div>
                        <div className="bottom-sheet-item" onClick={() => { setRenameFile(contextFile); setContextFile(null); }}>
                            <Edit size={24} color="#5f6368" /> <span>Rename</span>
                        </div>
                        <div className="bottom-sheet-item" onClick={() => handleAction('delete', contextFile)} style={{ color: 'var(--md-error)' }}>
                            <Trash2 size={24} /> <span>Delete</span>
                        </div>
                    </div>
                </div>
            )}

            {shareModalFile && (
                <div className="mobile-modal-overlay" style={{ alignItems: 'center' }}>
                    <div className="auth-card" style={{ width: '90%', margin: 0 }}>
                        <h3 style={{ marginBottom: '16px' }}>Share Link Settings</h3>
                        <p className="text-label" style={{ marginBottom: '20px' }}>{shareModalFile.name}</p>
                        <input id="shareEmail" className="md-input" placeholder="Notify email (optional)" />
                        <input id="sharePass" className="md-input" placeholder="Password protect (optional)" type="password" />
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="md-button" style={{ background: 'var(--md-surface-variant)', color: 'var(--md-on-surface)' }} onClick={() => setShareModalFile(null)}>Cancel</button>
                            <button className="md-button" onClick={() => handleAction('share', shareModalFile, {
                                email: document.getElementById('shareEmail').value,
                                password: document.getElementById('sharePass').value
                            })}>Create Link</button>
                        </div>
                    </div>
                </div>
            )}

            {renameFile && (
                <div className="mobile-modal-overlay" style={{ alignItems: 'center' }}>
                    <div className="auth-card" style={{ width: '85%', margin: 0 }}>
                        <h3 style={{ marginBottom: '20px' }}>Rename Item</h3>
                        <input id="renameInput" className="md-input" defaultValue={renameFile.name} autoFocus />
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button className="md-button" style={{ background: 'var(--md-surface-variant)', color: 'var(--md-on-surface)' }} onClick={() => setRenameFile(null)}>Cancel</button>
                            <button className="md-button" onClick={() => handleAction('rename', renameFile, { newName: document.getElementById('renameInput').value })}>Rename</button>
                        </div>
                    </div>
                </div>
            )}

            <nav className="bottom-nav">
                <div className={`nav-item ${view === 'machines' ? 'active' : ''}`} onClick={() => setView('machines')}>
                    <div className="nav-indicator"><Server size={24} /></div>
                    <span style={{ fontSize: '12px' }}>Fleet</span>
                </div>
                <div className={`nav-item ${['browse', 'search', 'shares', 'network', 'images', 'videos'].includes(view) ? 'active' : ''}`} onClick={() => setView('browse')}>
                    <div className="nav-indicator"><LayoutGrid size={24} /></div>
                    <span style={{ fontSize: '12px' }}>Browse</span>
                </div>
                <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
                    <div className="nav-indicator"><Settings size={24} /></div>
                    <span style={{ fontSize: '12px' }}>Settings</span>
                </div>
            </nav>
        </div>
    );
};

ReactDOM.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>,
    document.getElementById('root')
);
