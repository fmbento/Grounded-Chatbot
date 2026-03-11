import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // KB files endpoint
  app.get('/api/kb', async (req, res) => {
    const kbPath = path.join(__dirname, 'KB');
    
    if (!existsSync(kbPath)) {
      return res.json([]);
    }

    try {
      const files = await fs.readdir(kbPath);
      const supportedFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.pdf'));
      
      const kbData = await Promise.all(supportedFiles.map(async (filename) => {
        const filePath = path.join(kbPath, filename);
        const stats = await fs.stat(filePath);
        let content = "";
        const type = path.extname(filename).toLowerCase();

        if (type === '.pdf') {
          try {
            const dataBuffer = readFileSync(filePath);
            const data = await pdf(dataBuffer);
            content = data.text;
          } catch (err) {
            console.error(`Error parsing PDF ${filename}:`, err);
            content = `[Erro ao extrair texto do PDF: ${filename}]`;
          }
        } else {
          content = await fs.readFile(filePath, 'utf-8');
        }

        return {
          name: filename,
          content: content,
          size: stats.size,
          type: type,
          downloadUrl: `/kb-files/${filename}`
        };
      }));
      
      res.json(kbData);
    } catch (error) {
      console.error('Error reading KB directory:', error);
      res.status(500).json({ error: 'Failed to read KB files' });
    }
  });

  // Serve KB files for download
  app.use('/kb-files', express.static(path.join(__dirname, 'KB')));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
