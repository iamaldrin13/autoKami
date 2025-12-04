import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Play, Square, Settings, Trash2, ChevronLeft, ChevronRight, RefreshCw, X, Save, Plus, Send, LogOut, Hammer } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { RECIPE_LIST } from '../assets/recipeList';
import { 
  refreshKamigotchis, 
  getProfiles, 
  getKamigotchis, 
  getSystemLogs,
  deleteKamigotchi,
  updateAutomation,
  type AutomationSettings,
  addProfile,
  updateTelegramSettings,
  getUserSettings,
  sendTestTelegramMessage,
  getAccountStamina
} from '../services/api';
import { NODE_LIST } from '../assets/nodeList';
import { getBackgroundList } from '../assets/backgrounds';

// Stat Icons
import HealthIcon from '../assets/stats/health.png';
import PowerIcon from '../assets/stats/power.png';
import HarmonyIcon from '../assets/stats/harmony.png';
import ViolenceIcon from '../assets/stats/violence.png';

// Affinity icon mapping
const affinityIcons: Record<string, string> = {
  'normal': 'https://app.kamigotchi.io/assets/normal-BZC5siAy.png',
  'insect': 'https://app.kamigotchi.io/assets/insect-Ban3zu3c.png',
  'eerie': 'https://app.kamigotchi.io/assets/eerie-CYLyxqN_.png',
  'scrap': 'https://app.kamigotchi.io/assets/scrap-Dk1BqVaa.png',
};

// Theme configurations
const THEMES = {
  arcade: {
    container: 'bg-gradient-to-br from-blue-600 to-blue-800 font-mono text-black',
    card: 'bg-white border-4 border-gray-800 rounded',
    button: 'border-4 border-gray-800 rounded font-bold',
    input: 'bg-gray-800 border-2 border-gray-600 rounded text-white focus:border-blue-500',
    modal: 'bg-gray-900 border-4 border-gray-700 rounded-lg text-white',
    header: 'bg-white rounded-lg shadow-lg border-4 border-gray-800',
    textAccent: 'text-blue-600',
    highlight: 'border-yellow-400 ring-4 ring-yellow-300',
  },
  pastel: {
    container: 'bg-purple-100 font-sans text-gray-700',
    card: 'bg-white rounded-2xl shadow-md border border-purple-200',
    button: 'rounded-xl font-semibold shadow-sm transition-transform active:scale-95',
    input: 'bg-purple-50 border border-purple-200 rounded-xl text-gray-700 focus:border-purple-400 focus:ring-2 focus:ring-purple-200',
    modal: 'bg-white rounded-3xl shadow-2xl text-gray-700',
    header: 'bg-white rounded-2xl shadow-sm border border-purple-100',
    textAccent: 'text-purple-500',
    highlight: 'ring-4 ring-purple-200 border-purple-400',
  },
  dark: {
    container: 'bg-gray-900 font-sans text-gray-200',
    card: 'bg-gray-800 rounded-lg border border-gray-700',
    button: 'rounded-lg font-medium transition-colors',
    input: 'bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-blue-500',
    modal: 'bg-gray-800 border border-gray-700 rounded-lg text-white',
    header: 'bg-gray-800 rounded-lg border border-gray-700',
    textAccent: 'text-blue-400',
    highlight: 'border-blue-500 ring-2 ring-blue-500/50',
  },
  frosted: {
    container: 'bg-cover bg-center bg-fixed font-sans text-gray-800 backdrop-blur-sm',
    card: 'bg-white/40 backdrop-blur-md border border-white/50 rounded-xl shadow-lg',
    button: 'rounded-xl backdrop-blur-sm border border-white/30 shadow-sm hover:bg-white/50',
    input: 'bg-white/50 border border-white/30 rounded-xl text-gray-800 placeholder-gray-500 focus:bg-white/70',
    modal: 'bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl text-gray-800',
    header: 'bg-white/40 backdrop-blur-md border border-white/50 rounded-xl shadow-sm',
    textAccent: 'text-indigo-600',
    highlight: 'ring-4 ring-white/50 border-white',
  }
} as const;

// Types
interface FinalStats {
  health: number;
  power: number;
  harmony: number;
  violence: number;
}

interface Kami {
  id: string;
  kami_index: number;
  name: string;
  level: number;
  mediaUri: string;
  running: boolean;
  entity_id: string;
  operator_wallet_id?: string;
  finalStats: FinalStats;
  currentHealth?: number;
  affinities: string[];
  automation: AutomationSettings;
  room: {
    index: number;
    name: string | null;
  };
}

interface SystemLog {
  id: string;
  time: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  kami_index?: number;
}

interface OperatorWallet {
  id: string;
  name: string;
  account_id: string;
}

// Memoized Character Card Component
const CharacterCard = memo(({ 
  char, 
  isSelected, 
  theme, 
  currentTheme,
  onClick 
}: { 
  char: Kami; 
  isSelected: boolean; 
  theme: any;
  currentTheme: string;
  onClick: () => void;
}) => {
  // Check if character is dead
  const isDead = char.currentHealth !== undefined && char.currentHealth !== null && char.currentHealth <= 0;
  const isAutomationActive = char.automation?.autoHarvestEnabled;
  
  // Build card classes
  let cardClasses = `aspect-[3/4] rounded cursor-pointer transition-all md:hover:scale-105 md:hover:z-10 relative overflow-hidden flex flex-col `;
  
  if (currentTheme === 'arcade') {
    cardClasses += 'border-2 sm:border-4 border-gray-700 bg-white ';
  } else {
    cardClasses += 'shadow-lg bg-white/80 backdrop-blur-sm border border-transparent ';
  }

  if (isDead) {
    cardClasses = `aspect-[3/4] rounded cursor-pointer transition-all md:hover:scale-105 md:hover:z-10 relative overflow-hidden flex flex-col bg-red-900/20 border-red-500 ring-1 ring-red-500 `;
  }

  if (isSelected) {
    cardClasses += `ring-inset ${theme.highlight} shadow-xl transform scale-[1.02] z-30 `;
  }

  return (
    <div onClick={onClick} className={cardClasses}>
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-0 left-0 bg-yellow-400 text-black text-[0.6rem] font-bold px-1.5 py-0.5 rounded-br z-30 border-b-2 border-r-2 border-yellow-600 shadow-sm">
          SELECTED
        </div>
      )}

      {/* Automation indicator */}
      {isAutomationActive && !isDead && (
        <div className="absolute inset-0 border-4 border-green-500 bg-green-400/10 z-20 pointer-events-none rounded">
          <div className="absolute top-0 right-0 bg-green-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-bl">
            AUTO
          </div>
        </div>
      )}

      <div className="flex-1 relative bg-gray-100/50 p-0.5 sm:p-1">
        <img 
          src={`https://i.test.kamigotchi.io/kami/${char.mediaUri}.gif`}
          alt={char.name}
          className="w-full h-full object-contain pixelated"
          style={{ imageRendering: 'pixelated' }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
          }}
        />
        
        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[0.5rem] sm:text-[0.6rem] text-center font-bold truncate p-0.5 backdrop-blur-[2px]">
          {char.name}
        </div>
      </div>
    </div>
  );
});

CharacterCard.displayName = 'CharacterCard';

// Memoized Character Details Component
const CharacterDetails = memo(({ char, theme }: { 
  char: Kami; 
  theme: any;
}) => (
  <>
    {/* Character sprite */}
    <div className={`${theme.card} p-6 mb-4 relative`}>
      <img 
        src={`https://i.test.kamigotchi.io/kami/${char.mediaUri}.gif`}
        alt={char.name}
        className="w-full h-40 object-contain pixelated mx-auto"
        style={{ imageRendering: 'pixelated' }}
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E?%3C/text%3E%3C/svg%3E';
        }}
      />
      
      {/* Name overlay */}
      <div className="absolute top-2 left-2 right-2 text-center">
        <span className="bg-black/60 text-white px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm shadow-sm inline-block truncate max-w-full border border-white/20">
          {char.name}
        </span>
      </div>

      {/* Level badge */}
      <div className="absolute bottom-2 left-2">
        <span className="bg-black/60 text-yellow-400 px-2 py-1 rounded text-xs font-bold backdrop-blur-sm shadow-sm border border-white/20">
          Lv.{char.level}
        </span>
      </div>

      {/* Affinity icons */}
      <div className="absolute bottom-2 right-2 flex flex-row gap-1 z-10">
        {char.affinities.map((aff, i) => (
          affinityIcons[aff.toLowerCase()] && (
            <img 
              key={`${aff}-${i}`} 
              src={affinityIcons[aff.toLowerCase()]}
              alt={aff} 
              className="w-6 h-6 drop-shadow-md" 
              title={aff} 
            />
          )
        ))}
      </div>
    </div>

    {/* Stats display */}
    <div className={`${theme.card} p-3 space-y-2 mb-4`}>
      <StatRow icon={HealthIcon} label="HEALTH" value={char.finalStats.health} />
      <StatRow icon={PowerIcon} label="POWER" value={char.finalStats.power} />
      <StatRow icon={ViolenceIcon} label="VIOLENCE" value={char.finalStats.violence} />
      <StatRow icon={HarmonyIcon} label="HARMONY" value={char.finalStats.harmony} />
    </div>

    {/* Status indicator */}
    <div className={`mb-4 p-3 ${theme.card} text-center`}>
      <div className="font-bold mb-1">Status</div>
      <div className={`font-bold ${char.running ? 'text-green-500' : 'text-gray-500'}`}>
        {char.running ? '● Running' : '○ Stopped'}
      </div>
    </div>
  </>
));

CharacterDetails.displayName = 'CharacterDetails';

// Stat row component
const StatRow = memo(({ icon, label, value }: { icon: string; label: string; value: number }) => (
  <div className="flex justify-between items-center">
    <div className="flex items-center gap-2">
      <img src={icon} alt={label} className="w-4 h-4" />
      <span className="font-bold">{label}:</span>
    </div>
    <span>{value}</span>
  </div>
));

StatRow.displayName = 'StatRow';

const CharacterManagerPWA = () => {
  const { user, authenticated, logout } = usePrivy();
  const [profiles, setProfiles] = useState<OperatorWallet[]>([]);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [selectedChar, setSelectedChar] = useState<Kami | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [characters, setCharacters] = useState<Kami[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isCraftingModalOpen, setIsCraftingModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [configKami, setConfigKami] = useState<Kami | null>(null);
  const [harvestCalc, setHarvestCalc] = useState<any>(null);
  
  // Settings State
  const [currentTheme, setCurrentTheme] = useState<keyof typeof THEMES>('arcade');
  const [currentBackground, setCurrentBackground] = useState<string | null>(null);
  const [backgroundList, setBackgroundList] = useState<{id: string, name: string, url: string}[]>([]);
  
  // Form State
  const [newProfile, setNewProfile] = useState({ name: '', address: '', privateKey: '' });
  const [telegramConfig, setTelegramConfig] = useState({ botToken: '', chatId: '' });
  const [craftingProfileStamina, setCraftingProfileStamina] = useState<number | null>(null);

  // Fetch stamina when crafting modal opens
  useEffect(() => {
    if (isCraftingModalOpen && configKami) {
      const profile = profiles.find(p => p.id === configKami.operator_wallet_id);
      if (profile?.account_id) {
        setCraftingProfileStamina(null); // Reset while fetching
        getAccountStamina(profile.account_id)
          .then(s => setCraftingProfileStamina(s))
          .catch(err => console.error('Failed to fetch stamina', err));
      } else {
        setCraftingProfileStamina(null);
      }
    }
  }, [isCraftingModalOpen, configKami, profiles]);

  // Load backgrounds on mount
  useEffect(() => {
    const bgs = getBackgroundList();
    setBackgroundList(bgs);
  }, []);

  // Update user display and load settings
  useEffect(() => {
    if (authenticated && user) {
      
      getUserSettings(user.id).then(({ user: settings }) => {
        if (settings) {
          setTelegramConfig({
            botToken: settings.telegram_bot_token || '',
            chatId: settings.telegram_chat_id || ''
          });
          
          const savedTheme = localStorage.getItem('kami_theme') as keyof typeof THEMES;
          if (savedTheme && THEMES[savedTheme]) setCurrentTheme(savedTheme);
          
          const savedBg = localStorage.getItem('kami_bg');
          if (savedBg) setCurrentBackground(savedBg);
        }
      }).catch(err => console.error('Failed to load user settings', err));
    }
  }, [authenticated, user]);

  // Fetch operator wallet profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      if (!authenticated || !user) return;

      try {
        const data = await getProfiles(user.id);
        const wallets = data.profiles.map(p => ({
          id: p.id,
          name: p.name,
          account_id: p.accountId
        }));

        if (wallets && wallets.length > 0) {
          setProfiles(wallets);
        } else {
          setProfiles([{ id: 'default', name: 'Main Profile', account_id: 'default' }]);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
        setProfiles([{ id: 'default', name: 'Main Profile', account_id: 'default' }]);
      }
    };

    fetchProfiles();
  }, [authenticated, user, refreshKey, isSettingsModalOpen]);

  // Fetch kamigotchis and system logs
  useEffect(() => {
    const fetchData = async () => {
      if (!authenticated || !user || profiles.length === 0) return;
      
      setLoading(true);
      try {
        const currentProfile = profiles[currentProfileIndex];
        
        const { kamigotchis } = await getKamigotchis(user.id, currentProfile.id);
        
        const mappedCharacters: Kami[] = kamigotchis
          .map((k: any) => ({
            id: k.id,
            kami_index: k.index,
            name: k.name || `Kami #${k.index}`,
            level: k.level,
            mediaUri: k.mediaURI || k.index.toString(),
            running: k.automation?.autoHarvestEnabled || false,
            entity_id: k.entityId,
            operator_wallet_id: k.operator_wallet_id,
            finalStats: k.finalStats || { health: 0, power: 0, harmony: 0, violence: 0 },
            currentHealth: k.currentHealth,
            affinities: k.affinities || [],
            automation: k.automation,
            room: k.room || { index: 0, name: 'Unknown' }
          }));

        setCharacters(mappedCharacters);
        
        if (selectedChar) {
          const updatedSelected = mappedCharacters.find(c => c.id === selectedChar.id);
          if (updatedSelected) setSelectedChar(updatedSelected);
        }

        const { logs } = await getSystemLogs(user.id);
        setSystemLogs(logs.map((log: any) => ({
          id: log.id,
          time: new Date(log.created_at).toLocaleTimeString('en-US', { hour12: false }),
          message: log.kami_index !== undefined ? `[Kami #${log.kami_index}] ${log.message}` : log.message,
          type: (log.status === 'error' ? 'error' : 'success') as 'error' | 'success',
          kami_index: log.kami_index
        })));

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authenticated, user, profiles, currentProfileIndex, refreshKey]);

  // Add log entry
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    setSystemLogs(prev => [{ id: Math.random().toString(), time, message, type }, ...prev.slice(0, 49)]);
  }, []);

  // Refresh kamigotchis from blockchain
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    const currentProfile = profiles[currentProfileIndex];
    if (!currentProfile || currentProfile.id === 'default') {
      addLog('Cannot refresh default profile. Please add an Operator Wallet.', 'warning');
      return;
    }

    setIsRefreshing(true);
    addLog(`Refreshing Kamigotchis for ${currentProfile.name}...`, 'info');
    try {
      const result = await refreshKamigotchis(user.id, currentProfile.id);
      if (result.success) {
        addLog(`Refresh complete. Synced ${result.synced} Kamigotchis.`, 'success');
        setRefreshKey(prev => prev + 1);
      } else {
        addLog('Refresh failed. Check backend logs.', 'error');
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      addLog(`Refresh error: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, profiles, currentProfileIndex, addLog]);

  // Toggle automation on/off
  const toggleAutomation = useCallback(async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const originalState = char.running;
    const newState = !char.running;
    
    setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: newState } : c));
    addLog(`Character "${char.name}" automation ${newState ? 'starting...' : 'stopping...'}`, 'info');

    try {
      // Toggle automation setting
      const { success } = await updateAutomation(char.id, { autoHarvestEnabled: newState });
      
      if (success) {
        addLog(`Character "${char.name}" automation ${newState ? 'started' : 'stopped'}`, 'success');
      } else {
        throw new Error('Backend returned failure');
      }

    } catch (err: any) {
      console.error('Failed to toggle automation', err);
      setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: originalState } : c));
      addLog(`Failed to toggle automation: ${err.message}`, 'error');
    }
  }, [characters, addLog]);

  // Delete kamigotchi
  const deleteCharacter = useCallback(async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    if (confirm(`Are you sure you want to delete ${char.name}?`)) {
      try {
        await deleteKamigotchi(char.id);
        setCharacters(chars => chars.filter(char => char.id !== charId));
        if (selectedChar?.id === charId) setSelectedChar(null);
        addLog(`Character "${char.name}" deleted`, 'warning');
      } catch (err: any) {
        console.error('Failed to delete character', err);
        addLog(`Failed to delete character: ${err.message}`, 'error');
      }
    }
  }, [characters, selectedChar, addLog]);

  // Open config modal
  const openConfigModal = useCallback(() => {
    if (selectedChar) {
      setConfigKami(selectedChar);
      setHarvestCalc(null); // Reset calculations
      setIsConfigModalOpen(true);
    }
  }, [selectedChar]);

  // Calculate harvest stats
  const calculateHarvestStats = useCallback(() => {
    if (!configKami) return;

    const nodeIndex = configKami.automation?.harvestNodeIndex ?? configKami.room.index ?? 0;
    const nodeType = NODE_LIST.find(n => n.id === nodeIndex)?.affinity?.toLowerCase() || 'normal';
    const harvestDuration = configKami.automation?.harvestDuration || 60;
    const restDuration = configKami.automation?.restDuration || 30;

    // Get affinities
    const bodyType = configKami.affinities[0]?.toLowerCase() || 'normal';
    const handType = configKami.affinities[1]?.toLowerCase() || 'normal';

    // Get skill bonuses from finalStats (assume they're included)
    const power = configKami.finalStats.power;
    const harmony = configKami.finalStats.harmony;
    const violence = configKami.finalStats.violence;
    const health = configKami.finalStats.health;

    // Skill multipliers - these would come from the backend finalStats
    const fertilityBoost = 0; // Default, could fetch from backend
    const bountyBoost = 0.20; // Default assumption
    const intensityBoost = 25; // Default assumption
    const strainDecrease = 0.125; // Default assumption
    const metabolismBoost = 0.25; // Default assumption

    // Calculate affinity bonus
    let affinityBonus = 1;

    // Body calculations
    if (bodyType === 'normal') {
      affinityBonus += 0;
    } else if (bodyType === nodeType) {
      affinityBonus += 0.65 + fertilityBoost;
    } else {
      affinityBonus -= 0.25;
    }

    // Hand calculations
    if (handType === 'normal') {
      affinityBonus += 0;
    } else if (handType === nodeType) {
      affinityBonus += 0.35 + fertilityBoost;
    } else {
      affinityBonus -= 0.10;
    }

    // Harvest fertility
    const harvestFertility = affinityBonus * 1.5 * power;

    // Intensity at different times
    const intensityStart = ((10 + intensityBoost) / 480) * ((5 * violence) + 0);
    const intensity1Hour = ((10 + intensityBoost) / 480) * ((5 * violence) + 60);
    const intensityAtDuration = ((10 + intensityBoost) / 480) * ((5 * violence) + harvestDuration);

    // MUSU per hour
    const musuPerHourStart = (1 + bountyBoost) * (harvestFertility + intensityStart);
    const musuPerHour1Hour = (1 + bountyBoost) * (harvestFertility + intensity1Hour);
    const musuPerHourAtDuration = (1 + bountyBoost) * (harvestFertility + intensityAtDuration);

    // Strain (HP loss per hour)
    const strainStart = (6.5 * (1 - strainDecrease) * musuPerHourStart) / (harmony + 20);
    const strain1Hour = (6.5 * (1 - strainDecrease) * musuPerHour1Hour) / (harmony + 20);
    const strainAtDuration = (6.5 * (1 - strainDecrease) * musuPerHourAtDuration) / (harmony + 20);

    // Recovery
    const recovery = 1.2 * harmony * (1 + metabolismBoost);

    // Cycle calculations
    const avgStrain = (strainStart + strainAtDuration) / 2;
    const totalStrainPerCycle = avgStrain * (harvestDuration / 60);
    const totalRecoveryPerCycle = recovery * (restDuration / 60);
    const netHpPerCycle = totalRecoveryPerCycle - totalStrainPerCycle;
    const cycleDuration = harvestDuration + restDuration;
    const cyclesUntilDeath = health / Math.abs(totalStrainPerCycle - totalRecoveryPerCycle);

    setHarvestCalc({
      nodeType,
      bodyType,
      handType,
      affinityBonus,
      harvestFertility,
      intensityStart,
      intensity1Hour,
      intensityAtDuration,
      musuPerHourStart,
      musuPerHour1Hour,
      musuPerHourAtDuration,
      strainStart,
      strain1Hour,
      strainAtDuration,
      recovery,
      avgStrain,
      totalStrainPerCycle,
      totalRecoveryPerCycle,
      netHpPerCycle,
      cycleDuration,
      cyclesUntilDeath,
      isSustainable: netHpPerCycle >= 0,
      harvestDuration,
      restDuration
    });
  }, [configKami]);

  // Open crafting modal
  const openCraftingModal = useCallback(() => {
    if (selectedChar) {
      setConfigKami(selectedChar);
      setIsCraftingModalOpen(true);
    }
  }, [selectedChar]);

  // Save config changes
  const handleSaveConfig = useCallback(async (settings: Partial<AutomationSettings>) => {
    if (!configKami) return;

    try {
      const { success } = await updateAutomation(configKami.id, settings);
      if (success) {
        const profile = profiles.find(p => p.id === configKami.operator_wallet_id);
        const profileName = profile?.name || 'Unknown Profile';
        
        let staminaMsg = 'Unknown';
        if (profile?.account_id) {
            try {
                const stamina = await getAccountStamina(profile.account_id);
                staminaMsg = stamina.toString();
            } catch (e) {
                console.error('Failed to fetch stamina for log', e);
            }
        }

        addLog(`Auto craft settings updated for ${profileName}. Current Stamina: ${staminaMsg}`, 'success');
        
        setCharacters(chars => chars.map(c => 
          c.id === configKami.id ? { ...c, automation: { ...c.automation, ...settings } } : c
        ));
        if (selectedChar?.id === configKami.id) {
          setSelectedChar(prev => prev ? { ...prev, automation: { ...prev.automation, ...settings } } : null);
        }
        setIsConfigModalOpen(false);
        setIsCraftingModalOpen(false);
      } else {
        addLog('Failed to update configuration', 'error');
      }
    } catch (error: any) {
      console.error('Update config error:', error);
      addLog(`Update config error: ${error.message}`, 'error');
    }
  }, [configKami, selectedChar, addLog]);

  // Switch between profiles
  const switchProfile = useCallback((direction: number) => {
    const newIndex = (currentProfileIndex + direction + profiles.length) % profiles.length;
    setCurrentProfileIndex(newIndex);
    addLog(`Profile switched to ${profiles[newIndex]?.name || 'Unknown'}`, 'info');
  }, [currentProfileIndex, profiles, addLog]);

  // Save new operator profile
  const handleSaveProfile = useCallback(async () => {
    if (!user?.id || !newProfile.name || !newProfile.privateKey) return;
    
    if (!newProfile.privateKey.startsWith('0x') && newProfile.privateKey.length !== 64 && newProfile.privateKey.length !== 66) {
      alert('Invalid private key format');
      return;
    }

    try {
      const { success, profile } = await addProfile(user.id, newProfile.name, newProfile.address, newProfile.privateKey);
      if (success) {
        addLog(`Profile "${profile.name}" added successfully`, 'success');
        setNewProfile({ name: '', address: '', privateKey: '' });
        setRefreshKey(prev => prev + 1);
      } else {
        addLog('Failed to add profile', 'error');
      }
    } catch (error: any) {
      console.error('Add profile error:', error);
      addLog(`Add profile error: ${error.message}`, 'error');
    }
  }, [user?.id, newProfile, addLog]);

  // Save telegram settings
  const handleSaveTelegram = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { success } = await updateTelegramSettings(user.id, telegramConfig.botToken, telegramConfig.chatId);
      if (success) {
        addLog('Telegram settings saved', 'success');
      } else {
        addLog('Failed to save Telegram settings', 'error');
      }
    } catch (error: any) {
      console.error('Telegram settings error:', error);
      addLog(`Telegram settings error: ${error.message}`, 'error');
    }
  }, [user?.id, telegramConfig, addLog]);

  // Test telegram notification
  const handleTestTelegram = useCallback(async () => {
    if (!user?.id) return;
    addLog('Sending test message...', 'info');
    try {
      const { success, error } = await sendTestTelegramMessage(user.id);
      if (success) {
        addLog('Test message sent successfully!', 'success');
      } else {
        addLog(`Failed to send test message: ${error}`, 'error');
      }
    } catch (error: any) {
      addLog(`Test message error: ${error.message}`, 'error');
    }
  }, [user?.id, addLog]);

  // Change theme
  const handleThemeChange = useCallback((theme: keyof typeof THEMES) => {
    setCurrentTheme(theme);
    localStorage.setItem('kami_theme', theme);
  }, []);

  // Change background
  const handleBackgroundChange = useCallback((url: string) => {
    setCurrentBackground(url);
    localStorage.setItem('kami_bg', url);
  }, []);

  // Get current theme config
  const theme = useMemo(() => THEMES[currentTheme], [currentTheme]);

  // Get current profile
  const currentProfile = useMemo(() => profiles[currentProfileIndex], [profiles, currentProfileIndex]);

  return (
    <div 
      className={`h-screen flex flex-col overflow-hidden p-1 sm:p-2 transition-all duration-500 ${theme.container}`}
      style={currentTheme === 'frosted' && currentBackground ? { backgroundImage: `url(${currentBackground})` } : {}}
    >
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
          {/* Left Panel - Character Display (Desktop Only) */}
          <div className="hidden lg:block lg:w-64 flex-shrink-0 h-full overflow-y-auto scrollbar-hide">
            <div className={`${theme.card} overflow-hidden h-full`}>
              <div className="p-4 h-full overflow-y-auto">
                {selectedChar ? (
                  <CharacterDetails 
                    char={selectedChar} 
                    theme={theme} 
                  />
                ) : (
                  <div className="p-8 text-center opacity-50 h-full flex flex-col justify-center">
                    <p className="text-lg font-bold mb-2">No Character</p>
                    <p className="text-sm">Select a character to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center/Right - Character Box and Logs */}
          <div className="flex-1 flex flex-col gap-2 min-h-0 min-w-0">
            {/* Character Box */}
            <div className={`${theme.card} flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden ${currentTheme === 'frosted' ? 'bg-opacity-30' : 'bg-blue-400'}`}>
              {/* Box Header with Profile Switcher */}
              <div className={`${currentTheme === 'frosted' ? 'bg-white/20' : 'bg-green-400'} p-2 flex items-center justify-between border-b-4 border-gray-800/20 flex-shrink-0`}>
                <button 
                  onClick={() => switchProfile(-1)}
                  className="bg-gray-800 text-white p-1.5 rounded hover:bg-gray-700"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className={`font-bold text-base sm:text-xl px-2 sm:px-4 py-1 rounded border-2 truncate max-w-[150px] sm:max-w-none text-center ${currentTheme === 'frosted' ? 'bg-white/50 border-white/50' : 'bg-white border-gray-800'}`}>
                  {currentProfile?.name || 'Loading...'}
                </span>
                <button 
                  onClick={() => switchProfile(1)}
                  className="bg-gray-800 text-white p-1.5 rounded hover:bg-gray-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Character Grid */}
              <div className={`flex-1 p-2 sm:p-4 overflow-y-auto overflow-x-hidden grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3 auto-rows-min ${currentTheme === 'frosted' ? 'bg-transparent' : 'bg-green-300'}`}>
                {loading ? (
                  <div className="col-span-full text-center p-4 font-bold">Loading Kamis...</div>
                ) : characters.length === 0 ? (
                  <div className="col-span-full text-center p-4 font-bold">No Kamis Found</div>
                ) : (
                  characters.map(char => (
                    <CharacterCard
                      key={char.id}
                      char={char}
                      isSelected={selectedChar?.id === char.id}
                      theme={theme}
                      currentTheme={currentTheme}
                      onClick={() => {
                        setSelectedChar(char);
                        // Mobile modal removed as requested
                        // if (window.innerWidth < 1024) { setIsMobileDetailsOpen(true); }
                      }}
                    />
                  ))
                )}
              </div>

              {/* Action Buttons */}
              <div className={`${currentTheme === 'frosted' ? 'bg-white/20' : 'bg-gray-300'} p-3 flex gap-2 border-t-4 border-gray-800/20 flex-shrink-0 overflow-x-auto`}>
                {/* Start/Stop Button */}
                <button
                  disabled={!selectedChar}
                  onClick={() => selectedChar && toggleAutomation(selectedChar.id)}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} text-white
                    ${selectedChar?.running
                      ? 'bg-red-500 hover:bg-red-600 border-red-700'
                      : 'bg-green-500 hover:bg-green-600 border-green-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:border-gray-500
                  `}
                >
                  {selectedChar?.running ? <Square className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5" fill="white" />}
                  <span className="hidden sm:inline">{selectedChar?.running ? 'STOP' : 'START'}</span>
                </button>

                <button
                  disabled={!selectedChar}
                  onClick={openConfigModal}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-gray-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Settings className="w-5 h-5" />
                  <span className="hidden sm:inline">CONFIG</span>
                </button>
                <button
                  onClick={openCraftingModal}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-yellow-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Hammer className="w-5 h-5" />
                  <span className="hidden sm:inline">CRAFTING</span>
                </button>
                <button
                  disabled={isRefreshing}
                  onClick={handleRefresh}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-blue-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isRefreshing ? 'SYNCING...' : 'REFRESH'}</span>
                </button>
                <button
                  disabled={!selectedChar}
                  onClick={() => selectedChar && deleteCharacter(selectedChar.id)}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-red-100' : 'bg-white/80 hover:bg-red-50'} text-red-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Trash2 className="w-5 h-5" />
                  <span className="hidden sm:inline">DELETE</span>
                </button>
              </div>
            </div>

            {/* System Logs */}
            <div className={`${theme.card} overflow-hidden flex-shrink-0 h-48 flex flex-col`}>
              <div className={`${currentTheme === 'frosted' ? 'bg-black/40 text-white' : 'bg-gray-700 text-white'} p-3 border-b-4 border-gray-800/20 flex-shrink-0`}>
                <span className="font-bold text-lg">SYSTEM LOGS</span>
              </div>
              <div className="p-4 flex-1 overflow-y-auto bg-gray-900/90 text-gray-300">
                <div className="space-y-2 font-mono text-sm">
                  {systemLogs.map((log) => (
                    <div 
                      key={log.id}
                      className={`flex gap-3 ${
                        log.type === 'success' ? 'text-green-400' :
                        log.type === 'warning' ? 'text-yellow-400' :
                        log.type === 'error' ? 'text-red-400' :
                        'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">[{log.time}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Character Details Modal Removed */}
      
      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono">
          <div className={`${theme.modal} w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto`}>
            {/* Header */}
            <div className="p-4 border-b-4 border-gray-700 flex justify-between items-center bg-gray-800 sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6" />
                SETTINGS
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-8">
              {/* Profile Group */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-green-400 border-b border-gray-700 pb-2">OPERATOR PROFILES</h3>
                <div className="grid gap-4 p-4 bg-black/20 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold mb-1 text-gray-400">Profile Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Main Team"
                        className={`${theme.input} w-full p-2`}
                        value={newProfile.name}
                        onChange={(e) => setNewProfile({...newProfile, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold mb-1 text-gray-400">Wallet Address</label>
                      <input 
                        type="text" 
                        placeholder="0x..."
                        className={`${theme.input} w-full p-2`}
                        value={newProfile.address}
                        onChange={(e) => setNewProfile({...newProfile, address: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-400">Private Key (Encrypted)</label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        placeholder="0x... (stored securely)"
                        className={`${theme.input} flex-1 p-2`}
                        value={newProfile.privateKey}
                        onChange={(e) => setNewProfile({...newProfile, privateKey: e.target.value})}
                      />
                      <button 
                        onClick={handleSaveProfile}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        ADD
                      </button>
                    </div>
                  </div>
                  
                  {/* List existing profiles */}
                  <div className="mt-2 space-y-2">
                    {profiles.filter(p => p.id !== 'default').map(p => (
                      <div key={p.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{p.account_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Telegram Group */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-blue-400 border-b border-gray-700 pb-2">NOTIFICATIONS</h3>
                <div className="grid gap-4 p-4 bg-black/20 rounded-lg">
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-400">Telegram Bot Token</label>
                    <input 
                      type="password" 
                      placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      className={`${theme.input} w-full p-2`}
                      value={telegramConfig.botToken}
                      onChange={(e) => setTelegramConfig({...telegramConfig, botToken: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1 text-gray-400">Chat ID</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="123456789"
                        className={`${theme.input} flex-1 p-2`}
                        value={telegramConfig.chatId}
                        onChange={(e) => setTelegramConfig({...telegramConfig, chatId: e.target.value})}
                      />
                      <button 
                        onClick={handleTestTelegram}
                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                        title="Send Test Message"
                      >
                        <Send className="w-4 h-4" />
                        TEST
                      </button>
                      <button 
                        onClick={handleSaveTelegram}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded font-bold"
                      >
                        SAVE
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Appearance Group */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-purple-400 border-b border-gray-700 pb-2">APPEARANCE</h3>
                <div className="grid gap-6 p-4 bg-black/20 rounded-lg">
                  {/* Theme Selector */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-400">Theme</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleThemeChange(t)}
                          className={`px-4 py-2 rounded capitalize font-bold border-2 ${currentTheme === t ? 'border-purple-500 bg-purple-500/20 text-purple-300' : 'border-gray-600 text-gray-400 hover:border-gray-400'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Selector */}
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-400">Background Image (Frosted Theme)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-black/40 rounded">
                      {backgroundList.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => handleBackgroundChange(bg.url)}
                          className={`relative aspect-video rounded overflow-hidden border-2 transition-all ${currentBackground === bg.url ? 'border-green-500 ring-2 ring-green-500/50' : 'border-transparent hover:border-gray-400'}`}
                        >
                          <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[0.6rem] text-white p-1 truncate">
                            {bg.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Account Group */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-red-400 border-b border-gray-700 pb-2">ACCOUNT</h3>
                <div className="grid gap-4 p-4 bg-black/20 rounded-lg">
                  <div className="text-xs font-mono text-gray-500 break-all bg-black/20 p-2 rounded">
                    <div className="font-bold text-gray-400 mb-1">USER DID:</div>
                    {user?.id || 'Unknown'}
                  </div>
                  <button 
                    onClick={logout}
                    className="w-full bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                  >
                    <LogOut className="w-5 h-5" />
                    LOGOUT
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {isConfigModalOpen && configKami && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono overflow-y-auto">
          <div className={`${theme.modal} w-full max-w-md text-white overflow-hidden shadow-2xl my-8`}>
            {/* Header */}
            <div className="bg-gray-800 p-4 border-b-4 border-gray-700 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-yellow-400">{configKami.name}</h2>
                <div className="text-sm text-gray-400 mt-1">
                  Level {configKami.level} • Room {configKami.room.index}
                </div>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Node Selection */}
              <div>
                <label className="block text-sm font-bold text-green-400 mb-2 uppercase">Harvest Node</label>
                <div className="mb-2 text-xs text-gray-400">
                  Current: #{configKami.room.index} - {NODE_LIST.find(n => n.id === configKami.room.index)?.name || 'Unknown'}
                </div>
                <select 
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-green-500 outline-none"
                  defaultValue={configKami.automation?.harvestNodeIndex || configKami.room.index || 0}
                  onChange={(e) => setConfigKami({
                    ...configKami,
                    automation: { ...configKami.automation, harvestNodeIndex: parseInt(e.target.value) }
                  })}
                >
                  {NODE_LIST.map(node => (
                    <option key={node.id} value={node.id}>
                      #{node.id} - {node.name} ({node.affinity})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-500 mt-1">Select target node for harvesting</div>
              </div>

              {/* Durations */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-blue-400 mb-2 uppercase">Harvest Duration</label>
                  <input 
                    type="number" 
                    className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                    defaultValue={configKami.automation?.harvestDuration || 60}
                    onChange={(e) => setConfigKami({
                      ...configKami,
                      automation: { ...configKami.automation, harvestDuration: parseInt(e.target.value) }
                    })}
                  />
                  <div className="text-xs text-gray-500 mt-1">(MINS)</div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-400 mb-2 uppercase">Rest Duration</label>
                  <input 
                    type="number" 
                    className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-purple-500 outline-none"
                    defaultValue={configKami.automation?.restDuration || 30}
                    onChange={(e) => setConfigKami({
                      ...configKami,
                      automation: { ...configKami.automation, restDuration: parseInt(e.target.value) }
                    })}
                  />
                  <div className="text-xs text-gray-500 mt-1">(MINS)</div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={configKami.automation?.autoCollectEnabled || false}
                      onChange={(e) => setConfigKami({
                        ...configKami,
                        automation: { ...configKami.automation, autoCollectEnabled: e.target.checked }
                      })}
                    />
                    <div className="w-10 h-6 bg-gray-700 rounded-full border-2 border-gray-600 peer-checked:bg-green-500 peer-checked:border-green-400 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4"></div>
                  </div>
                  <div>
                    <span className="block font-bold text-white group-hover:text-green-400 transition-colors">Auto-collect</span>
                    <span className="text-xs text-gray-500">Stop harvest when timer ends</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only"
                      checked={configKami.automation?.autoRestartEnabled || false}
                      onChange={(e) => setConfigKami({
                        ...configKami,
                        automation: { ...configKami.automation, autoRestartEnabled: e.target.checked }
                      })}
                    />
                    <div className="w-10 h-6 bg-gray-700 rounded-full border-2 border-gray-600 peer-checked:bg-blue-500 peer-checked:border-blue-400 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4"></div>
                  </div>
                  <div>
                    <span className="block font-bold text-white group-hover:text-blue-400 transition-colors">Auto-restart</span>
                    <span className="text-xs text-gray-500">Start harvest when rest ends</span>
                  </div>
                </label>
              </div>

              {/* Compute Button */}
              <div className="pt-4 border-t border-gray-700">
                <button
                  onClick={calculateHarvestStats}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  COMPUTE HARVEST STATS
                </button>
              </div>

              {/* Calculation Results */}
              {harvestCalc && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded border border-gray-700 space-y-3 text-sm">
                  <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                    <span className="font-bold text-yellow-400">📊 HARVEST ANALYSIS</span>
                    <span className="text-xs text-gray-500">
                      {configKami.affinities.join('/')} on {harvestCalc.nodeType.toUpperCase()}
                    </span>
                  </div>

                  {/* Affinity */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Affinity Bonus:</span>
                      <span className={`ml-2 font-bold ${harvestCalc.affinityBonus > 1.5 ? 'text-green-400' : harvestCalc.affinityBonus < 1 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {harvestCalc.affinityBonus.toFixed(2)}x
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Harvest Fertility:</span>
                      <span className="ml-2 font-bold text-white">{harvestCalc.harvestFertility.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* MUSU Earnings */}
                  <div className="bg-green-900/30 p-2 rounded">
                    <div className="text-xs text-green-400 font-bold mb-1">💰 MUSU PER HOUR</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Start</div>
                        <div className="font-bold text-green-300">{harvestCalc.musuPerHourStart.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">@1hr</div>
                        <div className="font-bold text-green-300">{harvestCalc.musuPerHour1Hour.toFixed(1)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">@{harvestCalc.harvestDuration}m</div>
                        <div className="font-bold text-green-300">{harvestCalc.musuPerHourAtDuration.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Strain */}
                  <div className="bg-red-900/30 p-2 rounded">
                    <div className="text-xs text-red-400 font-bold mb-1">💔 STRAIN (HP Loss/hr)</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Start</div>
                        <div className="font-bold text-red-300">{harvestCalc.strainStart.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">@1hr</div>
                        <div className="font-bold text-red-300">{harvestCalc.strain1Hour.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Avg</div>
                        <div className="font-bold text-red-300">{harvestCalc.avgStrain.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Recovery & Cycle */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Recovery/hr:</span>
                      <span className="ml-2 font-bold text-blue-300">{harvestCalc.recovery.toFixed(2)} HP</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Cycle Time:</span>
                      <span className="ml-2 font-bold text-white">{harvestCalc.cycleDuration}m</span>
                    </div>
                  </div>

                  {/* Per Cycle Stats */}
                  <div className="bg-purple-900/30 p-2 rounded">
                    <div className="text-xs text-purple-400 font-bold mb-1">🔄 PER CYCLE ({harvestCalc.harvestDuration}m harvest + {harvestCalc.restDuration}m rest)</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-400">Strain</div>
                        <div className="font-bold text-red-300">-{harvestCalc.totalStrainPerCycle.toFixed(1)} HP</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Recovery</div>
                        <div className="font-bold text-blue-300">+{harvestCalc.totalRecoveryPerCycle.toFixed(1)} HP</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-purple-800">
                      <div className="text-gray-400">Net HP/Cycle:</div>
                      <div className={`font-bold text-lg ${harvestCalc.netHpPerCycle >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {harvestCalc.netHpPerCycle >= 0 ? '+' : ''}{harvestCalc.netHpPerCycle.toFixed(1)} HP
                      </div>
                    </div>
                  </div>

                  {/* Sustainability */}
                  <div className={`p-3 rounded border-2 ${harvestCalc.isSustainable ? 'bg-green-900/30 border-green-500' : 'bg-red-900/30 border-red-500'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        {harvestCalc.isSustainable ? '✅ SUSTAINABLE' : '⚠️ NOT SUSTAINABLE'}
                      </span>
                      {!harvestCalc.isSustainable && (
                        <span className="text-xs text-red-300">
                          ~{harvestCalc.cyclesUntilDeath.toFixed(1)} cycles until death
                        </span>
                      )}
                    </div>
                    {harvestCalc.isSustainable && (
                      <div className="text-xs text-green-300 mt-1">
                        Can harvest indefinitely with this cycle
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-800 p-4 border-t-4 border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 text-gray-400 hover:text-white font-bold"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleSaveConfig(configKami.automation)}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 shadow-lg shadow-green-500/20"
              >
                <Save className="w-4 h-4" />
                SAVE CONFIG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crafting Modal */}
      {isCraftingModalOpen && configKami && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono">
          <div className={`${theme.modal} w-full max-w-md text-white overflow-hidden shadow-2xl`}>
            <div className="bg-gray-800 p-4 border-b-4 border-gray-700 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-yellow-400">CRAFTING CONFIG</h2>
                <div className="text-sm text-gray-400 mt-1">
                  {(() => {
                    const profile = profiles.find(p => p.id === configKami.operator_wallet_id);
                    const name = profile?.name || 'Unknown Profile';
                    const stamina = craftingProfileStamina !== null ? craftingProfileStamina : '...';
                    return `${name} (Stamina: ${stamina})`;
                  })()}
                </div>
              </div>
              <button onClick={() => setIsCraftingModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Toggle */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="peer sr-only"
                    checked={configKami.automation?.autoCraftEnabled || false}
                    onChange={(e) => setConfigKami({
                      ...configKami,
                      automation: { ...configKami.automation, autoCraftEnabled: e.target.checked }
                    })}
                  />
                  <div className="w-10 h-6 bg-gray-700 rounded-full border-2 border-gray-600 peer-checked:bg-yellow-500 peer-checked:border-yellow-400 transition-all"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-4"></div>
                </div>
                <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">Enable Auto-Crafting</span>
              </label>

              {/* Recipe Selection */}
              <div>
                <label className="block text-sm font-bold text-blue-400 mb-2 uppercase">Recipe</label>
                <select 
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                  value={configKami.automation?.craftingRecipeId || ''}
                  onChange={(e) => setConfigKami({
                    ...configKami,
                    automation: { ...configKami.automation, craftingRecipeId: parseInt(e.target.value) }
                  })}
                >
                  <option value="">Select Recipe</option>
                  {RECIPE_LIST.map(recipe => (
                    <option key={recipe.id} value={recipe.id}>
                      #{recipe.id} {recipe.name} (Cost: {recipe.staminaCost})
                    </option>
                  ))}
                </select>
              </div>

              {/* Parameters */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-purple-400 mb-2 uppercase">Amount</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-purple-500 outline-none"
                    value={configKami.automation?.craftingAmount || 1}
                    onChange={(e) => {
                      const amt = parseInt(e.target.value) || 1;
                      setConfigKami({
                        ...configKami,
                        automation: { ...configKami.automation, craftingAmount: amt }
                      });
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-green-400 mb-2 uppercase">Interval</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full bg-gray-800 border-2 border-gray-600 rounded p-2 text-white focus:border-green-500 outline-none"
                    value={configKami.automation?.craftingInterval || 10}
                    onChange={(e) => setConfigKami({
                      ...configKami,
                      automation: { ...configKami.automation, craftingInterval: parseInt(e.target.value) }
                    })}
                  />
                  <div className="text-xs text-gray-500 mt-1">(MINS)</div>
                </div>
              </div>

              {/* Validation Feedback */}
              {(() => {
                const recipe = RECIPE_LIST.find(r => r.id === configKami.automation?.craftingRecipeId);
                const amt = configKami.automation?.craftingAmount || 0;
                if (recipe) {
                  const totalCost = recipe.staminaCost * amt;
                  if (totalCost > 100) {
                    return (
                      <div className="bg-red-900/50 border border-red-500 p-2 rounded text-red-200 text-xs flex items-center gap-2">
                        <X className="w-4 h-4" />
                        Total Cost ({totalCost}) exceeds max stamina (100). Automation will fail.
                      </div>
                    );
                  }
                  return (
                    <div className="bg-gray-900/50 border border-gray-600 p-2 rounded text-gray-400 text-xs">
                      Total Cost: {totalCost} Stamina per run.
                    </div>
                  );
                }
                return null;
              })()}

            </div>

            <div className="bg-gray-800 p-4 border-t-4 border-gray-700 flex justify-end gap-3">
              <button 
                onClick={() => setIsCraftingModalOpen(false)}
                className="px-4 py-2 text-gray-400 hover:text-white font-bold"
              >
                CANCEL
              </button>
              <button 
                onClick={() => handleSaveConfig(configKami.automation)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded font-bold flex items-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                <Save className="w-4 h-4" />
                SAVE CONFIG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterManagerPWA;