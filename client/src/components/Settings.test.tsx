import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Settings from "./Settings";

const defaultProps = {
  username: "alice",
  recoveryCode: "abc-123-def-456",
  notificationsSupported: true,
  notificationsEnabled: false,
  notificationPermission: "default" as NotificationPermission | "unsupported",
  use24Hour: false,
  onEnableNotifications: vi.fn().mockResolvedValue(true),
  onDisableNotifications: vi.fn(),
  onTimeFormatChange: vi.fn(),
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

  describe("time format section", () => {
    it("renders display section with time format toggle", () => {
      render(<Settings {...defaultProps} />);
      expect(screen.getByText("Display")).toBeInTheDocument();
      expect(screen.getByText("Time format")).toBeInTheDocument();
      expect(screen.getByText("12h")).toBeInTheDocument();
      expect(screen.getByText("24h")).toBeInTheDocument();
    });

    it("shows 12h button as active when use24Hour is false", () => {
      render(<Settings {...defaultProps} use24Hour={false} />);
      const button12h = screen.getByTestId("time-format-12h");
      const button24h = screen.getByTestId("time-format-24h");

      expect(button12h).toHaveStyle({ background: "var(--color-primary)" });
      expect(button24h).toHaveStyle({ background: "transparent" });
    });

    it("shows 24h button as active when use24Hour is true", () => {
      render(<Settings {...defaultProps} use24Hour={true} />);
      const button12h = screen.getByTestId("time-format-12h");
      const button24h = screen.getByTestId("time-format-24h");

      expect(button12h).toHaveStyle({ background: "transparent" });
      expect(button24h).toHaveStyle({ background: "var(--color-primary)" });
    });

    it("calls onTimeFormatChange with false when 12h button clicked", () => {
      const onTimeFormatChange = vi.fn();
      render(
        <Settings
          {...defaultProps}
          use24Hour={true}
          onTimeFormatChange={onTimeFormatChange}
        />,
      );

      fireEvent.click(screen.getByTestId("time-format-12h"));
      expect(onTimeFormatChange).toHaveBeenCalledWith(false);
    });

    it("calls onTimeFormatChange with true when 24h button clicked", () => {
      const onTimeFormatChange = vi.fn();
      render(
        <Settings
          {...defaultProps}
          use24Hour={false}
          onTimeFormatChange={onTimeFormatChange}
        />,
      );

      fireEvent.click(screen.getByTestId("time-format-24h"));
      expect(onTimeFormatChange).toHaveBeenCalledWith(true);
    });
  });
});
