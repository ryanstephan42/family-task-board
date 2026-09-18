import express from 'express';
import cors from 'cors';
import path from 'path';
import userRoutes from './routes/users';
import taskRoutes from './routes/tasks';
import eventRoutes from './routes/events';
import groceryRoutes from './routes/grocery';
import inventoryRoutes from './routes/inventory';
import receiptRoutes from './routes/receipt';
import mealsRoutes from './routes/meals';
import setupRoutes from './routes/setup';
import chatRoutes from './routes/chat';
import budgetRoutes from './routes/budget';
import diagnosticsRoutes from './routes/diagnostics';
import { UPLOADS_DIR, ensureUploadsDir } from './uploads';
import { config } from './config';
import { disconnectDatabase, prisma } from './db';

const app = express();

ensureUploadsDir();

if (config.webOrigin) {
  app.use(cors({ origin: config.webOrigin }));
}
app.use(express.json({ limit: '2mb' }));

// Uploads are served through the authenticated inventory route so a leaked
// photo URL cannot expose another household's data.
app.use('/api/users', userRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/receipt', receiptRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/dist')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  } catch (error) {
    console.error('Readiness check failed', error);
    res.status(503).json({ status: 'not_ready' });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down`);
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnectDatabase();
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
