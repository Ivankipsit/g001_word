"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Snackbar } from "@mui/material";
import { shareOrCopy, type SharePayload } from "@/lib/share";

/** Share action plus the snackbar that confirms a clipboard fallback. Render `feedback` once. */
export function useShare(): { share: (p: SharePayload) => void; feedback: ReactNode } {
  const [message, setMessage] = useState<string | null>(null);

  const share = useCallback((payload: SharePayload) => {
    void shareOrCopy(payload).then((result) => {
      if (result === "copied") setMessage("Copied to clipboard");
      else if (result === "failed") setMessage("Couldn't share — copy the link from the address bar");
    });
  }, []);

  const feedback = (
    <Snackbar
      open={message !== null}
      autoHideDuration={2500}
      onClose={() => setMessage(null)}
      message={message}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ bottom: { xs: 88, sm: 88 } }}
    />
  );

  return { share, feedback };
}
