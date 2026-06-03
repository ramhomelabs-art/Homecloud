-- Standardized Initial Schema Migration
-- Creates all required tables for NexaDisk as of Feb 2026

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'User',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shares table (Secure Share Gate)
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    password TEXT,
    expiry DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    email TEXT,
    max_views INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    agent_id TEXT,
    permissions TEXT DEFAULT 'View'
);

-- Network shares table
CREATE TABLE IF NOT EXISTS network_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    username TEXT,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Persistent agents table
CREATE TABLE IF NOT EXISTS persistent_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activity log (Not in schema but used by some patterns)
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    name TEXT,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    error TEXT
);

-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default admin is created by server logic usually, but kept for reference
-- INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', '...', 'Administrator');
