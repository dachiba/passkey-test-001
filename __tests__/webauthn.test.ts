import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

const generateRegistrationOptions = jest.fn();
const verifyRegistrationResponse = jest.fn();
const generateAuthenticationOptions = jest.fn();
const verifyAuthenticationResponse = jest.fn();

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: (...args: unknown[]) =>
    generateRegistrationOptions(...args),
  verifyRegistrationResponse: (...args: unknown[]) =>
    verifyRegistrationResponse(...args),
  generateAuthenticationOptions: (...args: unknown[]) =>
    generateAuthenticationOptions(...args),
  verifyAuthenticationResponse: (...args: unknown[]) =>
    verifyAuthenticationResponse(...args),
}));

describe('WebAuthn ロジック', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'webauthn-core-'));
    process.chdir(tempDir);
    jest.resetModules();
    process.env.RP_ID = 'localhost';
    process.env.RP_NAME = 'Passkey デモ';
    process.env.RP_ORIGIN = 'http://localhost:3000';
    generateRegistrationOptions.mockReset();
    verifyRegistrationResponse.mockReset();
    generateAuthenticationOptions.mockReset();
    verifyAuthenticationResponse.mockReset();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.RP_ID;
    delete process.env.RP_NAME;
    delete process.env.RP_ORIGIN;
  });

  it('REG-001: 登録オプション生成でチャレンジを保持する', async () => {
    generateRegistrationOptions.mockResolvedValue({
      challenge: 'registration-challenge',
    });

    const webauthn = await import('../lib/webauthn');
    const options = await webauthn.generateRegistrationOptionsForUser('alice');

    expect(options.challenge).toBe('registration-challenge');
    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        userID: expect.any(Buffer),
        rpID: 'localhost',
        userName: 'alice',
      }),
    );
  });

  it('REG-002: 登録検証成功で資格情報を保存する', async () => {
    generateRegistrationOptions.mockResolvedValue({
      challenge: 'registration-challenge',
    });
    const credentialBytes = Buffer.from('credential');
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: credentialBytes.toString('base64url'),
          publicKey: Buffer.from('public'),
          counter: 1,
        },
      },
    });

    const webauthn = await import('../lib/webauthn');
    await webauthn.generateRegistrationOptionsForUser('bob');
    const result = await webauthn.verifyRegistrationResponseForUser('bob', {} as any);

    expect(result.verified).toBe(true);
    const store = await import('../lib/store');
    const saved = await store.getUser('bob');
    expect(saved?.credentials[0].counter).toBe(1);
  });

  it('AUTH-001: 認証オプション生成で登録済み資格情報を使用する', async () => {
    generateRegistrationOptions.mockResolvedValue({ challenge: 'reg-chal' });
    const credentialBytes = Buffer.from('credential');
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: credentialBytes.toString('base64url'),
          publicKey: Buffer.from('public'),
          counter: 1,
        },
      },
    });
    generateAuthenticationOptions.mockResolvedValue({
      challenge: 'auth-challenge',
    });

    const webauthn = await import('../lib/webauthn');
    await webauthn.generateRegistrationOptionsForUser('charlie');
    await webauthn.verifyRegistrationResponseForUser('charlie', {} as any);
    const options = await webauthn.generateAuthenticationOptionsForUser('charlie');

    expect(options.challenge).toBe('auth-challenge');
    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCredentials: [
          expect.objectContaining({
            type: 'public-key',
          }),
        ],
      }),
    );
  });

  it('AUTH-002: 未登録ユーザーは認証オプション生成でエラーとなる', async () => {
    const webauthn = await import('../lib/webauthn');
    await expect(
      webauthn.generateAuthenticationOptionsForUser('unknown'),
    ).rejects.toThrow('パスキーが登録されていません');
  });

  it('認証検証成功でカウンターを更新する', async () => {
    const credentialBytes = Buffer.from('credential');
    generateRegistrationOptions.mockResolvedValue({ challenge: 'reg' });
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: credentialBytes.toString('base64url'),
          publicKey: Buffer.from('public'),
          counter: 1,
        },
      },
    });

    generateAuthenticationOptions.mockResolvedValue({ challenge: 'auth' });
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        newCounter: 5,
      },
    });

    const webauthn = await import('../lib/webauthn');
    await webauthn.generateRegistrationOptionsForUser('dave');
    await webauthn.verifyRegistrationResponseForUser('dave', {} as any);
    const credentialId = credentialBytes.toString('base64url');
    await webauthn.generateAuthenticationOptionsForUser('dave');
    const authResult = await webauthn.verifyAuthenticationResponseForUser(
      'dave',
      { id: credentialId } as any,
    );

    expect(authResult.verified).toBe(true);
    const store = await import('../lib/store');
    const saved = await store.getUser('dave');
    expect(saved?.credentials[0].counter).toBe(5);
  });
});
