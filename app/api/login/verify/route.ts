import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { verifyAuthenticationResponseForUser, type PasskeyContext } from '@/lib/webauthn';

function resolveContext(request: Request): PasskeyContext {
  const originHeader = request.headers.get('origin') ?? undefined;
  const hostHeader = request.headers.get('host') ?? undefined;
  const origin = process.env.RP_ORIGIN ?? originHeader ?? (hostHeader ? `http://${hostHeader}` : undefined);

  let rpID = process.env.RP_ID;
  if (!rpID && origin) {
    try {
      rpID = new URL(origin).hostname;
    } catch (error) {
      // ignore invalid origin value
    }
  }
  if (!rpID && hostHeader) {
    rpID = hostHeader.split(':')[0];
  }

  return {
    rpID: rpID ?? undefined,
    origin,
    rpName: process.env.RP_NAME ?? undefined,
  };
}

type LoginVerifyRequest = {
  userId?: string;
  authenticationResponse?: AuthenticationResponseJSON;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginVerifyRequest;
  if (!body?.userId || !body.authenticationResponse) {
    await logError('AUTH-VERIFY 入力エラー', { userId: body?.userId });
    return NextResponse.json(
      { error: 'ユーザーIDと認証レスポンスが必要です。' },
      { status: 400 },
    );
  }

  try {
    const result = await verifyAuthenticationResponseForUser(
      body.userId,
      body.authenticationResponse,
      resolveContext(request),
    );
    await logInfo('AUTH-VERIFY 応答', {
      userId: body.userId,
      verified: result.verified,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
    await logError('AUTH-VERIFY 例外', { userId: body.userId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
