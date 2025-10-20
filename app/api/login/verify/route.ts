import type { AuthenticationResponseJSON } from '@simplewebauthn/types';
import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { verifyAuthenticationResponseForUser } from '@/lib/webauthn';

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
