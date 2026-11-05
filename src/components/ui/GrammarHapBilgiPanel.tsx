"use client";

import React, { useState } from "react";
import { GramerHapBilgi } from "@/types/data";
import WordTooltip from "@/components/ui/WordTooltip";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import { useSettings } from "@/store/settings";
import {
  BookOpen,
  Sparkles,
  Volume2,
  Mic,
  Lightbulb,
  Target,
  X,
} from "lucide-react";

interface GrammarHapBilgiPanelProps {
  grammarNote: GramerHapBilgi;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
}

export function GrammarHapBilgiPanel({
  grammarNote,
  onOpenShadowing,
}: GrammarHapBilgiPanelProps) {
  const { speechRate } = useSettings();
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const handleListen = async (text: string, key: string) => {
    if (playingKey === key) {
      stopAllAudio();
      setPlayingKey(null);
      return;
    }
    setPlayingKey(key);
    try {
      await speakHybrid({ text, rate: speechRate });
    } finally {
      setPlayingKey((prev) => (prev === key ? null : prev));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. ÜST BAŞLIK VE TEMEL GRAMER KURALI (HAP KURAL) KARTI */}
      <div className="bg-gradient-to-br from-[#F7EFE1] to-[#EFE5D4] dark:from-[var(--surface)] dark:to-[var(--background)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black text-[11px] uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Odak Gramer &amp; Hap Bilgi</span>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-white/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-extrabold text-[11px]">
            İçerik: {grammarNote.bagli_id.toUpperCase()}
          </span>
        </div>

        <h2 className="text-lg sm:text-2xl font-black text-[var(--foreground)] tracking-tight mb-3.5 leading-snug">
          {grammarNote.konu_basligi}
        </h2>

        <div className="bg-white/95 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400/70 flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-[#087F5B] dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#087F5B] dark:text-emerald-400 block mb-1">
                Temel Gramer Kuralı (Hap Kural)
              </span>
              <p className="text-sm sm:text-base font-bold text-[var(--foreground)] leading-relaxed break-words">
                {grammarNote.hap_kural}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. İÇERİKTEN ODAK ÖRNEK KARTI */}
      {grammarNote.metinden_ornek && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs space-y-3.5">
          {/* Üst Bar: Sol tarafta rozet, sağ tarafta Dinle ve Telaffuz Et butonları */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/70 text-[#6741D9] dark:text-indigo-200 border border-[#6741D9]/35 font-black text-[11px] sm:text-xs uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>🎯 İÇERİKTEN ODAK ÖRNEK</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  handleListen(
                    grammarNote.metinden_ornek.arapca,
                    "main-example"
                  )
                }
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-extrabold text-xs border-2 border-b-3 active:translate-y-[1px] transition-all cursor-pointer ${
                  playingKey === "main-example"
                    ? "bg-[#087F5B] text-white border-[#065F46]"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]"
                }`}
                title="Örnek cümleyi dinle"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#087F5B] dark:text-emerald-400 shrink-0" />
                <span>
                  {playingKey === "main-example" ? "Dinleniyor..." : "🔊 Dinle"}
                </span>
              </button>

              {onOpenShadowing && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenShadowing(
                      grammarNote.metinden_ornek.arapca,
                      grammarNote.metinden_ornek.turkce
                    )
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 border-b-3 active:translate-y-[1px] font-extrabold text-xs transition-all cursor-pointer"
                  title="Telaffuz koçu ile dene"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>🎙️ Telaffuz Et</span>
                </button>
              )}
            </div>
          </div>

          {/* Gövde Kutusu: Arapça Örnek Cümle + Türkçe Çevirisi */}
          <div className="bg-white/90 dark:bg-[var(--background)] rounded-2xl p-4 sm:p-5 border border-[#E6D7BE] dark:border-[var(--border)] space-y-3.5 overflow-hidden">
            {/* 1. Arapça Örnek Cümle */}
            <div
              dir="rtl"
              className="arabic font-arabic text-xl sm:text-2xl md:text-3xl leading-[2.1] font-bold text-[#065F46] dark:text-emerald-400 text-right break-words"
            >
              <WordTooltip
                text={grammarNote.metinden_ornek.arapca}
                contextSentenceTr={grammarNote.metinden_ornek.turkce}
              />
            </div>

            {/* 2. Türkçe Çevirisi */}
            <div className="border-l-4 border-[#087F5B] pl-3 py-1 bg-[#F7EFE1]/55 dark:bg-[var(--surface)]/60 rounded-r-xl">
              <p className="text-sm sm:text-base font-medium text-[var(--foreground)] leading-relaxed break-words">
                “{grammarNote.metinden_ornek.turkce}”
              </p>
            </div>
          </div>

          {/* Gramer Analizi Kutusu */}
          {grammarNote.metinden_ornek.aciklama && (
            <div className="bg-sky-50/90 dark:bg-sky-950/40 border-2 border-sky-200 dark:border-sky-800/70 rounded-xl p-3.5 sm:p-4 text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200 leading-relaxed break-words">
              <span className="font-black uppercase text-[11px] tracking-wider block text-sky-800 dark:text-sky-300 mb-1">
                🔍 Gramer Analizi:
              </span>
              {grammarNote.metinden_ornek.aciklama}
            </div>
          )}
        </div>
      )}

      {/* 3. PEKİŞTİRİCİ EK ÖRNEKLER */}
      {grammarNote.ek_ornekler && grammarNote.ek_ornekler.length > 0 && (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 shadow-xs">
          <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#087F5B] dark:text-emerald-400 shrink-0" />
            <span>Pekiştirici Ek Örnekler</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {grammarNote.ek_ornekler.map((ex, i) => {
              const key = `extra-${i}`;
              return (
                <div
                  key={i}
                  className="bg-white/90 dark:bg-[var(--background)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col justify-between gap-3 hover:border-[#087F5B] transition-colors overflow-hidden"
                >
                  <div className="space-y-2">
                    <div
                      dir="rtl"
                      className="arabic font-arabic text-xl sm:text-2xl font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[2.0] break-words"
                    >
                      <WordTooltip
                        text={ex.arapca}
                        contextSentenceTr={ex.turkce}
                      />
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[var(--foreground)] border-l-3 border-[#6741D9] pl-2.5 py-0.5 break-words">
                      {ex.turkce}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => handleListen(ex.arapca, key)}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-extrabold text-xs border-2 transition-all cursor-pointer ${
                        playingKey === key
                          ? "bg-[#087F5B] text-white border-[#065F46]"
                          : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--foreground)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]"
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{playingKey === key ? "Dinleniyor" : "Dinle"}</span>
                    </button>
                    {onOpenShadowing && (
                      <button
                        type="button"
                        onClick={() => onOpenShadowing(ex.arapca, ex.turkce)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700 font-extrabold text-xs transition-all cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Telaffuz</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PRATİK ÖĞRENME İPUCU */}
      {grammarNote.ipucu && (
        <div className="bg-amber-50/90 dark:bg-amber-950/40 rounded-2xl sm:rounded-3xl border-2 border-amber-300 dark:border-amber-700 border-b-4 p-4 sm:p-5 shadow-xs flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 dark:bg-amber-900/70 border border-amber-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5 text-amber-800 dark:text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-300 block mb-1">
              💡 Pratik Öğrenme İpucu
            </span>
            <p className="text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 leading-relaxed break-words">
              {grammarNote.ipucu}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface GrammarHapBilgiModalProps {
  isOpen: boolean;
  onClose: () => void;
  grammarNote: GramerHapBilgi;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
}

export function GrammarHapBilgiModal({
  isOpen,
  onClose,
  grammarNote,
  onOpenShadowing,
}: GrammarHapBilgiModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FDFBF7] dark:bg-[var(--background)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b-2 border-[#E6D7BE] dark:border-[var(--border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 border border-amber-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-[var(--foreground)] truncate">
                Odak Gramer &amp; Hap Bilgi Notu
              </h3>
              <p className="text-xs font-bold text-[var(--muted)] truncate">
                {grammarNote.konu_basligi}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-400 flex items-center justify-center text-[var(--foreground)] hover:text-rose-600 transition-colors cursor-pointer shrink-0"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <GrammarHapBilgiPanel
          grammarNote={grammarNote}
          onOpenShadowing={(ar, tr) => {
            onClose();
            if (onOpenShadowing) onOpenShadowing(ar, tr);
          }}
        />
      </div>
    </div>
  );
}
