// src/index.js — process bootstrap (app wiring lives in app.js)
import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/loggers.js';

const host = process.env.HOST || config.host || '0.0.0.0';
const port = normalizePort(process.env.PORT || config.port || 3000);

app.set('port', port); // harmless for some middlewares

const server = http.createServer(app);
server.listen(port, host);
server.on('listening', onListening);
server.on('error', onError);

// ---- helpers ----
function normalizePort(val) {
  const p = parseInt(val, 10);
  if (Number.isNaN(p)) return val; // named pipe
  if (p >= 0) return p;            // port number
  return false;
}

function onListening() {
  const addr = server.address();
  if (typeof addr === 'string') {
    logger.info(`✅ Server listening at ${addr}`);
  } else {
    // show friendly host locally; Render binds 0.0.0.0
    const shownHost =
      addr.address === '::' || addr.address === '0.0.0.0' ? 'localhost' : addr.address;
    logger.info(`✅ Server listening at http://${shownHost}:${addr.port}`);
  }
}

function onError(err) {
  if (err.syscall !== 'listen') throw err;
  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;
  switch (err.code) {
    case 'EACCES':
      logger.error(`${bind} requires elevated privileges`);
      process.exit(1);
    case 'EADDRINUSE':
      logger.error(`${bind} is already in use`);
      process.exit(1);
    default:
      throw err;
  }
}

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => { logger.error(e?.stack || e); shutdown(); });
process.on('uncaughtException',   (e) => { logger.error(e?.stack || e); shutdown(); });

function shutdown() {
  logger.info('🛑 Shutting down…');
  server.close(() => {
    logger.info('👋 Bye!');
    process.exit(0);
  });
}

export { server };
