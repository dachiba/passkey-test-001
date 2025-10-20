import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { generateAuthenticationOptionsForUser, type PasskeyContext } from '@/lib/webauthn';

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

type LoginOptionsRequest = {
  userId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginOptionsRequest;
  if (!body?.userId) {
    await logError('AUTH-OPTIONS 入力エラー', { userId: body?.userId });
    return NextResponse.json(
      { error: 'ユーザーIDを入力してください。' },
      { status: 400 },
    );
  }

  try {
    const context = resolveContext(request);
    const options = await generateAuthenticationOptionsForUser(body.userId, context);
    await logInfo('AUTH-OPTIONS 応答', {
      userId: body.userId,
      rpID: context.rpID,
      allowCredentialCount: options.allowCredentials?.length ?? 0,
    });
    return NextResponse.json(options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
    await logError('AUTH-OPTIONS 例外', { userId: body.userId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
