'use client';

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ApiError = {
  error?: string;
};

type ApiVerification = {
  verified?: boolean;
};

const getSupportFlag = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return browserSupportsWebAuthn();
};

export default function HomePage() {
  const [userId, setUserId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [supportsWebAuthn, setSupportsWebAuthn] = useState(false);

  useEffect(() => {
    const supported = getSupportFlag();
    setSupportsWebAuthn(supported);
    if (!supported) {
      setInfoMessage(
        'このブラウザは WebAuthn に対応していません。対応ブラウザでお試しください。',
      );
    }
  }, []);

  const resetMessages = useCallback(() => {
    setSuccessMessage('');
    setErrorMessage('');
    setInfoMessage('');
  }, []);

  const trimmedUserId = useMemo(() => userId.trim(), [userId]);

  const handleRegister = useCallback(async () => {
    if (!trimmedUserId) {
      setErrorMessage('ユーザーIDを入力してください。');
      return;
    }
    if (!supportsWebAuthn) {
      setErrorMessage('WebAuthn 未対応のブラウザです。');
      return;
    }

    resetMessages();
    setIsRegistering(true);
    try {
      const optionsResponse = await fetch('/api/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmedUserId }),
      });

      const optionsJson = await optionsResponse.json();
      if (!optionsResponse.ok) {
        setErrorMessage((optionsJson as ApiError).error ?? '登録オプション取得に失敗しました。');
        return;
      }

      const attestationResponse = await startRegistration({
        optionsJSON: optionsJson,
      });

      const verificationResponse = await fetch('/api/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: trimmedUserId,
          attestationResponse,
        }),
      });

      const verificationJson = await verificationResponse.json();
      if (!verificationResponse.ok) {
        setErrorMessage(
          (verificationJson as ApiError).error ?? 'パスキー登録の検証に失敗しました。',
        );
        return;
      }

      if ((verificationJson as ApiVerification).verified) {
        setSuccessMessage('パスキー登録が完了しました。');
      } else {
        setErrorMessage('パスキー登録に失敗しました。');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'パスキー登録中にエラーが発生しました。';
      setErrorMessage(message);
    } finally {
      setIsRegistering(false);
    }
  }, [supportsWebAuthn, resetMessages, trimmedUserId]);

  const handleLogin = useCallback(async () => {
    if (!trimmedUserId) {
      setErrorMessage('ユーザーIDを入力してください。');
      return;
    }
    if (!supportsWebAuthn) {
      setErrorMessage('WebAuthn 未対応のブラウザです。');
      return;
    }

    resetMessages();
    setIsAuthenticating(true);
    try {
      const optionsResponse = await fetch('/api/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: trimmedUserId }),
      });

      const optionsJson = await optionsResponse.json();
      if (!optionsResponse.ok) {
        setErrorMessage((optionsJson as ApiError).error ?? 'ログインオプション取得に失敗しました。');
        return;
      }

      const assertionResponse = await startAuthentication({
        optionsJSON: optionsJson,
      });

      const verificationResponse = await fetch('/api/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: trimmedUserId,
          authenticationResponse: assertionResponse,
        }),
      });

      const verificationJson = await verificationResponse.json();
      if (!verificationResponse.ok) {
        setErrorMessage(
          (verificationJson as ApiError).error ?? 'パスキー認証の検証に失敗しました。',
        );
        return;
      }

      if ((verificationJson as ApiVerification).verified) {
        setSuccessMessage('ログインに成功しました。');
      } else {
        setErrorMessage('ログインに失敗しました。');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'パスキー認証中にエラーが発生しました。';
      setErrorMessage(message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [supportsWebAuthn, resetMessages, trimmedUserId]);

  return (
    <main>
      <h1>Passkey デモ</h1>
      <form onSubmit={(event) => event.preventDefault()}>
        <label htmlFor="userId">ユーザーIDを入力してください</label>
        <input
          id="userId"
          name="userId"
          type="text"
          placeholder="user@example.com"
          autoComplete="username"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          disabled={isRegistering || isAuthenticating}
        />
        <button
          type="button"
          className="register"
          onClick={handleRegister}
          disabled={isRegistering || isAuthenticating}
        >
          {isRegistering ? '登録中…' : 'パスキー登録'}
        </button>
        <button
          type="button"
          className="login"
          onClick={handleLogin}
          disabled={isRegistering || isAuthenticating}
        >
          {isAuthenticating ? 'ログイン中…' : 'パスキーでログイン'}
        </button>
      </form>
      <section className="messages">
        {successMessage ? <div className="success">{successMessage}</div> : null}
        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {infoMessage ? <div className="info">{infoMessage}</div> : null}
      </section>
    </main>
  );
}
