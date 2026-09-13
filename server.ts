import { app, setupWebSocket } from './api/index.js';
import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const server = http.createServer(app);
const PORT = 3000;

// Attach real-time WebSocket server
setupWebSocket(server);

// ==================== VITE & STATIC SERVING ====================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
