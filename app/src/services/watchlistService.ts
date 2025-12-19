import { getKamisByAccountId, getAccountById } from './accountService.js';
import { getRoomName, findShortestPath, PathResult } from '../utils/roomPathfinding.js';
import { MappedKamiData, getKamiByIndex } from './kamiService.js';
import supabase from './supabaseService.js';

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
 * Resolves an Account ID from a Kami Index.
 * @param kamiIndex The index of the Kami.
 * @returns The Account ID that owns the Kami.
 */
export async function getAccountIdByKamiIndex(kamiIndex: number): Promise<string> {
    console.log(`[WatchlistService] Resolving Account ID for Kami Index: ${kamiIndex}`);
    const kami = await getKamiByIndex(kamiIndex);
    if (!kami || !kami.account) {
        throw new Error(`Kami #${kamiIndex} not found or has no owner.`);
    }
    console.log(`[WatchlistService] Kami #${kamiIndex} is owned by Account ${kami.account}`);
    return kami.account;
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
    
    // Fetch Kamis for this account to get a valid entity ID and Name for the DB constraint
    const kamis = await getKamisByAccountId(targetAccountId);
    
    let kamiEntityId = '0'; // Default fallback
    let kamiName = `Account ${targetAccountId}`;
    
    if (kamis && kamis.length > 0) {
        kamiEntityId = kamis[0].id;
        kamiName = kamis[0].name || kamiName;
    } else {
        console.warn(`[WatchlistService] Account ${targetAccountId} has no Kamis. Using default values.`);
        // Depending on DB constraints, this might fail if we don't have a valid entity ID.
        // But we proceed as the user requested to watch the account.
    }

    const { data, error } = await supabase
        .from('watchlists')
        .insert({ 
            user_id: userId, 
            account_id: targetAccountId,
            kami_entity_id: kamiEntityId,
            kami_name: kamiName
        })
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
        .from('watchlists')
        .delete()
        .eq('user_id', userId)
        .eq('account_id', targetAccountId);

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
        .from('watchlists')
        .select('account_id')
        .eq('user_id', userId);

    if (error) {
        console.error('[WatchlistService] Failed to retrieve watchlist:', error);
        throw new Error(`Failed to retrieve watchlist: ${error.message}`);
    }
    console.log(`[WatchlistService] Watchlist retrieved for user ${userId}: ${data.map((d: any) => d.account_id).join(', ')}`);
    return data.map((item: any) => item.account_id);
}

