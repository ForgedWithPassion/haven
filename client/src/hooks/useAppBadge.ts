import { useState, useEffect, useCallback, useMemo } from "react";
import { getConversations } from "../storage/messages";
import { updateAllBadges } from "../utils/appBadge";
import { type Room } from "../storage/schema";

export interface DMUnreadCounts {
  [odD: string]: number;
}

export interface DMUserInfo {
  odD: string;
  username: string | null;
  unreadCount: number;
}

export interface UseAppBadgeReturn {
  totalUnreadCount: number;
  dmUnreadCounts: DMUnreadCounts;
  dmUsersWithUnread: DMUserInfo[];
  totalDMUnreadCount: number;
  refreshDMCounts: () => Promise<void>;
}

export function useAppBadge(rooms: Room[]): UseAppBadgeReturn {
  const [dmUnreadCounts, setDMUnreadCounts] = useState<DMUnreadCounts>({});
  const [dmUsersWithUnread, setDMUsersWithUnread] = useState<DMUserInfo[]>([]);

  // Calculate room unread count from rooms prop
  const roomUnreadCount = useMemo(
    () => rooms.reduce((sum, r) => sum + r.unreadCount, 0),
    [rooms],
  );

  // Calculate total DM unread count
  const totalDMUnreadCount = useMemo(
    () => Object.values(dmUnreadCounts).reduce((sum, count) => sum + count, 0),
    [dmUnreadCounts],
  );

  // Total unread count (rooms + DMs)
  const totalUnreadCount = roomUnreadCount + totalDMUnreadCount;

  // Refresh DM unread counts from storage
  const refreshDMCounts = useCallback(async () => {
    try {
      const conversations = await getConversations();
      const counts: DMUnreadCounts = {};
      const usersWithUnread: DMUserInfo[] = [];

      for (const convo of conversations) {
        if (convo.unreadCount > 0) {
          counts[convo.odD] = convo.unreadCount;
          usersWithUnread.push({
            odD: convo.odD,
            username: convo.username,
            unreadCount: convo.unreadCount,
          });
        }
      }
      setDMUnreadCounts(counts);
      setDMUsersWithUnread(usersWithUnread);
    } catch (error) {
      console.error("Failed to refresh DM unread counts:", error);
    }
  }, []);

  // Initial load of DM counts
  useEffect(() => {
    refreshDMCounts();
  }, [refreshDMCounts]);

  // Update all badges when total count changes
  useEffect(() => {
    updateAllBadges(totalUnreadCount);

    // Cleanup on unmount - reset badges
    return () => {
      updateAllBadges(0);
    };
  }, [totalUnreadCount]);

  return {
    totalUnreadCount,
    dmUnreadCounts,
    dmUsersWithUnread,
    totalDMUnreadCount,
    refreshDMCounts,
  };
}
