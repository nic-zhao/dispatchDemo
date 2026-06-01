import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import overviewRouter from './routes/overview.js';
import deploymentsRouter from './routes/deployments.js';
import imagesRouter from './routes/images.js';
import resourcesRouter from './routes/resources.js';
import podsRouter from './routes/pods.js';
import { handleTerminal } from './routes/terminal.js';

const app = express();
const PORT = 3001;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/overview', overviewRouter);
app.use('/api/deployments', deploymentsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/pods', podsRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/api/pods/terminal' });

wss.on('connection', (ws, req) => {
  handleTerminal(ws, req);
});

server.listen(PORT, HOST, () => {
  console.log(`BFF server running on http://${HOST}:${PORT}`);
});

export default app;
