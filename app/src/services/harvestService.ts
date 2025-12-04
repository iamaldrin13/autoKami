import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';
import supabase from './supabaseService.js';

// Load ABIs and Config dynamically
const HarvestStartSystem = loadAbi('HarvestStartSystem.json');
const HarvestStopSystem = loadAbi('HarvestStopSystem.json');
const HarvestCollectSystem = loadAbi('HarvestCollectSystem.json');
const DamageComponent = loadAbi('DamageComponent.json');
const SYSTEMS = loadIds('systems.json');
const COMPONENTS = loadIds('components.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const GETTER_SYSTEM_ADDRESS = process.env.GETTER_SYSTEM_ADDRESS || '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

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

export async function startHarvest(params: HarvestParams): Promise<HarvestResult> {
  try {
    const { kamiId, nodeIndex, privateKey } = params;
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const systemId = SYSTEMS.HarvestStartSystem.encodedID;
    const systemAddress = await getSystemAddress(systemId);
    const contract = new ethers.Contract(systemAddress, HarvestStartSystem.abi, wallet);

    console.log(`[Harvest] 🚀 Initiating startHarvest for Kami #${kamiId}`);
    console.log(`[Harvest] 📝 Params: Node=${nodeIndex}, Taxer=0, Tax=0`);
    console.log(`[Harvest] 🔧 Contract: ${systemAddress} (HarvestStartSystem)`);
    
    // Execute
    // executeTyped(uint256 kamiID, uint32 nodeIndex, uint256 taxerID, uint256 taxAmt)
    const tx = await contract.executeTyped(BigInt(kamiId), BigInt(nodeIndex), BigInt(0), BigInt(0), { gasLimit: 2000000 });
    console.log(`[Harvest] ⏳ Tx submitted: ${tx.hash}. Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    if (receipt.status === 1) {
        console.log(`[Harvest] ✅ Tx confirmed in block ${receipt.blockNumber}`);
        const harvestId = getHarvestIdFromReceipt(receipt);
        
        if (harvestId) {
            console.log(`[Harvest] 🌾 Harvest started successfully with ID: ${harvestId}`);
            return { success: true, txHash: tx.hash, harvestId };
        } else {
            console.warn(`[Harvest] ⚠️ Tx succeeded but HarvestID could not be parsed from logs.`);
            return { success: true, txHash: tx.hash, harvestId: undefined };
        }
    } else {
        console.error(`[Harvest] ❌ Tx reverted.`);
        return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Harvest] 💥 Start failed:', error);
    return { success: false, error: error.message };
  }
}

function getHarvestIdFromReceipt(receipt: ethers.TransactionReceipt): string | undefined {
    try {
        const logs = receipt.logs;
        // Target topic: StartTime component ID
        const targetTopic = '0x9ee42634d52dbd5a24ad226010389fb7306af59bdaec5e20547162dd896dacad';

        for (const log of logs) {
            // Check if topics exist and match the pattern
            if (log.topics && log.topics[1] === targetTopic) {
                // Logic from snippet: harvestId is at topics[3]
                // This assumes the event structure matches the snippet's expectation
                const harvestId = log.topics[3]; 
                return harvestId;
            }
        }
        return undefined;
    } catch (err) {
        console.error('[Harvest] Error parsing receipt for ID:', err);
        return undefined;
    }
}

export async function stopHarvestByKamiId(kamiId: string, privateKey: string): Promise<HarvestResult> {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const systemId = SYSTEMS.HarvestStopSystem.encodedID;
    const systemAddress = await getSystemAddress(systemId);
    const contract = new ethers.Contract(systemAddress, HarvestStopSystem.abi, wallet);

    console.log(`[Harvest] 🛑 Initiating stopHarvest for Kami #${kamiId}`);
    console.log(`[Harvest] 🔍 Looking up Kami Profile and active Harvest ID...`);

    // Lookup HarvestID from system_logs
    // 1. Get profile ID
    const { data: profile, error: profileError } = await supabase
        .from('kami_profiles')
        .select('id')
        .eq('kami_entity_id', kamiId)
        .single();

    if (profileError || !profile) {
        console.error(`[Harvest] ❌ Profile lookup failed for Kami #${kamiId}:`, profileError);
        throw new Error(`Could not find Kami Profile for entity ${kamiId}`);
    }
    console.log(`[Harvest] ✓ Found Profile ID: ${profile.id}`);

    // 2. Get last auto_start log
    const { data: log, error: logError } = await supabase
        .from('system_logs')
        .select('metadata, created_at')
        .eq('kami_profile_id', profile.id)
        .eq('action', 'auto_start')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    let harvestId: string | undefined;
    if (log && log.metadata && (log.metadata as any).harvestId) {
        harvestId = (log.metadata as any).harvestId;
        console.log(`[Harvest] 🎯 Found Harvest ID: ${harvestId} (from log at ${log.created_at})`);
    } else {
        console.warn(`[Harvest] ⚠️ No 'auto_start' log found with harvestId for this profile.`);
    }

    if (!harvestId) {
        throw new Error('Could not find active Harvest ID in logs. Cannot stop harvest.');
    }

    // Pass harvestId, not kamiId
    console.log(`[Harvest] 📤 Submitting stop transaction for Harvest #${harvestId}...`);
    const tx = await contract.executeTyped(BigInt(harvestId), { gasLimit: 2000000 });
    console.log(`[Harvest] ⏳ Tx submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (receipt.status === 1) {
        console.log(`[Harvest] ✅ Stop confirmed in block ${receipt.blockNumber}`);
        return { success: true, txHash: tx.hash };
    } else {
        console.error(`[Harvest] ❌ Tx reverted.`);
        return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Harvest] 💥 Stop failed:', error);
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
