"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Trophy,
  Award,
  BarChart3,
  AlertTriangle,
  Volume2,
  Target,
  Printer,
  Flame,
  Clock,
  Star,
  Headphones,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  useUserStore,
  getTodayDateString,
  getYesterdayDateString,
} from "@/store/userStore";
import { useSettings } from "@/store/settings";
import {
  computeLearningAnalyticsSnapshot,
  readStoredLastExerciseSummary,
  FrequentMistakeRow,
} from "@/lib/learningAnalytics";
import {
  playDualGenderAudio,
  speakHybrid,
  stopAllAudio,
} from "@/lib/audio";
import { playClick } from "@/lib/sfxManager";
import { formatArabicByHarekeMode } from "@/lib/arabicTextUtils";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);

export type StatsModalTab = "badges" | "charts" | "mistakes";

export interface StatsAndBadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: StatsModalTab;
}

type MistakeFilterKind = "all" | "word" | "sentence" | "phoneme";

function escapeReportHtml(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function SvgProgressBar({
  percent,
  variant = "emerald",
}: {
  percent: number;
  variant?: "emerald" | "purple" | "amber" | "slate" | "rose";
}) {
  const safePct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const fillClass =
    variant === "purple"
      ? "fill-[#6741D9]"
      : variant === "amber"
      ? "fill-amber-500"
      : variant === "rose"
      ? "fill-rose-500"
      : variant === "slate"
      ? "fill-slate-400 dark:fill-slate-500"
      : "fill-[#087F5B]";

  return (
    <svg
      viewBox="0 0 100 6"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="w-full h-2 rounded-full bg-[#EFE5D2] dark:bg-slate-800 overflow-hidden block"
    >
      {safePct > 0 && (
        <rect
          x={0}
          y={0}
          width={safePct}
          height={6}
          rx={3}
          className={fillClass}
        />
      )}
    </svg>
  );
}

export default function StatsAndBadgesModal({
  isOpen,
  onClose,
  initialTab = "badges",
}: StatsAndBadgesModalProps) {
  const router = useRouter();
  const [tabOverride, setTabOverride] = useState<{
    forInitial: StatsModalTab;
    tab: StatsModalTab;
  } | null>(null);
  const activeTab: StatsModalTab =
    tabOverride && tabOverride.forInitial === initialTab
      ? tabOverride.tab
      : initialTab;
  const [mistakeFilter, setMistakeFilter] = useState<MistakeFilterKind>("all");
  const [playingRowId, setPlayingRowId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [shadowingTargetAr, setShadowingTargetAr] = useState<string | null>(
    null
  );

  const handleCloseModal = useCallback(() => {
    setTabOverride(null);
    stopAllAudio();
    onClose();
  }, [onClose]);

  const {
    completedDialogues,
    learnedWords,
    favoriteWords,
    weakWords,
    mistakeIds,
    srsRecords,
    pronunciationScores,
    pronunciationHistory,
    totalPronunciationAttempts,
    studyMinutes,
    activityXp,
    streakDays,
    lastStudyDate,
    dailyGoalMinutes,
    topicMastery,
    skillStats,
    completedLevelExams,
    phonemeStats,
    watchedVideos,
  } = useUserStore();

  const {
    speechRate,
    showHareke,
    harekeMode,
    arabicFont,
    preferredVoiceGender,
  } = useSettings();

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !shadowingTargetAr) {
        handleCloseModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      stopAllAudio();
    };
  }, [isOpen, handleCloseModal, shadowingTargetAr]);

  const storedLastExercise = useMemo(() => {
    if (!isOpen) return null;
    return readStoredLastExerciseSummary();
  }, [isOpen]);

  const snapshot = useMemo(() => {
    return computeLearningAnalyticsSnapshot({
      completedDialogues: completedDialogues || [],
      learnedWords: learnedWords || [],
      favoriteWords: favoriteWords || [],
      weakWords: weakWords || [],
      mistakeIds: mistakeIds || [],
      srsRecords: srsRecords || {},
      pronunciationScores: pronunciationScores || [],
      pronunciationHistory: pronunciationHistory || [],
      totalPronunciationAttempts: totalPronunciationAttempts || 0,
      studyMinutes: studyMinutes || 0,
      activityXp: activityXp || 0,
      streakDays: streakDays || 0,
      lastStudyDate: lastStudyDate || "",
      todayStr: getTodayDateString(),
      yesterdayStr: getYesterdayDateString(),
      dailyGoalMinutes: dailyGoalMinutes || 15,
      topicMastery: topicMastery || {},
      skillStats: skillStats || {
        kelime: { correct: 0, total: 0 },
        gramer: { correct: 0, total: 0 },
        okuma: { correct: 0, total: 0 },
        dinleme: { correct: 0, total: 0 },
        telaffuz: { correct: 0, total: 0 },
        imla: { correct: 0, total: 0 },
      },
      completedLevelExams: completedLevelExams || [],
      phonemeStats: phonemeStats || {},
      watchedVideos: watchedVideos || [],
      storedLastExercise,
    });
  }, [
    completedDialogues,
    learnedWords,
    favoriteWords,
    weakWords,
    mistakeIds,
    srsRecords,
    pronunciationScores,
    pronunciationHistory,
    totalPronunciationAttempts,
    studyMinutes,
    activityXp,
    streakDays,
    lastStudyDate,
    dailyGoalMinutes,
    topicMastery,
    skillStats,
    completedLevelExams,
    phonemeStats,
    watchedVideos,
    storedLastExercise,
  ]);

  const displayArabic = useCallback(
    (txt: string) =>
      formatArabicByHarekeMode(
        txt,
        harekeMode || (showHareke ? "full" : "none"),
        arabicFont || "arakom"
      ),
    [harekeMode, showHareke, arabicFont]
  );

  const filteredMistakes = useMemo(() => {
    if (mistakeFilter === "all") return snapshot.frequentMistakes;
    return snapshot.frequentMistakes.filter((m) => m.kind === mistakeFilter);
  }, [snapshot.frequentMistakes, mistakeFilter]);

  const handleListenMistakeRow = useCallback(
    async (row: FrequentMistakeRow) => {
      playClick();
      setPlayingRowId(row.uid);
      try {
        const rate = speechRate || 1;
        if (row.dialogueId && row.lineSira !== undefined) {
          await speakHybrid({
            text: row.shadowingSampleAr || row.arabicText,
            rate,
            voice: preferredVoiceGender || "erkek",
            dialogueId: row.dialogueId,
            lineSira: row.lineSira,
          });
        } else if (row.sesErkek || row.sesKadin || row.audioItemId) {
          await playDualGenderAudio({
            text: row.shadowingSampleAr || row.arabicText,
            id: row.audioItemId,
            ses_erkek: row.sesErkek,
            ses_kadin: row.sesKadin,
            gender: preferredVoiceGender || "erkek",
            rate,
          });
        } else {
          await speakHybrid({
            text: row.shadowingSampleAr || row.arabicText,
            rate,
            voice: preferredVoiceGender || "erkek",
          });
        }
      } finally {
        setPlayingRowId((cur) => (cur === row.uid ? null : cur));
      }
    },
    [speechRate, preferredVoiceGender]
  );

  const handlePracticeMistakeRow = useCallback(
    (row: FrequentMistakeRow) => {
      playClick();
      stopAllAudio();
      if (row.kind === "phoneme" && row.shadowingSampleAr) {
        setShadowingTargetAr(row.shadowingSampleAr);
        return;
      }
      const targetHref = row.practiceHref || "/alistirmalar?pool=mistakes";
      onClose();
      router.push(targetHref);
    },
    [onClose, router]
  );

  // Gizli iframe üzerinden vektörel A4 Öğretmen / Öğrenci Gelişim Raporu yazdırma
  const handlePrintTeacherReport = useCallback(() => {
    if (typeof document === "undefined") return;
    playClick();

    const safeStudent = escapeReportHtml(
      studentName.trim() || "Belirtilmedi (Öğrenci)"
    );
    const safeClass = escapeReportHtml(
      studentClass.trim() || "Genel Arapça Kuru"
    );
    const dateLabel = new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date());

    const badgeRowsHtml = snapshot.badges
      .map(
        (b) => `
        <tr>
          <td style="font-weight:700;">${escapeReportHtml(b.icon)} ${escapeReportHtml(b.title)}</td>
          <td>${escapeReportHtml(b.description)}</td>
          <td style="text-align:center;font-weight:700;">${b.current} / ${b.target}</td>
          <td style="text-align:center;font-weight:800;color:${
            b.unlocked ? "#065F46" : "#64748B"
          };">${escapeReportHtml(b.statusTag)}</td>
        </tr>`
      )
      .join("");

    const cefrRowsHtml = snapshot.cefrProgress
      .map(
        (c) => `
        <tr>
          <td style="font-weight:800;">${escapeReportHtml(c.titleTr)}</td>
          <td style="text-align:center;">${c.dialoguesDone} / ${c.dialoguesTotal}</td>
          <td style="text-align:center;">${c.readingsDone} / ${c.readingsTotal}</td>
          <td style="text-align:center;font-weight:800;color:#065F46;">%${c.percent}</td>
        </tr>`
      )
      .join("");

    const moduleRowsHtml = snapshot.moduleProgress
      .map(
        (m) => `
        <tr>
          <td style="font-weight:700;">${escapeReportHtml(m.title)}</td>
          <td dir="rtl" lang="ar" class="ar" style="text-align:right;">${escapeReportHtml(
            m.arabicLabel
          )}</td>
          <td style="text-align:center;">${m.completed} / ${m.total}</td>
          <td style="text-align:center;font-weight:800;color:#6741D9;">%${m.percent}</td>
        </tr>`
      )
      .join("");

    const topMistakesSlice = snapshot.frequentMistakes.slice(0, 12);
    const mistakeRowsHtml =
      topMistakesSlice.length > 0
        ? topMistakesSlice
            .map(
              (m, idx) => `
          <tr>
            <td style="text-align:center;font-weight:700;">${idx + 1}</td>
            <td>${escapeReportHtml(m.kindLabel)}</td>
            <td dir="rtl" lang="ar" class="ar" style="font-size:15pt;font-weight:700;text-align:right;">${escapeReportHtml(
              m.arabicText
            )}</td>
            <td>${escapeReportHtml(m.turkishText)}${
                m.detailNote
                  ? `<div style="font-size:8pt;color:#64748B;">${escapeReportHtml(
                      m.detailNote
                    )}</div>`
                  : ""
              }</td>
            <td style="text-align:center;font-weight:800;color:#BE123C;">${
              m.wrongCount
            } Hata / ${m.correctCount} Doğru</td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="5" style="text-align:center;padding:12px;color:#065F46;font-weight:700;">Kayıtlı hata veya zorlanılan harf bulunmamaktadır.</td></tr>`;

    const lastExText = snapshot.lastExercise.hasData
      ? `Çözülen: ${snapshot.lastExercise.solved} | Doğru: ${snapshot.lastExercise.correct} | Yanlış: ${snapshot.lastExercise.wrong} | Başarı: %${snapshot.lastExercise.accuracyPercent ?? 0}`
      : "Henüz oturum kaydı yok";

    const reportHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>Öğretmen ve Öğrenci Gelişim Raporu</title>
  <style>
    @font-face {
      font-family: 'ArakomPrint';
      src: url('/fonts/Arakom.ttf') format('truetype');
      font-display: swap;
    }
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0F172A;
      font-size: 9.5pt;
      line-height: 1.4;
      background: #FFFFFF;
    }
    .ar {
      font-family: 'ArakomPrint', 'Amiri', 'Traditional Arabic', serif;
      line-height: 1.85;
    }
    .header {
      border: 2px solid #065F46;
      border-radius: 10px;
      padding: 10px 14px;
      background: #F0FDF4;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .header h1 {
      margin: 0 0 3px 0;
      font-size: 13.5pt;
      color: #065F46;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .meta-box {
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 7px 9px;
      background: #F8FAFC;
    }
    .meta-box .lbl {
      font-size: 8pt;
      color: #475569;
      font-weight: 700;
    }
    .meta-box .val {
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    h2 {
      font-size: 10.5pt;
      color: #1E293B;
      margin: 10px 0 5px 0;
      padding-bottom: 3px;
      border-bottom: 1.5px solid #087F5B;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 8.8pt;
    }
    th, td {
      border: 1px solid #CBD5E1;
      padding: 5px 7px;
      vertical-align: middle;
    }
    th {
      background: #F1F5F9;
      font-weight: 800;
      text-align: left;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .teacher-note {
      margin-top: 8px;
      border: 1.5px dashed #64748B;
      border-radius: 8px;
      padding: 8px 10px;
      min-height: 54px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🏆 Muallimun Arapça — Öğretmen &amp; Öğrenci Gelişim Raporu</h1>
      <div style="font-size:8.5pt;color:#334155;font-weight:600;">
        Öğrenci: <strong>${safeStudent}</strong> &nbsp;|&nbsp; Sınıf / Kur: <strong>${safeClass}</strong> &nbsp;|&nbsp; Tarih: <strong>${escapeReportHtml(dateLabel)}</strong>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:10.5pt;font-weight:800;color:#065F46;">${escapeReportHtml(snapshot.rank.title)}</div>
      <div dir="rtl" lang="ar" class="ar" style="font-size:13pt;font-weight:700;color:#6741D9;">${escapeReportHtml(snapshot.rank.arabicBadge)}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="lbl">🔥 Günlük Seri</div>
      <div class="val">${snapshot.activeStreakDays} Gün</div>
    </div>
    <div class="meta-box">
      <div class="lbl">🎯 Bugünkü Çalışma</div>
      <div class="val">${snapshot.todayStudyMinutes} / ${snapshot.dailyGoalMinutes} dk</div>
    </div>
    <div class="meta-box">
      <div class="lbl">⭐ Toplam Puan (XP)</div>
      <div class="val">${snapshot.totalXp} XP</div>
    </div>
    <div class="meta-box">
      <div class="lbl">🎖️ Kazanılan Rozet</div>
      <div class="val">${snapshot.unlockedBadgesCount} / ${snapshot.badges.length} Rozet</div>
    </div>
  </div>

  <div style="border:1px solid #CBD5E1;border-radius:8px;padding:6px 10px;background:#FAF5FF;margin-bottom:8px;font-size:8.8pt;font-weight:700;color:#4C1D95;">
    🎧 Son Alıştırma Sonucu (${escapeReportHtml(snapshot.lastExercise.moduleName)}): ${escapeReportHtml(lastExText)}
  </div>

  <div class="two-col">
    <div>
      <h2>📊 CEFR Kurları Tamamlanma Oranları</h2>
      <table>
        <thead>
          <tr>
            <th>Kur</th>
            <th style="text-align:center;">Diyalog</th>
            <th style="text-align:center;">Metin</th>
            <th style="text-align:center;">Oran</th>
          </tr>
        </thead>
        <tbody>${cefrRowsHtml}</tbody>
      </table>
    </div>
    <div>
      <h2>📚 Modül Bazlı İlerleme Tablosu</h2>
      <table>
        <thead>
          <tr>
            <th>Modül</th>
            <th style="text-align:right;">Arapça</th>
            <th style="text-align:center;">Tamamlanan</th>
            <th style="text-align:center;">Yüzde</th>
          </tr>
        </thead>
        <tbody>${moduleRowsHtml}</tbody>
      </table>
    </div>
  </div>

  <h2>🎖️ Başarı Rozetleri ve Kilometre Taşları</h2>
  <table>
    <thead>
      <tr>
        <th>Rozet</th>
        <th>Hedef Açıklaması</th>
        <th style="text-align:center;">İlerleme</th>
        <th style="text-align:center;">Durum</th>
      </tr>
    </thead>
    <tbody>${badgeRowsHtml}</tbody>
  </table>

  <h2>⚠️ En Çok Zorlanılan Kelimeler, Cümleler ve Harf Mahreçleri (İlk 12)</h2>
  <table>
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">#</th>
        <th style="width:125px;">Tür</th>
        <th style="text-align:right;">Arapça İfade / Harf</th>
        <th>Türkçe Anlamı &amp; Teşhis Notu</th>
        <th style="width:110px;text-align:center;">Hata / Doğru</th>
      </tr>
    </thead>
    <tbody>${mistakeRowsHtml}</tbody>
  </table>

  <div class="teacher-note">
    <strong style="font-size:8.5pt;color:#334155;">Öğretmen Değerlendirmesi ve Ödev Notu:</strong>
  </div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.className = "fixed right-0 bottom-0 w-0 h-0 border-0 opacity-0 pointer-events-none";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(reportHtml);
    doc.close();

    const triggerPrint = async () => {
      try {
        if (doc.fonts && doc.fonts.ready) {
          await Promise.race([
            doc.fonts.ready,
            new Promise((res) => setTimeout(res, 900)),
          ]);
        }
      } catch {
        // ignore font wait errors
      }
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 2000);
      }
    };

    setTimeout(() => {
      void triggerPrint();
    }, 220);
  }, [snapshot, studentName, studentClass]);

  if (!isOpen) return null;

  const rankColors =
    snapshot.rank.level === 4
      ? "bg-gradient-to-r from-emerald-800 via-teal-800 to-indigo-900 text-white border-emerald-500"
      : snapshot.rank.level === 3
      ? "bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-700 text-white border-amber-400"
      : snapshot.rank.level === 2
      ? "bg-gradient-to-r from-slate-700 via-slate-600 to-indigo-800 text-white border-slate-400"
      : "bg-gradient-to-r from-[#7C4A21] via-[#8F582A] to-[#065F46] text-white border-amber-600/60";

  return (
    <>
      {shadowingTargetAr && (
        <ShadowingModal
          text={shadowingTargetAr}
          onClose={() => setShadowingTargetAr(null)}
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-badges-modal-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleCloseModal();
          }
        }}
        className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      >
        <div className="w-full max-w-5xl max-h-[92dvh] rounded-2xl bg-[#FAF4E8] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xl flex flex-col overflow-hidden">
          {/* MODAL ÜST BAŞLIK BAR */}
          <div className="px-3.5 sm:px-5 py-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                <Trophy size={20} />
              </div>
              <div className="min-w-0">
                <h2
                  id="stats-badges-modal-title"
                  className="text-sm sm:text-lg font-extrabold text-[var(--foreground)] leading-tight truncate"
                >
                  🏆 Öğrenme İstatistikleri, Başarı Rozetleri ve Öğretmen Raporu
                </h2>
                <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)] truncate">
                  Canlı ilerleme analizi, 8 kilometre taşı rozeti, CEFR kur grafikleri ve A4 gelişim raporu
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrintTeacherReport}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-3 border-[#3d2191] transition-colors whitespace-nowrap cursor-pointer"
              >
                <Printer size={14} />
                <span>🖨️ A4 Gelişim Raporu Yazdır</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClick();
                  handleCloseModal();
                }}
                aria-label="Kapat"
                className="w-10 h-10 rounded-xl bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-400 text-[var(--foreground)] flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* KAYDIRILABİLİR ANA İÇERİK GÖVDESİ */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
            {/* 1. ÜST ÖZET VE RÜTBE ŞERİDİ */}
            <section
              aria-label="Üst Özet ve Rütbe Şeridi"
              className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-3"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                {/* Rütbe / Unvan Kartı */}
                <div
                  className={`lg:col-span-5 rounded-xl border p-3.5 flex flex-col justify-between gap-2 ${rankColors}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-white/80 block">
                        Aktif Öğrenci Unvanı &amp; Rütbesi
                      </span>
                      <span className="text-base sm:text-lg font-black tracking-tight block mt-0.5">
                        🏅 {snapshot.rank.title}
                      </span>
                    </div>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="arabic text-lg sm:text-xl font-bold text-amber-200 shrink-0 leading-relaxed"
                    >
                      {displayArabic(snapshot.rank.arabicBadge)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-white/90 tabular-nums">
                      <span>
                        {snapshot.rank.nextTitle
                          ? `Sonraki: ${snapshot.rank.nextTitle}`
                          : "En Yüksek Üstad Mertebesine Ulaşıldı!"}
                      </span>
                      <span>
                        {snapshot.rank.nextXp
                          ? `${snapshot.totalXp} / ${snapshot.rank.nextXp} XP`
                          : `${snapshot.totalXp} XP`}
                      </span>
                    </div>
                    <SvgProgressBar
                      percent={snapshot.rank.progressPercent}
                      variant="amber"
                    />
                  </div>
                </div>

                {/* 3'lü Canlı Sayaçlar: Günlük Seri | Bugün Hedef | Toplam Puan */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between">
                    <span className="text-xs font-bold text-[var(--muted)] inline-flex items-center gap-1.5">
                      <Flame size={14} className="text-orange-500 shrink-0" />
                      <span>🔥 Günlük Seri</span>
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[var(--foreground)] tabular-nums mt-1">
                      {snapshot.activeStreakDays} Gün
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      İstikrarlı günlük tekrar
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--muted)] inline-flex items-center gap-1.5">
                      <Clock
                        size={14}
                        className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                      />
                      <span>🎯 Bugün</span>
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[var(--foreground)] tabular-nums">
                      {snapshot.todayStudyMinutes} / {snapshot.dailyGoalMinutes} dk
                    </span>
                    <SvgProgressBar
                      percent={Math.round(
                        (snapshot.todayStudyMinutes /
                          Math.max(1, snapshot.dailyGoalMinutes)) *
                          100
                      )}
                      variant="emerald"
                    />
                  </div>

                  <div className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between">
                    <span className="text-xs font-bold text-[var(--muted)] inline-flex items-center gap-1.5">
                      <Star size={14} className="text-amber-500 shrink-0" />
                      <span>⭐ Toplam Puan</span>
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#6741D9] dark:text-[#d0bfff] tabular-nums mt-1">
                      {snapshot.totalXp} XP
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                      {snapshot.unlockedBadgesCount}/8 rozet açık
                    </span>
                  </div>
                </div>
              </div>

              {/* Son Alıştırma / Sınav Sonucu Bilgi Bandı */}
              <div className="rounded-xl bg-[#F3F0FF]/80 dark:bg-[var(--lavender-bg)] border border-[#6741D9]/35 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-bold text-[var(--foreground)] tabular-nums">
                  <Headphones
                    size={16}
                    className="text-[#6741D9] dark:text-[#d0bfff] shrink-0"
                  />
                  <span className="font-extrabold text-[#4C28B5] dark:text-[#d0bfff]">
                    🎧 Son Alıştırma Sonucu:
                  </span>
                  {snapshot.lastExercise.hasData ? (
                    <span>
                      Çözülen: <strong>{snapshot.lastExercise.solved}</strong>{" "}
                      | Doğru:{" "}
                      <strong className="text-[#065F46] dark:text-emerald-300">
                        {snapshot.lastExercise.correct}
                      </strong>{" "}
                      | Yanlış:{" "}
                      <strong className="text-rose-600 dark:text-rose-300">
                        {snapshot.lastExercise.wrong}
                      </strong>{" "}
                      | Başarı:{" "}
                      <strong className="text-[#6741D9] dark:text-[#d0bfff]">
                        %{snapshot.lastExercise.accuracyPercent ?? 0}
                      </strong>{" "}
                      <span className="text-xs text-[var(--muted)] font-semibold">
                        ({snapshot.lastExercise.moduleName})
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--muted)]">
                      Çözülen: 0 | Doğru: 0 | Yanlış: 0 | Başarı: %0 — İlk alıştırmanızı çözerek istatistiklerinizi başlatın!
                    </span>
                  )}
                </div>

                <Link
                  href="/alistirmalar"
                  onClick={() => {
                    playClick();
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold whitespace-nowrap shrink-0"
                >
                  <span>Alıştırmalara Git</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </section>

            {/* 2. 3 SEKMELİ DETAYLI ANALİZ ÇUBUĞU */}
            <div
              role="tablist"
              aria-label="Öğrenme Analiz Sekmeleri"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 bg-[#EFE5D2] dark:bg-[var(--background)] p-1.5 rounded-2xl border border-[#E6D7BE] dark:border-[var(--border)]"
            >
              {(
                [
                  {
                    id: "badges",
                    label: `🎖️ Rozetler & Kilometre Taşları (${snapshot.unlockedBadgesCount}/8)`,
                    icon: Award,
                  },
                  {
                    id: "charts",
                    label: "📊 Paket & Diyalog Başarı Grafikleri",
                    icon: BarChart3,
                  },
                  {
                    id: "mistakes",
                    label: `⚠️ En Çok Hata Yapılanlar & Ses Dinleme (${snapshot.frequentMistakes.length})`,
                    icon: AlertTriangle,
                  },
                ] as const
              ).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      playClick();
                      setTabOverride({ forInitial: initialTab, tab: tab.id });
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-[13px] font-extrabold transition-colors flex items-center justify-center gap-1.5 text-center cursor-pointer ${
                      active
                        ? "bg-[#087F5B] text-white shadow-xs"
                        : "bg-white/70 dark:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SEKME 1: 🎖️ ROZETLER & KİLOMETRE TAŞLARI */}
            {activeTab === "badges" && (
              <section
                role="tabpanel"
                aria-label="Rozetler ve Kilometre Taşları"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted)]">
                    Çalışmalarınız ilerledikçe başarı rozetleriniz otomatik olarak açılır.
                  </p>
                  <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-400 tabular-nums">
                    Açılan Rozet: {snapshot.unlockedBadgesCount} /{" "}
                    {snapshot.badges.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {snapshot.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`rounded-2xl border-2 p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-colors ${
                        badge.unlocked
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-[#087F5B] dark:border-emerald-500"
                          : "bg-white/90 dark:bg-[var(--background)] border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                              badge.unlocked
                                ? "bg-white dark:bg-emerald-900/60 border-emerald-400"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 grayscale opacity-80"
                            }`}
                          >
                            {badge.icon}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
                              {badge.icon} {badge.title}
                            </h3>
                            <p className="text-xs text-[var(--muted)] font-medium mt-0.5 leading-relaxed">
                              {badge.description}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-black whitespace-nowrap shrink-0 inline-flex items-center gap-1 ${
                            badge.unlocked
                              ? "text-[#065F46] dark:text-emerald-300"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {badge.unlocked ? (
                            <CheckCircle2 size={13} className="shrink-0" />
                          ) : (
                            <Lock size={12} className="shrink-0" />
                          )}
                          <span>{badge.statusTag}</span>
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                          <span className="text-[var(--muted)]">
                            İlerleme: {Math.min(badge.current, badge.target)} /{" "}
                            {badge.target} {badge.unitLabel}
                          </span>
                          <span
                            className={
                              badge.unlocked
                                ? "text-[#065F46] dark:text-emerald-300 font-extrabold"
                                : "text-slate-600 dark:text-slate-300"
                            }
                          >
                            %{badge.progressPercent}
                          </span>
                        </div>
                        <SvgProgressBar
                          percent={badge.progressPercent}
                          variant={badge.unlocked ? "emerald" : "slate"}
                        />

                        {!badge.unlocked && (
                          <div className="pt-1 flex justify-end">
                            <Link
                              href={badge.actionHref}
                              onClick={() => {
                                playClick();
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] hover:underline"
                            >
                              <span>{badge.actionLabel}</span>
                              <ArrowRight size={12} />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SEKME 2: 📊 PAKET & DİYALOG BAŞARI GRAFİKLERİ */}
            {activeTab === "charts" && (
              <section
                role="tabpanel"
                aria-label="Paket ve Diyalog Başarı Grafikleri"
                className="space-y-4"
              >
                {/* CEFR Kurları İlerleme Kartları */}
                <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                      🧭 CEFR Kurlarına Göre Tamamlanma Oranları (A1 – B2)
                    </h3>
                    <Link
                      href="/seviye-tespit"
                      onClick={() => {
                        playClick();
                        onClose();
                      }}
                      className="text-xs font-extrabold text-[#6741D9] dark:text-[#d0bfff] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Seviye Tespit &amp; Kur Sınavı</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {snapshot.cefrProgress.map((row) => (
                      <div
                        key={row.level}
                        className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] block truncate">
                              {row.titleTr}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                              Diyalog: {row.dialoguesDone}/{row.dialoguesTotal}{" "}
                              · Metin: {row.readingsDone}/{row.readingsTotal}
                              {row.examPassed ? " · 🏆 Kur Sınavı Geçildi" : ""}
                            </span>
                          </div>
                          <span className="text-base sm:text-lg font-black text-[#065F46] dark:text-emerald-400 tabular-nums shrink-0">
                            %{row.percent}
                          </span>
                        </div>

                        <SvgProgressBar
                          percent={row.percent}
                          variant="emerald"
                        />

                        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                          <span>
                            Toplam Öğe: {row.completedItems} / {row.totalItems}
                          </span>
                          <Link
                            href={`/kutuphane?level=${row.level}`}
                            onClick={() => {
                              playClick();
                              onClose();
                            }}
                            className="font-extrabold text-[#065F46] dark:text-emerald-400 hover:underline"
                          >
                            {row.level} İçeriklerini Aç →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6 Ana Modül Tamamlanma Çubukları */}
                <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-3">
                  <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                    📚 Eğitim Paketleri ve Modül Tamamlanma Grafikleri
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {snapshot.moduleProgress.map((mod) => (
                      <Link
                        key={mod.id}
                        href={mod.href}
                        onClick={() => {
                          playClick();
                          onClose();
                        }}
                        className="group rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] p-3 space-y-2 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-extrabold text-[var(--foreground)] group-hover:text-[#087F5B] transition-colors block truncate">
                              {mod.title}
                            </span>
                            <span className="text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                              Tamamlanan: {mod.completed} / {mod.total}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              dir="rtl"
                              lang="ar"
                              className="arabic text-sm font-bold text-[#6741D9] dark:text-[#d0bfff] block leading-snug"
                            >
                              {displayArabic(mod.arabicLabel)}
                            </span>
                            <span className="text-sm font-black text-[#065F46] dark:text-emerald-400 tabular-nums">
                              %{mod.percent}
                            </span>
                          </div>
                        </div>

                        <SvgProgressBar
                          percent={mod.percent}
                          variant="purple"
                        />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* 6 Beceri Doğruluk Özeti */}
                <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-2.5">
                  <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                    🎯 6 Temel Dil Becerisi Doğruluk Oranı
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {(
                      [
                        { key: "kelime", label: "Kelime" },
                        { key: "gramer", label: "Gramer" },
                        { key: "okuma", label: "Okuma" },
                        { key: "dinleme", label: "Dinleme" },
                        { key: "telaffuz", label: "Telaffuz" },
                        { key: "imla", label: "İmla & Dizilim" },
                      ] as const
                    ).map((sk) => {
                      const st = skillStats?.[sk.key];
                      const pct =
                        st && st.total > 0
                          ? Math.round((st.correct / st.total) * 100)
                          : null;
                      return (
                        <div
                          key={sk.key}
                          className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
                            <span className="text-[var(--foreground)] truncate">
                              {sk.label}
                            </span>
                            <span className="text-[#065F46] dark:text-emerald-400 tabular-nums">
                              {pct !== null ? `%${pct}` : "—"}
                            </span>
                          </div>
                          <SvgProgressBar
                            percent={pct ?? 0}
                            variant="emerald"
                          />
                          <span className="block text-[10px] font-semibold text-[var(--muted)] tabular-nums">
                            {st && st.total > 0
                              ? `${st.correct}/${st.total} doğru`
                              : "Veri bekleniyor"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* SEKME 3: ⚠️ EN ÇOK HATA YAPILANLAR & SES DİNLEME + A4 ÖĞRETMEN RAPORU */}
            {activeTab === "mistakes" && (
              <section
                role="tabpanel"
                aria-label="En Çok Hata Yapılanlar ve Ses Dinleme"
                className="space-y-3.5"
              >
                {/* Üst Araç ve Öğretmen / Öğrenci Gelişim Raporu Yazdırma Paneli */}
                <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                        ⚠️ Hata Sıklığına Göre Zorlanılan Kelime, Cümle ve Harfler
                      </h3>
                      <p className="text-xs font-medium text-[var(--muted)]">
                        Hata Defterim ve 28 Harf Mahreç verilerinden derlenmiştir. Her satırı dinleyebilir veya anında tekrar edebilirsiniz.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handlePrintTeacherReport}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-3 border-[#3d2191] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Printer size={15} />
                      <span>
                        🖨️ Öğretmen / Öğrenci Gelişim Raporunu Yazdır (A4)
                      </span>
                    </button>
                  </div>

                  {/* İsteğe Bağlı Rapor Başlığı İçin Öğrenci Adı & Sınıf Alanları */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)]">
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Rapor için Öğrenci Adı Soyadı (İsteğe Bağlı)"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#087F5B]"
                    />
                    <input
                      type="text"
                      value={studentClass}
                      onChange={(e) => setStudentClass(e.target.value)}
                      placeholder="Sınıf / Şube / Kur Bilgisi (Örn: Hazırlık-A / A2)"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#087F5B]"
                    />
                  </div>

                  {/* Tür Filtresi */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          {
                            id: "all",
                            label: `Tümü (${snapshot.frequentMistakes.length})`,
                          },
                          {
                            id: "word",
                            label: `Kelimeler (${
                              snapshot.frequentMistakes.filter(
                                (m) => m.kind === "word"
                              ).length
                            })`,
                          },
                          {
                            id: "sentence",
                            label: `Cümle & Kalıplar (${
                              snapshot.frequentMistakes.filter(
                                (m) => m.kind === "sentence"
                              ).length
                            })`,
                          },
                          {
                            id: "phoneme",
                            label: `28 Harf Mahreç (${
                              snapshot.frequentMistakes.filter(
                                (m) => m.kind === "phoneme"
                              ).length
                            })`,
                          },
                        ] as const
                      ).map((flt) => {
                        const isSel = mistakeFilter === flt.id;
                        return (
                          <button
                            key={flt.id}
                            type="button"
                            onClick={() => {
                              playClick();
                              setMistakeFilter(flt.id);
                            }}
                            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
                              isSel
                                ? "bg-[#087F5B] text-white"
                                : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {flt.label}
                          </button>
                        );
                      })}
                    </div>

                    {snapshot.frequentMistakes.length > 0 && (
                      <Link
                        href="/alistirmalar?pool=mistakes"
                        onClick={() => {
                          playClick();
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold"
                      >
                        <Target size={13} />
                        <span>Tüm Hatalarımla Alıştırma Yap</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Hata Sıklığı Listesi */}
                {filteredMistakes.length === 0 ? (
                  <div className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-8 text-center space-y-2.5">
                    <p className="text-base font-extrabold text-[#065F46] dark:text-emerald-400">
                      🎉 Harika! Bu kategoride kayıtlı hata veya zorlanılan öğe görünmüyor.
                    </p>
                    <p className="text-xs font-medium text-[var(--muted)] max-w-lg mx-auto">
                      Alıştırmalar, Seviye Tespit ve Gölgeleme (Mahreç Koçu) çalışmalarınızda takıldığınız kelimeler, cümleler ve harfler otomatik olarak burada sıralanır.
                    </p>
                    <div className="pt-1">
                      <Link
                        href="/alistirmalar"
                        onClick={() => {
                          playClick();
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold"
                      >
                        <span>Alıştırma Merkezine Git</span>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredMistakes.slice(0, 40).map((row, index) => {
                      const isPlaying = playingRowId === row.uid;
                      return (
                        <div
                          key={row.uid}
                          className="rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-black flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                              #{index + 1}
                            </span>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-[var(--muted)] tabular-nums">
                                <span className="text-[var(--foreground)] font-extrabold">
                                  {row.kindLabel}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                                  {row.wrongCount} Hata
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#065F46] dark:text-emerald-400">
                                  {row.correctCount} Doğru
                                </span>
                                {row.accuracyPercent !== null && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Başarı: %{row.accuracyPercent}</span>
                                  </>
                                )}
                              </div>

                              <p
                                dir="rtl"
                                lang="ar"
                                className="arabic text-xl sm:text-2xl font-bold text-[var(--foreground)] leading-[1.85] py-0.5 break-words text-right md:text-right"
                              >
                                {displayArabic(row.arabicText)}
                              </p>

                              <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                                {row.turkishText}
                              </p>

                              {row.detailNote && (
                                <p className="text-[11px] font-semibold text-[var(--muted)]">
                                  {row.detailNote}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleListenMistakeRow(row)}
                              className={`flex-1 sm:flex-initial min-h-[40px] px-3 py-2 rounded-xl border-2 border-b-3 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                                isPlaying
                                  ? "bg-[#087F5B] border-[#065F46] text-white"
                                  : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[#065F46] dark:text-emerald-400"
                              }`}
                            >
                              <Volume2 size={15} />
                              <span>🔊 Sesi Dinle</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handlePracticeMistakeRow(row)}
                              className="flex-1 sm:flex-initial min-h-[40px] px-3.5 py-2 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white border-b-3 border-[#3d2191] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                            >
                              <Target size={15} />
                              <span>🎯 Hemen Tekrar Et</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
