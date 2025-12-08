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

-- RLS Policies
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlists" ON watchlists
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own watchlists" ON watchlists
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own watchlists" ON watchlists
  FOR DELETE USING (user_id = auth.uid()::text);

-- Index
CREATE INDEX idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX idx_watchlists_account_id ON watchlists(account_id);
