import axios from 'axios';

// Determine API URL
// Use relative path '/api' by default to support both:
// 1. Dev mode (Vite proxy forwards /api -> backend)
// 2. Production (Express serves frontend & handles /api on same host/port)
// This ensures remote access (Tailscale/LAN) works without hardcoded localhost.
const API_URL = import.meta.env.VITE_API_URL || '/api';

const KAMI_IMAGE_BASE = import.meta.env.VITE_KAMI_IMAGE_BASE_URL || 'https://i.test.kamigotchi.io/kami';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes - account retrieval with many Kamis can be slow
});

export interface Stat {
  base: number;
  shift: number;
  boost: number;
  sync: number;
}

export interface KamiStats {
  health: Stat;
  power: Stat;
  harmony: Stat;
  violence: Stat;
}

export interface FinalStats {
  health: number;
  power: number;
  harmony: number;
  violence: number;
}

export interface KamiData {
  id: string;
  index: number;
  name: string;
  level: number;
  state: string;
  room: {
    index: number;
    name: string | null;
  };
  mediaURI: string;
  account: string;
  affinities: string[];
  stats: KamiStats;
  finalStats: FinalStats;
  traits: {
    face: { name: string; type: string } | null;
    hand: { name: string; type: string } | null;
    body: { name: string; type: string } | null;
    background: { name: string; type: string } | null;
    color: { name: string; type: string } | null;
  };
  skills?: {
    totalPointsUsed: number;
    skills: Array<{
      name: string;
      level: number;
    }>;
  };
}

export interface AccountData {
  id: string;
  address: string;
  name: string;
  roomIndex: number;
  kamis: KamiData[];
}

export interface HarvestStatus {
  kamiId: string;
  isHarvesting: boolean;
  harvestId: string;
}

export interface HarvestResult {
  success: boolean;
  txHash?: string;
  harvestId?: string;
  error?: string;
}

// Kami API
export const getKamiByIndex = async (index: number): Promise<KamiData> => {
  const response = await api.get(`/kami/index/${index}`);
  return response.data;
};

export const getKamiById = async (id: string): Promise<KamiData> => {
  const response = await api.get(`/kami/${id}`);
  return response.data;
};

export const getTotalKamis = async (): Promise<number> => {
  const response = await api.get('/kami/total');
  return response.data.total;
};

// Account API
export const getAccountByAddress = async (address: string): Promise<AccountData> => {
  const response = await api.get(`/account/address/${address}`);
  return response.data;
};

export const getAccountById = async (accountId: string): Promise<AccountData> => {
  const response = await api.get(`/account/${accountId}`);
  return response.data;
};

// Harvest API
export const getHarvestStatus = async (kamiId: string): Promise<HarvestStatus> => {
  const response = await api.get(`/harvest/status/${kamiId}`);
  return response.data;
};

export const startHarvest = async (kamiId: string, nodeIndex: number): Promise<HarvestResult> => {
  const response = await api.post('/harvest/start', { kamiId, nodeIndex });
  return response.data;
};

export const stopHarvest = async (kamiId: string): Promise<HarvestResult> => {
  const response = await api.post('/harvest/stop', { kamiId });
  return response.data;
};

export const collectHarvest = async (kamiId: string): Promise<HarvestResult> => {
  const response = await api.post('/harvest/collect', { kamiId });
  return response.data;
};

// Helper function to get Kami image URL
export const getKamiImageUrl = (mediaURI: string): string => {
  return `${KAMI_IMAGE_BASE}/${mediaURI}.gif`;
};

// Profile API
export interface Profile {
  id: string;
  name: string;
  accountId: string; // Keeping for display, but now calculated from address
  walletAddress: string;
  isActive: boolean;
  createdAt: string;
}

export const addProfile = async (privyUserId: string, name: string, walletAddress: string, privateKey: string): Promise<{ success: boolean; profile: Profile }> => {
  const response = await api.post('/profiles/add', { privyUserId, name, walletAddress, privateKey });
  return response.data;
};

export const getProfiles = async (privyUserId: string): Promise<{ profiles: Profile[] }> => {
  const response = await api.get('/profiles', { params: { privyUserId } });
  return response.data;
};

export const deleteProfile = async (profileId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/profiles/${profileId}`);
  return response.data;
};

// Kamigotchi API
export interface AutomationSettings {
  isCurrentlyHarvesting: boolean;
  harvestNodeIndex: number;
  harvestDuration: number;
  restDuration: number;
  autoRestartEnabled: boolean;
  autoCollectEnabled: boolean;
  autoHarvestEnabled: boolean;
  autoCraftEnabled?: boolean;
  craftingRecipeId?: number | null;
  craftingAmount?: number;
  craftingInterval?: number;
}

export interface KamigotchiData {
  id: string;
  entityId: string;
  index: number;
  name: string | null;
  level: number;
  state: string;
  room: {
    index: number | null;
    name: string | null;
  };
  mediaURI: string | null;
  affinities: string[];
  accountId: string;
  stats: KamiStats;
  currentHealth?: number; // Added optional currentHealth
  finalStats: FinalStats;
  traits: {
    face: { name: string; type: string } | null;
    hand: { name: string; type: string } | null;
    body: { name: string; type: string } | null;
    background: { name: string; type: string } | null;
    color: { name: string; type: string } | null;
  };
  automation: AutomationSettings;
  lastSynced: string;
}

export const refreshKamigotchis = async (privyUserId: string, operatorWalletId?: string): Promise<{ success: boolean; synced: number; errors?: string[] }> => {
  const response = await api.post('/kamigotchis/refresh', { privyUserId, operatorWalletId });
  return response.data;
};

export const getKamigotchis = async (privyUserId: string, operatorWalletId?: string): Promise<{ kamigotchis: KamigotchiData[] }> => {
  const params: any = { privyUserId };
  if (operatorWalletId && operatorWalletId !== 'default') {
    params.operatorWalletId = operatorWalletId;
  }
  const response = await api.get('/kamigotchis', { params });
  return response.data;
};

export const deleteKamigotchi = async (kamiId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/kamigotchis/${kamiId}`);
  return response.data;
};

export const updateAutomation = async (kamiId: string, settings: Partial<AutomationSettings>): Promise<{ success: boolean; automation: AutomationSettings }> => {
  const response = await api.patch(`/kamigotchis/${kamiId}/automation`, settings);
  return response.data;
};

export const startHarvestKamigotchi = async (kamiId: string, nodeIndex?: number): Promise<HarvestResult> => {
  const response = await api.post(`/kamigotchis/${kamiId}/harvest/start`, { nodeIndex });
  return response.data;
};

export const stopHarvestKamigotchi = async (kamiId: string): Promise<HarvestResult> => {
  const response = await api.post(`/kamigotchis/${kamiId}/harvest/stop`);
  return response.data;
};

export const toggleAutoHarvest = async (kamiId: string, enabled: boolean): Promise<{ success: boolean; autoHarvestEnabled: boolean }> => {
  const response = await api.post(`/kamigotchis/${kamiId}/harvest/auto`, { enabled });
  return response.data;
};

// System Logs API
export interface SystemLog {
  id: string;
  user_id: string;
  kami_profile_id: string | null;
  kami_index: number | null;
  action: string;
  status: 'success' | 'error' | 'info' | 'warning';
  message: string;
  metadata: any;
  created_at: string;
}

export const getSystemLogs = async (privyUserId: string, limit: number = 50): Promise<{ logs: SystemLog[] }> => {
  const response = await api.get('/system/logs', { params: { privyUserId, limit } });
  return response.data;
};

export const updateTelegramSettings = async (privyUserId: string, botToken: string, chatId: string): Promise<{ success: boolean }> => {
  const response = await api.post('/system/telegram', { privyUserId, botToken, chatId });
  return response.data;
};

export const sendTestTelegramMessage = async (privyUserId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await api.post('/system/telegram/test', { privyUserId });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
};

export interface UserSettings {
  id: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

export const getUserSettings = async (privyUserId: string): Promise<{ user: UserSettings }> => {
  const response = await api.get('/system/user', { params: { privyUserId } });
  return response.data;
};

export const getAccountStamina = async (accountId: string): Promise<number> => {
  const response = await api.get(`/account/${accountId}/stamina`);
  return response.data.stamina;
};

export default api;
