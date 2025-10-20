import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

const logDirectory = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');
const logFile = path.join(logDirectory, 'server.log');

async function ensureLogFile() {
  await mkdir(logDirectory, { recursive: true });
}

async function writeLog(level: 'INFO' | 'ERROR', message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${timestamp}] [${level}] ${message}${suffix}\n`;

  try {
    await ensureLogFile();
    await appendFile(logFile, line, 'utf-8');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[LOGGER] 書き込みに失敗しました', error);
  }
}

export async function logInfo(message: string, meta?: unknown) {
  await writeLog('INFO', message, meta);
}

export async function logError(message: string, meta?: unknown) {
  await writeLog('ERROR', message, meta);
}
