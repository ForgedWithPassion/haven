import { useState, useEffect } from "react";
import {
  ERR_RECOVERY_REQUIRED,
  ERR_INVALID_RECOVERY,
} from "../services/protocol";

interface LoginProps {
  onLogin: (username: string, recoveryCode?: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

export default function Login({ onLogin, error, isLoading }: LoginProps) {
  const [username, setUsername] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-show recovery input when RECOVERY_REQUIRED error is received
  useEffect(() => {
    if (error === ERR_RECOVERY_REQUIRED) {
      setShowRecovery(true);
    }
  }, [error]);

  const validateUsername = (value: string): string | null => {
    if (value.length < 3) {
      return "Username must be at least 3 characters";
    }
    if (value.length > 20) {
      return "Username must be at most 20 characters";
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      return "Username can only contain letters, numbers, underscores, and hyphens";
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateUsername(username);
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }
    setValidationError(null);
    onLogin(
      username,
      showRecovery && recoveryCode.trim() ? recoveryCode.trim() : undefined,
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const getDisplayError = () => {
    if (validationError) return validationError;
    if (error === ERR_RECOVERY_REQUIRED) {
      return "This username is registered. Please enter your recovery code.";
    }
    if (error === ERR_INVALID_RECOVERY) {
      return "Invalid recovery code. Please try again.";
    }
    return error;
  };

  const displayError = getDisplayError();

  return (
    <div className="flex flex-col items-center" style={{ paddingTop: "20vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <img
            src="/pwa-512x512.png"
            alt="Haven"
            style={{ width: 64, height: 64 }}
          />
        </div>
        <p
          className="text-muted text-center"
          style={{ marginBottom: "1.5rem" }}
        >
          Choose a username to get started
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="Username"
              autoComplete="off"
              autoFocus
              disabled={isLoading}
              style={{ width: "100%" }}
            />
          </div>

          {showRecovery && (
            <div>
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="Recovery code (e.g., apple-beach-crystal-dawn-frost-globe)"
                autoComplete="off"
                disabled={isLoading}
                style={{ width: "100%", fontFamily: "monospace" }}
              />
            </div>
          )}

          {displayError && (
            <p style={{ color: "var(--color-error)", fontSize: "0.875rem" }}>
              {displayError}
            </p>
          )}

          <button
            type="submit"
            className="primary"
            disabled={isLoading || username.length < 3}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Connecting...
              </span>
            ) : (
              "Join Haven"
            )}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: "1rem" }}>
          {!showRecovery ? (
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary)",
                cursor: "pointer",
                fontSize: "0.875rem",
                textDecoration: "underline",
              }}
            >
              Have a recovery code?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setShowRecovery(false);
                setRecoveryCode("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: "0.875rem",
                textDecoration: "underline",
              }}
            >
              New user? Hide recovery code
            </button>
          )}
        </div>

        <p
          className="text-muted text-small text-center"
          style={{ marginTop: "1rem" }}
        >
          {showRecovery
            ? "Enter your recovery code to access your account from this device."
            : "Your username will be reserved for you on this device."}
        </p>
      </div>
    </div>
  );
}
