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
import { UPLOADS_DIR, ensureUploadsDir } from './uploads';
import { config } from './config';

const app = express();

ensureUploadsDir();

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/grocery', groceryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/receipt', receiptRoutes);
app.use('/api/meals', mealsRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/dist')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});
