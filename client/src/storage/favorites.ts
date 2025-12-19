import { getDatabase, type Favorite } from "./schema";

export async function addFavorite(
  odD: string,
  username: string,
): Promise<void> {
  const db = getDatabase();
  const existing = await db.favorites.get(odD);
  if (!existing) {
    await db.favorites.add({ odD, username, addedAt: Date.now() });
  }
}

export async function removeFavorite(odD: string): Promise<void> {
  const db = getDatabase();
  await db.favorites.delete(odD);
}

export async function getFavorites(): Promise<Favorite[]> {
  const db = getDatabase();
  return db.favorites.orderBy("addedAt").toArray();
}

export async function isFavorite(odD: string): Promise<boolean> {
  const db = getDatabase();
  const favorite = await db.favorites.get(odD);
  return !!favorite;
}
