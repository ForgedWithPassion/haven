import { getDatabase, type Message } from "./schema";

export async function storeMessage(
  message: Omit<Message, "id">,
): Promise<number> {
  const db = getDatabase();
  return db.messages.add(message as Message);
}

export async function getMessagesWithUser(
  odD: string,
  limit = 100,
): Promise<Message[]> {
  const db = getDatabase();
  return db.messages
    .where("[odD+timestamp]")
    .between([odD, 0], [odD, Date.now()], true, true)
    .reverse()
    .limit(limit)
    .toArray()
    .then((msgs) => msgs.reverse());
}

export async function updateMessageStatus(
  id: number,
  status: Message["status"],
): Promise<void> {
  const db = getDatabase();
  await db.messages.update(id, { status });
}

export async function getConversations(): Promise<
  Array<{
    odD: string;
    lastMessage: Message;
    unreadCount: number;
  }>
> {
  const db = getDatabase();

  // Get all unique user IDs with messages
  const messages = await db.messages.orderBy("timestamp").reverse().toArray();

  const conversationMap = new Map<
    string,
    {
      odD: string;
      lastMessage: Message;
      unreadCount: number;
    }
  >();

  for (const msg of messages) {
    if (!conversationMap.has(msg.odD)) {
      conversationMap.set(msg.odD, {
        odD: msg.odD,
        lastMessage: msg,
        unreadCount: 0,
      });
    }
    // Count unread received messages
    if (msg.direction === "received" && msg.status !== "read") {
      const convo = conversationMap.get(msg.odD)!;
      convo.unreadCount++;
    }
  }

  return Array.from(conversationMap.values());
}

export async function markConversationAsRead(odD: string): Promise<void> {
  const db = getDatabase();
  await db.messages
    .where("odD")
    .equals(odD)
    .and((msg) => msg.direction === "received" && msg.status !== "read")
    .modify({ status: "read" });
}

export async function deleteConversation(odD: string): Promise<void> {
  const db = getDatabase();
  await db.messages.where("odD").equals(odD).delete();
}

export async function clearAllMessages(): Promise<void> {
  const db = getDatabase();
  await db.messages.clear();
}

// Delete a specific message by ID
export async function deleteMessage(id: number): Promise<void> {
  const db = getDatabase();
  await db.messages.delete(id);
}

// Mark the most recent pending/sent message to a user as failed
export async function markLastMessageAsFailed(odD: string): Promise<void> {
  const db = getDatabase();
  // Find the most recent sent message that isn't already failed
  const messages = await db.messages
    .where("[odD+timestamp]")
    .between([odD, 0], [odD, Date.now()], true, true)
    .reverse()
    .filter(
      (msg) =>
        msg.direction === "sent" &&
        (msg.status === "sent" || msg.status === "pending"),
    )
    .limit(1)
    .toArray();

  if (messages.length > 0 && messages[0].id) {
    await db.messages.update(messages[0].id, { status: "failed" });
  }
}
