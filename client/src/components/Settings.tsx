import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LogoutIcon from "@mui/icons-material/Logout";

interface SettingsProps {
  username: string;
  recoveryCode: string | null;
  onBack: () => void;
  onLogout: () => void;
}

export default function Settings({
  username,
  recoveryCode,
  onBack,
  onLogout,
}: SettingsProps) {
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleCopy = async () => {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2"
        style={{
          padding: "0.75rem",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg-secondary)",
        }}
      >
        <Tooltip title="Back">
          <IconButton
            onClick={onBack}
            size="small"
            sx={{ color: "var(--color-text)" }}
          >
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <h3 style={{ margin: 0 }}>Settings</h3>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
        {/* Account section */}
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h4 style={{ marginBottom: "1rem" }}>Account</h4>

          <div style={{ marginBottom: "1rem" }}>
            <div
              className="text-small text-muted"
              style={{ marginBottom: "0.25rem" }}
            >
              Username
            </div>
            <div style={{ fontWeight: 500 }}>{username}</div>
          </div>

          <div>
            <div
              className="text-small text-muted"
              style={{ marginBottom: "0.5rem" }}
            >
              Recovery Code
            </div>
            {recoveryCode ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem",
                    background: "var(--color-bg-tertiary)",
                    borderRadius: "8px",
                    marginBottom: "0.5rem",
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: "0.9rem",
                      letterSpacing: "0.02em",
                      wordBreak: "break-all",
                    }}
                  >
                    {showRecoveryCode
                      ? recoveryCode
                      : "••••••-••••••-••••••-••••••-••••••-••••••"}
                  </code>
                  <Tooltip title={showRecoveryCode ? "Hide" : "Show"}>
                    <IconButton
                      onClick={() => setShowRecoveryCode(!showRecoveryCode)}
                      size="small"
                      sx={{ color: "var(--color-text)" }}
                    >
                      {showRecoveryCode ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={copied ? "Copied!" : "Copy"}>
                    <IconButton
                      onClick={handleCopy}
                      size="small"
                      sx={{ color: "var(--color-text)" }}
                      disabled={!showRecoveryCode}
                    >
                      {copied ? (
                        <CheckIcon color="success" />
                      ) : (
                        <ContentCopyIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                </div>
                <p className="text-small text-muted">
                  Use this code to access your account from a different device.
                </p>
              </div>
            ) : (
              <p className="text-muted">
                No recovery code available. This account may have been created
                before recovery codes were introduced.
              </p>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="card">
          <h4 style={{ marginBottom: "1rem", color: "var(--color-error)" }}>
            Danger Zone
          </h4>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--color-error)",
              color: "white",
            }}
          >
            <LogoutIcon fontSize="small" />
            Log Out
          </button>
          <p className="text-small text-muted" style={{ marginTop: "0.5rem" }}>
            You will need your recovery code to log back in from this device.
          </p>
        </div>
      </div>

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "300px", textAlign: "center" }}
          >
            <h3 style={{ marginBottom: "1rem" }}>Log Out?</h3>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              {recoveryCode
                ? "Make sure you have saved your recovery code. You will need it to log back in."
                : "You may not be able to recover this account without a recovery code."}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                className="secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                style={{ background: "var(--color-error)", color: "white" }}
                onClick={() => {
                  onLogout();
                  setShowLogoutConfirm(false);
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
