import { Router, Request, Response } from 'express';
import { getKamisByAccountId, getAccountById } from '../services/accountService.js';
import { addToWatchlist, removeFromWatchlist, getWatchlist } from '../services/supabaseService.js';

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
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
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
    
    res.json({ success: true, item });
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
 * Resolve account identifier (ID only for now based on tests)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing query' });
    }

    // Only ID lookup is reliable currently
    // Index and Name lookup failed in scripts/testLookup.ts
    if (!query.match(/^\d+$/)) {
        return res.status(400).json({ error: 'Invalid format. Please use Account ID (uint256).' });
    }

    const account = await getAccountById(query);
    if (!account || !account.name) {
        return res.status(404).json({ error: 'Account not found' });
    }

    res.json({ account });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
