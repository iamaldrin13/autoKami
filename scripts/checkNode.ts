import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';
const RPC_URL = 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const NODE_INDEX = process.argv[2] ? parseInt(process.argv[2]) : 72;

// Encoded IDs
const IDS = {
  IndexRoomComponent: '0x3be9611062b8582cf4b9a4eafe577dbde7dcd7779a1efb46d73e212026c4b0cc',
  IndexNodeComponent: '0x076fae2ce684ff843e499be243657d8fb16b0eb71350c7a9da8fa7be44c14f3e',
  LocationComponent: '0x1d80d8bc36212886f1cd16bb0e8f17892d2237a9ad83cebdcec1f76b3c52d19f',
  IndexAccountComponent: '0x70cc041351935ace62b695dbbdf5596e58eca0b3e88afa19b17d006c9a058dc0',
  IndexKamiComponent: '0xcd6257c5a7fd5523bf675476a783746b8e1aed9c92992221af0f776ac5562b34',
  GetterSystem: '0xde291686da058fbcb5e9a4b6a8b07d5decdc9964821cd22748ad21dd0f623d31'
};

// Paths
const ABI_DIR = path.resolve(__dirname, '../abi');

// Helper to load ABI
function loadAbi(name: string) {
  const filePath = path.join(ABI_DIR, name);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const worldAbi = loadAbi('World.json');
  const world = new ethers.Contract(WORLD_ADDRESS, worldAbi.abi, provider);

  // 1. Get Registries
  const systemsRegistryAddress = await world.systems();
  const componentsRegistryAddress = await world.components();
  
  const registryAbi = loadAbi('IDOwnsKamiComponent.json').abi;
  const systemsRegistry = new ethers.Contract(systemsRegistryAddress, registryAbi, provider);
  const componentsRegistry = new ethers.Contract(componentsRegistryAddress, registryAbi, provider);

  // 2. Resolve Addresses
  const addresses: Record<string, string> = {};
  
  // Resolve Components
  const componentIds = ['IndexRoomComponent', 'IndexNodeComponent', 'LocationComponent', 'IndexAccountComponent', 'IndexKamiComponent'];
  for (const name of componentIds) {
    const encodedId = IDS[name as keyof typeof IDS];
    const entities = await componentsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
    if (entities.length === 0) {
      console.error(`Could not resolve address for ${name}`);
      continue;
    }
    const entityId = BigInt(entities[0]);
    addresses[name] = ethers.getAddress('0x' + entityId.toString(16).padStart(40, '0'));
    console.log(`Resolved ${name}: ${addresses[name]}`);
  }

  // Resolve System
  const systemIds = ['GetterSystem'];
  for (const name of systemIds) {
    const encodedId = IDS[name as keyof typeof IDS];
    const entities = await systemsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
    if (entities.length === 0) {
      console.error(`Could not resolve address for ${name}`);
      continue;
    }
    const entityId = BigInt(entities[0]);
    addresses[name] = ethers.getAddress('0x' + entityId.toString(16).padStart(40, '0'));
    console.log(`Resolved ${name}: ${addresses[name]}`);
  }

  // 3. Contracts
  const indexAccount = new ethers.Contract(addresses.IndexAccountComponent, loadAbi('IndexAccountComponent.json').abi, provider);
  const indexKami = new ethers.Contract(addresses.IndexKamiComponent, loadAbi('IndexKamiComponent.json').abi, provider);
  // Use custom ABI for GetterSystem to include getAccount and getKamisCount
  const getterAbi = [
      ...loadAbi('GetterSystem.json').abi,
      "function getAccount(uint256 id) view returns (tuple(uint32 index, string name, int32 currStamina, uint32 room))",
      "function getKamisCount() view returns (uint256)"
  ];
  const getterSystem = new ethers.Contract(addresses.GetterSystem, getterAbi, provider);

  // 4. Query Room 72
  console.log(`Checking Node ${NODE_INDEX}...`);
  
  const tryQuery = async (name: string, address: string, encodingType: 'uint256' | 'bytes32' | 'bytes4') => {
      if (!address) return;
      
      const contract = new ethers.Contract(address, loadAbi('IDRoomComponent.json').abi, provider); // Use interface with both
      try {
          let entities;
          if (encodingType === 'uint256') {
              entities = await contract.getFunction('getEntitiesWithValue(uint256)')(BigInt(NODE_INDEX));
          } else if (encodingType === 'bytes32') {
              const encoded = ethers.AbiCoder.defaultAbiCoder().encode(['uint32'], [NODE_INDEX]);
              entities = await contract.getFunction('getEntitiesWithValue(bytes)')(encoded);
          } else if (encodingType === 'bytes4') {
              const encoded = ethers.solidityPacked(['uint32'], [NODE_INDEX]);
              entities = await contract.getFunction('getEntitiesWithValue(bytes)')(encoded);
          }
          
          console.log(`[${name}] Success with ${encodingType}! Found ${entities.length} entities.`);
          return entities;
      } catch (e: any) {
          // console.log(`[${name}] Failed with ${encodingType}`);
      }
      return null;
  };

  let entities: any[] | null = null;
  
  // Try IndexRoomComponent
  entities = await tryQuery('IndexRoomComponent', addresses.IndexRoomComponent, 'uint256') || 
             await tryQuery('IndexRoomComponent', addresses.IndexRoomComponent, 'bytes32') ||
             await tryQuery('IndexRoomComponent', addresses.IndexRoomComponent, 'bytes4');

  if (!entities) {
      // Try IndexNodeComponent
      entities = await tryQuery('IndexNodeComponent', addresses.IndexNodeComponent, 'uint256') || 
                 await tryQuery('IndexNodeComponent', addresses.IndexNodeComponent, 'bytes32') ||
                 await tryQuery('IndexNodeComponent', addresses.IndexNodeComponent, 'bytes4');
  }
  
  if (!entities) {
      // Try LocationComponent
      entities = await tryQuery('LocationComponent', addresses.LocationComponent, 'uint256') || 
                 await tryQuery('LocationComponent', addresses.LocationComponent, 'bytes32') ||
                 await tryQuery('LocationComponent', addresses.LocationComponent, 'bytes4');
  }

  const accounts: any[] = [];
  const kamis: any[] = [];
  const others: any[] = [];

  if (entities && entities.length > 0) {
      console.log(`Found ${entities.length} entities via Component Query.`);
      for (const entity of entities) {
        const entityId = BigInt(entity);
        // Check if Account
        const isAccount = await indexAccount.has(entityId);
        if (isAccount) {
            try {
                const acc = await getterSystem.getAccount(entityId);
                accounts.push({ id: entityId.toString(), name: acc.name, room: Number(acc.room) });
            } catch(e) { accounts.push({ id: entityId.toString(), error: "Fetch failed" }); }
            continue;
        }

        // Check if Kami
        const isKami = await indexKami.has(entityId);
        if (isKami) {
          try {
            const kami = await getterSystem.getKami(entityId);
            kamis.push({
                id: kami.id.toString(),
                name: kami.name,
                state: kami.state,
                account: kami.account.toString(),
                room: Number(kami.room)
            });
          } catch (e) {
            console.error(`Error fetching kami ${entityId}:`, e);
          }
          continue;
        }

        others.push(entityId.toString());
      }
  } else {
      console.log("Component query returned 0 or failed. Falling back to scanning Kamis...");
      try {
          // const count = Number(await getterSystem.getKamisCount()); // Failed
          // console.log(`Total Kamis: ${count}`);
          
          const SCAN_LIMIT = 2000;
          console.log(`Scanning first ${SCAN_LIMIT} indices...`);
          let failures = 0;
          // Iterate all Kamis
          for(let i=0; i<SCAN_LIMIT; i++) {
              try {
                  const kami = await getterSystem.getKamiByIndex(i);
                  failures = 0; // Reset failure count on success
                  
                  if (Number(kami.room) === NODE_INDEX) {
                      kamis.push({
                          id: kami.id.toString(),
                          name: kami.name,
                          state: kami.state,
                          account: kami.account.toString(),
                          room: Number(kami.room)
                      });
                      
                      // Also check owner
                      try {
                          const acc = await getterSystem.getAccount(kami.account);
                          // Check if account is also in the room (might be separate)
                          if (Number(acc.room) === NODE_INDEX) {
                              if (!accounts.find(a => a.id === kami.account.toString())) {
                                  accounts.push({ id: kami.account.toString(), name: acc.name, room: Number(acc.room) });
                              }
                          }
                      } catch(e) {}
                  }
              } catch(e) { 
                  failures++;
                  if (failures > 5) break; // Stop after 5 consecutive failures
              }
              if (i % 10 === 0) process.stdout.write('.');
          }
          console.log(" Done.");
      } catch(e) {
          console.error("Scanning failed:", e);
      }
  }

  console.log('\n--- ACCOUNTS AT NODE 72 ---');
  if (accounts.length === 0) console.log('None found');
  accounts.forEach(acc => console.log(`Account #${acc.id} (${acc.name})`));

  console.log('\n--- KAMIS AT NODE 72 ---');
  if (kamis.length === 0) console.log('None found');
  kamis.forEach(k => {
    console.log(`Kami #${k.id} (${k.name}) - State: ${k.state} - Owner: ${k.account}`);
  });
}

main().catch(console.error);