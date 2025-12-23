import { getDatabase, type User } from "./schema";

/**
 * Cache a user's info (upsert). Called when receiving DMs to remember usernames.
 */
export async function cacheUser(odD: string, username: string): Promise<void> {
  const db = getDatabase();
  await db.users.put({
    odD,
    username,
    lastSeen: Date.now(),
  });
}

/**
 * Get a cached user by ID
 */
export async function getCachedUser(odD: string): Promise<User | undefined> {
  const db = getDatabase();
  return db.users.get(odD);
}

/**
 * Get all cached users
 */
export async function getAllCachedUsers(): Promise<User[]> {
  const db = getDatabase();
  return db.users.toArray();
}
