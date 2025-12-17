import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';

const World = loadAbi('World.json');
const systems = loadIds('systems.json');

const WORLD_ADDRESS = process.env.WORLD_ADDRESS || '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';
const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Create World contract instance
const world = new ethers.Contract(WORLD_ADDRESS, World.abi, provider);

export interface ExecuteSystemCallParams {
  systemId: string;
  arguments?: string[];
  typedParams?: any[];
  privateKey: string;
}

/**
 * Get system address from World contract
 */
export async function getSystemAddress(systemId: string): Promise<string> {
  console.log(`[Transaction] Resolving address for system: ${systemId}`);
  let encodedId: string;
  if (systemId.startsWith('0x')) {
    encodedId = systemId;
  } else {
    const systemKey = Object.keys(systems).find(
      key => (systems as any)[key].id === systemId
    );
    if (!systemKey) {
      console.error(`[Transaction] System ID not found in mapping: ${systemId}`);
      throw new Error(`System ID not found: ${systemId}`);
    }
    encodedId = (systems as any)[systemKey].encodedID;
  }

  const systemsRegistryAddress = await world.systems();
  const systemsRegistryABI = loadAbi('IDOwnsKamiComponent.json');
  
  const systemsRegistry = new ethers.Contract(
    systemsRegistryAddress,
    systemsRegistryABI.abi,
    provider
  );

  const systemAddresses = await systemsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
  
  if (systemAddresses.length === 0) {
    console.error(`[Transaction] System address lookup failed for encoded ID: ${encodedId}`);
    throw new Error(`System address not found for: ${systemId}`);
  }

  const entityId = BigInt(systemAddresses[0].toString());
  const address = ethers.getAddress('0x' + entityId.toString(16).padStart(40, '0'));
  console.log(`[Transaction] Resolved ${systemId} to ${address}`);
  return address;
}

function loadSystemABI(systemId: string): any {
  const systemABIMap: Record<string, string> = {
    'system.harvest.start': 'HarvestStartSystem.json',
    'system.harvest.stop': 'HarvestStopSystem.json',
    'system.harvest.collect': 'HarvestCollectSystem.json',
    'system.harvest.liquidate': 'HarvestLiquidateSystem.json',
    'system.account.register': 'AccountRegisterSystem.json',
    'system.account.move': 'AccountMoveSystem.json',
    'system.account.set.name': 'AccountSetNameSystem.json',
    'system.account.set.operator': 'AccountSetOperatorSystem.json',
    'system.kami.name': 'KamiNameSystem.json',
    'system.kami.level': 'KamiLevelSystem.json',
    'system.kami.use.item': 'KamiUseItemSystem.json',
    'system.skill.upgrade': 'SkillUpgradeSystem.json',
    'system.skill.reset': 'SkillResetSystem.json',
    'system.craft': 'CraftSystem.json',
    'system.listing.sell': 'ListingSellSystem.json',
    'system.listing.buy': 'ListingBuySystem.json',
  };

  const abiFileName = systemABIMap[systemId];
  if (!abiFileName) {
    const parts = systemId.split('.');
    const systemName = parts[parts.length - 1];
    const inferredName = parts.slice(1).map((p, i) => 
      i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p
    ).join('') + 'System.json';
    
    // Assuming inferred name logic is acceptable fallback
    return loadAbi(inferredName);
  }

  return loadAbi(abiFileName);
}

export async function executeSystemCall(params: ExecuteSystemCallParams): Promise<ethers.ContractTransactionResponse> {
  const { systemId, arguments: args, typedParams, privateKey } = params;
  console.log(`[Transaction] Executing system call: ${systemId}`);

  const wallet = new ethers.Wallet(privateKey, provider);
  const systemAddress = await getSystemAddress(systemId);
  const systemABI = loadSystemABI(systemId);
  const system = new ethers.Contract(systemAddress, systemABI.abi, wallet);

  if (typedParams && typedParams.length > 0) {
    if (systemABI.abi.some((fn: any) => fn.name === 'executeTyped')) {
      console.log(`[Transaction] Calling executeTyped for ${systemId}`);
      return await system.executeTyped(...typedParams, { gasLimit: 172155 });
    }
  }

  if (args && args.length > 0) {
    console.log(`[Transaction] Calling execute(bytes) for ${systemId}`);
    const encodedArgs = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256'],
      [args[0]] 
    );
    return await system.execute(encodedArgs, { gasLimit: 172155 });
  }

  if (systemABI.abi.some((fn: any) => fn.name === 'executeTyped')) {
    console.log(`[Transaction] Calling executeTyped (no args) for ${systemId}`);
    return await system.executeTyped({ gasLimit: 172155 });
  }

  throw new Error('Unable to determine execution method. Provide either typedParams or arguments.');
}

