import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';
import supabase from './supabaseService.js';
import { walletMutex } from '../utils/walletMutex.js';

// Load ABIs and Config dynamically
const HarvestStartSystem = loadAbi('HarvestStartSystem.json');
const HarvestStopSystem = loadAbi('HarvestStopSystem.json');
const HarvestCollectSystem = loadAbi('HarvestCollectSystem.json');
const DamageComponent = loadAbi('DamageComponent.json');
const World = loadAbi('World.json');
const SYSTEMS = loadIds('systems.json');
const COMPONENTS = loadIds('components.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const GETTER_SYSTEM_ADDRESS = process.env.GETTER_SYSTEM_ADDRESS || '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';
const WORLD_ADDRESS = '0x2729174c265dbBd8416C6449E0E813E88f43D0E7';

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

// Helper to find HarvestID on-chain
async function findHarvestIdOnChain(kamiId: string): Promise<string | undefined> {
    try {
        console.log(`[Harvest] 🕵️‍♀️ Attempting on-chain lookup for HarvestID (Kami #${kamiId})...`);
        
        const world = new ethers.Contract(WORLD_ADDRESS, World.abi, provider);
        const componentsRegistryAddress = await world.components();
        
        // We can use any component ABI that has getEntitiesWithValue, IDOwnsKamiComponent is fine
        const registryAbi = loadAbi('IDOwnsKamiComponent.json').abi;
        const componentsRegistry = new ethers.Contract(componentsRegistryAddress, registryAbi, provider);

        const getAddr = async (encodedId: string) => {
            const entities = await componentsRegistry.getFunction('getEntitiesWithValue(bytes)')(encodedId);
            if (entities.length === 0) throw new Error(`Component not found: ${encodedId}`);
            return ethers.getAddress('0x' + BigInt(entities[0]).toString(16).padStart(40, '0'));
        };

        // IDs from components.json
        // TargetID (IdTargetComponent) maps Entity -> TargetEntityID
        // StartTime (TimeStartComponent) indicates active process
        // We need to check if we have the correct keys in components.json or use hardcoded if necessary.
        // Based on file list, we have IdTargetComponent.json and TimeStartComponent.json.
        // Assuming components.json keys are IdTargetComponent and TimeStartComponent.
        
        // Use keys that likely match the components.json structure or fallbacks from script if needed
        // Script used specific hardcoded IDs. Let's try to look them up from COMPONENTS if possible, 
        // else fallback to known IDs if we trust them.
        // Actually, let's look up using the loaded COMPONENTS object for reliability if keys exist.
        
        const targetIdEncoded = (COMPONENTS as any).IdTargetComponent?.encodedID || '0x62e5c3a731a312a02bd0a6e08720624c014a22c9f60c82fede06a9606c505815';
        const startTimeEncoded = (COMPONENTS as any).TimeStartComponent?.encodedID || '0x9ee42634d52dbd5a24ad226010389fb7306af59bdaec5e20547162dd896dacad';

        const TargetIDAddr = await getAddr(targetIdEncoded);
        const StartTimeAddr = await getAddr(startTimeEncoded);

        const TargetID = new ethers.Contract(TargetIDAddr, [
            "function getEntitiesWithValue(uint256 value) view returns (uint256[])"
        ], provider);

        const StartTime = new ethers.Contract(StartTimeAddr, [
            "function has(uint256 entity) view returns (bool)"
        ], provider);

        // 1. Find all entities that target this Kami
        // HarvestEntity -> targets -> KamiID
        const entities = await TargetID.getEntitiesWithValue(BigInt(kamiId));
        
        if (entities.length === 0) {
            console.log(`[Harvest] No entities target Kami #${kamiId}.`);
            return undefined;
        }

        // 2. Check which one has a StartTime (is active)
        for (const entityId of entities) {
            const id = BigInt(entityId);
            const isActive = await StartTime.has(id);
            if (isActive) {
                console.log(`[Harvest] 🎯 Found Active HarvestID on-chain: ${id}`);
                return id.toString();
            }
        }
        
        console.log(`[Harvest] Found targeting entities but none are active.`);
        return undefined;

    } catch (e) {
        console.error(`[Harvest] On-chain lookup failed:`, e);
        return undefined;
    }
}

export async function startHarvest(params: HarvestParams): Promise<HarvestResult> {
  const { kamiId, nodeIndex, privateKey } = params;
  const wallet = new ethers.Wallet(privateKey, provider);

  return walletMutex.runExclusive(wallet.address, async () => {
    try {
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
  });
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
  const wallet = new ethers.Wallet(privateKey, provider);

  return walletMutex.runExclusive(wallet.address, async () => {
    try {
        const systemId = SYSTEMS.HarvestStopSystem.encodedID;
        const systemAddress = await getSystemAddress(systemId);
        const contract = new ethers.Contract(systemAddress, HarvestStopSystem.abi, wallet);

        console.log(`[Harvest] 🛑 Initiating stopHarvest for Kami #${kamiId}`);
        console.log(`[Harvest] 🔍 Looking up Kami Profile and active Harvest ID...`);

        // Lookup HarvestID from system_logs
        // 1. Get Kamigotchi UUID first
        const { data: kami, error: kamiError } = await supabase
            .from('kamigotchis')
            .select('id')
            .eq('kami_entity_id', kamiId)
            .single();
            
        let harvestId: string | undefined;

        // DB Lookup Path
        if (!kamiError && kami) {
            // 2. Get Profile ID using Kamigotchi UUID
            const { data: profile } = await supabase
                .from('kami_profiles')
                .select('id')
                .eq('kamigotchi_id', kami.id)
                .single();

            if (profile) {
                // 3. Get last auto_start or manual_start_harvest log
                const { data: log } = await supabase
                    .from('system_logs')
                    .select('metadata, created_at')
                    .eq('kami_profile_id', profile.id)
                    .in('action', ['auto_start', 'manual_start_harvest'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (log && log.metadata && (log.metadata as any).harvestId) {
                    harvestId = (log.metadata as any).harvestId;
                    console.log(`[Harvest] 🎯 Found Harvest ID in DB: ${harvestId}`);
                }
            }
        }

        // Fallback: On-Chain Lookup
        if (!harvestId) {
            console.warn(`[Harvest] ⚠️ Harvest ID not found in DB. Trying on-chain lookup...`);
            harvestId = await findHarvestIdOnChain(kamiId);
        }

        if (!harvestId) {
            throw new Error('Could not find active Harvest ID (checked DB and On-Chain). Cannot stop harvest.');
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
  });
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
        
        const rawState = kami.state;
        console.log(`[Harvest] Raw Kami #${kamiId} state: "${rawState}"`);

        const stateNum = rawState === 'HARVESTING' ? 1 : 0;

        return {
            state: stateNum,
            currentHealth: Number(kami.stats.health.base)
        };
    } catch (e) {
        console.error('Failed to get kami state:', e);
        return { state: 0, currentHealth: 0 };
    }
}
