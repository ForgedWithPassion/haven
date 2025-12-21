import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

interface PWAUpdateBannerProps {
  needRefresh: boolean;
  offlineReady: boolean;
  onAcceptUpdate: () => void;
  onDismissUpdate: () => void;
  onDismissOfflineReady: () => void;
}

export default function PWAUpdateBanner({
  needRefresh,
  offlineReady,
  onAcceptUpdate,
  onDismissUpdate,
  onDismissOfflineReady,
}: PWAUpdateBannerProps) {
  if (needRefresh) {
    return (
      <Snackbar
        open
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 90, sm: 24 } }}
      >
        <Alert
          severity="info"
          action={
            <>
              <Button color="inherit" size="small" onClick={onDismissUpdate}>
                Later
              </Button>
              <Button color="inherit" size="small" onClick={onAcceptUpdate}>
                Update
              </Button>
            </>
          }
        >
          New version available
        </Alert>
      </Snackbar>
    );
  }

  if (offlineReady) {
    return (
      <Snackbar
        open
        autoHideDuration={5000}
        onClose={onDismissOfflineReady}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 90, sm: 24 } }}
      >
        <Alert severity="success" onClose={onDismissOfflineReady}>
          App ready for offline use
        </Alert>
      </Snackbar>
    );
  }

  return null;
}
