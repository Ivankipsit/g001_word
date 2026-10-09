"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  Grid,
  Link,
  Stack,
  Switch,
  Typography,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import GetAppRoundedIcon from "@mui/icons-material/GetAppRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import type { User } from "@supabase/supabase-js";
import { useGameStore } from "@/game/store";
import { invitePayload } from "@/lib/share";
import { useShare } from "@/components/useShare";
import { Points } from "@/components/Points";
import { AchievementsPanel } from "@/components/AchievementsPanel";
import { EnglishWorld } from "@/dictionary/english";
import { SAVE_VERSION, modeDisplayName, type ThemePreference } from "@/game/types";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function SettingsScreen() {
  const soundEnabled = useGameStore((s) => s.settings.soundEnabled);
  const themePref = useGameStore((s) => s.settings.theme);
  const toggleSound = useGameStore((s) => s.toggleSound);
  const setTheme = useGameStore((s) => s.setTheme);
  const resetGame = useGameStore((s) => s.resetGame);
  const started = useGameStore((s) => s.started);
  const totalScore = useGameStore((s) => s.totalScore);
  const discoveredWords = useGameStore((s) => s.discoveredWords);
  const mode = useGameStore((s) => s.mode);
  const keystoneLetter = useGameStore((s) => s.keystoneLetter);
  const modes = useGameStore((s) => s.modes);
  const displayName = useGameStore((s) => s.settings.displayName ?? "");
  const setDisplayName = useGameStore((s) => s.setDisplayName);
  const { share, feedback } = useShare();

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installHint, setInstallHint] = useState(
    "On supported browsers, use the install prompt or Add to Home Screen.",
  );
  const [confirmReset, setConfirmReset] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setInstallHint("Tap Install to add Word Forge as an app.");
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    client.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const sendMagicLink = async () => {
    setAuthErr(null);
    setAuthMsg(null);
    const client = getSupabaseBrowserClient();
    if (!client) {
      setAuthErr(
        "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local",
      );
      return;
    }
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setAuthErr("Enter a valid email.");
      return;
    }
    setAuthBusy(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await client.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });
    setAuthBusy(false);
    if (error) {
      setAuthErr(error.message);
      return;
    }
    setAuthMsg("Check your email for the magic link.");
  };

  const signOut = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    setAuthMsg("Signed out. Progress stays on this device.");
  };

  const discovered = Object.keys(discoveredWords).length;
  const savedModes = Object.entries(modes)
    .filter(([, s]) => s?.started)
    .map(([m]) => modeDisplayName(m as typeof mode));

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        Settings
      </Typography>

      <Grid container spacing={2.5}>
      <Grid size={12}>
      <Section title="Achievements">
        <AchievementsPanel />
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Appearance">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Theme is saved with your progress
          {user ? " and synced when signed in" : ""}.
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={themePref}
          onChange={(_, v: ThemePreference | null) => {
            if (v) setTheme(v);
          }}
          aria-label="Color theme"
        >
          <ToggleButton value="system" sx={{ minHeight: 48 }}>
            System
          </ToggleButton>
          <ToggleButton value="light" sx={{ minHeight: 48 }}>
            Light
          </ToggleButton>
          <ToggleButton value="dark" sx={{ minHeight: 48 }}>
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Account & sync">
        <TextField
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          fullWidth
          size="small"
          autoComplete="nickname"
          helperText="Shown when you invite friends."
          slotProps={{ htmlInput: { maxLength: 32 } }}
          sx={{ mb: 2 }}
        />
        {!isSupabaseConfigured() ? (
          <Alert severity="info">
            Cloud sync needs <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
            <code>.env.local</code>. Guests stay local-only.
          </Alert>
        ) : user ? (
          <Stack spacing={1.5}>
            <Typography variant="body2">
              Signed in as <strong>{user.email}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Each mode syncs as its own save. Words found on different devices in the
              same run are merged.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<LogoutRoundedIcon />}
              onClick={() => void signOut()}
            >
              Sign out
            </Button>
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Sign in with a magic link to sync progress. Without an account,
              everything stays on this device.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              margin="none"
              sx={{ mt: 0.5 }}
            />
            <Button
              variant="contained"
              startIcon={<MailRoundedIcon />}
              disabled={authBusy}
              onClick={() => void sendMagicLink()}
              sx={{ mt: 0.5 }}
            >
              {authBusy ? "Sending…" : "Send magic link"}
            </Button>
            {authMsg && <Alert severity="success">{authMsg}</Alert>}
            {authErr && <Alert severity="error">{authErr}</Alert>}
          </Stack>
        )}
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Invite friends">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Send a link to Word Forge. Your display name is included when set.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ShareRoundedIcon />}
          onClick={() => share(invitePayload(displayName))}
        >
          Invite friends
        </Button>
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Sound">
        <FormControlLabel
          control={<Switch checked={soundEnabled} onChange={toggleSound} />}
          label="Sound effects (stub — coming soon)"
        />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 6, mt: -0.5 }}>
          Toggle is saved; audio hooks can plug in later.
        </Typography>
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Install app (PWA)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Install Word Forge on your home screen for faster launch and offline
          play. The full English lexicon caches after the first load so you can
          keep forging without a network. Cloud sync pauses offline and resumes
          when you reconnect.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {installHint}
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<GetAppRoundedIcon />}
          disabled={!installEvent}
          onClick={onInstall}
        >
          {installEvent ? "Install Word Forge" : "Install unavailable here"}
        </Button>
        {!installEvent && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Tip: On iPhone Safari use Share → Add to Home Screen. On desktop Chrome
            look for the install icon in the address bar.
          </Typography>
        )}
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Play mode">
        {started ? (
          <>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Current:{" "}
              <strong>
                {modeDisplayName(mode)}
                {(mode === "keystone" || mode === "daily" || mode === "rare") &&
                keystoneLetter
                  ? ` (${keystoneLetter})`
                  : ""}
              </strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Switch modes from the <strong>Play</strong> screen (grid icon next to
              the title). Each mode keeps its own progress — local and in the cloud
              when signed in.
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No mode active — pick one from <strong>Play</strong>. Theme, install, and
            account work from here anytime.
          </Typography>
        )}
        {savedModes.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Saved runs: {savedModes.join(", ")}
          </Typography>
        )}
      </Section>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
      <Section title="Progress">
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {started ? (
            <>
              <Typography variant="body2">
                Total score: <Points value={totalScore} />
              </Typography>
              <Typography variant="body2">
                Words discovered: {discovered} /{" "}
                {EnglishWorld.wordCount.toLocaleString()}
              </Typography>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Open a mode to see that run&apos;s score and lexicon. Saved runs are
              listed above.
            </Typography>
          )}
          <Typography variant="body2">
            Language: {EnglishWorld.displayName} · Save v{SAVE_VERSION}
          </Typography>
          <Stack spacing={0.25} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Sources
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <Link
                href="https://en.wiktionary.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                English Wiktionary
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              License{" "}
              <Link
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                CC BY-SA 4.0
              </Link>
              . Wiktionary text is also available under the GNU Free
              Documentation License.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Extracted by{" "}
              <Link
                href="https://kaikki.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                kaikki.org
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This game keeps English words of 3 letters or longer and shortens
              each gloss.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rarity tiers use{" "}
              <Link
                href="https://norvig.com/ngrams/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Peter Norvig&apos;s web word counts
              </Link>
              .
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {!confirmReset ? (
          <Button
            variant="outlined"
            color="error"
            startIcon={<RestartAltRoundedIcon />}
            onClick={() => setConfirmReset(true)}
          >
            Reset all saves
          </Button>
        ) : (
          <Alert
            severity="warning"
            action={
              <Stack direction="row" spacing={1}>
                <Button color="inherit" size="small" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  color="error"
                  size="small"
                  variant="contained"
                  onClick={() => {
                    resetGame();
                    setConfirmReset(false);
                  }}
                >
                  Reset
                </Button>
              </Stack>
            }
          >
            Clears every mode&apos;s letters, coins, lexicon, and generators — back
            to the mode picker{user ? ", on this device and in the cloud" : ""}. Theme,
            achievements, and your daily streak are kept.
          </Alert>
        )}
      </Section>
      </Grid>
      </Grid>
      {feedback}
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ height: "100%" }}>
      <Typography sx={{ fontWeight: 800, mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  );
}
