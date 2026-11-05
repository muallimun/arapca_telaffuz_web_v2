"use client";

import React, { useState } from "react";
import { GramerHapBilgi } from "@/types/data";
import WordTooltip from "@/components/ui/WordTooltip";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import { useSettings } from "@/store/settings";
import { BookOpen, Sparkles, Volume2, Mic, Lightbulb, CheckCircle2, X } from "lucide-react";

interface GrammarHapBilgiPanelProps {
  grammarNote: GramerHapBilgi;
  onOpenShadowing?: (arabicText: string, turkishText?: string) => void;
}

export function GrammarHapBilgiPanel({ grammarNote, onOpenShadowing }: GrammarHapBilgiPanelProps) {
  const { speechRate, arabicFontSize } = useSettings();
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header & Core Rule Card */}
      <div className="bg-gradient-to-br from-[#F7F3EC] to-[#EFE8DC] rounded-[2rem] border-2 border-[#E2D9C8] border-b-[6px] p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 border-2 border-amber-300 font-black text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-amber-600" /> Odak Gramer & Hap Bilgi
          </span>
          <span className="px-3 py-1 rounded-xl bg-white/80 border border-[#E2D9C8] text-[#7A7164] font-black text-xs">
            İçerik: {grammarNote.bagli_id.toUpperCase()}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-[#1C1E21] tracking-tight mb-4">
          {grammarNote.konu_basligi}
        </h2>

        <div className="bg-white/90 rounded-2xl p-5 border-2 border-[#E2D9C8] shadow-inner">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D1F2E8] border-2 border-[#00B884] flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-[#007A56]" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-[#007A56] block mb-1">
                Temel Gramer Kuralı (Hap Kural)
              </span>
              <p className="text-base sm:text-lg font-bold text-[#1C1E21] leading-relaxed">
                {grammarNote.hap_kural}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Example from the Dialogue / Text */}
      {grammarNote.metinden_ornek && (
        <div className="bg-white rounded-[2rem] border-2 border-[#E2D9C8] border-b-[6px] p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-[#EDE5F8] text-[#582C83] border-2 border-[#D4BEEF] font-black text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" /> İçerikten Odak Örnek
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleListen(grammarNote.metinden_ornek.arapca, "main-example")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-xs border-2 border-b-[3px] active:border-b-2 active:translate-y-[1px] transition-all cursor-pointer ${
                  playingKey === "main-example"
                    ? "bg-[#00B884] text-white border-[#008A63]"
                    : "bg-[#F7F3EC] text-[#1C1E21] border-[#E2D9C8] hover:border-[#00B884]"
                }`}
                title="Örnek cümleyi dinle"
              >
                <Volume2 className="w-4 h-4" />
                {playingKey === "main-example" ? "Dinleniyor..." : "Dinle"}
              </button>
              {onOpenShadowing && (
                <button
                  onClick={() =>
                    onOpenShadowing(
                      grammarNote.metinden_ornek.arapca,
                      grammarNote.metinden_ornek.turkce
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 border-b-[3px] active:border-b-2 active:translate-y-[1px] font-black text-xs transition-all cursor-pointer"
                  title="Telaffuz koçu ile dene"
                >
                  <Mic className="w-4 h-4 text-amber-600" /> Telaffuz Et
                </button>
              )}
            </div>
          </div>

          <div
            dir="rtl"
            className="font-arabic font-bold text-[#1C1E21] bg-[#FAF8F5] rounded-2xl p-5 border-2 border-[#EBE4D8] mb-4 leading-[2.1] text-right"
            style={{ fontSize: `${Math.max(1.5, arabicFontSize * 0.9)}rem` }}
          >
            <WordTooltip
              text={grammarNote.metinden_ornek.arapca}
              contextSentenceTr={grammarNote.metinden_ornek.turkce}
            />
          </div>

          <p className="text-base sm:text-lg font-black text-[#2B2D31] mb-3">
            “{grammarNote.metinden_ornek.turkce}”
          </p>

          {grammarNote.metinden_ornek.aciklama && (
            <div className="bg-[#F4F8FB] border-2 border-[#CBDDF0] rounded-xl p-4 text-sm sm:text-base font-bold text-[#2C4A6F] leading-relaxed">
              <span className="font-black uppercase text-xs tracking-wider block text-[#1D3B5E] mb-1">
                Gramer Analizi:
              </span>
              {grammarNote.metinden_ornek.aciklama}
            </div>
          )}
        </div>
      )}

      {/* Additional Examples */}
      {grammarNote.ek_ornekler && grammarNote.ek_ornekler.length > 0 && (
        <div className="bg-white rounded-[2rem] border-2 border-[#E2D9C8] border-b-[6px] p-6 sm:p-8 shadow-sm">
          <h3 className="text-lg font-black text-[#1C1E21] uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#00B884]" /> Pekiştirici Ek Örnekler
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grammarNote.ek_ornekler.map((ex, i) => {
              const key = `extra-${i}`;
              return (
                <div
                  key={i}
                  className="bg-[#FAF8F5] rounded-2xl border-2 border-[#E2D9C8] p-5 flex flex-col justify-between gap-3 hover:border-[#00B884] transition-colors"
                >
                  <div>
                    <div
                      dir="rtl"
                      className="font-arabic font-bold text-[#1C1E21] text-right leading-[2] mb-2"
                      style={{ fontSize: `${Math.max(1.35, arabicFontSize * 0.8)}rem` }}
                    >
                      <WordTooltip
                        text={ex.arapca}
                        contextSentenceTr={ex.turkce}
                      />
                    </div>
                    <p className="text-sm sm:text-base font-bold text-[#5C5446]">{ex.turkce}</p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EBE4D8]">
                    <button
                      onClick={() => handleListen(ex.arapca, key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs border-2 transition-all cursor-pointer ${
                        playingKey === key
                          ? "bg-[#00B884] text-white border-[#008A63]"
                          : "bg-white text-[#1C1E21] border-[#E2D9C8] hover:border-[#00B884]"
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {playingKey === key ? "Dinleniyor" : "Dinle"}
                    </button>
                    {onOpenShadowing && (
                      <button
                        onClick={() => onOpenShadowing(ex.arapca, ex.turkce)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 font-black text-xs transition-all cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5 text-amber-600" /> Telaffuz
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Practical Tip (Ipucu) */}
      {grammarNote.ipucu && (
        <div className="bg-amber-50/90 rounded-[2rem] border-2 border-amber-300 border-b-[5px] p-6 shadow-sm flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-200/80 border-2 border-amber-400 flex items-center justify-center shrink-0">
            <Lightbulb className="w-6 h-6 text-amber-800" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-amber-800 block mb-1">
              Pratik Öğrenme İpucu
            </span>
            <p className="text-sm sm:text-base font-bold text-amber-950 leading-relaxed">
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF8F5] rounded-[2.2rem] border-2 border-[#E2D9C8] border-b-[8px] max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b-2 border-[#E2D9C8]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#1C1E21]">
                Odak Gramer & Hap Bilgi Notu
              </h3>
              <p className="text-xs font-bold text-[#7A7164]">{grammarNote.konu_basligi}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E2D9C8] hover:border-rose-400 flex items-center justify-center text-[#5C5446] hover:text-rose-600 transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
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
