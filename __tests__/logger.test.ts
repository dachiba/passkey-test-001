import { mkdtempSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

describe('LOGGER: サーバーログ出力', () => {
  const originalLogDir = process.env.LOG_DIR;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'webauthn-logs-'));
    process.env.LOG_DIR = path.join(tempDir, 'logs');
    jest.resetModules();
  });

  afterEach(() => {
    if (originalLogDir) {
      process.env.LOG_DIR = originalLogDir;
    } else {
      delete process.env.LOG_DIR;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('INFO ログがファイルに追記される', async () => {
    const logger = await import('../lib/logger');
    await logger.logInfo('テストメッセージ', { foo: 'bar' });

    const logFile = path.join(process.env.LOG_DIR as string, 'server.log');
    const content = readFileSync(logFile, 'utf-8');

    expect(content).toMatch(/\[INFO\] テストメッセージ/);
    expect(content).toMatch(/"foo":"bar"/);
  });

  it('ERROR ログ出力もフォーマットされる', async () => {
    const logger = await import('../lib/logger');
    await logger.logError('エラーメッセージ', { code: 123 });

    const logFile = path.join(process.env.LOG_DIR as string, 'server.log');
    const content = readFileSync(logFile, 'utf-8');

    expect(content).toMatch(/\[ERROR\] エラーメッセージ/);
    expect(content).toMatch(/"code":123/);
  });
});
