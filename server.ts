import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({
    status: 'ok', target: 'Xiaomi 5 Plus reference OTA',
    firmwareSize: 125371, hardwareFlashVerified: false,
    otaSigningSupported: false, kersPatchSupported: false,
  }));
  // Text generation cannot authenticate a firmware or prove hardware safety.
  app.post('/api/ai-analyze', (_req, res) => res.status(410).json({
    success: false, message: 'Use tools/reverse_report.py for byte-derived disassembly.',
  }));
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.listen(3000, '0.0.0.0', () => console.log('Strict research patcher on port 3000'));
}
startServer().catch(error => { console.error(error); process.exitCode = 1; });
