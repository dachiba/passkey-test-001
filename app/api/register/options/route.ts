import { NextResponse } from 'next/server';
import { logError, logInfo } from '@/lib/logger';
import { generateRegistrationOptionsForUser } from '@/lib/webauthn';

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
    const options = await generateRegistrationOptionsForUser(body.userId);
    await logInfo('REG-OPTIONS 応答', { userId: body.userId });
    return NextResponse.json(options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '予期せぬエラーが発生しました。';
    await logError('REG-OPTIONS 例外', { userId: body.userId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
