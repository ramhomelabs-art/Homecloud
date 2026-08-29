import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    LayoutDashboard, FolderTree, File, Folder, Server, Activity, Cpu, Database, Globe, Plus, Sparkles,
    User, ShieldCheck, ShieldAlert, Shield, Share2, Download, Upload, Trash2, Copy, Scissors,
    Filter, CheckCircle2, Clock, Info, Edit, MousePointer2, Link2, Lock, Unlock,
    RefreshCw, Image as ImageIcon, Video, X, Timer, ZoomIn, ZoomOut, Maximize,
    ArrowLeft, ArrowRight, ChevronUp, ChevronDown, ListIcon, LayoutGrid, LayoutList,
    Square, CheckSquare, MoreVertical, Database as DriveIcon, Key, Monitor, Smartphone,
    ChevronRight, ChevronLeft, CreditCard, Box, Grid, List, Search, Bell, HelpCircle, Settings as SettingsIcon, LogOut,
    HardDrive, FolderOpen, Eye, EyeOff, Save, Send, Star, Tag, PieChart, KeyRound
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
import AudioPlayer from './components/AudioPlayer';
import StarredView from './components/views/StarredView';
import TrashView from './components/views/TrashView';
import MachinesView from './components/views/MachinesView';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import ContextMenu from './components/ContextMenu';
import InspectorSidebar from './components/InspectorSidebar';
import SyncCenter from './components/SyncCenter';
import AlertManagement from './components/AlertManagement';
import SecurityCenter from './components/security/SecurityCenter';
import ProfileSettings from './components/profile/ProfileSettings';
import Avatar from './components/profile/Avatar';
import GuestPortal from './components/portals/GuestPortal';
import PublicPortal from './components/portals/PublicPortal';
import UploadPortal from './components/portals/UploadPortal';
import VaultsView from './components/views/VaultsView';
import ClusterMonitorView from './components/views/ClusterMonitorView';
import TransferQueueDrawer from './components/transfers/TransferQueueDrawer';
import NetworkTrafficView from './components/network/NetworkTrafficView';


import CloudMountHubView from './components/network/CloudMountHubView';
import SystemSettingsView from './components/settings/SystemSettingsView';
import StorageTieringView from './components/tiering/StorageTieringView';
import FileEditorModal from './components/studio/FileEditorModal';
import StorageHeatmapModal from './components/modals/StorageHeatmapModal';
import DeduplicationModal from './components/modals/DeduplicationModal';
import FileVersionHistoryModal from './components/modals/FileVersionHistoryModal';
import SmartSearchModal from './components/modals/SmartSearchModal';
import EncryptedSecretsModal from './components/modals/EncryptedSecretsModal';
import FileCommentsModal from './components/modals/FileCommentsModal';
import DeploymentConfigModal from './components/modals/DeploymentConfigModal';
import SiteMeshModal from './components/modals/SiteMeshModal';
import ClusterUpdateModal from './components/modals/ClusterUpdateModal';
import ConfirmModal from './components/modals/ConfirmModal';
import InitialSetupWizard from './components/setup/InitialSetupWizard';
import ClusterCockpitView from './components/views/ClusterCockpitView';

// Polyfill localStorage to automatically fall back to sessionStorage for auth properties.
// This is critical for session-only configurations and subcomponents that query localStorage.getItem directly.
if (typeof window !== 'undefined') {
    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function (key) {
        if (['token', 'username', 'userRole', 'guestToken', 'shareId'].includes(key)) {
            return originalGetItem.call(localStorage, key) || sessionStorage.getItem(key);
        }
        return originalGetItem.call(localStorage, key);
    };
}

const API_BASE = '/api';

const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    if (i <= 0) return `${bytes} B`;
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
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>Auto-Destruct</span>
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
            color: 'var(--text-primary)',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-subtle)',
            animation: 'fadeIn 0.3s ease',
            pointerEvents: 'auto'
        }}>
            <span>{typeof message === 'object' ? (message.message || message.error || JSON.stringify(message)) : message}</span>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex' }}>
                <X size={16} />
            </button>
        </div>
    );
};

function App() {
    const [token, setToken] = useState(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
    const [guestToken, setGuestToken] = useState(() => localStorage.getItem('guestToken') || sessionStorage.getItem('guestToken'));
    // Tracks whether the initial token verification is in progress.
    // While verifying, 401 responses must NOT trigger logout (they may be transient).
    const [verifyingToken, setVerifyingToken] = useState(() => !!(localStorage.getItem('token') || sessionStorage.getItem('token')));
    const [guestPermissions, setGuestPermissions] = useState(() => {
        const token = localStorage.getItem('guestToken') || sessionStorage.getItem('guestToken');
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
    const [shareId, setShareId] = useState(() => localStorage.getItem('shareId') || sessionStorage.getItem('shareId'));
    const [droppedSessionFiles, setDroppedSessionFiles] = useState([]);
    const [username, setUserName] = useState(() => localStorage.getItem('username') || sessionStorage.getItem('username'));
    const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || sessionStorage.getItem('userRole') || 'User');
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(null); // { mode: 'create' } or { mode: 'edit', user } or { mode: 'reset', user }
    const [systemVersion, setSystemVersion] = useState({ isGit: false, localHash: 'v1.0.0', remoteHash: 'v1.0.0', updateAvailable: false });
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [updatingSystem, setUpdatingSystem] = useState(false);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [updateMessage, setUpdateMessage] = useState('');
    const [showDeployConfigModal, setShowDeployConfigModal] = useState(false);
    const [showSiteMeshModal, setShowSiteMeshModal] = useState(false);
    const [showClusterUpdateModal, setShowClusterUpdateModal] = useState(false);
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
    const [path, setPath] = useState(() => {
        const savedPath = localStorage.getItem('expPath') || '/';
        // Sanitize: reject Windows-style paths (e.g. C:\, C:/) on a Linux server
        const isWindowsPath = /^[a-zA-Z]:[/\\]/.test(savedPath) || savedPath.includes('\\');
        return isWindowsPath ? '/' : savedPath;
    });
    const [files, setFiles] = useState([]);
    const [fileTypeFilter, setFileTypeFilter] = useState('all');
    const [tagFilter, setTagFilter] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [trashItems, setTrashItems] = useState([]);
    const [starredItems, setStarredItems] = useState([]);
    const [filterText, setFilterText] = useState('');
    const [selectedDevice, setSelectedDevice] = useState(() => {
        const saved = localStorage.getItem('selDev');
        if (saved === 'undefined') return null;
        try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
    });
    const [sortBy, setSortBy] = useState(localStorage.getItem('sortBy') || 'name');
    const [sortOrder, setSortOrder] = useState(localStorage.getItem('sortOrder') || 'asc');
    const [showClock, setShowClock] = useState(localStorage.getItem('showClock') !== 'false');
    const [format24h, setFormat24h] = useState(localStorage.getItem('format24h') !== 'false');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [globalConfirmAction, setGlobalConfirmAction] = useState(null);
    const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [isSetupRequired, setIsSetupRequired] = useState(false);

    useEffect(() => {
        const checkSetupStatus = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('setup') === 'true') {
                setIsSetupRequired(true);
                setShowSetupWizard(true);
                return;
            }
            try {
                const res = await axios.get(`${API_BASE}/auth/setup/status`);
                if (res.data?.setupRequired) {
                    setIsSetupRequired(true);
                    setShowSetupWizard(true);
                } else {
                    setIsSetupRequired(false);
                }
            } catch (e) {
                setIsSetupRequired(false);
            }
        };
        checkSetupStatus();
    }, []);


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
                if (error.response?.status === 401) {
                    const gToken = localStorage.getItem('guestToken') || sessionStorage.getItem('guestToken');
                    const sId = localStorage.getItem('shareId') || sessionStorage.getItem('shareId');
                    if (gToken) {
                        // Guest token expired — redirect back to share login
                        localStorage.removeItem('guestToken');
                        localStorage.removeItem('shareId');
                        sessionStorage.removeItem('guestToken');
                        sessionStorage.removeItem('shareId');
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
                            sessionStorage.removeItem('token');
                            sessionStorage.removeItem('username');
                            sessionStorage.removeItem('userRole');
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
            const guest = params.get('token') || localStorage.getItem('guestToken') || sessionStorage.getItem('guestToken');

            if (id && guest) {
                setShareId(id);
                setGuestToken(guest);
                try {
                    const payload = JSON.parse(atob(guest.split('.')[1]));
                    setGuestPermissions(payload.permissions || 'View');
                } catch (e) { console.error('Failed to decode guest token', e); }
                localStorage.setItem('shareId', id);
                localStorage.setItem('guestToken', guest);
                sessionStorage.setItem('shareId', id);
                sessionStorage.setItem('guestToken', guest);
                setToken(null); // Clear regular token if guest
                localStorage.removeItem('token');
                sessionStorage.removeItem('token');
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
                sessionStorage.removeItem('guestToken');
                sessionStorage.removeItem('shareId');
            }
        }
    }, []);

    useEffect(() => {
        setFileTypeFilter('all');
        setTagFilter(null);
        setFilterText('');
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

        if (tagFilter) {
            list = list.filter(file => file.tags && file.tags.some(t => t.name === tagFilter));
        }

        if (filterText && view === 'browse') {
            list = list.filter(file => file.name.toLowerCase().includes(filterText.toLowerCase()));
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
    }, [files, sortBy, sortOrder, fileTypeFilter, tagFilter, filterText, view]);
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
    const [cloudMounts, setCloudMounts] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
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
            showToast(`Uploading ${name}...`, 'info');

            const formData = new FormData();
            filesList.forEach(f => formData.append('files', f));

            let uploadUrl = guestToken
                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/upload?path=${encodeURIComponent(path)}`
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
    const [editingFile, setEditingFile] = useState(null);
    const [showHeatmapModal, setShowHeatmapModal] = useState(false);
    const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
    const [historyFile, setHistoryFile] = useState(null);
    const [showSmartSearch, setShowSmartSearch] = useState(false);
    const [showSecretsVault, setShowSecretsVault] = useState(false);
    const [commentFile, setCommentFile] = useState(null);
    const [showProvisionModal, setShowProvisionModal] = useState(false);
    const [showOperations, setShowOperations] = useState(false);
    const [showTerminalModal, setShowTerminalModal] = useState(false);
    const [activeTrack, setActiveTrack] = useState(null);
    const [playQueue, setPlayQueue] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [appName, setAppName] = useState('NexaDisk');
    const [settings, setSettings] = useState({});
    const [activityHistory, setActivityHistory] = useState(() => {
        const saved = localStorage.getItem('actHist');
        return saved ? JSON.parse(saved) : [];
    });
    const [dashboardActivityFilter, setDashboardActivityFilter] = useState('all');
    const [nodeFilter, setNodeFilter] = useState('all'); // 'all', 'master', 'agent'
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const [viewMode, setViewMode] = useState(localStorage.getItem('viewMode') || 'icons-lg');
    const [selectedPaths, setSelectedPaths] = useState(new Set());
    const [inspectorOpen, setInspectorOpen] = useState(false);
    const [inspectorMetadata, setInspectorMetadata] = useState(null);
    const [loadingMetadata, setLoadingMetadata] = useState(false);
    const [serverPlatform, setServerPlatform] = useState('linux'); // Default to linux, will be synced from server

    const navigateTo = (newPath, newMode, newDevice = undefined, skipHistory = false) => {
        if (!skipHistory) {
            setHistory(prev => [{ path, mode: explorerMode, device: selectedDevice }, ...prev].slice(0, 50));
            setFuture([]);
        }

        setSelectedPaths(new Set());
        const effectiveDevice = newDevice !== undefined ? newDevice : selectedDevice;
        if (newDevice !== undefined) setSelectedDevice(newDevice);
        const targetMode = newMode || explorerMode;
        if (newMode) setExplorerMode(newMode);
        
        setFiles([]);
        setLoading(true);
        setPath(newPath);

        if (targetMode === 'files') {
            fetchFiles(newPath, effectiveDevice);
        } else if (targetMode === 'devices') {
            fetchDevices();
        } else {
            setLoading(false);
        }
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

        navigateTo(prev.path, prev.mode, prev.device, true);
    };

    const goForward = () => {
        if (future.length === 0) return;
        const [next, ...rest] = future;
        setHistory(h => [{ path, mode: explorerMode, device: selectedDevice }, ...h]);
        setFuture(rest);

        navigateTo(next.path, next.mode, next.device, true);
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
        const currentToken = localStorage.getItem('token') || token;
        if (!currentToken) return;
        try {
            const res = await axios.get('/api/v1/auth/settings', {
                headers: { Authorization: `Bearer ${currentToken}` }
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
        const currentToken = localStorage.getItem('token') || token;
        if (!currentToken) return;
        try {
            await axios.post('/api/v1/auth/settings/update', { key, value }, {
                headers: { Authorization: `Bearer ${currentToken}` }
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
                    await axios.get(`${API_BASE}/v1/auth/verify`);
                    // Token is valid — load all data
                    fetchAllData();
                    fetchSettings();
                    fetchCurrentUser();
                } catch (err) {
                    // Token is genuinely invalid/expired — log out
                    if (err.response?.status === 401) {
                        setToken(null);
                        localStorage.removeItem('token');
                        localStorage.removeItem('username');
                        localStorage.removeItem('userRole');
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('username');
                        sessionStorage.removeItem('userRole');
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
            const dashboardInterval = setInterval(fetchAllData, 5000);
            return () => clearInterval(dashboardInterval);
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

    const copyToClipboard = (text, successMsg = 'Link copied to clipboard') => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(successMsg, 'success');
            }).catch(() => {
                fallbackCopy(text, successMsg);
            });
        } else {
            fallbackCopy(text, successMsg);
        }
    };

    const fallbackCopy = (text, successMsg = 'Link copied to clipboard') => {
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
            showToast(successMsg, 'success');
        } catch (err) {
            showToast('Failed to copy', 'error');
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
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            const res = await axios.get(`${API_BASE}/v1/auth/users`, { headers });
            setUsers(res.data);
        } catch (e) {
            console.error('Failed to fetch users', e);
        }
    };

    const handleCreateUser = async (userData) => {
        try {
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            await axios.post(`${API_BASE}/v1/auth/users/create`, userData, { headers });
            showToast('User created successfully', 'success');
            fetchUsers();
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to create user', 'error');
        }
    };

    const handleUpdateUser = async (userData) => {
        try {
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            await axios.post(`${API_BASE}/v1/auth/users/update`, userData, { headers });
            showToast('User updated successfully', 'success');
            fetchUsers();
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to update user', 'error');
        }
    };

    const handleResetPassword = async (userData) => {
        try {
            const tokenVal = localStorage.getItem('token');
            const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
            await axios.post(`${API_BASE}/v1/auth/users/reset-password`, userData, { headers });
            showToast('Password reset successfully', 'success');
            setShowUserModal(null);
        } catch (e) {
            showToast(e.response?.data?.error || 'Failed to reset password', 'error');
        }
    };

    const handleDeleteUser = (id) => {
        setGlobalConfirmAction({
            title: 'Delete User Account',
            message: 'Are you sure you want to permanently delete this user account?',
            confirmText: 'Delete User',
            type: 'danger',
            onConfirm: async () => {
                try {
                    const tokenVal = localStorage.getItem('token');
                    const headers = tokenVal ? { Authorization: `Bearer ${tokenVal}` } : {};
                    await axios.post(`${API_BASE}/v1/auth/users/delete`, { id }, { headers });
                    showToast('User deleted successfully', 'success');
                    fetchUsers();
                } catch (e) {
                    showToast(e.response?.data?.error || 'Failed to delete user', 'error');
                }
            }
        });
    };

    const fetchAllData = async () => {
        const fetchSafely = async (endpoint, fallback) => {
            try {
                const res = await axios.get(`${API_BASE}${endpoint}`, { timeout: 10000 });
                return res.data;
            } catch (err) {
                console.warn(`[fetchAllData] Failed to fetch ${endpoint}:`, err.message);
                return fallback;
            }
        };

        try {
            const [localData, metricsData, activitiesData, shareData, netData, trashData, starredData, cloudData] = await Promise.all([
                fetchSafely('/v1/storage/local', {
                    hostname: 'Local Master',
                    platform: 'win32',
                    ip: '127.0.0.1',
                    cpu: 0,
                    memory: 0,
                    disks: [{
                        mount: 'C:\\',
                        size: 0,
                        free: 0,
                        used: 0,
                        percentage: 0
                    }]
                }),
                fetchSafely('/v1/agents/metrics', { metricsHistory: {}, agents: [] }),
                fetchSafely('/v1/files/activities', []),
                fetchSafely('/v1/shares/list', []),
                fetchSafely('/v1/network/list', []),
                fetchSafely('/v1/trash', []),
                fetchSafely('/v1/social/starred', []),
                fetchSafely('/v1/cloud/mounts', { mounts: [] })
            ]);

            setLocalStorageInfo(localData);
            setMetrics(metricsData);
            setAgentStorage(metricsData.agents || []);
            setActivities(Array.isArray(activitiesData) ? activitiesData : []);
            setActiveShares(Array.isArray(shareData) ? shareData : []);
            setNetworkShares(Array.isArray(netData) ? netData : []);
            setTrashItems(Array.isArray(trashData) ? trashData : []);
            setStarredItems(Array.isArray(starredData) ? starredData : []);
            setCloudMounts(Array.isArray(cloudData?.mounts) ? cloudData.mounts : []);
            if (localStorage.getItem('userRole') === 'Admin') fetchUsers();
        } catch (e) {
            // Do not logout here — let the global interceptor handle 401s safely.
            // A single failed poll should never log the user out.
            console.error('[fetchAllData] Error:', e.message);
        }
    };

    const fetchTags = async () => {
        if (!token || guestToken) {
            setAllTags([]);
            return;
        }
        try {
            const res = await axios.get(`${API_BASE}/v1/social/tags`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllTags(res.data);
        } catch (e) {
            console.error('Failed to fetch tags', e);
        }
    };

    const fetchTrashItems = async () => {
        if (!token || guestToken) return;
        try {
            const res = await axios.get(`${API_BASE}/v1/trash`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTrashItems(res.data);
        } catch (e) {
            console.error('Failed to fetch trash items', e);
        }
    };

    const fetchStarredItems = async () => {
        if (!token || guestToken) return;
        try {
            const res = await axios.get(`${API_BASE}/v1/social/starred`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarredItems(res.data);
        } catch (e) {
            console.error('Failed to fetch starred items', e);
        }
    };

    useEffect(() => {
        fetchTags();
        fetchStarredItems();
    }, [token, guestToken]);

    useEffect(() => {
        if (view === 'browse') {
            if (guestToken) {
                if (guestPermissions !== 'Upload' && explorerMode === 'files') {
                    fetchFiles(path, selectedDevice);
                }
            } else {
                if (explorerMode === 'devices') fetchDevices();
                else if (explorerMode === 'files') fetchFiles(path, selectedDevice);
            }
        }
    }, [view, explorerMode, path, selectedDevice, guestToken, guestPermissions]);

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
                                if (prevOp.status === 'In Progress' && (sop.status === 'Completed' || sop.status === 'Failed')) {
                                    if (sop.status === 'Completed') {
                                        showToast(`Successfully finished: ${sop.name}`, 'success');
                                        fetchFiles(path);
                                        const completedId = sop.id;
                                        setTimeout(() => {
                                            setOperations(current => current.filter(o => o.id !== completedId));
                                        }, 10000);
                                    } else {
                                        showToast(`Failed operation ${sop.name}: ${sop.error || 'Unknown error'}`, 'error');
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
    }, [operations, path]);

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

    // Inline locker unlocking states
    const [unlockLockerData, setUnlockLockerData] = useState(null);
    const [unlockLockerPassword, setUnlockLockerPassword] = useState('');

    const handleInlineUnlockLocker = async (e) => {
        e.preventDefault();
        if (!unlockLockerPassword || !unlockLockerData) return;
        try {
            await axios.post(`${API_BASE}/v1/lockers/${unlockLockerData.id}/unlock`, {
                password: unlockLockerPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            showToast('Vault decrypted and unlocked.', 'success');
            const targetPath = unlockLockerData.path;
            setUnlockLockerData(null);
            setUnlockLockerPassword('');
            // Reload files
            fetchFiles(targetPath);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to decrypt vault. Incorrect passphrase.', 'error');
        }
    };

    const handleCancelInlineUnlock = () => {
        setUnlockLockerData(null);
        setUnlockLockerPassword('');
        
        // Go back to parent directory
        const normalized = path.replace(/\\/g, '/');
        const parts = normalized.split('/').filter(Boolean);
        parts.pop();
        let parentPath = parts.join('/');
        if (parentPath.endsWith(':')) parentPath += '/';
        
        if (parentPath) {
            navigateTo(parentPath, 'files');
        } else if (selectedDevice?.children) {
            navigateTo('/', 'partitions', selectedDevice);
        } else {
            navigateTo('/', 'devices', null);
        }
    };

    const navigateParent = () => {
        if (path === '/' || path === '' || !path) {
            navigateTo('/', 'devices', null);
            return;
        }

        const isUNC = path.startsWith('\\\\');
        const parts = path.split(/[/\\]/).filter(Boolean);

        if (parts.length <= 1) {
            if (selectedDevice?.children) {
                navigateTo('/', 'partitions', selectedDevice);
            } else {
                navigateTo('/', 'devices', null);
            }
            return;
        }

        parts.pop();
        if (isUNC) {
            if (parts.length === 1) {
                if (selectedDevice?.children) {
                    navigateTo('/', 'partitions', selectedDevice);
                } else {
                    navigateTo('/', 'devices', null);
                }
                return;
            }
            navigateTo('\\\\' + parts.join('\\'), 'files');
            return;
        }

        let parentPath = parts.join('/');
        if (parentPath.endsWith(':')) parentPath += '/';
        
        if (parentPath) {
            navigateTo(parentPath, 'files');
        } else if (selectedDevice?.children) {
            navigateTo('/', 'partitions', selectedDevice);
        } else {
            navigateTo('/', 'devices', null);
        }
    };

    const fetchFiles = async (p, deviceParam = undefined) => {
        let normalizedPath = p || '/';
        if (/^[a-zA-Z]:$/i.test(normalizedPath)) normalizedPath += '\\';
        setFiles([]);
        setLoading(true);
        try {
            const currentDev = deviceParam !== undefined ? deviceParam : selectedDevice;
            let url = guestToken
                ? `${API_BASE.replace('/api', '')}/public/share/${shareId}/list?path=${encodeURIComponent(normalizedPath)}`
                : `${API_BASE}/files/list?path=${encodeURIComponent(normalizedPath)}`;

            if (!guestToken && currentDev?.type === 'Agent') url += `&agentId=${currentDev.id}`;
            const res = await axios.get(url, { headers: { Authorization: guestToken ? `Bearer ${guestToken}` : `Bearer ${token}` } });
            setFiles(res.data || []);
            setPath(normalizedPath);
        } catch (err) {
            const status = err.response?.status;
            const lockerId = err.response?.data?.lockerId;
            if (status === 403 && lockerId) {
                setUnlockLockerData({ id: lockerId, path: p });
            } else {
                showToast(err.response?.data?.error || 'Failed to fetch files', 'error');
            }
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

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleNextTrack = () => {
        if (playQueue.length === 0) return;
        const currentIndex = playQueue.findIndex(t => t.path === activeTrack?.path);
        if (currentIndex !== -1 && currentIndex < playQueue.length - 1) {
            setActiveTrack(playQueue[currentIndex + 1]);
        } else {
            setActiveTrack(playQueue[0]);
        }
        setIsPlaying(true);
    };

    const handlePrevTrack = () => {
        if (playQueue.length === 0) return;
        const currentIndex = playQueue.findIndex(t => t.path === activeTrack?.path);
        if (currentIndex > 0) {
            setActiveTrack(playQueue[currentIndex - 1]);
        } else {
            setActiveTrack(playQueue[playQueue.length - 1]);
        }
        setIsPlaying(true);
    };

    const handleSelectTrack = (track) => {
        setActiveTrack(track);
        setIsPlaying(true);
    };

    const handleRemoveTrack = (track, index) => {
        const newQueue = playQueue.filter((_, i) => i !== index);
        setPlayQueue(newQueue);
        if (activeTrack?.path === track.path) {
            if (newQueue.length > 0) {
                const nextIndex = index < newQueue.length ? index : 0;
                setActiveTrack(newQueue[nextIndex]);
            } else {
                setActiveTrack(null);
                setIsPlaying(false);
            }
        }
    };

    const handleClosePlayer = () => {
        setActiveTrack(null);
        setIsPlaying(false);
        setPlayQueue([]);
    };

    const handleAction = async (action, file) => {
        setContextMenu(null);

        if (action === 'playMedia' && file) {
            setActiveTrack(file);
            setIsPlaying(true);
            if (!playQueue.some(t => t.path === file.path)) {
                setPlayQueue(prev => [...prev, file]);
            }
            return;
        }

        if (action === 'queueMedia' && file) {
            if (!playQueue.some(t => t.path === file.path)) {
                setPlayQueue(prev => [...prev, file]);
                showToast(`Added to queue: ${file.name}`, 'success');
            } else {
                showToast('Already in queue', 'info');
            }
            if (!activeTrack) {
                setActiveTrack(file);
                setIsPlaying(true);
            }
            return;
        }

        if (action === 'open' && file) {
            navigateTo(file.path, 'files');
            return;
        }
        if (action === 'view' && file) {
            handleFileClick(file);
            return;
        }
        if (action === 'editStudio' && file) {
            setEditingFile(file);
            return;
        }
        if (action === 'versionHistory' && file) {
            setHistoryFile(file);
            return;
        }
        if (action === 'comments' && file) {
            setCommentFile(file);
            return;
        }
        if (action === 'smartSearch') {
            setShowSmartSearch(true);
            return;
        }
        if (action === 'secretsVault') {
            setShowSecretsVault(true);
            return;
        }
        if (action === 'diskHeatmap') {
            setShowHeatmapModal(file ? file.path : path);
            return;
        }
        if (action === 'deduplicate') {
            setShowDeduplicateModal(file ? file.path : path);
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
        if (action === 'fileDrop' && targets.length === 1) {
            const targetPath = targets[0].path;
            setShareModal({ path: targetPath, forceUploadOnly: true });
            return;
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

        if (action === 'toggleStar' && targets.length === 1) {
            const target = targets[0];
            const isStarred = target.starred;
            const headers = { Authorization: `Bearer ${token}` };
            try {
                if (isStarred) {
                    await axios.delete(`${API_BASE}/v1/social/star?path=${encodeURIComponent(target.path)}`, { headers });
                    showToast('Removed from Starred', 'success');
                } else {
                    await axios.post(`${API_BASE}/v1/social/star`, {
                        path: target.path,
                        name: target.name,
                        isDirectory: !!target.isDirectory
                    }, { headers });
                    showToast('Added to Starred', 'success');
                }
                fetchFiles(path);
            } catch (err) {
                showToast(err.response?.data?.error || 'Failed to update star status', 'error');
            }
            return;
        }

        if (action === 'download' && targets.length > 0) {
            const isMultiSelect = targets.length > 1;
            const isFolder = targets.length === 1 && targets[0].isDirectory;

            if (isMultiSelect || isFolder) {
                const targetPaths = targets.map(t => t.path);
                showToast('Preparing ZIP download...', 'info');

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

        try {
            const res = await axios.post(`${API_BASE}${endpoint}`, {
                source,
                destination: target,
                agentId,
                overwrite
            });
            const actualOpId = res.data.opId || opId;
            if (res.data.status === 'In Progress') {
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, id: actualOpId, status: 'In Progress', progress: 0, bytesTransferred: 0, totalBytes: res.data.totalBytes || 0 } : o));
            } else {
                setOperations(prev => prev.map(o => o.id === opId ? { ...o, id: actualOpId, status: 'Completed', progress: 100 } : o));
                showToast(`Successfully ${type === 'copy' ? 'copied' : 'moved'}`, 'success');
                fetchFiles(path);
                const completedOp = { ...newOp, id: actualOpId, status: 'Completed', progress: 100, timestamp: new Date().toISOString() };
                setActivityHistory(prev => [completedOp, ...prev.slice(0, 49)]);
                setTimeout(() => setOperations(prev => prev.filter(o => o.id !== actualOpId)), 10000);
            }
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

        const filesToPaste = clipboard.files || (clipboard.path ? [{ path: clipboard.path, name: clipboard.name, agentId: clipboard.agentId }] : []);
        if (filesToPaste.length === 0) return;

        for (const file of filesToPaste) {
            const effectiveAgentId = destAgentId !== undefined ? destAgentId : file.agentId;
            if (file.agentId && destAgentId && file.agentId !== destAgentId) {
                showToast(`Cross-node ${clipboard.type} between different machines is not supported yet for ${file.name}. Use Download/Upload instead.`, 'error');
                continue;
            }
            await executeOperation(clipboard.type, file.path, path, effectiveAgentId);
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

    const BINARY_EXTENSIONS = new Set([
        'exe', 'dll', 'so', 'dylib', 'bin', 'iso', 'img', 'dmg', 'apk', 'jar', 'war',
        'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar', 'zst', 'tgz',
        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tif', 'heic', 'avif',
        'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp',
        'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma', 'opus',
        'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'
    ]);

    const KNOWN_TEXT_EXTENSIONS = new Set([
        // Config & Serialization
        'yml', 'yaml', 'json', 'json5', 'jsonc', 'toml', 'xml', 'csv', 'tsv', 'ini', 'conf', 'config', 'cfg', 'cnf',
        'env', 'properties', 'desktop', 'repo', 'list', 'rules', 'service', 'timer', 'mount', 'socket', 'target',
        'slice', 'automount', 'swap', 'path', 'scope', 'network', 'netdev', 'link', 'theme', 'conkyrc',
        // Shell & Linux Scripting
        'sh', 'bash', 'zsh', 'ksh', 'csh', 'fish', 'zprofile', 'zshrc', 'bashrc', 'profile', 'alias',
        'ps1', 'psm1', 'psd1', 'bat', 'cmd', 'vbs', 'awk', 'sed',
        // Programming Languages
        'py', 'pyw', 'pyi', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx',
        'c', 'h', 'cpp', 'hpp', 'cc', 'cxx', 'c++', 'h++', 'cs', 'java', 'go', 'rs', 'rust',
        'kt', 'kts', 'swift', 'dart', 'scala', 'sc', 'groovy', 'gvy', 'gradle', 'rb', 'rbw', 'rake',
        'pl', 'pm', 't', 'pod', 'php', 'phtml', 'php5', 'php7', 'php8', 'lua', 'r', 'rdata', 'rds',
        'jl', 'elm', 'erl', 'hrl', 'ex', 'exs', 'clj', 'cljs', 'cljc', 'edn', 'lisp', 'lsp', 'cl',
        'scheme', 'scm', 'ss', 'rkt', 'f', 'for', 'f90', 'f95', 'f03', 'f08', 'pas', 'pp', 'inc',
        'asm', 's', 'v', 'vhdl', 'vhd', 'sv', 'svh',
        // Web, Styles & Templates
        'html', 'htm', 'xhtml', 'shtml', 'vue', 'svelte', 'astro',
        'css', 'scss', 'sass', 'less', 'styl',
        'svg', 'pug', 'jade', 'haml', 'erb', 'twig', 'liquid', 'njk', 'mustache', 'hbs', 'handlebars',
        // Infrastructure, DevOps, Cloud & Database
        'sql', 'pgsql', 'mysql', 'sqlite', 'prisma', 'tf', 'tfvars', 'hcl', 'nomad',
        'dockerfile', 'containerfile', 'vagrantfile', 'procfile', 'rakefile', 'gemfile', 'brewfile',
        'proto', 'graphql', 'gql', 'thrift', 'nix',
        // Documentation & Notes
        'txt', 'text', 'md', 'markdown', 'mdown', 'mkd', 'rst', 'adoc', 'asciidoc', 'tex', 'latex',
        'org', 'log', 'out', 'err', 'diff', 'patch', 'nfo', 'diz', 'man',
        'lock', 'mod', 'sum', 'ignore', 'example', 'sample', 'template', 'dist', 'default'
    ]);

    const KNOWN_TEXT_FILENAMES = new Set([
        'dockerfile', 'containerfile', 'makefile', 'gnumakefile', 'cmakelists.txt',
        'vagrantfile', 'procfile', 'rakefile', 'gemfile', 'gemfile.lock', 'brewfile',
        'pipfile', 'pipfile.lock', 'requirements.txt', 'cargo.toml', 'cargo.lock',
        'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.json', 'composer.lock',
        'license', 'licence', 'copying', 'readme', 'readme.txt', 'changelog', 'authors', 'contributing', 'todo',
        'hosts', 'hostname', 'fstab', 'mtab', 'resolv.conf', 'sudoers', 'crontab', 'exports',
        'environment', 'passwd', 'group', 'shadow', 'shells', 'issue', 'motd',
        'nginx.conf', 'httpd.conf', 'apache2.conf', 'caddyfile', 'caddyfile.json', 'haproxy.cfg', 'squid.conf',
        'smb.conf', 'dhcpd.conf', 'named.conf', 'sshd_config', 'ssh_config',
        '.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test',
        '.bashrc', '.bash_profile', '.bash_aliases', '.bash_logout', '.zshrc', '.zprofile', '.zshenv',
        '.profile', '.inputrc', '.vimrc', '.nanorc', '.tmux.conf', '.screenrc',
        '.gitconfig', '.gitignore', '.gitattributes', '.gitmodules', '.dockerignore', '.editorconfig',
        '.npmrc', '.yarnrc', '.prettierrc', '.eslintrc', '.stylelintrc', '.babelrc', '.browserslistrc'
    ]);

    const isPreviewable = (file) => {
        if (!file?.name) return false;
        const fileNameLower = file.name.toLowerCase();
        const ext = fileNameLower.includes('.') ? fileNameLower.split('.').pop() : '';

        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
        const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
        const pdfExts = ['pdf'];

        if (imageExts.includes(ext) || videoExts.includes(ext) || audioExts.includes(ext) || pdfExts.includes(ext)) {
            return true;
        }

        // Check if known text extension or specific Linux config filename
        if (KNOWN_TEXT_EXTENSIONS.has(ext) || KNOWN_TEXT_FILENAMES.has(fileNameLower) || fileNameLower.startsWith('.')) {
            return true;
        }

        // If file has no extension or unknown extension, allow viewing/editing in text editor if not binary
        if (!BINARY_EXTENSIONS.has(ext)) {
            return true;
        }

        return false;
    };

    const normalizePath = (p) => {
        if (!p) return '';
        let normalized = p.replace(/[\\/]+/g, '/');
        if (p.startsWith('\\\\')) normalized = '//' + normalized;
        return normalized.toLowerCase();
    };

    const handleFileClick = (file) => {
        if (!file?.name) return;
        if (isPreviewable(file)) {
            const fileNameLower = file.name.toLowerCase();
            const ext = fileNameLower.includes('.') ? fileNameLower.split('.').pop() : '';
            const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
            const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
            const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];
            const pdfExts = ['pdf'];

            let mediaType = 'text';
            if (pdfExts.includes(ext)) mediaType = 'pdf';
            else if (imageExts.includes(ext)) mediaType = 'image';
            else if (videoExts.includes(ext)) mediaType = 'video';
            else if (audioExts.includes(ext)) mediaType = 'audio';

            setPreviewMedia({
                ...file,
                agentId: selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined,
                type: mediaType
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
                height: '100vh', background: 'var(--bg-surface-0)', flexDirection: 'column', gap: '16px'
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTop: '3px solid #6e8efb',
                    animation: 'spin 0.8s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Verifying session...</span>
            </div>
        );
    }

    if (showSetupWizard) {
        return (
            <InitialSetupWizard
                onSetupComplete={(token, username, role) => {
                    setIsSetupRequired(false);
                    setShowSetupWizard(false);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    handleLogin(token, username, role);
                }}
                onRedirectToLogin={(username) => {
                    setIsSetupRequired(false);
                    setShowSetupWizard(false);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    showToast?.(`Setup completed! You can now log in as ${username}.`, 'success');
                }}
                showToast={showToast}
                onCancel={() => setShowSetupWizard(false)}
            />
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
                <AuthScreen 
                    handleLogin={handleLogin} 
                    appName={appName} 
                    onOpenSetupWizard={isSetupRequired ? () => setShowSetupWizard(true) : null}
                />
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
            <Sidebar
                guestToken={guestToken}
                guestPermissions={guestPermissions}
                appName={appName}
                view={view}
                setView={setView}
                setExplorerMode={setExplorerMode}
                userRole={userRole}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />

            <main className="main-view">
                <Header
                    guestToken={guestToken}
                    guestPermissions={guestPermissions}
                    filterText={filterText}
                    setFilterText={setFilterText}
                    showClock={showClock}
                    setShowClock={setShowClock}
                    format24h={format24h}
                    setFormat24h={setFormat24h}
                    showNotifications={showNotifications}
                    setShowNotifications={setShowNotifications}
                    mobileOpen={mobileOpen}
                    setMobileOpen={setMobileOpen}
                    activities={activities}
                    lastSeenAlertTime={lastSeenAlertTime}
                    setLastSeenAlertTime={setLastSeenAlertTime}
                    view={view}
                    setView={setView}
                    operations={operations}
                    setShowOperations={setShowOperations}
                    currentUser={currentUser}
                    username={username}
                    token={token}
                    showToast={showToast}
                    trashItems={trashItems}
                    setTrashItems={setTrashItems}
                    fetchTrashItems={fetchTrashItems}
                    starredItems={starredItems}
                    setStarredItems={setStarredItems}
                    fetchStarredItems={fetchStarredItems}
                    setPath={setPath}
                    selectedDevice={selectedDevice}
                    path={path}
                />

                <section className="content-pane fade-in">
                    <AnimatePresence mode="wait">
                        {view === 'profile' && (
                            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <ProfileSettings onProfileUpdate={(updatedUser) => setCurrentUser(updatedUser)} />
                            </motion.div>
                        )}

                        {view === 'settings' && (
                            <motion.div key="set" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <SystemSettingsView 
                                    username={username}
                                    userRole={userRole}
                                    appName={appName}
                                    settings={settings}
                                    setSettings={setSettings}
                                    updateSetting={updateSetting}
                                    showClock={showClock}
                                    setShowClock={setShowClock}
                                    format24h={format24h}
                                    setFormat24h={setFormat24h}
                                    showToast={showToast}
                                    setView={setView}
                                    onOpenSetupWizard={() => setShowSetupWizard(true)}
                                />
                            </motion.div>
                        )}
                        {view === 'dashboard' && (
                            <ClusterCockpitView
                                filteredNodes={filteredNodes}
                                stats={stats}
                                nodeFilter={nodeFilter}
                                setNodeFilter={setNodeFilter}
                                filterText={filterText}
                                setFilterText={setFilterText}
                                activeOps={activeOps}
                                activityHistory={activityHistory}
                                activities={activities}
                                setActivityHistory={setActivityHistory}
                                localStorageInfo={localStorageInfo}
                                agentStorage={agentStorage}
                                networkShares={networkShares}
                                metrics={metrics}
                                fetchAllData={fetchAllData}
                                showToast={showToast}
                                navigateTo={navigateTo}
                            />
                        )}

                        {view === 'machines' && (
                            <MachinesView
                                filteredNodes={filteredNodes}
                                handleApproveAgent={handleApproveAgent}
                                handleDisconnectAgent={handleDisconnectAgent}
                                setShowProvisionModal={setShowProvisionModal}
                                setShowSiteMeshModal={setShowSiteMeshModal}
                                setShowDeployModal={setShowDeployConfigModal}
                                setShowUpdateModal={setShowClusterUpdateModal}
                                showToast={showToast}
                                onRefreshFleet={fetchAllData}
                            />
                        )}

                        {view === 'monitor' && (
                            <>
                                <ClusterMonitorView
                                    selectedMonitorNode={selectedMonitorNode}
                                    setSelectedMonitorNode={setSelectedMonitorNode}
                                    localStorageInfo={localStorageInfo}
                                    metrics={metrics}
                                    nodeLogs={nodeLogs}
                                    setShowTerminalModal={setShowTerminalModal}
                                    onOpenComplianceAudit={() => setView('security')}
                                />

                                {/* Slide-Out Cyber Console Terminal Drawer Modal */}
                                <AnimatePresence>
                                    {showTerminalModal && (
                                        <div className="command-center-overlay">
                                            <motion.div 
                                                className="command-center-backdrop"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                onClick={() => setShowTerminalModal(false)}
                                            />
                                            <motion.div 
                                                className="command-center-drawer"
                                                initial={{ x: '100%' }}
                                                animate={{ x: 0 }}
                                                exit={{ x: '100%' }}
                                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                                style={{ width: 'min(680px, 100vw)' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'var(--bg-surface-0)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{ fontSize: '18px' }}>📟</span>
                                                        <div>
                                                            <h3 style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>Cluster Live Console</h3>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Real-time streaming log output for {selectedMonitorNode}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowTerminalModal(false)}
                                                        className="cc-close-btn"
                                                        title="Close Console"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </div>
                                                <div style={{ flex: 1, padding: '16px', background: '#060911', overflow: 'hidden' }}>
                                                    <TerminalLogs 
                                                        logs={nodeLogs} 
                                                        onRefresh={() => fetchNodeLogs(selectedMonitorNode)} 
                                                        loading={loadingLogs} 
                                                    />
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}

                        {view === 'browse' && (
                            <motion.div key="exp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                {selectedPaths.size > 0 && (() => {
                                    const canEdit = !guestToken || guestPermissions === 'Edit' || guestPermissions === 'Full Access';
                                    const firstPath = Array.from(selectedPaths)[0];
                                    const selectedItem = files.find(f => f.path === firstPath);
                                    const isFile = selectedItem && !selectedItem.isDirectory;

                                    return (
                                        <div className="selection-toolbar">
                                            <div className="selection-toolbar-left">
                                                <span className="selection-toolbar-count">
                                                    <CheckCircle2 size={13} /> {selectedPaths.size} Selected
                                                </span>
                                            </div>
                                            
                                            <div className="selection-toolbar-actions">
                                                <button className="selection-toolbar-action" onClick={() => handleAction('download')}>
                                                    <Download size={15} color="var(--accent-cyan)" /> Download
                                                </button>
                                                {selectedPaths.size === 1 && isFile && (
                                                    <button className="selection-toolbar-action" onClick={() => handleFileClick(selectedItem)}>
                                                        <Eye size={15} /> View
                                                    </button>
                                                )}

                                                <button className="selection-toolbar-action" onClick={() => handleAction('copy')}>
                                                    <Copy size={15} /> Copy
                                                </button>
                                                {canEdit && (
                                                    <button className="selection-toolbar-action" onClick={() => handleAction('cut')}>
                                                        <Scissors size={15} /> Cut
                                                    </button>
                                                )}

                                                {selectedPaths.size === 1 && canEdit && (
                                                    <button className="selection-toolbar-action" onClick={() => handleAction('rename')}>
                                                        <Edit size={15} /> Rename
                                                    </button>
                                                )}

                                                {selectedPaths.size === 1 && !guestToken && (
                                                    <button className="selection-toolbar-action primary" onClick={() => handleAction('share')}>
                                                        <Share2 size={15} /> Share
                                                    </button>
                                                )}

                                                {!guestToken && (
                                                    <>
                                                        <button className="selection-toolbar-action" onClick={() => handleAction('compress')}>
                                                            <Box size={15} /> Archive
                                                        </button>
                                                        {selectedPaths.size === 1 && selectedItem && !selectedItem.isDirectory && /\.(zip|tar|tar\.gz|tgz|gz|rar|7z)$/i.test(selectedItem.name) && (
                                                            <button className="selection-toolbar-action" onClick={() => handleAction('extract', selectedItem)}>
                                                                <FolderOpen size={15} /> Extract
                                                            </button>
                                                        )}
                                                    </>
                                                )}

                                                {canEdit && (
                                                    <button className="selection-toolbar-action danger" onClick={() => handleAction('delete')}>
                                                        <Trash2 size={15} /> Delete
                                                    </button>
                                                )}

                                                <button
                                                    className="selection-toolbar-close"
                                                    onClick={() => setSelectedPaths(new Set())}
                                                    title="Clear Selection (Esc)"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
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

                                                    {explorerMode !== 'devices' && !guestToken && selectedDevice?.name && selectedDevice.name.toLowerCase() !== 'device' && selectedDevice.name.toLowerCase() !== 'usr' && (
                                                        <>
                                                            <ChevronRight size={14} color="var(--border-dim)" />
                                                            <div className={`crumb-item ${explorerMode === 'partitions' ? 'active' : ''}`} onClick={() => navigateTo('/', 'partitions', selectedDevice)}>
                                                                {selectedDevice.name}
                                                            </div>
                                                        </>
                                                    )}

                                                    {explorerMode === 'files' && path && (() => {
                                                        const originalParts = path.split(/[/\\]/).filter(Boolean);
                                                        const visibleCrumbs = originalParts.map((p, i) => ({
                                                            name: p,
                                                            originalIndex: i
                                                        })).filter(item => {
                                                            const nameLower = item.name.toLowerCase();
                                                            return nameLower !== 'usr' && nameLower !== 'device';
                                                        });

                                                        if (visibleCrumbs.length <= 3) {
                                                            return visibleCrumbs.map((item, index) => (
                                                                <React.Fragment key={index}>
                                                                    <ChevronRight size={14} color="var(--border-dim)" />
                                                                    <div
                                                                        className={`crumb-item ${index === visibleCrumbs.length - 1 ? 'active' : ''}`}
                                                                        onClick={() => {
                                                                            const isUNC = path.startsWith('\\\\');
                                                                            const targetParts = originalParts.slice(0, item.originalIndex + 1).join(path.includes('/') ? '/' : '\\');
                                                                            const newPath = isUNC ? `\\\\${targetParts}` : (targetParts.includes(':') ? targetParts : (path.startsWith('/') ? '/' + targetParts : targetParts));
                                                                            navigateTo(newPath, 'files');
                                                                        }}
                                                                    >
                                                                        {item.name}
                                                                    </div>
                                                                </React.Fragment>
                                                            ));
                                                        } else {
                                                            const firstPart = visibleCrumbs[0];
                                                            const lastTwo = visibleCrumbs.slice(visibleCrumbs.length - 2);
                                                            return (
                                                                <>
                                                                    <ChevronRight size={14} color="var(--border-dim)" />
                                                                    <div
                                                                        className="crumb-item"
                                                                        onClick={() => {
                                                                            const isUNC = path.startsWith('\\\\');
                                                                            const targetParts = originalParts.slice(0, firstPart.originalIndex + 1).join(path.includes('/') ? '/' : '\\');
                                                                            const newPath = isUNC ? `\\\\${targetParts}` : (targetParts.includes(':') ? targetParts : (path.startsWith('/') ? '/' + targetParts : targetParts));
                                                                            navigateTo(newPath, 'files');
                                                                        }}
                                                                    >
                                                                        {firstPart.name}
                                                                    </div>

                                                                    <ChevronRight size={14} color="var(--border-dim)" />
                                                                    <div className="crumb-item ellipsis" style={{ cursor: 'default', opacity: 0.5 }}>
                                                                        ...
                                                                    </div>

                                                                    {lastTwo.map((item, index) => {
                                                                        const isLast = index === 1;
                                                                        return (
                                                                            <React.Fragment key={index}>
                                                                                <ChevronRight size={14} color="var(--border-dim)" />
                                                                                <div
                                                                                    className={`crumb-item ${isLast ? 'active' : ''}`}
                                                                                    onClick={() => {
                                                                                        const isUNC = path.startsWith('\\\\');
                                                                                        const targetParts = originalParts.slice(0, item.originalIndex + 1).join(path.includes('/') ? '/' : '\\');
                                                                                        const newPath = isUNC ? `\\\\${targetParts}` : (targetParts.includes(':') ? targetParts : (path.startsWith('/') ? '/' + targetParts : targetParts));
                                                                                        navigateTo(newPath, 'files');
                                                                                    }}
                                                                                >
                                                                                    {item.name}
                                                                                </div>
                                                                            </React.Fragment>
                                                                        );
                                                                    })}
                                                                </>
                                                            );
                                                        }
                                                    })()}
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
                                                        tagFilter={tagFilter}
                                                        setTagFilter={setTagFilter}
                                                        allTags={allTags}
                                                        iconOnly={true}
                                                    />

                                                    {activeOps.length > 0 && (
                                                        <div className="header-progress-container" onClick={() => setShowOperations(true)} style={{ cursor: 'pointer' }}>
                                                            <div className="header-progress-bar" style={{ width: `${avgProgress}%` }}></div>
                                                            <div style={{ position: 'relative', zIndex: 1, fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                <Activity size={12} color="var(--accent-gold)" style={{ animation: 'spin 2s linear infinite' }} />
                                                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{activeOps.length}</span>
                                                                <span style={{ color: 'var(--accent-gold)' }}>{Math.round(avgProgress)}%</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!guestToken && (
                                                         <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                             <button className="btn-secondary" style={{ borderRadius: '10px', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }} onClick={() => setShowSmartSearch(true)} title="AI Smart Search & OCR"><Sparkles size={16} /></button>
                                                             <button className="btn-secondary" style={{ borderRadius: '10px', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-gold)' }} onClick={() => setShowSecretsVault(true)} title="Encrypted Secrets Vault"><KeyRound size={16} /></button>
                                                             <button className="btn-secondary" style={{ borderRadius: '10px', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a78bfa' }} onClick={() => setShowHeatmapModal(path || '')} title="Disk Space Heatmap"><PieChart size={16} /></button>
                                                             <button className="btn-primary shadow-premium upload-button" style={{ borderRadius: '10px', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }} onClick={() => fileInputRef.current.click()} title="Upload"><Upload size={16} /></button>
                                                         </div>
                                                    )}
                                                    {clipboard && !guestToken && <button className="btn-primary shadow-premium" style={{ borderRadius: '10px', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }} onClick={handlePaste} title="Paste"><Copy size={16} /></button>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {explorerMode === 'files' && !(guestToken && guestPermissions === 'Upload') && (
                                    <div className="explorer-filter-bar">
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '6px' }}>Filter:</span>
                                        {[
                                            { id: 'all', label: 'All Files', icon: <Filter size={13} /> },
                                            { id: 'folders', label: 'Folders', icon: <Folder size={13} /> },
                                            { id: 'documents', label: 'Documents', icon: <File size={13} /> },
                                            { id: 'images', label: 'Images', icon: <ImageIcon size={13} /> },
                                            { id: 'media', label: 'Media', icon: <Video size={13} /> }
                                        ].map(item => {
                                            const isActive = fileTypeFilter === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setFileTypeFilter(item.id)}
                                                    className={`filter-pill ${isActive ? 'active' : ''}`}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 14px',
                                                        borderRadius: '20px',
                                                        border: isActive ? '1px solid var(--primary-light)' : '1px solid var(--border-subtle)',
                                                        background: isActive ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-surface-1)',
                                                        color: isActive ? '#fff' : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        fontSize: '12.5px',
                                                        fontWeight: '600',
                                                        transition: 'all 0.15s ease',
                                                        outline: 'none',
                                                        boxShadow: isActive ? '0 0 14px rgba(99, 102, 241, 0.25)' : 'none'
                                                    }}
                                                >
                                                    {item.icon}
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="explorer-body" style={{ minHeight: '440px', position: 'relative' }}>
                                    {loading ? (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minHeight: '440px',
                                            width: '100%',
                                            padding: '60px 20px',
                                            boxSizing: 'border-box'
                                        }}>
                                            <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    width: '120px',
                                                    height: '120px',
                                                    borderRadius: '50%',
                                                    background: 'radial-gradient(circle, rgba(242, 201, 76, 0.25) 0%, rgba(242, 201, 76, 0) 70%)'
                                                }} />
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                                                    style={{
                                                        position: 'absolute',
                                                        width: '90px',
                                                        height: '90px',
                                                        borderRadius: '50%',
                                                        border: '2px dashed var(--accent-gold)',
                                                        borderTopColor: 'transparent',
                                                        borderBottomColor: 'transparent',
                                                        opacity: 0.8
                                                    }}
                                                />
                                                <motion.div
                                                    animate={{ rotate: -360 }}
                                                    transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                                                    style={{
                                                        position: 'absolute',
                                                        width: '68px',
                                                        height: '68px',
                                                        borderRadius: '50%',
                                                        border: '2px solid var(--accent-cyan)',
                                                        borderLeftColor: 'transparent',
                                                        borderRightColor: 'transparent',
                                                        opacity: 0.6
                                                    }}
                                                />
                                                <motion.div
                                                    animate={{ scale: [0.95, 1.05, 0.95] }}
                                                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                                                    style={{
                                                        width: '52px',
                                                        height: '52px',
                                                        borderRadius: '16px',
                                                        background: 'linear-gradient(135deg, rgba(242, 201, 76, 0.2), rgba(0, 210, 255, 0.15))',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(242, 201, 76, 0.4)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 0 20px rgba(242, 201, 76, 0.25)'
                                                    }}
                                                >
                                                    <HardDrive size={26} color="var(--accent-gold)" />
                                                </motion.div>
                                            </div>
                                            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                                <div style={{
                                                    fontSize: '14px',
                                                    fontWeight: '800',
                                                    letterSpacing: '0.08em',
                                                    textTransform: 'uppercase',
                                                    color: 'var(--text-primary)',
                                                    marginBottom: '6px'
                                                }}>
                                                    Accessing Drive Contents
                                                </div>
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '3px 12px',
                                                    borderRadius: '20px',
                                                    background: 'rgba(242, 201, 76, 0.1)',
                                                    border: '1px solid rgba(242, 201, 76, 0.25)',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    color: 'var(--accent-gold)',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    <motion.span
                                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                                                    >
                                                        ●
                                                    </motion.span>
                                                    Loading...
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
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
                                            if (!e.target.closest('.file-card') && !e.target.closest('.file-row-list-item')) {
                                                onRightClick(e, null);
                                            }
                                        }}>
                                    {explorerMode === 'devices' && (
                                        <>
                                            {devices.map((dev, i) => (
                                                <div key={i} className="file-card" onClick={() => navigateTo('/', 'partitions', dev)}>
                                                    <HardDrive size={56} color="var(--accent-gold)" /><div className="label">{dev.name}</div><div style={{ fontSize: '11px', color: '#484f58' }}>{formatGB((dev.size || 0) / 1e9)} {dev.type}</div>
                                                </div>
                                            ))}
                                            {networkShares.filter(ns => !cloudMounts.some(cm => cm.label === ns.label || (cm.path && ns.path && cm.path === ns.path))).map((ns, i) => (
                                                <div key={`net-${i}`} className="file-card" onClick={() => navigateTo(ns.path, 'files', { name: ns.label })}>
                                                    <Globe size={56} color="var(--accent-cyan)" /><div className="label">{ns.label}</div><div style={{ fontSize: '11px', color: '#484f58' }}>{ns.type} Cluster</div>
                                                </div>
                                            ))}
                                            {cloudMounts.map((cm, i) => {
                                                const isGoogle = cm.type === 'GDRIVE';
                                                const isOneDrive = cm.type === 'ONEDRIVE';
                                                const isS3 = cm.type === 'S3';
                                                const isSFTP = cm.type === 'SFTP';
                                                const isNFS = cm.type === 'NFS';
                                                const iconColor = isGoogle ? '#0ea5e9' : isOneDrive ? '#0078d4' : isS3 ? '#f59e0b' : isSFTP ? '#10b981' : isNFS ? '#8b5cf6' : 'var(--primary)';

                                                return (
                                                    <div 
                                                        key={`cloud-${i}`} 
                                                        className="file-card" 
                                                        onClick={() => {
                                                            const targetPath = cm.path || ('/cloud/' + cm.id);
                                                            navigateTo(targetPath, 'files', { name: cm.label, type: cm.type });
                                                        }}
                                                        style={{ border: '1px solid rgba(99, 102, 241, 0.2)' }}
                                                    >
                                                        <Globe size={56} color={iconColor} />
                                                        <div className="label">{cm.label}</div>
                                                        <div style={{ fontSize: '11px', color: iconColor, fontWeight: '800' }}>
                                                            {cm.type} • {cm.status || 'ONLINE'}
                                                        </div>
                                                        {cm.path && (
                                                            <div style={{ fontSize: '10px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                                                                {cm.path}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
                                                    navigateTo(validPath, 'files', selectedDevice);
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
                                                            background: 'var(--bg-surface-0)', 
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
                                                        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>Secure File Drop Box</h2>
                                                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Anonymous upload portal. Drag & drop files here or click below to browse.</p>
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
                                                                background: 'var(--bg-surface-0)', 
                                                                padding: '20px 24px', 
                                                                textAlign: 'left' 
                                                            }}
                                                        >
                                                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
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
                                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '12px', flexShrink: 0 }}>
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
                                                                    else if (f.isDirectory || f.isVault) navigateTo(f.path, 'files');
                                                                    else handleFileClick(f);
                                                                }}
                                                                onContextMenu={(e) => onRightClick(e, f)}>
                                                                <div className="selection-checkbox-wrapper" onClick={(e) => toggleSelection(e, f.path)}>
                                                                    <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
                                                                        {isSelected && <CheckCircle2 size={12} />}
                                                                    </div>
                                                                </div>
                                                                <div className="col-name" style={{ display: 'flex', alignItems: 'center' }}>
                                                                    {f.isVault ? (
                                                                        f.isLocked ? <Lock size={18} color="var(--accent-cyan)" /> : <Unlock size={18} color="var(--accent-gold)" />
                                                                    ) : (
                                                                        f.isDirectory ? <Folder size={18} color="var(--accent-gold)" /> : <File size={18} color="#8b949e" />
                                                                    )}
                                                                    <span style={{ marginLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                                                                </div>
                                                                <div className="col-size" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {f.isVault && f.isLocked ? 'Locked' : (
                                                                        f.isDirectory ? (
                                                                            f.size > 0 ? formatBytes(f.size) : (f.itemCount !== undefined ? `${f.itemCount} ${f.itemCount === 1 ? 'item' : 'items'}` : '--')
                                                                        ) : formatBytes(f.size)
                                                                    )}
                                                                </div>
                                                                <div className="col-type" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {f.isVault ? (f.isLocked ? 'Locked Vault' : 'Unlocked Vault') : (f.extension || (f.isDirectory ? 'Folder' : 'File'))}
                                                                </div>
                                                                <div className="col-mtime" style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                                    {formattedDate}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <>
                                                        {files.filter(f => f.isDirectory || f.isVault).length > 0 && (
                                                            <div className="explorer-section">
                                                                <div className="section-label"><Folder size={14} /> FOLDERS</div>
                                                                <div className="grid-shelf">
                                                                    {sortedFiles.filter(f => f.isDirectory || f.isVault).map((f, i) => (
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
                                                                            {f.isVault ? (
                                                                                f.isLocked ? <Lock size={64} color="var(--accent-cyan)" /> : <Unlock size={64} color="var(--accent-gold)" />
                                                                            ) : (
                                                                                <Folder size={64} color="var(--accent-gold)" />
                                                                            )}
                                                                            <p style={{ marginTop: '16px', fontSize: '13px', fontWeight: '700', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                                                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>
                                                                                {f.isVault ? (f.isLocked ? 'VAULT • LOCKED' : (f.size > 0 ? `VAULT • ${formatBytes(f.size)}` : 'VAULT')) : (f.itemCount !== undefined ? `FOLDER • ${f.itemCount} ${f.itemCount === 1 ? 'ITEM' : 'ITEMS'}` : (f.size > 0 ? `FOLDER • ${formatBytes(f.size)}` : 'FOLDER'))}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {files.filter(f => !f.isDirectory && !f.isVault).length > 0 && (
                                                            <div className="explorer-section">
                                                                <div className="section-label"><File size={14} /> FILES</div>
                                                                <div className="grid-shelf">
                                                                    {sortedFiles.filter(f => !f.isDirectory && !f.isVault).map((f, i) => (
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
                                                                            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginTop: '6px', letterSpacing: '0.08em' }}>{(f.extension || 'FILE').toUpperCase()} • {formatBytes(f.size)}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {files.length === 0 && !loading && (
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
                                )}

                                    <AnimatePresence>
                                        {inspectorOpen && (
                                            <InspectorSidebar
                                                isOpen={inspectorOpen}
                                                metadata={inspectorMetadata}
                                                loading={loadingMetadata}
                                                onClose={() => {
                                                    setInspectorOpen(false);
                                                    setSelectedPaths(new Set());
                                                    fetchFiles(path);
                                                    fetchTags();
                                                }}
                                                handleAction={handleAction}
                                                guestToken={guestToken}
                                                showToast={showToast}
                                                agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                                                token={token}
                                                currentUsername={username}
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
                                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Monitor and revoke active external sharing links</p>
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
                                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#f85149', color: 'var(--text-primary)', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>EXPIRED</span>
                                                        ) : (
                                                            <span style={{ marginLeft: '8px', padding: '2px 6px', background: '#4ade80', color: '#000', fontSize: '9px', fontWeight: '800', borderRadius: '4px', verticalAlign: 'middle' }}>ACTIVE</span>
                                                        )}
                                                    </p>
                                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
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
                                                        <button 
                                                            onClick={() => {
                                                                if (s.password) {
                                                                    copyToClipboard(s.password, 'Passkey copied!');
                                                                } else {
                                                                    showToast('Legacy encrypted passkey. Please Edit to reset.', 'error');
                                                                }
                                                            }} 
                                                            style={{ padding: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', transition: 'all 0.2s ease' }} 
                                                            title="Copy Passkey"
                                                        >
                                                            <Key size={18} />
                                                        </button>
                                                    )}
                                                    {!isExpired && (
                                                        <>
                                                            <button 
                                                                onClick={() => {
                                                                    let portalPrefix = '/g/';
                                                                    if (s.type === 'upload') portalPrefix = '/u/';
                                                                    else if (!s.has_password && !s.email_verification && s.type !== 'exchange') portalPrefix = '/p/';
                                                                    
                                                                    const shareUrl = s.url || `${window.location.protocol}//${window.location.host}${portalPrefix}${s.token || s.id}`;
                                                                    copyToClipboard(shareUrl, 'Link copied to clipboard');
                                                                }} 
                                                                style={{ padding: '8px', background: 'var(--accent-cyan-glow)', border: '1px solid var(--accent-cyan)', borderRadius: '8px', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', transition: 'all 0.2s ease' }}
                                                                title="Copy Link"
                                                            >
                                                                <Copy size={18} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setShareModal(s)} 
                                                                style={{ padding: '8px', background: 'rgba(242, 201, 76, 0.1)', border: '1px solid rgba(242, 201, 76, 0.3)', borderRadius: '8px', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', transition: 'all 0.2s ease' }}
                                                                title="Edit Share"
                                                            >
                                                                <Edit size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                    <button 
                                                        onClick={() => revokeShare(s.token || s.id)} 
                                                        style={{ padding: '8px', background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.3)', borderRadius: '8px', color: '#f85149', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', transition: 'all 0.2s ease' }}
                                                        title="Revoke Share"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {activeShares.length === 0 && <div style={{ textAlign: 'center', padding: '60px', opacity: 0.3 }}><Link2 size={48} /><p>No active shares found</p></div>}
                                </div>
                            </motion.div>
                        )}

                        {view === 'starred' && (
                            <StarredView
                                onNavigate={(itemPath, isDirectory) => {
                                    setView('browse');
                                    setExplorerMode('files');
                                    if (isDirectory) {
                                        setPath(itemPath);
                                    } else {
                                        const parts = itemPath.replace(/\\/g, '/').split('/');
                                        parts.pop();
                                        const parentPath = parts.join('/') || '/';
                                        setPath(parentPath);
                                        setSelectedPaths(new Set([itemPath]));
                                    }
                                }}
                                showToast={showToast}
                            />
                        )}

                        {view === 'trash' && (
                            <TrashView
                                token={token}
                                showToast={showToast}
                                trashItems={trashItems}
                                setTrashItems={setTrashItems}
                                fetchTrashItems={fetchTrashItems}
                            />
                        )}

                        {view === 'network' && (
                            <motion.div key="net" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <CloudMountHubView 
                                    showToast={showToast} 
                                    onExploreFiles={(mount) => {
                                        setView('browse');
                                        setExplorerMode('files');
                                        const targetPath = mount.path || ('/cloud/' + mount.id);
                                        navigateTo(targetPath, 'files', { name: mount.label, type: mount.type });
                                        showToast(`Exploring "${mount.label}" in File Manager`, 'info');
                                    }}
                                />
                            </motion.div>
                        )}

                        {view === 'sync' && (
                            <motion.div key="syn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <SyncCenter agents={agentStorage} showToast={showToast} />
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

                        {view === 'vaults' && (
                            <motion.div key="vlt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <VaultsView 
                                    showToast={showToast} 
                                    setView={setView} 
                                    setPath={setPath} 
                                    setExplorerMode={setExplorerMode} 
                                />
                            </motion.div>
                        )}

                        {view === 'traffic' && (
                            <motion.div key="trf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <NetworkTrafficView showToast={showToast} />
                            </motion.div>
                        )}

                        {view === 'tiering' && (
                            <motion.div key="tier" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <StorageTieringView showToast={showToast} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </section>
            </main >

            <ContextMenu
                data={contextMenu}
                onAction={(action, file) => {
                    setContextMenu(null);
                    handleAction(action, file);
                }}
                onPaste={() => {
                    setContextMenu(null);
                    handlePaste();
                }}
                onClose={() => setContextMenu(null)}
                hasClipboard={!!clipboard}
                clipboardCount={clipboard?.files?.length || (clipboard ? 1 : 0)}
                clipboardType={clipboard?.type || 'copy'}
                onCreateFolder={() => { setShowFolderModal(true); setContextMenu(null); }}
                onUploadClick={() => { fileInputRef.current?.click(); setContextMenu(null); }}
                onRefresh={() => { fetchFiles(path); setContextMenu(null); }}
                selectedCount={selectedPaths.size}
                isGuest={!!guestToken}
                guestPermissions={guestPermissions}
            />
            {contextMenu && <div className="cm-overlay" onClick={() => setContextMenu(null)} />}

            {/* Global Transfer Engine & Speedometer Drawer */}
            <TransferQueueDrawer 
                transfers={operations.map(op => ({
                    id: op.id,
                    name: op.name || 'File Operation',
                    type: op.type || 'upload',
                    status: (op.status === 'In Progress' || op.status === 'Preparing' || op.status === 'Scanning...') ? 'active' : (op.status === 'Completed' ? 'completed' : (op.status === 'Failed' ? 'failed' : 'active')),
                    progress: op.progress || 0,
                    transferred: op.bytesTransferred || 0,
                    size: op.totalBytes || 0,
                    speed: op.speed || 0,
                    eta: op.eta || 0,
                    source: op.type === 'upload' ? 'Local Client' : (selectedDevice?.name || 'Local Master'),
                    destination: selectedDevice?.name || 'NexaDisk Storage'
                }))}
                onCancelTransfer={cancelOperation}
                onClearCompleted={() => setOperations(prev => prev.filter(o => o.status !== 'Completed' && o.status !== 'Failed'))}
            />


            {
                shareModal && (
                    <ShareModal
                        path={shareModal.path || shareModal}
                        forceUploadOnly={shareModal.forceUploadOnly}
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
                editingFile && (
                    <FileEditorModal
                        file={editingFile}
                        onClose={() => setEditingFile(null)}
                        showToast={showToast}
                        onSaved={() => fetchFiles(path)}
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
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.6' }}>
                                {updateMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}


            <AnimatePresence>
                {showOperations && (
                    <OperationStatus 
                        operations={operations} 
                        setOperations={setOperations}
                        onClose={() => setShowOperations(false)} 
                        onCancel={cancelOperation} 
                    />
                )}
            </AnimatePresence>
            <OverlapConfirmModal
                context={overwriteContext}
                onClose={() => setOverwriteContext(null)}
                onConfirm={(ctx) => {
                    setOverwriteContext(null);
                    executeOperation(ctx.type, ctx.source, ctx.target, ctx.agentId, true);
                }}
            />
            <ProvisionModal 
                show={showProvisionModal} 
                onClose={() => setShowProvisionModal(false)} 
                onAgentAdded={fetchAllData}
                showToast={showToast}
            />
            <CreateFolderModal show={showFolderModal} onClose={() => setShowFolderModal(false)} onSubmit={handleCreateFolder} />
            
            {/* Inline vault unlock modal */}
            <AnimatePresence>
                {unlockLockerData && (
                    <div className="modal-overlay" style={{ zIndex: 1150 }}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content glass" style={{ width: '380px', padding: '24px', textAlign: 'left' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Unlock size={18} color="var(--accent-gold)" /> Unlock Secure Vault
                                </h3>
                                <button onClick={handleCancelInlineUnlock} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>✕</button>
                            </div>

                            <form onSubmit={handleInlineUnlockLocker}>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                                    This folder is encrypted and locked. Enter the master passphrase to mount the locker.
                                </p>
                                
                                <div style={{ marginBottom: '20px' }}>
                                    <label className="m-label" style={{ display: 'block', marginBottom: '6px' }}>Passphrase</label>
                                    <input 
                                        type="password" 
                                        className="m-input" 
                                        placeholder="••••••••" 
                                        value={unlockLockerPassword} 
                                        onChange={e => setUnlockLockerPassword(e.target.value)}
                                        autoFocus
                                        required 
                                    />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button type="button" className="btn-secondary" onClick={handleCancelInlineUnlock}>Cancel</button>
                                    <button type="submit" className="btn-primary" style={{ background: 'var(--accent-gold)', borderColor: 'var(--accent-gold)', color: '#000', padding: '0 20px', fontWeight: '700' }}>Unlock</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <CompressModal 
                show={showCompressModal} 
                onClose={() => { setShowCompressModal(false); setCompressTargets([]); }} 
                onSubmit={handleCompress} 
                defaultName={compressTargets.length > 0 ? (compressTargets[0].name.split('.')[0] || compressTargets[0].name) : 'archive'}
            />
            {previewMedia && (
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
            )}
            {editingFile && (
                <FileEditorModal
                    file={editingFile}
                    onClose={() => setEditingFile(null)}
                    showToast={showToast}
                    onSaved={() => {
                        fetchFiles(path);
                    }}
                />
            )}
            {showHeatmapModal !== false && (
                <StorageHeatmapModal
                    path={typeof showHeatmapModal === 'string' ? showHeatmapModal : path}
                    onClose={() => setShowHeatmapModal(false)}
                    showToast={showToast}
                    onNavigateToFile={(p) => {
                        setShowHeatmapModal(false);
                        navigateTo(p, 'files');
                    }}
                />
            )}
            {showDeduplicateModal !== false && (
                <DeduplicationModal
                    path={typeof showDeduplicateModal === 'string' ? showDeduplicateModal : path}
                    agentId={selectedDevice?.type === 'Agent' ? selectedDevice.id : undefined}
                    onClose={() => setShowDeduplicateModal(false)}
                    onRefresh={() => fetchFiles(path)}
                    showToast={showToast}
                />
            )}
            {historyFile && (
                <FileVersionHistoryModal
                    file={historyFile}
                    onClose={() => setHistoryFile(null)}
                    showToast={showToast}
                    onRestored={() => fetchFiles(path)}
                />
            )}
            {commentFile && (
                <FileCommentsModal
                    file={commentFile}
                    onClose={() => setCommentFile(null)}
                    showToast={showToast}
                />
            )}
            {showSmartSearch && (
                <SmartSearchModal
                    currentPath={path}
                    onClose={() => setShowSmartSearch(false)}
                    showToast={showToast}
                    onOpenFile={(f) => {
                        if (f && f.path) {
                            if (f.isDirectory) {
                                navigateTo(f.path, 'files');
                            } else {
                                handleFileClick(f);
                            }
                            setShowSmartSearch(false);
                        }
                    }}
                />
            )}
            {showSecretsVault && (
                <EncryptedSecretsModal
                    onClose={() => setShowSecretsVault(false)}
                    showToast={showToast}
                />
            )}
            {showDeployConfigModal && (
                <DeploymentConfigModal
                    show={showDeployConfigModal}
                    onClose={() => setShowDeployConfigModal(false)}
                    showToast={showToast}
                />
            )}
            {showSiteMeshModal && (
                <SiteMeshModal
                    show={showSiteMeshModal}
                    onClose={() => setShowSiteMeshModal(false)}
                    showToast={showToast}
                    onExploreSite={(siteId, siteName, poolMount) => {
                        setShowSiteMeshModal(false);
                        setView('browse');
                        if (!siteId || siteId === 'master-local') {
                            setExplorerMode('devices');
                            setSelectedDevice(null);
                            setPath('/');
                            fetchDevices();
                            fetchFiles('/');
                            showToast(`Opened local storage on ${siteName || 'Primary Host'}`, 'info');
                        } else {
                            // Remote federated secondary site
                            const targetPath = poolMount ? `/sitemesh/${siteId}/${encodeURIComponent(poolMount)}` : `/sitemesh/${siteId}/`;
                            navigateTo(targetPath, 'browse');
                            fetchDevices();
                            showToast(`Opened remote storage pool on ${siteName}`, 'info');
                        }
                    }}
                />
            )}
            {showClusterUpdateModal && (
                <ClusterUpdateModal
                    show={showClusterUpdateModal}
                    onClose={() => setShowClusterUpdateModal(false)}
                    showToast={showToast}
                />
            )}
            <ConfirmModal
                show={!!globalConfirmAction}
                title={globalConfirmAction?.title || 'Confirm Action'}
                message={globalConfirmAction?.message || ''}
                confirmText={globalConfirmAction?.confirmText || 'Confirm'}
                cancelText="Cancel"
                type={globalConfirmAction?.type || 'danger'}
                onConfirm={() => {
                    if (globalConfirmAction?.onConfirm) globalConfirmAction.onConfirm();
                    setGlobalConfirmAction(null);
                }}
                onCancel={() => setGlobalConfirmAction(null)}
            />
            <ConfirmationModal
                show={!!confirmModal}
                message={confirmModal?.message}
                onClose={() => setConfirmModal(null)}
                onConfirm={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
            />
            <AudioPlayer
                activeTrack={activeTrack}
                playQueue={playQueue}
                isPlaying={isPlaying}
                onPlayPause={handlePlayPause}
                onNext={handleNextTrack}
                onPrev={handlePrevTrack}
                onSelectTrack={handleSelectTrack}
                onRemoveTrack={handleRemoveTrack}
                onClose={handleClosePlayer}
                shareId={guestToken ? shareId : undefined}
            />
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={(e) => {
                handleUpload(Array.from(e.target.files));
                e.target.value = null;
            }} />
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div >
    );
}



const OperationStatus = ({ operations = [], setOperations, onClose, onCancel }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed', 'failed'

    const activeOps = operations.filter(o => o.status !== 'Completed' && o.status !== 'Failed');
    const completedOps = operations.filter(o => o.status === 'Completed');
    const failedOps = operations.filter(o => o.status === 'Failed');

    const filteredOps = operations.filter(op => {
        if (filter === 'active') return op.status !== 'Completed' && op.status !== 'Failed';
        if (filter === 'completed') return op.status === 'Completed';
        if (filter === 'failed') return op.status === 'Failed';
        return true;
    });

    const totalSpeed = activeOps.reduce((acc, o) => acc + (o.speed || 0), 0);

    const handleClearFinished = () => {
        if (setOperations) {
            setOperations(prev => prev.filter(o => o.status !== 'Completed' && o.status !== 'Failed'));
        }
    };

    const handleDismissOp = (opId) => {
        if (setOperations) {
            setOperations(prev => prev.filter(o => o.id !== opId));
        }
    };

    const formatSpeed = (bytesPerSec) => {
        if (!bytesPerSec || bytesPerSec <= 0) return '0.0 KB/s';
        if (bytesPerSec > 1024 * 1024) {
            return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
        }
        return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    };

    return (
        <div className="command-center-overlay">
            <div className="command-center-backdrop" onClick={onClose} />
            <motion.div 
                className="command-center-drawer"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
                {/* Header */}
                <div className="command-center-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="cc-header-icon-box">
                            <Activity size={20} color="var(--accent-cyan)" />
                            {activeOps.length > 0 && <span className="cc-pulse-orb" />}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Command Center</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Fleet Operations & Task Queue</p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(completedOps.length > 0 || failedOps.length > 0) && (
                            <button 
                                onClick={handleClearFinished}
                                className="cc-clear-btn"
                                title="Clear finished operations"
                            >
                                Clear Finished
                            </button>
                        )}
                        <button onClick={onClose} className="cc-close-btn" title="Close Command Center">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Metrics Summary Strip */}
                <div className="cc-metrics-grid">
                    <div className="cc-metric-box">
                        <span className="cc-metric-title">Active</span>
                        <span className="cc-metric-num" style={{ color: activeOps.length > 0 ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                            {activeOps.length}
                        </span>
                    </div>
                    <div className="cc-metric-box">
                        <span className="cc-metric-title">Completed</span>
                        <span className="cc-metric-num" style={{ color: 'var(--accent-emerald)' }}>
                            {completedOps.length}
                        </span>
                    </div>
                    <div className="cc-metric-box">
                        <span className="cc-metric-title">Failed</span>
                        <span className="cc-metric-num" style={{ color: failedOps.length > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                            {failedOps.length}
                        </span>
                    </div>
                    <div className="cc-metric-box">
                        <span className="cc-metric-title">Bandwidth</span>
                        <span className="cc-metric-num" style={{ color: 'var(--primary-light)', fontSize: '14px' }}>
                            {formatSpeed(totalSpeed)}
                        </span>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="cc-tabs-bar">
                    {[
                        { id: 'all', label: `All (${operations.length})` },
                        { id: 'active', label: `Active (${activeOps.length})` },
                        { id: 'completed', label: `Completed (${completedOps.length})` },
                        { id: 'failed', label: `Failed (${failedOps.length})` }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilter(tab.id)}
                            className={`cc-tab-pill ${filter === tab.id ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Operation Cards Body */}
                <div className="cc-body-scroll">
                    {filteredOps.length === 0 ? (
                        <div className="cc-empty-state">
                            <div className="cc-empty-icon-wrap">
                                <Activity size={32} color="var(--primary-light)" />
                            </div>
                            <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>No Operations in Queue</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: '1.5' }}>
                                File uploads, transfers, and background operations will appear here in real time.
                            </p>
                        </div>
                    ) : (
                        filteredOps.map(op => {
                            const isFailed = op.status === 'Failed';
                            const isDone = op.status === 'Completed';
                            const statusColor = isFailed ? 'var(--accent-rose)' : (isDone ? 'var(--accent-emerald)' : 'var(--accent-cyan)');
                            const progress = Math.min(100, Math.max(0, op.progress || 0));
                            const speed = op.speed || 0;
                            const eta = op.eta || 0;
                            const transferred = op.bytesTransferred || 0;
                            const total = op.totalBytes || 0;

                            const formatBytes = (bytes) => {
                                if (!bytes || bytes === 0) return '0 B';
                                const k = 1024;
                                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                                const i = Math.floor(Math.log(bytes) / Math.log(k));
                                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                            };

                            return (
                                <div key={op.id} className="cc-op-card">
                                    <div className="cc-card-top">
                                        <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                                            <div className="cc-op-name" title={op.name}>
                                                {op.name || 'Background Operation'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                                <span className="cc-type-badge">{op.type || 'TASK'}</span>
                                                <span className="cc-status-text" style={{ color: statusColor }}>
                                                    {isDone ? 'COMPLETED' : (isFailed ? 'FAILED' : 'IN PROGRESS')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="cc-progress-pct" style={{ color: statusColor }}>
                                            {Math.round(progress)}%
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="cc-progress-rail">
                                        <div 
                                            className="cc-progress-bar-fill" 
                                            style={{ 
                                                width: `${progress}%`,
                                                background: isFailed 
                                                    ? 'var(--accent-rose)' 
                                                    : isDone 
                                                        ? 'linear-gradient(90deg, #10b981, #06b6d4)' 
                                                        : 'linear-gradient(90deg, var(--primary-light), var(--accent-cyan))'
                                            }} 
                                        />
                                    </div>

                                    {/* Stats 2-column Grid */}
                                    <div className="cc-stats-grid">
                                        <div>
                                            <div className="cc-stat-lbl">Transfer Rate</div>
                                            <div className="cc-stat-val">{formatSpeed(speed)}</div>
                                        </div>
                                        <div>
                                            <div className="cc-stat-lbl">ETA Remaining</div>
                                            <div className="cc-stat-val">
                                                {isDone ? 'Finished' : (isFailed ? 'Stopped' : (eta > 0 ? `${Math.ceil(eta)}s` : 'Calculating...'))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Actions & Transferred Size */}
                                    <div className="cc-card-footer">
                                        <div className="cc-transferred-info">
                                            <span style={{ color: 'var(--text-muted)' }}>Progress: </span>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
                                                {formatBytes(transferred)} / {formatBytes(total)}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            {!isDone && !isFailed ? (
                                                <button
                                                    className="cc-btn-cancel"
                                                    onClick={() => onCancel && onCancel(op.id)}
                                                    title="Cancel operation"
                                                >
                                                    Cancel
                                                </button>
                                            ) : (
                                                <button
                                                    className="cc-btn-dismiss"
                                                    onClick={() => handleDismissOp(op.id)}
                                                    title="Dismiss from list"
                                                >
                                                    Dismiss
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </div>
    );
};



const ExplorerToolbar = ({ 
    viewMode, 
    setViewMode, 
    sortBy, 
    setSortBy, 
    sortOrder, 
    setSortOrder,
    tagFilter,
    setTagFilter,
    allTags = []
}) => {
    return (
        <div className="explorer-toolbar-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {allTags && allTags.length > 0 && (
                <div className="toolbar-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface-2)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <Tag size={13} color="var(--text-secondary)" />
                    <select
                        value={tagFilter || ''}
                        onChange={(e) => setTagFilter(e.target.value || null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
                    >
                        <option value="">All Tags</option>
                        {allTags.map(tag => (
                            <option key={tag.id} value={tag.name} style={{ color: tag.name === tagFilter ? 'var(--primary)' : tag.color }}>
                                {tag.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Sort Control */}
            <div className="toolbar-pill-group" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface-2)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <Filter size={13} color="var(--text-secondary)" />
                <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); localStorage.setItem('sortBy', e.target.value); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', cursor: 'pointer', fontWeight: '600' }}
                >
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                    <option value="modified">Modified</option>
                </select>
                <button
                    onClick={() => { const next = sortOrder === 'asc' ? 'desc' : 'asc'; setSortOrder(next); localStorage.setItem('sortOrder', next); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                    title={sortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
                >
                    {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* View Mode Switcher */}
            <div className="toolbar-view-toggle" style={{ display: 'flex', background: 'var(--bg-surface-2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)', gap: '2px' }}>
                <button
                    className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => { setViewMode('list'); localStorage.setItem('viewMode', 'list'); }}
                    style={{
                        background: viewMode === 'list' ? 'var(--primary-light)' : 'transparent',
                        border: 'none',
                        color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                    }}
                    title="List View"
                >
                    <ListIcon size={15} />
                </button>
                <button
                    className={`view-btn ${viewMode === 'icons-sm' ? 'active' : ''}`}
                    onClick={() => { setViewMode('icons-sm'); localStorage.setItem('viewMode', 'icons-sm'); }}
                    style={{
                        background: viewMode === 'icons-sm' ? 'var(--primary-light)' : 'transparent',
                        border: 'none',
                        color: viewMode === 'icons-sm' ? '#fff' : 'var(--text-secondary)',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                    }}
                    title="Grid View"
                >
                    <LayoutGrid size={15} />
                </button>
                <button
                    className={`view-btn ${viewMode === 'icons-lg' ? 'active' : ''}`}
                    onClick={() => { setViewMode('icons-lg'); localStorage.setItem('viewMode', 'icons-lg'); }}
                    style={{
                        background: viewMode === 'icons-lg' ? 'var(--primary-light)' : 'transparent',
                        border: 'none',
                        color: viewMode === 'icons-lg' ? '#fff' : 'var(--text-secondary)',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                    }}
                    title="Large Icons"
                >
                    <LayoutList size={15} />
                </button>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', flex: 1, minWidth: '150px' }}>
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
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{value}%</span>
                </div>
            </div>
            <span style={{ marginTop: '12px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
        </div>
    );
};

const SparklineChart = ({ data, dataKey, label, color }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', color: '#484f58', flex: 1 }}>
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
        <div style={{ padding: '16px', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label} Trend</span>
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
                    return <circle cx={x} cy={y} r="4" fill={color} stroke="var(--border-subtle)" strokeWidth="1.5" />;
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

const NetworkThroughputChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', color: '#484f58', flex: 1 }}>
                Waiting for network telemetry samples...
            </div>
        );
    }

    const width = 500;
    const height = 120;
    const padding = 10;
    const pointsCount = Math.max(30, data.length);

    const maxRx = Math.max(...data.map(d => d.rx || 0));
    const maxTx = Math.max(...data.map(d => d.tx || 0));
    const maxVal = Math.max(0.5, Math.ceil(Math.max(maxRx, maxTx) * 1.2 * 10) / 10);

    const rxPoints = data.map((d, index) => {
        const x = padding + (index / (pointsCount - 1)) * (width - padding * 2);
        const val = d.rx || 0;
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    const txPoints = data.map((d, index) => {
        const x = padding + (index / (pointsCount - 1)) * (width - padding * 2);
        const val = d.tx || 0;
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    let rxFillPoints = '';
    if (data.length > 0) {
        const firstX = padding;
        const lastX = padding + ((data.length - 1) / (pointsCount - 1)) * (width - padding * 2);
        rxFillPoints = `${rxPoints} ${lastX},${height - padding} ${firstX},${height - padding}`;
    }

    let txFillPoints = '';
    if (data.length > 0) {
        const firstX = padding;
        const lastX = padding + ((data.length - 1) / (pointsCount - 1)) * (width - padding * 2);
        txFillPoints = `${txPoints} ${lastX},${height - padding} ${firstX},${height - padding}`;
    }

    const latestRx = data[data.length - 1]?.rx || 0;
    const latestTx = data[data.length - 1]?.tx || 0;

    return (
        <div style={{ padding: '16px', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', flex: 1, minWidth: '240px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Network IO (MB/s)</span>
                <div style={{ display: 'flex', gap: '12px', fontSize: '10px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)' }} />
                        RX: {latestRx} MB/s
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-gold)' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-gold)' }} />
                        TX: {latestTx} MB/s
                    </span>
                </div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '120px' }}>
                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height/2} x2={width - padding} y2={height/2} stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                
                <text x={padding + 5} y={padding + 8} fill="#484f58" fontSize="8" fontFamily="monospace">{maxVal} MB/s</text>
                <text x={padding + 5} y={height/2 + 3} fill="#484f58" fontSize="8" fontFamily="monospace">{(maxVal/2).toFixed(1)} MB/s</text>

                {rxFillPoints && (
                    <polygon
                        points={rxFillPoints}
                        fill="url(#rxAreaGradient)"
                    />
                )}
                {txFillPoints && (
                    <polygon
                        points={txFillPoints}
                        fill="url(#txAreaGradient)"
                    />
                )}

                <polyline
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2"
                    points={rxPoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <polyline
                    fill="none"
                    stroke="var(--accent-gold)"
                    strokeWidth="2"
                    points={txPoints}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {data.length > 0 && (() => {
                    const lastIndex = data.length - 1;
                    const x = padding + (lastIndex / (pointsCount - 1)) * (width - padding * 2);
                    const rxY = height - padding - (latestRx / maxVal) * (height - padding * 2);
                    const txY = height - padding - (latestTx / maxVal) * (height - padding * 2);
                    return (
                        <>
                            <circle cx={x} cy={rxY} r="3.5" fill="var(--accent-cyan)" stroke="var(--border-subtle)" strokeWidth="1.2" />
                            <circle cx={x} cy={txY} r="3.5" fill="var(--accent-gold)" stroke="var(--border-subtle)" strokeWidth="1.2" />
                        </>
                    );
                })()}

                <defs>
                    <linearGradient id="rxAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="txAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-gold)" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="var(--accent-gold)" stopOpacity="0.0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};

const SystemHealthAdvisor = ({ currentMetrics, disks, online, isLocal }) => {
    const cpuVal = currentMetrics?.cpu || 0;
    const memVal = currentMetrics?.memory || 0;
    const latencyVal = isLocal ? 0 : (currentMetrics?.latency || 0);

    const warnings = [];
    if (!online) {
        warnings.push('Node is offline. Check agent connectivity.');
    } else {
        if (cpuVal > 85) warnings.push(`Critical CPU load: ${cpuVal}%`);
        if (memVal > 90) warnings.push(`Critical RAM exhaustion: ${memVal}%`);
        if (latencyVal > 150) warnings.push(`High link latency: ${latencyVal}ms`);
        
        if (disks && disks.length > 0) {
            disks.forEach(d => {
                if (d.percentage > 90) {
                    warnings.push(`Disk volume ${d.mount} is nearly full (${d.percentage}%)`);
                }
            });
        }
    }

    let statusText = 'HEALTHY';
    let statusColor = '#3fb950';
    let statusGlow = 'rgba(63, 185, 80, 0.2)';

    if (warnings.length > 0) {
        const hasCritical = warnings.some(w => w.includes('offline') || cpuVal > 92 || memVal > 95);
        if (hasCritical) {
            statusText = 'CRITICAL';
            statusColor = '#f85149';
            statusGlow = 'rgba(248, 81, 73, 0.2)';
        } else {
            statusText = 'WARNING';
            statusColor = 'var(--accent-gold)';
            statusGlow = 'rgba(212, 175, 55, 0.2)';
        }
    }

    return (
        <div style={{ padding: '16px', background: 'var(--bg-surface-2)', borderRadius: '12px', border: '1px solid var(--border-subtle)', flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Health Diagnostics</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: statusGlow, border: `1px solid ${statusColor}`, padding: '4px 10px', borderRadius: '20px' }}>
                        <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                        <span style={{ fontSize: '10px', fontWeight: '800', color: statusColor, letterSpacing: '0.5px' }}>{statusText}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '5px 8px', borderRadius: '6px' }}>
                        <span>CPU Cores status</span>
                        <span style={{ color: cpuVal > 85 ? '#f85149' : '#3fb950', fontWeight: 'bold' }}>{cpuVal > 85 ? 'High Load' : 'Normal'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '5px 8px', borderRadius: '6px' }}>
                        <span>Memory footprint</span>
                        <span style={{ color: memVal > 90 ? '#f85149' : '#3fb950', fontWeight: 'bold' }}>{memVal > 90 ? 'Near Exhaustion' : 'Optimal'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '5px 8px', borderRadius: '6px' }}>
                        <span>Disk S.M.A.R.T. Health</span>
                        <span style={{ color: disks.some(d => d.percentage > 90) ? 'var(--accent-gold)' : '#3fb950', fontWeight: 'bold' }}>
                            {disks.some(d => d.percentage > 95) ? 'Critical' : (disks.some(d => d.percentage > 90) ? 'Warning' : 'Passing')}
                        </span>
                    </div>
                    {!isLocal && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '5px 8px', borderRadius: '6px' }}>
                            <span>Link Latency Status</span>
                            <span style={{ color: latencyVal > 150 ? '#f85149' : '#3fb950', fontWeight: 'bold' }}>{latencyVal > 150 ? 'Slow' : 'Excellent'}</span>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', display: 'block', marginBottom: '4px' }}>Active Recommendations:</span>
                {warnings.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>🟢 All systems operational. No actions required.</span>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '42px', overflowY: 'auto' }}>
                        {warnings.map((w, idx) => (
                            <span key={idx} style={{ fontSize: '11px', color: w.includes('Critical') || w.includes('offline') ? '#f85149' : 'var(--accent-gold)' }}>⚠️ {w}</span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const TerminalLogs = ({ logs, onRefresh, loading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [isFrozen, setIsFrozen] = useState(false);
    const [frozenLogs, setFrozenLogs] = useState([]);
    const terminalRef = useRef(null);

    const handleFreezeToggle = () => {
        if (!isFrozen) {
            setFrozenLogs([...logs]);
        }
        setIsFrozen(!isFrozen);
    };

    const activeLogs = isFrozen ? frozenLogs : logs;

    const filteredLogs = activeLogs.filter(line => {
        if (!line) return false;
        const matchesSearch = line.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (levelFilter === 'ALL') return true;
        if (levelFilter === 'INFO') return line.includes('[INFO]') || (!line.includes('[WARN]') && !line.includes('[ERROR]'));
        if (levelFilter === 'WARN') return line.includes('[WARN]');
        if (levelFilter === 'ERROR') return line.includes('[ERROR]');
        return true;
    });

    useEffect(() => {
        if (terminalRef.current && !isFrozen) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs, filteredLogs, isFrozen]);

    const formatLogLine = (line, idx) => {
        if (!line) return null;
        let color = '#94a3b8';
        let level = 'INFO';
        let levelBg = 'rgba(14, 165, 233, 0.12)';
        let levelColor = '#38bdf8';

        if (line.includes('[INFO]')) {
            color = '#e2e8f0';
            level = 'INFO';
            levelBg = 'rgba(14, 165, 233, 0.12)';
            levelColor = '#38bdf8';
        } else if (line.includes('[WARN]')) {
            color = '#fef08a';
            level = 'WARN';
            levelBg = 'rgba(251, 191, 36, 0.15)';
            levelColor = '#fbbf24';
        } else if (line.includes('[ERROR]')) {
            color = '#fecdd3';
            level = 'ERROR';
            levelBg = 'rgba(244, 63, 94, 0.2)';
            levelColor = '#f43f5e';
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
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '4px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', lineHeight: '1.5' }}>
                    <span style={{ color: '#64748b', userSelect: 'none', flexShrink: 0 }}>[{time}]</span>
                    <span style={{ color: levelColor, background: levelBg, padding: '1px 5px', borderRadius: '4px', fontWeight: '800', fontSize: '10px', flexShrink: 0 }}>
                        {level}
                    </span>
                    <span style={{ color, wordBreak: 'break-word', flex: 1 }}>{message}</span>
                </div>
            );
        }

        return (
            <div key={idx} style={{ color: '#cbd5e1', fontFamily: 'var(--font-mono)', fontSize: '11.5px', marginBottom: '4px', lineHeight: '1.5', wordBreak: 'break-word' }}>
                {line}
            </div>
        );
    };

    return (
        <div style={{ 
            background: '#0a0e1a', 
            borderRadius: '16px', 
            border: '1px solid rgba(99, 102, 241, 0.3)', 
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)', 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            minHeight: '480px',
            overflow: 'hidden' 
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                background: '#0f1629', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)' 
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                    <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '800', color: '#94a3b8', fontFamily: 'var(--font-mono)', letterSpacing: '0.8px' }}>
                        CONSOLE_OUTPUT
                    </span>
                    <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>
                        {filteredLogs.length} events
                    </span>
                    {isFrozen && (
                        <span style={{ fontSize: '10px', background: 'rgba(244, 63, 94, 0.2)', color: '#f43f5e', padding: '2px 8px', borderRadius: '6px', fontWeight: '800' }}>
                            ⏸️ FROZEN
                        </span>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={handleFreezeToggle}
                        style={{ 
                            background: isFrozen ? '#f43f5e' : 'rgba(255, 255, 255, 0.06)', 
                            border: '1px solid rgba(255, 255, 255, 0.1)', 
                            height: '28px', 
                            padding: '0 12px', 
                            borderRadius: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            cursor: 'pointer', 
                            color: '#ffffff', 
                            fontSize: '11px', 
                            fontWeight: '700',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {isFrozen ? '▶️ Resume' : '⏸️ Freeze'}
                    </button>
                    <button 
                        onClick={onRefresh} 
                        disabled={loading}
                        style={{ 
                            background: 'rgba(99, 102, 241, 0.15)', 
                            border: '1px solid rgba(99, 102, 241, 0.35)', 
                            height: '28px', 
                            padding: '0 12px', 
                            borderRadius: '6px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            cursor: 'pointer', 
                            color: '#a5b4fc',
                            fontSize: '11px',
                            fontWeight: '700',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <RefreshCw size={12} className={loading ? 'spin-anim' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                padding: '10px 16px', 
                background: '#0d1322', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                alignItems: 'center', 
                flexWrap: 'wrap' 
            }}>
                <input 
                    type="text" 
                    placeholder="🔍 Filter log stream..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    style={{ 
                        background: '#151d32', 
                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                        color: '#f8fafc', 
                        borderRadius: '6px', 
                        padding: '5px 12px', 
                        fontSize: '11.5px', 
                        width: '180px', 
                        outline: 'none',
                        fontFamily: 'inherit'
                    }} 
                />
                <div style={{ display: 'flex', gap: '3px', background: '#151d32', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    {['ALL', 'INFO', 'WARN', 'ERROR'].map(lvl => {
                        const active = levelFilter === lvl;
                        return (
                            <button
                                key={lvl}
                                onClick={() => setLevelFilter(lvl)}
                                style={{
                                    background: active ? 'var(--primary-light)' : 'transparent',
                                    border: 'none',
                                    color: active ? '#ffffff' : '#94a3b8',
                                    padding: '3px 9px',
                                    borderRadius: '4px',
                                    fontSize: '10.5px',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    transition: '0.15s ease'
                                }}
                            >
                                {lvl}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div 
                ref={terminalRef}
                style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    background: '#060911', 
                    padding: '16px', 
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {filteredLogs.length === 0 ? (
                    <div style={{ color: '#475569', fontStyle: 'italic', fontFamily: 'var(--font-mono)', fontSize: '12px', textAlign: 'center', margin: 'auto' }}>
                        {searchTerm || levelFilter !== 'ALL' ? 'No matching logs for filter...' : 'Streaming active. Waiting for system events...'}
                    </div>
                ) : (
                    filteredLogs.map((line, i) => formatLogLine(line, i))
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
                {status === 'pending' && <span className="badge-pending" style={{ fontSize: '9px', background: '#f85149', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PENDING</span>}
                <span style={{ fontSize: '10px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', fontWeight: '800' }}>
                    {isLocal ? 'MASTER' : 'SLAVE'}
                </span>
            </div>
        </div>
        <div style={{ marginTop: '16px' }}>
            {status === 'pending' ? (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Agent is awaiting approval.</p>
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

const AuthScreen = ({ handleLogin, appName, onOpenSetupWizard }) => {
    const [mode, setMode] = useState('login'); // 'login', 'forgot_username', 'forgot_verify', 'mfa_prompt'
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

    // MFA & Remember Me States
    const [tempCredentials, setTempCredentials] = useState(null);
    const [rememberDevice, setRememberDevice] = useState(false);

    const handleLocalSubmitLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const username = e.target.username.value;
        const password = e.target.password.value;
        const rememberMe = e.target.rememberMe.checked;
        setRememberDevice(rememberMe);

        try {
            const res = await axios.post(`${API_BASE}/login`, { username, password });
            
            if (res.data.mfaRequired) {
                setTempCredentials({ username, password });
                setMode('mfa_prompt');
                setLoading(false);
                return;
            }

            // Set login success state to trigger animated transition screen
            setLoginSuccess({
                username: res.data.username,
                userId: res.data.id,
                avatar: res.data.avatar_path
            });
            
            // Save credentials based on rememberMe option
            const token = res.data.token;
            const role = res.data.role;
            const storage = rememberMe ? localStorage : sessionStorage;

            // Clear old session/local tokens first to avoid conflict
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userRole');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('userRole');

            storage.setItem('token', token);
            storage.setItem('username', res.data.username);
            storage.setItem('userRole', role);
            
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

    const handleLocalSubmitMfa = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const mfaCode = e.target.mfaCode.value;

        try {
            const res = await axios.post(`${API_BASE}/login`, {
                username: tempCredentials.username,
                password: tempCredentials.password,
                mfaCode
            });

            setLoginSuccess({
                username: res.data.username,
                userId: res.data.id,
                avatar: res.data.avatar_path
            });

            const token = res.data.token;
            const role = res.data.role;
            const storage = rememberDevice ? localStorage : sessionStorage;

            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userRole');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem('userRole');

            storage.setItem('token', token);
            storage.setItem('username', res.data.username);
            storage.setItem('userRole', role);

            setTimeout(() => {
                handleLogin(token, res.data.username, role);
            }, 2500);
        } catch (err) {
            setShake(true);
            setLoginError(true);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Verification failed';
            setError(msg);
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
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', lineHeight: '1.4', margin: '8px 0 0' }}>
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
                                <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '18px' }}>
                                    <input 
                                        type="checkbox" 
                                        id="rememberMe" 
                                        name="rememberMe" 
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0052cc' }} 
                                    />
                                    <label htmlFor="rememberMe" style={{ cursor: 'pointer', margin: 0, fontSize: '13px', color: 'var(--text-secondary)', userSelect: 'none' }}>
                                        Remember this device
                                    </label>
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

                        {mode === 'mfa_prompt' && (
                            <form onSubmit={handleLocalSubmitMfa}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Two-Factor Authentication</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', textAlign: 'center', lineHeight: '1.4' }}>
                                    Enter the 6-digit verification code from your Authenticator app.
                                </p>
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}
                                <div className="form-field">
                                    <label>MFA Verification Code</label>
                                    <div className="form-input-wrapper">
                                        <ShieldCheck size={18} className="form-input-icon" />
                                        <input 
                                            name="mfaCode" 
                                            placeholder="000000" 
                                            maxLength="6"
                                            required 
                                            autoFocus
                                            style={{ paddingLeft: '44px', textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }} 
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="auth-submit-btn" disabled={loading}>
                                    {loading ? 'Verifying...' : 'Verify & Authorize'}
                                </button>
                                <div style={{ marginTop: '18px', textAlign: 'center' }}>
                                    <span 
                                        onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                                        className="forgot-link-btn"
                                        style={{ float: 'none' }}
                                    >
                                        Back to Login
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_username' && (
                            <form onSubmit={handleFetchQuestion}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Reset Passkey</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
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
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Back to Login
                                    </span>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot_verify' && (
                            <form onSubmit={handleResetPasswordSubmit}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', textAlign: 'center', color: 'var(--text-primary)' }}>Identity Verification</h3>
                                
                                {error && <div style={{ color: '#f85149', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(248,81,73,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.2)' }}>{error}</div>}
                                {message && <div style={{ color: '#3fb950', fontSize: '13px', marginBottom: '16px', textAlign: 'left', background: 'rgba(63,185,80,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(63,185,80,0.2)' }}>{message}</div>}

                                <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-dim)', marginBottom: '20px', textAlign: 'left' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Security Question</div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '600', lineHeight: '1.4' }}>{securityQuestion}</div>
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
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Back
                                    </span>
                                </div>
                            </form>
                        )}

                        {onOpenSetupWizard && mode === 'login' && (
                            <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    onClick={onOpenSetupWizard}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--accent-cyan)',
                                        fontSize: '12.5px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <Sparkles size={14} /> First Time Deployment? Run Setup Wizard
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};



export default App;
