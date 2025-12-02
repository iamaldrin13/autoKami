import { ethers } from 'ethers';
import { loadAbi } from '../utils/contractLoader.js';
import { getNodeName, getTraitData, getLevelData } from '../utils/mappings.js';
import { getKamiSkills, KamiSkills, SkillData } from './skillService.js';

// Load ABI using robust loader
const GetterSystemABI = loadAbi('GetterSystem.json');

const GETTER_SYSTEM_ADDRESS = '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';
const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Create contract instance
const getterSystem = new ethers.Contract(
  GETTER_SYSTEM_ADDRESS,
  GetterSystemABI.abi,
  provider
);

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

export interface KamiTraits {
  face: number;
  hand: number;
  body: number;
  background: number;
  color: number;
}

export interface TraitInfo {
  name: string;
  type: string;
  stats: number[]; // [Power, HP, Violence, Harmony, Slot]
}

// Aggregated skill bonuses from all skills (finalSkillBonus values summed by type)
export interface AggregatedSkillBonuses {
  // Core stats
  power: number;
  health: number;
  harmony: number;
  violence: number;
  // Percentage bonuses
  fertilityBoost: number;
  bountyBoost: number;
  metabolismBoost: number;
  strain: number;
  defenseShift: number;
  defenseRatio: number;
  salvageRatio: number;
  atkSpoilsRatio: number;
  atkThresholdRatio: number;
  atkThresholdShift: number;
  cooldownShift: number;
  // Per-hour bonuses
  intensityBoost: number;
}

export interface BaseStats {
  power: number;
  health: number;
  harmony: number;
  violence: number;
}

export interface FinalStats {
  // Core
  power: number;
  health: number;
  harmony: number;
  violence: number;
  // Multipliers (default 1)
  fertilityMultiplier: number;
  bountyMultiplier: number;
  metabolismMultiplier: number;
  strainMultiplier: number;
  defenseShiftMultiplier: number;
  defenseRatioMultiplier: number;
  salvageRatioMultiplier: number;
  atkSpoilsRatioMultiplier: number;
  atkThresholdRatioMultiplier: number;
  atkThresholdShiftMultiplier: number;
  // Flat / Additive (default 0)
  cooldownShift: number;
  intensityBoost: number;
}

export interface MappedKamiData {
  id: string;
  index: number;
  name: string;
  mediaURI: string;
  stats: KamiStats;
  baseStats: BaseStats;
  finalStats: FinalStats;
  currentHealth: number;
  traits: {
    face: TraitInfo | null;
    hand: TraitInfo | null;
    body: TraitInfo | null;
    background: TraitInfo | null;
    color: TraitInfo | null;
  };
  affinities: string[];
  account: string;
  level: number;
  xp: number;
  room: {
    index: number;
    name: string | null;
  };
  state: string;
  levelData: {
    currentXP: number;
    nextLevelXP: number | null;
    xpToNextLevel: number | null;
  } | null;
  skills: {
    totalPointsUsed: number;
    skills: Array<{
      index: number;
      name: string;
      level: number;
      pointsAllocated: number;
      tier: number;
      tree: string;
      skillBonus: string;
      finalSkillBonus: {
        type: string;
        value: number;
        isPercent: boolean;
        isPerHour: boolean;
      } | null;
      imageUrl: string;
    }>;
    unlockedTiers: number[];
    aggregatedBonuses: AggregatedSkillBonuses;
  };
}

/**
 * Retrieve Kami data by ID
 */
export async function getKamiById(kamiId: string | bigint): Promise<MappedKamiData> {
  try {
    const id = typeof kamiId === 'string' ? BigInt(kamiId) : kamiId;
    const kamiData = await getterSystem.getKami(id);

    return await mapKamiData(kamiData, id);
  } catch (error) {
    throw new Error(`Failed to retrieve Kami by ID: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Retrieve Kami data by index
 */
export async function getKamiByIndex(index: number): Promise<MappedKamiData> {
  try {
    const kamiData = await getterSystem.getKamiByIndex(index);
    const kamiId = BigInt(kamiData.id.toString());
    return await mapKamiData(kamiData, kamiId);
  } catch (error) {
    throw new Error(`Failed to retrieve Kami by index: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get total number of Kamis
 */
export async function getTotalKamis(): Promise<number> {
  try {
    const total = await getterSystem.getKamisCount();
    return Number(total);
  } catch (error) {
    throw new Error(`Failed to get total Kamis: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Map raw contract data to enriched Kami data with mappings
 */
async function mapKamiData(kamiData: any, kamiId: bigint): Promise<MappedKamiData> {
  // Convert BigInt values to strings/numbers
  const id = kamiData.id.toString();
  const index = Number(kamiData.index);
  const level = Number(kamiData.level);
  const xp = Number(kamiData.xp);
  const roomIndex = Number(kamiData.room);
  const account = kamiData.account.toString();

  // Map stats safely using array indices to avoid property name collisions or proxy issues
  // struct Stat { int32 base; int32 shift; int32 boost; int32 sync; }
  const stats: KamiStats = {
    health: {
      base: Number(kamiData.stats.health[0]),
      shift: Number(kamiData.stats.health[1]),
      boost: Number(kamiData.stats.health[2]),
      sync: Number(kamiData.stats.health[3]),
    },
    power: {
      base: Number(kamiData.stats.power[0]),
      shift: Number(kamiData.stats.power[1]),
      boost: Number(kamiData.stats.power[2]),
      sync: Number(kamiData.stats.power[3]),
    },
    harmony: {
      base: Number(kamiData.stats.harmony[0]),
      shift: Number(kamiData.stats.harmony[1]),
      boost: Number(kamiData.stats.harmony[2]),
      sync: Number(kamiData.stats.harmony[3]),
    },
    violence: {
      base: Number(kamiData.stats.violence[0]),
      shift: Number(kamiData.stats.violence[1]),
      boost: Number(kamiData.stats.violence[2]),
      sync: Number(kamiData.stats.violence[3]),
    },
  };

  // Map traits with registry data
  const faceIndex = Number(kamiData.traits.face);
  const handIndex = Number(kamiData.traits.hand);
  const bodyIndex = Number(kamiData.traits.body);
  const backgroundIndex = Number(kamiData.traits.background);
  const colorIndex = Number(kamiData.traits.color);

  // Get level data
  const currentLevelData = getLevelData(level);
  const nextLevelData = getLevelData(level + 1);

  // Calculate XP correctly
  // currentXP is the actual XP value from contract (e.g., 29737)
  // nextLevelXP is the XP required for next level (e.g., 63516)
  // xpToNextLevel is the difference: nextLevelXP - currentXP (e.g., 63516 - 29737 = 33779)
  const currentXP = xp;
  const nextLevelXP = nextLevelData?.xp || null;
  const xpToNextLevel = nextLevelXP ? nextLevelXP - currentXP : null;

  // Map affinities: SCRAP = Body (1st affinity), INSECT = Hands (2nd affinity)
  // Build affinities array from trait types
  const bodyTrait = getTraitData('body', bodyIndex);
  const handTrait = getTraitData('hands', handIndex);
  const affinities: string[] = [];

  if (bodyTrait && bodyTrait.type) {
    affinities.push(bodyTrait.type); // 1st affinity from Body
  }
  if (handTrait && handTrait.type) {
    affinities.push(handTrait.type); // 2nd affinity from Hands
  }

  // Fetch skills for this Kami
  const kamiSkills = await getKamiSkills(kamiId);

  // Calculate aggregated skill bonuses from all skills' finalSkillBonus
  const aggregatedBonuses: AggregatedSkillBonuses = {
    power: 0,
    health: 0,
    harmony: 0,
    violence: 0,
    fertilityBoost: 0,
    bountyBoost: 0,
    metabolismBoost: 0,
    strain: 0,
    defenseShift: 0,
    defenseRatio: 0,
    salvageRatio: 0,
    atkSpoilsRatio: 0,
    atkThresholdRatio: 0,
    atkThresholdShift: 0,
    cooldownShift: 0,
    intensityBoost: 0
  };

  // Sum up all finalSkillBonus values by type
  for (const skill of kamiSkills.skills) {
    if (skill.finalSkillBonus) {
      const { type, value } = skill.finalSkillBonus;
      if (type in aggregatedBonuses) {
        (aggregatedBonuses as any)[type] += value;
      }
    }
  }

  // Map skills with full data
  const skills = {
    totalPointsUsed: kamiSkills.totalPointsUsed,
    skills: kamiSkills.skills.map(skill => ({
      index: skill.index,
      name: skill.name,
      level: skill.level,
      pointsAllocated: skill.pointsAllocated,
      tier: skill.tier,
      tree: skill.tree,
      skillBonus: skill.skillBonus,
      finalSkillBonus: skill.finalSkillBonus,
      imageUrl: skill.imageUrl
    })),
    unlockedTiers: kamiSkills.unlockedTiers,
    aggregatedBonuses
  };

  // Calculate baseStats (from stats.base values)
  const baseStats: BaseStats = {
    power: stats.power.base,
    health: stats.health.base,
    harmony: stats.harmony.base,
    violence: stats.violence.base
  };

  // Calculate finalStats (Max Potential Stats)
  // User correction: Max Health = Base + Shift (Skill Bonus)
  // We apply this pattern to other stats for consistency if applicable, 
  // but specifically for Health as requested.
  const finalStats: FinalStats = {
    // Core stats
    // Health: Base (Level) + Shift (Skills) = Max Health
    health: stats.health.base + stats.health.shift,
    
    // Others: Use Sync + Bonus as before, or Base + Shift?
    // If Health uses Base + Shift, likely others do too for "Max/Effective".
    // Let's use Base + Shift for all to be consistent with the data structure.
    power: stats.power.base + stats.power.shift,
    harmony: stats.harmony.base + stats.harmony.shift,
    violence: stats.violence.base + stats.violence.shift,

    // Multipliers (1 + (Bonus / 100))
    // Default is 1. If bonus is 78, multiplier is 1.78.
    fertilityMultiplier: 1 + (aggregatedBonuses.fertilityBoost / 100),
    bountyMultiplier: 1 + (aggregatedBonuses.bountyBoost / 100),
    metabolismMultiplier: 1 + (aggregatedBonuses.metabolismBoost / 100),
    
    // Strain is typically a reduction (negative value). 
    // If bonus is -12.5, multiplier is 1 + (-0.125) = 0.875.
    strainMultiplier: 1 + (aggregatedBonuses.strain / 100), 

    defenseShiftMultiplier: 1 + (aggregatedBonuses.defenseShift / 100),
    defenseRatioMultiplier: 1 + (aggregatedBonuses.defenseRatio / 100),
    salvageRatioMultiplier: 1 + (aggregatedBonuses.salvageRatio / 100),
    atkSpoilsRatioMultiplier: 1 + (aggregatedBonuses.atkSpoilsRatio / 100),
    atkThresholdRatioMultiplier: 1 + (aggregatedBonuses.atkThresholdRatio / 100),
    atkThresholdShiftMultiplier: 1 + (aggregatedBonuses.atkThresholdShift / 100),

    // Flat / Additive
    cooldownShift: aggregatedBonuses.cooldownShift,
    intensityBoost: aggregatedBonuses.intensityBoost
  };

  return {
    id,
    index,
    name: kamiData.name,
    mediaURI: kamiData.mediaURI,
    stats,
    baseStats,
    finalStats,
    currentHealth: stats.health.base, // Current Health (likely base value)
    traits: {
      face: getTraitData('face', faceIndex),
      hand: getTraitData('hands', handIndex),
      body: getTraitData('body', bodyIndex),
      background: getTraitData('background', backgroundIndex),
      color: getTraitData('color', colorIndex),
    },
    affinities,
    account,
    level,
    xp,
    room: {
      index: roomIndex,
      name: getNodeName(roomIndex),
    },
    state: kamiData.state,
    levelData: currentLevelData ? {
      currentXP,
      nextLevelXP,
      xpToNextLevel,
    } : null,
    skills,
  };
}

// Node types for harvesting
export type NodeType = 'Scrap' | 'Insect' | 'Eerie' | 'Normal';

export interface HarvestingStats {
  nodeType: NodeType;
  affinityBonus: number;
  harvestFertility: number;
  intensityPerHour: number;
  musuPerHour: number;
  strainPerHour: number;
  recoveryPerHour: number;
  netHpPerHour: number;
  affinityBreakdown: {
    bodyMatch: 'match' | 'mismatch' | 'normal' | 'neutral';
    handMatch: 'match' | 'mismatch' | 'normal' | 'neutral';
    bodyContribution: number;
    handContribution: number;
  };
}

/**
 * Calculate affinity bonus for a Kami on a specific node type
 * Based on KAMIGOTCHI_FORMULAS.md
 */
function calculateAffinityBonus(
  bodyType: string | null,
  handType: string | null,
  nodeType: NodeType,
  fertilityBoost: number
): { bonus: number; breakdown: HarvestingStats['affinityBreakdown'] } {
  let affinityBonus = 1;
  let bodyContribution = 0;
  let handContribution = 0;
  let bodyMatch: HarvestingStats['affinityBreakdown']['bodyMatch'] = 'neutral';
  let handMatch: HarvestingStats['affinityBreakdown']['handMatch'] = 'neutral';

  // Normalize types
  const normalizedBodyType = bodyType?.toLowerCase() || 'normal';
  const normalizedHandType = handType?.toLowerCase() || 'normal';
  const normalizedNodeType = nodeType.toLowerCase();

  // Body calculations
  if (normalizedBodyType === 'normal') {
    bodyContribution = 0;
    bodyMatch = 'normal';
  } else if (normalizedBodyType === normalizedNodeType) {
    // Body type matches node type
    bodyContribution = 0.65 + fertilityBoost;
    bodyMatch = 'match';
  } else {
    // Body type doesn't match node type
    bodyContribution = -0.25;
    bodyMatch = 'mismatch';
  }

  // Hand calculations
  if (normalizedHandType === 'normal') {
    handContribution = 0;
    handMatch = 'normal';
  } else if (normalizedHandType === normalizedNodeType) {
    // Hand type matches node type
    handContribution = 0.35 + fertilityBoost;
    handMatch = 'match';
  } else {
    // Hand type doesn't match node type
    handContribution = -0.10;
    handMatch = 'mismatch';
  }

  affinityBonus += bodyContribution + handContribution;

  return {
    bonus: affinityBonus,
    breakdown: {
      bodyMatch,
      handMatch,
      bodyContribution,
      handContribution
    }
  };
}

/**
 * Calculate harvesting stats for a Kami on a specific node type
 */
export function calculateHarvestingStats(
  kamiData: MappedKamiData,
  nodeType: NodeType,
  harvestingMinutes: number = 60
): HarvestingStats {
  // Get trait types
  const bodyType = kamiData.traits.body?.type || null;
  const handType = kamiData.traits.hand?.type || null;

  // Get skill bonuses (convert percentages to decimals)
  const fertilityBoost = (kamiData.skills.aggregatedBonuses.fertilityBoost || 0) / 100;
  const bountyBoost = (kamiData.skills.aggregatedBonuses.bountyBoost || 0) / 100;
  const intensityBoostPerHour = kamiData.skills.aggregatedBonuses.intensityBoost || 0;
  const metabolismBoost = (kamiData.skills.aggregatedBonuses.metabolismBoost || 0) / 100;
  const strainDecrease = Math.abs(kamiData.skills.aggregatedBonuses.strain || 0) / 100;

  // Get stats
  const power = kamiData.finalStats.power;
  const violence = kamiData.finalStats.violence;
  const harmony = kamiData.finalStats.harmony;

  // Calculate affinity bonus
  const { bonus: affinityBonus, breakdown } = calculateAffinityBonus(
    bodyType,
    handType,
    nodeType,
    fertilityBoost
  );

  // Calculate Harvest Fertility
  // HarvestFertility = AffinityBonus × 1.5 × Power
  const harvestFertility = affinityBonus * 1.5 * power;

  // Calculate Intensity per hour (at t=60 minutes)
  // IntensitySpot = ((10 + IntensityBoost) / 480) × ((5 × Violence) + TimeHarvesting)
  const baseIntensity = 10 + intensityBoostPerHour;
  const intensityPerHour = (baseIntensity / 480) * ((5 * violence) + harvestingMinutes);

  // Calculate MUSU/hr (Total Bounty)
  // MUSUBounty = (1 + BountyBoost) × (HarvestFertility + HarvestIntensity)
  const musuPerHour = (1 + bountyBoost) * (harvestFertility + intensityPerHour);

  // Calculate Strain (HP loss per hour)
  // Strain = (6.5 × (1 - StrainDecrease) × MUSUGained) / (Harmony + 20)
  const strainPerHour = (6.5 * (1 - strainDecrease) * musuPerHour) / (harmony + 20);

  // Calculate Recovery (HP gain per hour)
  // Recovery = 1.2 × Harmony × (1 + MetabolismBoost)
  const recoveryPerHour = 1.2 * harmony * (1 + metabolismBoost);

  // Net HP change per hour
  const netHpPerHour = recoveryPerHour - strainPerHour;

  return {
    nodeType,
    affinityBonus: Math.round(affinityBonus * 1000) / 1000,
    harvestFertility: Math.round(harvestFertility * 100) / 100,
    intensityPerHour: Math.round(intensityPerHour * 100) / 100,
    musuPerHour: Math.round(musuPerHour * 100) / 100,
    strainPerHour: Math.round(strainPerHour * 100) / 100,
    recoveryPerHour: Math.round(recoveryPerHour * 100) / 100,
    netHpPerHour: Math.round(netHpPerHour * 100) / 100,
    affinityBreakdown: breakdown
  };
}

/**
 * Calculate harvesting stats for all node types
 */
export function calculateAllHarvestingStats(
  kamiData: MappedKamiData,
  harvestingMinutes: number = 60
): Record<NodeType, HarvestingStats> {
  const nodeTypes: NodeType[] = ['Scrap', 'Insect', 'Eerie', 'Normal'];

  const results: Partial<Record<NodeType, HarvestingStats>> = {};
  for (const nodeType of nodeTypes) {
    results[nodeType] = calculateHarvestingStats(kamiData, nodeType, harvestingMinutes);
  }

  return results as Record<NodeType, HarvestingStats>;
}

