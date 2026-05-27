import express from 'express';
import cors from 'cors';
import overviewRouter from './routes/overview.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/overview', overviewRouter);

app.listen(PORT, () => {
  console.log(`BFF server running on http://localhost:${PORT}`);
});

export default app;
