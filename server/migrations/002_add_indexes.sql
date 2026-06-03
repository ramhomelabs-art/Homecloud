-- Performance Indexes for Production
CREATE INDEX IF NOT EXISTS idx_shares_expiry ON shares(expiry);
CREATE INDEX IF NOT EXISTS idx_shares_agent_id ON shares(agent_id);
CREATE INDEX IF NOT EXISTS idx_persistent_agents_status ON persistent_agents(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
