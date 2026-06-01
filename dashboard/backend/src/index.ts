import express from 'express';
import cors from 'cors';
import overviewRouter from './routes/overview.js';
import deploymentsRouter from './routes/deployments.js';
import imagesRouter from './routes/images.js';
import resourcesRouter from './routes/resources.js';

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

app.listen(PORT, HOST, () => {
  console.log(`BFF server running on http://${HOST}:${PORT}`);
});

export default app;
