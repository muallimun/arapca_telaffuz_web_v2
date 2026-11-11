"use client";

import { useState, useMemo } from "react";
import {
  X,
  Users,
  Volume2,
  Printer,
  CheckCircle2,
  Eye,
  RotateCcw,
  Award,
  MessageSquare,
} from "lucide-react";
import { Dialogue } from "@/types/data";
import { DialogueVocabularyEntry } from "@/lib/dict";
import {
  buildInfoGapPairCards,
  PAIR_SPEAKING_RUBRIC_CRITERIA,
  StudentCardLineView,
} from "@/lib/infoGapBuilder";
import { useSettings } from "@/store/settings";
import { formatArabicByHarekeMode } from "@/lib/arabicTextUtils";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import { playClick, playSuccess } from "@/lib/sfxManager";
import MixedText from "@/components/ui/MixedText";

interface InfoGapPairModalProps {
  dialogue: Dialogue;
  vocabEntries: DialogueVocabularyEntry[];
  onClose: () => void;
  onOpenPrintPairSheet?: () => void;
}

type PairTabMode = "student-a" | "student-b" | "side-by-side";

export default function InfoGapPairModal({
  dialogue,
  vocabEntries,
  onClose,
  onOpenPrintPairSheet,
}: InfoGapPairModalProps) {
  const { harekeMode, arabicFont, speechRate, preferredVoiceGender } =
    useSettings();

  const [activeTab, setActiveTab] = useState<PairTabMode>("student-a");
  const [showRubricPanel, setShowRubricPanel] = useState<boolean>(false);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({
    intelligibility: 20,
    questioning: 20,
    vocabulary: 20,
    task_completion: 20,
  });

  const deck = useMemo(
    () => buildInfoGapPairCards(dialogue, vocabEntries),
    [dialogue, vocabEntries]
  );

  const totalRubricScore = useMemo(
    () =>
      PAIR_SPEAKING_RUBRIC_CRITERIA.reduce(
        (sum, c) => sum + (rubricScores[c.id] ?? 0),
        0
      ),
    [rubricScores]
  );

  const formatAr = (text: string) =>
    formatArabicByHarekeMode(text, harekeMode, arabicFont);

  const handlePlayLine = (arabicText: string, sira: number) => {
    playClick();
    stopAllAudio();
    void speakHybrid({
      text: arabicText,
      voice: preferredVoiceGender,
      rate: speechRate,
      dialogueId: dialogue.id,
      lineSira: sira,
    });
  };

  const renderStudentCardColumn = (
    role: "A" | "B",
    items: StudentCardLineView[]
  ) => {
    const isA = role === "A";
    return (
      <div className="rounded-3xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] overflow-hidden shadow-sm">
        {/* Kart Başlığı */}
        <div
          className={`px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-white ${
            isA
              ? "bg-gradient-to-r from-[#087F5B] to-teal-700"
              : "bg-gradient-to-r from-[#6741D9] to-indigo-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-white/20 text-xs sm:text-sm font-black">
              {isA ? "🅰️ ÖĞRENCİ A KARTI" : "🅱️ ÖĞRENCİ B KARTI"}
            </span>
            <span className="text-xs font-bold text-white/90">
              {isA
                ? "Tek cümleler sizde tam; çift cümleleri arkadaşınızdan öğrenin"
                : "Çift cümleler sizde tam; tek cümleleri arkadaşınızdan öğrenin"}
            </span>
          </div>
          <span
            dir="rtl"
            lang="ar"
            className="arabic text-base sm:text-lg font-bold text-amber-200 leading-[1.95]"
          >
            {isA ? "بِطَاقَةُ الطَّالِبِ (أ)" : "بِطَاقَةُ الطَّالِبِ (ب)"}
          </span>
        </div>

        {/* Cümle Satırları */}
        <div className="divide-y divide-[#E6D7BE]/80 dark:divide-[var(--border)]">
          {items.map((line) => (
            <div
              key={`${role}-${line.lineNumber}`}
              className={`p-3.5 sm:p-4 space-y-2 transition-colors ${
                line.isFull
                  ? "bg-[#FDFBF7] dark:bg-[var(--surface)]"
                  : "bg-amber-50/55 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                      line.isFull
                        ? "bg-emerald-100 dark:bg-emerald-950 text-[#065F46] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700"
                    }`}
                  >
                    #{line.lineNumber} •{" "}
                    {line.isFull
                      ? "🎙️ Sıra Sizde (Sesli Okuyun)"
                      : "❓ Bilgi Boşluğu (Dinleyip Tamamlayın)"}
                  </span>
                  <span className="text-xs font-extrabold text-[var(--foreground)]">
                    {line.speakerTr}
                  </span>
                </div>

                {line.isFull && (
                  <button
                    type="button"
                    onClick={() =>
                      handlePlayLine(line.displayArabic, line.sira)
                    }
                    className="min-h-[48px] px-3 rounded-xl bg-[#087F5B]/12 hover:bg-[#087F5B]/20 border border-[#087F5B]/40 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 size={15} />
                    <span>Dinle</span>
                  </button>
                )}
              </div>

              {/* Arapça Cümle (RTL + leading-[1.95]) */}
              <div
                dir="rtl"
                lang="ar"
                className="arabic text-xl sm:text-2xl font-bold text-[var(--foreground)] leading-[1.95] text-right"
              >
                <span className="text-sm font-bold text-[#065F46] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/60 rounded-lg px-2 py-0.5 ml-2">
                  {formatAr(line.speakerAr)}:
                </span>
                {formatAr(line.displayArabic)}
              </div>

              {/* Türkçe Çeviri veya İletişimsel İpucu */}
              <div
                className={`text-xs sm:text-sm font-semibold rounded-xl px-3 py-2 ${
                  line.isFull
                    ? "bg-[#F7EFE1]/80 dark:bg-slate-800/70 text-[var(--muted)]"
                    : "bg-amber-100/80 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 border border-dashed border-amber-400/70"
                }`}
              >
                <MixedText text={line.displayTurkishCue} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl max-h-[94vh] rounded-3xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Üst Başlık Çubuğu */}
        <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                  🗣️ İkili Bilgi Boşluğu Kartları (A / B Eşli Konuşma)
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-[#6741D9] text-white text-[11px] font-extrabold">
                  CEFR {deck.level}
                </span>
              </div>
              <p className="text-xs font-semibold text-[var(--muted)]">
                {deck.titleTr} • İki öğrenci birbirinin ekranına bakmadan eksik bilgileri Arapça sorup tamamlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenPrintPairSheet && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  onOpenPrintPairSheet();
                }}
                className="min-h-[48px] px-3.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-[#065F46] flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer size={15} />
                <span>✂️ A4 Eşli Kart Yazdır (A &amp; B)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                playClick();
                setShowRubricPanel((v) => !v);
              }}
              className={`min-h-[48px] px-3.5 rounded-xl border-2 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all ${
                showRubricPanel
                  ? "bg-[#6741D9] border-[#5230B5] text-white"
                  : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
              }`}
            >
              <Award size={15} />
              <span>📊 Öğretmen Rubriği ({totalRubricScore}/100)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClick();
                onClose();
              }}
              aria-label="Kapat"
              className="min-w-[48px] min-h-[48px] rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Rol Sekmeleri: [🅰️ Öğrenci A Ekranı] [🅱️ Öğrenci B Ekranı] [👀 Yan Yana Tahta/Öğretmen Görünümü] */}
        <div className="bg-[#FDFBF7] dark:bg-[var(--surface)] px-4 sm:px-5 py-2.5 border-b border-[#E6D7BE] dark:border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveTab("student-a");
            }}
            className={`min-h-[48px] px-3 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "student-a"
                ? "bg-[#087F5B] border-[#065F46] text-white shadow-sm"
                : "bg-[#F7EFE1] dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <span>🅰️ Öğrenci A Ekranı</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveTab("student-b");
            }}
            className={`min-h-[48px] px-3 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "student-b"
                ? "bg-[#6741D9] border-[#5230B5] text-white shadow-sm"
                : "bg-[#F7EFE1] dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <span>🅱️ Öğrenci B Ekranı</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClick();
              setActiveTab("side-by-side");
            }}
            className={`min-h-[48px] px-3 rounded-2xl border-2 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "side-by-side"
                ? "bg-amber-600 border-amber-800 text-white shadow-sm"
                : "bg-[#F7EFE1] dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <Eye size={16} />
            <span>👀 Yan Yana Tahta / Öğretmen Görünümü</span>
          </button>
        </div>

        {/* Kaydırılabilir İçerik Alanı */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4">
          {/* Öğretmen Konuşma Değerlendirme Rubriği (Açık ise) */}
          {showRubricPanel && (
            <section className="rounded-3xl bg-[#F3F0FF] dark:bg-violet-950/35 border-2 border-[#6741D9]/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#6741D9]/25 pb-2.5">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-[#6741D9]" />
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#4C28B5] dark:text-violet-200">
                    📊 Öğretmen İkili Konuşma Değerlendirme Rubriği (4 Ölçüt × 25 = 100 Puan)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-[#6741D9] text-white text-xs font-black tabular-nums">
                    Toplam Puan: {totalRubricScore} / 100
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setRubricScores({
                        intelligibility: 20,
                        questioning: 20,
                        vocabulary: 20,
                        task_completion: 20,
                      });
                    }}
                    className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-[#6741D9]/40 text-xs font-extrabold text-[#4C28B5] dark:text-violet-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>Sıfırla</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PAIR_SPEAKING_RUBRIC_CRITERIA.map((crit) => {
                  const val = rubricScores[crit.id] ?? 20;
                  return (
                    <div
                      key={crit.id}
                      className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#D0BFFF] dark:border-violet-800 p-3 space-y-2"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                          {crit.titleTr}
                        </span>
                        <span
                          dir="rtl"
                          lang="ar"
                          className="arabic text-base font-bold text-[#065F46] dark:text-emerald-400 leading-[1.95]"
                        >
                          {crit.titleAr}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        {crit.descriptionTr}
                      </p>
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[
                          { pts: 10, label: "Gelişmeli (10)" },
                          { pts: 15, label: "Orta (15)" },
                          { pts: 20, label: "İyi (20)" },
                          { pts: 25, label: "Yetkin (25)" },
                        ].map((tier) => (
                          <button
                            key={tier.pts}
                            type="button"
                            onClick={() => {
                              playSuccess();
                              setRubricScores((prev) => ({
                                ...prev,
                                [crit.id]: tier.pts,
                              }));
                            }}
                            className={`min-h-[48px] px-1.5 rounded-xl border text-[11px] font-extrabold transition-all cursor-pointer ${
                              val === tier.pts
                                ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                                : "bg-[#FDFBF7] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                            }`}
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Aktif Sekme Görünümü */}
          {activeTab === "student-a" &&
            renderStudentCardColumn("A", deck.studentACard)}

          {activeTab === "student-b" &&
            renderStudentCardColumn("B", deck.studentBCard)}

          {activeTab === "side-by-side" && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#065F46] dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>
                    Öğretmen Kontrol Görünümü: A ve B kartlarının tamamlayıcı dağılımını ve gizlenen hedef kelimeleri aşağıda inceleyebilirsiniz.
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderStudentCardColumn("A", deck.studentACard)}
                {renderStudentCardColumn("B", deck.studentBCard)}
              </div>

              {/* Öğretmen Hızlı Gizli Kelime Çözüm Özeti */}
              <div className="rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B]/40 p-4 space-y-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-[#065F46] dark:text-emerald-300">
                  🔑 Gizlenen Hedef Kelimeler (Öğretmen Anahtarı)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {deck.lines.map((ln) => (
                    <div
                      key={ln.lineNumber}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-slate-800 border border-[#E6D7BE] dark:border-slate-700 text-xs font-bold"
                    >
                      <span className="text-[var(--muted)]">
                        #{ln.lineNumber} ({ln.lineNumber % 2 === 1 ? "B boş" : "A boş"}):
                      </span>
                      <span
                        dir="rtl"
                        lang="ar"
                        className="arabic text-lg font-bold text-[#065F46] dark:text-emerald-300 leading-[1.95]"
                      >
                        {formatAr(ln.hiddenWordsAr.join(" ، "))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
