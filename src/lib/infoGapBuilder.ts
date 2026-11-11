import { Dialogue } from "@/types/data";
import { DialogueVocabularyEntry } from "@/lib/dict";
import { removeArabicHarakat } from "@/lib/arabicTextUtils";

export interface InfoGapLineItem {
  lineNumber: number;
  sira: number;
  speakerTr: string;
  speakerAr: string;
  fullArabic: string;
  maskedArabic: string;
  hiddenWordsAr: string[];
  turkishFull: string;
  promptCueTr: string;
  audioUrl?: string;
}

export interface StudentCardLineView {
  lineNumber: number;
  sira: number;
  speakerTr: string;
  speakerAr: string;
  isFull: boolean;
  displayArabic: string;
  displayTurkishCue: string;
  audioUrl?: string;
}

export interface InfoGapPairDeck {
  dialogueId: string;
  titleTr: string;
  titleAr: string;
  level: string;
  lines: InfoGapLineItem[];
  studentACard: StudentCardLineView[];
  studentBCard: StudentCardLineView[];
}

export interface PairSpeakingRubricCriterion {
  id:
    | "intelligibility"
    | "questioning"
    | "vocabulary"
    | "task_completion";
  titleTr: string;
  titleAr: string;
  descriptionTr: string;
  maxPoints: number;
}

export const PAIR_SPEAKING_RUBRIC_CRITERIA: PairSpeakingRubricCriterion[] = [
  {
    id: "intelligibility",
    titleTr: "1. Anlaşılabilirlik",
    titleAr: "وُضُوحُ النُّطْقِ وَالأَدَاءِ",
    descriptionTr:
      "Sesletim, mahreç ayrımı ve cümle vurgusunun karşı tarafça rahat anlaşılması",
    maxPoints: 25,
  },
  {
    id: "questioning",
    titleTr: "2. Doğru Soru Sorma",
    titleAr: "صِحَّةُ طَرْحِ الأَسْئِلَةِ",
    descriptionTr:
      "Eksik bilgiyi öğrenmek için uygun soru kalıbı ve tonlamayı kullanabilme",
    maxPoints: 25,
  },
  {
    id: "vocabulary",
    titleTr: "3. Kelime Kullanımı",
    titleAr: "تَوْظِيفُ الْمُفْرَدَاتِ",
    descriptionTr:
      "Diyalogdaki hedef kelime ve kalıp ifadeleri bağlama uygun biçimde kullanma",
    maxPoints: 25,
  },
  {
    id: "task_completion",
    titleTr: "4. Görevi Tamamlama",
    titleAr: "إِنْجَازُ الْمَهَمَّةِ التَّوَاصُلِيَّةِ",
    descriptionTr:
      "Eşiyle yardımlaşarak tüm bilgi boşluklarını doğru tamamlayıp konuşmayı sürdürme",
    maxPoints: 25,
  },
];

const STOP_PARTICLES = new Set([
  "في",
  "من",
  "الى",
  "إلى",
  "على",
  "عن",
  "مع",
  "هل",
  "ما",
  "ماذا",
  "اين",
  "أين",
  "كيف",
  "متى",
  "نعم",
  "لا",
  "يا",
  "و",
  "او",
  "أو",
  "ان",
  "أن",
  "إن",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "هو",
  "هي",
  "انا",
  "أنا",
  "انت",
  "أنت",
  "نحن",
]);

function normalizeSkeleton(raw: string): string {
  return removeArabicHarakat(raw)
    .replace(/[.,!?؟،؛:"'«»()[\]\-—_]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim();
}

function splitWordPunctuation(rawToken: string): {
  leading: string;
  core: string;
  trailing: string;
} {
  const leadingMatch = rawToken.match(/^[.,!?؟،؛:"'«»()[\]]+/);
  const trailingMatch = rawToken.match(/[.,!?؟،؛:"'«»()[\]]+$/);
  const leading = leadingMatch ? leadingMatch[0] : "";
  const trailing =
    trailingMatch && trailingMatch[0].length < rawToken.length
      ? trailingMatch[0]
      : "";
  const core = rawToken.slice(
    leading.length,
    rawToken.length - trailing.length
  );
  return { leading, core, trailing };
}

/**
 * Diyaloğun cümlelerinden Öğrenci A (tek satırlar tam, çift satırlar boşluklu) ve
 * Öğrenci B (çift satırlar tam, tek satırlar boşluklu) için sıfır kopya sızıntılı
 * ikili konuşma (bilgi boşluğu / info-gap) kartlarını üretir.
 */
export function buildInfoGapPairCards(
  dialogue: Dialogue,
  vocabEntries: DialogueVocabularyEntry[] = []
): InfoGapPairDeck {
  const vocabLookup: Array<{ skeleton: string; meaningTr: string }> = [];
  for (const entry of vocabEntries) {
    const item = entry.item;
    const candidates = [
      entry.contextWord,
      item.mufret,
      item.mazi,
      item.muzari,
      item.cemi,
    ].filter((v): v is string => Boolean(v && v !== "-" && v.trim().length > 1));

    for (const c of candidates) {
      const firstPart = c.split(/[،,/]/)[0]?.trim() || "";
      const skel = normalizeSkeleton(firstPart);
      if (skel.length >= 2) {
        vocabLookup.push({
          skeleton: skel,
          meaningTr: item.anlam_tr,
        });
      }
    }
  }

  const lines: InfoGapLineItem[] = dialogue.satirlar.map((line, idx) => {
    const lineNumber = idx + 1;
    const parts = line.arapca.split(/(\s+)/);
    const wordPositions = parts
      .map((raw, partIdx) => {
        if (/^\s+$/.test(raw) || raw.length === 0) return null;
        const { leading, core, trailing } = splitWordPunctuation(raw);
        const skeleton = normalizeSkeleton(core);
        if (!skeleton) return null;
        const matchedVocab = vocabLookup.find(
          (v) =>
            v.skeleton === skeleton ||
            skeleton === `ال${v.skeleton}` ||
            (v.skeleton.length >= 3 &&
              skeleton.length >= 3 &&
              (skeleton.startsWith(v.skeleton) ||
                skeleton.endsWith(v.skeleton)))
        );
        return {
          partIdx,
          raw,
          leading,
          core,
          trailing,
          skeleton,
          matchedMeaningTr: matchedVocab?.meaningTr || null,
          isStopParticle: STOP_PARTICLES.has(skeleton),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const maxMasks = wordPositions.length >= 7 ? 2 : 1;
    const chosenIndices: number[] = [];
    const matchedMeanings: string[] = [];

    // 1. Öncelik: Diyalog sözlüğünde eşleşen içerik kelimeleri
    for (const wp of wordPositions) {
      if (chosenIndices.length >= maxMasks) break;
      if (wp.matchedMeaningTr && !wp.isStopParticle && wp.skeleton.length >= 2) {
        chosenIndices.push(wp.partIdx);
        matchedMeanings.push(wp.matchedMeaningTr);
      }
    }

    // 2. Öncelik: Stop-edat olmayan anlamlı kelimeler (uzunluğa göre)
    if (chosenIndices.length === 0) {
      const contentWords = wordPositions
        .filter((wp) => !wp.isStopParticle && wp.skeleton.length >= 3)
        .sort((a, b) => b.skeleton.length - a.skeleton.length);
      if (contentWords.length > 0) {
        chosenIndices.push(contentWords[0].partIdx);
      } else if (wordPositions.length > 0) {
        const longest = [...wordPositions].sort(
          (a, b) => b.skeleton.length - a.skeleton.length
        )[0];
        chosenIndices.push(longest.partIdx);
      }
    }

    const chosenSet = new Set(chosenIndices);
    const hiddenWordsAr: string[] = [];

    const maskedParts = parts.map((raw, pIdx) => {
      if (!chosenSet.has(pIdx)) return raw;
      const { leading, core, trailing } = splitWordPunctuation(raw);
      if (core.trim()) {
        hiddenWordsAr.push(core.trim());
      }
      return `${leading}[ .................. ]${trailing}`;
    });

    const maskedArabic = maskedParts.join("");
    const meaningHint =
      matchedMeanings.length > 0
        ? `Anahtar anlam: «${matchedMeanings.join(" / ")}» — `
        : "";
    const promptCueTr = `${meaningHint}Türkçe İpucu: ${line.turkce}`;

    return {
      lineNumber,
      sira: line.sira,
      speakerTr: line.konusmaci,
      speakerAr: line.konusmaci_ar,
      fullArabic: line.arapca,
      maskedArabic,
      hiddenWordsAr,
      turkishFull: line.turkce,
      promptCueTr,
      audioUrl: line.ses_dosyasi || undefined,
    };
  });

  // Öğrenci A: Tek numaralı satırlar (1, 3, 5...) TAM; Çift satırlar (2, 4, 6...) BOŞLUKLU
  const studentACard: StudentCardLineView[] = lines.map((item) => {
    const isOdd = item.lineNumber % 2 === 1;
    return {
      lineNumber: item.lineNumber,
      sira: item.sira,
      speakerTr: item.speakerTr,
      speakerAr: item.speakerAr,
      isFull: isOdd,
      displayArabic: isOdd ? item.fullArabic : item.maskedArabic,
      displayTurkishCue: isOdd ? item.turkishFull : item.promptCueTr,
      audioUrl: isOdd ? item.audioUrl : undefined,
    };
  });

  // Öğrenci B: Çift numaralı satırlar (2, 4, 6...) TAM; Tek satırlar (1, 3, 5...) BOŞLUKLU
  const studentBCard: StudentCardLineView[] = lines.map((item) => {
    const isEven = item.lineNumber % 2 === 0;
    return {
      lineNumber: item.lineNumber,
      sira: item.sira,
      speakerTr: item.speakerTr,
      speakerAr: item.speakerAr,
      isFull: isEven,
      displayArabic: isEven ? item.fullArabic : item.maskedArabic,
      displayTurkishCue: isEven ? item.turkishFull : item.promptCueTr,
      audioUrl: isEven ? item.audioUrl : undefined,
    };
  });

  return {
    dialogueId: dialogue.id,
    titleTr: dialogue.baslik_tr,
    titleAr: dialogue.baslik_ar,
    level: dialogue.seviye,
    lines,
    studentACard,
    studentBCard,
  };
}
