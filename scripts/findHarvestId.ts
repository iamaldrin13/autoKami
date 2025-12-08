import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';

// Target Kami (boom's Kami #980)
const TARGET_KAMI_ID = '90744872039007326162727949324238766027944830217727694520394257942237350478642';

const IDS = {
  StartTime: '0x9ee42634d52dbd5a24ad226010389fb7306af59bdaec5e20547162dd896dacad',
  TargetID: '0x62e5c3a731a312a02bd0a6e08720624c014a22c9f60c82fede06a9606c505815', // component.id.target
  SourceID: '0xc81ce03c0ce7d95786aa8f43fb06c16da8357e856cb08b2052b4bf1807cf8ab3'  // component.id.source
};

const ABI_DIR = path.resolve(__dirname, '../abi');
function loadAbi(name: string) {
  const filePath = path.join(ABI_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const world = new ethers.Contract(WORLD_ADDRESS, loadAbi('World.json').abi, provider);
  const componentsRegistryAddress = await world.components();
  const registryAbi = loadAbi('IDOwnsKamiComponent.json').abi;
  const componentsRegistry = new ethers.Contract(componentsRegistryAddress, registryAbi, provider);

  // Helper to get address
  const getAddr = async (encodedId: string) => {
      const entities = await componentsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
      if (entities.length === 0) throw new Error(`Component not found: ${encodedId}`);
      return ethers.getAddress('0x' + BigInt(entities[0]).toString(16).padStart(40, '0'));
  };

  const StartTimeAddr = await getAddr(IDS.StartTime);
  const TargetIDAddr = await getAddr(IDS.TargetID);
  // const SourceIDAddr = await getAddr(IDS.SourceID);

  console.log('TargetID Address:', TargetIDAddr);

  // Contracts
  // TargetID maps Entity -> TargetEntityID (KamiID)
  // So we want to find Entity where Value == KamiID
  const TargetID = new ethers.Contract(TargetIDAddr, [
      "function getEntitiesWithValue(uint256 value) view returns (uint256[])",
      "function get(uint256 entity) view returns (uint256)"
  ], provider);

  const StartTime = new ethers.Contract(StartTimeAddr, [
      "function has(uint256 entity) view returns (bool)",
      "function get(uint256 entity) view returns (uint256)"
  ], provider);

  console.log(`Scanning for entities targeting Kami #${TARGET_KAMI_ID}...`);
  
  try {
      const entities = await TargetID.getEntitiesWithValue(BigInt(TARGET_KAMI_ID));
      console.log(`Found ${entities.length} referencing entities.`);

      for (const entityId of entities) {
          const id = BigInt(entityId);
          // Check if it has a StartTime (implies active process)
          const hasStart = await StartTime.has(id);
          if (hasStart) {
              const start = await StartTime.get(id);
              const startDate = new Date(Number(start) * 1000);
              console.log(`
🔥 CANDIDATE HARVEST ID: ${id}`);
              console.log(`   Started: ${startDate.toLocaleString()}`);
              console.log(`   Timestamp: ${start}`);
          } else {
              console.log(`   Entity ${id} references Kami but has no StartTime.`);
          }
      }

  } catch (e) {
      console.error("Error scanning TargetID:", e);
  }
}

main().catch(console.error);
