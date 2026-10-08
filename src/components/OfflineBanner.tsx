"use client";

import { useEffect, useState } from "react";
import { Alert, Collapse } from "@mui/material";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";

/** Shows when the browser reports offline — local play still works. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <Collapse in={offline}>
      <Alert
        severity="warning"
        icon={<CloudOffRoundedIcon />}
        sx={{ borderRadius: 0, py: 0.5 }}
      >
        You&apos;re offline — play continues on this device. Cloud sync resumes when
        you&apos;re back online.
      </Alert>
    </Collapse>
  );
}
