const generateRegistrationOptionsForUser = jest.fn();
const verifyRegistrationResponseForUser = jest.fn();
const generateAuthenticationOptionsForUser = jest.fn();
const verifyAuthenticationResponseForUser = jest.fn();

jest.mock('@/lib/webauthn', () => ({
  generateRegistrationOptionsForUser: (...args: unknown[]) =>
    generateRegistrationOptionsForUser(...args),
  verifyRegistrationResponseForUser: (...args: unknown[]) =>
    verifyRegistrationResponseForUser(...args),
  generateAuthenticationOptionsForUser: (...args: unknown[]) =>
    generateAuthenticationOptionsForUser(...args),
  verifyAuthenticationResponseForUser: (...args: unknown[]) =>
    verifyAuthenticationResponseForUser(...args),
}));

describe('API Route Handlers', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RP_ID = 'localhost';
    process.env.RP_NAME = 'Passkey デモ';
    process.env.RP_ORIGIN = 'http://localhost:3000';
    generateRegistrationOptionsForUser.mockReset();
    verifyRegistrationResponseForUser.mockReset();
    generateAuthenticationOptionsForUser.mockReset();
    verifyAuthenticationResponseForUser.mockReset();
  });

  afterEach(() => {
    delete process.env.RP_ID;
    delete process.env.RP_NAME;
    delete process.env.RP_ORIGIN;
  });

  it('register/options がオプションを返す', async () => {
    generateRegistrationOptionsForUser.mockResolvedValue({ challenge: 'abc' });
    const route = await import('../app/api/register/options/route');
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 'alice' }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ challenge: 'abc' });
  });

  it('login/options がエラーメッセージを返す', async () => {
    generateAuthenticationOptionsForUser.mockRejectedValue(new Error('not found'));
    const route = await import('../app/api/login/options/route');
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ userId: 'bob' }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'not found' });
  });

  it('login/verify が検証結果を返す', async () => {
    verifyAuthenticationResponseForUser.mockResolvedValue({ verified: true });
    const route = await import('../app/api/login/verify/route');
    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'carol',
        authenticationResponse: { id: 'cred' } as any,
      }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ verified: true });
  });
});
