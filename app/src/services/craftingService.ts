import { ethers } from 'ethers';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import { getSystemAddress } from './transactionService.js';

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
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    
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

    const tx = await wallet.sendTransaction({
        to: systemAddress,
        data: data,
        gasLimit: 3000000
    });

    console.log(`[Crafting] Tx submitted: ${tx.hash}`);
    
    const receipt = await tx.wait();
    if (receipt && receipt.status === 1) {
        return { success: true, txHash: tx.hash };
    } else {
        return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Crafting] Execution failed:', error);
    return { success: false, error: error.message };
  }
}
