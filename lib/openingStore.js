import { randomUUID } from "crypto";

const store = new Map();
const TTL_MS = 30 * 60 * 1000;

// files: [{ buffer, mimetype, originalname }]
export function saveOpening(files) {
  const id = randomUUID();
  store.set(id, { files, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function getOpening(id) {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return entry.files;
}
