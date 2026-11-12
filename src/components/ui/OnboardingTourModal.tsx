"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  Repeat,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  Rocket,
  Compass,
  PenTool,
  Link2,
  CheckSquare,
  ListOrdered,
  Trophy,
  Type,
  MoreHorizontal,
} from "lucide-react";
import { playClick, playSuccess } from "@/lib/sfxManager";
import { formatArabicText } from "@/lib/arabicTextUtils";
import { CONTENT_INVENTORY, sozluk } from "@/lib/data";
import { useSettings } from "@/store/settings";

export const ONBOARDING_STORAGE_KEY = "arapca_onboarding_done_v1";

export function triggerOnboardingTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-onboarding-tour"));
  }
}

export default function OnboardingTourModal() {
  const router = useRouter();
  const { showHareke, arabicFont } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  const handleComplete = () => {
    playClick();
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  useEffect(() => {
    let raf: number | null = null;
    try {
      const done = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!done) {
        raf = requestAnimationFrame(() => {
          setIsOpen(true);
          setStep(0);
        });
      }
    } catch {
      // ignore storage errors
    }

    const handleOpenEvent = () => {
      setStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-onboarding-tour", handleOpenEvent);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.removeEventListener("open-onboarding-tour", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleComplete();
      if (e.key === "ArrowRight" && step < 5) setStep((s) => s + 1);
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, step]);

  if (!isOpen) return null;

  const formatAr = (t: string) => formatArabicText(t, showHareke, arabicFont);

  const steps = [
    {
      badge: "ADIM 1 / 6 — HOŞ GELDİNİZ",
      title: "Arapça Konuşma, Mahreç ve Diyalog Stüdyosu",
      subtitle:
        "Modern, dokunsal ve yapay zeka destekli Arapça öğrenim platformuna hoş geldiniz!",
      visual: (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1">
            <span className="text-base sm:text-lg font-black text-[#065F46] dark:text-emerald-400 leading-tight block">
              {CONTENT_INVENTORY.dialoguesCount} Diyalog &amp;{" "}
              <span className="whitespace-nowrap">
                {CONTENT_INVENTORY.readingsCount} Metin
              </span>
            </span>
            <p className="text-[11px] font-semibold text-[var(--muted)] leading-snug">
              CEFR A1–B2 seviyelerinde özel görselli, sesli diyaloglar, okuma
              metinleri ve{" "}
              {CONTENT_INVENTORY.sentencesCount.toLocaleString("tr-TR")} kalıp
              cümle
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1">
            <span className="text-base sm:text-lg font-black text-[#6741D9] dark:text-[#d0bfff] leading-tight block">
              {(Math.floor(sozluk.length / 100) * 100).toLocaleString("tr-TR")}+ Sözlük Kaydı
            </span>
            <p className="text-[11px] font-semibold text-[var(--muted)] leading-snug">
              5 kademeli morfolojik çözümleyici ile cümle içinden kök, müfret ve
              cemî analizi
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1">
            <span className="text-base sm:text-lg font-black text-amber-600 leading-tight block">
              16kHz DSP Analiz
            </span>
            <p className="text-[11px] font-semibold text-[var(--muted)] leading-snug">
              Gerçek zamanlı ses dalga formu, ritim ve tempo uyumu karşılaştırması
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] space-y-1">
            <span className="text-base sm:text-lg font-black text-rose-600 leading-tight block">
              38 Mahreç Çifti
            </span>
            <p className="text-[11px] font-semibold text-[var(--muted)] leading-relaxed">
              Türk öğrencilerin sık karıştırdığı{" "}
              <span
                dir="rtl"
                lang="ar"
                className="arabic inline-block font-semibold text-rose-700 dark:text-rose-300 mx-0.5"
              >
                ح/ه
              </span>
              ,{" "}
              <span
                dir="rtl"
                lang="ar"
                className="arabic inline-block font-semibold text-rose-700 dark:text-rose-300 mx-0.5"
              >
                ص/س
              </span>
              ,{" "}
              <span
                dir="rtl"
                lang="ar"
                className="arabic inline-block font-semibold text-rose-700 dark:text-rose-300 mx-0.5"
              >
                ذ/ز
              </span>
              ,{" "}
              <span
                dir="rtl"
                lang="ar"
                className="arabic inline-block font-semibold text-rose-700 dark:text-rose-300 mx-0.5"
              >
                ظ/ض
              </span>{" "}
              harflerine özel koçluk
            </p>
          </div>
        </div>
      ),
    },
    {
      badge: "ADIM 2 / 6 — HIZLI KONTROLLER",
      title: "Üst Bar Hızlı Ayar ve Sınıf İkonları",
      subtitle:
        "Sayfadan ayrılmadan üst bardaki hızlı araçlarla okuma, ses ve tahta deneyiminizi yönetin:",
      visual: (
        <div className="space-y-2">
          {[
            {
              icon: Sparkles,
              color:
                "bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-400 border-[#087F5B]",
              name: "3 Kademeli Hareke Modu (Hareke Solması)",
              desc: "Tam Harekeli, Hareke Solması (sadece son İ'rab & şedde) ve Harekesiz okuma geçişi.",
            },
            {
              icon: Type,
              color: "bg-[#6741D9]/15 text-[#6741D9] border-[#6741D9]",
              name: "5 Arapça Font, Yazı Boyutu & 5 Görünüm Modu",
              desc: "Alt Alta, İki Sütun, Sadece Arapça, Sadece Türkçe ve Tıkla-Gör (Çeviri Gizli) düzenleri.",
            },
            {
              icon: PenTool,
              color: "bg-amber-100 text-amber-800 border-amber-400",
              name: "Akıllı Tahta Çizim & Ders Sayacı / Kura (⏱️)",
              desc: "Ekran üstü kalem, fosforlu kalem, şekiller, tahta perdesi, kronometre HUD ve kura çarkı.",
            },
            {
              icon: MoreHorizontal,
              color: "bg-sky-100 text-sky-800 border-sky-400",
              name: "Diğer Araçlar (⋯): 0.5x–1.5x Hız, Ses & Gramer",
              desc: "Erkek/Kadın seslendirici, Sade/Akademik gramer, Sıcak Krem/Gece teması ve mikrofon testi.",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)]"
              >
                <div
                  className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 ${item.color}`}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-extrabold text-[var(--foreground)]">
                    {item.name}
                  </span>
                  <span className="block text-[11px] font-medium text-[var(--muted)]">
                    {item.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
    {
      badge: "ADIM 3 / 6 — DİYALOG & METİN STÜDYOSU",
      title: "5 Çalışma Modu, Yan Yana Gramer & Canlı Ok Takibi",
      subtitle:
        "Diyalog ve okuma metni sayfalarında 5 pedagojik çalışma modu ve bölünmüş ekran gramer paneli yer alır:",
      visual: (
        <div className="space-y-3">
          {/* Canlı Kelime & Ok Takibi Önizlemesi */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[#065F46] dark:text-emerald-400">
              <span>🎯 Canlı Karaoke Kelime &amp; Ok Takibi (RTL)</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#6741D9] text-white">
                <Repeat size={11} /> Döngü: 1x / 2x / 3x / 5x / ∞
              </span>
            </div>
            <div
              dir="rtl"
              className="arabic text-2xl sm:text-3xl font-bold text-right py-2 px-2"
            >
              <span>السَّلَامُ </span>
              <span className="inline-block relative bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/40 rounded-lg px-1.5 mx-0.5">
                <span className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 text-[11px] font-black text-[#065F46] dark:text-emerald-400">
                  ▼
                </span>
                {formatAr("عَلَيْكُمْ")}
                <span className="pointer-events-none absolute -bottom-0.5 right-0 w-3/4 h-0.5 rounded-full bg-emerald-500" />
              </span>
              <span> يَا أَخِي</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE]">
              <strong className="text-[#065F46] dark:text-emerald-400 block">
                📖 1. Dinle &amp; İncele
              </strong>
              <span className="text-[11px] text-[var(--muted)]">
                Ok takipli sesli okuma, paragraf/cümle akışı ve döngü
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE]">
              <strong className="text-[#6741D9] block">
                🎙️ 2. Telaffuz Stüdyosu
              </strong>
              <span className="text-[11px] text-[var(--muted)]">
                Ses kaydı, 28 harf ve 38 mahreç çifti koçluğu
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE]">
              <strong className="text-amber-700 block">
                🎭 3. Rol Yapma / ❓ Sorular
              </strong>
              <span className="text-[11px] text-[var(--muted)]">
                Diyalogda karşılıklı konuşma, metinde anlama soruları
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE]">
              <strong className="text-sky-700 block">
                📚 4. Konu Sözlüğü &amp; 📌 5. Odak Gramer
              </strong>
              <span className="text-[11px] text-[var(--muted)]">
                Kelime çekimleri ve metinle Yan Yana Gramer paneli
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border border-[#6741D9]/40 text-[11px] text-[var(--foreground)] space-y-1">
            <span className="font-extrabold text-[#4C28B5] dark:text-[#d0bfff] block">
              📌 Yan Yana Gramer, ✨ Kalıp İfadeler &amp; 🗣️ İkili (A/B) Kartlar:
            </span>
            <p className="text-[var(--muted)] leading-snug">
              Metni kapatmadan <strong>Yan Yana Gramer</strong> paneliyle i&apos;rab
              kurallarını inceleyin; <strong>🗣️ İkili Bilgi Boşluğu (A/B)</strong>{" "}
              kartları ve cümleler arası gölgeleme sayacıyla pratik yapın.
            </p>
          </div>
        </div>
      ),
    },
    {
      badge: "ADIM 4 / 6 — MORFOLOJİK SÖZLÜK",
      title: "Tıklanabilir Kök Analizi & Kelime Renk Kodları",
      subtitle:
        "Cümle içindeki herhangi bir Arapça kelimeye tıkladığınızda morfolojik ayrıştırma ve tür rengi açılır:",
      visual: (
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border-2 border-amber-300 border-l-4 border-l-amber-500 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                ⚡ Fiil (فعل) — Kehribar Vurgu
              </span>
              <p className="text-xs font-bold text-[var(--foreground)] mt-1">
                Mâzî, Muzâri, Masdar ve Kök harflerini gösterir
              </p>
            </div>
            <span
              dir="rtl"
              className="arabic text-2xl font-bold text-amber-700 dark:text-amber-300 shrink-0"
            >
              {formatAr("أَسْتَوْدِعُكَ")}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/90 dark:bg-sky-950/30 border-2 border-sky-300 border-l-4 border-l-sky-500 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-extrabold">
                📘 İsim (اسم) — Mavi Vurgu
              </span>
              <p className="text-xs font-bold text-[var(--foreground)] mt-1">
                Müfret (Tekil), Cemî (Çoğul) ve harf-i tarif yapısını gösterir
              </p>
            </div>
            <span
              dir="rtl"
              className="arabic text-2xl font-bold text-sky-700 dark:text-sky-300 shrink-0"
            >
              {formatAr("الْمُسَافِرُ")}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50/90 dark:bg-purple-950/30 border-2 border-purple-300 border-l-4 border-l-purple-500 flex items-center justify-between gap-3">
            <div>
              <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-extrabold">
                🔗 Edat / Kalıp (حرف) — Mor Vurgu
              </span>
              <p className="text-xs font-bold text-[var(--foreground)] mt-1">
                Harf-i cerler, bağlaçlar, zarflar ve kalıp ifadeleri gösterir
              </p>
            </div>
            <span
              dir="rtl"
              className="arabic text-2xl font-bold text-purple-700 dark:text-purple-300 shrink-0"
            >
              {formatAr("عَلَى خَيْرٍ")}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-400 text-[11px] space-y-0.5">
            <span className="font-extrabold text-[#065F46] dark:text-emerald-300 block">
              🌿 Sözlükte Kök Ailesi (İştikak) &amp; Canlı Örnek Cümleler:
            </span>
            <p className="text-[var(--muted)] leading-snug">
              Bir kelimenin kökünden türeyen tüm kardeş kelimeleri ve
              diyaloglardaki gerçek sesli örnek cümlelerini tek tıkla inceleyin.
            </p>
          </div>
        </div>
      ),
    },
    {
      badge: "ADIM 5 / 6 — ALIŞTIRMA MERKEZİ & SRS HAFIZA SİSTEMİ",
      title: `${CONTENT_INVENTORY.exerciseModulesCount} Modüllü Alıştırma Merkezi & Aralıklı Tekrar (SRS)`,
      subtitle:
        "🎯 'Bugün Ne Çalışmalıyım?' günlük 12 dk kişisel çalışma paketi ve 5 aşamalı (1, 3, 7, 14, 30 gün) akıllı hafıza sistemi:",
      visual: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#087F5B]/15 text-[#065F46] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                3B Kelime & Kısa Cümle Kartları
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                Sesli ön/arka yüz çevirmeli kelime ve kalıp cümle kartları
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#6741D9]/15 text-[#6741D9] flex items-center justify-center shrink-0">
              <CheckSquare size={16} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                Çoktan Seçmeli Test
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                Kelime, cümle veya karışık havuzdan süreli/süresiz testler
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <PenTool size={16} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                Sürükle-Bırak & Dinle-Yaz İmla
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                Kelimeyi boşluğa sürükleyin veya sanal Arapça klavyeyle yazın
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Link2 size={16} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                Ok Çizimli Eşleştirme
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                Soketlerden sürükleyip ok çizerek Türkçe-Arapça eşleştirme
              </span>
            </div>
          </div>

          <div className="sm:col-span-2 p-3 rounded-2xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9] flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#6741D9] text-white flex items-center justify-center shrink-0">
              <ListOrdered size={16} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-[#4C28B5] dark:text-[#d0bfff]">
                🧩 14 Etkileşimli Modül + 🎯 Aralıklı Tekrar (SRS)
              </span>
              <span className="block text-[11px] text-[var(--muted)]">
                Dinle-Sırala, Görsel Eşleştirme, Hata Avcısı, Kör Dikte, Diyalog
                Tamamlama, Müzekker/Müennes Tasnifi, Metin Kanıt Dedektifi,
                İ&apos;rab Renk Boyama ve Sınıf Takım Yarışması ile 5 aşamalı SRS
                tekrar sistemi.
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      badge: "ADIM 6 / 6 — ÖDEV SİSTEMİ, A4 QUİZ, ÇEVRİMDIŞI & TAHTA MODU",
      title: "QR Ödev Sistemi, A4 Quiz, Çevrimdışı & Akıllı Tahta",
      subtitle:
        "Sınıf içi ve bireysel çalışmalarda öğretmen ve öğrenciler için tam donanımlı araçlar:",
      visual: (
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-white dark:bg-[var(--background)] border-2 border-[#087F5B] flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="space-y-0.5">
              <span className="block text-xs font-extrabold text-[var(--foreground)]">
                🎓 Öğretmen Ödev &amp; QR Sistemi + A4 Quiz Üretici
              </span>
              <p className="text-[11px] font-medium text-[var(--muted)] leading-snug">
                Öğretmenler için karekodlu ödev linki, öğrenciler için doğrulama
                kodlu ödev karnesi ve cevap anahtarlı tek sayfa A4 Çalışma/Quiz
                kağıdı.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border-2 border-amber-400 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Trophy size={18} />
            </div>
            <div>
              <span className="block text-xs font-extrabold text-amber-900 dark:text-amber-200">
                📥 Çevrimdışı Ders Paketleri &amp; Kör Dinleme / Akıllı Tahta Modu
              </span>
              <p className="text-[11px] font-medium text-[var(--muted)] leading-snug">
                İnternetsiz ses indirme, bulanık metinle{" "}
                <strong>👁️ Kör Dinleme</strong>, sınıfta{" "}
                <strong>🖥️ Akıllı Tahta Sunum Modu</strong> ve PNG Başarı
                Karnesi paylaşımı.
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] space-y-1.5">
            <span className="block text-xs font-extrabold text-[#4C28B5] dark:text-[#d0bfff]">
              🔤 5 Seçkin Arapça Font & Lafzatullah Tipografi Motoru:
            </span>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
              {[
                "1. Arakom (Varsayılan)",
                "2. Amiri (Klasik Mushaf)",
                "3. Scheherazade New",
                "4. Noto Naskh Arabic",
                "5. Lateef",
              ].map((f) => (
                <span
                  key={f}
                  className="px-2.5 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] text-[var(--foreground)]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <div
      className="fixed inset-0 z-[60] print:hidden bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={handleComplete}
    >
      <div
        className="w-full max-w-lg bg-[#FDFBF7] dark:bg-[var(--surface)] rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ÜST BAR */}
        <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-4 sm:px-5 py-3 border-b-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-[#6741D9] text-white text-[10px] font-extrabold tracking-wider uppercase truncate">
            {current.badge}
          </span>

          <button
            type="button"
            onClick={handleComplete}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] text-xs font-extrabold text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Turu Atla</span>
            <X size={13} />
          </button>
        </div>

        {/* GÖVDE */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--foreground)] leading-snug">
              {current.title}
            </h2>
            <p className="text-xs font-semibold text-[var(--muted)] leading-relaxed">
              {current.subtitle}
            </p>
          </div>

          {current.visual}
        </div>

        {/* ALT NAVİGASYON VE İLERLEME NOKTALARI */}
        <div className="bg-[#F7EFE1] dark:bg-[var(--background)] px-5 py-3.5 border-t-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between gap-3 shrink-0">
          {/* İlerleme Noktaları */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  playClick();
                  setStep(idx);
                }}
                aria-label={`Adım ${idx + 1}`}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  idx === step
                    ? "w-6 bg-[#087F5B]"
                    : "w-2.5 bg-[#cbb692] dark:bg-slate-600"
                }`}
              />
            ))}
          </div>

          {/* Geri / İleri / Başla Butonları */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setStep((s) => s - 1);
                }}
                className="h-9 px-3.5 rounded-xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} />
                <span>Geri</span>
              </button>
            )}

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  playClick();
                  setStep((s) => s + 1);
                }}
                className="h-9 px-4 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-[#087F5B] flex items-center gap-1 cursor-pointer"
              >
                <span>İleri</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    playSuccess();
                    handleComplete();
                    router.push("/seviye-tespit");
                  }}
                  className="h-9 px-3.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold border-b-3 border-emerald-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass size={14} />
                  <span>🧭 Seviyemi Belirle</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playSuccess();
                    handleComplete();
                  }}
                  className="h-9 px-4 rounded-xl bg-[#6741D9] hover:bg-[#5230B5] text-white text-xs font-extrabold border-b-3 border-[#3b1f8c] flex items-center gap-1.5 cursor-pointer"
                >
                  <Rocket size={14} />
                  <span>🚀 Uygulamaya Başla</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
