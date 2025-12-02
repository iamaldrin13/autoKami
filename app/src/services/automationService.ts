import {
    getKamigotchis,
    getOrCreateKamiProfile,
    updateKamiProfile,
    logSystemEvent,
    decryptPrivateKey
} from './supabaseService.js';
import { startHarvest, stopHarvestByKamiId, getKamiState } from './harvestService.js';
import { getKamiByIndex } from './kamiService.js';
import supabase from './supabaseService.js';

const POLL_INTERVAL_MS = 60000; // Check every 60 seconds

export async function runAutomationLoop() {
    console.log('🔄 Starting Automation Loop...');
    
    // Initial run
    await processAutomation();

    // Loop
    setInterval(processAutomation, POLL_INTERVAL_MS);
}

async function processAutomation() {
    try {
        // 1. Fetch all enabled automation profiles
        const { data: profiles, error } = await supabase
            .from('kami_profiles')
            .select('*, kamigotchis!inner(kami_entity_id, encrypted_private_key, user_id, kami_index, kami_name)')
            .eq('auto_harvest_enabled', true);

        if (error) throw error;
        if (!profiles || profiles.length === 0) return;

        console.log(`[Automation] Processing ${profiles.length} active profiles...`);

        for (const profile of profiles) {
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
                    if (currentHealth < minHealth) {
                        console.log(`[Automation] Kami #${kami.kami_index}: Low Health (${currentHealth} < ${minHealth}). Stopping...`);
                        
                        await logSystemEvent({
                            user_id: userId,
                            kami_index: kami.kami_index,
                            kami_profile_id: profile.id,
                            action: 'low_health_stop',
                            status: 'warning',
                            message: `Health critically low (${currentHealth} / ${minHealth}). Emergency stop triggered (Node #${profile.harvest_node_index ?? '?'}).`
                        });

                        const privateKey = decryptPrivateKey(kami.encrypted_private_key);
                        const result = await stopHarvestByKamiId(kamiId, privateKey);

                        if (result.success) {
                            await updateKamiProfile(profile.kamigotchi_id, {
                                is_currently_harvesting: false,
                                last_collect: now.toISOString()
                            });
                            await logSystemEvent({
                                user_id: userId,
                                kami_index: kami.kami_index,
                                kami_profile_id: profile.id,
                                action: 'low_health_stop',
                                status: 'success',
                                message: `Harvest stopped due to low health (Node #${profile.harvest_node_index ?? '?'}). Resting.`,
                                metadata: { txHash: result.txHash, currentHealth }
                            });
                            continue; // Skip duration check if stopped
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
                                message: `Harvest duration (${profile.harvest_duration}m) exceeded. Stopping harvest (Node #${profile.harvest_node_index ?? '?'}).`
                            });

                            const privateKey = decryptPrivateKey(kami.encrypted_private_key);
                            const result = await stopHarvestByKamiId(kamiId, privateKey);

                            if (result.success) {
                                await updateKamiProfile(profile.kamigotchi_id, {
                                    is_currently_harvesting: false,
                                    last_collect: now.toISOString()
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

                            await logSystemEvent({
                                user_id: userId,
                                kami_index: kami.kami_index,
                                kami_profile_id: profile.id,
                                action: 'auto_start',
                                status: 'info',
                                message: `Rest duration (${profile.rest_duration}m) exceeded. Starting harvest.`
                            });

                            const privateKey = decryptPrivateKey(kami.encrypted_private_key);
                            // Use configured node or default to 0
                            const nodeIndex = profile.harvest_node_index || 0; 
                            
                            const result = await startHarvest({
                                kamiId,
                                nodeIndex,
                                privateKey
                            });

                            if (result.success) {
                                await updateKamiProfile(profile.kamigotchi_id, {
                                    is_currently_harvesting: true,
                                    last_harvest_start: now.toISOString()
                                });
                                await logSystemEvent({
                                    user_id: userId,
                                    kami_index: kami.kami_index,
                                    kami_profile_id: profile.id,
                                    action: 'auto_start',
                                    status: 'success',
                                    message: `Harvest started successfully at Node #${nodeIndex}.`,
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
                
                await logSystemEvent({
                    user_id: userId,
                    kami_index: kami.kami_index,
                    kami_profile_id: profile.id,
                    action: 'automation_error',
                    status: 'error',
                    message: `Automation failed: ${errorMsg}`,
                    metadata: { error: errorMsg }
                });
            }
        }

    } catch (error) {
        console.error('[Automation] Loop error:', error);
    }
}
