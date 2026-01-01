import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';
import { walletMutex } from '../utils/walletMutex.js';

// Load ABIs and Config dynamically
// Using V2 ABI which supports executeTyped(uint32, uint256)
const CraftSystem = loadAbi('CraftSystemV2.json'); 
const SYSTEMS = loadIds('systems.json');

const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';

// Initialize provider
const provider = new ethers.JsonRpcProvider(RPC_URL);

export interface CraftResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

// Standard Gas Config
const GAS_LIMIT = 172155n;
const GAS_PRICE = 5000000n; // 0.005 gwei

export async function craftRecipe(
  recipeIndex: number, 
  amount: number, 
  privateKey: string
): Promise<CraftResult> {
  const wallet = new ethers.Wallet(privateKey, provider);

  return walletMutex.runExclusive(wallet.address, async () => {
    try {
        const systemId = SYSTEMS.CraftSystem.encodedID;
        const systemAddress = await getSystemAddress(systemId);
        
        // Use Contract interface instead of raw transaction
        // This ensures correct function selector for executeTyped(uint32, uint256)
        const contract = new ethers.Contract(systemAddress, CraftSystem.abi, wallet);

        console.log(`[Crafting] Crafting Recipe #${recipeIndex} (x${amount})`);
        console.log(`[Crafting] Target: ${systemAddress}`);
        
        // 1. Simulate via static call or estimateGas to catch reverts early
        try {
            await contract.executeTyped.staticCall(recipeIndex, BigInt(amount));
        } catch (simError: any) {
             console.error(`[Crafting] Simulation failed:`, simError.reason || simError.message);
             // Try to extract a better error message
             const reason = simError.reason || (simError.data ? `Revert Data: ${simError.data}` : simError.message);
             // return { success: false, error: `Pre-check failed: ${reason}` };
             console.warn(`[Crafting] Simulation failed but proceeding with transaction as requested (Test Mode).`);
        }

        // 2. Execute Transaction
        const overrides = {
            gasLimit: GAS_LIMIT,
            gasPrice: GAS_PRICE
        };

        const tx = await contract.executeTyped(recipeIndex, BigInt(amount), overrides);

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
