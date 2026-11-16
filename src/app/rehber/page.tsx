"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  Users,
  Map,
  Target,
  Calendar,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import {
  REHBER_ROLE_STORAGE_KEY,
  build24WeekCurriculum,
  computeCurriculumProgress,
  getDynamicKttTopicCount,
  type RehberRole,
  type RehberTabId,
} from "@/lib/rehberCurriculum";
import { useUserStore } from "@/store/userStore";
import { playClick } from "@/lib/sfxManager";
import RehberMapTab from "@/components/rehber/RehberMapTab";
import {
  RehberMethodologyTab,
  RehberScheduleTab,
} from "@/components/rehber/RehberMethodologyAndScheduleTabs";
import RehberCurriculumTab from "@/components/rehber/RehberCurriculumTab";
import RehberPrintBooklet from "@/components/rehber/RehberPrintBooklet";

const TABS: Array<{
  id: RehberTabId;
  label: string;
  shortLabel: string;
  icon: typeof Map;
}> = [
  {
    id: "map",
    label: "🗺️ Nerede Ne Var? (Görsel Modül & Araç Haritası)",
    shortLabel: "🗺️ Nerede Ne Var?",
    icon: Map,
  },
  {
    id: "methodology",
    label: "🎯 Nasıl Çalışılır? (Metodoloji & Adım Adım Akış)",
    shortLabel: "🎯 Nasıl Çalışılır?",
    icon: Target,
  },
  {
    id: "schedule",
    label: "📅 Günlük • Haftalık • Aylık Program",
    shortLabel: "📅 Çalışma Programı",
    icon: Calendar,
  },
  {
    id: "curriculum",
    label: "📊 24 Haftalık A1–B2 Kur Takip Çizelgesi (Canlı İlerleme)",
    shortLabel: "📊 24 Haftalık Çizelge",
    icon: BarChart3,
  },
];

function isValidRole(val: string | null): val is RehberRole {
  return val === "learner" || val === "teacher";
}

function isValidTab(val: string | null): val is RehberTabId {
  return (
    val === "map" ||
    val === "methodology" ||
    val === "schedule" ||
    val === "curriculum"
  );
}

function RehberPageInner() {
  const searchParams = useSearchParams();
  const completedDialogues = useUserStore((s) => s.completedDialogues);
  const completedReadings = useUserStore((s) => s.completedReadings);
  const completedLevelExams = useUserStore((s) => s.completedLevelExams);

  const [role, setRole] = useState<RehberRole>("learner");
  const [activeTab, setActiveTab] = useState<RehberTabId>("map");

  const roleParam = searchParams.get("role");
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (isValidRole(roleParam)) {
        setRole(roleParam);
        try {
          window.localStorage.setItem(REHBER_ROLE_STORAGE_KEY, roleParam);
        } catch {
          // ignore
        }
        return;
      }
      try {
        const saved = window.localStorage.getItem(REHBER_ROLE_STORAGE_KEY);
        if (isValidRole(saved)) {
          setRole(saved);
        }
      } catch {
        // ignore storage errors
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [roleParam]);

  useEffect(() => {
    if (!isValidTab(tabParam)) return;
    const raf = requestAnimationFrame(() => {
      setActiveTab(tabParam);
    });
    return () => cancelAnimationFrame(raf);
  }, [tabParam]);

  const handleSelectRole = (nextRole: RehberRole) => {
    playClick();
    setRole(nextRole);
    try {
      window.localStorage.setItem(REHBER_ROLE_STORAGE_KEY, nextRole);
    } catch {
      // ignore storage errors
    }
  };

  const weeks = useMemo(() => build24WeekCurriculum(), []);
  const kttTopicCount = useMemo(() => getDynamicKttTopicCount(), []);
  const progress = useMemo(
    () =>
      computeCurriculumProgress(
        weeks,
        completedDialogues,
        completedReadings,
        completedLevelExams
      ),
    [weeks, completedDialogues, completedReadings, completedLevelExams]
  );

  const handlePrint = () => {
    playClick();
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-5 print:space-y-0">
      {/* EKRAN GÖRÜNÜMÜ (YAZDIRIRKEN GİZLENİR) */}
      <div className="space-y-5 print:hidden">
        {/* ÜST HERO & A4 YAZDIRMA ÇUBUĞU */}
        <section className="rounded-3xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-4 sm:p-6 space-y-4 min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/"
                  onClick={() => playClick()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-bold text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
                >
                  <ArrowLeft size={13} className="shrink-0" />
                  <span>Ana Sayfa</span>
                </Link>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#087F5B] text-white text-[11px] sm:text-xs font-extrabold leading-snug">
                  <BookOpen size={13} className="shrink-0" />
                  <span>Kullanım Rehberi &amp; Çalışma Programı Merkezi</span>
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[var(--foreground)] tracking-tight leading-tight">
                Muallimun Arapça Yol Haritası &amp; 24 Haftalık Kur Programı
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[var(--muted)] max-w-3xl">
                Uygulamadaki tüm modüllerin yerini keşfedin, kendi hızınıza veya
                sınıfınıza uygun çalışma sistemini seçin ve A1&apos;den B2&apos;ye
                canlı kur çizelgesiyle ilerlemenizi adım adım takip edin.
              </p>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full lg:w-auto min-h-[44px] px-3.5 sm:px-4 py-2.5 rounded-2xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-[#064E3B] text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 text-center whitespace-normal sm:whitespace-nowrap lg:shrink-0 cursor-pointer transition-colors leading-snug"
            >
              <span>🖨️ Bu Rehberi &amp; Takip Çizelgesini Yazdır (A4 PDF)</span>
            </button>
          </div>

          {/* KULLANICI PROFİLİ (ROL) SEÇİCİ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              aria-pressed={role === "learner"}
              onClick={() => handleSelectRole("learner")}
              className={`w-full min-w-0 text-left rounded-2xl p-3.5 sm:p-4 border-2 transition-all cursor-pointer flex items-start gap-3 ${
                role === "learner"
                  ? "bg-[#ECFDF5] dark:bg-emerald-950/40 border-[#087F5B] shadow-2xs"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]/60"
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  role === "learner"
                    ? "bg-[#087F5B] text-white"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[#087F5B]"
                }`}
              >
                <GraduationCap size={20} />
              </span>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-black text-[var(--foreground)] leading-snug">
                    🎓 Bireysel Öğrenen Modu
                  </span>
                  {role === "learner" && (
                    <span className="px-2 py-0.5 rounded bg-[#087F5B] text-white text-[10px] font-extrabold whitespace-nowrap">
                      Seçili
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  Öğretmensiz kendi başına çalışanlar için günlük 30 dk rutin, 5
                  adımlı diyalog özümseme ve 5+1+1 haftalık çalışma planı.
                </p>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={role === "teacher"}
              onClick={() => handleSelectRole("teacher")}
              className={`w-full min-w-0 text-left rounded-2xl p-3.5 sm:p-4 border-2 transition-all cursor-pointer flex items-start gap-3 ${
                role === "teacher"
                  ? "bg-[#F3F0FF] dark:bg-purple-950/40 border-[#6741D9] shadow-2xs"
                  : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]/60"
              }`}
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  role === "teacher"
                    ? "bg-[#6741D9] text-white"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] text-[#6741D9]"
                }`}
              >
                <Users size={20} />
              </span>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-black text-[var(--foreground)] leading-snug">
                    👨‍🏫 Sınıf &amp; Kurs Öğretmeni Modu
                  </span>
                  {role === "teacher" && (
                    <span className="px-2 py-0.5 rounded bg-[#6741D9] text-white text-[10px] font-extrabold whitespace-nowrap">
                      Seçili
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  Akıllı tahta 40 dk ders akışı, A/B ikili kartlar, karekod ödev,
                  MEB 36 hafta &amp; yoğun dil kursu müfredat matrisi.
                </p>
              </div>
            </button>
          </div>

          {/* DİNAMİK PLATFORM ENVANTER ŞERİDİ */}
          <div className="w-full max-w-full flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 text-xs font-extrabold text-[var(--foreground)] tabular-nums">
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              📖 {CONTENT_INVENTORY.dialoguesCount} Diyalog
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              📄 {CONTENT_INVENTORY.readingsCount} Okuma Metni
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              💬 {CONTENT_INVENTORY.sentencesCount.toLocaleString("tr-TR")} Cümle
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              🖼️ {CONTENT_INVENTORY.visualWordsCount} Görsel Kelime
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              📜 {CONTENT_INVENTORY.proverbsCount} Atasözü
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              📐 {CONTENT_INVENTORY.grammarNotesCount} Gramer Kartı
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              🎮 {CONTENT_INVENTORY.exerciseModulesCount} Alıştırma Modülü
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] whitespace-nowrap shrink-0">
              🧭 {CONTENT_INVENTORY.assessmentQuestionsCount} Soru • {kttTopicCount} KTT
            </span>
          </div>
        </section>

        {/* 4 ANA SEKME ÇUBUĞU (MOBİLDE 1 SÜTUN, TABLETTE 2x2, MASAÜSTÜNDE 4 EŞİT SÜTUN — SIFIR TAŞMA) */}
        <nav
          aria-label="Kullanım rehberi bölümleri"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  playClick();
                  setActiveTab(tab.id);
                }}
                className={`w-full min-w-0 min-h-[48px] px-3 py-2.5 rounded-2xl text-center text-xs sm:text-sm lg:text-xs xl:text-[13px] font-extrabold whitespace-normal leading-snug cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  active
                    ? "bg-[#6741D9] text-white border-b-3 border-[#4C28B5]"
                    : "bg-[#FDFBF7] dark:bg-[var(--surface)] text-[var(--foreground)] border-2 border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9]"
                }`}
              >
                <span className="min-w-0 break-words">{tab.label}</span>
                {tab.id === "curriculum" && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums shrink-0 ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[#087F5B]/15 text-[#087F5B] dark:text-emerald-300"
                    }`}
                  >
                    %{progress.overallPercent}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* AKTİF SEKME İÇERİĞİ */}
        {activeTab === "map" && <RehberMapTab role={role} />}
        {activeTab === "methodology" && <RehberMethodologyTab role={role} />}
        {activeTab === "schedule" && <RehberScheduleTab role={role} />}
        {activeTab === "curriculum" && (
          <RehberCurriculumTab role={role} weeks={weeks} progress={progress} />
        )}
      </div>

      {/* YAZDIRILABİLİR A4 REHBER & 24 HAFTA KONTROL ÇİZELGESİ */}
      <RehberPrintBooklet role={role} weeks={weeks} progress={progress} />
    </div>
  );
}

export default function RehberPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-6 text-sm font-bold text-[var(--muted)]">
          Kullanım Rehberi ve 24 Haftalık Çalışma Programı yükleniyor...
        </div>
      }
    >
      <RehberPageInner />
    </Suspense>
  );
}
