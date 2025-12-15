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
import { feedKami } from './feedService.js';
import { loadAbi, loadIds } from '../utils/contractLoader.js';
import supabase from './supabaseService.js';
import { RECIPE_LIST } from '../utils/recipes.js';
import { getItemName } from '../utils/itemMapping.js';
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
            
            // Initialize lastRun to prevent immediate execution on fresh start
            // Similar to feed logic, we assume "interval" means wait X mins from now.
            let lastRun = setting.last_run_at ? new Date(setting.last_run_at) : null;
            
            if (!lastRun) {
                // If never run, set to NOW so we wait one interval
                lastRun = new Date();
                // Update DB to persist this baseline
                await updateCraftingLastRun(setting.id!);
            }

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
                        message: `[Auto Craft: ${wallet.name}] Skipped: Insufficient Items for ${recipe.name}: ${missingStr}. Waiting ${setting.interval_minutes} mins.`,
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
                        message: `[Auto Craft: ${wallet.name}] Stamina check passed (${stamina} >= ${requiredStamina}). Starting craft for ${recipe.name} (x${setting.amount_to_craft})...`,
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
                                message: `[Auto Craft: ${wallet.name}] Crafted ${recipe.name} (x${setting.amount_to_craft}). Consumed ${requiredStamina} Stamina.`,
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
                                    message: `[Auto Craft: ${wallet.name}] Failed after 3 attempts: ${result.error}. Will retry in ${setting.interval_minutes} mins.`,
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
                        message: `[Auto Craft: ${wallet.name}] Skipped: Insufficient Stamina (${stamina}/${requiredStamina}) for ${recipe.name}. Waiting ${setting.interval_minutes} mins.`,
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
            .select('*, kamigotchis!inner(kami_entity_id, encrypted_private_key, user_id, kami_index, kami_name, account_id, room_name), operator_wallets(name)')
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
    const strategy = profile.strategy_type || 'harvest_rest';
    const walletName = profile.operator_wallets?.name || 'Unknown Wallet';
    
    // Format helpers
    const strategyLabel = strategy === 'harvest_feed' ? 'Harvest & Feed' : 'Harvest & Rest';
    const kamiLabel = `Kami #${kami.kami_index}`;
    // Use stored room name if available, else Node index
    const locationStr = `Node #${profile.harvest_node_index ?? kami.room_index ?? '?'}`;

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
                message: `[Auto Harvest: ${walletName}] State mismatch corrected for ${kamiLabel} at ${locationStr}. On-chain: ${isHarvesting ? 'Harvesting' : 'Resting'}`
            });
        }

        const now = new Date();

        if (isHarvesting) {
            // --- HARVESTING STATE ---

            // NEW: Harvest & Feed Strategy
            if (strategy === 'harvest_feed') {
                const intervalMinutes = profile.feed_interval_minutes || 0;
                
                if (intervalMinutes > 0) {
                    // Initialize lastFeed to prevent immediate execution on start/restart
                    // Use automation_started_at as anchor if available, else NOW.
                    let lastFeed = profile.last_feed_at ? new Date(profile.last_feed_at) : null;
                    
                    if (!lastFeed) {
                        const anchorTime = profile.automation_started_at || new Date().toISOString();
                        lastFeed = new Date(anchorTime);
                        
                        // Persist initialization to DB so we don't drift
                        await updateKamiProfile(profile.kamigotchi_id, {
                            last_feed_at: anchorTime
                        });
                        console.log(`[Automation] Kami #${kami.kami_index}: Initialized feed timer to ${anchorTime}. Next feed in ${intervalMinutes} mins.`);
                    }

                    const elapsedMinutes = (now.getTime() - lastFeed.getTime()) / 60000;
                    
                    if (elapsedMinutes >= intervalMinutes) {
                        console.log(`[Automation] Kami #${kami.kami_index}: Feed Interval Reached (${Math.floor(elapsedMinutes)}m >= ${intervalMinutes}m). Preparing to feed...`);
                        
                        // 1. Identify Items (Primary & Fallback)
                        // Currently UI only supports primary 'feed_item_id'.
                        // Future: Add 'feed_item_id_2' to profile for fallback.
                        const feedItems = [];
                        if (profile.feed_item_id) feedItems.push(profile.feed_item_id);
                        if (profile.feed_item_id_2) feedItems.push(profile.feed_item_id_2);

                        if (feedItems.length === 0) {
                            console.warn(`[Automation] Kami #${kami.kami_index}: Strategy is 'harvest_feed' but no feed items configured (Primary: ${profile.feed_item_id}, Secondary: ${profile.feed_item_id_2}).`);
                            return;
                        }

                        // 2. Fetch Inventory
                        let inventory = await getAccountInventory(kami.account_id);
                        let fedSuccessfully = false;

                        // 3. Attempt Feed with Items in priority
                        for (const itemId of feedItems) {
                            if (fedSuccessfully) break;

                            const foodCount = inventory[itemId] || 0;
                            const itemName = getItemName(itemId);

                            if (foodCount > 0) {
                                console.log(`[Automation] Kami #${kami.kami_index}: Found ${foodCount}x ${itemName} (Item #${itemId}). Attempting to feed...`);
                                
                                const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                                let retryCount = 0;
                                const maxRetries = 2;

                                while (retryCount <= maxRetries && !fedSuccessfully) {
                                    if (retryCount > 0) console.log(`[Automation] Kami #${kami.kami_index}: Retry attempt ${retryCount}/${maxRetries}...`);

                                    const result = await feedKami(
                                        kamiId, 
                                        itemId, 
                                        privateKey,
                                        userId,
                                        kami.kami_index,
                                        profile.id
                                    );

                                    if (result.success) {
                                        fedSuccessfully = true;
                                        const feedTime = new Date().toISOString();

                                        // 4. Update Profile
                                        await updateKamiProfile(profile.kamigotchi_id, {
                                            last_feed_at: feedTime
                                        });

                                        // 5. Post-Feed Check
                                        // Wait a moment for indexer? Or just check optimistic/account state?
                                        // Account inventory might verify decrement.
                                        // For now, re-fetch inventory to check supply for *next* time.
                                        inventory = await getAccountInventory(kami.account_id);
                                        const newCount = inventory[itemId] || 0;
                                        
                                        let msg = `[Auto Harvest: ${walletName}] Feeding ${kamiLabel} with ${itemName} at ${locationStr}. Remaining: ${newCount}.`;
                                        let status: 'success' | 'warning' = 'success';

                                        if (newCount === 0) {
                                            msg += ` ⚠️ WARNING: 0 ${itemName} remaining! Refill required.`;
                                            status = 'warning';
                                        }

                                        await logSystemEvent({
                                            user_id: userId,
                                            kami_index: kami.kami_index,
                                            kami_profile_id: profile.id,
                                            action: 'auto_feed_success',
                                            status: status,
                                            message: msg,
                                            metadata: { txHash: result.txHash, itemId, remaining: newCount }
                                        });

                                    } else {
                                        retryCount++;
                                        console.error(`[Automation] Kami #${kami.kami_index}: Feed failed (${result.error}).`);
                                        
                                        if (retryCount <= maxRetries) {
                                            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s before retry
                                        }
                                    }
                                }
                            } else {
                                console.log(`[Automation] Kami #${kami.kami_index}: Out of ${itemName} (Item #${itemId}). Skipping.`);
                            }
                        }

                        // 6. Final Failure Handling
                        if (!fedSuccessfully) {
                            console.error(`[Automation] Kami #${kami.kami_index}: Failed to feed after checking all items/retries.`);
                            
                            // Stop Harvesting
                            const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                            const stopResult = await stopHarvestByKamiId(kamiId, privateKey);
                            
                            // Log Critical Alert
                            await updateKamiProfile(profile.kamigotchi_id, {
                                is_currently_harvesting: false,
                                auto_harvest_enabled: false, // Disable to prevent restart loop
                                last_collect: now.toISOString()
                            });

                            const primaryItemName = getItemName(profile.feed_item_id);
                            
                            await logSystemEvent({
                                user_id: userId,
                                kami_index: kami.kami_index,
                                kami_profile_id: profile.id,
                                action: 'auto_feed_critical_stop',
                                status: 'error',
                                message: `[Auto Harvest: ${walletName}] CRITICAL: Could not feed ${kamiLabel} (Out of ${primaryItemName} or Tx Failed). Harvesting STOPPED to prevent death.`,
                                metadata: { txHash: stopResult.success ? stopResult.txHash : undefined, error: stopResult.error }
                            });
                            
                            return; // Stop processing
                        }
                        
                        return; // Done with this cycle if fed
                    }
                }
            }
            
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
                    message: `[Auto Harvest: ${walletName}] Health critically low for ${kamiLabel} at ${locationStr} (${currentHealth} / ${minHealth}). Emergency stop triggered.`
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
                        message: `[Auto Harvest: ${walletName}] Emergency stop successful for ${kamiLabel} due to low health (${currentHealth} HP). Resting started.`,
                        metadata: { txHash: result.txHash, currentHealth }
                    });
                    return; // Skip duration check if stopped
                } else {
                    throw new Error('Emergency stop failed: ' + result.error);
                }
            }

            // B. Duration Check
            if (strategy !== 'harvest_feed') {
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
                            message: `[Auto Harvest: ${walletName}] Harvest time exceeded for ${kamiLabel} at ${locationStr} (${Math.floor(elapsed/60000)}m / ${profile.harvest_duration}m). Stopping harvest.`
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
                                message: `[Auto Harvest: ${walletName}] Resting started for ${kamiLabel} at ${locationStr}.`,
                                metadata: { txHash: result.txHash }
                            });
                        } else {
                            throw new Error(result.error);
                        }
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
                    
                    // 1. Fetch Data
                    const kamiData = await getKamiById(kamiId);
                    const currentRoom = kamiData.room.index;
                    const account = await getAccountById(kamiData.account);

                    // 2. Determine Target Node
                    let nodeIndex = profile.harvest_node_index;
                    if (nodeIndex === null || nodeIndex === undefined || nodeIndex === 0) {
                        nodeIndex = account?.room ?? 0;
                    }

                    // 3. Strict Check: Account Room == Kami Room (Must be together)
                    if (account && account.room !== currentRoom) {
                        const msg = `Location mismatch: Account is in Room #${account.room}, but Kami is in Room #${currentRoom}. They must be together to start harvest. Please move manually.`;
                        console.warn(`[Automation] 🛑 ${msg}`);
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'automation_stopped',
                            status: 'error',
                            message: `[Auto Harvest: ${walletName}] Automation stopped for ${kamiLabel} - ${msg}`,
                            metadata: { accountRoom: account.room, kamiRoom: currentRoom }
                        });
                        return;
                    }

                    // 4. Strict Check: At Target Node
                    if (currentRoom !== nodeIndex) {
                        const msg = `Wrong Location: Kami/Account is in Room #${currentRoom}, but target is Node #${nodeIndex}. Please move manually.`;
                        console.warn(`[Automation] 🛑 ${msg}`);
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'automation_stopped',
                            status: 'error',
                            message: `[Auto Harvest: ${walletName}] Automation stopped for ${kamiLabel} - ${msg}`,
                            metadata: { currentRoom, targetNode: nodeIndex }
                        });
                        return;
                    }

                    // 5. Check Status (must be Resting)
                    const { state } = await getKamiState(kamiId);
                    if (state !== 0) { // 0 = Resting
                        console.log(`[Automation] Kami #${kami.kami_index}: State is not Resting (State: ${state}). Skipping start.`);
                        return; 
                    }

                    await logSystemEvent({
                        user_id: userId,
                        kami_index: kami.kami_index,
                        kami_profile_id: profile.id,
                        action: 'auto_start',
                        status: 'info',
                        message: `[Auto Harvest: ${walletName}] Checks passed. Starting harvest at Node #${nodeIndex}.`
                    });

                    const privateKey = await decryptPrivateKey(kami.encrypted_private_key);
                    
                    const result = await startHarvest({
                        kamiId,
                        nodeIndex,
                        privateKey
                    });

                    if (result.success) {
                        // 6. Confirm On-Chain (Wait and Verify)
                        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
                        const { state: newState } = await getKamiState(kamiId);
                        
                        if (newState === 1) { // Harvesting
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
                                message: `[Auto Harvest: ${walletName}] Harvesting started & confirmed for ${kamiLabel} at ${locationStr} (Harvest ID: ${result.harvestId || '?'}).`,
                                metadata: { txHash: result.txHash, harvestId: result.harvestId }
                            });
                        } else {
                            // Tx success but state not updated?
                             await logSystemEvent({
                                user_id: userId,
                                kami_index: kami.kami_index,
                                kami_profile_id: profile.id,
                                action: 'auto_start_warning',
                                status: 'warning',
                                message: `[Auto Harvest: ${walletName}] Harvest Tx sent but state is not Harvesting yet. Will retry verification next cycle.`,
                                metadata: { txHash: result.txHash }
                            });
                        }
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
                message: `[Auto Harvest: ${walletName}] CRITICAL for ${kamiLabel} - Active Harvest ID lost. Automation DISABLED. Please STOP manually.`,
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
            message: `[Auto Harvest: ${walletName}] Automation failed for ${kamiLabel}: ${errorMsg}`,
            metadata: { error: errorMsg }
        });
    }
}
