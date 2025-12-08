-- Supabase Schema for Kamigotchi Manager
-- This schema supports multi-wallet teams with Privy authentication

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - stores Privy user data
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- This stores the privy_user_id string directly
  privy_user_id TEXT UNIQUE NOT NULL, -- Kept for backward compatibility queries if needed, but same as id
  email TEXT,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Operator Wallets table - encrypted private keys for controlling teams
CREATE TABLE operator_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- References Privy ID string
  name TEXT NOT NULL, -- User-friendly name for this wallet (e.g., "Main Team", "Alt Team")
  account_id TEXT NOT NULL, -- The numeric on-chain Account ID (e.g., 2491...)
  wallet_address TEXT DEFAULT '', -- The 0x... wallet address
  encrypted_private_key TEXT NOT NULL, -- Encrypted with user's password/key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, account_id)
);

-- Kamigotchis table - stores full kami data from on-chain
CREATE TABLE kamigotchis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- References Privy ID string
  operator_wallet_id UUID NOT NULL REFERENCES operator_wallets(id) ON DELETE CASCADE,
  
  -- On-chain data
  kami_entity_id TEXT NOT NULL UNIQUE,
  kami_index INTEGER NOT NULL,
  kami_name TEXT,
  level INTEGER DEFAULT 1,
  state TEXT DEFAULT 'RESTING',
  room_index INTEGER,
  room_name TEXT,
  media_uri TEXT,
  account_id TEXT NOT NULL,
  affinities JSONB,
  stats JSONB,
  final_stats JSONB,
  traits JSONB,
  
  -- Credentials
  encrypted_private_key TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kami Profiles table - stores automation settings per Kami
CREATE TABLE kami_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kamigotchi_id UUID NOT NULL REFERENCES kamigotchis(id) ON DELETE CASCADE,
  operator_wallet_id UUID NOT NULL REFERENCES operator_wallets(id) ON DELETE CASCADE,

  -- Harvesting automation settings
  auto_harvest_enabled BOOLEAN DEFAULT false,
  harvest_node_index INTEGER, -- Which node to harvest from
  auto_collect_enabled BOOLEAN DEFAULT false,
  auto_restart_enabled BOOLEAN DEFAULT false, -- Auto-restart after collect

  -- Health management
  min_health_threshold INTEGER DEFAULT 20, -- Stop harvesting below this health %
  auto_heal_enabled BOOLEAN DEFAULT false,

  -- Scheduling
  harvest_schedule_type TEXT DEFAULT 'continuous', -- 'continuous', 'scheduled', 'manual'
  harvest_start_time TIME,
  harvest_end_time TIME,
  harvest_duration INTEGER DEFAULT 60, -- minutes
  rest_duration INTEGER DEFAULT 30, -- minutes

  -- Status tracking
  last_harvest_start TIMESTAMP WITH TIME ZONE,
  last_collect TIMESTAMP WITH TIME ZONE,
  is_currently_harvesting BOOLEAN DEFAULT false,

  -- Statistics
  total_harvests INTEGER DEFAULT 0,
  total_rests INTEGER DEFAULT 0,
  automation_started_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(kamigotchi_id)
);

-- Harvest Logs table - track all harvest operations
CREATE TABLE harvest_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kami_profile_id UUID NOT NULL REFERENCES kami_profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'start', 'stop', 'collect'
  success BOOLEAN NOT NULL,
  tx_hash TEXT,
  error_message TEXT,
  musu_collected INTEGER, -- Amount collected if operation_type = 'collect'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs table - comprehensive logging for user visibility (Required by GEMINI.md)
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- References Privy ID string
  kami_profile_id TEXT, -- Can be null for system-wide events, or string ID
  kami_index INTEGER,
  action TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error', 'info', 'warning'
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for system_logs
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX idx_system_logs_kami_profile_id ON system_logs(kami_profile_id);
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at DESC);

-- Row Level Security for system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own system logs" ON system_logs
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own system logs" ON system_logs
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- User Settings table - global user preferences
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, -- References Privy ID string
  notification_email TEXT,
  notification_enabled BOOLEAN DEFAULT true,
  notification_on_harvest_complete BOOLEAN DEFAULT true,
  notification_on_error BOOLEAN DEFAULT true,
  notification_on_low_health BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'arcade',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_operator_wallets_user_id ON operator_wallets(user_id);
CREATE INDEX idx_operator_wallets_account_id ON operator_wallets(account_id);
CREATE INDEX idx_kamigotchis_user_id ON kamigotchis(user_id);
CREATE INDEX idx_kamigotchis_operator_wallet_id ON kamigotchis(operator_wallet_id);
CREATE INDEX idx_kamigotchis_kami_entity_id ON kamigotchis(kami_entity_id);
CREATE INDEX idx_kami_profiles_kamigotchi_id ON kami_profiles(kamigotchi_id);
CREATE INDEX idx_kami_profiles_operator_wallet_id ON kami_profiles(operator_wallet_id);
CREATE INDEX idx_kami_profiles_auto_harvest_enabled ON kami_profiles(auto_harvest_enabled);
CREATE INDEX idx_harvest_logs_kami_profile_id ON harvest_logs(kami_profile_id);
CREATE INDEX idx_harvest_logs_created_at ON harvest_logs(created_at DESC);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operator_wallets_updated_at BEFORE UPDATE ON operator_wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kamigotchis_updated_at BEFORE UPDATE ON kamigotchis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kami_profiles_updated_at BEFORE UPDATE ON kami_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kamigotchis ENABLE ROW LEVEL SECURITY;
ALTER TABLE kami_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvest_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Operator wallets policies
CREATE POLICY "Users can view own wallets" ON operator_wallets
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own wallets" ON operator_wallets
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own wallets" ON operator_wallets
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own wallets" ON operator_wallets
  FOR DELETE USING (user_id = auth.uid()::text);

-- Kamigotchis policies
CREATE POLICY "Users can view own kamigotchis" ON kamigotchis
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own kamigotchis" ON kamigotchis
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own kamigotchis" ON kamigotchis
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own kamigotchis" ON kamigotchis
  FOR DELETE USING (user_id = auth.uid()::text);

-- Kami profiles policies
CREATE POLICY "Users can view own kami profiles" ON kami_profiles
  FOR SELECT USING (operator_wallet_id IN (
    SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can insert own kami profiles" ON kami_profiles
  FOR INSERT WITH CHECK (operator_wallet_id IN (
    SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can update own kami profiles" ON kami_profiles
  FOR UPDATE USING (operator_wallet_id IN (
    SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
  ));

CREATE POLICY "Users can delete own kami profiles" ON kami_profiles
  FOR DELETE USING (operator_wallet_id IN (
    SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
  ));

-- Harvest logs policies
CREATE POLICY "Users can view own harvest logs" ON harvest_logs
  FOR SELECT USING (kami_profile_id IN (
    SELECT id FROM kami_profiles WHERE operator_wallet_id IN (
      SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
    )
  ));

CREATE POLICY "Users can insert own harvest logs" ON harvest_logs
  FOR INSERT WITH CHECK (kami_profile_id IN (
    SELECT id FROM kami_profiles WHERE operator_wallet_id IN (
      SELECT id FROM operator_wallets WHERE user_id = auth.uid()::text
    )
  ));

-- User settings policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (user_id = auth.uid()::text);

DROP FUNCTION IF EXISTS get_user_active_wallets(text) CASCADE;

-- Helper function to get user's active operator wallets
CREATE OR REPLACE FUNCTION get_user_active_wallets(p_privy_user_id TEXT)
RETURNS TABLE (
  wallet_id UUID,
  wallet_name TEXT,
  account_id TEXT,
  wallet_address TEXT,
  kami_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ow.id as wallet_id,
    ow.name as wallet_name,
    ow.account_id,
    ow.wallet_address,
    COUNT(kp.id) as kami_count
  FROM operator_wallets ow
  JOIN users u ON ow.user_id = u.id
  LEFT JOIN kami_profiles kp ON kp.operator_wallet_id = ow.id
  WHERE u.privy_user_id = p_privy_user_id
    AND ow.is_active = true
  GROUP BY ow.id, ow.name, ow.account_id, ow.wallet_address
  ORDER BY ow.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get kami profiles with automation status
CREATE OR REPLACE FUNCTION get_automated_kamis()
RETURNS TABLE (
  profile_id UUID,
  kami_entity_id TEXT,
  kami_name TEXT,
  wallet_address TEXT,
  auto_harvest_enabled BOOLEAN,
  harvest_node_index INTEGER,
  is_currently_harvesting BOOLEAN,
  last_harvest_start TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp.id as profile_id,
    kp.kami_entity_id,
    kp.kami_name,
    ow.wallet_address,
    kp.auto_harvest_enabled,
    kp.harvest_node_index,
    kp.is_currently_harvesting,
    kp.last_harvest_start
  FROM kami_profiles kp
  JOIN operator_wallets ow ON kp.operator_wallet_id = ow.id
  WHERE kp.auto_harvest_enabled = true
    AND ow.is_active = true
  ORDER BY kp.last_harvest_start ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Watchlist table
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- References Privy ID string
  account_id TEXT NOT NULL, -- The on-chain Account Entity ID
  account_name TEXT,
  kami_entity_id TEXT NOT NULL, -- The on-chain Kami Entity ID
  kami_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, kami_entity_id)
);

-- Indexes for watchlists
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_account_id ON watchlists(account_id);

-- Row Level Security for watchlists
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlists" ON watchlists
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own watchlists" ON watchlists
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own watchlists" ON watchlists
  FOR DELETE USING (user_id = auth.uid()::text);

-- Comments for documentation
COMMENT ON TABLE users IS 'Stores user authentication data from Privy';
COMMENT ON TABLE operator_wallets IS 'Encrypted private keys for operator wallets that control teams';
COMMENT ON TABLE kami_profiles IS 'Automation settings for individual Kamis';
COMMENT ON TABLE harvest_logs IS 'Audit log of all harvest operations';
COMMENT ON TABLE user_settings IS 'User preferences and notification settings';

COMMENT ON COLUMN operator_wallets.encrypted_private_key IS 'Private key encrypted using AES-256-GCM with user password';
COMMENT ON COLUMN kami_profiles.harvest_schedule_type IS 'Harvest scheduling mode: continuous, scheduled, or manual';
COMMENT ON COLUMN kami_profiles.min_health_threshold IS 'Health percentage below which to stop harvesting';
