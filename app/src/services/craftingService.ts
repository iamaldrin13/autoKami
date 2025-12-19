import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';
import { walletMutex } from '../utils/walletMutex.js';

// Load ABIs and Config dynamically
const CraftSystem = loadAbi('CraftSystem.json');
const SYSTEMS = loadIds('systems.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface CraftResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export async function craftRecipe(
  recipeIndex: number, 
  amount: number, 
  privateKey: string
): Promise<CraftResult> {
  const wallet = new ethers.Wallet(privateKey, provider);

  return walletMutex.runExclusive(wallet.address, async () => {
    try {
        // Use encodedID (0x...) which getSystemAddress handles
        const systemId = SYSTEMS.CraftSystem.encodedID;
        const systemAddress = await getSystemAddress(systemId);
        
        // Use Raw Transaction Construction to match known-working script
        // Selector for craft(uint32,uint256): 0x5c817c70
        const selector = "0x5c817c70";
        const arg1 = recipeIndex.toString(16).padStart(64, '0');
        const arg2 = amount.toString(16).padStart(64, '0');
        const data = selector + arg1 + arg2;

        console.log(`[Crafting] Crafting Recipe #${recipeIndex} (x${amount})`);
        console.log(`[Crafting] Target: ${systemAddress}`);
        // console.log(`[Crafting] Data: ${data}`);

        // Fix for "account sequence mismatch": Explicitly fetch the pending nonce
        const nonce = await provider.getTransactionCount(wallet.address, 'pending');
        console.log(`[Crafting] Using nonce: ${nonce}`);

        const tx = await wallet.sendTransaction({
            to: systemAddress,
            data: data,
            nonce: nonce
        });

        console.log(`[Crafting] Tx submitted: ${tx.hash}`);
        
        try {
            const receipt = await tx.wait();
            if (receipt && receipt.status === 1) {
                return { success: true, txHash: tx.hash };
            } else {
                return { success: false, error: 'Transaction reverted' };
            }
        } catch (waitError: any) {
            if (waitError.code === 'TRANSACTION_REPLACED') {
                if (waitError.cancelled) {
                    return { success: false, error: 'Transaction cancelled' };
                }
                if (waitError.receipt && waitError.receipt.status === 1) {
                    console.log(`[Crafting] Transaction replaced but succeeded: ${waitError.receipt.hash}`);
                    return { success: true, txHash: waitError.receipt.hash };
                }
                return { success: false, error: 'Transaction replaced and reverted' };
            }
            throw waitError;
        }
    } catch (error: any) {
        console.error('[Crafting] Execution failed:', error);
        return { success: false, error: error.message };
    }
  });
}
