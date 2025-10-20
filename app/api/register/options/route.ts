import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { generateRegistrationOptionsForUser, type PasskeyContext } from '@/lib/webauthn';

function resolveContext(request: Request): PasskeyContext {
  const originHeader = request.headers.get('origin') ?? undefined;
  const hostHeader = request.headers.get('host') ?? undefined;

  const origin = process.env.RP_ORIGIN ?? originHeader ?? (hostHeader ? `http://${hostHeader}` : undefined);
  let rpID = process.env.RP_ID;

  if (!rpID && origin) {
    try {
      rpID = new URL(origin).hostname;
    } catch (error) {
      // ignore invalid origin
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

type RegisterOptionsRequest = {
  userId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RegisterOptionsRequest;
  if (!body?.userId) {
    await logError('REG-OPTIONS 入力エラー', { userId: body?.userId });
    return NextResponse.json(
      { error: 'ユーザーIDを入力してください。' },
      { status: 400 },
    );
  }

  try {
    const context = resolveContext(request);
    const options = await generateRegistrationOptionsForUser(body.userId, context);
    await logInfo('REG-OPTIONS 応答', {
      userId: body.userId,
      challengeLength: options.challenge?.length ?? 0,
      userIdLength: options.user?.id?.length ?? 0,
      rpID: context.rpID,
    });
    return NextResponse.json(options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
    await logError('REG-OPTIONS 例外', { userId: body.userId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
