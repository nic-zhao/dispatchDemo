import { Router } from 'express';
import { getLocalImages, getCommunityImages } from '../services/images.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [local, community] = await Promise.all([
      getLocalImages(),
      Promise.resolve(getCommunityImages()),
    ]);
    res.json({ local, community });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
