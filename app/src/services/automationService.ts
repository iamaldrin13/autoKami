import { ethers } from 'ethers';
import {
    getKamigotchis,
    getOrCreateKamiProfile,
    updateKamiProfile,
    logSystemEvent,
    decryptPrivateKey,
    getAllActiveCraftingSettings,
    updateCraftingLastRun,
    AutoCraftingSettings
} from './supabaseService.js';
import { startHarvest, stopHarvestByKamiId, getKamiState } from './harvestService.js';
import { craftRecipe } from './craftingService.js';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import supabase from './supabaseService.js';
import { RECIPE_LIST } from '../utils/recipes.js';
import { getKamiById } from './kamiService.js';
import { getAccountById, moveAccount, getAccountInventory } from './accountService.js';

const POLL_INTERVAL_MS = 60000; // Check every 60 seconds

// Provider Setup for Stamina Checks
const RPC_URL = process.env.RPC_URL || 'https://archival-jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz';
const GETTER_SYSTEM_ADDRESS = process.env.GETTER_SYSTEM_ADDRESS || '0x12C0989A259471D89D1bA1BB95043D64DAF97c19';
const provider = new ethers.JsonRpcProvider(RPC_URL);
const GetterSystemABI = [
    "function getAccount(uint256 id) view returns (tuple(uint32 index, string name, int32 currStamina, uint32 room))"
];
const getterContract = new ethers.Contract(GETTER_SYSTEM_ADDRESS, GetterSystemABI, provider);

export async function runAutomationLoop() {
    console.log('🔄 Starting Automation Loop...');
    
    const loop = async () => {
        try {
            await processAutomation();
            
            try {
                await processCraftingAutomation(); 
            } catch (craftErr) {
                console.error('[Automation] Crafting cycle error:', craftErr);
            }
        } catch (error) {
            console.error('[Automation] Loop iteration failed:', error);
        } finally {
            // Schedule next run only after current one finishes
            setTimeout(loop, POLL_INTERVAL_MS);
        }
    };

    // Start the loop
    loop();
}

export async function getAccountStamina(accountId: string): Promise<number> {
    try {
        const account = await getterContract.getAccount(BigInt(accountId));
        return Number(account.currStamina);
    } catch (e) {
        console.error(`[Automation] Failed to fetch stamina for ${accountId}:`, e);
        return 0;
    }
}

export async function processCraftingAutomation() {
    try {
        const settingsList = await getAllActiveCraftingSettings();
        if (settingsList.length === 0) return;

        // console.log(`[Automation] Processing ${settingsList.length} crafting tasks...`);

        for (const setting of settingsList) {
            const wallet = setting.operator_wallets;
            const lastRun = setting.last_run_at ? new Date(setting.last_run_at) : new Date(0);
            const now = new Date();
            const elapsedMinutes = (now.getTime() - lastRun.getTime()) / 60000;

            if (elapsedMinutes >= setting.interval_minutes) {
                // 1. Get Recipe
                const recipe = RECIPE_LIST.find(r => r.id === setting.recipe_id);
                if (!recipe) {
                    console.error(`[Crafting] Recipe #${setting.recipe_id} not found.`);
                    continue;
                }

                // 2. Check Inventory
                const inventory = await getAccountInventory(wallet.account_id);
                const missingItems: { id: number, required: number, current: number }[] = [];
                
                for (let i = 0; i < recipe.inputIndices.length; i++) {
                    const inputId = recipe.inputIndices[i];
                    const inputAmount = recipe.inputAmounts[i] * setting.amount_to_craft;
                    const currentAmount = inventory[inputId] || 0;
                    
                    if (currentAmount < inputAmount) {
                         missingItems.push({ id: inputId, required: inputAmount, current: currentAmount });
                    }
                }
                
                if (missingItems.length > 0) {
                     const missingStr = missingItems.map(m => `Item #${m.id} (${m.current}/${m.required})`).join(', ');
                     console.log(`[Crafting] Wallet ${wallet.name}: Missing items for ${recipe.name}: ${missingStr}. Waiting...`);
                     
                     await logSystemEvent({
                        user_id: wallet.user_id,
                        action: 'auto_craft_skip',
                        status: 'info',
                        message: `[Wallet: ${wallet.name}] Auto-crafting skipped: Insufficient Items for ${recipe.name}: ${missingStr}. Waiting ${setting.interval_minutes} mins.`,
                        metadata: { missing: missingItems, recipe: recipe.name, wallet: wallet.name }
                    });
                    
                    // Update timer to wait for next interval
                    await updateCraftingLastRun(setting.id!);
                    continue; 
                }

                // 3. Check Stamina
                const stamina = await getAccountStamina(wallet.account_id);
                const requiredStamina = recipe.staminaCost * setting.amount_to_craft;

                if (stamina >= requiredStamina) {
                    console.log(`[Crafting] Wallet ${wallet.name}: Stamina ${stamina} >= ${requiredStamina}. Crafting...`);
                    
                    await logSystemEvent({
                        user_id: wallet.user_id,
                        action: 'auto_craft_start',
                        status: 'info',
                        message: `[Wallet: ${wallet.name}] Stamina check passed (${stamina} >= ${requiredStamina}). Starting auto-craft for ${recipe.name} (x${setting.amount_to_craft})...`,
                        metadata: { stamina, required: requiredStamina, recipe: recipe.name, wallet: wallet.name }
                    });

                    let privateKey;
                    try {
                        privateKey = await decryptPrivateKey(wallet.encrypted_private_key);
                    } catch (e) {
                        console.error(`[Crafting] Decryption failed for ${wallet.name}`);
                        continue;
                    }

                    const maxRetries = 3;
                    let success = false;
                    let attempt = 0;

                    while (attempt < maxRetries && !success) {
                        attempt++;
                        console.log(`[Crafting] Attempt ${attempt}/${maxRetries} for ${wallet.name}...`);

                        const result = await craftRecipe(setting.recipe_id, setting.amount_to_craft, privateKey);
                        
                        if (result.success) {
                            success = true;
                            // Success: Update timer and log
                            await updateCraftingLastRun(setting.id!);
                            
                            await logSystemEvent({
                                user_id: wallet.user_id,
                                action: 'auto_craft',
                                status: 'success',
                                message: `[Wallet: ${wallet.name}] Auto-crafted ${recipe.name} (x${setting.amount_to_craft}). Consumed ${requiredStamina} Stamina.`,
                                metadata: { txHash: result.txHash, recipeId: setting.recipe_id, amount: setting.amount_to_craft, cost: requiredStamina, wallet: wallet.name }
                            });
                        } else {
                            console.error(`[Crafting] Attempt ${attempt} failed: ${result.error}`);
                            
                            if (attempt < maxRetries) {
                                console.log(`[Crafting] Retrying in 1 minute...`);
                                await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60s
                            } else {
                                // All retries failed: Update timer to wait full interval and log failure
                                await updateCraftingLastRun(setting.id!);
                                
                                await logSystemEvent({
                                    user_id: wallet.user_id,
                                    action: 'auto_craft_fail',
                                    status: 'error',
                                    message: `[Wallet: ${wallet.name}] Auto-craft failed after 3 attempts: ${result.error}. Will retry in ${setting.interval_minutes} mins.`,
                                    metadata: { error: result.error, wallet: wallet.name }
                                });
                            }
                        }
                    }
                } else {
                    // Stamina not enough
                    console.log(`[Crafting] Wallet ${wallet.name}: Stamina ${stamina} < ${requiredStamina}. insufficient stamina, waiting for the next interval.`);
                    
                    await logSystemEvent({
                        user_id: wallet.user_id,
                        action: 'auto_craft_skip',
                        status: 'info',
                        message: `[Wallet: ${wallet.name}] Auto-crafting skipped: Insufficient Stamina (${stamina}/${requiredStamina}) for ${recipe.name}. Waiting ${setting.interval_minutes} mins.`,
                        metadata: { stamina, required: requiredStamina, recipe: recipe.name, wallet: wallet.name }
                    });

                    // Update last_run_at so we wait for the full interval before checking again
                    await updateCraftingLastRun(setting.id!);
                }
            }
        }
    } catch (error) {
        console.error('[Automation] Crafting loop error:', error);
    }
}

async function processAutomation() {
    try {
        // 1. Fetch all enabled automation profiles
        const { data: profiles, error } = await supabase
            .from('kami_profiles')
            .select('*, kamigotchis!inner(kami_entity_id, encrypted_private_key, user_id, kami_index, kami_name)')
            .eq('auto_harvest_enabled', true);

        if (error) throw error;
        
        const profileCount = profiles ? profiles.length : 0;
        console.log(`[Automation] ⏱️ Processing cycle for ${profileCount} active Kami profiles...`);

        if (!profiles || profiles.length === 0) return;

        // console.log(`[Automation] Processing ${profiles.length} active profiles...`);

        // Process all profiles concurrently
        const tasks = profiles.map(profile => checkKami(profile));
        const results = await Promise.allSettled(tasks);
        
        // Optional: Log summary of results
        const rejected = results.filter(r => r.status === 'rejected');
        if (rejected.length > 0) {
            console.warn(`[Automation] ${rejected.length} profiles failed during this cycle.`);
        }

    } catch (error) {
        console.error('[Automation] Loop error:', error);
    }
}

async function checkKami(profile: any) {
    const kami = profile.kamigotchis; // Joined data
    const kamiId = kami.kami_entity_id;
    const userId = kami.user_id;

    try {
        // Check on-chain status
        const { state, currentHealth } = await getKamiState(kamiId);
        const isHarvesting = state === 1; // 1 = Harvesting

        // Log heartbeat if harvesting
        if (isHarvesting !== profile.is_currently_harvesting) {
            await updateKamiProfile(profile.kamigotchi_id, { is_currently_harvesting: isHarvesting });
            // Log state correction
            await logSystemEvent({
                user_id: userId,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'state_sync',
                status: 'info',
                message: `State mismatch corrected. On-chain: ${isHarvesting ? 'Harvesting' : 'Resting'}`
            });
        }

        const now = new Date();

        if (isHarvesting) {
            // --- HARVESTING STATE ---
            
            // A. Health Check (Emergency Stop)
            const minHealth = profile.min_health_threshold || 20; // Default 20 HP
            
            // Verbose health log
            // console.log(`[Automation] Kami #${kami.kami_index}: Health Check ${currentHealth}/${minHealth}`);

            if (currentHealth < minHealth) {
                console.log(`[Automation] Kami #${kami.kami_index}: Low Health (${currentHealth} < ${minHealth}). Stopping...`);
                
                await logSystemEvent({
                    user_id: userId,
                    kami_index: kami.kami_index,
                    kami_profile_id: profile.id,
                    action: 'low_health_stop',
                    status: 'warning',
                    message: `[Kami #${kami.kami_index} (${kami.kami_name || 'Unknown'})] Health critically low (${currentHealth} / ${minHealth}). Emergency stop triggered (Node #${profile.harvest_node_index ?? '?'}).`
                });

                const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                const result = await stopHarvestByKamiId(kamiId, privateKey);

                if (result.success) {
                    await updateKamiProfile(profile.kamigotchi_id, {
                        is_currently_harvesting: false,
                        last_collect: now.toISOString(),
                        total_rests: (profile.total_rests || 0) + 1
                    });
                    await logSystemEvent({
                        user_id: userId,
                        kami_index: kami.kami_index,
                        kami_profile_id: profile.id,
                        action: 'low_health_stop',
                        status: 'success',
                        message: `Emergency stop successful due to low health (${currentHealth} HP). Resting started.`,
                        metadata: { txHash: result.txHash, currentHealth }
                    });
                    return; // Skip duration check if stopped
                } else {
                    throw new Error('Emergency stop failed: ' + result.error);
                }
            }

            // B. Duration Check
            const lastStart = profile.last_harvest_start ? new Date(profile.last_harvest_start) : new Date();
            const harvestDurationMs = (profile.harvest_duration || 60) * 60 * 1000;
            const elapsed = now.getTime() - lastStart.getTime();

            if (elapsed >= harvestDurationMs) {
                // Time to stop?
                if (profile.auto_collect_enabled) {
                    console.log(`[Automation] Kami #${kami.kami_index}: Harvest time exceeded (${Math.floor(elapsed/60000)}m). Stopping...`);
                    
                    await logSystemEvent({
                        user_id: userId,
                        kami_index: kami.kami_index,
                        kami_profile_id: profile.id,
                        action: 'auto_stop',
                        status: 'info',
                        message: `[Kami #${kami.kami_index} (${kami.kami_name || 'Unknown'})] Harvest time exceeded (${Math.floor(elapsed/60000)}m / ${profile.harvest_duration}m). Stopping harvest (Node #${profile.harvest_node_index ?? '?'}).`
                    });

                    const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                    const result = await stopHarvestByKamiId(kamiId, privateKey);

                    if (result.success) {
                        await updateKamiProfile(profile.kamigotchi_id, {
                            is_currently_harvesting: false,
                            last_collect: now.toISOString(),
                            total_rests: (profile.total_rests || 0) + 1
                        });
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'auto_stop',
                            status: 'success',
                            message: `Harvest stopped successfully (Node #${profile.harvest_node_index ?? '?'}). Entering rest mode.`,
                            metadata: { txHash: result.txHash }
                        });
                    } else {
                        throw new Error(result.error);
                    }
                }
            }
        } else {
            // --- RESTING STATE ---
            // Check if rest duration exceeded
            const lastCollect = profile.last_collect ? new Date(profile.last_collect) : new Date(0); // Default to long ago if never collected
            const restDurationMs = (profile.rest_duration || 30) * 60 * 1000;
            const elapsed = now.getTime() - lastCollect.getTime();

            if (elapsed >= restDurationMs) {
                // Check health before restarting? 
                // Ideally we should, but for now just restart if duration met.
                // Optional: if (profile.auto_heal_enabled && currentHealth < max) ... wait?
                // For now, simple restart logic.

                // Time to start?
                if (profile.auto_restart_enabled) {
                    console.log(`[Automation] Kami #${kami.kami_index}: Rest time exceeded (${Math.floor(elapsed/60000)}m). Starting...`);
                    
                    const nodeIndex = profile.harvest_node_index || 0; 

                    await logSystemEvent({
                        user_id: userId,
                        kami_index: kami.kami_index,
                        kami_profile_id: profile.id,
                        action: 'auto_start',
                        status: 'info',
                        message: `[Kami #${kami.kami_index} (${kami.kami_name || 'Unknown'})] Rest duration exceeded (${Math.floor(elapsed/60000)}m / ${profile.rest_duration}m). Starting harvest at Node #${nodeIndex}.`
                    });

                    const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                    // Use configured node or default to 0
                    
                    // --- Location Check & Move ---
                    const kamiData = await getKamiById(kamiId);
                    const currentRoom = kamiData.room.index;
                    
                    // Check Account Location
                    const account = await getAccountById(kamiData.account);
                    if (account && account.room !== nodeIndex) {
                        const msg = `Automation stopped: Account is in Room #${account.room}, but target is Node #${nodeIndex}. Please move manually.`;
                        console.warn(`[Automation] 🛑 ${msg}`);
                        
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'automation_stopped',
                            status: 'error',
                            message: msg,
                            metadata: { currentRoom: account.room, targetNode: nodeIndex }
                        });
                        return; // Stop processing for this Kami

                        /* 
                        // Auto-move logic disabled for now
                        console.log(`[Automation] Account is in Room #${account.room}, moving to Node #${nodeIndex}...`);
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'auto_move',
                            status: 'info',
                            message: `Account is in Room #${account.room}. Moving to Node #${nodeIndex} before harvest.`
                        });

                        const moveResult = await moveAccount(privateKey, nodeIndex);
                        if (!moveResult.success) {
                            throw new Error(`Failed to move account: ${moveResult.error}`);
                        }
                        console.log(`[Automation] Account moved successfully.`);
                        */
                    }

                    // Check Kami Location (Warn only, assuming account move might suffice or kami follows)
                    if (currentRoom !== nodeIndex) {
                        const msg = `Kami is in Room #${currentRoom}, target is Node #${nodeIndex}. Account moved to target.`;
                        console.warn(`[Automation] ℹ️ ${msg}`);
                        // We don't stop here, we assume StartHarvest might work if Account is in place
                    }
                    // ------------------

                    const result = await startHarvest({
                        kamiId,
                        nodeIndex,
                        privateKey
                    });

                    if (result.success) {
                        await updateKamiProfile(profile.kamigotchi_id, {
                            is_currently_harvesting: true,
                            last_harvest_start: now.toISOString(),
                            total_harvests: (profile.total_harvests || 0) + 1
                        });
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'auto_start',
                            status: 'success',
                            message: `Harvest started successfully at Node #${nodeIndex} (Harvest ID: ${result.harvestId || '?'}).`,
                            metadata: { txHash: result.txHash, harvestId: result.harvestId }
                        });
                    } else {
                        throw new Error(result.error);
                    }
                }
            }
        }

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown automation error';
        console.error(`[Automation] Error processing Kami #${kami.kami_index}:`, errorMsg);
        
        // Handle critical "Missing Harvest ID" error specifically
        if (errorMsg.includes("Could not find active Harvest ID")) {
             console.warn(`[Automation] Critical Error for Kami #${kami.kami_index}. Disabling automation to prevent loop.`);
             
             // Disable automation
             await updateKamiProfile(profile.kamigotchi_id, { auto_harvest_enabled: false });
             
             await logSystemEvent({
                user_id: userId,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'automation_stopped_critical',
                status: 'error',
                message: `[Kami #${kami.kami_index}] CRITICAL: Active Harvest ID lost (likely started manually before update). Automation DISABLED. Please STOP harvest manually via game UI to reset state.`,
                metadata: { error: errorMsg }
            });
            return;
        }

        await logSystemEvent({
            user_id: userId,
            kami_index: kami.kami_index,
            kami_profile_id: profile.id,
            action: 'automation_error',
            status: 'error',
            message: `[Kami #${kami.kami_index} (${kami.kami_name || 'Unknown'})] Automation failed: ${errorMsg}`,
            metadata: { error: errorMsg }
        });
    }
}
