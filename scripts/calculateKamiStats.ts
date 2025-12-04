import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials from .env.example for this calculation
const SUPABASE_URL = 'https://lsvpxuysdrcahqctdkyn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzdnB4dXlzZHJjYWhxY3Rka3luIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ2NjcyMSwiZXhwIjoyMDgwMDQyNzIxfQ.ENmSbCdQ5ByPjPKqsQqMpq_lJG85PblWy2DIeqitSiw';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in app/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Node type mapping
const NODE_TYPES: Record<number, string> = {
  0: 'normal',
  1: 'insect',
  2: 'eerie',
  3: 'scrap'
};

interface KamiStats {
  health: number;
  power: number;
  harmony: number;
  violence: number;
}

interface KamiData {
  kami_index: number;
  kami_name: string;
  level: number;
  final_stats: KamiStats;
  affinities: string[];
  state: string;
}

// Calculate affinity bonus based on Kami affinities and node type
function calculateAffinityBonus(affinities: string[], nodeType: string, fertilityBoost: number = 0): number {
  let affinityBonus = 1;

  // Affinities array typically has [bodyType, handType]
  const bodyType = affinities[0]?.toLowerCase() || 'normal';
  const handType = affinities[1]?.toLowerCase() || 'normal';

  // Body calculations (2.6x more impact than hands)
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

  return affinityBonus;
}

// Calculate harvest fertility
function calculateHarvestFertility(affinityBonus: number, power: number): number {
  return affinityBonus * 1.5 * power;
}

// Calculate intensity at a given time (in minutes)
function calculateIntensity(violence: number, timeHarvesting: number, intensityBoost: number = 0): number {
  return ((10 + intensityBoost) / 480) * ((5 * violence) + timeHarvesting);
}

// Calculate MUSU per hour
function calculateMusuPerHour(
  harvestFertility: number,
  harvestIntensity: number,
  bountyBoost: number = 0
): number {
  return (1 + bountyBoost) * (harvestFertility + harvestIntensity);
}

// Calculate strain (HP loss per hour)
function calculateStrain(
  musuGained: number,
  harmony: number,
  strainDecrease: number = 0
): number {
  return (6.5 * (1 - strainDecrease) * musuGained) / (harmony + 20);
}

// Calculate recovery (HP gain per hour while resting)
function calculateRecovery(harmony: number, metabolismBoost: number = 0): number {
  return 1.2 * harmony * (1 + metabolismBoost);
}

async function calculateKamiStats(kamiIndex: number, nodeIndex: number) {
  console.log(`\n🔍 Fetching Kami #${kamiIndex} data from Supabase...`);

  // Query Supabase for Kami data
  const { data: kami, error } = await supabase
    .from('kamigotchis')
    .select('kami_index, kami_name, level, final_stats, affinities, state')
    .eq('kami_index', kamiIndex)
    .single();

  if (error) {
    console.error('❌ Error fetching Kami:', error.message);
    return;
  }

  if (!kami) {
    console.error(`❌ Kami #${kamiIndex} not found in database`);
    return;
  }

  const nodeType = NODE_TYPES[nodeIndex] || 'normal';

  console.log(`\n📊 Kami #${kami.kami_index} - ${kami.kami_name}`);
  console.log(`Level: ${kami.level}`);
  console.log(`State: ${kami.state}`);
  console.log(`Affinities: ${kami.affinities.join('/')}`);
  console.log(`Node Type: ${nodeType.toUpperCase()}`);
  console.log(`\n📈 Final Stats:`);
  console.log(`  Health: ${kami.final_stats.health}`);
  console.log(`  Power: ${kami.final_stats.power}`);
  console.log(`  Harmony: ${kami.final_stats.harmony}`);
  console.log(`  Violence: ${kami.final_stats.violence}`);

  // Query for skill bonuses from final_stats
  console.log(`\n🎯 Skill Bonuses (from final_stats):`);

  const fertilityBoost = (kami.final_stats as any).fertilityMultiplier
    ? ((kami.final_stats as any).fertilityMultiplier - 1)
    : 0;
  const bountyBoost = (kami.final_stats as any).bountyMultiplier
    ? ((kami.final_stats as any).bountyMultiplier - 1)
    : 0;
  const intensityBoost = (kami.final_stats as any).intensityBoost || 0;
  const strainDecrease = (kami.final_stats as any).strainMultiplier
    ? (1 - (kami.final_stats as any).strainMultiplier)
    : 0;
  const metabolismBoost = (kami.final_stats as any).metabolismMultiplier
    ? ((kami.final_stats as any).metabolismMultiplier - 1)
    : 0;

  console.log(`  Fertility Boost: ${(fertilityBoost * 100).toFixed(1)}%`);
  console.log(`  Bounty Boost: ${(bountyBoost * 100).toFixed(1)}%`);
  console.log(`  Intensity Boost: ${intensityBoost}/hr`);
  console.log(`  Strain Decrease: ${(strainDecrease * 100).toFixed(1)}%`);
  console.log(`  Metabolism Boost: ${(metabolismBoost * 100).toFixed(1)}%`);

  // Calculate affinity bonus
  const affinityBonus = calculateAffinityBonus(kami.affinities, nodeType, fertilityBoost);

  // Calculate harvest fertility
  const harvestFertility = calculateHarvestFertility(affinityBonus, kami.final_stats.power);

  // Calculate intensity at t=0 (start) and t=60 (1 hour)
  const intensityStart = calculateIntensity(kami.final_stats.violence, 0, intensityBoost);
  const intensity1Hour = calculateIntensity(kami.final_stats.violence, 60, intensityBoost);

  // Calculate MUSU per hour (at start)
  const musuPerHourStart = calculateMusuPerHour(harvestFertility, intensityStart, bountyBoost);
  const musuPerHour1Hour = calculateMusuPerHour(harvestFertility, intensity1Hour, bountyBoost);

  // Calculate strain (HP loss per hour)
  const strainStart = calculateStrain(musuPerHourStart, kami.final_stats.harmony, strainDecrease);
  const strain1Hour = calculateStrain(musuPerHour1Hour, kami.final_stats.harmony, strainDecrease);

  // Calculate recovery
  const recovery = calculateRecovery(kami.final_stats.harmony, metabolismBoost);

  console.log(`\n⚡ CALCULATIONS FOR ${nodeType.toUpperCase()} NODE:`);
  console.log(`\n1️⃣  Affinity Bonus: ${affinityBonus.toFixed(2)}x`);
  console.log(`2️⃣  Harvest Fertility: ${harvestFertility.toFixed(2)}`);
  console.log(`\n3️⃣  Intensity:`);
  console.log(`   At Start (t=0): ${intensityStart.toFixed(4)}`);
  console.log(`   After 1 Hour: ${intensity1Hour.toFixed(4)}`);
  console.log(`\n4️⃣  MUSU per Hour:`);
  console.log(`   At Start: ${musuPerHourStart.toFixed(2)} MUSU/hr`);
  console.log(`   After 1 Hour: ${musuPerHour1Hour.toFixed(2)} MUSU/hr`);
  console.log(`\n5️⃣  Strain (HP Loss):`);
  console.log(`   At Start: ${strainStart.toFixed(2)} HP/hr`);
  console.log(`   After 1 Hour: ${strain1Hour.toFixed(2)} HP/hr`);
  console.log(`\n6️⃣  Recovery (While Resting): ${recovery.toFixed(2)} HP/hr`);

  // Calculate estimated time to death
  const currentHealth = kami.final_stats.health;
  const hoursToDeathStart = currentHealth / strainStart;
  const hoursToDeathAvg = currentHealth / ((strainStart + strain1Hour) / 2);

  console.log(`\n⏱️  SUSTAINABILITY:`);
  console.log(`   Current Health: ${currentHealth} HP`);
  console.log(`   Time to 0 HP (constant start rate): ${hoursToDeathStart.toFixed(1)} hours`);
  console.log(`   Time to 0 HP (avg rate): ${hoursToDeathAvg.toFixed(1)} hours`);
  console.log(`   Net HP/hr (harvest-recovery): ${(recovery - strainStart).toFixed(2)} HP/hr`);

  // Summary
  console.log(`\n📋 SUMMARY:`);
  if (affinityBonus > 1.5) {
    console.log(`   ✅ Good affinity match for ${nodeType} node`);
  } else if (affinityBonus < 1) {
    console.log(`   ⚠️  Poor affinity match for ${nodeType} node`);
  } else {
    console.log(`   ➖ Neutral affinity for ${nodeType} node`);
  }

  if (recovery > strainStart) {
    console.log(`   ✅ Sustainable: Recovery > Strain`);
  } else {
    console.log(`   ❌ Not sustainable: Strain > Recovery`);
  }

  console.log(`\n💡 NOTE: Calculations include actual skill bonuses from database.\n`);
}

// Main execution
const kamiIndex = parseInt(process.argv[2]) || 625;
const nodeIndex = parseInt(process.argv[3]) || 1; // 1 = Insect

calculateKamiStats(kamiIndex, nodeIndex)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
