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
  return store[userId];
}

export async function ensureUser(userId: string): Promise<StoredUser> {
  const store = await readStore();
  if (!store[userId]) {
    store[userId] = {
      id: userId,
      userHandle: uuidv4(),
      credentials: [],
    };
    await writeStore(store);
  }
  return store[userId];
}

export async function addOrUpdateCredential(
  userId: string,
  credential: StoredCredential,
): Promise<StoredUser> {
  const store = await readStore();
  const baseUser: StoredUser =
    store[userId] ?? {
      id: userId,
      userHandle: uuidv4(),
      credentials: [],
    };
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
