"use client";

import { useEffect, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Magic-link landing: exchanges ?code= for a session (PKCE).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setMessage("Supabase is not configured.");
      return;
    }

    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const err = url.searchParams.get("error_description");
      if (err) {
        setMessage(err);
        return;
      }
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }
      router.replace("/");
    };

    void run();
  }, [router]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        gap: 2,
        px: 2,
      }}
    >
      <CircularProgress color="primary" />
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}
