import { Router, Request, Response } from 'express';
import { startHarvest, stopHarvestByKamiId, isKamiHarvesting, HarvestResult } from '../services/harvestService.js';

const router = Router();

/**
 * GET /api/harvest/status/:kamiId
 */
router.get('/status/:kamiId', async (req: Request, res: Response) => {
  try {
    const { kamiId } = req.params;
    const isHarvesting = await isKamiHarvesting(kamiId);
    res.json({ kamiId, isHarvesting });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/harvest/start
 * Body: { kamiId, nodeIndex, privateKey? }
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { kamiId, nodeIndex, privateKey } = req.body;
    if (!privateKey) {
        return res.status(400).json({ error: 'Private key required for direct call' });
    }
    
    const result = await startHarvest({ kamiId, nodeIndex, privateKey });
    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/harvest/stop
 * Body: { kamiId, privateKey? }
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { kamiId, privateKey } = req.body;
    if (!privateKey) {
        return res.status(400).json({ error: 'Private key required for direct call' });
    }

    const result = await stopHarvestByKamiId(kamiId, privateKey);
    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;