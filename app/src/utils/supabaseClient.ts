import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for backend

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface User {
  id: string;
  privy_user_id: string;
  email?: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export interface OperatorWallet {
  id: string;
  user_id: string;
  name: string;
  wallet_address: string;
  encrypted_private_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KamiProfile {
  id: string;
  operator_wallet_id: string;
  kami_entity_id: string;
  kami_index: number;
  kami_name?: string;

  // Harvesting automation settings
  auto_harvest_enabled: boolean;
  harvest_node_index?: number;
  auto_collect_enabled: boolean;
  auto_restart_enabled: boolean;

  // Health management
  min_health_threshold: number;
  auto_heal_enabled: boolean;
  auto_revive?: boolean;

  // Scheduling
  harvest_schedule_type: 'continuous' | 'scheduled' | 'manual';
  harvest_start_time?: string;
  harvest_end_time?: string;

  // Status tracking
  last_harvest_start?: string;
  last_collect?: string;
  is_currently_harvesting: boolean;

  created_at: string;
  updated_at: string;
}

export interface HarvestLog {
  id: string;
  kami_profile_id: string;
  operation_type: 'start' | 'stop' | 'collect';
  success: boolean;
  tx_hash?: string;
  error_message?: string;
  musu_collected?: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  notification_email?: string;
  notification_enabled: boolean;
  notification_on_harvest_complete: boolean;
  notification_on_error: boolean;
  notification_on_low_health: boolean;
  theme: string;
  created_at: string;
  updated_at: string;
}
