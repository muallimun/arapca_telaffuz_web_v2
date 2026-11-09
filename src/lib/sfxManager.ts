// src/lib/sfxManager.ts
// 14 MP3 Ses Efekti (`efect/` klasörü) + Web Audio API yedekli akıllı ses efekt motoru

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSettings } from "@/store/settings";

type Waveform = OscillatorType;

interface Note {
  frequency: number;
  startOffset: number; // saniye, "şimdi"den itibaren
  duration: number;
  waveform?: Waveform;
  peakGain?: number;
}

export interface PlayCorrectOptions {
  isSpeech?: boolean;
  streak?: number;
  gender?: "male" | "female" | "erkek" | "kadin";
}

interface SfxStoreState {
  sfxEnabled: boolean;
  setSfxEnabled: (enabled: boolean) => void;
  toggleSfx: () => void;
}

export const useSfxStore = create<SfxStoreState>()(
  persist(
    (set, get) => ({
      sfxEnabled: true,
      setSfxEnabled: (enabled: boolean) => {
        sfx.setEnabled(enabled);
        set({ sfxEnabled: enabled });
      },
      toggleSfx: () => {
        const next = !get().sfxEnabled;
        sfx.setEnabled(next);
        set({ sfxEnabled: next });
      },
    }),
    {
      name: "sfx-settings-v2",
      onRehydrateStorage: () => (state) => {
        if (state && typeof state.sfxEnabled === "boolean") {
          sfx.setEnabled(state.sfxEnabled);
        }
      },
    }
  )
);

const EFECT_FILES = {
  click: "butonsesi.mp3",
  start: "baslangic.mp3",
  correctChimes: ["dogru.mp3", "bildiniz.mp3"] as const,
  wrongChimes: ["yanliscevap.mp3", "bilemediniz.mp3"] as const,
  praiseMale: ["ahsent_male.mp3", "mumtaz_male.mp3", "rai_male.mp3"] as const,
  praiseFemale: [
    "ahsent_female.mp3",
    "mumtaz_female.mp3",
    "rai_female.mp3",
  ] as const,
  fanfareHigh: "tebrikler.mp3",
  fanfareStandard: "basari.mp3",
} as const;

function buildEfectCandidateUrls(fileName: string): string[] {
  const clean = fileName.replace(/^\/+/, "");
  return [
    `/efect/${clean}`,
    `https://cdn.jsdelivr.net/gh/muallimun/arapca_telaffuz_medya@main/efect/${clean}`,
    `https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/efect/${clean}`,
    `https://raw.githubusercontent.com/muallimun/arapca_telaffuz_medya/main/public/efect/${clean}`,
    `https://cdn.jsdelivr.net/gh/muallimun/arapca_telaffuz_medya@main/public/efect/${clean}`,
  ];
}

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private unlockBound = false;

  // HTMLAudioElement önbelleği (sıfır gecikme için)
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private resolvedUrlMap: Map<string, string> = new Map();

  // Tekrar etmeyen (Round-Robin) sayaçlar ve tıklama soğuma süresi (cooldown)
  private lastClickAt = 0;
  private correctChimeIndex = 0;
  private wrongChimeIndex = 0;
  private praiseRotationIndex = 0;
  private praiseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.bindUnlock();
    }
  }

  /** İlk kullanıcı etkileşiminde AudioContext'i açar ve temel efektleri ısıtır */
  private bindUnlock() {
    if (this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      try {
        this.getContext().resume();
      } catch {
        /* sessizce yut */
      }
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock, { passive: true });
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("keydown", unlock, { passive: true });
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const win = window as Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = window.AudioContext || win.webkitAudioContext;
      if (!AC) throw new Error("AudioContext not supported");
      this.ctx = new AC();
    }
    return this.ctx;
  }

  /** Ayarlardan aç/kapat */
  setEnabled(value: boolean) {
    this.enabled = value;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** TTS çalarken yalnızca tık sesini bastır, geri bildirim efektlerine izin ver */
  private isTTSActive(): boolean {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    return window.speechSynthesis.speaking || window.speechSynthesis.pending;
  }

  private canPlay(): boolean {
    return this.enabled;
  }

  /**
   * `efect/` klasöründeki MP3 dosyasını önbellekten veya çok kademeli CDN yedeğinden çalar.
   * Ağ veya yükleme hatası olursa `fallbackSynth` çalıştırılır.
   */
  private playMp3WithFallback(
    fileName: string,
    volume: number,
    fallbackSynth?: () => void
  ) {
    if (!this.canPlay() || typeof window === "undefined") return;

    const candidates = buildEfectCandidateUrls(fileName);
    const knownWorkingUrl = this.resolvedUrlMap.get(fileName);
    const orderedUrls = knownWorkingUrl
      ? [
          knownWorkingUrl,
          ...candidates.filter((u) => u !== knownWorkingUrl),
        ]
      : candidates;

    const tryPlayAtIndex = (idx: number) => {
      if (idx >= orderedUrls.length) {
        if (fallbackSynth) fallbackSynth();
        return;
      }

      const url = orderedUrls[idx];
      const cacheKey = `${fileName}::${url}`;
      let audio = this.audioCache.get(cacheKey);

      if (!audio) {
        audio = new Audio(url);
        audio.preload = "auto";
        this.audioCache.set(cacheKey, audio);
      }

      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore seek reset issues on uninitialized media
      }
      audio.volume = Math.max(0, Math.min(1, volume));

      let handledError = false;
      const handleFailure = () => {
        if (handledError) return;
        handledError = true;
        audio?.removeEventListener("error", handleFailure);
        this.audioCache.delete(cacheKey);
        tryPlayAtIndex(idx + 1);
      };

      audio.addEventListener("error", handleFailure, { once: true });

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audio?.removeEventListener("error", handleFailure);
            this.resolvedUrlMap.set(fileName, url);
          })
          .catch((err: unknown) => {
            audio?.removeEventListener("error", handleFailure);
            // Kullanıcı etkileşimi yoksa (NotAllowedError) diğer URL'leri boşuna deneme
            if (
              err instanceof DOMException &&
              err.name === "NotAllowedError"
            ) {
              return;
            }
            handleFailure();
          });
      }
    };

    tryPlayAtIndex(0);
  }

  private playNotes(notes: Note[]) {
    if (!this.canPlay() || this.isTTSActive()) return;
    try {
      const ctx = this.getContext();
      if (ctx.state === "suspended") ctx.resume();
      const now = ctx.currentTime;

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = note.waveform ?? "sine";
        osc.frequency.setValueAtTime(note.frequency, now + note.startOffset);

        const peak = note.peakGain ?? 0.18;
        const start = now + note.startOffset;
        const end = start + note.duration;

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(end + 0.02);
      });
    } catch {
      /* sessizce geç */
    }
  }

  private vibrate(pattern: number | number[]) {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.vibrate !== "function") return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* sessizce geç */
    }
  }

  private resolvePraiseVoiceGender(
    explicitGender?: "male" | "female" | "erkek" | "kadin"
  ): "male" | "female" {
    if (explicitGender === "kadin" || explicitGender === "female") {
      return "female";
    }
    if (explicitGender === "erkek" || explicitGender === "male") {
      return "male";
    }
    try {
      const pref = useSettings.getState().preferredVoiceGender;
      return pref === "kadin" ? "female" : "male";
    } catch {
      return "male";
    }
  }

  // ---------------- PUBLIC API ----------------

  /**
   * 1. Buton / Sekme Tıklaması (`butonsesi.mp3`)
   * Çok yumuşak ses (`volume = 0.25`) ve `120ms` cooldown ile üst üste binmeyi önler.
   */
  playClick() {
    if (!this.canPlay()) return;
    const now = Date.now();
    if (now - this.lastClickAt < 120) return;
    this.lastClickAt = now;

    this.playMp3WithFallback(EFECT_FILES.click, 0.25, () => {
      this.playNotes([
        {
          frequency: 1000,
          startOffset: 0.0,
          duration: 0.025,
          waveform: "square",
          peakGain: 0.05,
        },
      ]);
    });
  }

  /** Kart çevirme — `butonsesi.mp3` (120ms cooldown ile) */
  playFlip() {
    this.playClick();
  }

  /**
   * 2. Alıştırma / Modül Başlangıcı (`baslangic.mp3`)
   * Alıştırmayı Başlat, Günlük Çalışma Paketi veya Rol Yapma/Telaffuz testi başladığında çalar.
   */
  playStart() {
    if (!this.canPlay()) return;
    this.playMp3WithFallback(EFECT_FILES.start, 0.5, () => {
      this.playNotes([
        {
          frequency: 440,
          startOffset: 0.0,
          duration: 0.1,
          waveform: "sine",
          peakGain: 0.15,
        },
        {
          frequency: 587.33,
          startOffset: 0.09,
          duration: 0.16,
          waveform: "sine",
          peakGain: 0.17,
        },
      ]);
    });
  }

  /**
   * 3. Doğru Cevap & Dönüşümlü Arapça Sesli Övgü (`dogru.mp3` / `bildiniz.mp3` + `ahsent` -> `mumtaz` -> `rai`)
   * - İlk olarak `dogru.mp3` ve `bildiniz.mp3` sırayla (Round-Robin) çalar (`volume = 0.5`).
   * - Sesli övgü (`ahsent_*`, `mumtaz_*`, `rai_*`) YALNIZCA:
   *   a) Mikrofonlu konuşma/eşleştirme doğrularında (`options.isSpeech === true`) VEYA
   *   b) Art arda her 3 doğru cevap serisinde (`options.streak % 3 === 0`)
   *   250ms gecikmeyle ve aynı övgü arka arkaya gelmeyecek şekilde sırayla çalar!
   */
  playCorrect(options?: PlayCorrectOptions) {
    if (!this.canPlay()) return;

    const chimeFile =
      EFECT_FILES.correctChimes[
        this.correctChimeIndex % EFECT_FILES.correctChimes.length
      ];
    this.correctChimeIndex =
      (this.correctChimeIndex + 1) % EFECT_FILES.correctChimes.length;

    this.playMp3WithFallback(chimeFile, 0.5, () => {
      this.playNotes([
        {
          frequency: 523.25,
          startOffset: 0.0,
          duration: 0.12,
          waveform: "sine",
          peakGain: 0.18,
        },
        {
          frequency: 659.25,
          startOffset: 0.1,
          duration: 0.12,
          waveform: "sine",
          peakGain: 0.18,
        },
        {
          frequency: 783.99,
          startOffset: 0.2,
          duration: 0.22,
          waveform: "sine",
          peakGain: 0.2,
        },
      ]);
    });
    this.vibrate(40);

    const shouldPlaySpokenPraise =
      Boolean(options?.isSpeech) ||
      (typeof options?.streak === "number" &&
        options.streak > 0 &&
        options.streak % 3 === 0);

    if (shouldPlaySpokenPraise) {
      const gender = this.resolvePraiseVoiceGender(options?.gender);
      const praiseList =
        gender === "female"
          ? EFECT_FILES.praiseFemale
          : EFECT_FILES.praiseMale;
      const praiseFile =
        praiseList[this.praiseRotationIndex % praiseList.length];
      this.praiseRotationIndex =
        (this.praiseRotationIndex + 1) % praiseList.length;

      if (this.praiseTimer) {
        clearTimeout(this.praiseTimer);
      }
      this.praiseTimer = setTimeout(() => {
        this.playMp3WithFallback(praiseFile, 0.65);
      }, 250);
    }
  }

  /** Geriye dönük uyumluluk için `playSuccess` -> `playCorrect` çağırır */
  playSuccess(options?: PlayCorrectOptions) {
    this.playCorrect(options);
  }

  /** Orta seviye / %50–%79 telaffuz (E4→G4) */
  playPartial() {
    this.playNotes([
      {
        frequency: 329.63,
        startOffset: 0.0,
        duration: 0.14,
        waveform: "triangle",
        peakGain: 0.15,
      },
      {
        frequency: 392.0,
        startOffset: 0.12,
        duration: 0.2,
        waveform: "triangle",
        peakGain: 0.15,
      },
    ]);
    this.vibrate(25);
  }

  /**
   * 4. Yanlış Cevap (`yanliscevap.mp3` ve `bilemediniz.mp3` sırayla / Round-Robin)
   */
  playWrong() {
    if (!this.canPlay()) return;

    const wrongFile =
      EFECT_FILES.wrongChimes[
        this.wrongChimeIndex % EFECT_FILES.wrongChimes.length
      ];
    this.wrongChimeIndex =
      (this.wrongChimeIndex + 1) % EFECT_FILES.wrongChimes.length;

    this.playMp3WithFallback(wrongFile, 0.45, () => {
      this.playNotes([
        {
          frequency: 329.63,
          startOffset: 0.0,
          duration: 0.18,
          waveform: "triangle",
          peakGain: 0.14,
        },
        {
          frequency: 261.63,
          startOffset: 0.15,
          duration: 0.25,
          waveform: "triangle",
          peakGain: 0.14,
        },
      ]);
    });
    this.vibrate([40, 60, 40]);
  }

  /** Geriye dönük uyumluluk için `playError` -> `playWrong` çağırır */
  playError() {
    this.playWrong();
  }

  /** Mikrofon kaydı başladı (600→880Hz bip) */
  playRecordStart() {
    this.playNotes([
      {
        frequency: 600,
        startOffset: 0.0,
        duration: 0.06,
        waveform: "sine",
        peakGain: 0.14,
      },
      {
        frequency: 880,
        startOffset: 0.05,
        duration: 0.08,
        waveform: "sine",
        peakGain: 0.14,
      },
    ]);
    this.vibrate(25);
  }

  /** Mikrofon kaydı bitti (880→600Hz bip) */
  playRecordStop() {
    this.playNotes([
      {
        frequency: 880,
        startOffset: 0.0,
        duration: 0.06,
        waveform: "sine",
        peakGain: 0.14,
      },
      {
        frequency: 600,
        startOffset: 0.05,
        duration: 0.08,
        waveform: "sine",
        peakGain: 0.14,
      },
    ]);
    this.vibrate(15);
  }

  /**
   * 5. Set / Bölüm Tamamlama (`tebrikler.mp3` ve `basari.mp3`)
   * Yüksek başarıda (`>= 75` veya parametre verilmediğinde) `tebrikler.mp3`,
   * standart tamamlamada (`< 75`) `basari.mp3` çalar.
   */
  playFanfare(scorePercent?: number) {
    if (!this.canPlay()) return;
    const isHighSuccess =
      scorePercent === undefined || scorePercent >= 75;
    const fanfareFile = isHighSuccess
      ? EFECT_FILES.fanfareHigh
      : EFECT_FILES.fanfareStandard;

    this.playMp3WithFallback(
      fanfareFile,
      isHighSuccess ? 0.6 : 0.55,
      () => {
        this.playNotes([
          {
            frequency: 523.25,
            startOffset: 0.0,
            duration: 0.1,
            waveform: "sine",
            peakGain: 0.16,
          },
          {
            frequency: 659.25,
            startOffset: 0.1,
            duration: 0.1,
            waveform: "sine",
            peakGain: 0.16,
          },
          {
            frequency: 783.99,
            startOffset: 0.2,
            duration: 0.1,
            waveform: "sine",
            peakGain: 0.16,
          },
          {
            frequency: 1046.5,
            startOffset: 0.3,
            duration: 0.35,
            waveform: "sine",
            peakGain: 0.2,
          },
        ]);
      }
    );
    this.vibrate([30, 40, 30, 40, 50]);
  }
}

// Singleton
export const sfx = new SoundEffectsManager();

// Kısayol export'ları
export const playClick = () => sfx.playClick();
export const playFlip = () => sfx.playFlip();
export const playStart = () => sfx.playStart();
export const playCorrect = (options?: PlayCorrectOptions) =>
  sfx.playCorrect(options);
export const playSuccess = (options?: PlayCorrectOptions) =>
  sfx.playSuccess(options);
export const playPartial = () => sfx.playPartial();
export const playWrong = () => sfx.playWrong();
export const playError = () => sfx.playError();
export const playRecordStart = () => sfx.playRecordStart();
export const playRecordStop = () => sfx.playRecordStop();
export const playFanfare = (scorePercent?: number) =>
  sfx.playFanfare(scorePercent);