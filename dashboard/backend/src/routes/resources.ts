import { Router } from 'express';
import { k8sCoreApi, k8sCustomApi } from '../k8s-client.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [nodeList, queuesResult] = await Promise.all([
      k8sCoreApi.listNode(),
      k8sCustomApi.listClusterCustomObject({
        group: 'scheduling.volcano.sh',
        version: 'v1beta1',
        plural: 'queues',
      }),
    ]);

    const nodeData = (nodeList as any).items?.[0] as any;
    if (!nodeData) {
      res.status(500).json({ error: 'No nodes found in the cluster' });
      return;
    }
    const queuesData = queuesResult as any;

    const nodeInfo = {
      name: nodeData.metadata?.name,
      status: nodeData.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True'
        ? 'Ready'
        : 'NotReady',
      capacity: nodeData.status?.capacity || {},
      allocatable: nodeData.status?.allocatable || {},
    };

    const queues = (queuesData.items || []).map((q: any) => ({
      name: q.metadata?.name,
      state: q.status?.state || 'Unknown',
      running: q.status?.running || 0,
      pending: q.status?.pending || 0,
      allocated: q.spec?.capability || {},
    }));

    res.json({ node: nodeInfo, queues });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
