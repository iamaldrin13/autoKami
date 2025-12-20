import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { telegram } from './telegram.js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

let supabase: SupabaseClient;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️  WARNING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY are not set.');
  throw new Error('Supabase credentials not configured');
} else {
  // Initialize Supabase client
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('✅ Supabase client initialized');
}

export function reinitSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
        supabase = createClient(url, key);
        console.log('🔄 Supabase client re-initialized with new env');
    }
}

// Encryption utilities using AES-256-GCM
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

const pbkdf2 = promisify(crypto.pbkdf2);

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return (await pbkdf2(password, salt, 100000, KEY_LENGTH, 'sha512')) as Buffer;
}

export async function encryptPrivateKey(privateKey: string, password: string = ENCRYPTION_KEY): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Combine salt + iv + authTag + encrypted
  const result = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
  return result.toString('base64');
}

export async function decryptPrivateKey(encryptedData: string, password: string = ENCRYPTION_KEY): Promise<string> {
  const buffer = Buffer.from(encryptedData, 'base64');

  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = await deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// User operations
export interface User {
  id: string;
  privy_user_id: string;
  email?: string;
  wallet_address?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  created_at: string;
  updated_at: string;
}

export async function getUserByPrivyId(privyUserId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', privyUserId) // Use ID directly
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

export async function createUser(privyUserId: string, email?: string, walletAddress?: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: privyUserId, // Explicitly set ID to Privy ID
      privy_user_id: privyUserId,
      email,
      wallet_address: walletAddress
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOrCreateUser(privyUserId: string, email?: string, walletAddress?: string): Promise<User> {
  let user = await getUserByPrivyId(privyUserId);
  if (!user) {
    user = await createUser(privyUserId, email, walletAddress);
  }
  return user;
}

export async function updateUserTelegramSettings(userId: string, botToken: string, chatId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({
      telegram_bot_token: botToken,
      telegram_chat_id: chatId
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Operator Wallet (Profile) operations
export interface OperatorWallet {
  id: string;
  user_id: string;
  name: string;
  account_id: string;
  wallet_address: string;
  encrypted_private_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function addOperatorWallet(
  userId: string,
  name: string,
  accountId: string,
  walletAddress: string,
  privateKey: string
): Promise<OperatorWallet> {
  const encryptedKey = await encryptPrivateKey(privateKey);

  const { data, error } = await supabase
    .from('operator_wallets')
    .insert({
      user_id: userId,
      name,
      account_id: accountId,
      wallet_address: walletAddress,
      encrypted_private_key: encryptedKey,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getOperatorWallets(userId: string): Promise<OperatorWallet[]> {
  const { data, error } = await supabase
    .from('operator_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteOperatorWallet(walletId: string): Promise<void> {
  const { error } = await supabase
    .from('operator_wallets')
    .delete()
    .eq('id', walletId);

  if (error) throw error;
}

// Kamigotchi operations
export interface KamiStat {
  base: number;
  shift: number;
  boost: number;
  sync: number;
}

export interface KamiStats {
  health: KamiStat;
  power: KamiStat;
  harmony: KamiStat;
  violence: KamiStat;
}

export interface KamiTraits {
  face: number | null;
  hand: number | null;
  body: number | null;
  background: number | null;
  color: number | null;
}

export interface FinalStats {
  power: number;
  health: number;
  harmony: number;
  violence: number;
  fertilityMultiplier?: number;
  bountyMultiplier?: number;
  metabolismMultiplier?: number;
  strainMultiplier?: number;
  defenseShiftMultiplier?: number;
  defenseRatioMultiplier?: number;
  salvageRatioMultiplier?: number;
  atkSpoilsRatioMultiplier?: number;
  atkThresholdRatioMultiplier?: number;
  atkThresholdShiftMultiplier?: number;
  cooldownShift?: number;
  intensityBoost?: number;
}

export interface Kamigotchi {
  id: string;
  user_id: string;
  operator_wallet_id: string;
  kami_entity_id: string;
  kami_index: number;
  kami_name: string | null;
  level: number;
  state: string;
  room_index: number | null;
  room_name: string | null;
  media_uri: string | null;
  account_id: string;
  affinities: string[];
  stats: KamiStats;
  final_stats: FinalStats;
  traits: KamiTraits;
  current_health?: number;
  encrypted_private_key: string;
  created_at: string;
  updated_at: string;
  last_synced: string;
}

export async function upsertKamigotchi(kamiData: {
  userId: string;
  operatorWalletId: string;
  kamiEntityId: string;
  kamiIndex: number;
  kamiName: string | null;
  level: number;
  state: string;
  roomIndex: number | null;
  roomName: string | null;
  mediaUri: string | null;
  accountId: string;
  affinities: string[];
  stats: KamiStats;
  finalStats: FinalStats;
  traits: KamiTraits;
  privateKey: string;
  currentHealth?: number; // Added optional currentHealth
}): Promise<Kamigotchi> {
  const encryptedKey = await encryptPrivateKey(kamiData.privateKey);

  // Map final stats to columns
  const finalStats = kamiData.finalStats || {};
  const currentHealth = kamiData.currentHealth || 0;
  
  const statColumns = {
    current_health: currentHealth,
    stat_power: finalStats.power || 0,
    stat_health: finalStats.health || 0,
    stat_harmony: finalStats.harmony || 0,
    stat_violence: finalStats.violence || 0,
    mult_fertility: finalStats.fertilityMultiplier || 1.0,
    mult_bounty: finalStats.bountyMultiplier || 1.0,
    mult_metabolism: finalStats.metabolismMultiplier || 1.0,
    mult_strain: finalStats.strainMultiplier || 1.0,
    mult_defense_shift: finalStats.defenseShiftMultiplier || 1.0,
    mult_defense_ratio: finalStats.defenseRatioMultiplier || 1.0,
    mult_salvage_ratio: finalStats.salvageRatioMultiplier || 1.0,
    mult_atk_spoils_ratio: finalStats.atkSpoilsRatioMultiplier || 1.0,
    mult_atk_threshold_ratio: finalStats.atkThresholdRatioMultiplier || 1.0,
    mult_atk_threshold_shift: finalStats.atkThresholdShiftMultiplier || 1.0,
    boost_cooldown_shift: finalStats.cooldownShift || 0,
    boost_intensity: finalStats.intensityBoost || 0
  };

  console.log(`[Supabase] Saving stats for Kami #${kamiData.kamiIndex}: Power=${statColumns.stat_power}, Health=${statColumns.stat_health}`);

  const { data, error } = await supabase
    .from('kamigotchis')
    .upsert({
      user_id: kamiData.userId,
      operator_wallet_id: kamiData.operatorWalletId,
      kami_entity_id: kamiData.kamiEntityId,
      kami_index: kamiData.kamiIndex,
      kami_name: kamiData.kamiName,
      level: kamiData.level,
      state: kamiData.state,
      room_index: kamiData.roomIndex,
      room_name: kamiData.roomName,
      media_uri: kamiData.mediaUri,
      account_id: kamiData.accountId,
      affinities: kamiData.affinities,
      stats: kamiData.stats,
      final_stats: kamiData.finalStats,
      traits: kamiData.traits,
      encrypted_private_key: encryptedKey,
      last_synced: new Date().toISOString(),
      ...statColumns
    }, {
      onConflict: 'kami_entity_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getKamigotchis(userId: string, operatorWalletId?: string): Promise<Kamigotchi[]> {
  let query = supabase
    .from('kamigotchis')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (operatorWalletId && operatorWalletId !== 'default') {
    query = query.eq('operator_wallet_id', operatorWalletId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function getKamigotchiById(kamiId: string): Promise<Kamigotchi | null> {
  const { data, error } = await supabase
    .from('kamigotchis')
    .select('*')
    .eq('id', kamiId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function getKamigotchiByEntityId(entityId: string): Promise<Kamigotchi | null> {
  const { data, error } = await supabase
    .from('kamigotchis')
    .select('*')
    .eq('kami_entity_id', entityId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function getKamigotchiByIndex(kamiIndex: number): Promise<Kamigotchi | null> {
  const { data, error } = await supabase
    .from('kamigotchis')
    .select('*')
    .eq('kami_index', kamiIndex)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function deleteKamigotchi(kamiId: string): Promise<void> {
  const { error } = await supabase
    .from('kamigotchis')
    .delete()
    .eq('id', kamiId);

  if (error) throw error;
}

// Kami Profile (automation settings) operations
export interface KamiProfile {
  id: string;
  kamigotchi_id: string;
  operator_wallet_id: string;
  auto_harvest_enabled: boolean;
  harvest_node_index: number | null;
  auto_collect_enabled: boolean;
  auto_restart_enabled: boolean;
  min_health_threshold: number;
  auto_heal_enabled: boolean;
  harvest_schedule_type: string;
  harvest_start_time: string | null;
  harvest_end_time: string | null;
  harvest_duration: number;
  rest_duration: number;
  last_harvest_start: string | null;
  last_collect: string | null;
  is_currently_harvesting: boolean;
  total_harvests: number;
  total_rests: number;
  automation_started_at: string | null;
  strategy_type?: string;
  feed_item_id?: number;
  feed_item_id_2?: number;
  feed_trigger_value?: number;
  feed_interval_minutes?: number;
  last_feed_at?: string | null;
  auto_revive?: boolean;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateKamiProfile(kamigotchiId: string, operatorWalletId: string): Promise<KamiProfile> {
  // Try to get existing profile
  const { data: existing, error: selectError } = await supabase
    .from('kami_profiles')
    .select('*')
    .eq('kamigotchi_id', kamigotchiId)
    .single();

  if (existing) return existing;

  // Create new profile with defaults
  const { data, error } = await supabase
    .from('kami_profiles')
    .insert({
      kamigotchi_id: kamigotchiId,
      operator_wallet_id: operatorWalletId,
      auto_harvest_enabled: false,
      harvest_node_index: null,
      auto_collect_enabled: false,
      auto_restart_enabled: false,
      min_health_threshold: 20,
      auto_heal_enabled: false,
      harvest_schedule_type: 'continuous',
      harvest_duration: 60,
      rest_duration: 30,
      is_currently_harvesting: false,
      total_harvests: 0,
      total_rests: 0,
      automation_started_at: null,
      strategy_type: 'harvest_rest',
      feed_item_id: null,
      feed_item_id_2: null,
      feed_trigger_value: 50,
      feed_interval_minutes: 0,
      last_feed_at: null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateKamiProfile(kamigotchiId: string, updates: Partial<KamiProfile>): Promise<KamiProfile> {
  // First try to update
  const { data, error } = await supabase
    .from('kami_profiles')
    .update(updates)
    .eq('kamigotchi_id', kamigotchiId)
    .select()
    .maybeSingle(); // Use maybeSingle to avoid error if not found

  if (data) return data;

  // If not found, we need to create it. We need operator_wallet_id.
  const kami = await getKamigotchiById(kamigotchiId);
  if (!kami) throw new Error(`Kamigotchi ${kamigotchiId} not found, cannot create profile`);

  const { data: newProfile, error: insertError } = await supabase
    .from('kami_profiles')
    .insert({
      kamigotchi_id: kamigotchiId,
      operator_wallet_id: kami.operator_wallet_id,
      auto_harvest_enabled: false,
      harvest_node_index: null,
      auto_collect_enabled: false,
      auto_restart_enabled: false,
      min_health_threshold: 20,
      auto_heal_enabled: false,
      harvest_schedule_type: 'continuous',
      harvest_duration: 60,
      rest_duration: 30,
      is_currently_harvesting: false,
      total_harvests: 0,
      total_rests: 0,
      automation_started_at: null,
      strategy_type: 'harvest_rest',
      feed_item_id: null,
      feed_item_id_2: null,
      feed_trigger_value: 50,
      feed_interval_minutes: 0,
      last_feed_at: null,
      ...updates // Apply the updates to the new profile
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return newProfile;
}

// System Logging
export interface SystemLog {
  id?: string;
  user_id?: string; // Added for RLS
  kami_profile_id?: string;
  kami_index?: number;
  action: string;
  status: 'success' | 'error' | 'info' | 'warning';
  message: string;
  metadata?: any;
  created_at?: string;
}

export async function logSystemEvent(event: SystemLog): Promise<void> {
  // Console log for developers (following GEMINI.md format)
  const category = `[${event.status === 'info' ? 'Info' : event.status === 'success' ? 'Success' : event.status === 'error' ? 'Error' : 'Warning'}]`;
  console.log(`${category} ${event.action}: ${event.message}`);

  // Database log for users
  const { error } = await supabase.from('system_logs').insert({
    user_id: event.user_id,
    kami_profile_id: event.kami_profile_id, // can be null for system-wide events
    kami_index: event.kami_index,
    action: event.action,
    status: event.status,
    message: event.message,
    metadata: event.metadata,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error('Failed to write system log:', error);
  }

  // Send Telegram notification if configured
  if (event.user_id) {
    try {
      const user = await getUserByPrivyId(event.user_id);
      if (user && user.telegram_chat_id) {
        // Determine emoji based on status
        let emoji = 'ℹ️';
        if (event.status === 'success') emoji = '✅';
        if (event.status === 'warning') emoji = '⚠️';
        if (event.status === 'error') emoji = '🚨';

        let formattedMessage = event.message;

        // Clean up verbose Ethers errors
        if (event.status === 'error') {
            if (formattedMessage.includes('code=CALL_EXCEPTION')) {
                formattedMessage = 'Transaction reverted by contract.\nPossible causes: Wrong Room, Cooldown active, or Not Owner.';
            } else if (formattedMessage.includes('INSUFFICIENT_FUNDS')) {
                formattedMessage = 'Transaction failed: Insufficient funds for gas.';
            } else if (formattedMessage.includes('user rejected')) {
                formattedMessage = 'Transaction rejected by user.';
            } else if (formattedMessage.includes('action="sendTransaction"') || formattedMessage.includes('receipt={')) {
                // Catch-all for other verbose transaction errors
                formattedMessage = 'Transaction execution reverted. Check logs for details.';
            }
        }

        let message = `${emoji} *${event.action}*\n${formattedMessage}`;
        
        // Append Metadata
        if (event.metadata) {
            const meta = event.metadata;
            const details = [];
            if (meta.txHash) details.push(`🔗 Tx: \`${meta.txHash.substring(0, 10)}...\``);
            if (meta.harvestId) details.push(`🆔 Harvest ID: \`${meta.harvestId}\``);
            if (meta.nodeIndex !== undefined) details.push(`📍 Node: #${meta.nodeIndex}`);
            if (meta.currentHealth !== undefined) details.push(`❤️ Health: ${meta.currentHealth}`);
            
            if (details.length > 0) {
                message += `\n\n${details.join('\n')}`;
            }
        }
        
        // Use user's bot token if provided, otherwise default (handled by service)
        await telegram.sendMessage(message, {
          chatId: user.telegram_chat_id,
          botToken: user.telegram_bot_token || undefined,
          parseMode: 'Markdown'
        });
      }
    } catch (err) {
      console.error('Failed to send Telegram notification:', err);
    }
  }
}

// Auto Crafting Settings
export interface AutoCraftingSettings {
  id?: string;
  operator_wallet_id: string;
  is_enabled: boolean;
  recipe_id: number;
  amount_to_craft: number;
  interval_minutes: number;
  last_run_at?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getAutoCraftingSettings(operatorWalletId: string): Promise<AutoCraftingSettings | null> {
  const { data, error } = await supabase
    .from('auto_crafting_settings')
    .select('*')
    .eq('operator_wallet_id', operatorWalletId)
    .maybeSingle();

  if (error) {
    console.error('[Supabase] Error fetching auto crafting settings:', error);
    return null;
  }
  return data;
}

export async function upsertAutoCraftingSettings(settings: AutoCraftingSettings): Promise<boolean> {
  // Check for existing setting for this wallet to ensure we update it
  const existing = await getAutoCraftingSettings(settings.operator_wallet_id);
  
  const payload = {
    ...settings,
    updated_at: new Date().toISOString()
  };

  if (existing) {
    // Update
    const { error } = await supabase
      .from('auto_crafting_settings')
      .update(payload)
      .eq('id', existing.id);
      
    if (error) {
        console.error('[Supabase] Error updating crafting settings:', error);
        return false;
    }
  } else {
    // Insert
    const { error } = await supabase
      .from('auto_crafting_settings')
      .insert(payload);

    if (error) {
        console.error('[Supabase] Error inserting crafting settings:', error);
        return false;
    }
  }
  return true;
}

export async function getAllActiveCraftingSettings(): Promise<(AutoCraftingSettings & { operator_wallets: OperatorWallet })[]> {
  const { data, error } = await supabase
    .from('auto_crafting_settings')
    .select('*, operator_wallets(*)')
    .eq('is_enabled', true);

  if (error) {
    console.error('[Supabase] Error fetching active crafting settings:', error);
    return [];
  }
  // The join returns operator_wallets as a single object because of the FK relationship
  return data as any;
}

export async function updateCraftingLastRun(id: string): Promise<void> {
  await supabase
    .from('auto_crafting_settings')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', id);
}

export async function getSystemLogs(userId: string, limit: number = 50): Promise<SystemLog[]> {
  const { data, error } = await supabase
    .from('system_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// Watchlist Operations
export interface WatchlistItem {
  id: string;
  user_id: string;
  account_id: string;
  account_name?: string;
  kami_entity_id: string;
  kami_name?: string;
  created_at: string;
}

export async function addToWatchlist(userId: string, item: {
  accountId: string;
  accountName?: string;
  kamiEntityId: string;
  kamiName?: string;
}): Promise<WatchlistItem> {
  const { data, error } = await supabase
    .from('watchlists')
    .insert({
      user_id: userId,
      account_id: item.accountId,
      account_name: item.accountName,
      kami_entity_id: item.kamiEntityId,
      kami_name: item.kamiName
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function removeFromWatchlist(userId: string, kamiEntityId: string): Promise<void> {
  const { error } = await supabase
    .from('watchlists')
    .delete()
    .eq('user_id', userId)
    .eq('kami_entity_id', kamiEntityId);

  if (error) throw error;
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from('watchlists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export default supabase;
