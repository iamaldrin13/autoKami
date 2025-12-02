import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSkillInfo, parseSkillBonus } from '../utils/skillMappings.js';

const WorldABI = loadAbi('World.json');
const SkillPointComponentABI = loadAbi('SkillPointComponent.json');
const IndexSkillComponentABI = loadAbi('IndexSkillComponent.json');
const IDOwnsSkillComponentABI = loadAbi('IDOwnsSkillComponent.json');
const components = loadIds('components.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';
const RPC_URL = 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const world = new ethers.Contract(WORLD_ADDRESS, WorldABI.abi, provider);

// Skill tree structure from trees.ts
const SKILL_TREES = {
  Predator: [[111, 112, 113], [121, 122, 123], [131, 132, 133], [141, 142, 143], [151, 152, 153], [161, 162, 163]],
  Enlightened: [[211, 212, 213], [221, 222, 223], [231, 232, 233], [241, 242, 243], [251, 252, 253], [261, 262, 263]],
  Guardian: [[311, 312, 313], [321, 322, 323], [331, 332, 333], [341, 342, 343], [351, 352, 353], [361, 362, 363]],
  Harvester: [[411, 412, 413], [421, 422, 423], [431, 432, 433], [441, 442, 443], [451, 452, 453], [461, 462, 463]],
};

// Tier unlock requirements (points needed to unlock each tier)
const TIER_UNLOCK_POINTS = [0, 5, 15, 25, 40, 55];

export interface SkillData {
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
}

export interface KamiSkills {
  totalPointsUsed: number;
  skills: SkillData[];
  unlockedTiers: number[]; // Array of tier numbers (0-5) that are unlocked
  skillBonuses: {
    power: number;
    health: number;
    harmony: number;
    violence: number;
    fertilityBoost: number; // For Harvester and Enlightened trees
  };
}

/**
 * Get component address from registry by component ID
 */
async function getComponentAddress(componentId: string): Promise<string> {
  const componentsRegistryAddress = await world.components();
  const componentRegistryABI = loadAbi('IDOwnsKamiComponent.json');

  const componentsRegistry = new ethers.Contract(
    componentsRegistryAddress,
    componentRegistryABI.abi,
    provider
  );

  const componentAddresses = await componentsRegistry.getFunction('getEntitiesWithValue(bytes)')(componentId);

  if (componentAddresses.length === 0) {
    throw new Error(`Component not found in registry: ${componentId}`);
  }

  const entityId = BigInt(componentAddresses[0].toString());
  return ethers.getAddress('0x' + entityId.toString(16).padStart(40, '0'));
}

/**
 * Determine which tier a skill index belongs to
 */
function getSkillTier(skillIndex: number): number {
  // Check each tree
  for (const [treeName, tiers] of Object.entries(SKILL_TREES)) {
    for (let tier = 0; tier < tiers.length; tier++) {
      if (tiers[tier].includes(skillIndex)) {
        return tier;
      }
    }
  }
  return -1; // Not found
}

/**
 * Determine which tree a skill index belongs to
 */
function getSkillTree(skillIndex: number): string {
  for (const [treeName, tiers] of Object.entries(SKILL_TREES)) {
    for (const tier of tiers) {
      if (tier.includes(skillIndex)) {
        return treeName;
      }
    }
  }
  return 'Unknown';
}

/**
 * Calculate skill bonuses based on skill levels
 * Note: This is a simplified calculation. Actual bonuses depend on skill definitions.
 * For now, we'll use a basic formula: each skill level adds a percentage bonus.
 */
function calculateSkillBonuses(skills: SkillData[]): {
  power: number;
  health: number;
  harmony: number;
  violence: number;
  fertilityBoost: number;
} {
  let power = 0;
  let health = 0;
  let harmony = 0;
  let violence = 0;
  let fertilityBoost = 0;

  for (const skill of skills) {
    // Each skill level contributes bonuses based on tree type
    // This is simplified - actual bonuses would come from skill registry data
    const levelBonus = skill.level;
    
    switch (skill.tree) {
      case 'Predator':
        // Predator tree focuses on Power and Violence
        power += levelBonus * 0.5; // 0.5 per level
        violence += levelBonus * 0.3;
        break;
      case 'Guardian':
        // Guardian tree focuses on Health and Harmony
        health += levelBonus * 2; // 2 HP per level
        harmony += levelBonus * 0.5;
        break;
      case 'Harvester':
        // Harvester tree focuses on Power and Fertility Boost
        power += levelBonus * 0.3;
        fertilityBoost += levelBonus * 0.05; // 5% per level (as mentioned in formulas)
        break;
      case 'Enlightened':
        // Enlightened tree focuses on balanced stats and Fertility Boost
        power += levelBonus * 0.2;
        health += levelBonus * 1;
        harmony += levelBonus * 0.3;
        fertilityBoost += levelBonus * 0.05; // 5% per level
        break;
    }
  }

  return {
    power,
    health,
    harmony,
    violence,
    fertilityBoost
  };
}

/**
 * Get all skills for a Kami
 * Queries IDOwnsSkillComponent to find skill entities, then gets index and points from each
 */
export async function getKamiSkills(kamiId: bigint): Promise<KamiSkills> {
  // Get component addresses
  const ownsSkillAddress = await getComponentAddress((components as any).OwnsSkillID.encodedID);
  const skillIndexAddress = await getComponentAddress((components as any).SkillIndex.encodedID);
  const skillPointAddress = await getComponentAddress((components as any).SkillPoint.encodedID);

  // Create component contract instances
  const ownsSkillComponent = new ethers.Contract(ownsSkillAddress, IDOwnsSkillComponentABI.abi, provider);
  const skillIndexComponent = new ethers.Contract(skillIndexAddress, IndexSkillComponentABI.abi, provider);
  const skillPointComponent = new ethers.Contract(skillPointAddress, SkillPointComponentABI.abi, provider);

  // Query all skill entity IDs owned by this Kami
  const skillEntityIds = await ownsSkillComponent.getFunction('getEntitiesWithValue(uint256)')(kamiId);

  // Build skills array from skill entities
  const skills: SkillData[] = [];
  let totalPointsUsed = 0;

  for (const entityIdBigNum of skillEntityIds) {
    const entityId = BigInt(entityIdBigNum.toString());

    try {
      // Get skill index and points
      const hasIndex = await skillIndexComponent.has(entityId);
      const hasPoints = await skillPointComponent.has(entityId);

      if (hasIndex && hasPoints) {
        const skillIndex = Number(await skillIndexComponent.getFunction('safeGet(uint256)')(entityId));
        const points = Number(await skillPointComponent.getFunction('safeGet(uint256)')(entityId));

        if (points > 0) {
          const skillInfo = getSkillInfo(skillIndex);
          const tier = skillInfo?.tier ? skillInfo.tier - 1 : getSkillTier(skillIndex); // CSV uses 1-indexed tiers
          const tree = skillInfo?.tree || getSkillTree(skillIndex);

          const skillBonusStr = skillInfo?.skillBonus || 'Unknown';
          const parsedBonus = parseSkillBonus(skillBonusStr);

          // Calculate finalSkillBonus = skillBonus * level
          const finalSkillBonus = parsedBonus ? {
            type: parsedBonus.type,
            value: parsedBonus.value * points, // skillBonus * level
            isPercent: parsedBonus.isPercent,
            isPerHour: parsedBonus.isPerHour
          } : null;

          skills.push({
            index: skillIndex,
            name: skillInfo?.name || `Skill ${skillIndex}`,
            level: points,
            pointsAllocated: points,
            tier,
            tree,
            skillBonus: skillBonusStr,
            finalSkillBonus,
            imageUrl: skillInfo?.imageUrl || ''
          });

          totalPointsUsed += points;
        }
      }
    } catch (error) {
      // Skip entities that fail to query
      console.warn(`Failed to query skill entity ${entityId}:`, error);
    }
  }

  // Determine unlocked tiers based on total points used
  const unlockedTiers: number[] = [];
  for (let tier = 0; tier < TIER_UNLOCK_POINTS.length; tier++) {
    if (totalPointsUsed >= TIER_UNLOCK_POINTS[tier]) {
      unlockedTiers.push(tier);
    }
  }

  // Calculate skill bonuses
  const skillBonuses = calculateSkillBonuses(skills);

  return {
    totalPointsUsed,
    skills,
    unlockedTiers,
    skillBonuses
  };
}

