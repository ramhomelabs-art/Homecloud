import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    LayoutDashboard, FolderTree, File, Folder, Server, Activity, Cpu, Database, Globe, Plus, Sparkles,
    User, ShieldCheck, ShieldAlert, Shield, Share2, Download, Upload, Trash2, Copy, Scissors,
    Filter, CheckCircle2, Clock, Info, Edit, MousePointer2, Link2, Lock,
    RefreshCw, Image as ImageIcon, Video, X, Timer, ZoomIn, ZoomOut, Maximize,
    ArrowLeft, ArrowRight, ChevronUp, ChevronDown, ListIcon, LayoutGrid, LayoutList,
    Square, CheckSquare, MoreVertical, Database as DriveIcon, Key, Monitor, Smartphone,
    ChevronRight, ChevronLeft, CreditCard, Box, Grid, List, Search, Bell, HelpCircle, Settings as SettingsIcon, LogOut,
    HardDrive, FolderOpen, Eye, EyeOff, Save, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from './components/modals/ConfirmationModal';
import CompressModal from './components/modals/CompressModal';
import CreateFolderModal from './components/modals/CreateFolderModal';
import DownloadConfirmModal from './components/modals/DownloadConfirmModal';
import MediaPreviewModal from './components/modals/MediaPreviewModal';
import MountModal from './components/modals/MountModal';
import OverlapConfirmModal from './components/modals/OverlapConfirmModal';
import ProvisionModal from './components/modals/ProvisionModal';
import RenameModal from './components/modals/RenameModal';
import UserModal from './components/modals/UserModal';
import PropertiesModal from './components/modals/PropertiesModal';
import ShareModal from './components/modals/ShareModal';
import FolderPickerModal from './components/modals/FolderPickerModal';
import ContextMenu from './components/ContextMenu';
import InspectorSidebar from './components/InspectorSidebar';
import SyncCenter from './components/SyncCenter';
import AIAutomator from './components/AIAutomator';
import AlertManagement from './components/AlertManagement';
import SecurityCenter from './components/security/SecurityCenter';
import ProfileSettings from './components/profile/ProfileSettings';
import Avatar from './components/profile/Avatar';
import GuestPortal from './components/portals/GuestPortal';
import PublicPortal from './components/portals/PublicPortal';
import UploadPortal from './components/portals/UploadPortal';

const API_BASE = '/api';

const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.0 KB';
    if (bytes === 0) return '0.0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i < 0) return '0.0 KB';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatGB = (gbVal) => {
    if (gbVal === undefined || gbVal === null || isNaN(gbVal)) return '0.0 GB';
    if (gbVal >= 999.9) {
        return `${(gbVal / 1024).toFixed(1)} TB`;
    }
    return `${gbVal.toFixed(1)} GB`;
};

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 120,
            damping: 18
        }
    }
};

const CountdownTimer = ({ expiry }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiry) { setTimeLeft('—'); return; }
        const calculateTime = () => {
            const exp = new Date(expiry).getTime();
            if (isNaN(exp)) return '—';
            const now = new Date().getTime();
            const diff = exp - now;

            if (diff <= 0) return 'EXPIRED';

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        setTimeLeft(calculateTime());
        const timer = setInterval(() => setTimeLeft(calculateTime()), 1000);
        return () => clearInterval(timer);
    }, [expiry]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9px', color: '#8b949e', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>Auto-Destruct</span>
                <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: '800', letterSpacing: '0.02em' }}>{timeLeft}</span>
            </div>
            <Timer size={20} style={{ opacity: 0.8 }} />
        </div>
    );
};

const LiveClock = ({ format24h = true }) => {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="header-clock">
            <div className="header-clock-time">
                {time.toLocaleTimeString('en-US', { hour12: !format24h })}
            </div>
            <div className="header-clock-date">
                {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}
            </div>
        </div>
    );
};

const Toast = ({ message, type, onClose }) => {
    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: type === 'error' ? 'rgba(248, 81, 73, 0.9)' : (type === 'success' ? 'rgba(46, 160, 67, 0.9)' : 'rgba(31, 111, 235, 0.9)'),
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'fadeIn 0.3s ease',
            pointerEvents: 'auto'
        }}>
            <span>{typeof message === 'object' ? (message.message || message.error || JSON.stringify(message)) : message}</span>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
            </button>
        </div>
    );
};

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [guestToken, setGuestToken] = useState(localStorage.getItem('guestToken'));
    // Tracks whether the initial token verification is in progress.
    // While verifying, 401 responses must NOT trigger logout (they may be transient).
    const [verifyingToken, setVerifyingToken] = useState(!!localStorage.getItem('token'));
    const [guestPermissions, setGuestPermissions] = useState(() => {
        const token = localStorage.getItem('guestToken');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload.permissions || 'View';
            } catch (e) {
                console.error('Failed to decode guest token on init', e);
            }
        }
        return 'View';
    });
    const [shareId, setShareId] = useState(localStorage.getItem('shareId'));
    const [droppedSessionFiles, setDroppedSessionFiles] = useState([]);
    const [username, setUserName] = useState(localStorage.getItem('username'));
    const [userRole, setUserRole] = useState(localStorage.getItem('userRole') || 'User');
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(null); // { mode: 'create' } or { mode: 'edit', user } or { mode: 'reset', user }
    const [systemVersion, setSystemVersion] = useState({ isGit: false, localHash: 'v1.0.0', remoteHash: 'v1.0.0', updateAvailable: false });
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updatingSystem, setUpdatingSystem] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [view, setView] = useState(() => {
        const pathName = window.location.pathname;
        if (pathName.startsWith('/public/')) return 'browse';
        return localStorage.getItem('lastView') === 'explorer' ? 'browse' : (localStorage.getItem('lastView') || 'dashboard');
    });
    // Cluster Monitor States
    const [metrics, setMetrics] = useState({ metricsHistory: {}, agents: [] });
    const [selectedMonitorNode, setSelectedMonitorNode] = useState('local');
    const [nodeLogs, setNodeLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [explorerMode, setExplorerMode] = useState(localStorage.getItem('expMode') || 'devices');
    const [path, setPath] = useState(localStorage.getItem('expPath') || '/');
    const [files, setFiles] = useState([]);
    const [fileTypeFilter, setFileTypeFilter] = useState('all');
    const [selectedDevice, setSelectedDevice] = useState(() => {
        const saved = localStorage.getItem('selDev');
        if (saved === 'undefined') return null;
        try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
    });
    const [sortBy, setSortBy] = useState(localStorage.getItem('sortBy') || 'name');
    const [sortOrder, setSortOrder] = useState(localStorage.getItem('sortOrder') || 'asc');
    const [showClock, setShowClock] = useState(localStorage.getItem('showClock') !== 'false');
    const [format24h, setFormat24h] = useState(localStorage.getItem('format24h') !== 'false');

    const fetchSystemVersion = async (silent = false) => {
        if (!silent) setCheckingUpdates(true);
        try {
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            const res = await axios.get(`${API_BASE}/system/version`, { headers });
            setSystemVersion(res.data);
        } catch (err) {
            console.error('Failed to query system version', err);
            if (!silent) showToast('Failed to check for system updates', 'error');
        } finally {
            if (!silent) setCheckingUpdates(false);
        }
    };

    const handleTriggerSystemUpdate = async () => {
        setUpdatingSystem(true);
        setShowUpdateModal(true);
        setUpdateMessage('Contacting Git server and pulling latest main branch...');
        
        try {
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            await axios.post(`${API_BASE}/system/update`, {}, { headers });
            
            setUpdateMessage('Pulling updates, installing npm dependencies, and rebuilding client...');
            
            setTimeout(() => {
                setUpdateMessage('Rebooting services... Connection will reload shortly.');
                setTimeout(() => {
                    window.location.reload();
                }, 8000);
            }, 6000);
            
        } catch (err) {
            showToast(err.response?.data?.error || 'Update failed to trigger', 'error');
            setUpdatingSystem(false);
            setShowUpdateModal(false);
        }
    };

    useEffect(() => {
        if (view === 'settings' && userRole === 'Admin') {
            fetchSystemVersion(true);
        }
    }, [view]);

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    const gToken = localStorage.getItem('guestToken');
                    const sId = localStorage.getItem('shareId');
                    if (gToken) {
                        // Guest token expired — redirect back to share login
                        localStorage.removeItem('guestToken');
                        localStorage.removeItem('shareId');
                        setGuestToken(null);
                        setShareId(null);
                        if (sId) {
                            window.location.href = `/public/share/${sId}`;
                        }
                    } else {
                        // Only logout if we are NOT in the middle of the initial verify.
                        // This prevents transient 401s from background requests kicking out the user on refresh.
                        const isVerifying = window.__nexaVerifying === true;
                        if (!isVerifying) {
                            setToken(null);
                            localStorage.removeItem('token');
                            localStorage.removeItem('username');
                            localStorage.removeItem('userRole');
                        }
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    useEffect(() => {
        const pathName = window.location.pathname;
        if (pathName.startsWith('/public/share/')) {
            const parts = pathName.split('/');
            const id = parts[3];
            const params = new URLSearchParams(window.location.search);
            const guest = params.get('token') || localStorage.getItem('guestToken');

            if (id && guest) {
                setShareId(id);
                setGuestToken(guest);
                try {
                    const payload = JSON.parse(atob(guest.split('.')[1]));
                    setGuestPermissions(payload.permissions || 'View');
                } catch (e) { console.error('Failed to decode guest token', e); }
                localStorage.setItem('shareId', id);
                localStorage.setItem('guestToken', guest);
                setToken(null); // Clear regular token if guest
                localStorage.removeItem('token');
                setView('browse'); // Force view to browse for guest shares
                setExplorerMode('files');
                setPath('/'); // Start at root of shared folder
            }
        } else {
            const isGatewayRoute = 
                pathName.startsWith('/g/') || 
                pathName.startsWith('/p/') || 
                pathName.startsWith('/u/') || 
                pathName.startsWith('/e/');
            if (!isGatewayRoute) {
                // Discard any lingering guest sessions if we are in normal app routes
                setGuestToken(null);
                setShareId(null);
                localStorage.removeItem('guestToken');
                localStorage.removeItem('shareId');
            }
        }
    }, []);

    useEffect(() => {
        setFileTypeFilter('all');
    }, [path, selectedDevice]);

    const sortedFiles = React.useMemo(() => {
        let list = [...files];

        if (fileTypeFilter !== 'all') {
            list = list.filter(file => {
                if (fileTypeFilter === 'folders') {
                    return file.isDirectory;
                }

                if (file.isDirectory) return false;

                const ext = file.name.split('.').pop().toLowerCase();
                if (fileTypeFilter === 'images') {
                    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
                    return imgExts.includes(ext);
                }
                if (fileTypeFilter === 'media') {
                    const mediaExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'flac'];
                    return mediaExts.includes(ext);
                }
                if (fileTypeFilter === 'documents') {
                    const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'yaml', 'yml'];
                    return docExts.includes(ext);
                }
                return true;
            });
        }

        const sorted = list.sort((a, b) => {
            let fieldA, fieldB;
            if (sortBy === 'name') {
                fieldA = a.name.toLowerCase();
                fieldB = b.name.toLowerCase();
            } else if (sortBy === 'size') {
                fieldA = a.size || 0;
                fieldB = b.size || 0;
            } else if (sortBy === 'modified') {
                fieldA = new Date(a.mtime || a.modified).getTime();
                fieldB = new Date(b.mtime || b.modified).getTime();
            }

            if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
            if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [files, sortBy, sortOrder, fileTypeFilter]);
    const [devices, setDevices] = useState([]);
    const [clipboard, setClipboard] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activities, setActivities] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [lastSeenAlertTime, setLastSeenAlertTime] = useState(localStorage.getItem('lastSeenAlertTime') || '1970-01-01T00:00:00.000Z');
    const [localStorageInfo, setLocalStorageInfo] = useState(null);
    const [agentStorage, setAgentStorage] = useState([]);
    const [activeShares, setActiveShares] = useState([]);
    const [networkShares, setNetworkShares] = useState([]);
    const [filterText, setFilterText] = useState('');
    const [overwriteContext, setOverwriteContext] = useState(null); // { source, dest, agentId, type }
    const abortControllers = useRef({});

    const cancelOperation = (opId) => {
        if (abortControllers.current[opId]) {
            abortControllers.current[opId].abort();
            delete abortControllers.current[opId];
            setOperations(prev => prev.map(op => op.id === opId ? { ...op, status: 'Cancelled', progress: 0 } : op));
            showToast('Operation cancelled', 'info');
        } else {
            // For non-cancellable or already finished/failed ops, just remove from list
            setOperations(prev => prev.filter(op => op.id !== opId));
        }
    };

    const handleUpload = (filesList) => {
        if (filesList.length > 0) {
            const opId = Date.now();
            const name = filesList.length === 1 ? filesList[0].name : `${filesList.length} files`;
            const totalSize = filesList.reduce((acc, f) => acc + f.size, 0);
            const startTime = Date.now();

            // Create abort controller
            const controller = new AbortController();
            abortControllers.current[opId] = controller;

            setOperations(prev => [{
                id: opId,
                type: 'upload',
                name: name,
                status: 'In Progress',
                progress: 0,
                totalBytes: totalSize,
                bytesTransferred: 0,
                startTime: startTime
            }, ...prev]);
            setShowOperations(true);
            showToast(`Uploading ${name}...`, 'info');

            const formData = new FormData();
            filesList.forEach(f => formData.append('files', f));

            let uploadUrl = guestToken
                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/upload`
                : `${API_BASE}/files/upload?path=${encodeURIComponent(path)}`;
            if (!guestToken && selectedDevice?.type === 'Agent') uploadUrl += `&agentId=${selectedDevice.id}`;

            const headers = {
                Authorization: guestToken ? `Bearer ${guestToken}` : `Bearer ${token}`
            };

            axios.post(uploadUrl, formData, {
                headers,
                signal: controller.signal,
                timeout: 0,
                onUploadProgress: (progressEvent) => {
                    const { loaded, total } = progressEvent;
                    const percentCompleted = Math.round((loaded * 100) / total);
                    const timeElapsed = (Date.now() - startTime) / 1000; // seconds
                    const speed = timeElapsed > 0 ? loaded / timeElapsed : 0; // bytes/sec
                    const remainingBytes = total - loaded;
                    const eta = speed > 0 ? remainingBytes / speed : 0;

                    setOperations(prev => prev.map(o => o.id === opId ? {
                        ...o,
                        progress: percentCompleted,
                        bytesTransferred: loaded,
                        totalBytes: total,
                        speed: speed,
                        eta: eta
                    } : o));
                }
            }).then((res) => {
                if (abortControllers.current[opId]) delete abortControllers.current[opId];
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Scanning...', progress: 100 } : o));
                
                // Keep the "Scanning..." status visible longer so the user knows it's being processed
                // In a real app we would use WebSockets or SSE to know exactly when it's done.
                setTimeout(() => setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Completed' } : o)), 10000);
                setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 15000);
                
                showToast('Upload Complete, sent to Security Engine for scanning', 'success');

                if (guestToken) {
                    const serverResults = res.data?.results || [];
                    const uploadedMeta = filesList.map(f => {
                        const matchingResult = serverResults.find(r => r.name === f.name);
                        return {
                            name: f.name,
                            size: f.size,
                            time: new Date(),
                            status: matchingResult ? matchingResult.status : 'uploaded',
                            message: matchingResult ? matchingResult.message : 'Upload successful'
                        };
                    });
                    setDroppedSessionFiles(prev => [...uploadedMeta, ...prev]);
                } else {
                    fetchFiles(path);
                }
            }).catch((err) => {
                if (abortControllers.current[opId]) delete abortControllers.current[opId];
                if (axios.isCancel(err)) {
                    console.log('Upload cancelled');
                } else {
                    setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0 } : o));
                    const errMsg = err.response?.data?.error || 'Upload Failed';
                    showToast(errMsg, 'error');
                }
            });
        }
    };
    const fileInputRef = useRef(null);
    const [shareModal, setShareModal] = useState(null);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [pickerShareModal, setPickerShareModal] = useState(null); // { path, agentId }
    const [propertiesFile, setPropertiesFile] = useState(null);
    const [renameFile, setRenameFile] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [showMountModal, setShowMountModal] = useState(false);
    const [toast, setToast] = useState(null);
    const toastTimerRef = useRef(null);
    const [operations, setOperations] = useState([]);
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [showCompressModal, setShowCompressModal] = useState(false);
    const [compressTargets, setCompressTargets] = useState([]);
    const [confirmModal, setConfirmModal] = useState(null);
    const [downloadFile, setDownloadFile] = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null);
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [showOperations, setShowOperations] = useState(false);
    const [appName, setAppName] = useState('NexaDisk');
    const [settings, setSettings] = useState({});
    const [activityHistory, setActivityHistory] = useState(() => {
        const saved = localStorage.getItem('actHist');
        return saved ? JSON.parse(saved) : [];
    });
    const [nodeFilter, setNodeFilter] = useState('all'); // 'all', 'master', 'agent'
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [viewMode, setViewMode] = useState(localStorage.getItem('viewMode') || 'icons-lg');
    const [selectedPaths, setSelectedPaths] = useState(new Set());
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [inspectorMetadata, setInspectorMetadata] = useState(null);
    const [loadingMetadata, setLoadingMetadata] = useState(false);
    const [serverPlatform, setServerPlatform] = useState('win32'); // Default to win32, will be updated by settings

    const navigateTo = (newPath, newMode, newDevice = null, skipHistory = false) => {
        if (!skipHistory) {
            setHistory(prev => [{ path, mode: explorerMode, device: selectedDevice }, ...prev].slice(0, 50));
            setFuture([]);
        }

        setSelectedPaths(new Set());
        if (newDevice !== undefined) setSelectedDevice(newDevice);
        if (newMode) setExplorerMode(newMode);
        setPath(newPath);
    };

    const toggleSelection = (e, filePath) => {
        if (e) e.stopPropagation();
        setSelectedPaths(prev => {
            const next = new Set(prev);
            if (next.has(filePath)) next.delete(filePath);
            else next.add(filePath);
            return next;
        });
    };

    const selectAll = () => {
        if (selectedPaths.size === files.length && files.length > 0) {
            setSelectedPaths(new Set());
        } else {
            setSelectedPaths(new Set(files.map(f => f.path)));
        }
    };

    const goBack = () => {
        if (history.length === 0) return;
        const [prev, ...rest] = history;
        setFuture(f => [{ path, mode: explorerMode, device: selectedDevice }, ...f]);
        setHistory(rest);

        setSelectedDevice(prev.device);
        setExplorerMode(prev.mode);
        setPath(prev.path);
    };

    const goForward = () => {
        if (future.length === 0) return;
        const [next, ...rest] = future;
        setHistory(h => [{ path, mode: explorerMode, device: selectedDevice }, ...h]);
        setFuture(rest);

        setSelectedDevice(next.device);
        setExplorerMode(next.mode);
        setPath(next.path);
    };

    useEffect(() => {
        const handleError = (e) => {
            const msg = e.error ? e.error.message : e.message;
            if (msg.includes('length')) {
                showToast(`Runtime Error: ${msg}`, 'error');
                console.error('Stack:', e.error?.stack);
            }
        };
        window.addEventListener('error', handleError);
        return () => window.removeEventListener('error', handleError);
    }, []);

    useEffect(() => {
        if (view === 'browse' && selectedPaths.size === 1) {
            const firstPath = Array.from(selectedPaths)[0];
            const fetchMetadata = async () => {
                setLoadingMetadata(true);
                try {
                    const agentId = selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined;
                    const tok = token || localStorage.getItem('token') || guestToken;
                    const headers = tok ? { Authorization: `Bearer ${tok}` } : {};
                    const resp = await axios.get(
                        `/api/files/metadata?path=${encodeURIComponent(firstPath)}${agentId ? `&agentId=${agentId}` : ''}`,
                        { headers }
                    );
                    if (resp.data) {
                        setInspectorMetadata(resp.data);
                        setInspectorOpen(true);
                    }
                } catch (err) {
                    console.error('Failed to fetch node metadata for inspector', err);
                    setInspectorMetadata(null);
                } finally {
                    setLoadingMetadata(false);
                }
            };
            // Adding a small delay to avoid rapid fire when toggling quickly
            const t = setTimeout(fetchMetadata, 150);
            return () => clearTimeout(t);
        } else {
            setInspectorMetadata(null);
            setInspectorOpen(false);
        }
    }, [selectedPaths, selectedDevice, view, token, guestToken]);

    const fetchCurrentUser = async () => {
        try {
            const res = await axios.get('/api/v1/profile');
            setCurrentUser(res.data);
        } catch (e) {
            console.error('Failed to fetch user profile in App.jsx', e);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${API_BASE}/settings`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setSettings(res.data);
            if (res.data.appName) setAppName(res.data.appName);
            if (res.data.platform) setServerPlatform(res.data.platform);
        } catch (e) {
            // Do not logout here — let the global interceptor handle 401s safely
            console.error('Failed to fetch settings', e);
        }
    };

    const updateSetting = async (key, value) => {
        try {
            await axios.post(`${API_BASE}/settings/update`, { key, value }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchSettings();
            showToast('Settings saved', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    };

    useEffect(() => {
        if (token) {
            // Set auth header immediately so all subsequent requests are authenticated
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Verify the token is still valid before loading data.
            // This is the ONLY place that should trigger a logout on 401.
            const verifyAndLoad = async () => {
                window.__nexaVerifying = true;
                setVerifyingToken(true);
                try {
                    await axios.get(`${API_BASE}/verify`);
                    // Token is valid — load all data
                    fetchAllData();
                    fetchSettings();
                    fetchCurrentUser();
                } catch (err) {
                    // Token is genuinely invalid/expired — log out
                    if (err.response?.status === 401 || err.response?.status === 403) {
                        setToken(null);
                        localStorage.removeItem('token');
                        localStorage.removeItem('username');
                        localStorage.removeItem('userRole');
                    }
                } finally {
                    window.__nexaVerifying = false;
                    setVerifyingToken(false);
                }
            };

            verifyAndLoad();
            const i = setInterval(fetchAllData, 5000);
            return () => clearInterval(i);
        } else if (guestToken) {
            // For guest token, only fetch files for the shared path if permission is not Upload
            if (guestPermissions !== 'Upload') {
                fetchFiles(path);
            }
            // No polling for guest, as they only have access to a specific share
        }
    }, [token, guestToken, guestPermissions]);

    const fetchMetrics = async () => {
        try {
            const res = await axios.get(`${API_BASE}/agents/metrics`);
            setMetrics(res.data);
        } catch (e) {
            console.error('Failed to fetch metrics', e);
        }
    };

    const fetchNodeLogs = async (nodeId, silent = false) => {
        if (!silent) setLoadingLogs(true);
        try {
            const res = await axios.get(`${API_BASE}/agents/logs/${nodeId}`);
            setNodeLogs(res.data.logs || []);
        } catch (e) {
            console.error('Failed to fetch logs', e);
            if (!silent) {
                setNodeLogs([`[ERROR] Failed to load console logs from ${nodeId}`]);
            }
        } finally {
            if (!silent) setLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (view === 'monitor' && token) {
            fetchMetrics();
            fetchNodeLogs(selectedMonitorNode);
            const interval = setInterval(() => {
                fetchMetrics();
                fetchNodeLogs(selectedMonitorNode, true);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [view, token, selectedMonitorNode]);

    useEffect(() => {
        if (view === 'dashboard' && token) {
            fetchAllData();
        }
    }, [view, token]);

    useEffect(() => {
        localStorage.setItem('actHist', JSON.stringify(activityHistory));
    }, [activityHistory]);

    const activeOps = operations.filter(o => o.status === 'In Progress' || o.status === 'Preparing');
    const avgProgress = activeOps.length ? activeOps.reduce((acc, o) => acc + o.progress, 0) / activeOps.length : 0;

    const handleDragStart = (e, file) => {
        e.dataTransfer.setData('sourcePath', file.path);
        e.dataTransfer.setData('sourceName', file.name);
        e.dataTransfer.setData('sourceAgentId', selectedDevice?.id || '');
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e, destFolder = null) => {
        e.preventDefault();
        e.stopPropagation();
        const sourcePath = e.dataTransfer.getData('sourcePath');
        const sourceAgentId = e.dataTransfer.getData('sourceAgentId');
        const destPath = destFolder ? destFolder.path : path;
        const destAgentId = selectedDevice?.id || '';

        if (!sourcePath || sourcePath === destPath) return;

        // Check for cross-node drop
        if (sourceAgentId !== destAgentId) {
            showToast('Cross-node drag/drop not supported. Use Copy/Paste instead.', 'info');
            return;
        }

        await executeOperation('copy', sourcePath, destPath, destAgentId);
    };

    const showToast = (message, type = 'info') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
        }, 4000);
    };

    const copyToClipboard = (text) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Link copied to clipboard', 'success');
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            showToast('Link copied to clipboard', 'success');
        } catch (err) {
            showToast('Failed to copy link', 'error');
        }
        document.body.removeChild(textArea);
    };

    useEffect(() => {
        const pathName = window.location.pathname;
        const isGatewayRoute = 
            pathName.startsWith('/g/') || 
            pathName.startsWith('/p/') || 
            pathName.startsWith('/u/') || 
            pathName.startsWith('/e/');
        if (pathName !== '/' && !pathName.startsWith('/public/') && !isGatewayRoute) {
            window.history.replaceState(null, '', '/');
        }
    }, []);

    useEffect(() => {
        const titleMap = {
            'dashboard': 'NexaDisk | Dashboard',
            'machines': 'NexaDisk | Fleet',
            'browse': 'NexaDisk | Explorer',
            'active_shares': 'NexaDisk | Links',
            'network': 'NexaDisk | Network',
            'settings': 'NexaDisk | Settings',
            'monitor': 'NexaDisk | Monitor'
        };
        document.title = titleMap[view] || 'NexaDisk';
    }, [view]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (view !== 'browse') return;

            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                goBack();
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                goForward();
            } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'Backspace')) {
                // Find "Up" logic from header button
                if (explorerMode === 'files') {
                    const normalized = path.replace(/\\/g, '/');
                    const parts = normalized.split('/').filter(Boolean);
                    const isUNC = path.startsWith('\\\\') || path.startsWith('//');

                    if ((isUNC && parts.length > 2) || (!isUNC && parts.length > 1)) {
                        const newParts = parts.slice(0, -1);
                        const sep = isUNC ? '\\' : '/';
                        let prefix = '/';
                        if (isUNC) prefix = path.startsWith('\\\\') ? '\\\\' : '//';
                        else if (newParts.length > 0 && newParts[0].indexOf(':') !== -1) prefix = '';
                        navigateTo(prefix + newParts.join(sep), 'files');
                    } else if (selectedDevice?.children) {
                        navigateTo('/', 'partitions', selectedDevice);
                    } else {
                        navigateTo('/', 'devices', null);
                    }
                } else if (explorerMode === 'partitions') {
                    navigateTo('/', 'devices', null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [view, path, explorerMode, selectedDevice, history, future]); // Dependencies for state-based logic

    useEffect(() => {
        localStorage.setItem('lastView', view);
        localStorage.setItem('expMode', explorerMode);
        localStorage.setItem('expPath', path);
        if (selectedDevice) localStorage.setItem('selDev', JSON.stringify(selectedDevice));
        else localStorage.removeItem('selDev');
    }, [view, explorerMode, path, selectedDevice]);


    const fetchUsers = async () => {
        if (localStorage.getItem('userRole') !== 'Admin') return;
        try {
            const res = await axios.get(`${API_BASE}/users`);
            setUsers(res.data);
        } catch (e) {
            console.error('Failed to fetch users', e);
        }
    };

    const handleCreateUser = async (userData) => {
        try {
            await axios.post(`${API_BASE}/users/create`, userData);
            showToast('User created successfully', 'success');
            fetchUsers();
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to create user', 'error');
        }
    };

    const handleUpdateUser = async (userData) => {
        try {
            await axios.post(`${API_BASE}/users/update`, userData);
            showToast('User updated successfully', 'success');
            fetchUsers();
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to update user', 'error');
        }
    };

    const handleResetPassword = async (userData) => {
        try {
            await axios.post(`${API_BASE}/users/reset-password`, userData);
            showToast('Password reset successfully', 'success');
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to reset password', 'error');
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.post(`${API_BASE}/users/delete`, { id });
            showToast('User deleted successfully', 'success');
            fetchUsers();
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to delete user', 'error');
        }
    };

    const fetchAllData = async () => {
        try {
            const [localRes, metricsRes, activitiesRes, shareRes, netRes] = await Promise.all([
                axios.get(`${API_BASE}/storage/local`),
                axios.get(`${API_BASE}/agents/metrics`),
                axios.get(`${API_BASE}/activities`),
                axios.get(`${API_BASE}/share/list`),
                axios.get(`${API_BASE}/network/list`)
            ]);
            setLocalStorageInfo(localRes.data);
            setMetrics(metricsRes.data);
            setAgentStorage(metricsRes.data.agents || []);
            setActivities(activitiesRes.data);
            setActiveShares(shareRes.data);
            setNetworkShares(netRes.data);
            if (localStorage.getItem('userRole') === 'Admin') fetchUsers();
        } catch (e) {
            // Do not logout here — let the global interceptor handle 401s safely.
            // A single failed poll should never log the user out.
            console.error('[fetchAllData] Error:', e.message);
        }
    };

    useEffect(() => {
        if (view === 'browse') {
            if (guestToken) {
                if (guestPermissions !== 'Upload' && explorerMode === 'files') {
                    fetchFiles(path);
                }
            } else {
                if (explorerMode === 'devices') fetchDevices();
                else if (explorerMode === 'files') fetchFiles(path);
            }
        }
    }, [view, explorerMode, path, guestToken, guestPermissions]);

    useEffect(() => {
        if (showNotifications && activities && activities.length > 0) {
            const latestTime = activities[0].timestamp;
            localStorage.setItem('lastSeenAlertTime', latestTime);
            setLastSeenAlertTime(latestTime);
        }
    }, [showNotifications, activities]);

    useEffect(() => {
        if (!showNotifications) return;
        const handleClickOutside = (e) => {
            if (!e.target.closest('.notifications-dropdown-container')) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showNotifications]);

    useEffect(() => {
        const pollInterval = setInterval(async () => {
            const hasActive = operations.some(o => o.status === 'In Progress');
            if (hasActive) {
                try {
                    const res = await axios.get(`${API_BASE}/operations/status`);
                    const serverOps = res.data;

                    setOperations(prev => {
                        const updated = [...prev];
                        serverOps.forEach(sop => {
                            const idx = updated.findIndex(o => o.id === sop.id || o.id === parseInt(sop.id.split('_')[1]));
                            if (idx !== -1) {
                                const prevOp = updated[idx];
                                let speed = prevOp.speed || 0;
                                let eta = prevOp.eta || null;

                                if (sop.status === 'In Progress' && prevOp.bytesTransferred !== undefined) {
                                    const bytesDiff = sop.bytesTransferred - (prevOp.bytesTransferred || 0);
                                    const timeDiff = (Date.now() - (prevOp.lastUpdate || sop.startTime)) / 1000;
                                    if (timeDiff >= 1) {
                                        speed = bytesDiff / timeDiff;
                                        if (speed > 0) {
                                            eta = (sop.totalBytes - sop.bytesTransferred) / speed;
                                        }
                                    } else {
                                        speed = prevOp.speed;
                                        eta = prevOp.eta;
                                    }
                                }
                                updated[idx] = { ...prevOp, ...sop, speed, eta, lastUpdate: prevOp.lastUpdate && (Date.now() - prevOp.lastUpdate < 1000) ? prevOp.lastUpdate : Date.now() };
                            } else {
                                // For cross-node or newly discovered ops
                                updated.push({ ...sop, lastUpdate: Date.now() });
                            }
                        });
                        return updated;
                    });
                } catch (e) { }
            }
        }, 1000);
        return () => clearInterval(pollInterval);
    }, [operations]);

    useEffect(() => {
        const completedZipOps = operations.filter(o => o.type === 'zip_prepare' && o.status === 'Completed' && !o.downloadTriggered);
        
        completedZipOps.forEach(op => {
            op.downloadTriggered = true;
            
            let downloadUrl;
            if (op.agentId) {
                downloadUrl = `${API_BASE}/files/download/prepared/${op.id}?token=${localStorage.getItem('token') || ''}&agentId=${op.agentId}`;
            } else {
                downloadUrl = `${API_BASE}/files/download/prepared/${op.id}?token=${localStorage.getItem('token') || ''}`;
            }
            
            showToast(`Downloading prepared archive: ${op.name}`, 'success');
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', op.name);
            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                setOperations(prev => prev.filter(o => o.id !== op.id));
            }, 5000);
        });
    }, [operations]);

    const fetchDevices = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/storage/devices`);
            setDevices(res.data);
        } catch (e) { } finally { setLoading(false); }
    };

    const fetchFiles = async (p) => {
        setLoading(true);
        try {
            let url = guestToken
                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/list?path=${encodeURIComponent(p)}`
                : `${API_BASE}/files/list?path=${encodeURIComponent(p)}`;

            if (!guestToken && selectedDevice?.type === 'Agent') url += `&agentId=${selectedDevice.id}`;
            const res = await axios.get(url, { headers: { Authorization: guestToken ? `Bearer ${guestToken}` : `Bearer ${token}` } });
            setFiles(res.data);
            setPath(p);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to fetch files', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = (token, username, role) => {
        setToken(token);
        setUserName(username);
        setUserRole(role);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        const oldPass = e.target.oldPass.value;
        const newPass = e.target.newPass.value;
        try {
            await axios.post(`${API_BASE}/settings/password`, { oldPassword: oldPass, newPassword: newPass });
            showToast('Password changed successfully', 'success');
            e.target.reset();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update password', 'error');
        }
    };

    const handleSecurityQuestionChange = async (e) => {
        e.preventDefault();
        const question = e.target.question.value;
        const answer = e.target.answer.value;
        try {
            await axios.post(`${API_BASE}/settings/security-question`, { question, answer });
            showToast('Security verification configured successfully', 'success');
            e.target.reset();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update security verification', 'error');
        }
    };

    const handleApproveAgent = async (id) => {
        try {
            await axios.post(`${API_BASE}/agents/approve`, { id });
            showToast('Agent approved successfully', 'success');
            // Refresh agents list? Heartbeat will update it eventually, but we can manually refresh
            const resp = await axios.get(`${API_BASE}/agents`);
            setAgentStorage(resp.data);
        } catch (err) {
            showToast('Failed to approve agent', 'error');
        }
    };

    const handleDisconnectAgent = async (id) => {
        try {
            await axios.post(`${API_BASE}/agents/disconnect`, { id });
            showToast('Agent disconnected', 'success');
            setAgentStorage(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            showToast('Failed to disconnect agent', 'error');
        }
    };

    const handleAction = async (action, file) => {
        setContextMenu(null);

        if (action === 'open' && file) {
            navigateTo(file.path, 'files');
            return;
        }
        if (action === 'view' && file) {
            handleFileClick(file);
            return;
        }

        let targets = [];
        if (file) {
            if (file.path && selectedPaths.has(file.path)) {
                targets = Array.from(selectedPaths).map(p => files.find(f => f.path === p)).filter(Boolean);
            } else {
                targets = [file];
            }
        } else if (selectedPaths.size > 0) {
            targets = Array.from(selectedPaths).map(p => files.find(f => f.path === p)).filter(Boolean);
        }

        if (action === 'copy' || action === 'cut') {
            setClipboard({
                type: action,
                files: targets.map(t => ({
                    path: t.path,
                    name: t.name,
                    agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined
                }))
            });
            showToast(`${action === 'copy' ? 'Copied' : 'Cut'} ${targets.length} item(s)`, 'success');
        }

        if (action === 'delete') {
            setConfirmModal({
                message: `Permanently delete ${targets.length} item(s)?`,
                onConfirm: async () => {
                    for (const target of targets) {
                        const opId = Date.now();
                        setOperations(prev => [{ id: opId, type: 'delete', name: target.name, status: 'In Progress', progress: 50 }, ...prev]);
                        setShowOperations(true);
                        try {
                            const url = guestToken
                                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/delete`
                                : `${API_BASE}/files/delete`;

                            await axios({
                                method: 'delete',
                                url,
                                data: { path: target.path, agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined },
                                headers: { Authorization: guestToken ? `Bearer ${guestToken}` : `Bearer ${token}` }
                            });
                            setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Completed', progress: 100 } : o));
                            const completedOp = { id: opId, type: 'delete', name: target.name, status: 'Completed', timestamp: new Date().toISOString() };
                            setActivityHistory(prev => [completedOp, ...prev.slice(0, 49)]);
                            setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 5000);
                        } catch (err) {
                            showToast(`Failed to delete ${target.name}: ${err.response?.data?.error || err.message}`, 'error');
                            setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0 } : o));
                        }
                    }
                    showToast(`Delete operation completed for ${targets.length} items`, 'info');
                    fetchFiles(path);
                    setSelectedPaths(new Set());
                }
            });
        }

        if (action === 'rename' && targets.length === 1) setRenameFile(targets[0]);
        if (action === 'share' && targets.length === 1) {
            const targetPath = targets[0].path;
            const existingShare = activeShares.find(s => {
                if (s.path !== targetPath) return false;
                const isExpired = (s.expires_at && new Date(s.expires_at) < new Date()) || (s.max_views !== -1 && s.max_views != null && s.view_count >= s.max_views);
                return !isExpired;
            });
            if (existingShare) {
                showToast('Active link already exists. Opening editor.', 'info');
                setShareModal(existingShare);
            } else {
                setShareModal(targetPath);
            }
        }
        if (action === 'properties' && targets.length === 1) setPropertiesFile(targets[0]);

        if (action === 'compress' && targets.length > 0) {
            setCompressTargets(targets);
            setShowCompressModal(true);
            return;
        }

        if (action === 'extract' && targets.length === 1) {
            const target = targets[0];
            const opId = Date.now();
            setOperations(prev => [{ id: opId, type: 'extract', name: target.name, status: 'In Progress', progress: 30 }, ...prev]);
            setShowOperations(true);
            try {
                const agentId = selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined;
                await axios.post(`${API_BASE}/files/extract`, {
                    path: target.path,
                    targetDir: undefined,
                    agentId
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Completed', progress: 100 } : o));
                showToast(`Extracted ${target.name} successfully`, 'success');
                const completedOp = { id: opId, type: 'extract', name: target.name, status: 'Completed', timestamp: new Date().toISOString() };
                setActivityHistory(prev => [completedOp, ...prev.slice(0, 49)]);
                setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 5000);
            } catch (err) {
                const errorMsg = err.response?.data?.error || err.message || 'Extraction failed';
                showToast(`Failed to extract ${target.name}: ${errorMsg}`, 'error');
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0 } : o));
            } finally {
                fetchFiles(path);
                setSelectedPaths(new Set());
            }
            return;
        }

        if (action === 'scan' && targets.length === 1) {
            const target = targets[0];
            if (target.isDirectory) return;
            showToast(`Initiating security scan for ${target.name}...`, 'info');
            const opId = Date.now();
            setOperations(prev => [{ id: opId, type: 'security_scan', name: `Scanning: ${target.name}`, status: 'In Progress', progress: 30 }, ...prev]);
            setShowOperations(true);
            try {
                const res = await axios.post(`${API_BASE}/v1/security/scan/file`, { filePath: target.path }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const verdict = res.data.result.verdict;
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Completed', progress: 100 } : o));
                if (verdict === 'clean') {
                    showToast(`${target.name} is Clean. (Score: ${res.data.result.score})`, 'success');
                } else if (verdict === 'suspicious') {
                    showToast(`${target.name} is Suspicious. (Score: ${res.data.result.score})`, 'warning');
                } else {
                    showToast(`${target.name} is MALICIOUS!`, 'error');
                }
                setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 5000);
            } catch (err) {
                const errorMsg = err.response?.data?.error || err.message;
                showToast(`Scan failed: ${errorMsg}`, 'error');
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0, error: errorMsg } : o));
                setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 5000);
            }
            return;
        }

        if (action === 'download' && targets.length > 0) {
            const isMultiSelect = targets.length > 1;
            const isFolder = targets.length === 1 && targets[0].isDirectory;

            if (isMultiSelect || isFolder) {
                const targetPaths = targets.map(t => t.path);
                showToast('Preparing ZIP download...', 'info');
                setShowOperations(true);

                const url = `${API_BASE}/files/download/prepare`;
                const tokenHeader = `Bearer ${token}`;

                axios.post(url, {
                    paths: targetPaths,
                    agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined
                }, {
                    headers: { Authorization: tokenHeader }
                })
                .then(res => {
                    const { opId, agentId } = res.data;
                    showToast('Archive task started', 'info');
                    
                    const opName = isFolder ? `${targets[0].name}.zip` : `Selection-${Date.now()}.zip`;
                    const newOp = {
                        id: opId,
                        name: opName,
                        type: 'zip_prepare',
                        progress: 0,
                        status: 'In Progress',
                        agentId
                    };
                    setOperations(prev => {
                        if (prev.find(o => o.id === opId)) return prev;
                        return [newOp, ...prev];
                    });
                })
                .catch(err => {
                    console.error('Failed to initiate ZIP download', err);
                    showToast('ZIP packaging failed to start', 'error');
                });
            } else {
                const target = targets[0];
                let url;
                if (guestToken) {
                    url = `${API_BASE.replace('/api', '')}/public/share/${shareId}/download?path=${encodeURIComponent(target.path)}&token=${guestToken}`;
                } else {
                    url = `${API_BASE}/files/download?path=${encodeURIComponent(target.path)}&token=${localStorage.getItem('token') || ''}`;
                    if (selectedDevice?.type === 'Agent') url += `&agentId=${selectedDevice.id}`;
                }
                window.open(url);
            }
        }
    };

    const executeOperation = async (type, source, target, agentId, overwrite = false) => {
        const endpoint = type === 'copy' ? '/files/copy' : '/files/move';
        const opId = Date.now();
        const newOp = {
            id: opId,
            type: type,
            name: source.split(/[\\/]/).pop(),
            source: source,
            dest: target,
            status: 'In Progress',
            progress: 40
        };

        setOperations(prev => [newOp, ...prev]);
        setShowOperations(true);

        try {
            const res = await axios.post(`${API_BASE}${endpoint}`, {
                source,
                destination: target,
                agentId,
                overwrite
            });
            const actualOpId = res.data.opId || opId;
            setOperations(prev => prev.map(o => o.id === opId ? { ...o, id: actualOpId, status: 'Completed', progress: 100 } : o));
            showToast(`Successfully ${type === 'copy' ? 'copied' : 'moved'}`, 'success');
            fetchFiles(path);
            const completedOp = { ...newOp, id: actualOpId, status: 'Completed', progress: 100, timestamp: new Date().toISOString() };
            setActivityHistory(prev => [completedOp, ...prev.slice(0, 49)]);
            setTimeout(() => setOperations(prev => prev.filter(o => o.id !== actualOpId)), 10000);
        } catch (e) {
            if (e.response?.status === 409) {
                setOperations(prev => prev.filter(o => o.id !== opId));
                setOverwriteContext({ source, target, agentId, type });
                return;
            }
            const errorMsg = e.response?.data?.error || e.message || 'Operation failed';
            setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0, error: errorMsg } : o));
            showToast(errorMsg, 'error');
            const failedOp = { ...newOp, status: 'Failed', progress: 0, error: errorMsg, timestamp: new Date().toISOString() };
            setActivityHistory(prev => [failedOp, ...prev.slice(0, 49)]);
        }
    };

    const handleDownload = (file) => {
        handleAction('download', file);
    };

    const handlePaste = async () => {
        if (!clipboard) return;
        const destAgentId = selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined;

        if (clipboard.files) {
            for (const file of clipboard.files) {
                if (file.agentId !== destAgentId) {
                    showToast(`Cross-node ${clipboard.type} is not supported yet for ${file.name}`, 'error');
                    continue;
                }
                await executeOperation(clipboard.type, file.path, path, destAgentId);
            }
        } else {
            if (clipboard.agentId !== destAgentId) {
                showToast('Cross-node move/copy is not supported yet. Use Download/Upload instead.', 'error');
                return;
            }
            await executeOperation(clipboard.type, clipboard.path, path, destAgentId);
        }
        setClipboard(null);
    };

    const revokeShare = async (id) => {
        setConfirmModal({
            message: 'Revoke this secure link?',
            onConfirm: async () => {
                await axios.delete(`${API_BASE}/v1/shares/${id}`);
                fetchAllData();
            }
        });
    };

    const unmountDrive = async (id) => {
        setConfirmModal({
            message: 'Disconnect this network share?',
            onConfirm: async () => {
                await axios.delete(`${API_BASE}/network/${id}`);
                fetchAllData();
            }
        });
    };

    const onRightClick = (e, file = null) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, file });
    };


    const handleCreateFolder = async (folderName) => {
        try {
            await axios.post(`${API_BASE}/files/create/folder`, {
                parentPath: path,
                folderName,
                agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined
            });
            showToast('Folder created', 'success');
            fetchFiles(path);
            setShowFolderModal(false);
        } catch (e) { showToast('Failed to create folder', 'error'); }
    };

    const handleCompress = async (archiveName, format) => {
        if (!archiveName || compressTargets.length === 0) return;
        
        let finalName = archiveName;
        if (!finalName.toLowerCase().endsWith('.' + format)) {
            finalName = `${finalName}.${format}`;
        }

        const opId = Date.now();
        setOperations(prev => [{ id: opId, type: 'compress', name: finalName, status: 'In Progress', progress: 30 }, ...prev]);
        setShowOperations(true);
        setShowCompressModal(false);

        try {
            const targetPaths = compressTargets.map(t => t.path);
            const agentId = selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined;

            await axios.post(`${API_BASE}/files/compress`, {
                paths: targetPaths,
                archiveName: finalName,
                type: format,
                agentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Completed', progress: 100 } : o));
            showToast(`Archive ${finalName} created successfully`, 'success');
            const completedOp = { id: opId, type: 'compress', name: finalName, status: 'Completed', timestamp: new Date().toISOString() };
            setActivityHistory(prev => [completedOp, ...prev.slice(0, 49)]);
            setTimeout(() => setOperations(prev => prev.filter(o => o.id !== opId)), 5000);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Compression failed';
            showToast(`Failed to create archive: ${errorMsg}`, 'error');
            setOperations(prev => prev.map(o => o.id === opId ? { ...o, status: 'Failed', progress: 0 } : o));
        } finally {
            fetchFiles(path);
            setSelectedPaths(new Set());
            setCompressTargets([]);
        }
    };

    const isPreviewable = (file) => {
        if (!file?.name) return false;
        const ext = file.name.split('.').pop().toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const textExts = ['txt', 'md', 'json', 'yml', 'yaml', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'ini', 'conf', 'log', 'sh', 'bat', 'py', 'sql'];
        return imageExts.includes(ext) || videoExts.includes(ext) || textExts.includes(ext);
    };

    const normalizePath = (p) => {
        if (!p) return '';
        // Replace all sequences of slashes and backslashes with a single forward slash
        // Except for the very beginning (preserve UNC start if it exists, though usually normalized to //)
        let normalized = p.replace(/[\\/]+/g, '/');
        if (p.startsWith('\\\\')) normalized = '//' + normalized;
        return normalized.toLowerCase();
    };

    const handleFileClick = (file) => {
        if (!file?.name) return;
        if (isPreviewable(file)) {
            const ext = file.name.split('.').pop().toLowerCase();
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
            setPreviewMedia({
                ...file,
                agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined,
                type: imageExts.includes(ext) ? 'image' : videoExts.includes(ext) ? 'video' : 'text'
            });
        } else {
            setDownloadFile({
                ...file,
                agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined
            });
        }
    };

    const handleNextPreview = (e) => {
        if (e) e.stopPropagation();
        if (!previewMedia) return;
        const previewable = files.filter(f => isPreviewable(f));
        if (previewable.length === 0) return;

        const normCurrent = normalizePath(previewMedia.path);
        let currentIndex = previewable.findIndex(f => normalizePath(f.path) === normCurrent);

        if (currentIndex === -1) currentIndex = previewable.findIndex(f => f.name === previewMedia.name);

        if (currentIndex !== -1 && currentIndex < previewable.length - 1) {
            handleFileClick(previewable[currentIndex + 1]);
        } else {
            handleFileClick(previewable[0]);
        }
    };

    const handlePrevPreview = (e) => {
        if (e) e.stopPropagation();
        if (!previewMedia) return;
        const previewable = files.filter(f => isPreviewable(f));
        if (previewable.length === 0) return;

        const normCurrent = normalizePath(previewMedia.path);
        let currentIndex = previewable.findIndex(f => normalizePath(f.path) === normCurrent);

        if (currentIndex === -1) currentIndex = previewable.findIndex(f => f.name === previewMedia.name);

        if (currentIndex > 0) {
            handleFileClick(previewable[currentIndex - 1]);
        } else {
            handleFileClick(previewable[previewable.length - 1]);
        }
    };

    useEffect(() => {
        const handleNavKeys = (e) => {
            if (!previewMedia) return;
            if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') {
                if (e.key === 'Escape') {
                    document.activeElement.blur();
                    e.preventDefault();
                }
                return;
            }
            if (e.key === 'ArrowRight') { e.preventDefault(); handleNextPreview(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevPreview(); }
            if (e.key === 'Escape') setPreviewMedia(null);
        };
        window.addEventListener('keydown', handleNavKeys);
        return () => window.removeEventListener('keydown', handleNavKeys);
    }, [previewMedia, files]);

    // Standalone Share Gateway Portals
    const currentPathName = window.location.pathname;
    const guestMatch = currentPathName.match(/^\/g\/([^/]+)/);
    const publicMatch = currentPathName.match(/^\/p\/([^/]+)/);
    const uploadMatch = currentPathName.match(/^\/u\/([^/]+)/);
    const otpMatch = currentPathName.match(/^\/e\/([^/]+)/);

    if (guestMatch) {
        return (
            <>
                <GuestPortal shareId={guestMatch[1]} showToast={showToast} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }
    if (publicMatch) {
        return (
            <>
                <PublicPortal shareId={publicMatch[1]} showToast={showToast} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }
    if (uploadMatch) {
        return (
            <>
                <UploadPortal shareId={uploadMatch[1]} showToast={showToast} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }

    // Show a loading screen while verifying the saved token.
    // This prevents the login page from flashing on page refresh.
    if (verifyingToken) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '100vh', background: '#0d1117', flexDirection: 'column', gap: '16px'
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTop: '3px solid #6e8efb',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Verifying session...</span>
            </div>
        );
    }

    if (!token && !guestToken) {
        const pathName = window.location.pathname;
        if (pathName.startsWith('/public/share/')) {
            const parts = pathName.split('/');
            const id = parts[3];
            if (id) {
                window.location.href = `/public/share/${id}`;
                return null;
            }
        }
        return (
            <>
                <AuthScreen handleLogin={handleLogin} appName={appName} />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </>
        );
    }


    const allNodes = [
        ...(localStorageInfo ? [{ ...localStorageInfo, type: 'Master', status: 'approved', online: true }] : []),
        ...agentStorage.map(a => ({ ...a, type: 'Slave' }))
    ];

    const filteredNodes = allNodes.filter(node => {
        const matchesSearch = node.hostname.toLowerCase().includes(filterText.toLowerCase());
        const matchesType = nodeFilter === 'all' ||
            (nodeFilter === 'master' && node.type === 'Master') ||
            (nodeFilter === 'agent' && node.type === 'Slave');
        return matchesSearch && matchesType;
    });

    // AGGREGATE STATS (Based on filter)
    const stats = filteredNodes.reduce((acc, node) => {
        const disks = node.disks || [];
        disks.forEach(d => {
            acc.total += (d.size || 0);
            acc.used += (d.used || 0);
        });
        return acc;
    }, { total: 0, used: 0 });

    const totalPercentage = stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0;

    // Calculate aggregate cluster CPU and memory averages of all online approved nodes
    const onlineApprovedNodes = filteredNodes.filter(n => n.online && n.status === 'approved');
    const avgCpu = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.cpu || 0), 0) / onlineApprovedNodes.length)
        : 0;
    const avgMemory = onlineApprovedNodes.length > 0
        ? Math.round(onlineApprovedNodes.reduce((sum, n) => sum + (n.memory || 0), 0) / onlineApprovedNodes.length)
        : 0;

    // Calculate active operations for header progress (Already defined above)

    return (
        <div className="dashboard-shell" onContextMenu={e => e.preventDefault()}>
            {!(guestToken && guestPermissions === 'Upload') && (
                <aside className="side-nav">
                    <div className="side-logo" style={{ cursor: 'pointer' }} onClick={() => !guestToken && setView('dashboard')}>
                        <Database size={24} color="var(--accent-gold)" />
                        <span>{appName}</span>
                    </div>
                    <div className="sidebar-nav">
                        {!guestToken && (
                            <>
                                <div className={`nav-link ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}>
                                    <LayoutDashboard size={18} />
                                    <span>Dashboard</span>
                                </div>
                                <div className={`nav-link ${view === 'browse' ? 'active' : ''}`} onClick={() => { setView('browse'); setExplorerMode('devices'); }}>
                                    <FolderTree size={18} />
                                    <span>File Explorer</span>
                                </div>
                                <div className={`nav-link ${view === 'machines' ? 'active' : ''}`} onClick={() => setView('machines')}>
                                    <Cpu size={18} />
                                    <span>Machines</span>
                                </div>
                                <div className={`nav-link ${view === 'monitor' ? 'active' : ''}`} onClick={() => setView('monitor')}>
                                    <Activity size={18} />
                                    <span>Cluster Monitor</span>
                                </div>
                                <div className={`nav-link ${view === 'active_shares' ? 'active' : ''}`} onClick={() => setView('active_shares')}>
                                    <Link2 size={18} />
                                    <span>Active Shares</span>
                                </div>
                                <div className={`nav-link ${view === 'network' ? 'active' : ''}`} onClick={() => setView('network')}>
                                    <Globe size={18} />
                                    <span>Network Shares</span>
                                </div>
                                <div className={`nav-link ${view === 'sync' ? 'active' : ''}`} onClick={() => setView('sync')}>
                                    <RefreshCw size={18} />
                                    <span>Sync Center</span>
                                </div>
                                <div className={`nav-link ${view === 'ai_automate' ? 'active' : ''}`} onClick={() => setView('ai_automate')}>
                                    <Sparkles size={18} />
                                    <span>AI Automator</span>
                                </div>
                            </>
                        )}
                        {guestToken && (
                            <div className={`nav-link active`}>
                                <Share2 size={18} color="var(--accent-gold)" />
                                <span>Shared Space</span>
                            </div>
                        )}
                    </div>

                    {!guestToken && (
                        <div className="sidebar-group">
                            <p className="nav-group-label">Administrative</p>
                            {['Admin', 'Administrator', 'Operator'].includes(userRole) && (
                                <NavItem active={view === 'security'} onClick={() => setView('security')} icon={<Shield size={20} />} label="Security Center" />
                            )}
                            <NavItem active={view === 'alerts'} onClick={() => setView('alerts')} icon={<Bell size={20} />} label="Alert Management" />
                            <NavItem active={view === 'profile'} onClick={() => setView('profile')} icon={<User size={20} />} label="My Profile" />
                            <NavItem active={view === 'settings'} onClick={() => setView('settings')} icon={<SettingsIcon size={20} />} label="Settings" />
                        </div>
                    )}
                    {!guestToken && <div style={{ marginTop: 'auto' }} className="nav-link" onClick={() => localStorage.clear() || window.location.reload()}><LogOut size={18} /> <span>Disconnect</span></div>}
                </aside>
            )}

            <main className="main-view">
                {!(guestToken && guestPermissions === 'Upload') && (
                    <header className="top-bar">
                        {!guestToken ? (
                            <div className="search-bar">
                                <Search size={18} color="#8b949e" />
                                <input placeholder="Quantum search..." value={filterText} onChange={e => setFilterText(e.target.value)} />
                            </div>
                        ) : (
                            <div style={{ flex: 1 }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {!guestToken && showClock && <LiveClock format24h={format24h} />}
                            {!guestToken && (
                                <div className="notifications-dropdown-container" style={{ position: 'relative' }}>
                                    <div 
                                        className={`active-badge ${showNotifications ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowNotifications(!showNotifications);
                                        }} 
                                        style={{ 
                                            cursor: 'pointer',
                                            padding: '8px 10px',
                                            background: showNotifications ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            position: 'relative',
                                            transition: '0.2s',
                                            height: '36px',
                                            width: '36px'
                                        }}
                                        title="System Alerts"
                                    >
                                        <Bell size={18} color={(activities || []).some(act => new Date(act.timestamp) > new Date(lastSeenAlertTime)) ? "var(--accent-gold)" : "#8b949e"} />
                                        {(activities || []).some(act => new Date(act.timestamp) > new Date(lastSeenAlertTime)) && (
                                            <span style={{
                                                position: 'absolute',
                                                top: '-2px',
                                                right: '-2px',
                                                background: '#f85149',
                                                color: '#fff',
                                                borderRadius: '50%',
                                                width: '14px',
                                                height: '14px',
                                                fontSize: '8px',
                                                fontWeight: '900',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: '0 0 0 2px #0d1117'
                                            }}>
                                                {(activities || []).filter(act => new Date(act.timestamp) > new Date(lastSeenAlertTime)).length}
                                            </span>
                                        )}
                                    </div>

                                    <AnimatePresence>
                                        {showNotifications && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                                style={{
                                                    position: 'absolute',
                                                    top: '44px',
                                                    right: '0px',
                                                    width: '360px',
                                                    background: 'rgba(13, 17, 23, 0.92)',
                                                    backdropFilter: 'blur(20px)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                                                    zIndex: 1000,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    maxHeight: '480px',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {/* Header */}
                                                <div style={{ padding: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Bell size={16} color="var(--accent-gold)" />
                                                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>Notifications Log</span>
                                                    </div>
                                                    <span 
                                                        onClick={() => {
                                                            setShowNotifications(false);
                                                            setView('alerts');
                                                        }}
                                                        style={{ fontSize: '11px', color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        Configure
                                                    </span>
                                                </div>

                                                {/* List */}
                                                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {(!activities || activities.length === 0) ? (
                                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8b949e', fontSize: '12px' }}>
                                                            No notifications recorded yet.
                                                        </div>
                                                    ) : (
                                                        activities.slice(0, 10).map((act, index) => {
                                                            let sideBarCol = 'rgba(255,255,255,0.1)';
                                                            const severity = act.error || 'info';
                                                            if (severity === 'warning') sideBarCol = '#f2c94c';
                                                            else if (severity === 'error') sideBarCol = '#eb5757';
                                                            else if (severity === 'info') sideBarCol = 'var(--accent-cyan)';

                                                            return (
                                                                <div 
                                                                    key={act.id || index} 
                                                                    style={{ 
                                                                        padding: '10px 12px',
                                                                        background: 'rgba(255, 255, 255, 0.015)',
                                                                        border: '1px solid rgba(255, 255, 255, 0.03)',
                                                                        borderLeft: `3px solid ${sideBarCol}`,
                                                                        borderRadius: '6px',
                                                                        display: 'flex',
                                                                        flexDirection: 'column',
                                                                        gap: '4px',
                                                                        textAlign: 'left'
                                                                    }}
                                                                >
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{act.name || 'Notification'}</span>
                                                                        <span style={{ fontSize: '9px', color: '#8b949e' }}>
                                                                            {(() => {
                                                                                const diff = Date.now() - new Date(act.timestamp).getTime();
                                                                                const mins = Math.floor(diff / 60000);
                                                                                if (mins < 1) return 'Just now';
                                                                                if (mins < 60) return `${mins}m ago`;
                                                                                const hrs = Math.floor(mins / 60);
                                                                                if (hrs < 24) return `${hrs}h ago`;
                                                                                return new Date(act.timestamp).toLocaleDateString();
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '11px', color: '#c9d1d9', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                                                                        {act.status || act.message || ''}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {/* Footer */}
                                                {activities && activities.length > 0 && (
                                                    <div 
                                                        onClick={() => {
                                                            setShowNotifications(false);
                                                            setView('alerts');
                                                        }}
                                                        style={{ 
                                                            padding: '12px', 
                                                            textAlign: 'center', 
                                                            fontSize: '12px', 
                                                            color: 'var(--accent-gold)', 
                                                            cursor: 'pointer', 
                                                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                                            fontWeight: '700',
                                                            background: 'rgba(255, 255, 255, 0.01)',
                                                            transition: '0.2s'
                                                        }}
                                                        className="notifications-footer"
                                                    >
                                                        View All Alerts ({activities.length})
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                            {!guestToken && (
                                <div className="active-badge" onClick={() => setShowOperations(true)} style={{ cursor: 'pointer', opacity: operations.length === 0 ? 0.5 : 1 }}>
                                    <Activity size={16} color={operations.length === 0 ? "#8b949e" : "var(--accent-gold)"} />
                                    <span style={{ color: operations.length === 0 ? "#8b949e" : "#fff" }}>{operations.length} ACTIVE</span>
                                </div>
                            )}
                            {guestToken ? (
                                <>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Guest Session</div>
                                        <div style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>Secure Session</div>
                                    </div>
                                    <div className="user-avatar" style={{ background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)' }}>
                                        <ShieldCheck size={20} color="var(--accent-cyan)" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{currentUser?.display_name || username}</div>
                                        <div style={{ fontSize: '11px', color: '#8b949e' }}>Operator Online</div>
                                    </div>
                                    <div 
                                        className="user-avatar" 
                                        onClick={() => setView('profile')} 
                                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}
                                    >
                                        <Avatar user={currentUser || { username }} size={36} />
                                    </div>
                                </>
                            )}
                        </div>
                    </header>
                )}

                <section className="content-pane fade-in">
                    <AnimatePresence mode="wait">
                        {view === 'profile' && (
                            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <ProfileSettings onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)} />
                            </motion.div>
                        )}

                        {view === 'settings' && (
                            <motion.div key="set" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '40px' }}>User Settings</h2>

                                <div style={{ display: 'grid', gap: '24px', maxWidth: '600px' }}>
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}><User size={20} color="var(--accent-gold)" /> Profile</h3>
                                        <div style={{ display: 'flex', gap: '40px' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#8b949e' }}>USERNAME</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', marginTop: '4px' }}>{username}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#8b949e' }}>ROLE</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', marginTop: '4px', color: 'var(--accent-cyan)' }}>{userRole}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '12px', color: '#8b949e' }}>STATUS</div>
                                                <div style={{ fontSize: '16px', fontWeight: '600', marginTop: '4px', color: '#3fb950' }}>Active</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Activity size={20} color="var(--accent-gold)" /> Branding</h3>
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '8px' }}>APPLICATION NAME</label>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <input
                                                    type="text"
                                                    defaultValue={appName}
                                                    id="appNameInput"
                                                    style={{ flex: 1, padding: '10px', background: '#000', border: '1px solid var(--border-dim)', borderRadius: '8px', color: '#fff' }}
                                                />
                                                <button
                                                    onClick={() => updateSetting('appName', document.getElementById('appNameInput').value)}
                                                    className="btn-primary"
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    Apply Change
                                                </button>
                                            </div>
                                            <p style={{ fontSize: '11px', color: '#484f58', marginTop: '8px' }}>This name will appear in the Sidebar, Login screen, and Dashboard.</p>
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Monitor size={20} color="var(--accent-gold)" /> Interface & Clock</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Show Global Clock</div>
                                                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Display clock in the top bar</div>
                                                </div>
                                                <div
                                                    onClick={() => { setShowClock(!showClock); localStorage.setItem('showClock', !showClock); }}
                                                    style={{ width: '40px', height: '20px', background: showClock ? 'var(--accent-gold)' : '#333', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                                >
                                                    <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: showClock ? '22px' : '2px', transition: '0.3s' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold' }}>24-Hour Format</div>
                                                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Switch between 12h and 24h</div>
                                                </div>
                                                <div
                                                    onClick={() => { setFormat24h(!format24h); localStorage.setItem('format24h', !format24h); }}
                                                    style={{ width: '40px', height: '20px', background: format24h ? 'var(--accent-gold)' : '#333', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                                >
                                                    <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: format24h ? '22px' : '2px', transition: '0.3s' }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {userRole === 'Admin' && (
                                        <>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)', marginBottom: '24px' }}>
                                                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Send size={20} color="var(--accent-gold)" /> Telegram Alerts</h3>
                                                <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '20px' }}>Configure a Telegram bot to send real-time system alerts when Sync tasks finish or folder operations are performed by the AI Automator.</p>
                                                
                                                <div style={{ marginBottom: '16px' }}>
                                                    <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '800' }}>TELEGRAM BOT TOKEN</label>
                                                    <input 
                                                        type="password" 
                                                        placeholder="Enter Bot Token (e.g. 123456789:ABCdef...)"
                                                        value={settings.telegramBotToken || ''} 
                                                        onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                                                        onBlur={(e) => updateSetting('telegramBotToken', e.target.value)}
                                                        style={{ width: '100%', padding: '10px', background: '#000', border: '1px solid var(--border-dim)', borderRadius: '8px', color: '#fff', outline: 'none' }} 
                                                    />
                                                </div>
                                                
                                                <div style={{ marginBottom: '20px' }}>
                                                    <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '8px', fontWeight: '800' }}>TELEGRAM CHAT ID / CHANNEL NAME</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Enter Chat ID (e.g. -10012345678) or Channel Username"
                                                        value={settings.telegramChatId || ''} 
                                                        onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                                                        onBlur={(e) => updateSetting('telegramChatId', e.target.value)}
                                                        style={{ width: '100%', padding: '10px', background: '#000', border: '1px solid var(--border-dim)', borderRadius: '8px', color: '#fff', outline: 'none' }} 
                                                    />
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Notify Sync Tasks</div>
                                                            <div style={{ fontSize: '11px', color: '#8b949e' }}>Alerts on Sync Job results</div>
                                                        </div>
                                                        <div
                                                            onClick={() => {
                                                                const nextVal = settings.telegramNotifySync === '1' ? '0' : '1';
                                                                setSettings({ ...settings, telegramNotifySync: nextVal });
                                                                updateSetting('telegramNotifySync', nextVal);
                                                            }}
                                                            style={{ width: '40px', height: '20px', background: settings.telegramNotifySync === '1' ? 'var(--accent-gold)' : '#333', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                                        >
                                                            <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: settings.telegramNotifySync === '1' ? '22px' : '2px', transition: '0.3s' }} />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '10px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>Notify AI Automator</div>
                                                            <div style={{ fontSize: '11px', color: '#8b949e' }}>Alerts on AI clean/organize</div>
                                                        </div>
                                                        <div
                                                            onClick={() => {
                                                                const nextVal = settings.telegramNotifyAi === '1' ? '0' : '1';
                                                                setSettings({ ...settings, telegramNotifyAi: nextVal });
                                                                updateSetting('telegramNotifyAi', nextVal);
                                                            }}
                                                            style={{ width: '40px', height: '20px', background: settings.telegramNotifyAi === '1' ? 'var(--accent-gold)' : '#333', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.3s' }}
                                                        >
                                                            <div style={{ width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: settings.telegramNotifyAi === '1' ? '22px' : '2px', transition: '0.3s' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)', marginBottom: '24px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Cpu size={20} color="var(--accent-cyan)" /> System Version & Updates</h3>
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <button 
                                                            type="button"
                                                            onClick={() => fetchSystemVersion(false)} 
                                                            disabled={checkingUpdates || updatingSystem} 
                                                            className="btn-secondary" 
                                                            style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}
                                                        >
                                                            {checkingUpdates ? 'Checking...' : 'Check for Updates'}
                                                        </button>
                                                        {systemVersion.updateAvailable && (
                                                            <button 
                                                                type="button"
                                                                onClick={handleTriggerSystemUpdate} 
                                                                disabled={updatingSystem} 
                                                                className="btn-primary" 
                                                                style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px' }}
                                                            >
                                                                Install Update
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px' }}>
                                                    <div>
                                                        <span style={{ fontSize: '11px', color: '#8b949e', display: 'block', textTransform: 'uppercase', fontWeight: '800' }}>Local Git Version</span>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '14px', marginTop: '4px', display: 'block', color: 'var(--accent-cyan)' }}>
                                                            {systemVersion.localHash}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span style={{ fontSize: '11px', color: '#8b949e', display: 'block', textTransform: 'uppercase', fontWeight: '800' }}>Remote Origin Version</span>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '14px', marginTop: '4px', display: 'block', color: systemVersion.remoteHash === 'unknown' ? '#eb5757' : '#c9d1d9' }}>
                                                            {systemVersion.remoteHash}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                                    {systemVersion.updateAvailable ? (
                                                        <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>⚠️ A new update is available on GitHub. Click "Install Update" to apply it.</span>
                                                    ) : (
                                                        <span style={{ color: '#3fb950', fontWeight: 'bold' }}>✓ NexaDisk is running the latest version from your GitHub repository.</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-dim)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><User size={20} color="var(--accent-gold)" /> Team Management</h3>
                                                    <button onClick={() => setShowUserModal({ mode: 'create' })} className="btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>Add User</button>
                                                </div>
                                            <div style={{ background: '#000', borderRadius: '8px', border: '1px solid var(--border-dim)', overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-dim)' }}>
                                                        <tr>
                                                            <th style={{ textAlign: 'left', padding: '12px' }}>USERNAME</th>
                                                            <th style={{ textAlign: 'left', padding: '12px' }}>ROLE</th>
                                                            <th style={{ textAlign: 'right', padding: '12px' }}>ACTIONS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {users.map(u => (
                                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                                                                <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.username}</td>
                                                                <td style={{ padding: '12px' }}>
                                                                    <span style={{
                                                                        padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold',
                                                                        background: u.role === 'Admin' ? 'var(--accent-cyan-glow)' : 'rgba(255,255,255,0.05)',
                                                                        color: u.role === 'Admin' ? 'var(--accent-cyan)' : '#8b949e'
                                                                    }}>{u.role}</span>
                                                                </td>
                                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                                        <button onClick={() => setShowUserModal({ mode: 'edit', user: u })} title="Edit User" style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><Edit size={14} /></button>
                                                                        <button onClick={() => setShowUserModal({ mode: 'reset', user: u })} title="Reset Password" style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}><Lock size={14} /></button>
                                                                        {u.username !== 'admin' && u.username !== username && (
                                                                            <button onClick={() => handleDeleteUser(u.id)} title="Delete User" style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )}
                                </div>
                            </motion.div>
                        )}
                        {view === 'dashboard' && (
                            <motion.div
                                key="db"
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                exit="hidden"
                            >
                                <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                    <div><h2>System Intelligence</h2><p style={{ color: '#8b949e' }}>Real-time telemetry and active operations</p></div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className="filter-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '4px', border: '1px solid var(--border-dim)' }}>
                                            {['all', 'master', 'agent'].map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setNodeFilter(type)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        fontSize: '11px',
                                                        borderRadius: '6px',
                                                        background: nodeFilter === type ? 'var(--accent-gold)' : 'transparent',
                                                        color: nodeFilter === type ? '#000' : '#8b949e',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        fontWeight: '700',
                                                        textTransform: 'uppercase'
                                                    }}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="filter-badge" style={{ position: 'relative' }}>
                                            <Filter size={14} />
                                            <input
                                                value={filterText}
                                                onChange={e => setFilterText(e.target.value)}
                                                placeholder="Search nodes..."
                                                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', outline: 'none', marginLeft: '8px', width: '120px' }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                                <div className="dashboard-main-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
                                    <div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                                            <motion.div className="st-card shadow-premium" variants={itemVariants} tabIndex={0}>
                                                <p className="nav-group-label" style={{ margin: 0 }}>Network Capacity</p>
                                                <p style={{ fontSize: '32px', fontWeight: '900', margin: '8px 0' }}>
                                                    {(() => { const formatGB = (gb) => gb >= 999.9 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`; return formatGB(stats.total / 1e9); })()}
                                                </p>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8b949e', marginBottom: '6px' }}>
                                                    <span>{(() => { const formatGB = (gb) => gb >= 999.9 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`; return formatGB(stats.used / 1e9); })()} USED</span>
                                                    <span>{totalPercentage}%</span>
                                                </div>
                                                <div className="st-progress-rail"><div className="st-progress-fill" style={{ width: `${totalPercentage}%`, background: totalPercentage > 90 ? '#f85149' : 'var(--accent-gold)' }}></div></div>
                                            </motion.div>

                                            <motion.div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', minHeight: '140px' }} variants={itemVariants} tabIndex={0}>
                                                <p className="nav-group-label" style={{ margin: 0, alignSelf: 'flex-start' }}>Cluster CPU Avg</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100px', height: '50px', marginTop: '12px' }}>
                                                    <svg viewBox="0 0 100 50" style={{ width: '100px', height: '50px' }}>
                                                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                                                        <motion.path 
                                                            d="M 10 50 A 40 40 0 0 1 90 50" 
                                                            fill="none" 
                                                            stroke={avgCpu > 80 ? '#f85149' : avgCpu > 50 ? 'var(--accent-gold)' : 'var(--accent-cyan)'} 
                                                            strokeWidth="8" 
                                                            strokeLinecap="round"
                                                            strokeDasharray="125.6"
                                                            initial={{ strokeDashoffset: 125.6 }}
                                                            animate={{ strokeDashoffset: 125.6 - (125.6 * (avgCpu / 100)) }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                        />
                                                    </svg>
                                                    <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
                                                        <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>{avgCpu}%</span>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            <motion.div className="st-card shadow-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', minHeight: '140px' }} variants={itemVariants} tabIndex={0}>
                                                <p className="nav-group-label" style={{ margin: 0, alignSelf: 'flex-start' }}>Cluster RAM Avg</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100px', height: '50px', marginTop: '12px' }}>
                                                    <svg viewBox="0 0 100 50" style={{ width: '100px', height: '50px' }}>
                                                        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" strokeLinecap="round" />
                                                        <motion.path 
                                                            d="M 10 50 A 40 40 0 0 1 90 50" 
                                                            fill="none" 
                                                            stroke={avgMemory > 80 ? '#f85149' : avgMemory > 50 ? 'var(--accent-gold)' : 'var(--accent-cyan)'} 
                                                            strokeWidth="8" 
                                                            strokeLinecap="round"
                                                            strokeDasharray="125.6"
                                                            initial={{ strokeDashoffset: 125.6 }}
                                                            animate={{ strokeDashoffset: 125.6 - (125.6 * (avgMemory / 100)) }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                        />
                                                    </svg>
                                                    <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
                                                        <span style={{ fontSize: '18px', fontWeight: '900', color: '#fff' }}>{avgMemory}%</span>
                                                    </div>
                                                </div>
                                            </motion.div>

                                            <motion.div className="st-card shadow-premium" variants={itemVariants} tabIndex={0}>
                                                <p className="nav-group-label" style={{ margin: 0 }}>Active Nodes</p>
                                                <p style={{ fontSize: '32px', fontWeight: '900', margin: '8px 0' }}>{filteredNodes.length}</p>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    {filteredNodes.map((n, i) => (
                                                        <div key={i} className="online-dot" style={{ background: n.online ? '#3fb950' : '#f85149', boxShadow: n.online ? '0 0 6px #3fb950' : 'none' }}></div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </div>
                                        <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {filteredNodes.map((node, nIdx) => {
                                                const isOnline = node.online;
                                                const isMaster = node.type === 'Master';
                                                return (
                                                    <motion.div 
                                                        key={node.hostname || nIdx} 
                                                        className="st-card shadow-premium" 
                                                        variants={itemVariants} 
                                                        style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-dim)', borderRadius: '12px', padding: '16px 20px', outline: 'none' }}
                                                    >
                                                        {/* Node Header */}
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                {isMaster ? <Cpu size={18} color="var(--accent-gold)" /> : <Server size={18} color="var(--accent-cyan)" />}
                                                                <div>
                                                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>{node.hostname}</span>
                                                                    <span style={{ fontSize: '9px', color: '#8b949e', marginLeft: '8px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                                                        {node.type}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{
                                                                    width: '8px',
                                                                    height: '8px',
                                                                    borderRadius: '50%',
                                                                    background: isOnline ? '#3fb950' : '#f85149',
                                                                    boxShadow: isOnline ? '0 0 8px #3fb950' : 'none'
                                                                }} className={isOnline ? 'pulse-dot' : ''}></span>
                                                                <span style={{ fontSize: '11px', color: isOnline ? '#3fb950' : '#f85149', fontWeight: 'bold' }}>
                                                                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Info and Platform details */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px', color: '#8b949e', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '12px', marginBottom: '12px' }}>
                                                            <div>
                                                                <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '2px' }}>PLATFORM / OS</span>
                                                                <strong style={{ color: '#c9d1d9' }}>{node.platform || 'Linux'}</strong>
                                                            </div>
                                                            <div>
                                                                <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '2px' }}>ADDRESS</span>
                                                                <strong style={{ color: '#c9d1d9', fontFamily: 'monospace' }}>
                                                                    {node.ip
                                                                        ? `${node.ip}${isMaster ? ' (Local)' : ''}`
                                                                        : isMaster
                                                                            ? 'Local'
                                                                            : (node.url || '').replace(/^https?:\/\//, '')}
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        {/* Live CPU & RAM utilization if online */}
                                                        {isOnline && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '14px' }}>
                                                                <div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: '#8b949e' }}>
                                                                        <span>CPU LOAD</span>
                                                                        <strong style={{ color: '#fff' }}>{node.cpu || 0}%</strong>
                                                                    </div>
                                                                    <div className="st-progress-rail" style={{ height: '4px' }}>
                                                                        <div className="st-progress-fill" style={{ width: `${node.cpu || 0}%`, background: (node.cpu || 0) > 80 ? '#f85149' : 'var(--accent-gold)' }}></div>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', color: '#8b949e' }}>
                                                                        <span>RAM USAGE</span>
                                                                        <strong style={{ color: '#fff' }}>{node.memory || 0}%</strong>
                                                                    </div>
                                                                    <div className="st-progress-rail" style={{ height: '4px' }}>
                                                                        <div className="st-progress-fill" style={{ width: `${node.memory || 0}%`, background: (node.memory || 0) > 80 ? '#f85149' : 'var(--accent-cyan)' }}></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Storage Disks attached to the node */}
                                                        <div>
                                                            <span style={{ display: 'block', fontSize: '9px', textTransform: 'uppercase', color: '#484f58', fontWeight: '800', marginBottom: '6px' }}>MOUNTED VOLUMES</span>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {(node.disks || []).map((d, dIdx) => (
                                                                    <div key={dIdx} style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                                                                            <span style={{ fontWeight: '600', color: '#fff' }}>{d.mount}</span>
                                                                            <span style={{ color: '#8b949e' }}>
                                                                                {(() => { const formatGB = (gb) => gb >= 999.9 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(1)} GB`; return `${formatGB(d.used / 1e9)} / ${formatGB(d.size / 1e9)}`; })()}
                                                                            </span>
                                                                        </div>
                                                                        <div className="st-progress-rail" style={{ margin: '6px 0 0', height: '4px' }}>
                                                                            <div className="st-progress-fill" style={{ width: `${d.percentage || 0}%`, background: (d.percentage || 0) > 90 ? '#f85149' : 'var(--accent-cyan)' }}></div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <motion.div className="st-card" style={{ display: 'flex', flexDirection: 'column' }} variants={itemVariants} tabIndex={0}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Activity size={18} color="var(--accent-gold)" />
                                                <h3 style={{ fontSize: '18px' }}>Active & Recent</h3>
                                            </div>
                                            <button onClick={() => setActivityHistory([])} style={{ background: 'transparent', border: 'none', color: '#484f58', cursor: 'pointer', fontSize: '11px' }}>Clear</button>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                                            {activeOps.length > 0 && (
                                                <div style={{ marginBottom: '24px' }}>
                                                    <p style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800', marginBottom: '12px', letterSpacing: '1px' }}>IN PROGRESS</p>
                                                    {activeOps.map(act => <ActivityItem key={act.id} act={act} />)}
                                                </div>
                                            )}

                                            <div>
                                                <p style={{ fontSize: '10px', color: '#8b949e', fontWeight: '800', marginBottom: '12px', letterSpacing: '1px' }}>HISTORY</p>
                                                {activityHistory.length > 0 ? activityHistory.map((act, i) => (
                                                    <div key={i} className="history-item" style={{ marginBottom: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                            <div>
                                                                <p style={{ fontSize: '13px', margin: 0, fontWeight: '700' }}>{act.name}</p>
                                                                <p style={{ fontSize: '10px', color: '#484f58', margin: '4px 0' }}>{act.type} • {new Date(act.timestamp).toLocaleTimeString()}</p>
                                                            </div>
                                                            <span style={{
                                                                fontSize: '9px',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontWeight: '800',
                                                                background: act.status === 'Completed' ? 'rgba(63, 185, 80, 0.1)' : 'rgba(248, 81, 73, 0.1)',
                                                                color: act.status === 'Completed' ? '#3fb950' : '#f85149'
                                                            }}>{act.status.toUpperCase()}</span>
                                                        </div>
                                                        {act.error && <p style={{ fontSize: '10px', color: '#f85149', margin: '8px 0 0', fontStyle: 'italic' }}>{act.error}</p>}
                                                    </div>
                                                )) : (
                                                    <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>
                                                        <Clock size={32} />
                                                        <p style={{ fontSize: '12px', marginTop: '12px' }}>No recent activity</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}

                        {view === 'machines' && (
                            <motion.div key="mc" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div style={{ marginBottom: '40px' }}>
                                    <h2 style={{ fontSize: '28px', fontWeight: '800' }}>Fleet Management</h2>
                                    <p style={{ color: '#8b949e', marginTop: '4px' }}>Manage and configure distributed agent nodes</p>
                                </div>
                                <div className="node-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }}>
                                    {filteredNodes.map((node, i) => (
                                        <NodeCard
                                            key={i}
                                            hostname={node.hostname}
                                            ip={node.ip}
                                            disks={node.disks || []}
                                            isLocal={node.type === 'Master'}
                                            status={node.status}
                                            id={node.id}
                                            onApprove={() => handleApproveAgent(node.id)}
                                            onDisconnect={() => handleDisconnectAgent(node.id)}
                                        />
                                    ))}
                                    <div
                                        className="st-card"
                                        onClick={() => setShowProvisionModal(true)}
                                        style={{
                                            border: '2px dashed rgba(242,201,76,0.2)',
                                            background: 'rgba(242,201,76,0.02)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '220px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        <Plus size={56} color="var(--accent-gold)" style={{ opacity: 0.5 }} />
                                        <p style={{ color: 'var(--accent-gold)', fontWeight: '800', marginTop: '16px', letterSpacing: '1px' }}>PROVISION NEW NODE</p>
                                        <p style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>Click to download Agent package</p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {view === 'monitor' && (
                            <motion.div key="mn" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '28px', fontWeight: '800' }}>Cluster Resource Monitor</h2>
                                        <p style={{ color: '#8b949e', marginTop: '4px' }}>Real-time telemetry and node diagnostics for your storage cluster</p>
                                    </div>
                                </div>

                                {/* Node Selection Buttons */}
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                    <button 
                                        onClick={() => setSelectedMonitorNode('local')}
                                        style={{ 
                                            height: '36px', 
                                            padding: '0 16px', 
                                            borderRadius: '8px', 
                                            background: selectedMonitorNode === 'local' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.03)',
                                            color: selectedMonitorNode === 'local' ? '#000' : '#8b949e',
                                            fontWeight: '700',
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        🖥️ Master Node (Local)
                                    </button>
                                    {metrics.agents?.filter(a => a.status === 'approved').map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => setSelectedMonitorNode(agent.id)}
                                            style={{ 
                                                height: '36px', 
                                                padding: '0 16px', 
                                                borderRadius: '8px', 
                                                background: selectedMonitorNode === agent.id ? 'var(--accent-gold)' : 'rgba(255,255,255,0.03)',
                                                color: selectedMonitorNode === agent.id ? '#000' : '#8b949e',
                                                fontWeight: '700',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: agent.online !== false ? 'var(--accent-cyan)' : '#f85149' }} />
                                            {agent.hostname}
                                        </button>
                                    ))}
                                </div>

                                {(() => {
                                    const isLocal = selectedMonitorNode === 'local';
                                    const activeNodeInfo = isLocal
                                        ? (localStorageInfo || { hostname: 'Master Server', platform: 'win32', disks: [], online: true })
                                        : (metrics.agents?.find(a => a.id === selectedMonitorNode) || { hostname: 'Unknown', platform: 'unknown', disks: [], online: false });

                                    const history = metrics.metricsHistory?.[selectedMonitorNode] || [];
                                    const currentMetrics = history[history.length - 1] || { cpu: 0, memory: 0, latency: 0 };

                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                                            {/* Left Side: Resource details & sparklines */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                                {/* Top info card */}
                                                <div className="st-card" style={{ padding: '20px' }}>
                                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>{activeNodeInfo.hostname}</h3>
                                                    <p style={{ color: '#8b949e', fontSize: '12px', margin: '4px 0 16px' }}>
                                                        OS: {activeNodeInfo.platform} | Status: <span style={{ color: activeNodeInfo.online !== false ? 'var(--accent-cyan)' : '#f85149', fontWeight: 'bold' }}>{activeNodeInfo.online !== false ? 'ONLINE' : 'OFFLINE'}</span>
                                                        {!isLocal && activeNodeInfo.online !== false && ` | Latency: ${currentMetrics.latency}ms`}
                                                    </p>
                                                    
                                                    {/* Gauges row */}
                                                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                        <RadialGauge value={currentMetrics.cpu || 0} label="CPU Load" color="var(--accent-gold)" />
                                                        <RadialGauge value={currentMetrics.memory || 0} label="RAM Usage" color="var(--accent-cyan)" />
                                                    </div>
                                                </div>

                                                {/* Sparklines row */}
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                    <SparklineChart data={history} dataKey="cpu" label="CPU" color="var(--accent-gold)" />
                                                    <SparklineChart data={history} dataKey="memory" label="RAM" color="var(--accent-cyan)" />
                                                </div>
                                            </div>

                                            {/* Right Side: Disks & Live Terminal console */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                                {/* Partition Map */}
                                                <div className="st-card" style={{ padding: '20px' }}>
                                                    <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>Disk Partitions</h4>
                                                    {activeNodeInfo.disks && activeNodeInfo.disks.length > 0 ? (
                                                        activeNodeInfo.disks.map((disk, idx) => (
                                                            <div key={idx} style={{ marginBottom: '16px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                                                    <span style={{ fontWeight: '600' }}>{disk.mount} ({formatGB(disk.used / 1e9)} / {formatGB(disk.size / 1e9)})</span>
                                                                    <span style={{ color: 'var(--accent-gold)', fontWeight: '700' }}>{disk.percentage}%</span>
                                                                </div>
                                                                <div className="st-progress-rail" style={{ height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                                                    <div 
                                                                        className="st-progress-fill" 
                                                                        style={{ 
                                                                            width: `${disk.percentage}%`,
                                                                            height: '100%',
                                                                            background: disk.percentage > 90 ? '#f85149' : 'linear-gradient(90deg, var(--accent-gold), #ffbd2e)',
                                                                            transition: 'width 0.5s ease-out'
                                                                        }} 
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div style={{ color: '#484f58', fontStyle: 'italic', fontSize: '12px' }}>No disk space information reported...</div>
                                                    )}
                                                </div>

                                                {/* Terminal Logs */}
                                                <TerminalLogs 
                                                    logs={nodeLogs} 
                                                    onRefresh={() => fetchNodeLogs(selectedMonitorNode)} 
                                                    loading={loadingLogs} 
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}
                            </motion.div>
                        )}

                        {view === 'browse' && (
                            <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {selectedPaths.size > 0 && (
                                    <div className="selection-toolbar">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '12px', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '16px', whiteSpace: 'nowrap' }}>
                                            <span className="selection-toolbar-count">{selectedPaths.size} SELECTED</span>
                                        </div>
                                        {!guestToken ? (
                                            <>
                                                <button className="selection-toolbar-action" onClick={() => handleAction('copy')}><Copy size={16} /> Copy</button>
                                                <button className="selection-toolbar-action" onClick={() => handleAction('cut')}><Scissors size={16} /> Cut</button>
                                                {selectedPaths.size === 1 && <button className="selection-toolbar-action" onClick={() => handleAction('rename')}><Edit size={16} /> Rename</button>}
                                                {selectedPaths.size === 1 && <button className="selection-toolbar-action" onClick={() => handleAction('share')}><Share2 size={16} /> Share</button>}
                                                <button className="selection-toolbar-action danger" onClick={() => handleAction('delete')}><Trash2 size={16} /> Delete</button>
                                                <button className="selection-toolbar-action" onClick={() => handleAction('compress')}><Box size={16} /> Archive</button>
                                                {(() => {
                                                    if (selectedPaths.size !== 1) return null;
                                                    const firstPath = Array.from(selectedPaths)[0];
                                                    const selectedItem = files.find(f => f.path === firstPath);
                                                    if (selectedItem && !selectedItem.isDirectory && /\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i.test(selectedItem.name)) {
                                                        return (
                                                            <button className="selection-toolbar-action" onClick={() => handleAction('extract', selectedItem)}>
                                                                <FolderOpen size={16} /> Extract
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </>
                                        ) : (
                                            <>
                                                <button className="selection-toolbar-action" onClick={() => handleAction('download')}><Download size={16} /> Download</button>
                                                {(() => {
                                                    const firstPath = Array.from(selectedPaths)[0];
                                                    const selectedItem = files.find(f => f.path === firstPath);
                                                    const isFile = selectedItem && !selectedItem.isDirectory;
                                                    return isFile ? (
                                                        <button className="selection-toolbar-action" onClick={() => handleFileClick(selectedItem)}><Eye size={16} /> View</button>
                                                    ) : null;
                                                })()}
                                            </>
                                        )}
                                        <button className="selection-toolbar-action" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', padding: '8px', width: '36px', height: '36px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedPaths(new Set())}><X size={16} /></button>
                                    </div>
                                )}
                                {!(guestToken && guestPermissions === 'Upload') && (
                                    <div className="explorer-command-bar">
                                        <div className="command-bar-nav">
                                            <div className="explorer-nav-buttons">
                                                <button
                                                    className="nav-btn"
                                                    onClick={goBack}
                                                    disabled={history.length === 0}
                                                    title="Back (Alt+Left)"
                                                >
                                                    <ChevronRight size={18} style={{ transform: 'rotate(180deg)', opacity: history.length === 0 ? 0.3 : 1 }} />
                                                </button>
                                                <button
                                                    className="nav-btn"
                                                    onClick={goForward}
                                                    disabled={future.length === 0}
                                                    title="Forward (Alt+Right)"
                                                >
                                                    <ChevronRight size={18} style={{ opacity: future.length === 0 ? 0.3 : 1 }} />
                                                </button>
                                                <button
                                                    className="nav-btn"
                                                    onClick={() => {
                                                        if (explorerMode === 'files') {
                                                            const normalized = path.replace(/\\/g, '/');
                                                            const parts = normalized.split('/').filter(Boolean);
                                                            const isUNC = path.startsWith('\\\\') || path.startsWith('//');

                                                            if ((isUNC && parts.length > 2) || (!isUNC && parts.length > 1)) {
                                                                const newParts = parts.slice(0, -1);
                                                                const sep = isUNC || serverPlatform === 'win32' ? '\\' : '/';
                                                                let prefix = serverPlatform === 'win32' ? '' : '/';
                                                                if (isUNC) {
                                                                    prefix = path.startsWith('\\\\') ? '\\\\' : '//';
                                                                } else if (newParts.length > 0 && newParts[0].indexOf(':') !== -1) {
                                                                    prefix = '';
                                                                }
                                                                const newPath = prefix + newParts.join(sep);
                                                                navigateTo(newPath, 'files');
                                                            } else if (selectedDevice?.children) {
                                                                navigateTo('/', 'partitions', selectedDevice);
                                                            } else {
                                                                navigateTo('/', 'devices', null);
                                                            }
                                                        } else if (explorerMode === 'partitions') {
                                                            navigateTo('/', 'devices', null);
                                                        }
                                                    }}
                                                    disabled={explorerMode === 'devices'}
                                                    title="Up (Alt+Up)"
                                                >
                                                    <ChevronRight size={18} style={{ transform: 'rotate(-90deg)', opacity: explorerMode === 'devices' ? 0.3 : 1 }} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="command-bar-center">
                                            <div className="premium-breadcrumbs">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                                    {!guestToken && <div className="crumb-item" onClick={() => navigateTo('/', 'devices', null)}>Hardware</div>}
                                                    {guestToken && <div className="crumb-item" onClick={() => navigateTo('', 'files')}>Shared Drive</div>}

                                                    {explorerMode !== 'devices' && !guestToken && (
                                                        <>
                                                            <ChevronRight size={14} color="var(--border-dim)" />
                                                            <div className={`crumb-item ${explorerMode === 'partitions' ? 'active' : ''}`} onClick={() => navigateTo('/', 'partitions', selectedDevice)}>
                                                                {selectedDevice?.name || 'Device'}
                                                            </div>
                                                        </>
                                                    )}

                                                    {explorerMode === 'files' && path && path.split(/[/\\]/).filter(Boolean).map((p, i, arr) => (
                                                        <React.Fragment key={i}>
                                                            <ChevronRight size={14} color="var(--border-dim)" />
                                                            <div
                                                                className={`crumb-item ${i === arr.length - 1 ? 'active' : ''}`}
                                                                onClick={() => {
                                                                    const isUNC = path.startsWith('\\\\');
                                                                    const parts = path.split(/[/\\]/).filter(Boolean);
                                                                    const targetParts = parts.slice(0, i + 1).join(path.includes('/') ? '/' : '\\');
                                                                    const newPath = isUNC ? `\\\\${targetParts}` : (targetParts.includes(':') ? targetParts : (path.startsWith('/') ? '/' + targetParts : targetParts));
                                                                    navigateTo(newPath, 'files');
                                                                }}
                                                            >
                                                                {p}
                                                            </div>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="command-bar-actions">
                                            {explorerMode === 'files' && (
                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                    <ExplorerToolbar
                                                        viewMode={viewMode}
                                                        setViewMode={setViewMode}
                                                        onSelectAll={selectAll}
                                                        selectedCount={selectedPaths.size}
                                                        totalItems={files.length}
                                                        sortBy={sortBy}
                                                        setSortBy={setSortBy}
                                                        sortOrder={sortOrder}
                                                        setSortOrder={setSortOrder}
                                                    />

                                                    {activeOps.length > 0 && (
                                                        <div className="header-progress-container" onClick={() => setShowOperations(true)} style={{ cursor: 'pointer' }}>
                                                            <div className="header-progress-bar" style={{ width: `${avgProgress}%` }}></div>
                                                            <div style={{ position: 'relative', zIndex: 1, fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <Activity size={12} color="var(--accent-gold)" style={{ animation: 'spin 2s linear infinite' }} />
                                                                <span style={{ fontWeight: '700', color: '#fff' }}>{activeOps.length}</span>
                                                                <span style={{ color: 'var(--accent-gold)' }}>{Math.round(avgProgress)}%</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!guestToken && (
                                                        <button className="btn-primary shadow-premium upload-button" style={{ borderRadius: '12px', padding: '8px 20px', fontWeight: '800' }} onClick={() => fileInputRef.current.click()}><Upload size={18} /> Upload</button>
                                                    )}
                                                    {clipboard && !guestToken && <button className="btn-primary shadow-premium" style={{ borderRadius: '12px', padding: '8px 20px', fontWeight: '800' }} onClick={handlePaste}><Copy size={18} /> Paste</button>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {explorerMode === 'files' && !(guestToken && guestPermissions === 'Upload') && (
                                    <div className="explorer-filter-bar" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 24px',
                                        background: 'rgba(13, 17, 23, 0.4)',
                                        borderBottom: '1px solid var(--border-dim)',
                                        overflowX: 'auto',
                                        scrollbarWidth: 'none'
                                    }}>
                                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '8px' }}>Filter:</span>
                                        {[
                                            { id: 'all', label: 'All Files', icon: <Filter size={14} /> },
                                            { id: 'folders', label: 'Folders', icon: <Folder size={14} /> },
                                            { id: 'documents', label: 'Documents', icon: <File size={14} /> },
                                            { id: 'images', label: 'Images', icon: <ImageIcon size={14} /> },
                                            { id: 'media', label: 'Media', icon: <Video size={14} /> }
                                        ].map(item => {
                                            const isActive = fileTypeFilter === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setFileTypeFilter(item.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '8px 16px',
                                                        borderRadius: '20px',
                                                        border: isActive ? '1px solid var(--accent-gold)' : '1px solid var(--border-dim)',
                                                        background: isActive ? 'var(--accent-gold-glow)' : 'rgba(255, 255, 255, 0.02)',
                                                        color: isActive ? 'var(--accent-gold)' : '#c9d1d9',
                                                        cursor: 'pointer',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        transition: 'all 0.2s ease',
                                                        outline: 'none',
                                                        boxShadow: isActive ? '0 0 10px var(--accent-gold-glow)' : 'none'
                                                    }}
                                                    className="filter-pill"
                                                >
                                                    {item.icon}
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="explorer-body">
                                    <div className={`file-row-grid ${
                                        explorerMode === 'devices' ? 'devices-grid' : 
                                        explorerMode === 'partitions' ? 'partitions-grid' : 
                                        (viewMode === 'list' ? 'list' : (viewMode === 'icons-sm' ? 'icons-sm' : ''))
                                    }`}
                                        style={{ 
                                            paddingRight: inspectorOpen ? '370px' : '10px',
                                            transition: 'padding-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e)}
                                        onContextMenu={(e) => {
                                            if (e.target.classList.contains('file-row-grid')) {
                                                onRightClick(e);
                                            }
                                        }}>
                                    {explorerMode === 'devices' && (
                                        <>
                                            {devices.map((dev, i) => (
                                                <div key={i} className="file-card" onClick={() => navigateTo('/', 'partitions', dev)}>
                                                    <HardDrive size={56} color="var(--accent-gold)" /><div className="label">{dev.name}</div><div style={{ fontSize: '11px', color: '#484f58' }}>{formatGB((dev.size || 0) / 1e9)} {dev.type}</div>
                                                </div>
                                            ))}
                                            {networkShares.map((ns, i) => (
                                                <div key={`net-${i}`} className="file-card" onClick={() => navigateTo(ns.path, 'files', { name: ns.label })}>
                                                    <Globe size={56} color="var(--accent-cyan)" /><div className="label">{ns.label}</div><div style={{ fontSize: '11px', color: '#484f58' }}>{ns.type} Cluster</div>
                                                </div>
                                            ))}
                                            {agentStorage.map((ag, i) => (
                                                <div key={`ag-${i}`} className="file-card" onClick={() => {
                                                    navigateTo('/', 'partitions', {
                                                        name: ag.hostname,
                                                        type: 'Agent',
                                                        id: ag.id,
                                                        children: (ag.disks || []).map(d => ({ ...d, name: d.mount, mountpoint: d.mount }))
                                                    });
                                                }}>
                                                    <Server size={56} color="var(--accent-gold)" /><div className="label">{ag.hostname}</div><div style={{ fontSize: '11px', color: '#484f58' }}>Remote Agent</div>
                                                </div>
                                            ))}
                                            <div className="file-card" style={{ border: '2px dashed rgba(242,201,76,0.2)', opacity: 0.8 }} onClick={() => setShowProvisionModal(true)}>
                                                <Plus size={56} color="var(--accent-gold)" style={{ opacity: 0.5 }} />
                                                <div className="label" style={{ color: 'var(--accent-gold)' }}>Provision New Node</div>
                                                <div style={{ fontSize: '11px', color: '#8b949e' }}>Install Agent</div>
                                            </div>
                                        </>
                                    )}
                                    {explorerMode === 'partitions' && (
                                        <>
                                            {(selectedDevice?.children || []).map((part, i) => (
                                                <div key={i} className="file-card" onClick={() => {
                                                    const root = serverPlatform === 'win32' ? 'C:\\' : '/';
                                                    let validPath = part.mountpoint || (part.name?.startsWith('/') ? '/' : root);
                                                    if (validPath.startsWith('\\\\') && validPath.split('\\').length <= 3) {
                                                        validPath = validPath.includes('/') ? '/' : root;
                                                    }
                                                    navigateTo(validPath, 'files');
                                                }}>
                                                    {part.type === 'network' ? (
                                                        <Globe size={56} color="var(--accent-cyan)" />
                                                    ) : (
                                                        <Database size={56} color="var(--accent-cyan)" />
                                                    )}
                                                    <div className="label">{part.label || part.name}</div>
                                                    <div style={{ fontSize: '11px', color: '#484f58' }}>{part.type === 'network' ? 'Network Share' : (part.fstype || 'Local Disk')} | {part.mountpoint || 'Not Mounted'}</div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {explorerMode === 'files' && (
                                        <>
                                            {guestToken && guestPermissions === 'Upload' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '80vh', padding: '40px 20px', boxSizing: 'border-box', gridColumn: '1/-1' }}>
                                                    <div 
                                                        className="glass animate-fade-in" 
                                                        style={{ 
                                                            width: '100%', 
                                                            maxWidth: '600px', 
                                                            padding: '48px 32px', 
                                                            borderRadius: '24px', 
                                                            border: '1px solid var(--border-bright)', 
                                                            textAlign: 'center', 
                                                            background: 'rgba(13, 17, 23, 0.6)', 
                                                            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)', 
                                                            transition: 'all 0.3s ease', 
                                                            position: 'relative' 
                                                        }}
                                                        onDragOver={e => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            e.currentTarget.style.borderColor = 'var(--accent-gold)';
                                                            e.currentTarget.style.boxShadow = '0 0 30px var(--accent-gold-glow)';
                                                        }}
                                                        onDragLeave={e => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                        }}
                                                        onDrop={e => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                                            e.currentTarget.style.boxShadow = 'none';
                                                            const files = Array.from(e.dataTransfer.files);
                                                            if (files.length > 0) handleUpload(files);
                                                        }}
                                                    >
                                                        <div style={{ width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-cyan))', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 24px var(--accent-gold-glow)' }}>
                                                            <Upload size={36} color="#000" />
                                                        </div>
                                                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: '#fff' }}>Secure File Drop Box</h2>
                                                        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '32px' }}>Anonymous upload portal. Drag & drop files here or click below to browse.</p>
                                                        <button 
                                                            className="btn-primary shadow-premium" 
                                                            onClick={() => fileInputRef.current.click()} 
                                                            style={{ padding: '12px 32px', borderRadius: '12px', fontWeight: '800', fontSize: '15px' }}
                                                        >
                                                            Select Files to Drop
                                                        </button>
                                                    </div>

                                                    {droppedSessionFiles.length > 0 && (
                                                        <div 
                                                            className="glass animate-fade-in" 
                                                            style={{ 
                                                                width: '100%', 
                                                                maxWidth: '600px', 
                                                                marginTop: '32px', 
                                                                borderRadius: '16px', 
                                                                border: '1px solid var(--border-dim)', 
                                                                background: 'rgba(13, 17, 23, 0.4)', 
                                                                padding: '20px 24px', 
                                                                textAlign: 'left' 
                                                            }}
                                                        >
                                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                                                Dropped in this session ({droppedSessionFiles.length})
                                                            </h4>
                                                            <div style={{ display: 'grid', gap: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                                                                {droppedSessionFiles.map((p, y) => (
                                                                    <div 
                                                                        key={y} 
                                                                        style={{ 
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'space-between', 
                                                                            padding: '10px 12px', 
                                                                            background: 'rgba(0,0,0,0.2)', 
                                                                            borderRadius: '8px', 
                                                                            border: '1px solid var(--border-dim)' 
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                                                            {p.status === 'quarantined' ? (
                                                                                <ShieldAlert size={16} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
                                                                            ) : (
                                                                                <CheckCircle2 size={16} color="#2ea44f" style={{ flexShrink: 0 }} />
                                                                            )}
                                                                            <span style={{ 
                                                                                fontSize: '13px', 
                                                                                fontWeight: '600', 
                                                                                color: p.status === 'quarantined' ? 'var(--accent-gold)' : '#e6edf3', 
                                                                                overflow: 'hidden', 
                                                                                textOverflow: 'ellipsis', 
                                                                                whiteSpace: 'nowrap',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '6px'
                                                                            }}>
                                                                                {p.name}
                                                                                {p.status === 'quarantined' && (
                                                                                    <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(242, 201, 76, 0.15)', color: 'var(--accent-gold)', border: '1px solid rgba(242, 201, 76, 0.25)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Review</span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        <span style={{ fontSize: '11px', color: '#8b949e', marginLeft: '12px', flexShrink: 0 }}>
                                                                            {(p.size / 1024).toFixed(1)} KB
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                {viewMode === 'list' && files.length > 0 && (
                                                    <div className="file-row-list-header">
                                                        <div></div>
                                                        <div>Name</div>
                                                        <div>Size</div>
                                                        <div>Type</div>
                                                        <div>Modified</div>
                                                    </div>
                                                )}

                                                {viewMode === 'list' ? (
                                                    sortedFiles.map((f, i) => {
                                                        const isSelected = selectedPaths.has(f.path);
                                                        const mtime = f.mtime || f.modified;
                                                        let formattedDate = mtime ? new Date(mtime).toLocaleDateString() : 'N/A';
                                                        if (formattedDate === 'Invalid Date' && mtime) {
                                                            const dateObj = new Date(Number(mtime));
                                                            if (!isNaN(dateObj.getTime())) {
                                                                formattedDate = dateObj.toLocaleDateString();
                                                            }
                                                        }

                                                        return (
                                                            <div key={i} className={`file-row-list-item ${isSelected ? 'selected' : ''}`}
                                                                onClick={(e) => {
                                                                    if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                                    else if (f.isDirectory) navigateTo(f.path, 'files');
                                                                    else handleFileClick(f);
                                                                }}
                                                                onContextMenu={(e) => onRightClick(e, f)}>
                                                                <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                    <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
                                                                        {isSelected && <CheckCircle2 size={12} />}
                                                                    </div>
                                                                </div>
                                                                <div className="col-name">
                                                                    {f.isDirectory ? <Folder size={18} color="var(--accent-gold)" /> : <File size={18} color="#8b949e" />}
                                                                    <span style={{ marginLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                                                                </div>
                                                                <div className="col-size" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {formatBytes(f.size)}
                                                                </div>
                                                                <div className="col-type" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {f.extension || (f.isDirectory ? 'Folder' : 'File')}
                                                                </div>
                                                                <div className="col-mtime" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {formattedDate}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <>
                                                        {files.filter(f => f.isDirectory).length > 0 && (
                                                            <div className="explorer-section">
                                                                <div className="section-label"><Folder size={14} /> FOLDERS</div>
                                                                <div className="grid-shelf">
                                                                    {sortedFiles.filter(f => f.isDirectory).map((f, i) => (
                                                                        <div key={i}
                                                                            className={`file-card ${selectedPaths.has(f.path) ? 'selected' : ''}`}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, f)}
                                                                            onClick={(e) => {
                                                                                if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                                                else navigateTo(f.path, 'files');
                                                                            }}
                                                                            onContextMenu={(e) => onRightClick(e, f)}
                                                                        >
                                                                            <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                                <div className={`selection-checkbox ${selectedPaths.has(f.path) ? 'checked' : ''}`}>
                                                                                    {selectedPaths.has(f.path) && <CheckCircle2 size={12} />}
                                                                                </div>
                                                                            </div>
                                                                            <Folder size={64} color="var(--accent-gold)" />
                                                                            <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                                                                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>FOLDER • {formatBytes(f.size)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {files.filter(f => !f.isDirectory).length > 0 && (
                                                            <div className="explorer-section">
                                                                <div className="section-label"><File size={14} /> FILES</div>
                                                                <div className="grid-shelf">
                                                                    {sortedFiles.filter(f => !f.isDirectory).map((f, i) => (
                                                                        <div key={i}
                                                                            className={`file-card ${selectedPaths.has(f.path) ? 'selected' : ''}`}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, f)}
                                                                            onClick={(e) => {
                                                                                if (e.ctrlKey || e.metaKey) toggleSelection(e, f.path);
                                                                                else handleFileClick(f);
                                                                            }}
                                                                            onContextMenu={(e) => onRightClick(e, f)}
                                                                        >
                                                                            <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                                <div className={`selection-checkbox ${selectedPaths.has(f.path) ? 'checked' : ''}`}>
                                                                                    {selectedPaths.has(f.path) && <CheckCircle2 size={12} />}
                                                                                </div>
                                                                            </div>
                                                                            <File size={64} color={selectedPaths.has(f.path) ? 'var(--accent-gold)' : '#8b949e'} />
                                                                            <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                                                                            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>{(f.extension || 'FILE').toUpperCase()} • {formatBytes(f.size)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {files.length === 0 && (
                                                    <div style={{ padding: '60px', textAlign: 'center', opacity: 0.3, gridColumn: '1/-1' }}>
                                                        <Folder size={48} />
                                                        <p>This folder is empty</p>
                                                    </div>
                                                )}

                                                </>
                                            )}
                                        </>
                                    )}
                                    {/* Legacy Back card removed in favor of header navigation */}
                                    </div>

                                    <AnimatePresence>
                                        {inspectorOpen && (
                                            <InspectorSidebar
                                                isOpen={inspectorOpen}
                                                metadata={inspectorMetadata}
                                                loading={loadingMetadata}
                                                onClose={() => {
                                                    setInspectorOpen(false);
                                                    setSelectedPaths(new Set());
                                                }}
                                                handleAction={handleAction}
                                                guestToken={guestToken}
                                                showToast={showToast}
                                                agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                                            />
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}

                        {view === 'active_shares' && (
                            <motion.div key="ash" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Secure Link Control</h2>
                                        <p style={{ color: '#8b949e', marginTop: '4px', margin: 0 }}>Monitor and revoke active external sharing links</p>
                                    </div>
                                    <button 
                                        className="btn-primary shadow-premium" 
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px', padding: '10px 20px', fontWeight: '800' }} 
                                        onClick={() => setShowFolderPicker(true)}
                                    >
                                        <Plus size={16} /> Generate Upload Link
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                    {activeShares.map(s => {
                                        const isExpired = (s.expires_at && new Date(s.expires_at) < new Date()) || (s.max_views !== -1 && s.max_views != null && s.view_count >= s.max_views);
                                        return (
                                        <div key={s.token || s.id} className="st-card-wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...(isExpired ? { border: '1px solid rgba(248, 81, 73, 0.4)', background: 'rgba(248, 81, 73, 0.04)' } : { border: '1px solid rgba(74, 222, 128, 0.3)', background: 'rgba(74, 222, 128, 0.03)' }) }}>
                                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                                <div style={{ width: '40px', height: '40px', background: isExpired ? 'rgba(248, 81, 73, 0.1)' : 'rgba(74, 222, 128, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Link2 size={20} color={isExpired ? '#f85149' : '#4ade80'} />
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: '700', margin: 0, color: isExpired ? '#f85149' : '#4ade80' }}>
                                                        {(s.path || '').split(/[/\\]/).pop() || 'Shared Resource'}
                                                        {isExpired ? (
                                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#f85149', color: '#fff', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>EXPIRED</span>
                                                        ) : (
                                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#4ade80', color: '#000', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>ACTIVE</span>
                                                        )}
                                                    </p>
                                                    <p style={{ fontSize: '11px', color: '#8b949e', margin: '2px 0 0' }}>
                                                        {s.email_verification ? 'Email Required' : 'Public'} | Views: {String(s.view_count || 0)} / {(s.max_views === -1 || s.max_views == null) ? '∞' : String(s.max_views)}
                                                        {s.type && <span style={{ marginLeft: '8px', padding: '1px 6px', background: s.type === 'upload' ? 'rgba(242,201,76,0.15)' : 'rgba(0,242,255,0.1)', border: `1px solid ${s.type === 'upload' ? 'rgba(242,201,76,0.4)' : 'rgba(0,242,255,0.3)'}`, borderRadius: '4px', color: s.type === 'upload' ? 'var(--accent-gold)' : 'var(--accent-cyan)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>{s.type}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                                                {!isExpired && (
                                                    <>
                                                        <CountdownTimer expiry={s.expires_at} />
                                                        <div style={{ textAlign: 'right', fontSize: '11px', color: '#484f58' }}>
                                                            <div>ID: {s.token || s.id}</div>
                                                            <div>Exp: {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : 'Never'}</div>
                                                        </div>
                                                    </>
                                                )}
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {!isExpired && s.has_password && (
                                                        <button onClick={() => {
                                                            if (s.password) {
                                                                navigator.clipboard.writeText(s.password);
                                                                showToast('Passkey copied!', 'success');
                                                            } else {
                                                                showToast('Legacy encrypted passkey. Please Edit to reset.', 'error');
                                                            }
                                                        }} style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', color: '#e6edf3', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} title="Copy Passkey">
                                                            <Key size={16} /> Copy Passkey
                                                        </button>
                                                    )}
                                                    {!isExpired && (
                                                        <>
                                                            <button onClick={() => {
                                                                let portalPrefix = '/g/';
                                                                if (s.type === 'upload') portalPrefix = '/u/';
                                                                else if (!s.has_password && !s.email_verification && s.type !== 'exchange') portalPrefix = '/p/';
                                                                
                                                                const shareUrl = s.url || `${window.location.protocol}//${window.location.host}${portalPrefix}${s.token || s.id}`;
                                                                navigator.clipboard.writeText(shareUrl);
                                                                showToast('Link copied to clipboard', 'success');
                                                            }} style={{ padding: '8px 16px', background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '12px' }}><Copy size={16} /> Copy Link</button>
                                                            <button onClick={() => setShareModal(s)} style={{ padding: '8px', background: 'rgba(242, 201, 76, 0.1)', border: '1px solid rgba(242, 201, 76, 0.3)', borderRadius: '8px', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Edit size={16} /> Edit</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => revokeShare(s.token || s.id)} style={{ padding: '8px', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={16} /> Revoke</button>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {activeShares.length === 0 && <div style={{ textAlign: 'center', padding: '60px', opacity: 0.3 }}><Link2 size={48} /><p>No active shares found</p></div>}
                                </div>
                            </motion.div>
                        )}

                        {view === 'network' && (
                            <motion.div key="net" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '28px', fontWeight: '800' }}>Network Shares</h2>
                                        <p style={{ color: '#8b949e', marginTop: '4px' }}>Connect SMB, NFS, and Cloud storage endpoints</p>
                                    </div>
                                    <button className="btn-sm" onClick={() => setShowMountModal(true)}><Plus size={16} /> Add Share</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                                    {networkShares.map(ns => (
                                        <div key={ns.id} className="st-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                                <Globe size={24} color="var(--accent-cyan)" />
                                                <span style={{ fontSize: '10px', background: 'var(--accent-gold-glow)', color: 'var(--accent-gold)', padding: '4px 8px', borderRadius: '4px', fontWeight: '800' }}>{ns.type}</span>
                                            </div>
                                            <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>{ns.label}</h3>
                                            <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '20px', wordBreak: 'break-all' }}>{ns.path}</p>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', color: '#484f58' }}>User: {ns.username}</span>
                                                <button onClick={() => unmountDrive(ns.id)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #30363d', borderRadius: '6px', color: '#f85149', fontSize: '11px', cursor: 'pointer' }}>Disconnect</button>
                                            </div>
                                        </div>
                                    ))}
                                    {networkShares.length === 0 && (
                                        <div className="st-card" style={{ borderStyle: 'dashed', borderColor: '#30363d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gridColumn: '1/-1', padding: '60px' }}>
                                            <Globe size={48} color="#30363d" />
                                            <p style={{ color: '#484f58', marginTop: '20px' }}>No network endpoints connected</p>
                                            <button className="auth-submit-btn" style={{ width: 'auto', padding: '12px 24px', marginTop: '20px' }} onClick={() => setShowMountModal(true)}>Mount First Drive</button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {view === 'sync' && (
                            <motion.div key="syn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <SyncCenter agents={agentStorage} showToast={showToast} />
                            </motion.div>
                        )}

                        {view === 'ai_automate' && (
                            <motion.div key="aia" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <AIAutomator agents={agentStorage} showToast={showToast} />
                            </motion.div>
                        )}

                        {view === 'alerts' && (
                            <motion.div key="alt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <AlertManagement 
                                    settings={settings} 
                                    updateSetting={updateSetting} 
                                    activities={activities} 
                                    showToast={showToast} 
                                    refreshData={fetchAllData}
                                />
                            </motion.div>
                        )}

                        {view === 'security' && (
                            <motion.div key="sec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <SecurityCenter />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main >

            <ContextMenu
                data={contextMenu}
                onAction={handleAction}
                onPaste={handlePaste}
                hasClipboard={!!clipboard}
                onCreateFolder={() => { setShowFolderModal(true); setContextMenu(null); }}
                onRefresh={() => { fetchFiles(path); setContextMenu(null); }}
                selectedCount={selectedPaths.size}
                isGuest={!!guestToken}
                guestPermissions={guestPermissions}
            />
            {contextMenu && <div className="cm-overlay" onClick={() => setContextMenu(null)} />}


            {
                shareModal && (
                    <ShareModal
                        path={shareModal}
                        agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                        onClose={() => setShareModal(null)}
                        onCreated={fetchAllData}
                        showToast={showToast}
                    />
                )
            }
            {
                showFolderPicker && (
                    <FolderPickerModal
                        agents={agentStorage}
                        onClose={() => setShowFolderPicker(false)}
                        onSelect={(folderPath, node) => {
                            setShowFolderPicker(false);
                            setPickerShareModal({
                                path: folderPath,
                                agentId: node === 'local' ? undefined : node
                            });
                        }}
                        showToast={showToast}
                    />
                )
            }
            {
                pickerShareModal && (
                    <ShareModal
                        path={pickerShareModal.path}
                        agentId={pickerShareModal.agentId}
                        forceUploadOnly={true}
                        onClose={() => setPickerShareModal(null)}
                        onCreated={fetchAllData}
                        showToast={showToast}
                    />
                )
            }
            {
                renameFile && (
                    <RenameModal
                        data={renameFile}
                        onClose={() => setRenameFile(null)}
                        onRename={async (newName) => {
                            const url = guestToken
                                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/rename`
                                : `${API_BASE}/files/rename`;
                            await axios.post(url, {
                                oldPath: renameFile.path,
                                newName,
                                agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined
                            }, {
                                headers: { Authorization: guestToken ? `Bearer ${guestToken}` : `Bearer ${token}` }
                            });
                            showToast('Renamed successfully', 'success');
                            fetchFiles(path);
                        }}
                    />
                )
            }
            {
                propertiesFile && (
                    <PropertiesModal
                        data={propertiesFile}
                        onClose={() => setPropertiesFile(null)}
                        agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                    />
                )
            }
            {
                downloadFile && (
                    <DownloadConfirmModal
                        file={downloadFile}
                        onClose={() => setDownloadFile(null)}
                        onConfirm={(file) => {
                            handleDownload(file);
                            setDownloadFile(null);
                        }}
                    />
                )
            }
            {
                showUserModal && (
                    <UserModal
                        config={showUserModal}
                        onClose={() => setShowUserModal(null)}
                        onCreate={handleCreateUser}
                        onUpdate={handleUpdateUser}
                        onReset={handleResetPassword}
                    />
                )
            }
            <MountModal show={showMountModal} onClose={() => setShowMountModal(false)} onMounted={fetchAllData} showToast={showToast} />

            {showUpdateModal && (
                <div className="modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="modal-content glass" style={{ width: '420px', padding: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <Loader size={36} color="var(--accent-cyan)" style={{ animation: 'spin 1.5s linear infinite' }} />
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>System Update In Progress</h3>
                            <p style={{ fontSize: '13px', color: '#8b949e', textAlign: 'center', lineHeight: '1.6' }}>
                                {updateMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}


            {
                showOperations && (
                    <OperationStatus operations={operations} onClose={() => setShowOperations(false)} onCancel={cancelOperation} />
                )
            }
            <OverlapConfirmModal
                context={overwriteContext}
                onClose={() => setOverwriteContext(null)}
                onConfirm={(ctx) => {
                    setOverwriteContext(null);
                    executeOperation(ctx.type, ctx.source, ctx.target, ctx.agentId, true);
                }}
            />
            <ProvisionModal show={showProvisionModal} onClose={() => setShowProvisionModal(false)} />
            <CreateFolderModal show={showFolderModal} onClose={() => setShowFolderModal(false)} onSubmit={handleCreateFolder} />
            <CompressModal 
                show={showCompressModal} 
                onClose={() => { setShowCompressModal(false); setCompressTargets([]); }} 
                onSubmit={handleCompress} 
                defaultName={compressTargets.length > 0 ? (compressTargets[0].name.split('.')[0] || compressTargets[0].name) : 'archive'}
            />
            <MediaPreviewModal
                media={previewMedia}
                onClose={() => setPreviewMedia(null)}
                onNext={handleNextPreview}
                onPrev={handlePrevPreview}
                onDownload={(file) => {
                    handleAction('download', file);
                    setPreviewMedia(null);
                }}
                showToast={showToast}
            />
            <ConfirmationModal
                show={!!confirmModal}
                message={confirmModal?.message}
                onClose={() => setConfirmModal(null)}
                onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
            />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={(e) => {
                handleUpload(Array.from(e.target.files));
                e.target.value = null;
            }} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div >
    );
}



const OperationStatus = ({ operations, onClose, onCancel }) => {
    return (
        <div className="operation-panel glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '850', color: '#fff', letterSpacing: '-0.5px' }}>Command Center</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: '800', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Fleet Operations Control</p>
                </div>
                <button onClick={onClose} className="op-close-btn">
                    <X size={24} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                {operations.map(op => {
                    const isFailed = op.status === 'Failed';
                    const isDone = op.status === 'Completed';
                    const statusColor = isFailed ? '#f85149' : (isDone ? 'var(--accent-cyan)' : 'var(--accent-gold)');
                    const progress = op.progress || 0;
                    const speed = op.speed || 0;
                    const eta = op.eta || 0;
                    const transferred = op.bytesTransferred || 0;
                    const total = op.totalBytes || 0;

                    const formatBytes = (bytes) => {
                        if (bytes === 0) return '0 B';
                        const k = 1024;
                        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    };

                    return (
                        <div key={op.id} className="op-card-premium">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {op.name}
                                    </div>
                                    <div className="op-metric-label" style={{ opacity: 0.6 }}>
                                        {op.type?.toUpperCase()} • {op.status?.toUpperCase()}
                                    </div>
                                </div>
                                <div style={{ fontSize: '20px', fontWeight: '900', color: statusColor, fontFamily: 'monospace' }}>
                                    {Math.round(progress)}%
                                </div>
                            </div>

                            <div className="op-progress-thick">
                                <div className="op-progress-thick-fill" style={{ width: `${progress}%`, background: statusColor }}></div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <div className="op-metric-label">Transfer Rate</div>
                                    <div className="op-metric-value">
                                        {speed > 1024 * 1024 ? `${(speed / (1024 * 1024)).toFixed(1)} MB/s` : `${(speed / 1024).toFixed(1)} KB/s`}
                                    </div>
                                </div>
                                <div>
                                    <div className="op-metric-label">Remaining</div>
                                    <div className="op-metric-value">
                                        {isDone ? 'Finished' : (eta > 0 ? `${Math.ceil(eta)}s` : 'Calculating...')}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                                <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: '700' }}>
                                    PROGRESS <span style={{ color: '#fff', marginLeft: '8px' }}>{formatBytes(transferred)} / {formatBytes(total)}</span>
                                </div>
                                {!isDone && !isFailed && (
                                    <button
                                        className="btn-sm"
                                        style={{ background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', color: '#f85149', padding: '6px 12px', fontSize: '10px', fontWeight: '800' }}
                                        onClick={() => {
                                            if (onCancel) onCancel(op.id);
                                        }}
                                    >
                                        CANCEL
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};



const ExplorerToolbar = ({ viewMode, setViewMode, onSelectAll, selectedCount, totalItems, sortBy, setSortBy, sortOrder, setSortOrder }) => {
    return (
        <div className="explorer-toolbar" style={{ padding: '0 16px', height: '48px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                    className="selection-checkbox-wrapper"
                    onClick={onSelectAll}
                    style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '6px', cursor: 'pointer' }}
                >
                    <div className={`selection-checkbox ${(selectedCount === totalItems && totalItems > 0) ? 'checked' : (selectedCount > 0 ? 'partial' : '')}`}>
                        {(selectedCount === totalItems && totalItems > 0) ? <CheckCircle2 size={12} /> : (selectedCount > 0 && <Square size={10} fill="currentColor" />)}
                    </div>
                </div>
                {selectedCount > 0 && (
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                        {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginLeft: 'auto' }}>
                <div className="view-controls" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8b949e', fontSize: '11px', fontWeight: '800' }}>
                        <Filter size={14} /> SORT BY
                        <select
                            value={sortBy}
                            onChange={(e) => { setSortBy(e.target.value); localStorage.setItem('sortBy', e.target.value); }}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            <option value="name">Name</option>
                            <option value="size">Size</option>
                            <option value="modified">Modified</option>
                        </select>
                        <button
                            onClick={() => { const next = sortOrder === 'asc' ? 'desc' : 'asc'; setSortOrder(next); localStorage.setItem('sortOrder', next); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                        >
                            {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                <div className="view-controls">
                    <button
                        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => { setViewMode('list'); localStorage.setItem('viewMode', 'list'); }}
                        title="List View"
                    >
                        <ListIcon size={18} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'icons-sm' ? 'active' : ''}`}
                        onClick={() => { setViewMode('icons-sm'); localStorage.setItem('viewMode', 'icons-sm'); }}
                        title="Small Icons"
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'icons-lg' ? 'active' : ''}`}
                        onClick={() => { setViewMode('icons-lg'); localStorage.setItem('viewMode', 'icons-lg'); }}
                        title="Large Icons"
                    >
                        <LayoutList size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};



const NavItem = ({ icon, label, active, onClick }) => (
    <div className={`nav-link ${active ? 'active' : ''}`} onClick={onClick}>{icon} <span>{label}</span></div>
);

const StorageCard = ({ title, disk, isAgent }) => (
    <div className="st-card-wide" style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>{isAgent ? <Server size={16} color="var(--text-secondary)" /> : <HardDrive size={16} color="var(--accent-gold)" />}<span style={{ fontSize: '14px', fontWeight: '600' }}>{title} ({disk.mount})</span></div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatGB(disk.used / 1e9)} / {formatGB(disk.size / 1e9)}</div>
        </div>
        <div className="st-progress-rail" style={{ margin: '10px 0 0' }}><div className="st-progress-fill" style={{ width: `${disk.percentage}%`, background: disk.percentage > 90 ? '#f85149' : 'var(--accent-gold)' }}></div></div>
    </div>
);

// --- Cluster Monitor Subcomponents ---
const RadialGauge = ({ value, label, color }) => {
    const radius = 60;
    const strokeWidth = 10;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, minWidth: '150px' }}>
            <div style={{ position: 'relative', width: radius * 2, height: radius * 2 }}>
                <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        stroke="rgba(255, 255, 255, 0.03)"
                        fill="transparent"
                        strokeWidth={strokeWidth}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                    />
                    <circle
                        stroke={color}
                        fill="transparent"
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                        strokeLinecap="round"
                    />
                </svg>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{value}%</span>
                </div>
            </div>
            <span style={{ marginTop: '12px', fontSize: '12px', fontWeight: '600', color: '#8b949e', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
        </div>
    );
};

const SparklineChart = ({ data, dataKey, label, color }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', color: '#484f58', flex: 1 }}>
                Waiting for telemetry samples...
            </div>
        );
    }

    const width = 500;
    const height = 120;
    const padding = 10;
    const maxVal = 100;
    const pointsCount = Math.max(30, data.length);

    const points = data.map((d, index) => {
        const x = padding + (index / (pointsCount - 1)) * (width - padding * 2);
        const val = d[dataKey] || 0;
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    let fillPoints = '';
    if (data.length > 0) {
        const firstX = padding;
        const lastX = padding + ((data.length - 1) / (pointsCount - 1)) * (width - padding * 2);
        fillPoints = `${points} ${lastX},${height - padding} ${firstX},${height - padding}`;
    }

    return (
        <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#8b949e', textTransform: 'uppercase' }}>{label} Trend</span>
                <span style={{ fontSize: '11px', color: '#484f58' }}>Past 5m</span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '120px' }}>
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                
                {fillPoints && (
                    <polygon
                        points={fillPoints}
                        fill={`url(#areaGradient-${dataKey})`}
                    />
                )}

                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    points={points}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {data.length > 0 && (() => {
                    const lastIndex = data.length - 1;
                    const x = padding + (lastIndex / (pointsCount - 1)) * (width - padding * 2);
                    const val = data[lastIndex][dataKey] || 0;
                    const y = height - padding - (val / maxVal) * (height - padding * 2);
                    return <circle cx={x} cy={y} r="4" fill={color} stroke="#0d1117" strokeWidth="1.5" />;
                })()}

                <defs>
                    <linearGradient id={`areaGradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};

const TerminalLogs = ({ logs, onRefresh, loading }) => {
    const terminalRef = useRef(null);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const formatLogLine = (line) => {
        if (!line) return null;
        let color = '#c9d1d9';
        let level = 'INFO';

        if (line.includes('[INFO]')) {
            color = '#8b949e';
            level = 'INFO';
        } else if (line.includes('[WARN]')) {
            color = '#f2c94c';
            level = 'WARN';
        } else if (line.includes('[ERROR]')) {
            color = '#f85149';
            level = 'ERROR';
        }

        const matches = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)$/);
        if (matches) {
            const [, timestamp, , message] = matches;
            let time = '';
            try {
                time = new Date(timestamp).toLocaleTimeString();
            } catch (err) {
                time = timestamp;
            }
            return (
                <div style={{ marginBottom: '4px', fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.4' }}>
                    <span style={{ color: '#58a6ff', marginRight: '8px' }}>[{time}]</span>
                    <span style={{ color, fontWeight: '800', marginRight: '8px' }}>[{level}]</span>
                    <span style={{ color: '#e6edf3' }}>{message}</span>
                </div>
            );
        }

        return <div style={{ color, fontFamily: 'monospace', fontSize: '11px', marginBottom: '4px', lineHeight: '1.4' }}>{line}</div>;
    };

    return (
        <div style={{ background: '#090d13', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, height: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
                    <span style={{ marginLeft: '12px', fontSize: '12px', fontWeight: '700', color: '#8b949e', fontFamily: 'monospace' }}>CONSOLE_OUTPUT</span>
                </div>
                <button 
                    onClick={onRefresh} 
                    disabled={loading}
                    className="btn-sm"
                    style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        height: '28px', 
                        padding: '0 12px', 
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        color: '#c9d1d9'
                    }}
                >
                    <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
                    Refresh Logs
                </button>
            </div>
            <div 
                ref={terminalRef}
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    background: '#04070a', 
                    borderRadius: '8px', 
                    padding: '12px',
                    border: '1px solid rgba(255,255,255,0.03)'
                }}
            >
                {logs.length === 0 ? (
                    <div style={{ color: '#484f58', fontStyle: 'italic', fontFamily: 'monospace', fontSize: '11px' }}>No logs recorded yet...</div>
                ) : (
                    logs.map((line, i) => <div key={i}>{formatLogLine(line)}</div>)
                )}
            </div>
        </div>
    );
};

const NodeCard = ({ id, hostname, ip, disks, isLocal, status, onApprove, onDisconnect }) => (
    <div className="st-card">
        <div className="st-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Cpu size={20} color={status === 'pending' ? '#8b949e' : "var(--accent-gold)"} />
                <div>
                    <p className="st-card-name" style={{ margin: 0 }}>{hostname}</p>
                    <p style={{ fontSize: '10px', color: '#484f58', margin: '2px 0 0', fontFamily: 'monospace' }}>
                        {isLocal ? 'Master Node' : 'Agent Node'}
                        {ip && <span style={{ color: 'var(--accent-cyan)', marginLeft: '6px' }}>· {ip}</span>}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {status === 'pending' && <span className="badge-pending" style={{ fontSize: '9px', background: '#f85149', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PENDING</span>}
                <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.03)', color: '#8b949e', padding: '4px 8px', borderRadius: '4px', fontWeight: '800' }}>
                    {isLocal ? 'MASTER' : 'SLAVE'}
                </span>
            </div>
        </div>
        <div style={{ marginTop: '16px' }}>
            {status === 'pending' ? (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#8b949e', marginBottom: '16px' }}>Agent is awaiting approval.</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-primary btn-sm" style={{ flex: 1, height: '32px' }} onClick={onApprove}>Approve</button>
                        <button className="btn-sm" style={{ flex: 1, height: '32px', background: 'transparent', border: '1px solid #f85149', color: '#f85149' }} onClick={onDisconnect}>Reject</button>
                    </div>
                </div>
            ) : (
                <>
                    {disks?.map((d, i) => (
                        <div key={i} style={{ marginBottom: '10px' }}>
                            <div className="st-meta" style={{ fontSize: '11px' }}><span>{d.mount}</span><span>{d.percentage}%</span></div>
                            <div className="st-progress-rail" style={{ height: '4px' }}><div className="st-progress-fill" style={{ width: `${d.percentage}%` }}></div></div>
                        </div>
                    ))}
                    {!isLocal && (
                        <button
                            className="btn-sm"
                            style={{ width: '100%', marginTop: '10px', background: 'rgba(248, 81, 73, 0.1)', color: '#f85149', border: '1px solid rgba(248, 81, 73, 0.2)' }}
                            onClick={onDisconnect}
                        >
                            Disconnect Node
                        </button>
                    )}
                </>
            )}
        </div>
    </div>
);

const ActivityItem = ({ act }) => {
    const isFailed = act.status === 'Failed';
    const isDone = act.status === 'Completed';
    const statusColor = isFailed ? '#f85149' : (isDone ? 'var(--accent-cyan)' : 'var(--accent-gold)');

    return (
        <div className="activity-item-compact" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ fontWeight: '600', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{act.name}</span>
                <span style={{ color: statusColor, fontSize: '10px', fontWeight: '800' }}>{act.progress}%</span>
            </div>
            <div className="st-progress-rail" style={{ height: '4px' }}>
                <div className="st-progress-fill" style={{
                    width: `${act.progress}%`,
                    background: statusColor,
                    transition: 'width 0.4s ease'
                }}></div>
            </div>
        </div>
    );
};

const AuthScreen = ({ handleLogin, appName }) => {
    const [mode, setMode] = useState('login'); // 'login', 'forgot_username', 'forgot_verify'
    const [forgotUsername, setForgotUsername] = useState('');
    const [securityQuestion, setSecurityQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Animation states
    const [loginSuccess, setLoginSuccess] = useState(null); // { username, userId, avatar }
    const [loginError, setLoginError] = useState(false);
    const [shake, setShake] = useState(false);

    const handleLocalSubmitLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const username = e.target.username.value;
        const password = e.target.password.value;
        try {
            const res = await axios.post(`${API_BASE}/login`, { username, password });
            
            // Set login success state to trigger animated transition screen
            setLoginSuccess({
                username: res.data.username,
                userId: res.data.id,
                avatar: res.data.avatar_path
            });
            
            // Save credentials
            const token = res.data.token;
            const role = res.data.role;
            localStorage.setItem('token', token);
            localStorage.setItem('username', res.data.username);
            localStorage.setItem('userRole', role);
            
            // Keep splash page visible for 2.5 seconds to showcase the animation
            setTimeout(() => {
                handleLogin(token, res.data.username, role);
            }, 2500);
            
        } catch (err) {
            setShake(true);
            setLoginError(true);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Username or password is wrong';
            setError(msg);
            
            // Clear error animation after 3.5 seconds
            setTimeout(() => {
                setShake(false);
                setLoginError(false);
                setError('');
            }, 3500);
        } finally {
            setLoading(false);
        }
    };

    const handleFetchQuestion = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!forgotUsername) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/auth/forgot-password/question?username=${encodeURIComponent(forgotUsername)}`);
            setSecurityQuestion(res.data.question);
            setMode('forgot_verify');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to fetch security question.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/api/auth/forgot-password/reset', {
                username: forgotUsername,
                answer,
                newPassword
            });
            setMessage(res.data.message || 'Password reset successfully.');
            setTimeout(() => {
                setMode('login');
                // clear forgot pass states
                setForgotUsername('');
                setSecurityQuestion('');
                setAnswer('');
                setNewPassword('');
                setConfirmPassword('');
                setError('');
                setMessage('');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-screen">
            <div className={`login-auth-card ${shake ? 'card-shake' : ''}`}>
                {loginSuccess ? (
                    <div className="success-animation-container">
                        <div className="success-avatar-wrapper">
                            <div className="success-avatar-glow"></div>
                            {loginSuccess.avatar ? (
                                <img 
                                    src={`/api/v1/profile/avatar/${loginSuccess.userId}?t=${Date.now()}`} 
                                    alt="Profile" 
                                    className="success-avatar-img"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        const fallback = document.getElementById('avatar-fallback-initials');
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            ) : null}
                            <div 
                                id="avatar-fallback-initials"
                                className="success-avatar-fallback"
                                style={{ display: loginSuccess.avatar ? 'none' : 'flex' }}
                            >
                                {loginSuccess.username.charAt(0)}
                            </div>
                        </div>
                        <h2 className="success-welcome-text">Hi, {loginSuccess.username} 👋</h2>
                        <p className="success-subtitle">Authentication successful. Opening vault...</p>
                        <div className="success-loader-bar">
                            <div className="success-loader-fill"></div>
                        </div>
                    </div>
                ) : loginError ? (
                    <div className="error-animation-container">
                        <div className="angry-emoji">😠</div>
                        <h3 className="error-text-title">ACCESS DENIED</h3>
                        <p style={{ color: '#8b949e', fontSize: '13px', textAlign: 'center', lineHeight: '1.4', margin: '8px 0 0' }}>
                            {error || 'Username or password is wrong'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="login-header">
                            <div className="logo-icon">
                                <Database size={32} color="#000" />
                            </div>
                            <h1>{appName.toUpperCase()}</h1>
                        </div>

                        {mode === 'login' && (
                            <form onSubmit={handleLocalSubmitLogin}>
                                <div className="form-field">
                                    <label>Master ID</label>
                                    <div className="form-input-wrapper">
                                        <User size={18} className="form-input-icon" />
                                        <input name="username" placeholder="Enter username" required style={{ paddingLeft: '44px' }} />
                                    </div>
                                </div>
                                <div className="form-field">
                                    <label>Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            name="password" 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="Enter passkey" 
                                            required 
                                            style={{ paddingLeft: '44px', paddingRight: '44px' }} 
                                        />
                                        <button 
                                            type="button" 
                                            className="password-toggle-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            tabIndex="-1"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="auth-submit-btn">Authorize</button>

                                <div style={{ marginTop: '18px', textAlign: 'right' }}>
                                    <span 
                                        onClick={() => { setMode('forgot_username'); setError(''); setMessage(''); }}
                                        className="forgot-link-btn"
                                    >
                                        Forgot Passkey?
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_username' && (
                            <form onSubmit={handleFetchQuestion}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: '#fff' }}>Reset Passkey</h3>
                                <p style={{ color: '#8b949e', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
                                    Enter your Username to retrieve your registered security question.
                                </p>
                                
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}

                                <div className="form-field">
                                    <label>Username</label>
                                    <div className="form-input-wrapper">
                                        <User size={18} className="form-input-icon" />
                                        <input 
                                            value={forgotUsername} 
                                            onChange={e => setForgotUsername(e.target.value)} 
                                            placeholder="Enter username" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Retrieve Security Question'}
                                </button>

                                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                    <span 
                                        onClick={() => setMode('login')}
                                        className="forgot-link-btn"
                                        style={{ color: '#8b949e' }}
                                    >
                                        Back to Login
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_verify' && (
                            <form onSubmit={handleResetPasswordSubmit}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: '#fff' }}>Identity Verification</h3>
                                
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}
                                {message && <div style={{ color: '#3fb950', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(63,185,80,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(63,185,80,0.2)' }}>{message}</div>}

                                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-dim)', marginBottom: '20px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '11px', color: '#8b949e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Security Question</div>
                                    <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600', lineHeight: '1.4' }}>{securityQuestion}</div>
                                </div>

                                <div className="form-field">
                                    <label>Your Answer</label>
                                    <div className="form-input-wrapper">
                                        <Key size={18} className="form-input-icon" />
                                        <input 
                                            value={answer} 
                                            onChange={e => setAnswer(e.target.value)} 
                                            placeholder="Answer is case-insensitive" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label>New Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            type="password"
                                            value={newPassword} 
                                            onChange={e => setNewPassword(e.target.value)} 
                                            placeholder="Enter new passkey" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <div className="form-field">
                                    <label>Confirm New Passkey</label>
                                    <div className="form-input-wrapper">
                                        <Lock size={18} className="form-input-icon" />
                                        <input 
                                            type="password"
                                            value={confirmPassword} 
                                            onChange={e => setConfirmPassword(e.target.value)} 
                                            placeholder="Confirm new passkey" 
                                            required 
                                            style={{ paddingLeft: '44px' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Updating...' : 'Reset Passkey'}
                                </button>

                                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                    <span 
                                        onClick={() => setMode('forgot_username')}
                                        className="forgot-link-btn"
                                        style={{ color: '#8b949e' }}
                                    >
                                        Back
                                    </span>
                                </div>
                            </form>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};



export default App;
