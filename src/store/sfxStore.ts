// src/store/sfxStore.ts
// Tekil resmi ses efekti aç/kapat mağazası. localStorage anahtarı: arabic_assistant_sfx_enabled
// Eski sfx-settings-v2 anahtarı varsa tek seferlik taşır ve temizler.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sfx } from "@/lib/sfxManager";

const CANONICAL_SFX_KEY = "arabic_assistant_sfx_enabled";
const LEGACY_SFX_KEY = "sfx-settings-v2";

function migrateLegacySfxPreference(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_SFX_KEY);
    if (!legacyRaw) return null;
    const existingCanonical = window.localStorage.getItem(CANONICAL_SFX_KEY);
    let legacyEnabled: boolean | null = null;
    try {
      const parsed = JSON.parse(legacyRaw) as {
        state?: { sfxEnabled?: unknown; enabled?: unknown };
      };
      if (typeof parsed?.state?.sfxEnabled === "boolean") {
        legacyEnabled = parsed.state.sfxEnabled;
      } else if (typeof parsed?.state?.enabled === "boolean") {
        legacyEnabled = parsed.state.enabled;
      }
    } catch {
      // ignore malformed JSON
    }
    window.localStorage.removeItem(LEGACY_SFX_KEY);
    if (!existingCanonical && legacyEnabled !== null) {
      return legacyEnabled;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

interface SfxState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (value: boolean) => void;
}

export const useSfxStore = create<SfxState>()(
  persist(
    (set) => ({
      enabled: true,

      toggle: () =>
        set((state) => {
          const next = !state.enabled;
          sfx.setEnabled(next);
          return { enabled: next };
        }),

      setEnabled: (value) => {
        sfx.setEnabled(value);
        set({ enabled: value });
      },
    }),
    {
      name: CANONICAL_SFX_KEY,
      partialize: (state) => ({ enabled: state.enabled }),
      onRehydrateStorage: () => (state) => {
        const migrated = migrateLegacySfxPreference();
        if (migrated !== null) {
          state?.setEnabled(migrated);
          return;
        }
        if (state?.enabled !== undefined) {
          sfx.setEnabled(state.enabled);
        }
      },
    }
  )
);