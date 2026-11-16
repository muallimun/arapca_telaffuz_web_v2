"use client";

import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import type {
  CurriculumWeekPlan,
  CurriculumProgressSummary,
  RehberRole,
} from "@/lib/rehberCurriculum";

interface RehberPrintBookletProps {
  role: RehberRole;
  weeks: CurriculumWeekPlan[];
  progress: CurriculumProgressSummary;
}

export default function RehberPrintBooklet({
  role,
  weeks,
  progress,
}: RehberPrintBookletProps) {
  return (
    <div className="hidden print:block text-black bg-white space-y-4 text-[10pt] leading-snug">
      {/* YAZDIRMA ÜST BİLGİSİ: YALNIZCA Muallimun Arapça • app.muallimun.net */}
      <header className="border-b-2 border-black pb-2 flex items-center justify-between">
        <div className="font-extrabold text-[11pt] tracking-tight">
          Muallimun Arapça • app.muallimun.net
        </div>
        <div className="text-[9pt] font-bold">
          {role === "learner"
            ? "Bireysel Öğrenen Çalışma Rehberi & 24 Haftalık Kur Çizelgesi"
            : "Sınıf & Kurs Öğretmeni Rehberi & 24 Haftalık Kur Çizelgesi"}
        </div>
      </header>

      {/* KISA METODOLOJİ ÖZETİ */}
      {role === "learner" ? (
        <section className="border border-slate-400 rounded-lg p-3 space-y-1.5 break-inside-avoid">
          <h2 className="font-extrabold text-[10.5pt]">
            Günlük 30 Dakikalık Rutin &amp; Haftalık 5+1+1 Sistemi (Özet)
          </h2>
          <p className="text-[9pt]">
            <strong>Günlük 30 Dk:</strong> 0–5. dk SRS Tekrar &amp; Hata Defteri •
            5–20. dk 1 Yeni Diyalog (Dinle → Tıkla-Gör &amp; Kök → Yan Yana Gramer →
            Gölgeleme/38 Mahreç → Rol Yapma) • 20–25. dk 5 Görsel Kelime + 5 Kalıp
            Cümle + 2 Atasözü • 25–30. dk Oyun/Üretim (Balon Safari / Kör Dikte /
            İ&apos;rab Boyama).
          </p>
          <p className="text-[9pt]">
            <strong>Haftalık Döngü:</strong> Pazartesi–Cuma 5 Diyalog • Cumartesi
            Okuma Metinleri + Metin Kanıt Dedektifi + 2 Video • Pazar Haftalık KTT +
            28 Harf Mahreç Haritası + A4 Çalışma Kağıdı. Her 6 haftada bir %75+ ile
            Kur Bitirme Sınavı.
          </p>
        </section>
      ) : (
        <section className="border border-slate-400 rounded-lg p-3 space-y-1.5 break-inside-avoid">
          <h2 className="font-extrabold text-[10.5pt]">
            40 Dk Akıllı Tahta Ders Akışı &amp; Kurumsal Planlama Özeti
          </h2>
          <p className="text-[9pt]">
            <strong>40 Dk Tahta Akışı:</strong> 0–5. dk Kör Dinleme (metin gizli
            tahmin) • 5–20. dk Tahta Sunum + Yan Yana Gramer + Sahne Perdesi/Kalem •
            20–30. dk Kura Çarkı ile Rol Yapma + 5 dk A/B Eşli Konuşma • 30–40. dk
            Sınıf Takım Yarışması + Karekodlu Ödev &amp; A4 Ders Föyü.
          </p>
          <p className="text-[9pt]">
            <strong>Kurum Senaryoları:</strong> MEB (2–4 saat/hf, 36 hafta; 1. ve 2.
            dönem yazılılarda A4 Sınav Stüdyosu Karma Aralık + A/B Kitapçık + Maarif
            Rubriği) • Yoğun Dil Kursu/Hazırlık (8–16 saat/hf, her kur 4–6 hafta +
            Haftalık KTT + Kur Bitirme %75+).
          </p>
        </section>
      )}

      {/* PLATFORM ENVANTER SATIRI */}
      <div className="text-[8.5pt] font-semibold text-slate-700 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>• {CONTENT_INVENTORY.dialoguesCount} Diyalog</span>
        <span>• {CONTENT_INVENTORY.readingsCount} Okuma Metni</span>
        <span>• {CONTENT_INVENTORY.sentencesCount.toLocaleString("tr-TR")} Cümle</span>
        <span>• {CONTENT_INVENTORY.visualWordsCount} Görsel Kelime</span>
        <span>• {CONTENT_INVENTORY.proverbsCount} Atasözü</span>
        <span>• {CONTENT_INVENTORY.grammarNotesCount} Gramer Kartı</span>
        <span>• {CONTENT_INVENTORY.exerciseModulesCount} Alıştırma Modülü</span>
        <span>
          • Mevcut İlerleme: {progress.completedUnitsTotal}/
          {progress.totalUnitsTotal} Ders (%{progress.overallPercent})
        </span>
      </div>

      {/* 24 HAFTALIK İŞARETLENEBİLİR A4 TAKİP ÇİZELGESİ */}
      <section className="space-y-1.5">
        <h2 className="font-extrabold text-[10.5pt]">
          24 Haftalık A1–B2 Kur Takip Çizelgesi (Tiklenebilir Kontrol Tablosu)
        </h2>
        <table className="w-full border-collapse border border-slate-500 text-[8.3pt]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-500">
              <th className="border border-slate-400 px-1.5 py-1 text-left whitespace-nowrap">
                Hf / Kur
              </th>
              <th className="border border-slate-400 px-1.5 py-1 text-left">
                Haftalık Odak &amp; KTT
              </th>
              <th className="border border-slate-400 px-1.5 py-1 text-left">
                5 Diyalog (İşaretleyin)
              </th>
              <th className="border border-slate-400 px-1.5 py-1 text-left">
                Okuma Metinleri
              </th>
              <th className="border border-slate-400 px-1.5 py-1 text-center whitespace-nowrap">
                Durum
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => {
              const wp = progress.byWeek[week.weekNumber];
              const doneDialogueSet = new Set(wp?.completedDialogueIds || []);
              const doneReadingSet = new Set(wp?.completedReadingIds || []);
              return (
                <tr
                  key={week.weekNumber}
                  className="border-b border-slate-300 break-inside-avoid"
                >
                  <td className="border border-slate-400 px-1.5 py-1 font-bold whitespace-nowrap align-top">
                    {week.weekNumber}. Hf ({week.level})
                  </td>
                  <td className="border border-slate-400 px-1.5 py-1 align-top">
                    <div className="font-bold">{week.phaseTitleTr}</div>
                    {week.kttTopics.length > 0 && (
                      <div className="text-[7.5pt] text-slate-600">
                        KTT: {week.kttTopics.map((k) => k.ustKonu).join(", ")}
                      </div>
                    )}
                    {week.milestoneExam && (
                      <div className="text-[7.5pt] font-bold">
                        ★ {week.milestoneExam.labelTr}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-400 px-1.5 py-1 align-top">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {week.dialogues.map((d) => (
                        <span key={d.id} className="whitespace-nowrap">
                          {doneDialogueSet.has(d.id) ? "☑" : "☐"}{" "}
                          {d.codeLabel.replace("Diyalog ", "D")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="border border-slate-400 px-1.5 py-1 align-top">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {week.readings.map((r) => (
                        <span key={r.id} className="whitespace-nowrap">
                          {doneReadingSet.has(r.id) ? "☑" : "☐"}{" "}
                          {r.codeLabel.replace("Metin ", "M")}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="border border-slate-400 px-1.5 py-1 text-center font-bold whitespace-nowrap align-top tabular-nums">
                    {wp?.isWeekCompleted ? "☑ %100" : `☐ %${wp?.percent ?? 0}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
