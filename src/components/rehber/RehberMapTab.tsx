"use client";

import Link from "next/link";
import {
  Sparkles,
  Type,
  PenTool,
  Timer,
  Dices,
  MoreHorizontal,
  Home,
  BookOpen,
  Headphones,
  Gamepad2,
  Compass,
  BookMarked,
  Settings,
  ArrowUpRight,
  Volume2,
  Repeat,
  Mic,
  Users,
  EyeOff,
  Columns2,
  FileText,
  QrCode,
  Image as ImageIcon,
  Layers,
  GraduationCap,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import { getDynamicKttTopicCount, type RehberRole } from "@/lib/rehberCurriculum";
import { useSettings } from "@/store/settings";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";
import { triggerGuideModal } from "@/components/ui/GuideAndInfoModal";
import { playClick } from "@/lib/sfxManager";

interface RehberMapTabProps {
  role: RehberRole;
}

const HAREKE_LABELS: Record<string, string> = {
  full: "1. Kademe: Tam Harekeli",
  faded: "2. Kademe: Hareke Solması (Sadece İ'rab & Şedde)",
  none: "3. Kademe: Harekesiz Okuma",
};

interface LibrarySubTabCard {
  badge: string;
  title: string;
  purposeLearner: string;
  purposeTeacher: string;
  href: string;
}

interface ExerciseModuleGuideItem {
  no: number;
  title: string;
  skillBadge: string;
  description: string;
  href: string;
  teacherStar?: boolean;
}

export default function RehberMapTab({ role }: RehberMapTabProps) {
  const { harekeMode, cycleHarekeMode } = useSettings();
  const { toggleToolbar, toggleTimer, togglePicker } = useClassroomToolsStore();
  const kttTopicCount = getDynamicKttTopicCount();
  const totalOfflinePacks =
    CONTENT_INVENTORY.dialoguesCount + CONTENT_INVENTORY.readingsCount;

  const libraryTabs: LibrarySubTabCard[] = [
    {
      badge: "1. Sekme",
      title: "Vitrin (Öne Çıkanlar & Hızlı Keşif)",
      purposeLearner:
        "Kurunuza uygun günün diyaloğu, atasözü, görsel kelimesi ve video önerisine tek ekrandan ulaşın.",
      purposeTeacher:
        "Derse girerken günün ısınma içeriğini ve kur vitrinini tahtada anında açın.",
      href: "/kutuphane?tab=vitrin",
    },
    {
      badge: "2. Sekme",
      title: `${CONTENT_INVENTORY.dialoguesCount.toLocaleString("tr-TR")} Diyalog (A1–B2 İletişim Omurgası)`,
      purposeLearner:
        "Her kurda 30 diyalog; çift cinsiyet seslendirme, kelime analizi, rol yapma ve mahreç koçu ile çalışılır.",
      purposeTeacher:
        "Akıllı tahtada satır satır dinletin, A/B bilgi boşluğu kartı ve karekodlu ev ödevi üretin.",
      href: "/kutuphane?tab=diyaloglar",
    },
    {
      badge: "3. Sekme",
      title: `${CONTENT_INVENTORY.readingsCount.toLocaleString("tr-TR")} Okuma Metni (Anlama & Kanıt Avı)`,
      purposeLearner:
        "Paragraf okuma akıcılığı, metin altı kavrama soruları ve bağlamsal kelime hazinesi kazandırır.",
      purposeTeacher:
        "Sınıfta sesli okuma, satır perdeleme ve Metin Kanıt Dedektifi etkinliği için temel kaynaktır.",
      href: "/kutuphane?tab=metinler",
    },
    {
      badge: "4. Sekme",
      title: `${CONTENT_INVENTORY.sentencesCount.toLocaleString("tr-TR")} Günlük Kalıp Cümle`,
      purposeLearner:
        "Tematik kategorilere ayrılmış konuşma kalıplarını dinleyip gölgeleme (shadowing) yaparak ezberleyin.",
      purposeTeacher:
        "Konuşma derslerinde nöbetleşe tekrar ve hızlı Türkçe->Arapça sözlü çeviri turu yaptırın.",
      href: "/kutuphane?tab=cumleler",
    },
    {
      badge: "5. Sekme",
      title: `${CONTENT_INVENTORY.proverbsCount.toLocaleString("tr-TR")} Atasözü ve Hikmetli Söz`,
      purposeLearner:
        "Klasik ve modern Arap kültüründeki veciz ifadeleri lafzî + mecazî anlamlarıyla öğrenin.",
      purposeTeacher:
        "Dersin son 3 dakikasında 'Günün Hikmeti' olarak tahtada açıp görsel kart olarak paylaşın.",
      href: "/kutuphane?tab=atasozleri",
    },
    {
      badge: "6. Sekme",
      title: `${CONTENT_INVENTORY.visualWordsCount.toLocaleString("tr-TR")} Görsel Kelime Kartı`,
      purposeLearner:
        "Özel illüstrasyonlu kelimeleri örnek cümlesi ve sesiyle görsel hafızaya kodlayın.",
      purposeTeacher:
        "A1–A2 sınıflarında resimli kelime tanıtımı ve Kes-Katla A4 kelime kartı baskısı için kullanın.",
      href: "/kutuphane?tab=gorsel-kelimeler",
    },
    {
      badge: "7. Sekme",
      title: `${CONTENT_INVENTORY.grammarNotesCount.toLocaleString("tr-TR")} Gramer Atlası Kartı`,
      purposeLearner:
        "120 diyalog + 60 metin + 15 müstakil kural kartı; A1 sezdirme özeti ve kelime kelime i'rab tahlili içerir.",
      purposeTeacher:
        "Kural anlatımında 'Sade Anlatım / Akademik & İ'rab' şalteriyle sınıf seviyesine göre derinliği ayarlayın.",
      href: "/kutuphane?tab=gramer",
    },
    {
      badge: "8. Sekme",
      title: `${CONTENT_INVENTORY.synonymsAntonymsCount.toLocaleString("tr-TR")} Eş & Zıt Anlamlılar Atlası`,
      purposeLearner:
        "Kelime dağarcığınızı ince anlam farkları (nüans notları) ve zıt kutuplarıyla genişletin.",
      purposeTeacher:
        "B1–B2 kelime zenginleştirme derslerinde ve eşleştirme yarışmalarında doğrudan kullanın.",
      href: "/kutuphane?tab=es-zit",
    },
    {
      badge: "9. Sekme",
      title: `${CONTENT_INVENTORY.youtubeVideosCount.toLocaleString("tr-TR")} Video & Oynatma Listesi Rehberi`,
      purposeLearner:
        `${CONTENT_INVENTORY.youtubeSingleVideosCount} tekil ders + ${CONTENT_INVENTORY.youtubePlaylistsCount} oynatma listesiyle doğal Arapça kulak dolgunluğu kazanın.`,
      purposeTeacher:
        "Hafta sonu dinleme/izleme ödevi verin; bölüm bazlı izleme takibiyle sürekliliği koruyun.",
      href: "/kutuphane?tab=videolar",
    },
    {
      badge: "10. Sekme",
      title: "❤️ Defterim (Kaydedilen Kelime & Dersler)",
      purposeLearner:
        "Diyalog ve metinlerde tıklayıp kalp ikonuna bastığınız tüm kelimeler kişisel tekrar havuzunuzda toplanır.",
      purposeTeacher:
        "Ders esnasında öğrencilerin zorlandığı kelimeleri işaretleyip ders sonu mini sınav havuzu oluşturun.",
      href: "/kutuphane?tab=saved-words",
    },
    {
      badge: "11. Sekme",
      title: "🎯 38 Mahreç Tekrarım (Telaffuz Odak Havuzu)",
      purposeLearner:
        "Yapay zekâ mahreç koçunda zorlandığınız harfleri (ع، ح، ق، ض، ظ، ث، ذ vb.) içeren kelimeleri özel çalıştırır.",
      purposeTeacher:
        "Sınıfta sık karıştırılan boğaz ve peltek harfleri toplu telaffuz talimiyle düzeltin.",
      href: "/kutuphane?tab=weak-words",
    },
  ];

  const exerciseModules: ExerciseModuleGuideItem[] = [
    {
      no: 1,
      title: "Görsel Hız Seansı",
      skillBadge: "Görsel Kelime • Refleks",
      description:
        "Süreye karşı görsel-kelime eşleştirmesiyle düşünmeden Arapça hatırlama refleksi kazandırır.",
      href: "/alistirmalar?mode=visual-swipe-sprint",
    },
    {
      no: 2,
      title: "Balon Safari",
      skillBadge: "Kelime & Hız • Oyun",
      description:
        "Sağdan akan balonlar içinden doğru Arapça karşılığı yakalayın; altın balonlarla kombo yapın.",
      href: "/alistirmalar?mode=balloon-safari",
      teacherStar: true,
    },
    {
      no: 3,
      title: "Hafızanı Yokla",
      skillBadge: "Görsel-İşitsel Bellek",
      description:
        "Kapalı kartları eşleştirerek Arapça lafız, ses ve Türkçe anlam bağını güçlendirir.",
      href: "/alistirmalar?mode=memory-flip",
    },
    {
      no: 4,
      title: "Bu Nedir?",
      skillBadge: "Görsel Tanıma • A1–A2",
      description:
        "İllüstrasyona bakıp doğru harekeli Arapça kelimeyi seçerek doğrudan kavram kodlaması yapar.",
      href: "/alistirmalar?mode=what-is-this",
    },
    {
      no: 5,
      title: "Görsel & Sesli Eşleştirme",
      skillBadge: "Dinleme + Görsel Bağ",
      description:
        "Rosetta tarzı 4'lü görsel-ses matrisinde duyduğunuz ifadeyi resimler üzerinden yakalayın.",
      href: "/alistirmalar?mode=visual-rosetta",
    },
    {
      no: 6,
      title: "Kelime Kartları (SRS)",
      skillBadge: "Aralıklı Tekrar • Hafıza",
      description:
        "Çift yüzlü kartlarla 5 kademeli (1, 3, 7, 14, 30 gün) bilimsel aralıklı tekrar (SRS) uygulaması.",
      href: "/alistirmalar?mode=flashcard",
    },
    {
      no: 7,
      title: "Çoktan Seçmeli Test",
      skillBadge: "Kelime & Bağlam • Gramer",
      description:
        "Çeldirici analizli 4 şıklı sorular; yanlışta tek tıkla ilgili Gramer Hap Bilgi kartını açar.",
      href: "/alistirmalar?mode=multiple-choice",
    },
    {
      no: 8,
      title: "Ok Çizerek Eşleştirme",
      skillBadge: "Eş/Zıt & Kelime İlişkisi",
      description:
        "Sağ ve sol sütunlar arasında çizgi çekerek kelime, anlam veya eş/zıt anlam çiftlerini birleştirin.",
      href: "/alistirmalar?mode=matching",
    },
    {
      no: 9,
      title: "Müzekker / Müennes Sepeti",
      skillBadge: "Sarf • Cinsiyet Uyumu",
      description:
        "Hakiki, lafzî ve semâî müennes/müzekker isimleri doğru sepete ayırarak uyum temelini sağlamlaştırır.",
      href: "/alistirmalar?mode=gender-sorting",
    },
    {
      no: 10,
      title: "Hata Avcısı",
      skillBadge: "Nahiv & İmla Denetimi",
      description:
        "Cümledeki kasıtlı i'rab, uyum veya harf-i cer hatasını bulup doğrusunu seçin.",
      href: "/alistirmalar?mode=error-hunter",
      teacherStar: true,
    },
    {
      no: 11,
      title: "İ'rab Renkleriyle Boya",
      skillBadge: "Nahiv • Cümle Ögeleri",
      description:
        "5 renkli i'rab fırçasıyla (Merfû, Mansûb, Mecrûr, Haber, Fiil) cümlenin kelimelerini boyayın.",
      href: "/alistirmalar?mode=irab-painter",
      teacherStar: true,
    },
    {
      no: 12,
      title: "Sarf-Kök Atölyesi",
      skillBadge: "Üçlü Kök & Vezin Analizi",
      description:
        "Kelimenin sülâsî kökünü, bâbını ve türev ailesini bağlam içinde çözümleyin.",
      href: "/alistirmalar?mode=morphology-context",
    },
    {
      no: 13,
      title: "Cümle Kurma",
      skillBadge: "Sözdizimi • Üretim",
      description:
        "Karışık verilen Arapça kelimeleri sağdan sola doğru nahiv dizilimiyle anlamlı cümleye dönüştürün.",
      href: "/alistirmalar?mode=sentence-builder",
    },
    {
      no: 14,
      title: "Boşluk Doldurma",
      skillBadge: "Bağlamsal Kalıp & Edat",
      description:
        "Cümle içindeki eksik fiil çekimini, zamiri veya harf-i ceri bağlama göre tamamlayın.",
      href: "/alistirmalar?mode=fill-in-blanks",
    },
    {
      no: 15,
      title: "Kör Dikte (Dinle & Yaz)",
      skillBadge: "Dinleme + Arapça Klavye",
      description:
        "Metni görmeden sadece sesi dinleyerek dahili ekran klavyesi veya fiziksel klavyeyle yazın.",
      href: "/alistirmalar?mode=blind-dictation",
    },
    {
      no: 16,
      title: "Diyalog Boş Replik",
      skillBadge: "Karşılıklı Konuşma Akışı",
      description:
        "Gerçek diyalog akışında boş bırakılan repliği bağlama en uygun ifadeyle tamamlayın.",
      href: "/alistirmalar?mode=cloze-roleplay",
    },
    {
      no: 17,
      title: "Metin Kanıt Dedektifi",
      skillBadge: "Okuma • Kanıt Bulma",
      description:
        "Okuma parçasındaki sorunun cevabını kanıtlayan tam cümleyi metin içinden bulup işaretleyin.",
      href: "/alistirmalar?mode=evidence-hunter",
      teacherStar: true,
    },
    {
      no: 18,
      title: "Sınıf Takım Yarışması",
      skillBadge: "Akıllı Tahta • 2–4 Takım",
      description:
        "Sınıfı takımlara bölüp tahtada süreye ve kombo puanına karşı yarıştıran canlı turnuva modu.",
      href: "/alistirmalar?mode=classroom-battle",
      teacherStar: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ROL DUYARLI HIZLI PUSULA ŞERİDİ */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#087F5B] dark:text-emerald-300">
            <Compass size={15} className="shrink-0" />
            <span>
              {role === "learner"
                ? "🎓 Bireysel Öğrenen Harita Görünümü Aktif"
                : "👨‍🏫 Sınıf & Kurs Öğretmeni Harita Görünümü Aktif"}
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[var(--foreground)]">
            {role === "learner"
              ? "Aşağıdaki her kartta hangi aracın nerede durduğunu görebilir ve 'Şimdi Dene' butonlarıyla doğrudan ilgili modüle geçebilirsiniz."
              : "Akıllı tahta araçlarını, sınıf içi yarışma modüllerini, A/B eşli konuşma kartlarını ve karekodlu ödev/A4 sınav üretim noktalarını tek ekrandan yönetebilirsiniz."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              triggerGuideModal("icons");
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] dark:text-purple-300 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>İkon &amp; Renk Sözlüğü</span>
          </button>
          <Link
            href="/diyalog/dlg_001"
            onClick={() => playClick()}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Örnek Stüdyoyu Aç (Diyalog 1)</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* 1. ÜST KONTROL ÇUBUĞU (HEADER) ARAÇLARI */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
              1. Bölüm • Her Sayfada Sabit Üst Çubuk
            </span>
            <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
              Üst Kontrol Çubuğu (Header) Araçları Ne İşe Yarar?
            </h2>
          </div>
          <span className="text-xs font-bold text-[var(--muted)] tabular-nums">
            5 Anlık Kontrol Aracı
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Hareke Modu */}
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#087F5B]/15 text-[#087F5B] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  ✨ Hareke Modu (3 Kademeli)
                </h3>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Tüm uygulamadaki Arapça metinleri tek tıkla{" "}
                <strong className="text-[var(--foreground)]">Tam Harekeli</strong>{" "}
                →{" "}
                <strong className="text-[var(--foreground)]">
                  Hareke Solması (Sadece İ&apos;rab &amp; Şedde)
                </strong>{" "}
                →{" "}
                <strong className="text-[var(--foreground)]">
                  Harekesiz Okuma
                </strong>{" "}
                arasında geçirir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playClick();
                cycleHarekeMode();
              }}
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#087F5B]/50 hover:border-[#087F5B] text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="truncate">
                {HAREKE_LABELS[harekeMode] || "Tam Harekeli"}
              </span>
              <span className="shrink-0 underline">Değiştir</span>
            </button>
          </div>

          {/* T Görünüm & Font */}
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#6741D9]/15 text-[#6741D9] dark:text-purple-300 flex items-center justify-center shrink-0">
                  <Type size={16} />
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  T Görünüm &amp; Font (5 Çeviri Modu)
                </h3>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                <strong className="text-[var(--foreground)]">Alt Alta</strong>,{" "}
                <strong className="text-[var(--foreground)]">İki Sütun</strong>,{" "}
                <strong className="text-[var(--foreground)]">Sadece Arapça</strong>,{" "}
                <strong className="text-[var(--foreground)]">
                  Sadece Türkçe (Kendini Sına)
                </strong>{" "}
                ve{" "}
                <strong className="text-[var(--foreground)]">
                  Tıkla-Gör (Çeviri Gizli)
                </strong>{" "}
                modlarıyla birlikte Arapça font/punto ve ses hızını (0.5x–1.5x) ayarlar.
              </p>
            </div>
            <Link
              href="/ayarlar"
              onClick={() => playClick()}
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] dark:text-purple-300 flex items-center justify-between gap-2"
            >
              <span>Font &amp; Görünüm Ayarları</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Akıllı Tahta Çizim & Perde */}
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#D97706]/15 text-[#D97706] dark:text-amber-300 flex items-center justify-center shrink-0">
                  <PenTool size={16} />
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  🖊️ Akıllı Tahta Çizim &amp; Perde
                </h3>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Her sayfanın üzerinde serbest kalem, fosforlu vurgu, ok/şekil çizimi,
                5 semantik i&apos;rab rengi ve satır odaklama{" "}
                <strong className="text-[var(--foreground)]">Sahne Perdesi</strong>{" "}
                açar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playClick();
                toggleToolbar();
              }}
              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#D97706]/50 hover:border-[#D97706] text-xs font-extrabold text-[#B45309] dark:text-amber-300 flex items-center justify-between gap-2 cursor-pointer"
            >
              <span>Tahta Kalem Çubuğunu Aç/Kapat</span>
              <PenTool size={13} />
            </button>
          </div>

          {/* Ders Sayacı & Kura Çarkı */}
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#087F5B]/15 text-[#087F5B] dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Timer size={16} />
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  ⏱️ Ders Sayacı &amp; 🎲 Sınıf Kura Çarkı
                </h3>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Etkinlikler için geri sayım/kronometre başlatır;{" "}
                <strong className="text-[var(--foreground)]">Sınıf Kura Çarkı</strong>{" "}
                ise öğrenci listesinden tekrarsız adil söz hakkı seçer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  toggleTimer();
                }}
                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Timer size={13} />
                <span>Sayaç</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  togglePicker();
                }}
                className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Dices size={13} />
                <span>Kura Çarkı</span>
              </button>
            </div>
          </div>

          {/* ⋯ Araçlar Menüsü */}
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-slate-500/15 text-[var(--foreground)] flex items-center justify-center shrink-0">
                  <MoreHorizontal size={16} />
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  ⋯ Araçlar Menüsü (Hızlı Erişim Çekmecesi)
                </h3>
              </div>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Sağ üstteki <strong className="text-[var(--foreground)]">⋯</strong>{" "}
                butonu; gece/gündüz teması, ses efektleri, tam ekran modu, PWA ana
                ekrana kurulum, hızlı ikon rehberi (?) ve bu kapsamlı{" "}
                <strong className="text-[var(--foreground)]">/rehber</strong>{" "}
                merkezine anında geçiş sağlar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  triggerGuideModal("quickstart");
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#6741D9] text-xs font-extrabold text-[#6741D9] dark:text-purple-300 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <HelpCircle size={13} />
                <span>Hızlı Rehber Penceresini (?) Aç</span>
              </button>
              <Link
                href="/ayarlar"
                onClick={() => playClick()}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Settings size={13} />
                <span>Tüm Ayarlar &amp; Yedekleme</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ANA SAYFA (/) KOMUTA MERKEZİ */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
              <Home size={18} />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
                2. Bölüm • Ana Sayfa (/)
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                Kişisel Öğrenme Panosu &amp; Günlük Rota
              </h2>
            </div>
          </div>
          <Link
            href="/"
            onClick={() => playClick()}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
          >
            <span>Ana Sayfaya Git</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-purple-300">
                İlk Adım • Akıllı Tanı
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🧭 Seviyemi Belirle (3 Dk Akıllı CAT Testi)
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Cevabınıza göre zorluğu anlık değişen 10–20 soruluk adaptif sınavla
                gerçek CEFR kurunuzu (A1–B2) tespit eder ve tüm ana sayfayı o kura
                göre kişiselleştirir.
              </p>
            </div>
            <Link
              href="/seviye-tespit?mode=cat&autostart=1"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center justify-between gap-2"
            >
              <span>Şimdi Dene (CAT Testi)</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-[#D97706] dark:text-amber-300">
                Motivasyon &amp; Analitik
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🏆 Başarılarım, Rütbem &amp; CEFR Haritası
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                <strong className="text-[var(--foreground)]">Bronz Talebe</strong>{" "}
                rütbesinden{" "}
                <strong className="text-[var(--foreground)]">Fasih Üstad</strong>{" "}
                zirvesine ilerleyişinizi, 28 harf mahreç ısı haritanızı ve{" "}
                {CONTENT_INVENTORY.grammarNotesCount} gramer kazanım matrisini izler.
              </p>
            </div>
            <Link
              href="/"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#D97706] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center justify-between gap-2"
            >
              <span>Rütbe &amp; Rozet Panosu</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-300">
                Günlük Pusula
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🎯 Bugünkü 30 Dakikalık 4 Adımlı Çalışma Rotam
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                &ldquo;Bugün nereden başlamalıyım?&rdquo; kararsızlığını bitirir:
                (1) SRS Tekrar, (2) Sıradaki Diyalog, (3) Telaffuz/Gölgeleme, (4)
                Oyun/Pekiştirme adımlarını canlı tiklerle takip eder.
              </p>
            </div>
            <Link
              href="/alistirmalar?plan=daily"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center justify-between gap-2"
            >
              <span>Günlük Paketi Başlat</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. EĞİTİM KÜTÜPHANESİ (/kutuphane) — 11 SEKME + ÇİFT CİNSİYET SES */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#6741D9] text-white flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
                3. Bölüm • Eğitim Kütüphanesi (/kutuphane)
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                11 Sekmeli İçerik Kütüphanesi &amp; Çift Cinsiyet Ses Seçici
              </h2>
            </div>
          </div>

          <div className="rounded-xl bg-[#F3F0FF] dark:bg-purple-950/40 border border-[#6741D9]/40 px-3 py-2 text-xs font-bold text-[#4C28B5] dark:text-purple-200 flex items-center gap-2">
            <Headphones size={15} className="shrink-0" />
            <span>
              🎙️ <strong>Erkek / Kadın</strong> stüdyo ses seçici ile her cümleyi
              iki farklı fasih spikerden dinleyebilirsiniz.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {libraryTabs.map((item) => (
            <div
              key={item.href}
              className="rounded-xl bg-[#F7EFE1]/65 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <span className="inline-block text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] text-[#6741D9] dark:text-purple-300">
                  {item.badge}
                </span>
                <h3 className="text-sm font-extrabold text-[var(--foreground)] leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  {role === "learner" ? item.purposeLearner : item.purposeTeacher}
                </p>
              </div>
              <Link
                href={item.href}
                onClick={() => playClick()}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 inline-flex items-center justify-between gap-2"
              >
                <span>Şimdi Dene</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 4. DİYALOG & OKUMA METNİ STÜDYOSU */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
              <Layers size={18} />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] dark:text-amber-300">
                4. Bölüm • Ders Stüdyoları (/diyalog/[id] &amp; /metin/[id])
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                Diyalog &amp; Okuma Metni Stüdyosu Anatomisi
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/diyalog/dlg_001"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Diyalog Stüdyosu</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/metin/metin_01"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Metin Stüdyosu</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 5 Çalışma Sekmesi + 4 Sarf/Nahiv Alt Çizgi Rengi */}
          <div className="space-y-3">
            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2.5">
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🗂️ 5 Çalışma Sekmesi (Adım Adım Ders İşlenişi)
              </h3>
              <ul className="space-y-1.5 text-xs font-medium text-[var(--muted)]">
                <li>
                  <strong className="text-[var(--foreground)]">
                    1. Dinle &amp; İncele:
                  </strong>{" "}
                  Canlı ok takipli seslendirme, satır çevirileri ve kelime kelime kök kartları.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">
                    2. Telaffuz (Gölgeleme):
                  </strong>{" "}
                  Mikrofonla kendi sesinizi kaydedip 38 mahreç analizi ve doğruluk skoru alma.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">
                    3. Rol Yapma:
                  </strong>{" "}
                  Karakterlerden birinin yerine geçip diyaloğu interaktif tamamlama.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">4. Sözlük:</strong>{" "}
                  Sadece o derste geçen kelimelerin tekil-çoğul, mazi-muzari ve kök listesi.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">
                    5. Odak Gramer:
                  </strong>{" "}
                  Dersin hedef dilbilgisi kuralı, A1 sezdirme özeti ve cümle içi i&apos;rab tahlili.
                </li>
              </ul>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2.5">
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🎨 Kelime Alt Çizgi Renkleri &amp; Tıklanabilir Kök/Sarf Kartı
              </h3>
              <p className="text-xs font-medium text-[var(--muted)]">
                Ders metnindeki herhangi bir Arapça kelimeye tıkladığınızda{" "}
                <strong className="text-[var(--foreground)]">
                  Üçlü Kök, Kelime Türü, Tekil/Çoğul, Mâzî/Muzâri/Mastar ve Kalbe Kaydet (❤️)
                </strong>{" "}
                penceresi açılır:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-2 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#D97706] shrink-0" />
                  <span className="text-[var(--foreground)]">Kehribar: Fiil</span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-2 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#2563EB] shrink-0" />
                  <span className="text-[var(--foreground)]">Mavi: İsim / Sıfat</span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-2 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#6741D9] shrink-0" />
                  <span className="text-[var(--foreground)]">
                    Mor: Edat / Harf-i Cer
                  </span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] px-2.5 py-2 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-sm bg-[#0D9488] shrink-0" />
                  <span className="text-[var(--foreground)]">
                    Turkuaz: Özel İsim
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Hızlı Etkinlik Çubuğu + Cümle İçi Butonlar */}
          <div className="space-y-3">
            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2.5">
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                ⚡ Hızlı Etkinlik Çubuğu (Üst Araçlar)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <Users size={13} className="text-[#087F5B]" />
                    <span>👥 İkili Kart (A/B)</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Sıra arkadaşlarıyla karşılıklı konuşma pratiği için bilgi boşluğu kartı üretir.
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <EyeOff size={13} className="text-[#6741D9]" />
                    <span>👁️ Kör Dinleme</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Metni bulanıklaştırıp sadece kulağınızla anlamayı sınayan dinleme modu.
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <Columns2 size={13} className="text-[#D97706]" />
                    <span>📐 Yan Yana Gramer</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Ekranı ikiye böler: solda metin, sağda{" "}
                    <strong>Sade / Akademik İ&apos;rab</strong> şalterli kural kartı.
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <FileText size={13} className="text-[#087F5B]" />
                    <span>📄 A4 PDF Çalışma Kağıdı</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Temiz ders föyü, boşluk doldurma yaprağı veya kes-katla kelime kartı basar.
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <QrCode size={13} className="text-[#6741D9]" />
                    <span>🎯 Karekodlu Ödev &amp; Paylaş</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Akıllı tahtada dev QR kod açar veya WhatsApp grubuna doğrudan ödev linki atar.
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5">
                  <div className="font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                    <ImageIcon size={13} className="text-[#D97706]" />
                    <span>🖼️ Görsel Kart İndir</span>
                  </div>
                  <p className="text-[var(--muted)] mt-0.5">
                    Seçili repliği veya hikmetli sözü yüksek çözünürlüklü paylaşım kartına çevirir.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-2">
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                🎙️ Cümle İçi 4 Mikro-Çalışma Butonu
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2 flex items-center gap-1.5">
                  <Volume2 size={14} className="text-[#087F5B] shrink-0" />
                  <span>🔊 Dinle</span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2 flex items-center gap-1.5">
                  <Repeat size={14} className="text-[#6741D9] shrink-0" />
                  <span>🔁 Döngü</span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2 flex items-center gap-1.5">
                  <Mic size={14} className="text-[#D97706] shrink-0" />
                  <span>🎤 Kayıt</span>
                </div>
                <div className="rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] p-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[#087F5B] shrink-0" />
                  <span>✨ Mahreç Koçu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ALIŞTIRMA & OYUN MERKEZİ (/alistirmalar) — 18 MODÜL & 4 ÖZEL HAVUZ */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
              <Gamepad2 size={18} />
            </span>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
                5. Bölüm • Alıştırma &amp; Oyun Merkezi (/alistirmalar)
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                Hızlı Başlatma Çekmecesi, {CONTENT_INVENTORY.exerciseModulesCount} Etkileşimli Modül &amp; 4 Özel Havuz
              </h2>
            </div>
          </div>

          <Link
            href="/alistirmalar"
            onClick={() => playClick()}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start md:self-auto whitespace-nowrap"
          >
            <span>Alıştırma Merkezini Aç</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        {/* Hızlı Başlatma Çekmecesi + 4 Özel Havuz */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Link
            href="/alistirmalar?plan=daily"
            onClick={() => playClick()}
            className="rounded-xl bg-[#ECFDF5] dark:bg-emerald-950/35 border border-[#087F5B]/40 p-3 flex flex-col justify-between gap-2 hover:border-[#087F5B]"
          >
            <div className="text-xs font-extrabold text-[#065F46] dark:text-emerald-300">
              ⏰ SRS Günlük Tekrar Havuzu
            </div>
            <p className="text-[11px] font-medium text-[var(--muted)]">
              Tekrar vadesi gelen kelimeleri unutmadan hemen önce karşınıza çıkarır.
            </p>
          </Link>

          <Link
            href="/alistirmalar?plan=leech"
            onClick={() => playClick()}
            className="rounded-xl bg-[#FFFBEB] dark:bg-amber-950/35 border border-[#D97706]/40 p-3 flex flex-col justify-between gap-2 hover:border-[#D97706]"
          >
            <div className="text-xs font-extrabold text-[#B45309] dark:text-amber-300">
              ⚡ Hata Defterim Havuzu
            </div>
            <p className="text-[11px] font-medium text-[var(--muted)]">
              Test ve alıştırmalarda yanlış yaptığınız soruları telafi ettirir.
            </p>
          </Link>

          <Link
            href="/alistirmalar?pool=favorites"
            onClick={() => playClick()}
            className="rounded-xl bg-[#F3F0FF] dark:bg-purple-950/35 border border-[#6741D9]/40 p-3 flex flex-col justify-between gap-2 hover:border-[#6741D9]"
          >
            <div className="text-xs font-extrabold text-[#4C28B5] dark:text-purple-300">
              ❤️ Favorilerim (Defterim) Havuzu
            </div>
            <p className="text-[11px] font-medium text-[var(--muted)]">
              Derslerde kalp ikonuyla kaydettiğiniz özel kelimelerle sınav üretir.
            </p>
          </Link>

          <Link
            href="/alistirmalar?pool=weak-words"
            onClick={() => playClick()}
            className="rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2 hover:border-[#087F5B]"
          >
            <div className="text-xs font-extrabold text-[var(--foreground)]">
              🎯 Mahreç Tekrarı Havuzu
            </div>
            <p className="text-[11px] font-medium text-[var(--muted)]">
              Telaffuzda zorlandığınız harfleri içeren kelimelere odaklanır.
            </p>
          </Link>
        </div>

        <p className="text-xs font-semibold text-[var(--muted)]">
          💡 <strong>Hızlı Başlatma Çekmecesi:</strong> Her modülün içine girmeden önce{" "}
          <strong className="text-[var(--foreground)]">Kategori</strong> (Kelime,
          Cümle, Gramer, Okuma),{" "}
          <strong className="text-[var(--foreground)]">Seviye (A1–B2)</strong> ve{" "}
          <strong className="text-[var(--foreground)]">Soru/Süre</strong> ayarını
          seçerek nokta atışı pratik başlatabilirsiniz.
        </p>

        {/* 18 Modül Izgarası */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {exerciseModules.map((mod) => (
            <div
              key={mod.no}
              className={`rounded-xl p-3 border flex flex-col justify-between gap-2.5 ${
                role === "teacher" && mod.teacherStar
                  ? "bg-[#FFFBEB]/80 dark:bg-amber-950/25 border-[#D97706]"
                  : "bg-[#F7EFE1]/65 dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)]"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums">
                    Modül {mod.no} • {mod.skillBadge}
                  </span>
                  {role === "teacher" && mod.teacherStar && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#D97706] text-white whitespace-nowrap">
                      Tahta Favorisi
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                  {mod.title}
                </h3>
                <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                  {mod.description}
                </p>
              </div>
              <Link
                href={mod.href}
                onClick={() => playClick()}
                className="min-h-[34px] px-3 py-1 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 inline-flex items-center justify-between gap-2"
              >
                <span>Şimdi Dene</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 6. SINAV MERKEZİ, KÖK SÖZLÜĞÜ VE AYARLAR */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sınav Merkezi */}
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#6741D9] text-white flex items-center justify-center shrink-0">
                <GraduationCap size={18} />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
                  6. Bölüm • /seviye-tespit
                </span>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  Sınav &amp; Ölçme Merkezi ({CONTENT_INVENTORY.assessmentQuestionsCount} Soru)
                </h2>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs font-medium text-[var(--muted)] leading-relaxed">
              <li>
                <strong className="text-[var(--foreground)]">
                  1. Adaptif CAT Seviye Tespit:
                </strong>{" "}
                10, 15 veya 20 soruda A1–B2 seviyenizi ve beceri profilinizi belirler.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">
                  2. {kttTopicCount} Konu Tarama Testi (KTT):
                </strong>{" "}
                Zamirlerden şart edatlarına kadar her gramer başlığı için ayrı çözümlü tarama testi.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">
                  3. Kur Bitirme &amp; A4 Sınav Stüdyosu:
                </strong>{" "}
                A1–B2 kur geçiş sınavları (%75+ baraj) ve öğretmenler için A/B kitapçıklı, cevap anahtarlı A4 yazılı sınav üretici.
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/seviye-tespit"
              onClick={() => playClick()}
              className="flex-1 min-h-[36px] px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <span>Sınav Merkezini Aç</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/seviye-tespit?mode=topic"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] text-xs font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1 whitespace-nowrap"
            >
              <span>{kttTopicCount} KTT</span>
            </Link>
          </div>
        </div>

        {/* İnteraktif Kök Sözlüğü */}
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                <BookMarked size={18} />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
                  7. Bölüm • /sozluk
                </span>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  İnteraktif Kök Sözlüğü ({CONTENT_INVENTORY.dictionaryWordsCount.toLocaleString("tr-TR")}+ Kelime)
                </h2>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs font-medium text-[var(--muted)] leading-relaxed">
              <li>
                <strong className="text-[var(--foreground)]">
                  Üçlü Kök (Sülâsî) Arama:
                </strong>{" "}
                Harekeli/harekesiz Arapça, Türkçe veya kök harfleriyle ({CONTENT_INVENTORY.coreDictionaryWordsCount.toLocaleString("tr-TR")} çekirdek madde + tüm türevler) anında arama.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">
                  Türkçeyle Ortak Kelimeler:
                </strong>{" "}
                Dilimizde yaşayan Arapça kökenli kelimeleri filtreleyerek hızlı başlangıç avantajı sağlar.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">
                  Kur&apos;ân &amp; Klasik Arapça Köprüsü:
                </strong>{" "}
                Modern iletişim kelimelerinin klasik metinlerdeki izlerini ve kök akrabalıklarını gösterir.
              </li>
            </ul>
          </div>
          <Link
            href="/sozluk"
            onClick={() => playClick()}
            className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
          >
            <span>İnteraktif Kök Sözlüğünü Aç</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Ayarlar & Çevrimdışı Paketler */}
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
                <Settings size={18} />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] dark:text-amber-300">
                  8. Bölüm • /ayarlar
                </span>
                <h2 className="text-base font-black text-[var(--foreground)]">
                  Çevrimdışı Paketler &amp; JSON Yedekleme
                </h2>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs font-medium text-[var(--muted)] leading-relaxed">
              <li>
                <strong className="text-[var(--foreground)]">
                  {totalOfflinePacks} Çevrimdışı Ders Paketi:
                </strong>{" "}
                {CONTENT_INVENTORY.dialoguesCount} diyalog ve{" "}
                {CONTENT_INVENTORY.readingsCount} okuma metninin stüdyo seslerini kur
                bazlı cihazınıza indirip internetsiz (uçakta, metroda, akıllı tahtada)
                çalıştırın.
              </li>
              <li>
                <strong className="text-[var(--foreground)]">
                  JSON İlerleme Yedeği İndir / Yükle:
                </strong>{" "}
                Hesap açmaya gerek kalmadan tüm ilerlemenizi tek dosyayla telefon,
                tablet ve bilgisayar arasında <em>Birleştir</em> veya{" "}
                <em>Üzerine Yaz</em> moduyla taşıyın.
              </li>
            </ul>
          </div>
          <Link
            href="/ayarlar"
            onClick={() => playClick()}
            className="w-full min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#D97706]/60 hover:border-[#D97706] text-xs font-extrabold text-[#B45309] dark:text-amber-300 inline-flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>Çevrimdışı Paket &amp; Yedek Ayarları</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
