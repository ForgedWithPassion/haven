import { describe, it, expect, beforeEach } from "vitest";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  isFavorite,
} from "./favorites";
import { getDatabase } from "./schema";

describe("favorites storage", () => {
  beforeEach(async () => {
    const db = getDatabase();
    await db.favorites.clear();
  });

  describe("addFavorite", () => {
    it("adds a user to favorites", async () => {
      await addFavorite("user-1");
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].odD).toBe("user-1");
    });

    it("does not add duplicate favorites", async () => {
      await addFavorite("user-1");
      await addFavorite("user-1");
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(1);
    });

    it("adds multiple users to favorites", async () => {
      await addFavorite("user-1");
      await addFavorite("user-2");
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(2);
    });
  });

  describe("removeFavorite", () => {
    it("removes a user from favorites", async () => {
      await addFavorite("user-1");
      await removeFavorite("user-1");
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });

    it("does nothing when removing non-existent favorite", async () => {
      await removeFavorite("user-1");
      const favorites = await getFavorites();
      expect(favorites).toHaveLength(0);
    });
  });

  describe("getFavorites", () => {
    it("returns empty array when no favorites", async () => {
      const favorites = await getFavorites();
      expect(favorites).toEqual([]);
    });

    it("returns favorites ordered by addedAt", async () => {
      await addFavorite("user-1");
      await new Promise((r) => setTimeout(r, 10));
      await addFavorite("user-2");
      const favorites = await getFavorites();
      expect(favorites[0].odD).toBe("user-1");
      expect(favorites[1].odD).toBe("user-2");
    });
  });

  describe("isFavorite", () => {
    it("returns true for favorited user", async () => {
      await addFavorite("user-1");
      const result = await isFavorite("user-1");
      expect(result).toBe(true);
    });

    it("returns false for non-favorited user", async () => {
      const result = await isFavorite("user-1");
      expect(result).toBe(false);
    });
  });
});
