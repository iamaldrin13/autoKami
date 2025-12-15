import { getKamisByAccountId, getAccountById } from './accountService.js';
import { getRoomName, findShortestPath, PathResult } from '../utils/roomPathfinding.js';
import { MappedKamiData } from './kamiService.js';
import { supabase } from './supabaseService.js';

export interface KamiLocation {
    id: string;
    index: number;
    name: string;
    roomIndex: number;
    roomName: string;
    state: string;
}

export interface WatchlistAccount {
    accountId: string;
    accountName: string;
    accountRoomIndex: number; // The room of one of the account's Kami (e.g., the first one)
    kamis: KamiLocation[];
}

export interface WatchlistResult {
    targetAccount: WatchlistAccount;
    userAccounts: {
        accountId: string;
        distance: number | null; // Distance to target account's Kami
    }[];
}

/**
 * Retrieves the location details for all Kamis associated with a given account ID.
 * @param accountId The ID of the account to query.
 * @returns An array of KamiLocation objects.
 */
export async function getAccountKamiLocations(accountId: string): Promise<KamiLocation[]> {
    console.log(`[WatchlistService] Fetching Kami locations for account ID: ${accountId}`);
    const kamis = await getKamisByAccountId(accountId);
    return kamis.map((kami: any) => ({
        id: kami.id,
        index: kami.index,
        name: kami.name,
        roomIndex: kami.room.index,
        roomName: kami.room.name,
        state: kami.state
    }));
}

/**
 * Calculates the distance between a target account's Kami and multiple user accounts' Kamis.
 * @param targetAccountId The ID of the account to track.
 * @param userAccountIds An array of user account IDs.
 * @returns A WatchlistResult object containing target account info and distances to user accounts.
 */
export async function getWatchlistData(targetAccountId: string, userAccountIds: string[]): Promise<WatchlistResult | null> {
    console.log(`[WatchlistService] Getting watchlist data for target: ${targetAccountId}, user accounts: ${userAccountIds.join(', ')}`);

    // 1. Get target account's Kami locations
    const targetKamiLocations = await getAccountKamiLocations(targetAccountId);
    if (targetKamiLocations.length === 0) {
        console.warn(`[WatchlistService] Target account ${targetAccountId} has no Kamis.`);
        return null;
    }
    const targetKamiRoomIndex = targetKamiLocations[0].roomIndex; // Use the first Kami's room as the target's location for distance calculation

    const targetAccountDetails = await getAccountById(targetAccountId);
    const targetAccountName = targetAccountDetails?.name || `Account ${targetAccountId}`;

    const userAccountDistances = await Promise.all(userAccountIds.map(async userId => {
        const userKamiLocations = await getAccountKamiLocations(userId);
        let distance: number | null = null;

        if (userKamiLocations.length > 0) {
            const userKamiRoomIndex = userKamiLocations[0].roomIndex; // Use the first Kami's room as the user's location
            const pathResult = findShortestPath(userKamiRoomIndex, targetKamiRoomIndex);
            distance = pathResult ? pathResult.distance : null;
            console.log(`[WatchlistService] Distance from user ${userId} (Room ${userKamiRoomIndex}) to target ${targetAccountId} (Room ${targetKamiRoomIndex}): ${distance} hops`);
        } else {
            console.warn(`[WatchlistService] User account ${userId} has no Kamis.`);
        }
        return { accountId: userId, distance };
    }));

    return {
        targetAccount: {
            accountId: targetAccountId,
            accountName: targetAccountName,
            accountRoomIndex: targetKamiRoomIndex,
            kamis: targetKamiLocations,
        },
        userAccounts: userAccountDistances
    };
}

/**
 * Adds an account to the user's watchlist in Supabase.
 * @param userId The ID of the user adding to the watchlist.
 * @param targetAccountId The ID of the account to add to the watchlist.
 * @returns The Supabase data response.
 */
export async function addAccountToWatchlist(userId: string, targetAccountId: string) {
    console.log(`[WatchlistService] Adding account ${targetAccountId} to user ${userId}'s watchlist.`);
    const { data, error } = await supabase
        .from('watchlist') // Assuming a 'watchlist' table exists or will be created
        .insert({ user_id: userId, target_account_id: targetAccountId })
        .select();

    if (error) {
        console.error('[WatchlistService] Failed to add account to watchlist:', error);
        throw new Error(`Failed to add account to watchlist: ${error.message}`);
    }
    console.log(`[WatchlistService] Successfully added account ${targetAccountId} to user ${userId}'s watchlist.`);
    return data;
}

/**
 * Removes an account from the user's watchlist in Supabase.
 * @param userId The ID of the user.
 * @param targetAccountId The ID of the account to remove.
 * @returns The Supabase data response.
 */
export async function removeAccountFromWatchlist(userId: string, targetAccountId: string) {
    console.log(`[WatchlistService] Removing account ${targetAccountId} from user ${userId}'s watchlist.`);
    const { data, error } = await supabase
        .from('watchlist')
        .delete()
        .eq('user_id', userId)
        .eq('target_account_id', targetAccountId);

    if (error) {
        console.error('[WatchlistService] Failed to remove account from watchlist:', error);
        throw new Error(`Failed to remove account from watchlist: ${error.message}`);
    }
    console.log(`[WatchlistService] Successfully removed account ${targetAccountId} from user ${userId}'s watchlist.`);
    return data;
}

/**
 * Retrieves the watchlist for a given user from Supabase.
 * @param userId The ID of the user.
 * @returns An array of target account IDs in the watchlist.
 */
export async function getUserWatchlist(userId: string): Promise<string[]> {
    console.log(`[WatchlistService] Retrieving watchlist for user ID: ${userId}`);
    const { data, error } = await supabase
        .from('watchlist')
        .select('target_account_id')
        .eq('user_id', userId);

    if (error) {
        console.error('[WatchlistService] Failed to retrieve watchlist:', error);
        throw new Error(`Failed to retrieve watchlist: ${error.message}`);
    }
    console.log(`[WatchlistService] Watchlist retrieved for user ${userId}: ${data.map((d: any) => d.target_account_id).join(', ')}`);
    return data.map((item: any) => item.target_account_id);
}

