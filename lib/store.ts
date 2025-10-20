import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type StoredCredential = {
  credentialId: string;
  publicKey: string;
  counter: number;
};

export type StoredUser = {
  id: string;
  userHandle: string;
  credentials: StoredCredential[];
};

export type WebAuthnStore = Record<string, StoredUser>;

const dataDirectory = path.join(process.cwd(), 'data');
const dataFile = path.join(dataDirectory, 'webauthn.json');

async function ensureDataFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(dataFile, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeFile(dataFile, JSON.stringify({}, null, 2), 'utf-8');
      return;
    }
    throw error;
  }
}

export async function readStore(): Promise<WebAuthnStore> {
  await ensureDataFile();
  const raw = await readFile(dataFile, 'utf-8');
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw) as WebAuthnStore;
}

export async function writeStore(store: WebAuthnStore): Promise<void> {
  await ensureDataFile();
  await writeFile(dataFile, JSON.stringify(store, null, 2), 'utf-8');
}

export async function getUser(userId: string): Promise<StoredUser | undefined> {
  const store = await readStore();
  const user = store[userId];
  if (!user) {
    return undefined;
  }

  const normalizedHandle = normalizeUserHandle(user.userHandle);
  if (normalizedHandle !== user.userHandle) {
    user.userHandle = normalizedHandle;
    store[userId] = user;
    await writeStore(store);
  }

  return user;
}

export async function ensureUser(userId: string): Promise<StoredUser> {
  const store = await readStore();
  const existing = store[userId];
  if (existing) {
    const normalizedHandle = normalizeUserHandle(existing.userHandle);
    if (normalizedHandle !== existing.userHandle) {
      existing.userHandle = normalizedHandle;
      store[userId] = existing;
      await writeStore(store);
    }
    return existing;
  }

  const newUser: StoredUser = {
    id: userId,
    userHandle: createUserHandle(),
    credentials: [],
  };
  store[userId] = newUser;
  await writeStore(store);
  return newUser;
}

export async function addOrUpdateCredential(
  userId: string,
  credential: StoredCredential,
): Promise<StoredUser> {
  const store = await readStore();
  const baseUser: StoredUser =
    store[userId] ?? {
      id: userId,
      userHandle: createUserHandle(),
      credentials: [],
    };
  baseUser.userHandle = normalizeUserHandle(baseUser.userHandle);
  const updatedCredentials = baseUser.credentials.filter(
    (item) => item.credentialId !== credential.credentialId,
  );
  updatedCredentials.push(credential);

  const updatedUser: StoredUser = {
    ...baseUser,
    credentials: updatedCredentials,
  };

  store[userId] = updatedUser;
  await writeStore(store);
  return updatedUser;
}

function createUserHandle(): string {
  return Buffer.from(uuidv4(), 'utf8').toString('base64url');
}

function normalizeUserHandle(handle: string | undefined): string {
  if (!handle) {
    return createUserHandle();
  }

  try {
    Buffer.from(handle, 'base64url');
    return handle;
  } catch (error) {
    return Buffer.from(handle, 'utf8').toString('base64url');
  }
}
