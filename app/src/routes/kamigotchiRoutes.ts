import { Router, Request, Response } from 'express';
import {
    getOrCreateUser,
    getOperatorWallets,
    upsertKamigotchi,
    getKamigotchis,
    getKamigotchiById,
    getKamigotchiByEntityId,
    deleteKamigotchi,
    getOrCreateKamiProfile,
    updateKamiProfile,
    decryptPrivateKey,
    logSystemEvent,
    getAutoCraftingSettings,
    upsertAutoCraftingSettings
} from '../services/supabaseService.js';
import { getKamisByAccountId, getAccountById } from '../services/accountService.js';
import { startHarvest, stopHarvestByKamiId, isKamiHarvesting } from '../services/harvestService.js';
import { processCraftingAutomation } from '../services/automationService.js';
import { getKamiById } from '../services/kamiService.js';

const router = Router();

/**
 * POST /api/kamigotchis/refresh
 * Refresh Kamigotchis from blockchain for a user
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { privyUserId, operatorWalletId } = req.body;

        if (!privyUserId) {
            return res.status(400).json({
                error: 'Missing required field: privyUserId'
            });
        }

        // Get or create user
        const user = await getOrCreateUser(privyUserId);

        // Get operator wallets
        let wallets = await getOperatorWallets(user.id);
        if (operatorWalletId) {
            wallets = wallets.filter(w => w.id === operatorWalletId);
        }

        if (wallets.length === 0) {
            return res.json({ success: true, synced: 0, message: 'No active profiles found' });
        }

        let syncedCount = 0;
        const errors: string[] = [];

        for (const wallet of wallets) {
            try {
                console.log(`[Refresh] Syncing wallet ${wallet.name} (${wallet.account_id})...`);
                const kamis = await getKamisByAccountId(wallet.account_id);
                console.log(`[Refresh] Found ${kamis.length} Kamis on-chain.`);

                const privateKey = await decryptPrivateKey(wallet.encrypted_private_key);

                for (const kami of kamis) {
                    console.log(`[Refresh] Upserting Kami #${kami.index} (Name: ${kami.name})`);
                    await upsertKamigotchi({
                        userId: user.id,
                        operatorWalletId: wallet.id,
                        kamiEntityId: kami.id,
                        kamiIndex: kami.index,
                        kamiName: kami.name,
                        level: kami.level,
                        state: kami.state,
                        roomIndex: kami.room.index,
                        roomName: kami.room.name,
                        mediaUri: kami.mediaURI,
                        accountId: kami.account,
                        affinities: kami.affinities,
                        stats: kami.stats,
                        finalStats: kami.finalStats,
                        traits: kami.traits,
                        privateKey: privateKey,
                        currentHealth: kami.currentHealth
                    });
                    syncedCount++;
                }
            } catch (err: any) {
                console.error(`[Refresh] Error syncing wallet ${wallet.id}:`, err);
                errors.push(err.message);
            }
        }

        return res.json({
            success: true,
            synced: syncedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Refresh error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to refresh kamigotchis'
        });
    }
});

/**
 * GET /api/kamigotchis
 * Get all kamigotchis for a user from Supabase
 * 
 * Query:
 * - privyUserId: string (Privy user ID)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { privyUserId, operatorWalletId } = req.query;

        if (!privyUserId || typeof privyUserId !== 'string') {
            return res.status(400).json({
                error: 'Missing required query parameter: privyUserId'
            });
        }

        // Get user
        const user = await getOrCreateUser(privyUserId);

        // Get kamigotchis (filtered by profile if provided)
        const kamigotchis = await getKamigotchis(user.id, typeof operatorWalletId === 'string' ? operatorWalletId : undefined);

        // Get automation profiles for each kamigotchi
        const kamigotchisWithProfiles = await Promise.all(
            kamigotchis.map(async (kami) => {
                try {
                    const profile = await getOrCreateKamiProfile(kami.id, kami.operator_wallet_id);
                    
                    // Get crafting settings for the wallet
                    const crafting = await getAutoCraftingSettings(kami.operator_wallet_id);

                    // Optimization: Use DB state instead of on-chain call for list view
                    // The automation loop keeps profile.is_currently_harvesting updated
                    const isHarvesting = profile.is_currently_harvesting;

                    return {
                        id: kami.id,
                        entityId: kami.kami_entity_id,
                        index: kami.kami_index,
                        name: kami.kami_name,
                        level: kami.level,
                        state: isHarvesting ? 'HARVESTING' : kami.state,
                        room: {
                            index: kami.room_index,
                            name: kami.room_name
                        },
                        mediaURI: kami.media_uri,
                        accountId: kami.account_id,
                        operator_wallet_id: kami.operator_wallet_id,
                        affinities: kami.affinities,
                        stats: kami.stats,
                        finalStats: kami.final_stats,
                        currentHealth: kami.current_health,
                        traits: kami.traits,
                        automation: {
                            autoHarvestEnabled: profile.auto_harvest_enabled,
                            harvestNodeIndex: profile.harvest_node_index,
                            autoCollectEnabled: profile.auto_collect_enabled,
                            autoRestartEnabled: profile.auto_restart_enabled,
                            minHealthThreshold: profile.min_health_threshold,
                            harvestDuration: profile.harvest_duration,
                            restDuration: profile.rest_duration,
                            isCurrentlyHarvesting: isHarvesting,
                            // Crafting
                            autoCraftEnabled: crafting?.is_enabled || false,
                            craftingRecipeId: crafting?.recipe_id || null,
                            craftingAmount: crafting?.amount_to_craft || 1,
                            craftingInterval: crafting?.interval_minutes || 60,
                            lastHarvestStart: profile.last_harvest_start,
                            lastCollect: profile.last_collect,
                            // Stats
                            totalHarvests: profile.total_harvests || 0,
                            totalRests: profile.total_rests || 0,
                            automationStartedAt: profile.automation_started_at,
                            strategyType: profile.strategy_type || 'harvest_rest',
                            feedItemId: profile.feed_item_id,
                            feedItemId2: profile.feed_item_id_2,
                            feedTriggerValue: profile.feed_trigger_value,
                            feedIntervalMinutes: profile.feed_interval_minutes,
                            lastFeedAt: profile.last_feed_at
                        },
                        lastSynced: kami.last_synced
                    };
                } catch (error) {
                    console.error(`Error getting profile for kamigotchi ${kami.id}:`, error);
                    return null;
                }
            })
        );

        // Filter out nulls
        const validKamigotchis = kamigotchisWithProfiles.filter(k => k !== null);

        return res.json({
            kamigotchis: validKamigotchis
        });
    } catch (error) {
        console.error('Error getting kamigotchis:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get kamigotchis'
        });
    }
});

// ... (DELETE /:id remains unchanged)

/**
 * PATCH /api/kamigotchis/:id/automation
 * Update automation settings for a kamigotchi
 */
router.patch('/:id/automation', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!id) {
            return res.status(400).json({
                error: 'Missing kamigotchi ID'
            });
        }

        // Handle Crafting Settings (Operator Level)
        if (updates.autoCraftEnabled !== undefined || updates.craftingRecipeId !== undefined) {
            const kami = await getKamigotchiById(id);
            if (kami) {
                // We need to fetch existing to merge if partial update, or upsert handles it? 
                // Frontend usually sends full state for simplicity from the modal.
                // But let's be robust.
                
                const existingCrafting = await getAutoCraftingSettings(kami.operator_wallet_id);
                
                await upsertAutoCraftingSettings({
                    operator_wallet_id: kami.operator_wallet_id,
                    is_enabled: updates.autoCraftEnabled !== undefined ? updates.autoCraftEnabled : (existingCrafting?.is_enabled || false),
                    recipe_id: updates.craftingRecipeId || existingCrafting?.recipe_id || 6,
                    amount_to_craft: updates.craftingAmount || existingCrafting?.amount_to_craft || 1,
                    interval_minutes: updates.craftingInterval || existingCrafting?.interval_minutes || 60,
                    last_run_at: null as any // Reset timer to trigger immediate run via automation loop
                });
            }
        }

        // Map frontend field names to database column names for Harvesting (Kami Profile Level)
        const dbUpdates: any = {};
        if (updates.autoHarvestEnabled !== undefined) dbUpdates.auto_harvest_enabled = updates.autoHarvestEnabled;
        if (updates.harvestNodeIndex !== undefined) dbUpdates.harvest_node_index = updates.harvestNodeIndex;
        if (updates.autoCollectEnabled !== undefined) dbUpdates.auto_collect_enabled = updates.autoCollectEnabled;
        if (updates.autoRestartEnabled !== undefined) dbUpdates.auto_restart_enabled = updates.autoRestartEnabled;
        if (updates.minHealthThreshold !== undefined) dbUpdates.min_health_threshold = updates.minHealthThreshold;
        if (updates.harvestDuration !== undefined) dbUpdates.harvest_duration = updates.harvestDuration;
        if (updates.restDuration !== undefined) dbUpdates.rest_duration = updates.restDuration;
        if (updates.strategyType !== undefined) dbUpdates.strategy_type = updates.strategyType;
        if (updates.feedItemId !== undefined) dbUpdates.feed_item_id = updates.feedItemId;
        if (updates.feedItemId2 !== undefined) dbUpdates.feed_item_id_2 = updates.feedItemId2;
        if (updates.feedTriggerValue !== undefined) dbUpdates.feed_trigger_value = updates.feedTriggerValue;
        if (updates.feedIntervalMinutes !== undefined) dbUpdates.feed_interval_minutes = updates.feedIntervalMinutes;

        // Update profile if there are harvest settings
        let profile;
        if (Object.keys(dbUpdates).length > 0) {
            // Handle automation_started_at logic
            if (dbUpdates.auto_harvest_enabled !== undefined) {
                 const kami = await getKamigotchiById(id);
                 if (kami) {
                     const existingProfile = await getOrCreateKamiProfile(id, kami.operator_wallet_id);
                     if (dbUpdates.auto_harvest_enabled === true && !existingProfile.auto_harvest_enabled) {
                         dbUpdates.automation_started_at = new Date().toISOString();
                     } else if (dbUpdates.auto_harvest_enabled === false) {
                         dbUpdates.automation_started_at = null;
                     }
                 }
            }

            profile = await updateKamiProfile(id, dbUpdates);
        } else {
            // Fetch existing profile to return consistent response
            const kami = await getKamigotchiById(id);
            if (kami) {
                profile = await getOrCreateKamiProfile(id, kami.operator_wallet_id);
            }
        }

        if (!profile) return res.status(404).json({ error: "Profile not found" });

        // Return merged settings
        const kami = await getKamigotchiById(id);
        const crafting = kami ? await getAutoCraftingSettings(kami.operator_wallet_id) : null;

        return res.json({
            success: true,
            automation: {
                autoHarvestEnabled: profile.auto_harvest_enabled,
                harvestNodeIndex: profile.harvest_node_index,
                autoCollectEnabled: profile.auto_collect_enabled,
                autoRestartEnabled: profile.auto_restart_enabled,
                minHealthThreshold: profile.min_health_threshold,
                harvestDuration: profile.harvest_duration,
                restDuration: profile.rest_duration,
                strategyType: profile.strategy_type || 'harvest_rest',
                feedItemId: profile.feed_item_id,
                feedItemId2: profile.feed_item_id_2,
                feedTriggerValue: profile.feed_trigger_value,
                feedIntervalMinutes: profile.feed_interval_minutes,
                // Crafting
                autoCraftEnabled: crafting?.is_enabled || false,
                craftingRecipeId: crafting?.recipe_id || null,
                craftingAmount: crafting?.amount_to_craft || 1,
                craftingInterval: crafting?.interval_minutes || 60
            }
        });
    } catch (error) {
        console.error('Error updating automation:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to update automation'
        });
    }
});

// ... (Rest of the file: start/stop/auto harvest endpoints)

/**
 * POST /api/kamigotchis/:id/harvest/start
 * Start harvesting (uses stored private key)
 * 
 * Body:
 * - nodeIndex?: number (optional, uses automation setting if not provided)
 */
router.post('/:id/harvest/start', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { nodeIndex } = req.body;

        if (!id) {
            return res.status(400).json({
                error: 'Missing kamigotchi ID'
            });
        }

        // Get kamigotchi
        const kami = await getKamigotchiById(id);
        if (!kami) {
            return res.status(404).json({
                error: 'Kamigotchi not found'
            });
        }

        // Get automation profile for node index if not provided
        let harvestNodeIndex = nodeIndex;
        if (harvestNodeIndex === undefined) {
            const profile = await getOrCreateKamiProfile(kami.id, kami.operator_wallet_id);
            harvestNodeIndex = profile.harvest_node_index || kami.room_index || 0;
        }

        // --- Location Check ---
        try {
            const kamiData = await getKamiById(kami.kami_entity_id);
            const account = await getAccountById(kamiData.account);
            
            if (account && account.room !== harvestNodeIndex) {
                const msg = `Manual start failed: Account is in Room #${account.room}, but target is Node #${harvestNodeIndex}. Please move manually.`;
                
                // Log the failed attempt
                const profile = await getOrCreateKamiProfile(kami.id, kami.operator_wallet_id);
                await logSystemEvent({
                    user_id: kami.user_id,
                    kami_index: kami.kami_index,
                    kami_profile_id: profile.id,
                    action: 'manual_start_harvest_fail',
                    status: 'error',
                    message: msg,
                    metadata: { currentRoom: account.room, targetNode: harvestNodeIndex }
                });

                return res.status(400).json({ error: msg });
            }
        } catch (e) {
            console.error('[ManualStart] Location check failed:', e);
            // Don't block on check failure, try to proceed or fail?
            // Better to fail safely if we can't verify
            return res.status(500).json({ error: 'Failed to verify location before harvest.' });
        }
        // ----------------------

        // Decrypt private key
        const privateKey = await decryptPrivateKey(kami.encrypted_private_key);

        // Start harvest
        const result = await startHarvest({
            kamiId: kami.kami_entity_id,
            nodeIndex: harvestNodeIndex,
            privateKey
        });

        // Get profile for logging
        const profile = await getOrCreateKamiProfile(kami.id, kami.operator_wallet_id);

        if (result.success) {
            // Update profile
            const updates: any = {
                is_currently_harvesting: true,
                last_harvest_start: new Date().toISOString(),
                auto_harvest_enabled: true, // Enable automation when started manually via UI
                total_harvests: (profile.total_harvests || 0) + 1
            };
            
            // Set start time if not already running
            if (!profile.auto_harvest_enabled) {
                updates.automation_started_at = new Date().toISOString();
            }

            await updateKamiProfile(kami.id, updates);

            await logSystemEvent({
                user_id: kami.user_id,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'manual_start_harvest',
                status: 'success',
                message: `Manual harvest started for Kami #${kami.kami_index} at Node #${harvestNodeIndex}.`,
                metadata: { txHash: result.txHash, harvestId: result.harvestId }
            });

            return res.json({
                success: true,
                txHash: result.txHash,
                harvestId: result.harvestId
            });
        } else {
            await logSystemEvent({
                user_id: kami.user_id,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'manual_start_harvest_fail',
                status: 'error',
                message: `Manual harvest start failed for Kami #${kami.kami_index}: ${result.error}`,
                metadata: { error: result.error }
            });

            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error starting harvest:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to start harvest'
        });
    }
});

/**
 * POST /api/kamigotchis/:id/harvest/stop
 * Stop harvesting (uses stored private key)
 */
router.post('/:id/harvest/stop', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                error: 'Missing kamigotchi ID'
            });
        }

        // Get kamigotchi
        const kami = await getKamigotchiById(id);
        if (!kami) {
            return res.status(404).json({
                error: 'Kamigotchi not found'
            });
        }

        // Decrypt private key
        const privateKey = await decryptPrivateKey(kami.encrypted_private_key);

        // Stop harvest
        const result = await stopHarvestByKamiId(kami.kami_entity_id, privateKey);

        // Get profile for logging
        const profile = await getOrCreateKamiProfile(kami.id, kami.operator_wallet_id);

        if (result.success) {
            // Update profile
            await updateKamiProfile(kami.id, {
                is_currently_harvesting: false,
                auto_harvest_enabled: false, // Disable automation when stopped manually via UI
                total_rests: (profile.total_rests || 0) + 1,
                automation_started_at: null
            });

            await logSystemEvent({
                user_id: kami.user_id,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'manual_stop_harvest',
                status: 'success',
                message: `Manual harvest stopped for Kami #${kami.kami_index}.`,
                metadata: { txHash: result.txHash }
            });

            return res.json({
                success: true,
                txHash: result.txHash
            });
        } else {
            await logSystemEvent({
                user_id: kami.user_id,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: 'manual_stop_harvest_fail',
                status: 'error',
                message: `Manual harvest stop failed for Kami #${kami.kami_index}: ${result.error}`,
                metadata: { error: result.error }
            });

            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error stopping harvest:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to stop harvest'
        });
    }
});

/**
 * POST /api/kamigotchis/:id/harvest/auto
 * Toggle auto-harvest
 * 
 * Body:
 * - enabled: boolean
 */
router.post('/:id/harvest/auto', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (!id) {
            return res.status(400).json({
                error: 'Missing kamigotchi ID'
            });
        }

        if (enabled === undefined) {
            return res.status(400).json({
                error: 'Missing required field: enabled'
            });
        }

        const updates: any = {
            auto_harvest_enabled: enabled
        };

        if (enabled) {
             const kami = await getKamigotchiById(id);
             if (kami) {
                 const existingProfile = await getOrCreateKamiProfile(id, kami.operator_wallet_id);
                 if (!existingProfile.auto_harvest_enabled) {
                     updates.automation_started_at = new Date().toISOString();
                 }
             }
        } else {
             updates.automation_started_at = null;
        }

        // Update automation profile
        const profile = await updateKamiProfile(id, updates);

        // Fetch kamigotchi to get kami_index and user_id for logging
        const kami = await getKamigotchiById(id);
        if (kami) {
            await logSystemEvent({
                user_id: kami.user_id,
                kami_index: kami.kami_index,
                kami_profile_id: profile.id,
                action: enabled ? 'start_auto_harvest' : 'stop_auto_harvest',
                status: 'success',
                message: enabled ? `Auto-harvest ENABLED for Kami #${kami.kami_index}.` : `Auto-harvest DISABLED for Kami #${kami.kami_index}.`
            });
        }

        return res.json({
            success: true,
            autoHarvestEnabled: profile.auto_harvest_enabled
        });
    } catch (error) {
        console.error('Error toggling auto-harvest:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to toggle auto-harvest'
        });
    }
});

export default router;
