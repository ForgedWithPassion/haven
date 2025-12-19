import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketService, type WebSocketEvents } from "./websocket";

describe("WebSocketService", () => {
  let service: WebSocketService;
  let events: WebSocketEvents;

  beforeEach(() => {
    events = {
      onStatusChange: vi.fn(),
      onRegistered: vi.fn(),
      onRegisterFailed: vi.fn(),
      onUserListUpdate: vi.fn(),
      onUserJoined: vi.fn(),
      onUserLeft: vi.fn(),
      onDirectMessage: vi.fn(),
      onRoomCreated: vi.fn(),
      onRoomJoined: vi.fn(),
      onRoomMessage: vi.fn(),
      onError: vi.fn(),
    };
    service = new WebSocketService("ws://localhost:8080/ws", events);
  });

  it("reports connecting status when connect is called", async () => {
    service.connect();
    expect(events.onStatusChange).toHaveBeenCalledWith("connecting");
  });

  it("reports connected status after WebSocket opens", async () => {
    service.connect();

    // Wait for mock WebSocket to "open"
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events.onStatusChange).toHaveBeenCalledWith("connected");
  });

  it("reports disconnected status after disconnect", async () => {
    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    service.disconnect();

    expect(events.onStatusChange).toHaveBeenCalledWith("disconnected");
  });

  it("returns correct status", async () => {
    expect(service.getStatus()).toBe("disconnected");

    service.connect();
    expect(service.getStatus()).toBe("connecting");

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(service.getStatus()).toBe("connected");
  });
});
