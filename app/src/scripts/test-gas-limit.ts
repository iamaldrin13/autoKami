
import { startHarvest, getKamiState } from '../services/harvestService.js';
import supabase, { decryptPrivateKey } from '../services/supabaseService.js';

async function main() {
    const KAMI_INDEX = 9225;
    const GAS_LIMIT = 172155;
    const NODE_INDEX = 0; // Defaulting to node 0 for test, usually safe for 'deadzone' or starter areas

    console.log(`[Test] Starting gas limit test for Kami #${KAMI_INDEX} with Limit=${GAS_LIMIT}`);

    try {
        let privateKey = "";
        let kamiEntityId = "";
        
        // 1. Fetch Kami Details
        const { data: kami, error } = await supabase
            .from('kamigotchis')
            .select('*')
            .eq('kami_index', KAMI_INDEX)
            .single();

        if (error || !kami) {
            console.log('[Test] Kami #9225 not found in DB. Using fallback TEST KEY and constructing ID...');
            
            const { ethers } = await import('ethers');
            const { loadAbi } = await import('../utils/contractLoader.js');
            
            const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const GETTER_ADDR = process.env.GETTER_SYSTEM_ADDRESS || '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';
            
            const GetterABI = loadAbi('GetterSystem.json');
            const getter = new ethers.Contract(GETTER_ADDR, GetterABI.abi, provider);
            
            try {
                 console.log(`[Test] Calling GetterSystem.getKamiByIndex(${KAMI_INDEX})...`);
                 const kamiData = await getter.getKamiByIndex(BigInt(KAMI_INDEX));
                 kamiEntityId = kamiData.id.toString();
                 console.log(`[Test] Resolved Kami #${KAMI_INDEX} -> Entity ID: ${kamiEntityId}`);
            } catch (e) {
                console.error('[Test] Failed to resolve Kami Index via GetterSystem:', e);
                return;
            }

            // Fallback Key (Operator Key from .env.example)
            privateKey = "9129b31bef3ef227258b2cc8a29288ad828c0d6d6632e59dcea29788a86d37d8";
            console.log('[Test] Using fallback TEST PRIVATE KEY.');

        } else {
            console.log(`[Test] Found Kami #${KAMI_INDEX} (Entity: ${kami.kami_entity_id})`);
            kamiEntityId = kami.kami_entity_id;
            // 2. Decrypt Private Key
            privateKey = await decryptPrivateKey(kami.encrypted_private_key);
            console.log('[Test] Private Key decrypted.');
        }

        // 3. Start Harvest
        console.log(`[Test] Calling startHarvest...`);
        const result = await startHarvest({
            kamiId: kamiEntityId,
            nodeIndex: NODE_INDEX,
            privateKey: privateKey
        });

        if (result.success) {
            console.log(`[Test] SUCCESS! Harvest started. Tx Hash: ${result.txHash}`);
            console.log(`[Test] Harvest ID: ${result.harvestId}`);
        } else {
            console.error(`[Test] FAILED. Error: ${result.error}`);
        }

    } catch (err) {
        console.error('[Test] Unexpected error:', err);
    }
}

main().catch(console.error);
