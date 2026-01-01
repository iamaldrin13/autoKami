
import { craftRecipe } from '../services/craftingService.js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

async function main() {
    const RECIPE_ID = 6; // Extract Pine Pollen
    const AMOUNT = 1;
    const GAS_LIMIT = 172155;
    const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;

    if (!PRIVATE_KEY) {
        console.error('❌ OPERATOR_PRIVATE_KEY not found in .env.test');
        process.exit(1);
    }

    console.log(`[Test] Starting Pine Pollen Crafting Test`);
    console.log(`[Test] Recipe: #${RECIPE_ID} (Pine Pollen)`);
    console.log(`[Test] Amount: ${AMOUNT}`);
    console.log(`[Test] Gas Limit: (Standardized to 172155 internally)`);
    console.log(`[Test] Wallet: (From Env)`);

    try {
        const result = await craftRecipe(RECIPE_ID, AMOUNT, PRIVATE_KEY);

        if (result.success) {
            console.log(`[Test] ✅ SUCCESS! Crafting tx submitted.`);
            console.log(`[Test] Tx Hash: ${result.txHash}`);
        } else {
            console.error(`[Test] ❌ FAILED.`);
            console.error(`[Test] Error: ${result.error}`);
        }
    } catch (e) {
        console.error(`[Test] Unexpected error:`, e);
    }
}

main().catch(console.error);
