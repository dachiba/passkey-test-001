import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

describe('STORE-001: saveCredential 正常保存', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'webauthn-store-'));
    process.chdir(tempDir);
    jest.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('新規ユーザーのパスキーが保存される', async () => {
    const store = await import('../lib/store');
    await store.addOrUpdateCredential('alice', {
      credentialId: 'credential-base64',
      publicKey: 'public-key-base64',
      counter: 1,
    });

    const json = JSON.parse(
      readFileSync(path.join(tempDir, 'data', 'webauthn.json'), 'utf-8'),
    );

    expect(json['alice']).toBeDefined();
    expect(json['alice'].credentials).toHaveLength(1);
    expect(json['alice'].credentials[0]).toMatchObject({
      credentialId: 'credential-base64',
      counter: 1,
    });
  });

  it('ensureUser で userHandle が生成される', async () => {
    const store = await import('../lib/store');
    const user = await store.ensureUser('bob');

    expect(user.id).toBe('bob');
    expect(user.userHandle).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(user.userHandle, 'base64url')).toHaveLength(36);

    const persisted = JSON.parse(
      readFileSync(path.join(tempDir, 'data', 'webauthn.json'), 'utf-8'),
    );
    expect(persisted['bob'].userHandle).toBe(user.userHandle);
  });
});
