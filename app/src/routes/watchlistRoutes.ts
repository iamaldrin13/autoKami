import { Router, Request, Response } from 'express';
import { getKamisByAccountId, getAccountById } from '../services/accountService.js';
import { addToWatchlist, removeFromWatchlist, getWatchlist, getOperatorWallets } from '../services/supabaseService.js';
import { getKamiByIndex } from '../services/kamiService.js';
import { findShortestPath } from '../utils/roomPathfinding.js';

const router = Router();

/**
 * GET /api/watchlist
 * Get user's watchlist
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { privyUserId } = req.query;
    if (!privyUserId || typeof privyUserId !== 'string') {
        return res.status(400).json({ error: 'Missing privyUserId' });
    }
    
    const items = await getWatchlist(privyUserId);
    
    // Map to camelCase
    const mappedItems = items.map(i => ({
        id: i.id,
        userId: i.user_id,
        accountId: i.account_id,
        accountName: i.account_name,
        kamiEntityId: i.kami_entity_id,
        kamiName: i.kami_name,
        createdAt: i.created_at
    }));

    res.json({ items: mappedItems });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * GET /api/watchlist/live
 * Get live status of watchlist accounts/kamis
 */
router.get('/live', async (req: Request, res: Response) => {
  try {
    const { privyUserId } = req.query;
    if (!privyUserId || typeof privyUserId !== 'string') {
        return res.status(400).json({ error: 'Missing privyUserId' });
    }

    // 1. Get watchlist items
    const items = await getWatchlist(privyUserId);
    
    // 2. Extract unique Account IDs (using snake_case from DB)
    const accountIds = [...new Set(items.map(item => item.account_id))];

    // 3. Fetch user's own Kamis locations for distance calculation
    const userLocations = new Set<number>();
    try {
        const profiles = await getOperatorWallets(privyUserId);
        // Process profiles in parallel
        await Promise.all(profiles.map(async (profile) => {
            try {
                // If accountId is not set in profile (legacy), we might skip or try to derive it
                if (profile.account_id) {
                    const myKamis = await getKamisByAccountId(profile.account_id);
                    myKamis.forEach(k => {
                        if (k.room && typeof k.room.index === 'number') {
                            userLocations.add(k.room.index);
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch kamis for profile ${profile.name}`, e);
            }
        }));
    } catch (e) {
        console.warn('Failed to fetch user profiles for distance calculation', e);
    }

    // 4. Fetch live kami data for each watchlist account
    const results: Record<string, any[]> = {};
    
    await Promise.all(accountIds.map(async (accountId) => {
        try {
            const kamis = await getKamisByAccountId(accountId);
            results[accountId] = kamis.map(k => {
                const roomIndex = k.room.index;
                
                // Calculate minimum distance to any of user's kamis
                let minDistance: number | null = null;
                let nearestPath: string[] = [];

                if (userLocations.size > 0) {
                    let bestPathResult: any = null;
                    
                    for (const myLoc of userLocations) {
                        const pathResult = findShortestPath(myLoc, roomIndex);
                        if (pathResult) {
                            if (bestPathResult === null || pathResult.distance < bestPathResult.distance) {
                                bestPathResult = pathResult;
                            }
                        }
                    }

                    if (bestPathResult) {
                        minDistance = bestPathResult.distance;
                        nearestPath = bestPathResult.names;
                    }
                }

                return {
                    id: k.id,
                    name: k.name,
                    index: k.index,
                    room: roomIndex, // The Room Number
                    roomName: k.room.name,
                    state: k.state, // 'Harvesting' or 'Resting' or 'Idle'
                    level: k.level,
                    currentHealth: k.currentHealth,
                    distance: minDistance,
                    path: nearestPath
                };
            });
        } catch (e) {
            console.error(`Failed to fetch kamis for account ${accountId}`, e);
            results[accountId] = [];
        }
    }));

    res.json({ results });
  } catch (error) {
    console.error('Watchlist live fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch live watchlist data' });
  }
});

/**
 * POST /api/watchlist
 * Add item to watchlist
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { privyUserId, accountId, accountName, kamiEntityId, kamiName } = req.body;
    
    if (!privyUserId || !accountId || !kamiEntityId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const item = await addToWatchlist(privyUserId, {
        accountId,
        accountName,
        kamiEntityId,
        kamiName
    });
    
    // Map to camelCase
    const mappedItem = {
        id: item.id,
        userId: item.user_id,
        accountId: item.account_id,
        accountName: item.account_name,
        kamiEntityId: item.kami_entity_id,
        kamiName: item.kami_name,
        createdAt: item.created_at
    };

    res.json({ success: true, item: mappedItem });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to watchlist', details: error instanceof Error ? error.message : String(error) });
  }
});

/**
 * DELETE /api/watchlist/:kamiId
 * Remove item from watchlist
 */
router.delete('/:kamiId', async (req: Request, res: Response) => {
  try {
    const { privyUserId } = req.query;
    const { kamiId } = req.params;

    if (!privyUserId || typeof privyUserId !== 'string') {
        return res.status(400).json({ error: 'Missing privyUserId' });
    }

    await removeFromWatchlist(privyUserId, kamiId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

/**
 * GET /api/watchlist/search
 * Resolve account identifier by ID or Kami Index
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query' });
    }

    // Only ID/Index (numeric) lookup is reliable
    if (!query.match(/^\d+$/)) {
        return res.status(400).json({ error: 'Invalid format. Please use Account ID or Kami Index.' });
    }

    // 1. Try Account ID first
    let account = await getAccountById(query);
    
    // 2. If not found, or user intended Kami Index (heuristic: usually small number, but AccountID can be small on testnets?)
    // Let's rely on fallback: if account not found (or maybe has no name/generic), try Kami Index.
    // Actually, getAccountById might return a valid object even if it's not "the" account if the ID exists. 
    // But Account IDs are usually large uint256 derived from address, unless using raw small indices.
    // Kami Indices are definitely small (0-10000).
    // So if query < 100000, it's LIKELY a Kami Index.
    
    const queryNum = Number(query);
    const isSmallNumber = queryNum < 100000;

    if ((!account || !account.name) || isSmallNumber) {
        try {
            // Try fetching Kami by Index
            const kami = await getKamiByIndex(queryNum);
            if (kami && kami.account) {
                // If kami found, fetch its owner account
                account = await getAccountById(kami.account);
            }
        } catch (e) {
            // Ignore error, maybe it wasn'n a kami index
        }
    }

    if (!account || !account.name) {
        return res.status(404).json({ error: 'Account not found via ID or Kami Index' });
    }

    res.json({ account });
  } catch (error) {
    console.error('[Watchlist] Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
