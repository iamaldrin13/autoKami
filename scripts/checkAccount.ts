import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';
const RPC_URL = 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

// Account ID from previous scan (boom)
const TARGET_ACCOUNT_ID = process.argv[2] || '118352124236353540170325524228349033872394980044';

// Paths
const ABI_DIR = path.resolve(__dirname, '../abi');
const IDS_DIR = path.resolve(__dirname, '../ids');

// Helper to load ABI/IDs
function loadAbi(name: string) {
  const filePath = path.join(ABI_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function loadIds(name: string) {
  const filePath = path.join(IDS_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // 1. Setup Components
  const components = loadIds('components.json');
  const systems = loadIds('systems.json');
  const world = new ethers.Contract(WORLD_ADDRESS, loadAbi('World.json').abi, provider);
  
  // Resolve OwnsKamiID Address
  const registryAbi = loadAbi('IDOwnsKamiComponent.json').abi;
  const systemsRegistryAddress = await world.systems();
  const systemsRegistry = new ethers.Contract(systemsRegistryAddress, registryAbi, provider);
  const componentsRegistryAddress = await world.components();
  const componentsRegistry = new ethers.Contract(componentsRegistryAddress, registryAbi, provider);

  const getComponentAddr = async (encodedId: string) => {
      const entities = await componentsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
      if (entities.length === 0) throw new Error(`Component not found: ${encodedId}`);
      return ethers.getAddress('0x' + BigInt(entities[0]).toString(16).padStart(40, '0'));
  };

  const getSystemAddr = async (encodedId: string) => {
      const entities = await systemsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
      if (entities.length === 0) throw new Error(`System not found: ${encodedId}`);
      return ethers.getAddress('0x' + BigInt(entities[0]).toString(16).padStart(40, '0'));
  };

  const OwnsKamiAddress = await getComponentAddr(components.OwnsKamiID.encodedID);
  const KamiIndexAddress = await getComponentAddr(components.KamiIndex.encodedID);
  const GetterSystemAddress = await getSystemAddr(systems.GetterSystem.encodedID);

  console.log(`OwnsKamiID: ${OwnsKamiAddress}`);
  console.log(`KamiIndex: ${KamiIndexAddress}`);
  console.log(`GetterSystem: ${GetterSystemAddress}`);

  // 2. Contracts
  const OwnsKami = new ethers.Contract(OwnsKamiAddress, loadAbi('IDOwnsKamiComponent.json').abi, provider);
  const KamiIndex = new ethers.Contract(KamiIndexAddress, loadAbi('Uint32Component.json').abi, provider); // Assuming Uint32 for index
  const GetterSystem = new ethers.Contract(GetterSystemAddress, [
      ...loadAbi('GetterSystem.json').abi,
      "function getAccount(uint256 id) view returns (tuple(uint32 index, string name, int32 currStamina, uint32 room))"
  ], provider);

  // 3. Analyze Account
  console.log(`\n🔍 Analyzing Account #${TARGET_ACCOUNT_ID}...`);
  
  try {
      const accountData = await GetterSystem.getAccount(TARGET_ACCOUNT_ID);
      console.log(`\n👤 Account Details:`);
      console.log(`   Name: ${accountData.name}`);
      console.log(`   Room: ${accountData.room} (Node)`);
      console.log(`   Stamina: ${accountData.currStamina}`);
  } catch (e) {
      console.log(`   ⚠️ Could not fetch details via GetterSystem (Account might not exist or ABI mismatch)`);
  }

  // 4. Get Owned Kamis
  console.log(`\n🦕 Fetching Owned Kamigotchis...`);
  // IDOwnsKami maps AccountID -> [KamiEntityID]
  const kamiEntities = await OwnsKami.getFunction('getEntitiesWithValue(uint256)')(BigInt(TARGET_ACCOUNT_ID));
  
  console.log(`   Found ${kamiEntities.length} Kamis.`);

  for (const entityId of kamiEntities) {
      // Get Index
      let index = 'Unknown';
      try {
          if (await KamiIndex.has(entityId)) {
              index = (await KamiIndex.getFunction('get(uint256)')(entityId)).toString();
          }
      } catch (e) {}

      // Get Details
      try {
          const kami = await GetterSystem.getKami(entityId);
          console.log(`\n   🔹 Kami #${index} (${kami.name})`);
          console.log(`      ID: ${entityId}`);
          console.log(`      Room: ${kami.room}`);
          console.log(`      State: ${kami.state}`);
          
          // Check for match
          if (index === '980') {
              console.log(`      ✅ TARGET FOUND: Kami #980 is owned by this account!`);
          }
      } catch (e) {
          console.log(`      ❌ Error fetching data for ${entityId}`);
      }
  }
}

main().catch(console.error);
