import { useState, useEffect, useCallback } from "react";
import {
  getMessagesWithUser,
  getConversations,
  markConversationAsRead,
  deleteConversation,
  type Message,
} from "../storage";

export interface Conversation {
  odD: string;
  username: string;
  lastMessage: Message;
  unreadCount: number;
}

export function useMessages(selectedUserId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!selectedUserId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const msgs = await getMessagesWithUser(selectedUserId);
      setMessages(msgs);
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const refresh = useCallback(() => {
    loadMessages();
  }, [loadMessages]);

  const markAsRead = useCallback(async () => {
    if (selectedUserId) {
      await markConversationAsRead(selectedUserId);
      await loadMessages();
    }
  }, [selectedUserId, loadMessages]);

  return { messages, isLoading, refresh, markAsRead };
}

export function useConversations(usernameMap: Map<string, string>) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const convos = await getConversations();
      setConversations(
        convos.map((c) => ({
          ...c,
          username: usernameMap.get(c.odD) || "Unknown",
        })),
      );
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      setIsLoading(false);
    }
  }, [usernameMap]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const refresh = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  const deleteConvo = useCallback(async (odD: string) => {
    await deleteConversation(odD);
    setConversations((prev) => prev.filter((c) => c.odD !== odD));
  }, []);

  return { conversations, isLoading, refresh, deleteConversation: deleteConvo };
}
