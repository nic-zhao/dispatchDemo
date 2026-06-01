import { Router, Request, Response } from 'express';
import {
  getAllPods,
  getPodDetail,
  deletePod,
} from '../services/k8s.service.js';
import { exec } from 'child_process';

const router = Router();

// GET / — list all non-system pods
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pods = await getAllPods();
    res.json(pods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:name — pod detail
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const namespace = (req.query.namespace as string) || 'default';
    const detail = await getPodDetail(req.params.name as string, namespace);
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:name — delete pod
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const namespace = (req.query.namespace as string) || 'default';
    const result = await deletePod(req.params.name as string, namespace);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:name/logs — SSE log stream
router.get('/:name/logs', (req: Request, res: Response) => {
  const namespace = (req.query.namespace as string) || 'default';
  const name = req.params.name;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const cmd = `k3s kubectl logs -f ${name} -n ${namespace}`;
  const proc = exec(cmd);

  proc.stdout?.on('data', (data: string) => {
    res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
  });

  proc.stderr?.on('data', (data: string) => {
    res.write(`data: ${JSON.stringify({ error: data })}\n\n`);
  });

  proc.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ event: 'close', code })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    proc.kill();
  });
});

export default router;
