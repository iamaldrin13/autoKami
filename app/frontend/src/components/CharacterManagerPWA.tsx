/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Play, Square, Settings, Trash2, ChevronLeft, ChevronRight, RefreshCw, X, Save, Plus, Send, LogOut, Hammer, Sliders, Eye } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { RECIPE_LIST } from '../assets/recipeList';
import { 
  refreshKamigotchis, 
  getProfiles, 
  getKamigotchis, 
  getSystemLogs,
  deleteKamigotchi,
  updateAutomation,
  startHarvestKamigotchi,
  getHarvestStatus,
  type AutomationSettings,
  addProfile,
  updateTelegramSettings,
  getUserSettings,
  sendTestTelegramMessage,
  getAccountStamina,
  getWatchlist,
  getWatchlistLive,
  addToWatchlist,
  removeFromWatchlist,
  searchAccount,
  getKamisByAccount,
  type WatchlistItem
} from '../services/api';
import { supabase } from '../services/supabase';
import { findShortestPath } from '../utils/roomPathfinding';
import { NODE_LIST } from '../assets/nodeList';
import { getBackgroundList } from '../assets/backgrounds';
import { getItemName } from '../utils/itemMapping';

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
            RUNNING
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

// Status Timer Component
const StatusTimer = ({ char }: { char: Kami }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    const updateTimer = () => {
      // 1. Dead Check
      if (char.currentHealth !== undefined && char.currentHealth <= 0) {
          setLabel('DEAD');
          setTimeLeft('');
          return;
      }

      const now = Date.now();
      let targetTime = 0;
      let currentLabel = '';

      if (char.running && char.automation?.lastHarvestStart) {
        // Harvesting
        const duration = char.automation.harvestDuration || 60;
        targetTime = new Date(char.automation.lastHarvestStart).getTime() + (duration * 60 * 1000);
        currentLabel = 'Harvesting';
      } else if (!char.running && char.automation?.lastCollect) {
        // Resting
        const duration = char.automation.restDuration || 30;
        targetTime = new Date(char.automation.lastCollect).getTime() + (duration * 60 * 1000);
        currentLabel = 'Resting';
      } else {
        setLabel(char.running ? 'Harvesting' : 'Idle');
        setTimeLeft('');
        return;
      }

      const diff = targetTime - now;
      
      if (diff > 0) {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
        setLabel(currentLabel);
      } else {
        // Timer Finished
        if (currentLabel === 'Harvesting') {
            // Automation is active, but timer expired. Backend hasn't stopped it yet.
            setTimeLeft('Finished');
            setLabel('Harvesting');
        } else {
            // Resting timer finished
            setTimeLeft('Ready');
            setLabel('Resting');
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [char]);

  return (
    <div className="text-center">
      <div className="font-bold mb-1">Status</div>
      <div className={`font-bold ${char.currentHealth !== undefined && char.currentHealth <= 0 ? 'text-red-600' : char.running ? 'text-green-500' : 'text-gray-500'}`}>
        {char.currentHealth !== undefined && char.currentHealth <= 0 ? '● DEAD' : char.running ? '● RUNNING' : '○ STOPPED'}
      </div>
      {(timeLeft || label === 'DEAD') && (
        <div className={`text-xs font-mono mt-1 rounded px-2 py-1 inline-block border ${label === 'DEAD' ? 'bg-red-100 border-red-300 text-red-600' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
          {label === 'DEAD' ? 'AUTOMATION STOPPED' : `${label}: ${timeLeft}`}
        </div>
      )}
    </div>
  );
};

// Running Timer Component
const RunningTimer = ({ startTime }: { startTime: string | null | undefined }) => {
  const [duration, setDuration] = useState<string>('0m');

  useEffect(() => {
    if (!startTime) {
      if (duration !== '0m') setDuration('0m');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const diff = now - start;
      
      if (diff > 0) {
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        
        if (hours > 0) {
             setDuration(`${hours}h ${minutes}m`);
        } else {
             setDuration(`${minutes}m`);
        }
      } else {
        setDuration('0m');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span>{duration}</span>;
};

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
    <div className={`mb-4 p-3 ${theme.card}`}>
      <StatusTimer char={char} />
    </div>

    {/* Automation Stats */}
    <div className={`${theme.card} p-3 mb-4 space-y-2`}>
        <div className="font-bold border-b border-gray-200 pb-1 mb-1">SESSION STATS</div>
        <div className="flex justify-between items-center text-sm">
            <span>Total Harvests:</span>
            <span className="font-bold">{char.automation?.totalHarvests || 0}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
            <span>Total Rests:</span>
            <span className="font-bold">{char.automation?.totalRests || 0}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
            <span>Running for:</span>
            <span className="font-bold">
                 <RunningTimer startTime={char.automation?.automationStartedAt} />
            </span>
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
  const [processingKamiIds, setProcessingKamiIds] = useState<string[]>([]);
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

  // Watchlist State
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLiveStatus, setWatchlistLiveStatus] = useState<Record<string, any[]> | null>(null);
  const [loadingWatchlistLive, setLoadingWatchlistLive] = useState(false);
  const [watchlistSearchQuery, setWatchlistSearchQuery] = useState('');
  const [watchlistSearchResults, setWatchlistSearchResults] = useState<any[]>([]);
  const [watchlistAccount, setWatchlistAccount] = useState<any>(null);
  const [loadingWatchlist, setLoadingWatchlist] = useState(false);
  const [minDistanceToTarget, setMinDistanceToTarget] = useState<number | null>(null);

  // Function to refresh live status and calculate dynamic interval
  const refreshWatchlistStatus = useCallback(async () => {
    if (!user?.id) return;
    setLoadingWatchlistLive(true);
    try {
        const liveData = await getWatchlistLive(user.id);
        setWatchlistLiveStatus(liveData);

        // Calculate distances to determine next refresh interval
        let globalMinDistance = Infinity;

        // Iterate through all watchlist accounts
        Object.values(liveData).forEach(accountKamis => {
            accountKamis.forEach((targetKami: any) => {
                // Check against ALL of my own Kamis
                characters.forEach(myKami => {
                    if (myKami.room && targetKami.room) {
                        const path = findShortestPath(myKami.room.index, targetKami.room);
                        if (path) {
                             if (path.distance < globalMinDistance) {
                                 globalMinDistance = path.distance;
                             }
                        }
                    }
                });
            });
        });

        if (globalMinDistance !== Infinity) {
            setMinDistanceToTarget(globalMinDistance);
        } else {
            setMinDistanceToTarget(null);
        }

    } catch (e) {
        console.error("Failed to fetch live watchlist", e);
    } finally {
        setLoadingWatchlistLive(false);
    }
  }, [user?.id, characters]);

  // Dynamic Polling Effect
  useEffect(() => {
      let intervalId: NodeJS.Timeout;

      const scheduleNextRefresh = () => {
          let delay = 300000; // Default: 5 minutes (300s)

          if (minDistanceToTarget !== null) {
              if (minDistanceToTarget === 0) {
                  delay = 120000; // Same Node: 2 minutes (120s)
              } else if (minDistanceToTarget < 3) {
                  delay = 300000; // < 3 Hops: 5 minutes (300s) - WAIT, user said "less than 3 hops... refresh every 5mins". 
                                  // And "same node... every 2 mins".
                                  // Default logic implies if far away, maybe poll slower? 
                                  // User instruction: "If < 3 hops away... refresh every 5mins".
                                  // "If same node... refresh every 2mins".
                                  // Implicitly, if > 3 hops, maybe default is longer? Or just keep standard.
                                  // Let's stick to the explicit rules.
                                  // Distance 0 -> 2 mins.
                                  // Distance 1, 2 -> 5 mins.
                                  // Distance >= 3 -> Default (let's say 10 mins or keep at 5).
                                  // Actually, standard UI polling is often fast, but for blockchain data we want to be conservative.
                                  // Let's set default to 10 mins if far away.
                  delay = 300000;
              } else {
                  delay = 600000; // > 3 Hops: 10 minutes
              }
          }

          // console.log(`[Watchlist] Next refresh in ${delay/1000}s (Min Dist: ${minDistanceToTarget})`);
          intervalId = setTimeout(() => {
              refreshWatchlistStatus();
              scheduleNextRefresh(); 
          }, delay);
      };

      // Initial schedule if we have data, otherwise simple interval won't work well with dynamic delays.
      // Better approach: Set a timeout that calls refresh, then sets another timeout.
      
      if (authenticated && user) {
          scheduleNextRefresh();
      }

      return () => clearTimeout(intervalId);
  }, [authenticated, user, minDistanceToTarget, refreshWatchlistStatus]);

  // Load Watchlist
  useEffect(() => {
    if (authenticated && user) {
      getWatchlist(user.id).then(setWatchlist).catch(console.error);
      refreshWatchlistStatus(); // Initial fetch
    }
  }, [authenticated, user, refreshWatchlistStatus]); // Removed refreshWatchlistStatus dependency to avoid loop if not handled carefully, relying on the separate polling effect

  // Search Account for Watchlist
  const handleWatchlistSearch = useCallback(async () => {
    if (!watchlistSearchQuery) return;
    setLoadingWatchlist(true);
    setWatchlistAccount(null);
    setWatchlistSearchResults([]);
    
    try {
        const account = await searchAccount(watchlistSearchQuery);
        if (account) {
            setWatchlistAccount(account);
            // Auto-fetch kamis for this account
            const kamis = await getKamisByAccount(account.id);
            setWatchlistSearchResults(kamis);
        }
    } catch (err: any) {
        alert(err.response?.data?.error || 'Account not found');
    } finally {
        setLoadingWatchlist(false);
    }
  }, [watchlistSearchQuery]);

  // Add/Remove Watchlist
  const toggleWatchlistItem = useCallback(async (kami: any) => {
      if (!user?.id || !watchlistAccount) return;
      
      const existing = watchlist.find(w => w.kamiEntityId === kami.id);
      
      if (existing) {
          // Remove
          try {
              await removeFromWatchlist(user.id, kami.id);
              setWatchlist(prev => prev.filter(w => w.kamiEntityId !== kami.id));
          } catch (e) { console.error(e); }
      } else {
          // Add
          try {
              const item = await addToWatchlist(user.id, {
                  accountId: watchlistAccount.id,
                  accountName: watchlistAccount.name,
                  kamiEntityId: kami.id,
                  kamiName: kami.name
              });
              setWatchlist(prev => [item, ...prev]);
          } catch (e) { console.error(e); }
      }
  }, [user?.id, watchlist, watchlistAccount]);

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
  }, [authenticated, user, profiles, currentProfileIndex, refreshKey, selectedChar]);

  // Real-time Log Subscription
  useEffect(() => {
    if (!user?.id) return;

    console.log('[Realtime] Subscribing to system_logs...');
    const channel = supabase
      .channel(`system-logs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newLog = payload.new as any;
          // console.log('[Realtime] New log received:', newLog);
          
          setSystemLogs(prev => [{
            id: newLog.id,
            time: new Date(newLog.created_at).toLocaleTimeString('en-US', { hour12: false }),
            message: newLog.kami_index !== undefined ? `[Kami #${newLog.kami_index}] ${newLog.message}` : newLog.message,
            type: (newLog.status === 'error' ? 'error' : newLog.status === 'warning' ? 'warning' : 'success') as 'error' | 'warning' | 'success',
            kami_index: newLog.kami_index
          }, ...prev].slice(0, 50));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected to system_logs');
        } else if (status === 'CLOSED') {
          console.log('[Realtime] Disconnected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error');
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Add log entry
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    setSystemLogs(prev => [{ id: Math.random().toString(), time, message, type }, ...prev.slice(0, 49)]);
  }, []);

  // Global Error Handler (Capture browser console errors to UI)
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Filter out common non-critical errors if needed
      if (event.message.includes('ResizeObserver')) return;
      addLog(`Browser Error: ${event.message}`, 'error');
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      // Extract meaningful message
      const reason = event.reason?.message || event.reason || 'Unknown error';
      if (reason.toString().includes('ResizeObserver')) return;
      addLog(`Browser Error: ${reason}`, 'error');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addLog]);

  // Refresh kamigotchis from blockchain
  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    addLog(`Syncing all Kamigotchis from blockchain...`, 'info');
    
    try {
      // Refresh ALL profiles for this user to ensure total state consistency
      const result = await refreshKamigotchis(user.id);
      
      if (result.success) {
        addLog(`Sync complete. Updated ${result.synced} Kamigotchis.`, 'success');
        if (result.errors && result.errors.length > 0) {
             result.errors.forEach((e: string) => addLog(`Sync warning: ${e}`, 'warning'));
        }
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
  }, [user?.id, addLog]);

  // Toggle automation on/off
  const toggleAutomation = useCallback(async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    if (processingKamiIds.includes(charId)) return;

    const isStarting = !char.running;
    setProcessingKamiIds(prev => [...prev, charId]);

    try {
      if (isStarting) {
          addLog(`Checking status for "${char.name}"...`, 'info');
          const status = await getHarvestStatus(char.entity_id);
          
          if (status.isHarvesting) {
             // ALREADY HARVESTING -> Just Enable Automation
             addLog(`"${char.name}" is already harvesting. Enabling automation...`, 'info');
             const { success } = await updateAutomation(char.id, { autoHarvestEnabled: true });
             if (success) {
                 setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: true } : c));
                 addLog(`Automation ENABLED for "${char.name}".`, 'success');
             } else {
                 throw new Error('Failed to enable automation settings.');
             }
          } else {
             // RESTING -> Start Harvest (Robust Action)
             addLog(`"${char.name}" is Resting. Initiating Start Sequence...`, 'info');
             
             // 1. Call Start Harvest (Triggers TX + Enables Automation)
             const result = await startHarvestKamigotchi(char.id);
             
             if (result.success) {
                 addLog(`Start transaction sent (ID: ${result.harvestId || '?'}). Verifying on-chain...`, 'success');
                 
                 // 2. Wait 10s
                 await new Promise(resolve => setTimeout(resolve, 10000));
                 
                 // 3. Verify
                 let verifyStatus = await getHarvestStatus(char.entity_id);
                 if (verifyStatus.isHarvesting) {
                     setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: true } : c));
                     addLog(`Confirmed: "${char.name}" is now harvesting!`, 'success');
                 } else {
                     addLog(`Verification 1 failed. Retrying in 20s...`, 'warning');
                     // 4. Wait 20s
                     await new Promise(resolve => setTimeout(resolve, 20000));
                     
                     verifyStatus = await getHarvestStatus(char.entity_id);
                     if (verifyStatus.isHarvesting) {
                         setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: true } : c));
                         addLog(`Confirmed: "${char.name}" is now harvesting!`, 'success');
                     } else {
                         throw new Error('Harvest start timed out. Please check blockchain.');
                     }
                 }
             } else {
                 throw new Error(result.error || 'Start transaction failed');
             }
          }
      } else {
          // STOPPING
          const nodeName = NODE_LIST.find(n => n.id === (configKami?.automation?.harvestNodeIndex || char.room.index))?.name || 'Unknown Node';
          addLog(`Stopping auto harvest for "${char.name}" at ${nodeName}...`, 'info');
          
          // 1. Disable automation
          const { success } = await updateAutomation(char.id, { autoHarvestEnabled: false });
          
          if (success) {
              setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: false } : c));
              addLog(`Automation DISABLED for "${char.name}".`, 'success');
          } else {
              throw new Error('Failed to disable automation.');
          }
      }

    } catch (err: any) {
      console.error('Failed to toggle automation', err);
      addLog(`Action failed: ${err.message}`, 'error');
      // If we failed to start, ensure UI reflects stopped
      if (isStarting) {
          setCharacters(chars => chars.map(c => c.id === charId ? { ...c, running: false } : c));
      }
    } finally {
        setProcessingKamiIds(prev => prev.filter(id => id !== charId));
    }
  }, [characters, processingKamiIds, addLog, configKami?.automation?.harvestNodeIndex]);

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
  const calculateHarvestStats = useCallback(async () => {
    if (!configKami) return;

    const nodeIndex = configKami.automation?.harvestNodeIndex ?? configKami.room.index ?? 0;
    const nodeType = NODE_LIST.find(n => n.id === nodeIndex)?.affinity?.toLowerCase() || 'normal';
    const harvestDuration = configKami.automation?.harvestDuration || 60;
    const restDuration = configKami.automation?.restDuration || 30;

    // Fetch current harvest status from backend
    let harvestStartTime: Date | null = null;
    let currentHarvestTimeElapsed = 0;
    const isCurrentlyHarvesting = configKami.running;

    try {
      // Query system logs for last harvest start time
      if (!user?.id) return;
      const logsResponse = await getSystemLogs(user.id);
      const lastHarvestStart = logsResponse.logs
        ?.filter((log: any) =>
          log.kami_index === configKami.kami_index &&
          (log.action === 'start_harvest' || log.action === 'auto_start') &&
          log.status === 'success'
        )
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      if (lastHarvestStart && isCurrentlyHarvesting) {
        harvestStartTime = new Date(lastHarvestStart.created_at);
        currentHarvestTimeElapsed = (Date.now() - harvestStartTime.getTime()) / 1000 / 60; // minutes
      }
    } catch (err) {
      console.error('Failed to fetch harvest start time:', err);
    }

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

    // HP at end of configured harvest duration
    const hpAfterHarvest = health - totalStrainPerCycle;
    const hpAfterHarvestPercent = (hpAfterHarvest / health) * 100;

    // HP after full rest duration (starting from hpAfterHarvest)
    const hpAfterRest = hpAfterHarvest + totalRecoveryPerCycle;
    const hpAfterRestPercent = (hpAfterRest / health) * 100;

    // Total MUSU earned during harvest duration
    const avgMusuRate = (musuPerHourStart + musuPerHourAtDuration) / 2;
    const totalMusuEarned = avgMusuRate * (harvestDuration / 60);

    // Current HP calculations (if harvesting)
    let currentHP = health;
    let hpLostSoFar = 0;
    let estimatedCurrentStrain = strainStart;
    let recoveryTimeNeeded = 0;
    let timeTo50Percent = 0;
    const halfHealth = health * 0.5;

    if (isCurrentlyHarvesting && currentHarvestTimeElapsed > 0) {
      // Calculate strain at current time
      const currentIntensity = ((10 + intensityBoost) / 480) * ((5 * violence) + currentHarvestTimeElapsed);
      const currentMusu = (1 + bountyBoost) * (harvestFertility + currentIntensity);
      estimatedCurrentStrain = (6.5 * (1 - strainDecrease) * currentMusu) / (harmony + 20);

      // Calculate HP lost (using average strain from start to now)
      const avgStrainSoFar = (strainStart + estimatedCurrentStrain) / 2;
      hpLostSoFar = avgStrainSoFar * (currentHarvestTimeElapsed / 60); // hours
      currentHP = health - hpLostSoFar;

      // Calculate recovery time needed to restore lost HP
      recoveryTimeNeeded = hpLostSoFar / recovery; // hours

      // Calculate time to 50% HP
      const hpToLose = currentHP - halfHealth;
      if (hpToLose > 0 && estimatedCurrentStrain > 0) {
        timeTo50Percent = hpToLose / estimatedCurrentStrain; // hours
      } else if (currentHP <= halfHealth) {
        timeTo50Percent = 0; // Already below 50%
      }
    } else {
      // Not currently harvesting - calculate theoretical time to 50%
      const hpToLose = health - halfHealth;
      timeTo50Percent = hpToLose / avgStrain; // hours
    }

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
      restDuration,
      // Configured duration results
      hpAfterHarvest,
      hpAfterHarvestPercent,
      hpAfterRest,
      hpAfterRestPercent,
      totalMusuEarned,
      avgMusuRate,
      // New current HP fields
      isCurrentlyHarvesting,
      currentHarvestTimeElapsed,
      currentHP,
      hpLostSoFar,
      estimatedCurrentStrain,
      recoveryTimeNeeded,
      timeTo50Percent,
      halfHealth
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

        // Construct detailed change log
        const changes = [];
        if (settings.autoHarvestEnabled !== undefined) changes.push(`Harvest: ${settings.autoHarvestEnabled ? 'Enabled' : 'Disabled'}`);
        if (settings.autoCraftEnabled !== undefined) changes.push(`Craft: ${settings.autoCraftEnabled ? 'Enabled' : 'Disabled'}`);
        if (settings.harvestNodeIndex !== undefined) changes.push(`Node: #${settings.harvestNodeIndex}`);
        if (settings.craftingRecipeId !== undefined) changes.push(`Recipe: #${settings.craftingRecipeId} (x${settings.craftingAmount || configKami.automation?.craftingAmount || 1})`);
        
        const details = changes.length > 0 ? changes.join(', ') : 'General Settings';

        addLog(`Updated ${profileName}: ${details}. Current Stamina: ${staminaMsg}`, 'success');
        
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
  }, [user, newProfile, addLog]);

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
                  disabled={!selectedChar || processingKamiIds.includes(selectedChar.id)}
                  onClick={() => selectedChar && toggleAutomation(selectedChar.id)}
                  title={selectedChar?.running ? "Stop Automation" : "Start Automation"}
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} text-white
                    ${selectedChar?.running
                      ? 'bg-red-500 hover:bg-red-600 border-red-700'
                      : 'bg-green-500 hover:bg-green-600 border-green-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:border-gray-500
                  `}
                >
                  {processingKamiIds.includes(selectedChar?.id || '') ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    selectedChar?.running ? <Square className="w-6 h-6" fill="white" /> : <Play className="w-6 h-6" fill="white" />
                  )}
                </button>

                <button
                  disabled={!selectedChar}
                  onClick={openConfigModal}
                  title="Configuration"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-gray-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Sliders className="w-6 h-6" />
                </button>
                <button
                  onClick={openCraftingModal}
                  title="Crafting"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-yellow-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Hammer className="w-6 h-6" />
                </button>
                <button
                  disabled={isRefreshing}
                  onClick={handleRefresh}
                  title="Refresh All"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-blue-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <RefreshCw className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  disabled={!selectedChar}
                  onClick={() => selectedChar && deleteCharacter(selectedChar.id)}
                  title="Delete Character"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-red-100' : 'bg-white/80 hover:bg-red-50'} text-red-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Trash2 className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setIsWatchlistModalOpen(true)}
                  title="Watchlist"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-gray-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Eye className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  title="Settings"
                  className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 ${theme.button} ${currentTheme === 'arcade' ? 'bg-white hover:bg-gray-100' : 'bg-white/80 hover:bg-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* System Logs */}
            <div className={`${theme.card} overflow-hidden flex-shrink-0 h-80 flex flex-col`}>
              <div className={`${currentTheme === 'frosted' ? 'bg-black/40 text-white' : 'bg-gray-700 text-white'} p-2 border-b-4 border-gray-800/20 flex-shrink-0`}>
                <span className="font-bold text-lg">SYSTEM LOGS</span>
              </div>
              <div className="p-4 flex-1 overflow-y-auto bg-gray-900/90 text-gray-300">
                <div className="space-y-2 font-mono text-sm whitespace-pre-wrap break-words">
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
                      <span className="text-gray-500 flex-shrink-0">[{log.time}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Watchlist */}
          <div className="lg:w-64 flex-shrink-0 h-64 lg:h-full overflow-y-auto scrollbar-hide">
            <div className={`${theme.card} overflow-hidden h-full flex flex-col`}>
                <div className={`${currentTheme === 'frosted' ? 'bg-black/40 text-white' : 'bg-gray-700 text-white'} p-2 border-b-4 border-gray-800/20 flex-shrink-0 flex justify-between items-center`}>
                    <span className="font-bold">WATCHLIST</span>
                    <button 
                        onClick={refreshWatchlistStatus}
                        disabled={loadingWatchlistLive}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"
                    >
                        <RefreshCw className={`w-3 h-3 ${loadingWatchlistLive ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="p-2 h-full overflow-y-auto space-y-2">
                    {watchlist.length === 0 ? (
                        <div className="text-center opacity-50 p-4">
                            <p className="text-sm font-bold">Empty</p>
                            <p className="text-xs">Add from modal</p>
                        </div>
                    ) : (
                        (() => {
                            // Group by Account
                            const uniqueAccounts = new Map<string, string>();
                            watchlist.forEach(item => uniqueAccounts.set(item.accountId, item.accountName || 'Unknown'));

                            return Array.from(uniqueAccounts.entries()).map(([accountId, accountName]) => {
                                const liveKamis = watchlistLiveStatus?.[accountId] || [];
                                
                                // Group live kamis by location
                                const locationGroups = new Map<number, number>();
                                liveKamis.forEach(k => {
                                    if (k.room) locationGroups.set(k.room, (locationGroups.get(k.room) || 0) + 1);
                                });

                                if (locationGroups.size === 0) {
                                    return (
                                        <div key={accountId} className={`${currentTheme === 'arcade' ? 'bg-gray-100 border-2 border-gray-200' : 'bg-black/10 border border-white/20'} p-2 rounded text-xs opacity-60`}>
                                            <div className="font-bold">{accountName}</div>
                                            <div className="text-[10px] italic">Offline / No active kamis</div>
                                        </div>
                                    );
                                }

                                return Array.from(locationGroups.entries()).map(([roomId, count]) => {
                                    // Calculate distances for MY characters
                                    // Prioritize: Running > Selected > Closest
                                    const myDistances = characters
                                        .filter(c => c.room)
                                        .map(c => {
                                            const path = findShortestPath(c.room.index, roomId);
                                            return {
                                                id: c.id,
                                                name: c.name,
                                                isRunning: c.running,
                                                distance: path ? path.distance : Infinity
                                            };
                                        })
                                        .sort((a, b) => {
                                            // Sort by distance
                                            return a.distance - b.distance;
                                        })
                                        .slice(0, 5); // Show top 5 closest

                                    return (
                                        <div key={`${accountId}-${roomId}`} className={`${currentTheme === 'arcade' ? 'bg-white border-2 border-gray-300' : 'bg-black/20 border border-white/20'} rounded text-xs overflow-hidden`}>
                                            {/* Header: Target Account & Location */}
                                            <div className="bg-gray-800 text-white p-1.5 flex justify-between items-center">
                                                <span className="font-bold truncate max-w-[80px]" title={accountName}>{accountName}</span>
                                                <div className="text-right">
                                                    <div className="text-yellow-400 font-bold max-w-[100px] truncate">
                                                        {NODE_LIST.find(n => n.id === roomId)?.name || `Node ${roomId}`}
                                                    </div>
                                                    <div className="text-[9px] text-gray-400">{count} kamis here</div>
                                                </div>
                                            </div>

                                            {/* My Relative Distances */}
                                            <div className="p-1.5 space-y-1">
                                                {myDistances.map(d => (
                                                    <div key={d.id} className="flex justify-between items-center text-[10px] border-b border-gray-100/10 last:border-0 pb-0.5 last:pb-0 gap-2">
                                                        <span className={`truncate flex-1 min-w-0 ${d.isRunning ? 'text-green-600 font-bold' : ''}`} title={d.name}>
                                                            {d.name}
                                                        </span>
                                                        <span className={`font-mono font-bold flex-shrink-0 ${
                                                            d.distance === 0 ? 'text-red-500 animate-pulse' : 
                                                            d.distance < 3 ? 'text-yellow-600' : 
                                                            'text-gray-400'
                                                        }`}>
                                                            {d.distance === 0 ? 'HERE!!' : `${d.distance} hops`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                });
                            });
                        })()
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Character Details Modal Removed */}

      {/* Watchlist Modal */}
      {isWatchlistModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 font-mono">
          <div className={`${theme.modal} w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="p-4 border-b-4 border-gray-700 flex justify-between items-center bg-gray-800 sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Eye className="w-6 h-6" />
                WATCHLIST
              </h2>
              <button onClick={() => setIsWatchlistModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
                {/* Search Section */}
                <div className="bg-black/20 p-4 rounded-lg">
                    <label className="block text-sm font-bold mb-2 text-gray-400">Add Account or Kami</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="e.g. 11835 (Account) or 3054 (Kami #)" 
                            className={`${theme.input} flex-1 p-2`}
                            value={watchlistSearchQuery}
                            onChange={(e) => setWatchlistSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleWatchlistSearch()}
                        />
                        <button 
                            onClick={handleWatchlistSearch}
                            disabled={loadingWatchlist}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold"
                        >
                            {loadingWatchlist ? 'LOADING...' : 'SEARCH'}
                        </button>
                    </div>
                </div>

                {/* Search Results */}
                {watchlistAccount && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center border-b border-gray-700 pb-2">
                            <div>
                                <div className="font-bold text-green-400">{watchlistAccount.name}</div>
                                <div className="text-xs text-gray-500">Account ID: {watchlistAccount.id.substring(0, 10)}...</div>
                            </div>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                            {watchlistSearchResults.length === 0 ? (
                                <div className="text-gray-500 italic p-2">No Kamis found for this account</div>
                            ) : (
                                watchlistSearchResults.map(kami => {
                                    const isAdded = watchlist.some(w => w.kamiEntityId === kami.id);
                                    return (
                                        <div key={kami.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                                            <div className="flex items-center gap-3">
                                                <img 
                                                    src={`https://i.test.kamigotchi.io/kami/${kami.mediaURI}.gif`} 
                                                    className="w-8 h-8 bg-gray-700 rounded object-contain pixelated"
                                                    style={{ imageRendering: 'pixelated' }}
                                                />
                                                <div>
                                                    <div className="font-bold text-sm">{kami.name}</div>
                                                    <div className="text-xs text-gray-500">#{kami.index} • Lv.{kami.level} • {kami.state}</div>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => toggleWatchlistItem(kami)}
                                                className={`w-8 h-8 flex items-center justify-center rounded font-bold ${isAdded ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                                                title={isAdded ? "Remove from Watchlist" : "Add to Watchlist"}
                                            >
                                                {isAdded ? '-' : '+'}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Current Watchlist */}
                <div>
                    <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-4">
                        <h3 className="text-lg font-bold text-yellow-400">YOUR WATCHLIST</h3>
                        <button 
                            onClick={refreshWatchlistStatus}
                            disabled={loadingWatchlistLive}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
                        >
                            <RefreshCw className={`w-3 h-3 ${loadingWatchlistLive ? 'animate-spin' : ''}`} />
                            REFRESH STATUS
                        </button>
                    </div>
                    
                    {watchlist.length === 0 ? (
                        <div className="text-gray-500 text-center p-4">No items in watchlist</div>
                    ) : (
                        <div className="grid gap-3">
                            {(() => {
                                // Group by Account to show logical blocks
                                const uniqueAccounts = new Map<string, string>();
                                watchlist.forEach(item => uniqueAccounts.set(item.accountId, item.accountName || 'Unknown'));

                                return Array.from(uniqueAccounts.entries()).map(([accountId, accountName]) => {
                                    const liveKamis = watchlistLiveStatus?.[accountId] || [];
                                    
                                    // Filter live kamis to only those in the watchlist (if we added specific kamis)
                                    // Logic: If user added specific Kami ID, show only that. If added Account (not yet supported but future proof), show all.
                                    // Currently we add specific Kamis.
                                    const watchedKamiIds = new Set(watchlist.filter(w => w.accountId === accountId).map(w => w.kamiEntityId));
                                    
                                    // If we haven't fetched live data yet, just show placeholder items
                                    if (!watchlistLiveStatus) {
                                        return (
                                            <div key={accountId} className="p-3 bg-gray-800 rounded border border-gray-700 opacity-50">
                                                <div className="font-bold mb-2">{accountName}</div>
                                                <div className="text-xs">Loading status...</div>
                                            </div>
                                        );
                                    }

                                    const visibleKamis = liveKamis.filter(k => watchedKamiIds.has(k.id));

                                    if (visibleKamis.length === 0) {
                                        return (
                                             <div key={accountId} className="p-3 bg-gray-800 rounded border border-gray-700 opacity-50">
                                                <div className="font-bold">{accountName}</div>
                                                <div className="text-xs italic">Offline / No active watched kamis</div>
                                            </div>
                                        );
                                    }

                                    return visibleKamis.map(targetKami => {
                                        // Calculate distances for MY characters
                                        // Use the data already computed in backend or frontend logic
                                        // Wait, backend provides `distance` now?
                                        // Backend `GET /live` returns `results` where each kami has `distance` (min hops to ANY of my kamis) and `path`.
                                        // But the UI wants a LIST of my kamis and their distance.
                                        // The backend response I implemented only gives the MIN distance to the CLOSEST of my kamis.
                                        // "Calculate minimum distance to any of user's kamis ... return { distance: minDistance }"
                                        // The UI request: "show the add kamis of the user ... then the distance from my accounts per profile."
                                        // This implies showing the LIST of my kamis.
                                        // So I must calculate this on the Frontend using `findShortestPath` as I did in the "Right Panel" implementation.
                                        
                                        // Re-use logic from Right Panel
                                        const myDistances = characters
                                            .filter(c => c.room)
                                            .map(c => {
                                                const path = targetKami.room ? findShortestPath(c.room.index, targetKami.room) : null;
                                                return {
                                                    id: c.id,
                                                    name: c.name,
                                                    isRunning: c.running,
                                                    distance: path ? path.distance : Infinity
                                                };
                                            })
                                            .sort((a, b) => a.distance - b.distance)
                                            .slice(0, 5); // Show top 5

                                        return (
                                            <div key={targetKami.id} className="bg-gray-800 border-2 border-gray-700 rounded overflow-hidden">
                                                {/* Header */}
                                                <div className="bg-gray-700 p-2 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${targetKami.state === 'Harvesting' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                                                        <span className="font-bold text-sm text-white">{targetKami.name}</span>
                                                        <span className="text-xs text-gray-400">({accountName})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-right">
                                                            <div className="text-yellow-400 font-bold text-xs">
                                                                {NODE_LIST.find(n => n.id === targetKami.room)?.name || `Node ${targetKami.room}`}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 uppercase">{targetKami.state}</div>
                                                        </div>
                                                        <button 
                                                            onClick={() => removeFromWatchlist(user!.id, targetKami.id).then(() => setWatchlist(p => p.filter(x => x.kamiEntityId !== targetKami.id)))}
                                                            className="text-red-400 hover:text-white bg-gray-800 hover:bg-red-600 rounded p-1 ml-2 transition-colors"
                                                            title="Remove from Watchlist"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Distances Body */}
                                                <div className="p-2 bg-gray-900/50 space-y-1">
                                                    <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Distance from my kamis</div>
                                                    {myDistances.length === 0 ? (
                                                        <div className="text-xs text-gray-500 italic">You have no active kamis</div>
                                                    ) : (
                                                        myDistances.map(d => (
                                                            <div key={d.id} className="flex justify-between items-center text-xs border-b border-gray-700/50 last:border-0 pb-1 last:pb-0 gap-2">
                                                                <span className={`truncate flex-1 min-w-0 ${d.isRunning ? 'text-green-400' : 'text-gray-300'}`} title={d.name}>
                                                                    {d.name}
                                                                </span>
                                                                <span className={`font-mono font-bold flex-shrink-0 ${
                                                                    d.distance === 0 ? 'text-red-500 animate-pulse' : 
                                                                    d.distance < 3 ? 'text-yellow-500' : 
                                                                    'text-gray-500'
                                                                }`}>
                                                                    {d.distance === 0 ? 'HERE!!' : d.distance === Infinity ? 'Unknown' : `${d.distance} hops`}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                });
                            })()}
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      )}
      
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
          <div className={`${theme.modal} w-full max-w-4xl text-white overflow-hidden shadow-2xl my-8`}>
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
                </div>

                {/* RIGHT COLUMN: Analysis Results */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                    <span className="text-sm font-bold text-yellow-400 uppercase">📊 Analysis</span>
                    <button
                      onClick={calculateHarvestStats}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 shadow-lg shadow-blue-500/20"
                    >
                      <RefreshCw className="w-3 h-3" />
                      COMPUTE
                    </button>
                  </div>

              {/* Calculation Results */}
              {harvestCalc ? (
                <div className="space-y-3 text-sm">
                  <div className="text-xs text-gray-500">
                    {configKami.affinities.join('/')} on {harvestCalc.nodeType.toUpperCase()}
                  </div>

                  {/* Current HP Status (if harvesting) */}
                  {harvestCalc.isCurrentlyHarvesting && (
                    <div className="bg-blue-900/30 p-3 rounded border border-blue-700">
                      <div className="text-xs text-blue-400 font-bold mb-2">⚡ CURRENT STATUS (LIVE)</div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-400">Harvest Time</div>
                          <div className="font-bold text-white">{Math.floor(harvestCalc.currentHarvestTimeElapsed)} mins</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Current HP</div>
                          <div className={`font-bold text-lg ${
                            harvestCalc.currentHP > harvestCalc.halfHealth ? 'text-green-400' :
                            harvestCalc.currentHP > harvestCalc.halfHealth * 0.5 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {Math.max(0, harvestCalc.currentHP).toFixed(1)} HP
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-blue-800 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-400">HP Lost</div>
                          <div className="font-bold text-red-300">{harvestCalc.hpLostSoFar.toFixed(1)} HP</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Current Strain</div>
                          <div className="font-bold text-red-300">{harvestCalc.estimatedCurrentStrain.toFixed(2)} HP/hr</div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-blue-800 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Recovery Time Needed:</span>
                          <span className="font-bold text-blue-300">
                            {(harvestCalc.recoveryTimeNeeded * 60).toFixed(0)} mins
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Time to 50% HP:</span>
                          <span className={`font-bold ${harvestCalc.timeTo50Percent === 0 ? 'text-red-400' : 'text-yellow-300'}`}>
                            {harvestCalc.timeTo50Percent === 0 ?
                              'ALREADY BELOW 50%!' :
                              `${(harvestCalc.timeTo50Percent * 60).toFixed(0)} mins`
                            }
                          </span>
                        </div>
                      </div>
                      {/* HP Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>HP Progress</span>
                          <span>{((harvestCalc.currentHP / configKami.finalStats.health) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              harvestCalc.currentHP > harvestCalc.halfHealth ? 'bg-green-500' :
                              harvestCalc.currentHP > harvestCalc.halfHealth * 0.5 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, (harvestCalc.currentHP / configKami.finalStats.health) * 100))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[0.65rem] text-gray-500 mt-1">
                          <span>0</span>
                          <span className="text-yellow-400">50% ({harvestCalc.halfHealth.toFixed(0)} HP)</span>
                          <span>{configKami.finalStats.health} HP</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cycle Prediction Section */}
                  <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-4 rounded-lg border-2 border-purple-500/50 shadow-lg">
                    <div className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                      🎯 CYCLE PREDICTION ({harvestCalc.harvestDuration}m harvest + {harvestCalc.restDuration}m rest)
                    </div>

                    {/* Harvest Phase */}
                    <div className="bg-red-900/30 rounded p-3 mb-2 border border-red-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-red-300 font-bold">⚔️ After Harvesting ({harvestCalc.harvestDuration}m)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[0.65rem] text-gray-400">HP Remaining</div>
                          <div className={`text-xl font-bold ${
                            harvestCalc.hpAfterHarvestPercent > 50 ? 'text-green-400' :
                            harvestCalc.hpAfterHarvestPercent > 25 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {harvestCalc.hpAfterHarvest.toFixed(1)} HP
                          </div>
                          <div className="text-[0.65rem] text-gray-500">
                            ({harvestCalc.hpAfterHarvestPercent.toFixed(1)}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] text-gray-400">MUSU Earned</div>
                          <div className="text-xl font-bold text-green-400">
                            {harvestCalc.totalMusuEarned.toFixed(1)}
                          </div>
                          <div className="text-[0.65rem] text-gray-500">
                            ~{harvestCalc.avgMusuRate.toFixed(1)} MUSU/hr
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-red-800">
                        <div className="text-[0.65rem] text-red-300">
                          HP Lost: {harvestCalc.totalStrainPerCycle.toFixed(1)} HP (Avg: {harvestCalc.avgStrain.toFixed(2)} HP/hr)
                        </div>
                      </div>
                    </div>

                    {/* Rest Phase */}
                    <div className="bg-blue-900/30 rounded p-3 border border-blue-700/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-blue-300 font-bold">😴 After Resting ({harvestCalc.restDuration}m)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[0.65rem] text-gray-400">HP After Rest</div>
                          <div className={`text-xl font-bold ${
                            harvestCalc.hpAfterRestPercent > 90 ? 'text-green-400' :
                            harvestCalc.hpAfterRestPercent > 70 ? 'text-blue-400' :
                            'text-yellow-400'
                          }`}>
                            {Math.min(harvestCalc.hpAfterRest, configKami.finalStats.health).toFixed(1)} HP
                          </div>
                          <div className="text-[0.65rem] text-gray-500">
                            ({Math.min(harvestCalc.hpAfterRestPercent, 100).toFixed(1)}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-[0.65rem] text-gray-400">HP Restored</div>
                          <div className="text-xl font-bold text-blue-400">
                            +{harvestCalc.totalRecoveryPerCycle.toFixed(1)}
                          </div>
                          <div className="text-[0.65rem] text-gray-500">
                            {harvestCalc.recovery.toFixed(2)} HP/hr
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-blue-800">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Net HP Change:</span>
                          <span className={`font-bold ${harvestCalc.netHpPerCycle >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {harvestCalc.netHpPerCycle >= 0 ? '+' : ''}{harvestCalc.netHpPerCycle.toFixed(1)} HP
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sustainability Badge */}
                    <div className={`mt-2 p-2 rounded text-center font-bold text-sm ${
                      harvestCalc.isSustainable ? 'bg-green-900/50 text-green-300 border border-green-600' :
                      'bg-red-900/50 text-red-300 border border-red-600'
                    }`}>
                      {harvestCalc.isSustainable ? '✅ Sustainable Cycle' : '⚠️ Losing HP Each Cycle'}
                    </div>
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
              ) : (
                <div className="p-6 text-center text-gray-500 text-sm border border-gray-700 rounded bg-gray-800/30">
                  Click <span className="text-blue-400 font-bold">COMPUTE</span> to see harvest analysis
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

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Kami Stats Overview */}
              <div className="grid grid-cols-4 gap-3 p-3 bg-gray-800/50 rounded border border-gray-700">
                <div className="text-center">
                  <div className="text-xs text-gray-400">Health</div>
                  <div className="text-lg font-bold text-green-400">{configKami.finalStats.health}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Power</div>
                  <div className="text-lg font-bold text-blue-400">{configKami.finalStats.power}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Harmony</div>
                  <div className="text-lg font-bold text-purple-400">{configKami.finalStats.harmony}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400">Violence</div>
                  <div className="text-lg font-bold text-red-400">{configKami.finalStats.violence}</div>
                </div>
              </div>

              {/* 2-Column Layout */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: Configuration */}
                <div className="space-y-4">
                  <div className="text-sm font-bold text-yellow-400 uppercase border-b border-gray-700 pb-2">⚙️ Configuration</div>

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
                  {RECIPE_LIST.map(recipe => {
                    const reqs = recipe.inputIndices.map((id, idx) => `${recipe.inputAmounts[idx]}x ${getItemName(id)}`).join(', ');
                    return (
                      <option key={recipe.id} value={recipe.id}>
                        #{recipe.id} {recipe.name} (Cost: {recipe.staminaCost}) - Req: {reqs}
                      </option>
                    );
                  })}
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
                </div> {/* Close Left Column */}
                
                {/* Right Column */}
                <div></div> 
              </div> {/* Close Grid */}

            </div> {/* Close p-6 */}

            {/* Footer */}
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