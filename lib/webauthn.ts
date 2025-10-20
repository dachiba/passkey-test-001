import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/types';
import { Buffer } from 'node:buffer';
import { logError, logInfo } from './logger';
import { addOrUpdateCredential, ensureUser, getUser, type StoredUser } from './store';

export type PasskeyContext = {
  rpID?: string;
  rpName?: string;
  origin?: string;
};

export const RP_ID = process.env.RP_ID ?? 'localhost';
export const RP_NAME = process.env.RP_NAME ?? 'Passkey デモ';
export const ORIGIN = process.env.RP_ORIGIN ?? `http://${RP_ID}:3000`;

const USER_ID_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

type ChallengeStore = Map<string, string>;

interface GlobalChallengeStore {
  __registrationChallenges?: ChallengeStore;
  __authenticationChallenges?: ChallengeStore;
}

const globalStore = globalThis as typeof globalThis & GlobalChallengeStore;

const registrationChallenges: ChallengeStore =
  globalStore.__registrationChallenges ?? (globalStore.__registrationChallenges = new Map());
const authenticationChallenges: ChallengeStore =
  globalStore.__authenticationChallenges ?? (globalStore.__authenticationChallenges = new Map());

function challengeKey(userId: string, rpID: string) {
  return `${userId}::${rpID}`;
}

export function sanitizeUserId(input: string): string {
  const trimmed = input.trim();
  if (!USER_ID_PATTERN.test(trimmed)) {
    throw new Error('ユーザーIDは3〜64文字の英数字・ドット・ハイフン・アンダースコアのみ使用できます。');
  }
  return trimmed;
}

export async function generateRegistrationOptionsForUser(
  userId: string,
  context: PasskeyContext = {},
) {
  const sanitizedId = sanitizeUserId(userId);
  const user = await ensureUser(sanitizedId);
  const rpID = context.rpID ?? RP_ID;
  const rpName = context.rpName ?? RP_NAME;

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: sanitizedId,
    userDisplayName: sanitizedId,
    userID: Buffer.from(user.userHandle, 'base64url'),
    timeout: 60_000,
    attestationType: 'none',
    excludeCredentials: user.credentials.map((credential) => ({
      id: credential.credentialId,
      type: 'public-key' as const,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  registrationChallenges.set(challengeKey(sanitizedId, rpID), options.challenge);
  await logInfo('REG-OPTIONS 生成', {
    userId: sanitizedId,
    excludeCredentialCount: options.excludeCredentials?.length ?? 0,
    rpID,
    challenge: options.challenge,
  });
  return options;
}

export async function verifyRegistrationResponseForUser(
  userId: string,
  response: RegistrationResponseJSON,
  context: PasskeyContext = {},
) {
  const sanitizedId = sanitizeUserId(userId);
  const rpID = context.rpID ?? RP_ID;
  const origin = context.origin ?? ORIGIN;
  const expectedChallenge = registrationChallenges.get(challengeKey(sanitizedId, rpID));

  if (!expectedChallenge) {
    await logError('REG-VERIFY チャレンジ不明', {
      userId: sanitizedId,
      rpID,
      knownKeys: Array.from(registrationChallenges.keys()),
    });
    throw new Error('登録用チャレンジが見つかりません。最初からやり直してください。');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification) {
    await logError('REG-VERIFY 検証結果なし', { userId: sanitizedId });
    throw new Error('登録検証に失敗しました。');
  }

  registrationChallenges.delete(challengeKey(sanitizedId, rpID));

  if (!verification.verified || !verification.registrationInfo) {
    await logError('REG-VERIFY 失敗', {
      userId: sanitizedId,
      verified: verification.verified,
      hasRegistrationInfo: Boolean(verification.registrationInfo),
    });
    return { verified: false as const };
  }

  const { registrationInfo } = verification;
  const credential = {
    credentialId: Buffer.from(registrationInfo.credentialID).toString('base64url'),
    publicKey: Buffer.from(registrationInfo.credentialPublicKey).toString('base64url'),
    counter: registrationInfo.counter,
  };

  const updatedUser = await addOrUpdateCredential(sanitizedId, credential);
  await logInfo('REG-VERIFY 成功', {
    userId: sanitizedId,
    credentialId: credential.credentialId,
    rpID,
  });

  return {
    verified: true as const,
    user: updatedUser,
  };
}

export async function generateAuthenticationOptionsForUser(
  userId: string,
  context: PasskeyContext = {},
) {
  const sanitizedId = sanitizeUserId(userId);
  const user = await getUser(sanitizedId);
  if (!user || user.credentials.length === 0) {
    await logError('AUTH-OPTIONS ユーザー未登録', { userId: sanitizedId });
    throw new Error('パスキーが登録されていません。先に登録を行ってください。');
  }

  const rpID = context.rpID ?? RP_ID;
  const options = await generateAuthenticationOptions({
    rpID,
    timeout: 60_000,
    userVerification: 'preferred',
    allowCredentials: user.credentials.map((credential) => ({
      id: credential.credentialId,
      type: 'public-key' as const,
    })),
  });

  authenticationChallenges.set(challengeKey(sanitizedId, rpID), options.challenge);
  await logInfo('AUTH-OPTIONS 生成', {
    userId: sanitizedId,
    allowCredentialCount: options.allowCredentials?.length ?? 0,
    rpID,
  });
  return options;
}

export async function verifyAuthenticationResponseForUser(
  userId: string,
  response: AuthenticationResponseJSON,
  context: PasskeyContext = {},
) {
  const sanitizedId = sanitizeUserId(userId);
  const rpID = context.rpID ?? RP_ID;
  const origin = context.origin ?? ORIGIN;
  const expectedChallenge = authenticationChallenges.get(challengeKey(sanitizedId, rpID));

  if (!expectedChallenge) {
    await logError('AUTH-VERIFY チャレンジ未取得', { userId: sanitizedId });
    throw new Error('認証用チャレンジが見つかりません。最初からやり直してください。');
  }

  const user = await getUser(sanitizedId);
  if (!user) {
    await logError('AUTH-VERIFY ユーザー不在', { userId: sanitizedId });
    throw new Error('ユーザー情報が見つかりません。');
  }

  const credential = findCredential(user, response.id);
  if (!credential) {
    await logError('AUTH-VERIFY 資格情報不一致', {
      userId: sanitizedId,
      credentialId: response.id,
    });
    throw new Error('該当するパスキーが登録されていません。');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
    authenticator: {
      credentialID: Buffer.from(credential.credentialId, 'base64url'),
      credentialPublicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.counter,
    },
  });

  authenticationChallenges.delete(challengeKey(sanitizedId, rpID));

  if (!verification.verified || !verification.authenticationInfo) {
    await logError('AUTH-VERIFY 失敗', { userId: sanitizedId });
    return { verified: false as const };
  }

  await addOrUpdateCredential(sanitizedId, {
    ...credential,
    counter: verification.authenticationInfo.newCounter,
  });

  await logInfo('AUTH-VERIFY 成功', {
    userId: sanitizedId,
    credentialId: credential.credentialId,
    counter: verification.authenticationInfo.newCounter,
    rpID,
  });

  return { verified: true as const };
}

function findCredential(user: StoredUser, credentialId: string) {
  return user.credentials.find((item) => item.credentialId === credentialId);
}
