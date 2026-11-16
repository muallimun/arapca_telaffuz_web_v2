"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  BookOpen,
  FileText,
  GraduationCap,
  ArrowUpRight,
  Award,
  Filter,
} from "lucide-react";
import type {
  CurriculumWeekPlan,
  CurriculumProgressSummary,
  RehberRole,
} from "@/lib/rehberCurriculum";
import type { Level } from "@/types/data";
import { playClick } from "@/lib/sfxManager";

interface RehberCurriculumTabProps {
  role: RehberRole;
  weeks: CurriculumWeekPlan[];
  progress: CurriculumProgressSummary;
}

const LEVEL_FILTERS: Array<Level | "ALL"> = ["ALL", "A1", "A2", "B1", "B2"];

function SegmentedBar({
  percent,
  colorVariant = "emerald",
}: {
  percent: number;
  colorVariant?: "emerald" | "purple" | "amber";
}) {
  const filledSegments = Math.round(Math.max(0, Math.min(100, percent)) / 10);
  const activeCls =
    colorVariant === "purple"
      ? "bg-[#6741D9]"
      : colorVariant === "amber"
      ? "bg-[#D97706]"
      : "bg-[#087F5B]";

  return (
    <div
      className="grid grid-cols-10 gap-1 w-full"
      aria-label={`İlerleme yüzde ${percent}`}
    >
      {Array.from({ length: 10 }, (_, idx) => (
        <span
          key={idx}
          className={`h-2 rounded-xs transition-colors ${
            idx < filledSegments
              ? activeCls
              : "bg-[#E6D7BE]/70 dark:bg-slate-700/70"
          }`}
        />
      ))}
    </div>
  );
}

export default function RehberCurriculumTab({
  role,
  weeks,
  progress,
}: RehberCurriculumTabProps) {
  const [selectedLevel, setSelectedLevel] = useState<Level | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "remaining" | "completed"
  >("all");

  const completedSet = new Set<string>();
  for (const w of Object.values(progress.byWeek)) {
    for (const dId of w.completedDialogueIds) completedSet.add(dId);
    for (const rId of w.completedReadingIds) completedSet.add(rId);
  }

  const filteredWeeks = weeks.filter((w) => {
    if (selectedLevel !== "ALL" && w.level !== selectedLevel) return false;
    const wp = progress.byWeek[w.weekNumber];
    if (statusFilter === "completed" && !wp?.isWeekCompleted) return false;
    if (statusFilter === "remaining" && wp?.isWeekCompleted) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* ÜST CANLI İLERLEME ÖZETİ */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#087F5B] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3.5">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
              Canlı Müfredat Takibi • A1&apos;den B2&apos;ye 24 Hafta (Her Kur 6 Hafta)
            </span>
            <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
              24 Haftalık Tam Kur Çizelgesi &amp; Otomatik Tamamlama Durumu
            </h2>
            <p className="text-xs font-medium text-[var(--muted)]">
              {role === "learner"
                ? "Bitirdiğiniz her diyalog ve okuma metni otomatik yeşil (✓) tik alır; istediğiniz derse tıklayıp doğrudan çalışmaya geçebilirsiniz."
                : "Sınıfta işlediğiniz diyalog ve okuma metinlerini işaretledikçe haftalık ve kur bazlı müfredat ilerleme yüzdesi otomatik güncellenir."}
            </p>
          </div>

          <div className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] px-4 py-2.5 flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[11px] font-bold text-[var(--muted)]">
                Toplam Ders İlerlemesi
              </div>
              <div className="text-sm sm:text-base font-black text-[var(--foreground)] tabular-nums">
                {progress.completedUnitsTotal} / {progress.totalUnitsTotal} Ders (
                {progress.completedDialoguesTotal}/{progress.totalDialoguesTotal}{" "}
                Diyalog • {progress.completedReadingsTotal}/
                {progress.totalReadingsTotal} Metin)
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[#087F5B] text-white text-base sm:text-lg font-black tabular-nums">
              %{progress.overallPercent}
            </div>
          </div>
        </div>

        {/* 4 CEFR KUR ÖZET KARTI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(["A1", "A2", "B1", "B2"] as Level[]).map((lvl) => {
            const summary = progress.byLevel[lvl];
            const isSelected = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedLevel((prev) => (prev === lvl ? "ALL" : lvl));
                }}
                className={`text-left rounded-xl p-3.5 border-2 transition-all cursor-pointer space-y-2 ${
                  isSelected
                    ? "bg-[#ECFDF5] dark:bg-emerald-950/35 border-[#087F5B]"
                    : "bg-[#F7EFE1]/70 dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B]/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-xs font-extrabold">
                    {lvl} Kuru ({summary.weeksRangeLabel})
                  </span>
                  <span className="text-sm font-black text-[var(--foreground)] tabular-nums">
                    %{summary.percent}
                  </span>
                </div>
                <SegmentedBar
                  percent={summary.percent}
                  colorVariant={summary.percent === 100 ? "emerald" : "purple"}
                />
                <div className="flex items-center justify-between text-[11px] font-bold text-[var(--muted)] tabular-nums">
                  <span>
                    {summary.completedDialoguesCount}/
                    {summary.totalDialoguesCount} Diyalog •{" "}
                    {summary.completedReadingsCount}/{summary.totalReadingsCount}{" "}
                    Metin
                  </span>
                  {summary.examCompleted && (
                    <span className="text-[#087F5B] dark:text-emerald-300 font-extrabold">
                      ✓ Sınav Geçildi
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* FİLTRE ÇUBUĞU */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--muted)] pr-1 shrink-0">
              <Filter size={13} />
              <span>Kur:</span>
            </span>
            {LEVEL_FILTERS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  playClick();
                  setSelectedLevel(lvl);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedLevel === lvl
                    ? "bg-[#087F5B] text-white"
                    : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                {lvl === "ALL" ? "Tüm Kurlar (24 Hafta)" : `${lvl} (6 Hafta)`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {[
              { id: "all" as const, label: "Tümü" },
              { id: "remaining" as const, label: "Devam Eden Haftalar" },
              { id: "completed" as const, label: "✓ Bitirilen Haftalar" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  playClick();
                  setStatusFilter(st.id);
                }}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st.id
                    ? "bg-[#6741D9] text-white"
                    : "bg-white dark:bg-[var(--background)] text-[var(--muted)] border border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 24 HAFTA KART LİSTESİ */}
      {filteredWeeks.length === 0 ? (
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-8 text-center space-y-2">
          <p className="text-sm font-extrabold text-[var(--foreground)]">
            Seçili filtreye uygun hafta bulunamadı.
          </p>
          <button
            type="button"
            onClick={() => {
              playClick();
              setSelectedLevel("ALL");
              setStatusFilter("all");
            }}
            className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#087F5B] text-white text-xs font-extrabold cursor-pointer"
          >
            Tüm 24 Haftayı Göster
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWeeks.map((week) => {
            const wp = progress.byWeek[week.weekNumber];
            const isDone = Boolean(wp?.isWeekCompleted);

            return (
              <article
                key={week.weekNumber}
                className={`rounded-2xl p-4 sm:p-5 border-2 flex flex-col justify-between gap-3.5 transition-colors ${
                  isDone
                    ? "bg-[#ECFDF5]/70 dark:bg-emerald-950/25 border-[#087F5B]"
                    : "bg-[#FDFBF7] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <div className="space-y-3">
                  {/* Hafta Üst Başlık */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#087F5B] text-white text-xs font-extrabold tabular-nums">
                          {week.weekNumber}. Hafta
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#6741D9]/15 text-[#6741D9] dark:text-purple-300 text-xs font-extrabold">
                          {week.level} • {week.levelWeekIndex}/6
                        </span>
                        {isDone && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-[11px] font-extrabold">
                            <CheckCircle2 size={12} />
                            <span>Tamamlandı</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] leading-snug">
                        {week.phaseTitleTr}
                      </h3>
                      <p className="text-xs font-semibold text-[var(--muted)]">
                        Odak: {week.focusSummaryTr}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-black text-[#087F5B] dark:text-emerald-300 tabular-nums">
                        %{wp?.percent ?? 0}
                      </div>
                      <div className="text-[11px] font-bold text-[var(--muted)] tabular-nums">
                        {wp?.completedUnits ?? 0}/{wp?.totalUnits ?? 0} Ders
                      </div>
                    </div>
                  </div>

                  <SegmentedBar
                    percent={wp?.percent ?? 0}
                    colorVariant={isDone ? "emerald" : "amber"}
                  />

                  {/* 5 Diyalog Çipleri */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-[var(--foreground)]">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen size={13} className="text-[#087F5B]" />
                        <span>
                          Haftanın 5 Diyaloğu ({wp?.completedDialoguesCount ?? 0}/
                          {week.dialogues.length})
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {week.dialogues.map((d) => {
                        const done = completedSet.has(d.id);
                        return (
                          <Link
                            key={d.id}
                            href={d.href}
                            onClick={() => playClick()}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-between gap-2 transition-colors ${
                              done
                                ? "bg-[#ECFDF5] dark:bg-emerald-950/40 border-[#087F5B] text-[#065F46] dark:text-emerald-200"
                                : "bg-[#F7EFE1]/65 dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[var(--foreground)]"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              {done ? (
                                <CheckCircle2
                                  size={14}
                                  className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                                />
                              ) : (
                                <Circle
                                  size={13}
                                  className="text-[var(--muted)] shrink-0"
                                />
                              )}
                              <span className="truncate">
                                <strong>{d.codeLabel}:</strong> {d.baslikTr}
                              </span>
                            </span>
                            <ArrowUpRight size={12} className="shrink-0 opacity-75" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Okuma Metinleri Çipleri */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-extrabold text-[var(--foreground)]">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText size={13} className="text-[#6741D9]" />
                        <span>
                          Haftanın Okuma Metinleri (
                          {wp?.completedReadingsCount ?? 0}/{week.readings.length})
                        </span>
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {week.readings.map((r) => {
                        const done = completedSet.has(r.id);
                        return (
                          <Link
                            key={r.id}
                            href={r.href}
                            onClick={() => playClick()}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center justify-between gap-2 transition-colors ${
                              done
                                ? "bg-[#ECFDF5] dark:bg-emerald-950/40 border-[#087F5B] text-[#065F46] dark:text-emerald-200"
                                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-[var(--foreground)]"
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              {done ? (
                                <CheckCircle2
                                  size={14}
                                  className="text-[#087F5B] dark:text-emerald-400 shrink-0"
                                />
                              ) : (
                                <Circle
                                  size={13}
                                  className="text-[var(--muted)] shrink-0"
                                />
                              )}
                              <span className="truncate">
                                <strong>{r.codeLabel}:</strong> {r.baslikTr}
                              </span>
                            </span>
                            <ArrowUpRight size={12} className="shrink-0 opacity-75" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Haftalık Hazine Kotası + KTT + Kur Bitirme Sınavı */}
                <div className="pt-2.5 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)] space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] tabular-nums">
                    <span className="px-2 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                      🖼️ {week.visualWordsQuota} Görsel Kelime
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                      💬 {week.sentencesQuota} Kalıp Cümle
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                      📜 {week.proverbsQuota} Atasözü
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]">
                      🎬 {week.videosQuota} Video Rehberi
                    </span>
                  </div>

                  {week.kttTopics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {week.kttTopics.map((ktt) => (
                        <Link
                          key={ktt.ustKonu}
                          href={ktt.href}
                          onClick={() => playClick()}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#F3F0FF] dark:bg-purple-950/40 border border-[#6741D9]/40 hover:border-[#6741D9] text-[11px] font-extrabold text-[#4C28B5] dark:text-purple-200 inline-flex items-center gap-1"
                        >
                          <GraduationCap size={12} className="shrink-0" />
                          <span className="truncate max-w-[230px]">
                            KTT: {ktt.ustKonu}
                          </span>
                          <ArrowUpRight size={11} className="shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {week.milestoneExam && (
                    <Link
                      href={week.milestoneExam.href}
                      onClick={() => playClick()}
                      className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-extrabold inline-flex items-center justify-between gap-2"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Award size={15} className="shrink-0" />
                        <span>{week.milestoneExam.labelTr}</span>
                      </span>
                      <ArrowUpRight size={14} className="shrink-0" />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
