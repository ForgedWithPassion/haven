import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

interface RecoveryCodeModalProps {
  recoveryCode: string;
  onDismiss: () => void;
}

export default function RecoveryCodeModal({
  recoveryCode,
  onDismiss,
}: RecoveryCodeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
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
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: "450px", textAlign: "center" }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Save Your Recovery Code</h2>

        <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
          This code lets you access your account from a different device. Write
          it down or save it somewhere safe.
          <strong> You won't see this again.</strong>
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "1rem",
            background: "var(--color-bg-tertiary)",
            borderRadius: "8px",
            marginBottom: "1.5rem",
          }}
        >
          <code
            style={{
              fontSize: "1.25rem",
              fontWeight: 500,
              letterSpacing: "0.05em",
              wordBreak: "break-all",
            }}
          >
            {recoveryCode}
          </code>
          <Tooltip title={copied ? "Copied!" : "Copy"}>
            <IconButton
              onClick={handleCopy}
              size="small"
              sx={{ color: "var(--color-text)" }}
            >
              {copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
            </IconButton>
          </Tooltip>
        </div>

        <button
          className="primary"
          onClick={onDismiss}
          style={{ width: "100%" }}
        >
          I've Saved It
        </button>
      </div>
    </div>
  );
}
