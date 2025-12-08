import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RPC_URL = 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const GETTER_SYSTEM_ADDRESS = '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';

// Paths
const ABI_DIR = path.resolve(__dirname, '../abi');

function loadAbi(name: string) {
  const filePath = path.join(ABI_DIR, name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  const getterAbi = [
      ...loadAbi('GetterSystem.json').abi,
      "function getAccount(uint256 id) view returns (tuple(uint32 index, string name, int32 currStamina, uint32 room))",
      "function getAccountByIndex(uint32 index) view returns (tuple(uint256 id, uint32 index, string name, int32 currStamina, uint32 room))", // Hypothetical
      "function getAccountsCount() view returns (uint256)"
  ];
  
  const getter = new ethers.Contract(GETTER_SYSTEM_ADDRESS, getterAbi, provider);

  // Test Case 1: ID (Known from previous step)
  const knownId = "118352124236353540170325524228349033872394980044";
  console.log(`\n--- Testing Lookup by ID: ${knownId} ---`);
  try {
      const acc = await getter.getAccount(BigInt(knownId));
      console.log(`✅ Found: ${acc.name} (Index: ${acc.index})`);
  } catch(e) {
      console.log(`❌ Failed by ID: ${e.message}`);
  }

  // Test Case 2: Index (Hypothetically 2851, or the index found above)
  // Let's first check the count
  try {
      const count = await getter.getAccountsCount();
      console.log(`\nTotal Accounts: ${count}`);
  } catch(e) { console.log("\nCould not fetch account count"); }

  const testIndex = 2851;
  console.log(`\n--- Testing Lookup by Index: ${testIndex} ---`);
  try {
      // Try to guess the function signature if getAccountByIndex doesn't exist
      // Often it's implemented if getKamiByIndex exists
      const acc = await getter.getAccountByIndex(testIndex);
      console.log(`✅ Found: ${acc.name} (ID: ${acc.id})`);
  } catch(e) {
      console.log(`❌ Failed by Index: ${e.shortMessage || 'Function likely does not exist'}`);
  }

  // Test Case 3: Name "boom"
  // There is no direct name lookup in GetterSystem typically. 
  // It would require hashing the name and checking a map, but names are usually stored in NameComponent.
  // To do Name -> ID, we'd need to check the `Name` component reverse mapping if it exists (usually doesn't), 
  // or iterate (slow). 
  console.log(`\n--- Testing Lookup by Name: "boom" ---`);
  console.log(`ℹ️  On-chain name lookup is usually not indexed reversely.`);
  
}

main().catch(console.error);
