import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';
import { walletMutex } from '../utils/walletMutex.js';
import supabase, { logSystemEvent } from './supabaseService.js';

const KamiUseItemSystem = loadAbi('KamiUseItemSystem.json');
const SYSTEMS = loadIds('systems.json');
const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface FeedResult {
    success: boolean;
    txHash?: string;
    error?: string;
}

export async function feedKami(
    kamiId: string, 
    itemIndex: number, 
    privateKey: string,
    userId?: string, // Optional for logging context
    kamiIndex?: number, // Optional for logging context
    profileId?: string // Optional for logging context
): Promise<FeedResult> {
    const wallet = new ethers.Wallet(privateKey, provider);

    return walletMutex.runExclusive(wallet.address, async () => {
        try {
            console.log(`[Feed] 🍽️ Preparing to feed Kami #${kamiIndex || kamiId} with Item #${itemIndex}...`);
            
            const systemId = SYSTEMS.KamiUseItemSystem.encodedID;
            const systemAddress = await getSystemAddress(systemId);
            const contract = new ethers.Contract(systemAddress, KamiUseItemSystem.abi, wallet);

            // Check if user has the item? 
            // The contract will revert if not, but we could check inventory here.
            // For now, assume logic in automationService checks inventory before calling this.

            const tx = await contract.executeTyped(
                BigInt(kamiId),
                BigInt(itemIndex),
                { gasLimit: 172155 }
            );
            console.log(`[Feed] ⏳ Tx submitted: ${tx.hash}`);

            const receipt = await tx.wait();
            if (receipt.status === 1) {
                console.log(`[Feed] ✅ Feed successful!`);
                
                if (userId && kamiIndex && profileId) {
                    await logSystemEvent({
                        user_id: userId,
                        kami_index: kamiIndex,
                        kami_profile_id: profileId,
                        action: 'feed_success',
                        status: 'success',
                        message: `Kami consumed Item #${itemIndex} successfully.`,
                        metadata: { txHash: tx.hash, itemIndex }
                    });
                }

                return { success: true, txHash: tx.hash };
            } else {
                console.error(`[Feed] ❌ Tx reverted.`);
                return { success: false, error: 'Transaction reverted' };
            }

        } catch (error: any) {
            console.error(`[Feed] 💥 Feed failed:`, error.message);
            
            if (userId && kamiIndex && profileId) {
                await logSystemEvent({
                    user_id: userId,
                    kami_index: kamiIndex,
                    kami_profile_id: profileId,
                    action: 'feed_error',
                    status: 'error',
                    message: `Feeding failed: ${error.message}`,
                    metadata: { error: error.message, itemIndex }
                });
            }

            return { success: false, error: error.message };
        }
    });
}
