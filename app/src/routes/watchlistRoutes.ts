import express from 'express';
import supabase from '../services/supabaseService.js';
import { 
    getWatchlistData, 
    addAccountToWatchlist, 
    removeAccountFromWatchlist, 
    getUserWatchlist,
    getAccountIdByKamiIndex
} from '../services/watchlistService.js';
import { getAccountKamiLocationsLight } from '../services/accountService.js';

const router = express.Router();

/**
 * Helper to get unique account IDs associated with a user's profiles
 */
async function getUserAccountIds(userId: string): Promise<string[]> {
    // 1. Get Kami Entity IDs from user's profiles
    const { data: profiles, error: profileError } = await supabase
        .from('kami_profiles')
        .select('kami_entity_id')
        .eq('user_id', userId);

    if (profileError || !profiles || profiles.length === 0) {
        return [];
    }

    const entityIds = profiles.map((p: any) => p.kami_entity_id);

    // 2. Get Account IDs for those Kamis from the 'kamis' table
    const { data: kamis, error: kamiError } = await supabase
        .from('kamis')
        .select('account_id')
        .in('entity_id', entityIds);

    if (kamiError || !kamis) {
        return [];
    }

    // 3. Return unique account IDs
    const ids: string[] = kamis.map((k: any) => String(k.account_id));
    return Array.from(new Set(ids));
}

// GET /watchlist - Get user's watchlist (list of account IDs)
router.get('/', async (req, res) => {
    try {
        const userId = req.query.privyUserId as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing privyUserId' });
        }

        const watchlist = await getUserWatchlist(userId);
        res.json({ watchlist });
    } catch (error: any) {
        console.error('[WatchlistRoutes] Error getting watchlist:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /watchlist/live - Get live data for all accounts in watchlist
router.get('/live', async (req, res) => {
    try {
        const userId = req.query.privyUserId as string;
        if (!userId) {
            return res.status(400).json({ error: 'Missing privyUserId' });
        }

        // 1. Get user's watchlist (target accounts)
        const targetAccountIds = await getUserWatchlist(userId);
        if (targetAccountIds.length === 0) {
            return res.json({ data: [] });
        }

        // 2. Get user's own accounts (for distance calc)
        const userAccountIds = await getUserAccountIds(userId);

        // OPTIMIZATION: Pre-fetch user locations ONCE
        // Fetch locations for all user accounts in parallel
        const userLocationsRaw = await Promise.all(
            userAccountIds.map(accId => getAccountKamiLocationsLight(accId))
        );

        // Flatten and map to { accountId, roomIndex }
        // We only need one valid location per account (assuming all Kamis in account move together or using first one)
        const userLocations: { accountId: string, roomIndex: number }[] = [];
        
        userLocationsRaw.forEach((locs, idx) => {
            if (locs && locs.length > 0) {
                userLocations.push({
                    accountId: userAccountIds[idx],
                    roomIndex: locs[0].roomIndex
                });
            }
        });

        // 3. Fetch data for each target account
        // Now passing pre-fetched userLocations
        const results = await Promise.all(
            targetAccountIds.map((targetId: string) => getWatchlistData(targetId, userLocations))
        );

        // Filter out nulls
        const validResults = results.filter((r: any) => r !== null);

        res.json({ data: validResults });
    } catch (error: any) {
        console.error('[WatchlistRoutes] Error getting live watchlist:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /watchlist - Add account to watchlist
router.post('/', async (req, res) => {
    try {
        const { privyUserId, targetAccountId, targetKamiIndex } = req.body;
        
        if (!privyUserId) {
             return res.status(400).json({ error: 'Missing privyUserId' });
        }

        let accountIdToAdd = targetAccountId;

        // If Kami Index provided, resolve to Account ID
        if (targetKamiIndex !== undefined && targetKamiIndex !== null) {
            try {
                accountIdToAdd = await getAccountIdByKamiIndex(Number(targetKamiIndex));
            } catch (err: any) {
                return res.status(404).json({ error: err.message });
            }
        }

        if (!accountIdToAdd) {
            return res.status(400).json({ error: 'Missing targetAccountId or targetKamiIndex' });
        }

        await addAccountToWatchlist(privyUserId, accountIdToAdd);
        res.json({ success: true, addedAccountId: accountIdToAdd });
    } catch (error: any) {
        console.error('[WatchlistRoutes] Error adding to watchlist:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /watchlist/:targetAccountId - Remove account from watchlist
router.delete('/:targetAccountId', async (req, res) => {
    try {
        const userId = req.query.privyUserId as string;
        const targetAccountId = req.params.targetAccountId;
        
        if (!userId || !targetAccountId) {
            return res.status(400).json({ error: 'Missing privyUserId or targetAccountId' });
        }

        await removeAccountFromWatchlist(userId, targetAccountId);
        res.json({ success: true });
    } catch (error: any) {
        console.error('[WatchlistRoutes] Error removing from watchlist:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;