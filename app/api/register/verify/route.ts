import type { RegistrationResponseJSON } from '@simplewebauthn/types';
import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { verifyRegistrationResponseForUser } from '@/lib/webauthn';

type RegisterVerifyRequest = {
  userId?: string;
  attestationResponse?: RegistrationResponseJSON;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterVerifyRequest;
  if (!body?.userId || !body.attestationResponse) {
    await logError('REG-VERIFY 入力エラー', { userId: body?.userId });
    return NextResponse.json(
      { error: 'ユーザーIDと認証器レスポンスが必要です。' },
      { status: 400 },
    );
  }

  try {
    const result = await verifyRegistrationResponseForUser(
      body.userId,
      body.attestationResponse,
    );
    await logInfo('REG-VERIFY 応答', {
      userId: body.userId,
      verified: result.verified,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
    await logError('REG-VERIFY 例外', { userId: body.userId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
