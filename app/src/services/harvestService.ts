import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';

// Load ABIs and Config dynamically
const World = loadAbi('World.json');
const HarvestStartSystem = loadAbi('HarvestStartSystem.json');
const HarvestStopSystem = loadAbi('HarvestStopSystem.json');
const HarvestCollectSystem = loadAbi('HarvestCollectSystem.json');
const DamageComponent = loadAbi('DamageComponent.json');
const SYSTEMS = loadIds('systems.json');
const COMPONENTS = loadIds('components.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const WORLD_ADDRESS = process.env.WORLD_ADDRESS || '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';
const GETTER_SYSTEM_ADDRESS = process.env.GETTER_SYSTEM_ADDRESS || '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Create World contract instance
const world = new ethers.Contract(WORLD_ADDRESS, World.abi, provider);

export interface HarvestParams {
  kamiId: string;
  nodeIndex: number;
  privateKey: string;
}

export interface StopHarvestParams {
  kamiId: string;
  privateKey: string;
}

export interface HarvestResult {
  success: boolean;
  txHash?: string;
  harvestId?: string;
  error?: string;
}

// Helper to get system address
async function getSystemAddress(systemId: string): Promise<string> {
  // Implementation reusing transactionService logic or simpler lookup if ID is known
  const { getSystemAddress } = await import('./transactionService.js');
  return getSystemAddress(systemId);
}

export async function startHarvest(params: HarvestParams): Promise<HarvestResult> {
  try {
    const { kamiId, nodeIndex, privateKey } = params;
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const systemId = SYSTEMS.HarvestStartSystem.encodedID;
    const systemAddress = await getSystemAddress(systemId);
    const contract = new ethers.Contract(systemAddress, HarvestStartSystem.abi, wallet);

    console.log(`[Harvest] Starting harvest for Kami ${kamiId} at Node ${nodeIndex}`);
    
    // Execute
    const tx = await contract.executeTyped(BigInt(kamiId), BigInt(nodeIndex), { gasLimit: 2000000 });
    console.log(`[Harvest] Tx submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (receipt.status === 1) {
        return { success: true, txHash: tx.hash };
    } else {
        return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Harvest] Start failed:', error);
    return { success: false, error: error.message };
  }
}

export async function stopHarvestByKamiId(kamiId: string, privateKey: string): Promise<HarvestResult> {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const systemId = SYSTEMS.HarvestStopSystem.encodedID;
    const systemAddress = await getSystemAddress(systemId);
    const contract = new ethers.Contract(systemAddress, HarvestStopSystem.abi, wallet);

    console.log(`[Harvest] Stopping harvest for Kami ${kamiId}`);
    
    const tx = await contract.executeTyped(BigInt(kamiId), { gasLimit: 2000000 });
    console.log(`[Harvest] Stop Tx: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (receipt.status === 1) {
        return { success: true, txHash: tx.hash };
    } else {
        return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Harvest] Stop failed:', error);
    return { success: false, error: error.message };
  }
}

export async function isKamiHarvesting(kamiId: string): Promise<boolean> {
    const { state } = await getKamiState(kamiId);
    return state === 1; 
}

export async function getKamiState(kamiId: string): Promise<{ state: number, currentHealth: number }> {
    const GetterSystem = loadAbi('GetterSystem.json');
    const getter = new ethers.Contract(GETTER_SYSTEM_ADDRESS, GetterSystem.abi, provider);
    
    try {
        const kami = await getter.getKami(BigInt(kamiId));
        return {
            state: Number(kami.state),
            currentHealth: Number(kami.stats.health.base)
        };
    } catch (e) {
        console.error('Failed to get kami state:', e);
        return { state: 0, currentHealth: 0 };
    }
}
