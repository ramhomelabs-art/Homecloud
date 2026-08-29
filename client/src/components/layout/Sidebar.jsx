import React from 'react';
import { 
    HardDrive, LayoutDashboard, FolderTree, Cpu, Link2, RefreshCw, 
    Share2, Shield, Bell, User, Settings as SettingsIcon, LogOut, 
    Lock, X, Wifi, Globe, Layers
} from 'lucide-react';

const NavItem = ({ icon, label, active, onClick, badge, badgeColor }) => (
    <div className={`nav-link ${active ? 'active' : ''}`} onClick={onClick}>
        <span className="nav-icon-box">{icon}</span>
        <span className="nav-label">{label}</span>
        {badge && (
            <span className="nav-badge" style={{ 
                background: badgeColor || 'rgba(99, 102, 241, 0.15)',
                color: badgeColor ? '#fff' : 'var(--primary-light)',
                borderColor: badgeColor ? 'transparent' : 'rgba(99, 102, 241, 0.3)'
            }}>
                {badge}
            </span>
        )}
    </div>
);

export default function Sidebar({ 
    guestToken, 
    guestPermissions, 
    appName = "NexaDisk", 
    view, 
    setView, 
    setExplorerMode, 
    userRole = "Admin", 
    onDisconnect,
    mobileOpen = false,
    setMobileOpen
}) {
    const handleExplorerClick = () => {
        if (view === 'browse') {
            if (setExplorerMode) setExplorerMode('devices');
        } else {
            setView('browse');
        }
        if (setMobileOpen) setMobileOpen(false);
    };

    const handleNav = (v) => {
        setView(v);
        if (setMobileOpen) setMobileOpen(false);
    };

    return (
        <>
            {!(guestToken && guestPermissions === 'Upload') && (
                <>
                    {/* Mobile Backdrop */}
                    <div 
                        className={`sidebar-backdrop ${mobileOpen ? 'active' : ''}`}
                        onClick={() => setMobileOpen && setMobileOpen(false)}
                    />

                    <aside className={`side-nav ${mobileOpen ? 'mobile-open' : ''}`}>
                        {/* Logo Header */}
                        <div className="side-logo">
                            <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} 
                                onClick={() => !guestToken && handleNav('dashboard')}
                            >
                                <div className="side-logo-icon">
                                    <HardDrive size={18} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: '800', fontSize: '16px', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>{appName}</span>
                                    <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent-cyan)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Enterprise Core</span>
                                </div>
                            </div>

                            {/* Mobile Drawer Close */}
                            <button
                                className="mobile-menu-toggle"
                                style={{ width: '32px', height: '32px', display: mobileOpen ? 'flex' : 'none' }}
                                onClick={() => setMobileOpen && setMobileOpen(false)}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        
                        {/* Nav Items Scroll Area */}
                        <div className="sidebar-nav-scroll">
                            {!guestToken ? (
                                <>
                                    {/* Section: Main Storage */}
                                    <p className="nav-group-label">Core Storage</p>
                                    <NavItem 
                                        active={view === 'dashboard'} 
                                        onClick={() => handleNav('dashboard')} 
                                        icon={<LayoutDashboard size={18} />} 
                                        label="Dashboard" 
                                    />
                                    <NavItem 
                                        active={view === 'browse'} 
                                        onClick={handleExplorerClick} 
                                        icon={<FolderTree size={18} />} 
                                        label="File Explorer" 
                                    />

                                    {/* Section: Fleet & Infrastructure */}
                                    <p className="nav-group-label">Infrastructure & Fleet</p>
                                    <NavItem 
                                        active={view === 'machines'} 
                                        onClick={() => handleNav('machines')} 
                                        icon={<Cpu size={18} />} 
                                        label="Machines Fleet" 
                                    />
                                    <NavItem 
                                        active={view === 'network'} 
                                        onClick={() => handleNav('network')} 
                                        icon={<Globe size={18} />} 
                                        label="Cloud & Network Drives" 
                                    />
                                    <NavItem 
                                        active={view === 'tiering'} 
                                        onClick={() => handleNav('tiering')} 
                                        icon={<Layers size={18} />} 
                                        label="Storage Tiering & Lifecycle" 
                                    />

                                    {/* Section: Data Tools & Security */}
                                    <p className="nav-group-label">Sharing & Security</p>
                                    <NavItem 
                                        active={view === 'active_shares'} 
                                        onClick={() => handleNav('active_shares')} 
                                        icon={<Link2 size={18} />} 
                                        label="Active Share Links" 
                                    />
                                    <NavItem 
                                        active={view === 'sync'} 
                                        onClick={() => handleNav('sync')} 
                                        icon={<RefreshCw size={18} />} 
                                        label="Sync Center" 
                                    />
                                    <NavItem 
                                        active={view === 'vaults'} 
                                        onClick={() => handleNav('vaults')} 
                                        icon={<Lock size={18} />} 
                                        label="Encrypted Vaults" 
                                        badge="AES-256"
                                    />

                                    {/* Section: Administration */}
                                    <p className="nav-group-label">Management</p>
                                    {['Admin', 'Administrator', 'Operator'].includes(userRole) && (
                                        <>
                                            <NavItem 
                                                active={view === 'security'} 
                                                onClick={() => handleNav('security')} 
                                                icon={<Shield size={18} />} 
                                                label="Security Center" 
                                                badge="SOC"
                                            />
                                            <NavItem 
                                                active={view === 'traffic'} 
                                                onClick={() => handleNav('traffic')} 
                                                icon={<Wifi size={18} />} 
                                                label="Network Traffic" 
                                                badge="Live"
                                                badgeColor="#10b981"
                                            />
                                        </>
                                    )}
                                    <NavItem 
                                        active={view === 'alerts'} 
                                        onClick={() => handleNav('alerts')} 
                                        icon={<Bell size={18} />} 
                                        label="Alert Management" 
                                    />
                                    <NavItem 
                                        active={view === 'profile'} 
                                        onClick={() => handleNav('profile')} 
                                        icon={<User size={18} />} 
                                        label="My Profile" 
                                    />
                                    <NavItem 
                                        active={view === 'settings'} 
                                        onClick={() => handleNav('settings')} 
                                        icon={<SettingsIcon size={18} />} 
                                        label="System Settings" 
                                    />
                                </>
                            ) : (
                                <div className="nav-link active">
                                    <span className="nav-icon-box"><Share2 size={18} color="var(--primary-light)" /></span>
                                    <span className="nav-label">Shared Portal</span>
                                </div>
                            )}
                        </div>

                        {/* Footer Sign Out */}
                        {!guestToken && (
                            <div className="sidebar-footer">
                                <div 
                                    className="nav-link signout-link" 
                                    onClick={onDisconnect || (() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); })}
                                >
                                    <span className="nav-icon-box"><LogOut size={18} /></span>
                                    <span className="nav-label">Sign Out</span>
                                </div>
                            </div>
                        )}
                    </aside>
                </>
            )}
        </>
    );
}
