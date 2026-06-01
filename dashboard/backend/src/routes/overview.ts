import { Router } from 'express';
import { getNodeResources, getRunningDeployments } from '../services/k8s.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [resources, deployments] = await Promise.all([
      getNodeResources(),
      getRunningDeployments(),
    ]);
    res.json({ resources, deployments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
