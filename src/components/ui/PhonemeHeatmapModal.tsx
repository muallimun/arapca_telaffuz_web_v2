"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  X,
  Volume2,
  Mic,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
} from "lucide-react";
import {
  useUserStore,
  ARABIC_28_LETTERS,
  Arabic28Letter,
  PhonemeStatRecord,
} from "@/store/userStore";
import { useSettings } from "@/store/settings";
import { sozluk } from "@/lib/data";
import { DictionaryItem } from "@/types/data";
import { playDualGenderAudio, getDualGenderAudioUrl } from "@/lib/audio";
import { playClick } from "@/lib/sfxManager";
import type { TargetForm } from "@/components/ui/ShadowingModal";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);

export interface PhonemeArticulationMeta {
  letter: Arabic28Letter;
  displayAr: string;
  nameTr: string;
  regionTr: string;
  articulationDetailTr: string;
  twinLetterAr?: string;
  twinNoteTr?: string;
}

export const PHONEME_28_GUIDE: Record<Arabic28Letter, PhonemeArticulationMeta> = {
  ا: {
    letter: "ا",
    displayAr: "ا / أ",
    nameTr: "Elif / Hemze",
    regionTr: "Boğaz Dibi & Ağız Boşluğu (Cevf)",
    articulationDetailTr:
      "Hemze (ء/أ/إ) boğazın en alt kısmında ses tellerinin anlık kapanıp açılmasıyla keskin çıkar; med elifi ise ağız boşluğundan uzatılarak okunur.",
    twinLetterAr: "ع",
    twinNoteTr: "Boğaz ortasından çıkan Ayn (ع) ile karıştırılmamalıdır; Hemze boğaz sıkılmadan net kesilir.",
  },
  ب: {
    letter: "ب",
    displayAr: "ب",
    nameTr: "Bâ",
    regionTr: "İki Dudak (Şefeteyn)",
    articulationDetailTr:
      "İki dudağın iç (nemli) kısımlarının birbirine net ve yumuşak kapanıp açılmasıyla çıkar; sakin olduğunda hafif kalkale (yankı) alır.",
    twinLetterAr: "م",
    twinNoteTr: "Geniz sesi katılmadan, dudakların temiz temasıyla telaffuz edilir.",
  },
  ت: {
    letter: "ت",
    displayAr: "ت",
    nameTr: "Tâ (İnce)",
    regionTr: "Dil Ucu — Üst Ön Kesici Diş Kökleri",
    articulationDetailTr:
      "Dil ucunun üst ön kesici dişlerin etle birleştiği damağa ince ve hafif nefesli (hems) dokunmasıyla çıkar.",
    twinLetterAr: "ط",
    twinNoteTr: "Kalın Tâ (ط) harfinden farklı olarak dil kökü yükseltilmez; tamamen ince okunur.",
  },
  ث: {
    letter: "ث",
    displayAr: "ث",
    nameTr: "Sâ (Peltek-İnce)",
    regionTr: "Dil Ucu — Üst Kesici Dişlerin Ucu",
    articulationDetailTr:
      "Dil ucunun üst ön kesici dişlerin alt kenarına hafifçe değdirilip ince nefes akıtılmasıyla (peltek) çıkar.",
    twinLetterAr: "س",
    twinNoteTr: "Keskin ıslıklı Sîn (س) gibi okunursa anlam değişir (örn. ثَمَرٌ meyve ↔ سَمَرٌ gece sohbeti).",
  },
  ج: {
    letter: "ج",
    displayAr: "ج",
    nameTr: "Cîm",
    regionTr: "Dil Ortası — Üst Damak Ortası",
    articulationDetailTr:
      "Dil ortasının üst damağın ortasına tam temas etmesiyle, Türkçedeki 'c' sesine yakın ancak daha tok ve net çıkar.",
    twinLetterAr: "ش",
    twinNoteTr: "Sesi dağıtmadan, dil ortasını damağa sağlam yaslayarak okunur.",
  },
  ح: {
    letter: "ح",
    displayAr: "ح",
    nameTr: "Hâ (Boğaz Ortası)",
    regionTr: "Boğaz Ortası (Vasatu'l-Halk)",
    articulationDetailTr:
      "Boğazın tam ortası hafifçe daraltılarak, hırıltısız ve temiz sıcak nefes sürtünmesiyle çıkarılır.",
    twinLetterAr: "ه / خ",
    twinNoteTr: "Göğüs nefesi olan Hê (ه) veya hırıltılı Hı (خ) ile karıştırılmamalıdır.",
  },
  خ: {
    letter: "خ",
    displayAr: "خ",
    nameTr: "Hı (Kalın-Boğaz Üstü)",
    regionTr: "Boğazın Ağıza En Yakın Üst Kısmı",
    articulationDetailTr:
      "Dil kökünün yumuşak damağa yaklaşmasıyla boğazın üst kısmından kalın ve hafif hırıltılı nefes akışıyla çıkar.",
    twinLetterAr: "غ / ح",
    twinNoteTr: "Titreşimli Ğayn (غ) ve hırıltısız Hâ (ح) harflerinden ayrılır.",
  },
  د: {
    letter: "د",
    displayAr: "د",
    nameTr: "Dâl (İnce)",
    regionTr: "Dil Ucu — Üst Ön Kesici Diş Kökleri",
    articulationDetailTr:
      "Dil ucunun üst ön kesici dişlerin köküne ince, net ve nefes akıtmadan temas etmesiyle çıkar.",
    twinLetterAr: "ض / ت",
    twinNoteTr: "Kalın Dâd (ض) harfine göre tamamen incedir; dil yanları azı dişlere baskı yapmaz.",
  },
  ذ: {
    letter: "ذ",
    displayAr: "ذ",
    nameTr: "Zâl (Peltek-İnce)",
    regionTr: "Dil Ucu — Üst Kesici Dişlerin Ucu",
    articulationDetailTr:
      "Dil ucunun üst ön kesici dişlerin ucuna hafifçe değmesi ve ses tellerinin titreşmesiyle ince-peltek çıkar.",
    twinLetterAr: "ز / ظ",
    twinNoteTr: "Keskin Zây (ز) ve kalın-peltek Zâ (ظ) harflerinden ince peltekliğiyle ayrılır.",
  },
  ر: {
    letter: "ر",
    displayAr: "ر",
    nameTr: "Râ",
    regionTr: "Dil Ucu ve Sırtı — Üst Ön Diş Eti",
    articulationDetailTr:
      "Dil ucunun üst ön diş etlerine tek ve kontrollü dokunuşuyla (aşırı titretmeden) çıkar; fetha/dammede kalın, kesrada incedir.",
    twinLetterAr: "ل",
    twinNoteTr: "Dil ucunu damağa yapıştırmadan, hafif kavisle tek vuruşta okunur.",
  },
  ز: {
    letter: "ز",
    displayAr: "ز",
    nameTr: "Zây (Keskin-İnce)",
    regionTr: "Dil Ucu — Alt Ön Kesici Dişlerin İç Yüzü",
    articulationDetailTr:
      "Dil ucunun alt ön dişlerin iç kısmına yaklaşmasıyla, peltek olmadan keskin ve vızıltılı (safîr) çıkar.",
    twinLetterAr: "ذ / ظ",
    twinNoteTr: "Dil dişlerin arasına çıkarılmaz; Türkçedeki keskin 'z' gibidir.",
  },
  س: {
    letter: "س",
    displayAr: "س",
    nameTr: "Sîn (İnce)",
    regionTr: "Dil Ucu — Alt Ön Kesici Dişlerin İç Yüzü",
    articulationDetailTr:
      "Dil ucu alt ön kesici dişlere yaklaşırken dişler arasından ince ve berrak ıslık (safîr) sesiyle çıkar.",
    twinLetterAr: "ص / ث",
    twinNoteTr: "Kalın Sâd (ص) ve peltek Sâ (ث) ile karıştırmak kelime anlamını değiştirir (سَيْفٌ kılıç ↔ صَيْفٌ yaz).",
  },
  ش: {
    letter: "ش",
    displayAr: "ش",
    nameTr: "Şîn",
    regionTr: "Dil Ortası — Üst Damak Ortası",
    articulationDetailTr:
      "Dil ortası üst damağa yaklaşırken havanın ağız içinde genişçe yayılmasıyla (tefeşşî) ince çıkar.",
    twinLetterAr: "س",
    twinNoteTr: "Sesi ağız ortasında yumuşakça yayarak Türkçedeki 'ş' gibi net okunur.",
  },
  ص: {
    letter: "ص",
    displayAr: "ص",
    nameTr: "Sâd (Kalın)",
    regionTr: "Dil Ucu & Dil Kökü Yükselmesi (İsti'lâ)",
    articulationDetailTr:
      "Dil ucu Sîn mahrecindeyken dil arkası üst damağa doğru kubbeleştirilerek tok ve kalın ıslık sesiyle çıkar.",
    twinLetterAr: "س",
    twinNoteTr: "Dudakları öne büzmeden, kalınlığı dil kökünü kaldırarak üretin.",
  },
  ض: {
    letter: "ض",
    displayAr: "ض",
    nameTr: "Dâd (Kalın)",
    regionTr: "Dil Yan Kenarı — Üst Azı Dişlerin İç Yüzü",
    articulationDetailTr:
      "Dilin sağ, sol veya her iki yan kenarının üst azı dişlerin iç yüzeyine tok ve kalın biçimde yaslanmasıyla çıkar.",
    twinLetterAr: "د / ظ",
    twinNoteTr: "Peltek değildir! Dil ucu dişlerin arasına çıkmaz (peltek okunursa ظ olur).",
  },
  ط: {
    letter: "ط",
    displayAr: "ط",
    nameTr: "Tâ (Kalın)",
    regionTr: "Dil Ucu — Üst Diş Kökleri (Tam Kalın/İtbâk)",
    articulationDetailTr:
      "Dil ucu üst ön diş köklerine değerken dilin arka kısmı damağa doğru yükselir; nefes akıtmadan tok ve kalın çıkar.",
    twinLetterAr: "ت / د",
    twinNoteTr: "İnce Tâ (ت) gibi nefesli (ç/t benzeri) okunmamalı; tok ve dolgun ses verilmelidir (طِينٌ çamur ↔ تِينٌ incir).",
  },
  ظ: {
    letter: "ظ",
    displayAr: "ظ",
    nameTr: "Zâ (Kalın-Peltek)",
    regionTr: "Dil Ucu — Üst Kesici Diş Ucu (Kalın)",
    articulationDetailTr:
      "Dil ucu üst ön kesici dişlerin alt kenarına hafifçe temas ederken dil arkası yükseltilerek kalın-peltek çıkar.",
    twinLetterAr: "ز / ذ / ض",
    twinNoteTr: "Hem peltek hem kalındır; keskin 'z' (ز) veya ince peltek 'ذ' olarak okunmamalıdır.",
  },
  ع: {
    letter: "ع",
    displayAr: "ع",
    nameTr: "Ayn",
    regionTr: "Boğaz Ortası (Titreşimli)",
    articulationDetailTr:
      "Boğaz ortasındaki kasların (epiglottis çevresi) hafifçe içe esnetilmesiyle, sesli ve derin bir boğaz tınısıyla çıkar.",
    twinLetterAr: "ء / أ",
    twinNoteTr: "Düz Hemze (أ) gibi okunursa anlam bozulur (عَلِمَ bildi ↔ أَلِمَ acı çekti).",
  },
  غ: {
    letter: "غ",
    displayAr: "غ",
    nameTr: "Ğayn (Kalın)",
    regionTr: "Boğazın Üst Kısmı — Yumuşak Damak",
    articulationDetailTr:
      "Boğazın ağıza en yakın üst noktasından, ses tellerinin titreşimiyle kalın ve akıcı biçimde çıkar.",
    twinLetterAr: "خ",
    twinNoteTr: "Türkçedeki sessiz yumuşak 'ğ' gibi yutulmaz; belirgin ve sesli boğaz-üst temasla okunur.",
  },
  ف: {
    letter: "ف",
    displayAr: "ف",
    nameTr: "Fâ",
    regionTr: "Üst Ön Kesici Dişler — Alt Dudak İçi",
    articulationDetailTr:
      "Üst ön kesici dişlerin uçlarının alt dudağın iç (ıslak) kısmına hafifçe değmesi ve nefes akışıyla ince çıkar.",
    twinLetterAr: "ب",
    twinNoteTr: "İki dudağı birbirine çarpmadan, üst diş-alt dudak temasıyla berrak çıkarılır.",
  },
  ق: {
    letter: "ق",
    displayAr: "ق",
    nameTr: "Kâf (Kalın)",
    regionTr: "Dil Kökü — Yumuşak Damak (Küçük Dil Önü)",
    articulationDetailTr:
      "Dilin en arka kökünün yumuşak damağa (küçük dile yakın bölgeye) tok ve kalın vuruşuyla, nefes saçmadan çıkar.",
    twinLetterAr: "ك",
    twinNoteTr: "İnce Kêf (ك) ile en sık karışan çift! (قَلْبٌ kalp ↔ كَلْبٌ köpek).",
  },
  ك: {
    letter: "ك",
    displayAr: "ك",
    nameTr: "Kêf (İnce)",
    regionTr: "Dil Kökü Önü — Sert ve Yumuşak Damak Sınırı",
    articulationDetailTr:
      "Kâf (ق) mahrecinin biraz daha önünden, sert damağa doğru ince ve hafif nefesli temasla çıkar.",
    twinLetterAr: "ق",
    twinNoteTr: "Dil arkası kalınlaştırılmaz; Türkçedeki 'kâtip/kelam' ince 'k' sesine yakındır.",
  },
  ل: {
    letter: "ل",
    displayAr: "ل",
    nameTr: "Lâm",
    regionTr: "Dil Yan Ucu — Üst Ön Diş Etleri",
    articulationDetailTr:
      "Dil ucunun yanlarıyla birlikte üst ön diş etlerine berrak ve ince temasıyla çıkar (yalnızca 'Allah' lafzında fetha/damme sonrası kalın okunur).",
    twinLetterAr: "ن / ر",
    twinNoteTr: "Normal kelimelerde kalın 'l' yapmadan ince ve akıcı seslendirilir.",
  },
  م: {
    letter: "م",
    displayAr: "م",
    nameTr: "Mîm",
    regionTr: "İki Dudak (Kuru Kısım) & Geniz (Hayşûm)",
    articulationDetailTr:
      "İki dudağın hafifçe kapanması ve geniz boşluğundan (ğunne) doğal tını eşlik etmesiyle ince çıkar.",
    twinLetterAr: "ن / ب",
    twinNoteTr: "Şeddeli olduğunda (مّ) dudaklar kapalı tutularak geniz tınısı biraz uzatılır.",
  },
  ن: {
    letter: "ن",
    displayAr: "ن",
    nameTr: "Nûn",
    regionTr: "Dil Ucu — Üst Diş Eti & Geniz (Hayşûm)",
    articulationDetailTr:
      "Dil ucunun üst ön diş etlerine değmesi ve genizden gelen doğal ğunne tınısıyla ince çıkar.",
    twinLetterAr: "م / ل",
    twinNoteTr: "Şeddeli Nûn (نّ) okunurken ses kısa kesilmez, genizde dengeli tutulur.",
  },
  ه: {
    letter: "ه",
    displayAr: "ه",
    nameTr: "Hê (Boğaz Dibi)",
    regionTr: "Boğazın En Alt Kısmı (Göğse Yakın)",
    articulationDetailTr:
      "Boğaz hiç sıkılmadan, göğüsten gelen yumuşak ve ince nefes akışıyla çıkar.",
    twinLetterAr: "ح",
    twinNoteTr: "Boğaz ortası sıkılırsa Hâ (ح) harfine dönüşür (هَرَمٌ piramit/yaşlılık ↔ حَرَمٌ kutsal bölge).",
  },
  و: {
    letter: "و",
    displayAr: "و",
    nameTr: "Vâv (Çift Dudak)",
    regionTr: "İki Dudağın Yuvarlaklaşması",
    articulationDetailTr:
      "Üst dişler alt dudağa değmeden, yalnızca iki dudağın öne doğru yuvarlak toplanmasıyla (İngilizce 'w' gibi) yumuşak çıkar.",
    twinLetterAr: "ف",
    twinNoteTr: "Türkçedeki diş-dudak 'v' sesi gibi üst dişleri alt dudağa değdirmeyin.",
  },
  ي: {
    letter: "ي",
    displayAr: "ي",
    nameTr: "Yâ",
    regionTr: "Dil Ortası — Üst Damak Ortası",
    articulationDetailTr:
      "Dil ortasının üst damağa yaklaşmasıyla (temas etmeden) akıcı ve ince biçimde çıkar.",
    twinLetterAr: "ج",
    twinNoteTr: "Med harfi olduğunda önceki kesrayı berrak biçimde iki hareke uzatır.",
  },
};

export type PhonemeHeatTier = "strong" | "developing" | "needs_review" | "untested";

export function evaluatePhonemeHeatTier(rec?: PhonemeStatRecord): {
  tier: PhonemeHeatTier;
  accuracy: number | null;
  labelTr: string;
  shortBadgeTr: string;
} {
  if (!rec || rec.attempts <= 0) {
    return {
      tier: "untested",
      accuracy: null,
      labelTr: "Henüz Denenmedi",
      shortBadgeTr: "Yeni",
    };
  }
  const accuracy = Math.round((rec.cleanHits / rec.attempts) * 100);
  if (accuracy < 60 || (rec.confusions >= 2 && accuracy < 75)) {
    return {
      tier: "needs_review",
      accuracy,
      labelTr: "Mahreç Tekrarı Gerekli",
      shortBadgeTr: `%${accuracy}`,
    };
  }
  if (accuracy >= 82 && rec.attempts >= 2) {
    return {
      tier: "strong",
      accuracy,
      labelTr: "Güçlü Hakimiyet",
      shortBadgeTr: `%${accuracy}`,
    };
  }
  return {
    tier: "developing",
    accuracy,
    labelTr: "Gelişiyor",
    shortBadgeTr: `%${accuracy}`,
  };
}

function wordStrictlyContainsLetter(
  arabicWord: string,
  letter: Arabic28Letter
): boolean {
  const stripped = arabicWord
    .normalize("NFC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "");
  if (letter === "ا") {
    return /[أإآا]/.test(stripped);
  }
  return stripped.includes(letter);
}

function getWordPrimaryArabic(w: DictionaryItem): string {
  return (w.mufret || w.mazi || "").trim();
}

function prepareWordForms(word: DictionaryItem): TargetForm[] {
  const forms: TargetForm[] = [];
  if (word.tur === "fiil") {
    if (word.mazi) forms.push({ label: "Mâzî", arabic: word.mazi });
    if (word.muzari) forms.push({ label: "Muzâri", arabic: word.muzari });
    if (word.masdar) forms.push({ label: "Masdar", arabic: word.masdar });
  } else {
    if (word.mufret) forms.push({ label: "Müfret (Tekil)", arabic: word.mufret });
    if (word.cemi && word.cemi !== "-") {
      forms.push({ label: "Cemî (Çoğul)", arabic: word.cemi });
    }
  }
  return forms;
}

interface PhonemeHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhonemeHeatmapModal({
  isOpen,
  onClose,
}: PhonemeHeatmapModalProps) {
  const phonemeStats = useUserStore((s) => s.phonemeStats);
  const preferredVoiceGender = useSettings((s) => s.preferredVoiceGender);
  const speechRate = useSettings((s) => s.speechRate);

  const initialFocusLetter = useMemo<Arabic28Letter>(() => {
    let worstLetter: Arabic28Letter | null = null;
    let worstAcc = 101;
    for (const ltr of ARABIC_28_LETTERS) {
      const rec = phonemeStats?.[ltr];
      if (rec && rec.attempts > 0) {
        const acc = (rec.cleanHits / rec.attempts) * 100;
        if (acc < worstAcc) {
          worstAcc = acc;
          worstLetter = ltr;
        }
      }
    }
    return worstLetter || "ق";
  }, [phonemeStats]);

  const [selectedLetter, setSelectedLetter] =
    useState<Arabic28Letter>(initialFocusLetter);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);
  const [practiceWord, setPracticeWord] = useState<DictionaryItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !practiceWord) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, practiceWord]);

  const summaryCounts = useMemo(() => {
    let strong = 0;
    let developing = 0;
    let needsReview = 0;
    let untested = 0;
    for (const ltr of ARABIC_28_LETTERS) {
      const { tier } = evaluatePhonemeHeatTier(phonemeStats?.[ltr]);
      if (tier === "strong") strong += 1;
      else if (tier === "developing") developing += 1;
      else if (tier === "needs_review") needsReview += 1;
      else untested += 1;
    }
    return { strong, developing, needsReview, untested };
  }, [phonemeStats]);

  const exampleWordsByLetter = useMemo(() => {
    const map: Record<Arabic28Letter, DictionaryItem[]> = {} as Record<
      Arabic28Letter,
      DictionaryItem[]
    >;
    for (const ltr of ARABIC_28_LETTERS) {
      const candidates = sozluk.filter((item) => {
        const primary = getWordPrimaryArabic(item);
        if (!primary || primary.includes(" ")) return false;
        return wordStrictlyContainsLetter(primary, ltr);
      });
      // Ses dosyası bulunan, A1/A2 düzeyindeki net tekil kelimeleri öne al
      candidates.sort((a, b) => {
        const aAudio = a.ses_erkek || a.ses_kadin ? 1 : 0;
        const bAudio = b.ses_erkek || b.ses_kadin ? 1 : 0;
        if (bAudio !== aAudio) return bAudio - aAudio;
        const cefrRank = (c?: string) =>
          c === "A1" ? 0 : c === "A2" ? 1 : c === "B1" ? 2 : 3;
        const rankDiff = cefrRank(a.cefr) - cefrRank(b.cefr);
        if (rankDiff !== 0) return rankDiff;
        return getWordPrimaryArabic(a).length - getWordPrimaryArabic(b).length;
      });
      map[ltr] = candidates.slice(0, 3);
    }
    return map;
  }, []);

  if (!isOpen) return null;

  const activeMeta = PHONEME_28_GUIDE[selectedLetter];
  const activeStat = phonemeStats?.[selectedLetter];
  const activeEval = evaluatePhonemeHeatTier(activeStat);
  const activeExamples = exampleWordsByLetter[selectedLetter] || [];

  const handleListenExample = async (word: DictionaryItem) => {
    playClick();
    const arabic = getWordPrimaryArabic(word);
    if (!arabic) return;
    setPlayingWordId(word.id);
    try {
      await playDualGenderAudio({
        text: arabic,
        id: word.id,
        ses_erkek: word.ses_erkek,
        ses_kadin: word.ses_kadin,
        gender: preferredVoiceGender,
        rate: speechRate || 1,
      });
    } finally {
      setPlayingWordId(null);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phoneme-heatmap-title"
        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            playClick();
            onClose();
          }
        }}
      >
        <div className="w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-3xl bg-[#FDFBF7] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] shadow-2xl p-3.5 sm:p-5 space-y-4">
          {/* ÜST BAŞLIK */}
          <div className="flex items-start justify-between gap-3 border-b border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <div className="space-y-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 text-xs font-extrabold">
                <Sparkles size={13} />
                <span>Kişisel Sesletim &amp; Mahreç Analizi</span>
              </div>
              <h2
                id="phoneme-heatmap-title"
                className="text-base sm:text-xl font-black text-[var(--foreground)] tracking-tight"
              >
                🗣️ 28 Harf Kişisel Mahreç Isı Haritam
              </h2>
              <p className="text-xs font-medium text-[var(--muted)]">
                Sesli pratik ve diyalog okumalarınızdaki harf bazlı isabet ve mahreç karışıklıkları canlı izlenir. Bir harfe dokunarak çıkış bölgesini ve sesli örneklerini inceleyin.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                playClick();
                onClose();
              }}
              aria-label="Kapat"
              className="min-h-[44px] min-w-[44px] rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] shrink-0 cursor-pointer"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* DURUM GÖSTERGESİ (RENK + METİN + İKON — ERİŞİLEBİLİR ÖZET) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                <span>Güçlü Hakimiyet</span>
              </span>
              <span className="text-sm font-black tabular-nums text-emerald-800 dark:text-emerald-300">
                {summaryCounts.strong}
              </span>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Sparkles size={14} className="shrink-0 text-amber-600" />
                <span>Gelişiyor</span>
              </span>
              <span className="text-sm font-black tabular-nums text-amber-800 dark:text-amber-300">
                {summaryCounts.developing}
              </span>
            </div>

            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0 text-rose-600" />
                <span>Mahreç Tekrarı</span>
              </span>
              <span className="text-sm font-black tabular-nums text-rose-800 dark:text-rose-300">
                {summaryCounts.needsReview}
              </span>
            </div>

            <div className="rounded-xl bg-stone-100 dark:bg-stone-900/60 border border-stone-300 dark:border-stone-700 px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Info size={14} className="shrink-0 text-stone-500" />
                <span>Henüz Denenmedi</span>
              </span>
              <span className="text-sm font-black tabular-nums text-stone-700 dark:text-stone-300">
                {summaryCounts.untested}
              </span>
            </div>
          </div>

          {/* 28 HARF RTL ISI IZGARASI */}
          <div
            dir="rtl"
            lang="ar"
            className="grid grid-cols-4 sm:grid-cols-7 gap-2 bg-[#F7EFE1]/80 dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] p-2.5 sm:p-3"
          >
            {ARABIC_28_LETTERS.map((ltr) => {
              const rec = phonemeStats?.[ltr];
              const { tier, shortBadgeTr, labelTr } = evaluatePhonemeHeatTier(rec);
              const isSelected = selectedLetter === ltr;
              const meta = PHONEME_28_GUIDE[ltr];

              const tierClasses =
                tier === "strong"
                  ? "bg-emerald-50 dark:bg-emerald-950/55 border-emerald-400 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100"
                  : tier === "developing"
                  ? "bg-amber-50 dark:bg-amber-950/55 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100"
                  : tier === "needs_review"
                  ? "bg-rose-50 dark:bg-rose-950/60 border-rose-400 dark:border-rose-500 text-rose-950 dark:text-rose-100"
                  : "bg-white/90 dark:bg-[var(--background)] border-[#E2D4BC] dark:border-[var(--border)] text-[var(--foreground)]";

              return (
                <button
                  key={ltr}
                  type="button"
                  onClick={() => {
                    playClick();
                    setSelectedLetter(ltr);
                  }}
                  aria-pressed={isSelected}
                  title={`${meta.nameTr} — ${labelTr}`}
                  className={`min-h-[64px] sm:min-h-[70px] rounded-2xl border-2 px-1.5 py-1.5 flex flex-col items-center justify-between transition-all cursor-pointer ${tierClasses} ${
                    isSelected
                      ? "ring-3 ring-[#6741D9] dark:ring-indigo-400 -translate-y-0.5 shadow-md"
                      : "hover:-translate-y-0.5"
                  }`}
                >
                  <span className="arabic-text text-2xl sm:text-[26px] font-bold leading-relaxed">
                    {ltr}
                  </span>
                  <span
                    dir="ltr"
                    lang="tr"
                    className="font-sans text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 leading-none"
                  >
                    {tier === "strong"
                      ? `✓ ${shortBadgeTr}`
                      : tier === "needs_review"
                      ? `! ${shortBadgeTr}`
                      : tier === "developing"
                      ? `~ ${shortBadgeTr}`
                      : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SEÇİLİ HARF DETAY VE 3 SESLİ ÖRNEK KELİME KARTI */}
          <div className="rounded-2xl bg-white dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3.5 sm:p-4 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6D7BE]/80 dark:border-[var(--border)] pb-3">
              <div className="flex items-center gap-3">
                <div
                  dir="rtl"
                  lang="ar"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9] flex items-center justify-center shrink-0"
                >
                  <span className="arabic-text text-3xl sm:text-4xl font-bold text-[#4C28B5] dark:text-indigo-200 leading-relaxed">
                    {activeMeta.displayAr}
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                      {activeMeta.nameTr} Harfi
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${
                        activeEval.tier === "strong"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                          : activeEval.tier === "developing"
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                          : activeEval.tier === "needs_review"
                          ? "bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200"
                          : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300"
                      }`}
                    >
                      {activeEval.labelTr}
                      {activeEval.accuracy !== null ? ` (%${activeEval.accuracy})` : ""}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold text-[#065F46] dark:text-emerald-300">
                    📍 Çıkış Bölgesi (Mahreç): {activeMeta.regionTr}
                  </p>
                </div>
              </div>

              {activeStat && activeStat.attempts > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="px-2.5 py-1 rounded-xl bg-[#F7EFE1] dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] tabular-nums">
                    Deneme: <strong>{activeStat.attempts}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 tabular-nums">
                    Temiz İsabet: <strong>{activeStat.cleanHits}</strong>
                  </span>
                  {activeStat.confusions > 0 && (
                    <span className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 tabular-nums">
                      Karışma: <strong>{activeStat.confusions}</strong>
                      {activeStat.lastConfusedWith ? (
                        <>
                          {" "}
                          (Son:{" "}
                          <span dir="rtl" lang="ar" className="arabic-text text-sm font-bold">
                            {activeStat.lastConfusedWith}
                          </span>
                          )
                        </>
                      ) : null}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* MAHREÇ REHBERİ VE İKİZ HARF UYARISI */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#6741D9] dark:text-indigo-300">
                  🎯 Nasıl Seslendirilir?
                </span>
                <p className="text-xs sm:text-[13px] font-medium text-[var(--foreground)] leading-relaxed">
                  {activeMeta.articulationDetailTr}
                </p>
              </div>

              {activeMeta.twinLetterAr && (
                <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/80 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      ⚠️ En Sık Karıştırılan İkiz Harf
                    </span>
                    <span
                      dir="rtl"
                      lang="ar"
                      className="arabic-text text-base font-bold px-2 py-0.5 rounded-lg bg-amber-200/70 dark:bg-amber-900 text-amber-950 dark:text-amber-100"
                    >
                      {activeMeta.letter} ↔ {activeMeta.twinLetterAr}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[13px] font-medium text-amber-950 dark:text-amber-100 leading-relaxed">
                    {activeMeta.twinNoteTr}
                  </p>
                </div>
              )}
            </div>

            {/* SÖZLÜKTEN 3 SESLİ ÖRNEK KELİME */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-extrabold text-[var(--foreground)]">
                  📚 Sözlükten Bu Harfi İçeren Sesli Örnek Kelimeler
                </h4>
                <span className="text-[11px] font-semibold text-[var(--muted)]">
                  Önce dinleyin, ardından mikrofona dokunup deneyin
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {activeExamples.map((word) => {
                  const arabic = getWordPrimaryArabic(word);
                  const isPlayingThis = playingWordId === word.id;
                  return (
                    <div
                      key={word.id}
                      className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div
                          dir="rtl"
                          lang="ar"
                          className="arabic-text text-2xl font-bold text-[var(--foreground)] leading-[1.95] text-right"
                        >
                          {arabic}
                        </div>
                        <div className="text-xs font-bold text-[var(--muted)] leading-snug">
                          {word.anlam_tr}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleListenExample(word)}
                          className={`min-h-[44px] px-2.5 py-1.5 rounded-xl border-2 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPlayingThis
                              ? "bg-[#087F5B] text-white border-[#065F46]"
                              : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                          }`}
                        >
                          <Volume2 size={14} className="shrink-0" />
                          <span>Dinle</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setPracticeWord(word);
                          }}
                          className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5835C2] border-2 border-[#4C28B5] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Mic size={14} className="shrink-0" />
                          <span>Şimdi Dene</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {practiceWord && (
        <ShadowingModal
          text={getWordPrimaryArabic(practiceWord)}
          turkishText={practiceWord.anlam_tr}
          itemId={practiceWord.id}
          refAudioUrl={getDualGenderAudioUrl(practiceWord, preferredVoiceGender)}
          forms={prepareWordForms(practiceWord)}
          voice={preferredVoiceGender === "kadin" ? "female" : "male"}
          level={practiceWord.cefr || "A1"}
          onClose={() => setPracticeWord(null)}
        />
      )}
    </>
  );
}
