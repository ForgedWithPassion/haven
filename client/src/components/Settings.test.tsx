import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Settings from "./Settings";

const defaultProps = {
  username: "alice",
  recoveryCode: "abc-123-def-456",
  notificationsSupported: true,
  notificationsEnabled: false,
  notificationPermission: "default" as NotificationPermission | "unsupported",
  onEnableNotifications: vi.fn().mockResolvedValue(true),
  onDisableNotifications: vi.fn(),
  onBack: vi.fn(),
  onLogout: vi.fn(),
};

describe("Settings component", () => {
  describe("notifications section", () => {
    it("renders notifications section when supported", () => {
      render(<Settings {...defaultProps} notificationsSupported={true} />);
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByText("Browser notifications")).toBeInTheDocument();
    });

    it("shows not supported message when notifications not supported", () => {
      render(<Settings {...defaultProps} notificationsSupported={false} />);
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Browser notifications are not supported on this device.",
        ),
      ).toBeInTheDocument();
    });

    it("shows toggle in off state when notifications disabled", () => {
      render(<Settings {...defaultProps} notificationsEnabled={false} />);
      const toggle = screen
        .getByTestId("notifications-toggle")
        .querySelector("input");
      expect(toggle).not.toBeChecked();
    });

    it("shows toggle in on state when notifications enabled and granted", () => {
      render(
        <Settings
          {...defaultProps}
          notificationsEnabled={true}
          notificationPermission="granted"
        />,
      );
      const toggle = screen
        .getByTestId("notifications-toggle")
        .querySelector("input");
      expect(toggle).toBeChecked();
    });

    it("calls onEnableNotifications when toggle is turned on", async () => {
      const onEnableNotifications = vi.fn().mockResolvedValue(true);
      render(
        <Settings
          {...defaultProps}
          notificationsEnabled={false}
          onEnableNotifications={onEnableNotifications}
        />,
      );

      const toggle = screen
        .getByTestId("notifications-toggle")
        .querySelector("input")!;
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(onEnableNotifications).toHaveBeenCalledTimes(1);
      });
    });

    it("calls onDisableNotifications when toggle is turned off", () => {
      const onDisableNotifications = vi.fn();
      render(
        <Settings
          {...defaultProps}
          notificationsEnabled={true}
          notificationPermission="granted"
          onDisableNotifications={onDisableNotifications}
        />,
      );

      const toggle = screen
        .getByTestId("notifications-toggle")
        .querySelector("input")!;
      fireEvent.click(toggle);

      expect(onDisableNotifications).toHaveBeenCalledTimes(1);
    });

    it("disables toggle when permission is denied", () => {
      render(<Settings {...defaultProps} notificationPermission="denied" />);

      const toggle = screen
        .getByTestId("notifications-toggle")
        .querySelector("input");
      expect(toggle).toBeDisabled();
    });

    it("shows blocked message when permission is denied", () => {
      render(<Settings {...defaultProps} notificationPermission="denied" />);

      expect(
        screen.getByText(/Notifications are blocked/i),
      ).toBeInTheDocument();
    });

    it("shows helper text about background notifications", () => {
      render(<Settings {...defaultProps} />);
      expect(
        screen.getByText(/Get notified when you receive messages/i),
      ).toBeInTheDocument();
    });
  });

  describe("existing functionality", () => {
    it("displays username", () => {
      render(<Settings {...defaultProps} />);
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    it("calls onBack when back button clicked", () => {
      const onBack = vi.fn();
      render(<Settings {...defaultProps} onBack={onBack} />);

      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});
