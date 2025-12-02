import { getKamiById, getKamiByIndex, MappedKamiData } from './kamiService.js';
import { getKamiSkills, KamiSkills } from './skillService.js';
import { ethers } from 'ethers';
import { loadAbi } from '../utils/contractLoader.js';

// Dynamically load ABIs
const World = loadAbi('World.json');
const GetterSystem = loadAbi('GetterSystem.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const GETTER_SYSTEM_ADDRESS = '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const getterSystem = new ethers.Contract(GETTER_SYSTEM_ADDRESS, GetterSystem.abi, provider);

export interface FarmingStats {
  kami: MappedKamiData;
  skills: KamiSkills;
  finalStats: {
    health: number;
    power: number;
    harmony: number;
    violence: number;
  };
  harvestOutput: {
    baseMUSUPerHour: number;
    intensityMultiplier: number;
    affinityBonus: number;
    fertilityBoost: number;
    totalMUSUPerHour: number;
    estimatedMUSU: number; 
  };
  regeneration: {
    healthRegenPerSecond: number;
    staminaRegenPerSecond: number;
    timeToFullHealth: number; 
    timeToFullStamina: number; 
  };
  nodeInfo?: {
    index: number;
    name: string;
    affinity: string;
  };
}

function calculateAffinityBonus(
  bodyType: string,
  handType: string,
  nodeType: string,
  fertilityBoost: number = 0
): number {
  let affinityBonus = 1.0; 

  if (bodyType === 'NORMAL') {
  } else if (bodyType === nodeType) {
    affinityBonus += 0.65 + fertilityBoost;
  } else {
    affinityBonus -= 0.25;
  }

  if (handType === 'NORMAL') {
  } else if (handType === nodeType) {
    affinityBonus += 0.35 + fertilityBoost;
  } else {
    affinityBonus -= 0.10;
  }

  return affinityBonus;
}

function calculateHarvestOutputInternal(
  kami: MappedKamiData,
  skills: KamiSkills,
  nodeType: string | undefined,
  duration: number
): {
  baseMUSUPerHour: number;
  intensityMultiplier: number;
  affinityBonus: number;
  fertilityBoost: number;
  totalMUSUPerHour: number;
  estimatedMUSU: number;
} {
  const finalPower = kami.stats.power.sync + skills.skillBonuses.power;
  const baseMUSUPerHour = Math.max(0, finalPower);

  const intensityMultiplier = 1.0 + (Math.min(duration, 3600) / 3600) * 0.5; 

  const fertilityBoost = skills.skillBonuses.fertilityBoost;

  let affinityBonus = 1.0;
  if (nodeType && kami.traits.body && kami.traits.hand) {
    const bodyType = kami.traits.body.type || 'NORMAL';
    const handType = kami.traits.hand.type || 'NORMAL';
    affinityBonus = calculateAffinityBonus(bodyType, handType, nodeType, fertilityBoost);
  }

  const totalMUSUPerHour = baseMUSUPerHour * intensityMultiplier * affinityBonus;

  const estimatedMUSU = (totalMUSUPerHour / 3600) * duration;

  return {
    baseMUSUPerHour,
    intensityMultiplier,
    affinityBonus,
    fertilityBoost,
    totalMUSUPerHour,
    estimatedMUSU: Math.max(0, estimatedMUSU)
  };
}

function calculateRegeneration(kami: MappedKamiData, skills: KamiSkills): {
  healthRegenPerSecond: number;
  staminaRegenPerSecond: number;
  timeToFullHealth: number;
  timeToFullStamina: number;
} {
  const finalHarmony = kami.stats.harmony.sync + skills.skillBonuses.harmony;
  const healthRegenPerSecond = Math.max(0, finalHarmony) / 3600; 

  const maxStamina = 100; 
  const currentStamina = 100; 
  const staminaRegenPerSecond = maxStamina / 3600; 

  const finalMaxHealth = kami.stats.health.sync + skills.skillBonuses.health;
  const currentHealth = kami.stats.health.base;
  const healthDeficit = finalMaxHealth - currentHealth;
  const timeToFullHealth = healthDeficit > 0 && healthRegenPerSecond > 0
    ? healthDeficit / healthRegenPerSecond
    : 0;

  const staminaDeficit = maxStamina - currentStamina;
  const timeToFullStamina = staminaDeficit > 0 && staminaRegenPerSecond > 0
    ? staminaDeficit / staminaRegenPerSecond
    : 0;

  return {
    healthRegenPerSecond,
    staminaRegenPerSecond,
    timeToFullHealth,
    timeToFullStamina
  };
}

async function getNodeInfo(nodeIndex: number | undefined): Promise<{ index: number; name: string; affinity: string } | undefined> {
  if (nodeIndex === undefined) {
    return undefined;
  }

  try {
    // Get node data from GetterSystem
    // Note: Ensure getNode exists on ABI or use specific call
    const nodeData = await getterSystem.getNode(nodeIndex);
    
    return {
      index: nodeIndex,
      name: `Node ${nodeIndex}`, 
      affinity: 'UNKNOWN' 
    };
  } catch (error) {
    console.warn(`Failed to get node info for index ${nodeIndex}:`, error);
    return undefined;
  }
}

export async function getFarmingStats(
  kamiIdOrIndex: bigint | number,
  nodeIndex?: number,
  duration: number = 3600
): Promise<FarmingStats> {
  let kami: MappedKamiData;
  let kamiId: bigint;
  
  if (typeof kamiIdOrIndex === 'number' && kamiIdOrIndex < 1e10) {
    kami = await getKamiByIndex(kamiIdOrIndex);
    kamiId = BigInt(kami.id);
  } else {
    kamiId = typeof kamiIdOrIndex === 'bigint' ? kamiIdOrIndex : BigInt(kamiIdOrIndex);
    kami = await getKamiById(kamiId);
  }

  const skills = await getKamiSkills(kamiId);

  const finalStats = {
    health: kami.stats.health.sync + skills.skillBonuses.health,
    power: kami.stats.power.sync + skills.skillBonuses.power,
    harmony: kami.stats.harmony.sync + skills.skillBonuses.harmony,
    violence: kami.stats.violence.sync + skills.skillBonuses.violence,
  };

  const nodeInfo = await getNodeInfo(nodeIndex);
  const nodeType = nodeInfo?.affinity;

  const harvestOutput = calculateHarvestOutputInternal(kami, skills, nodeType, duration);

  const regeneration = calculateRegeneration(kami, skills);

  return {
    kami,
    skills,
    finalStats,
    harvestOutput,
    regeneration,
    nodeInfo
  };
}

export async function calculateHarvestOutput(
  kamiIdOrIndex: bigint | number,
  nodeIndex?: number,
  duration: number = 3600
): Promise<FarmingStats['harvestOutput']> {
  const stats = await getFarmingStats(kamiIdOrIndex, nodeIndex, duration);
  return stats.harvestOutput;
}

export async function calculateRegenerationTime(
  kamiIdOrIndex: bigint | number
): Promise<FarmingStats['regeneration']> {
  const stats = await getFarmingStats(kamiIdOrIndex);
  return stats.regeneration;
}