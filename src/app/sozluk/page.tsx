"use client";

import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useDeferredValue,
  memo,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Heart,
  CheckCircle2,
  Mic,
  Volume2,
  X,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Share2,
} from "lucide-react";
import {
  sozluk,
  diyaloglar,
  gorselKelimeler,
  getVisualWordCoverUrl,
} from "@/lib/data";
import { DictionaryItem } from "@/types/data";
import {
  getDialogueVocabulary,
  DialogueVocabularyEntry,
  cleanArabicText,
  analyzeAndMatchWord,
  getWordCategory,
  WordCategory,
  getWordsByRoot,
  getExampleSentencesForWord,
  ExampleSentenceMatch,
  mergeTurkishMeanings,
} from "@/lib/dict";
import {
  loadAudioManifest,
  playTTS,
  hasMp3,
  getMp3Path,
  playDualGenderAudio,
  getDualGenderAudioUrl,
} from "@/lib/audio";
import { useAudioStore } from "@/store/audioStore";
import { useUserStore } from "@/store/userStore";
import { useSettings, VoiceGender } from "@/store/settings";
import { playClick } from "@/lib/sfxManager";
import type { ShareCardPayload } from "@/components/ui/ShareContentCardModal";

const ShadowingModal = dynamic(
  () => import("@/components/ui/ShadowingModal"),
  { ssr: false }
);
const ShareContentCardModal = dynamic(
  () => import("@/components/ui/ShareContentCardModal"),
  { ssr: false }
);
const PhonemeHeatmapModal = dynamic(
  () => import("@/components/ui/PhonemeHeatmapModal"),
  { ssr: false }
);
import {
  formatArabicText,
  splitMixedBidiText,
  normalizeArabicText,
} from "@/lib/arabicTextUtils";
import {
  ArabicIdiom,
  getCombinedIdiomsCatalog,
  extractDialogueIdioms,
} from "@/lib/arabicIdioms";
import { resolveMistakesPool, formatSrsBadgeInfo } from "@/lib/mistakeUtils";
import {
  getClassicalBridgeForRoot,
  getCognateInfoForDictionaryItem,
  type ClassicalRootBridgeEntry,
  type TurkishArabicCognateEntry,
} from "@/lib/classicalBridgeData";
import {
  DEFAULT_ITEMS_PER_PAGE,
  ITEMS_PER_PAGE_OPTIONS,
  paginateDictionaryItems,
  type ItemsPerPageOption,
  type PaginationToken,
} from "@/lib/dictionaryPagination";

type StatusFilter = "all" | "learned" | "unlearned" | "favorites" | "mistakes";
type TypeFilter =
  | "all"
  | "isim"
  | "ozel-isim"
  | "fiil"
  | "edat"
  | "ifade";

function getCategoryCardTheme(category: WordCategory) {
  if (category === "fiil") {
    return {
      leftBorder: "border-l-4 border-l-amber-500",
      badgeText: "⚡ Fiil (فعل)",
      badgeClass:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60",
      arabicColor:
        "text-amber-700 dark:text-amber-300 group-hover:text-amber-600",
    };
  }
  if (category === "edat") {
    return {
      leftBorder: "border-l-4 border-l-purple-500",
      badgeText: "🔗 Edat / Kalıp",
      badgeClass:
        "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700/60",
      arabicColor:
        "text-purple-700 dark:text-purple-300 group-hover:text-purple-600",
    };
  }
  if (category === "ozel-isim") {
    return {
      leftBorder: "border-l-4 border-l-teal-500",
      badgeText: "👤 Özel İsim (اسم علم)",
      badgeClass:
        "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700/60",
      arabicColor:
        "text-teal-700 dark:text-teal-300 group-hover:text-teal-600",
    };
  }
  return {
    leftBorder: "border-l-4 border-l-sky-500",
    badgeText: "📘 İsim (اسم)",
    badgeClass:
      "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700/60",
    arabicColor: "text-sky-700 dark:text-sky-300 group-hover:text-sky-600",
  };
}

interface PreparedWordMeta {
  category: WordCategory;
  isIdiom: boolean;
  cognateInfo: TurkishArabicCognateEntry | null;
  classicalBridge: ClassicalRootBridgeEntry | null;
  cleanRoot: string;
  searchLowerTr: string;
  searchRawAr: string;
  searchCleanAr: string;
  searchNormAr: string;
}

const ROOT_SIBLINGS_CACHE = new Map<string, DictionaryItem[]>();
const EXAMPLE_SENTENCES_CACHE = new Map<string, ExampleSentenceMatch[]>();

function getCachedRootSiblings(root: string, excludeId: string): DictionaryItem[] {
  const key = `${root}__${excludeId}`;
  const hit = ROOT_SIBLINGS_CACHE.get(key);
  if (hit) return hit;
  const computed = getWordsByRoot(root, excludeId);
  ROOT_SIBLINGS_CACHE.set(key, computed);
  return computed;
}

function getCachedExampleSentences(word: DictionaryItem): ExampleSentenceMatch[] {
  const hit = EXAMPLE_SENTENCES_CACHE.get(word.id);
  if (hit) return hit;
  const computed = getExampleSentencesForWord(word, 2);
  EXAMPLE_SENTENCES_CACHE.set(word.id, computed);
  return computed;
}

const SmartPaginationBar = memo(function SmartPaginationBar({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  tokens,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  compactTop = false,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  tokens: PaginationToken[];
  itemsPerPage: ItemsPerPageOption;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: ItemsPerPageOption) => void;
  compactTop?: boolean;
}) {
  if (totalItems === 0) return null;

  const shownStart = totalItems === 0 ? 0 : startIndex + 1;
  const shownEnd = endIndex;

  if (compactTop) {
    return (
      <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-[var(--muted)] tabular-nums">
          Gösterilen:{" "}
          <strong className="text-[var(--foreground)] font-extrabold">
            {shownStart.toLocaleString("tr-TR")}–
            {shownEnd.toLocaleString("tr-TR")}
          </strong>{" "}
          /{" "}
          <strong className="text-[#087F5B] dark:text-emerald-400 font-extrabold">
            {totalItems.toLocaleString("tr-TR")}
          </strong>{" "}
          kayıt
          {totalPages > 1 && (
            <span className="ml-1.5 text-[var(--muted)]">
              • Sayfa {currentPage} / {totalPages}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sayfa Başına Göster Seçicisi */}
          <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-[var(--background)] p-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
            <span className="text-[11px] font-extrabold text-[var(--muted)] px-1.5 whitespace-nowrap">
              Sayfa Başına Göster:
            </span>
            {ITEMS_PER_PAGE_OPTIONS.map((opt) => {
              const active = itemsPerPage === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => onItemsPerPageChange(opt.value)}
                  className={`min-w-[34px] h-7 px-2 rounded-lg text-xs transition-all cursor-pointer tabular-nums ${
                    active
                      ? "bg-[#087F5B] text-white font-extrabold shadow-2xs"
                      : "text-[var(--muted)] font-semibold hover:text-[var(--foreground)] hover:bg-[#F7EFE1]/70 dark:hover:bg-[var(--surface)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Üst Hızlı İleri/Geri Sayfa Geçişi */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                aria-label="Önceki Sayfa"
                className="h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <ChevronLeft size={14} />
                <span className="hidden sm:inline">Önceki</span>
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                aria-label="Sonraki Sayfa"
                className="h-8 px-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:pointer-events-none text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="hidden sm:inline">Sonraki</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <nav
      aria-label="Sözlük Sayfalama Paneli"
      className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <div className="text-xs font-bold text-[var(--muted)] tabular-nums text-center sm:text-left">
        Toplam{" "}
        <strong className="text-[var(--foreground)] font-extrabold">
          {totalItems.toLocaleString("tr-TR")}
        </strong>{" "}
        kayıttan{" "}
        <strong className="text-[#087F5B] dark:text-emerald-400 font-extrabold">
          {shownStart.toLocaleString("tr-TR")}–
          {shownEnd.toLocaleString("tr-TR")}
        </strong>{" "}
        arası gösteriliyor
        {totalPages > 1 && (
          <span>
            {" "}
            (Sayfa {currentPage} / {totalPages})
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-[#087F5B] disabled:opacity-45 disabled:pointer-events-none text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer transition-all"
          >
            <span>« Önceki</span>
          </button>

          {tokens.map((token, idx) => {
            if (token === "ellipsis-left" || token === "ellipsis-right") {
              return (
                <span
                  key={`${token}_${idx}`}
                  aria-hidden="true"
                  className="px-1.5 text-xs font-black text-[var(--muted)] select-none"
                >
                  …
                </span>
              );
            }

            const isCurrent = token === currentPage;
            return (
              <button
                key={token}
                type="button"
                aria-current={isCurrent ? "page" : undefined}
                onClick={() => onPageChange(token)}
                className={`min-w-[38px] min-h-[38px] px-2.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold tabular-nums transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-[#087F5B] border-[#065F46] text-white shadow-2xs"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                }`}
              >
                {token}
              </button>
            );
          })}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-[#087F5B] disabled:opacity-45 disabled:pointer-events-none text-xs font-extrabold text-[var(--foreground)] inline-flex items-center gap-1 cursor-pointer transition-all"
          >
            <span>Sonraki »</span>
          </button>
        </div>
      )}
    </nav>
  );
});

export default function DictionaryPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedDialogueId, setSelectedDialogueId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shareCardTarget, setShareCardTarget] =
    useState<ShareCardPayload | null>(null);

  const visualWordImageByAr = useMemo(() => {
    const map = new Map<string, string>();
    for (const gk of gorselKelimeler) {
      const key = normalizeArabicText(gk.arapca);
      if (key && !map.has(key)) {
        map.set(key, gk.gorsel || getVisualWordCoverUrl(gk.id));
      }
    }
    return map;
  }, []);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [bridgeFilter, setBridgeFilter] = useState<
    "none" | "cognates" | "classical"
  >("none");
  const [showPhonemeHeatmap, setShowPhonemeHeatmap] = useState(false);
  const [rootFilter, setRootFilter] = useState<string | null>(null);
  const [expandedCardIds, setExpandedCardIds] = useState<
    Record<string, boolean>
  >({});
  const [playingSentenceKey, setPlayingSentenceKey] = useState<string | null>(
    null
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [speakingWordId, setSpeakingWordId] = useState<string | null>(null);
  const [manifest, setManifest] = useState<Record<string, string[]>>({});
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPageOption>(
    DEFAULT_ITEMS_PER_PAGE
  );
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const [shadowingTarget, setShadowingTarget] = useState<{
    text: string;
    itemId?: string;
    refAudioUrl?: string;
    forms: { label: string; arabic: string }[];
  } | null>(null);

  const {
    toggleFavoriteWord,
    isWordFavorite,
    toggleLearnedWord,
    isWordLearned,
    favoriteWords,
    learnedWords,
    mistakeIds,
    removeMistake,
    isMistake,
    getSrsRecord,
  } = useUserStore();

  const {
    speechRate,
    showHareke,
    arabicFont,
    preferredVoiceGender,
    setPreferredVoiceGender,
  } = useSettings();
  const { playAudio } = useAudioStore();

  useEffect(() => {
    loadAudioManifest().then((m) => setManifest(m || {}));
    const raf = requestAnimationFrame(() => {
      setMounted(true);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const durum = params.get("durum");
        const dlg = params.get("diyalog");
        const kokParam = params.get("kok");
        const qParam = params.get("q");
        const tabParam = params.get("tab");
        if (durum === "learned") setStatusFilter("learned");
        if (dlg) setSelectedDialogueId(dlg);
        if (kokParam) setRootFilter(kokParam);
        if (qParam) setSearch(qParam);
        if (tabParam === "classical" || tabParam === "kuran") {
          setBridgeFilter("classical");
          setTypeFilter("all");
        } else if (tabParam === "cognates" || tabParam === "ortak") {
          setBridgeFilter("cognates");
          setTypeFilter("all");
        } else if (
          tabParam === "isim" ||
          tabParam === "fiil" ||
          tabParam === "edat" ||
          tabParam === "ozel-isim" ||
          tabParam === "ifade"
        ) {
          setTypeFilter(tabParam);
          setBridgeFilter("none");
        }
        setCurrentPage(1);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const getDisplayArabic = (text: string) =>
    formatArabicText(text, !mounted || showHareke, arabicFont);

  // O(N) tekilleştirilmiş kelime + kalıp ifade kataloğu ve O(1) ön-indeksli arama/filtre haritası
  const {
    idiomsByIdMap,
    idiomDetailsByIdMap,
    unifiedAllWordsAndIdioms,
    preparedMetaMap,
  } = useMemo(() => {
    const idMap = new Map<string, DictionaryItem>();
    const detailMap = new Map<string, ArabicIdiom>();
    const normMap = new Map<string, DictionaryItem>();
    const cleanMap = new Map<string, DictionaryItem>();
    const sameVocalAndCatMap = new Map<string, DictionaryItem>();
    const unifiedList: DictionaryItem[] = [];

    // 1. Sözlük içindeki tüm kayıtları O(1) harita ile tekilleştirerek ekle
    for (const w of sozluk) {
      const primaryAr = (w.mufret || w.mazi || "").split("/")[0].trim();
      if (!primaryAr) continue;
      const cat = getWordCategory(w);
      const dedupKey = `${primaryAr}__${cat}`;
      const existingSameVocalAndCat = sameVocalAndCatMap.get(dedupKey);

      if (existingSameVocalAndCat) {
        existingSameVocalAndCat.anlam_tr = mergeTurkishMeanings(
          existingSameVocalAndCat.anlam_tr,
          w.anlam_tr
        );
        continue;
      }

      const cloned: DictionaryItem = { ...w };
      sameVocalAndCatMap.set(dedupKey, cloned);
      unifiedList.push(cloned);

      const normKey = normalizeArabicText(primaryAr);
      const cleanKey = cleanArabicText(primaryAr);
      if (normKey && !normMap.has(normKey)) normMap.set(normKey, cloned);
      if (cleanKey && !cleanMap.has(cleanKey)) cleanMap.set(cleanKey, cloned);
    }

    // 2. Kalıp ifadeleri birleştir
    const catalog = getCombinedIdiomsCatalog();
    for (const idm of catalog) {
      const canonicalId = idm.id.startsWith("idiom_")
        ? idm.id
        : `idiom_${idm.id}`;
      const primaryIdmAr = idm.arabic.split("/")[0].trim();
      const normAr = normalizeArabicText(primaryIdmAr);
      const cleanAr = cleanArabicText(primaryIdmAr);

      const existingItem =
        (normAr ? normMap.get(normAr) : undefined) ||
        (cleanAr ? cleanMap.get(cleanAr) : undefined);

      if (existingItem) {
        existingItem.anlam_tr = mergeTurkishMeanings(
          existingItem.anlam_tr,
          idm.meaningTr
        );
        const enrichedIdiom: ArabicIdiom = {
          ...idm,
          meaningTr: existingItem.anlam_tr,
        };
        detailMap.set(existingItem.id, enrichedIdiom);
        detailMap.set(idm.id, enrichedIdiom);
        detailMap.set(canonicalId, enrichedIdiom);
        detailMap.set(`idm_${idm.id}`, enrichedIdiom);

        idMap.set(existingItem.id, existingItem);
        idMap.set(idm.id, existingItem);
        idMap.set(canonicalId, existingItem);
        idMap.set(`idm_${idm.id}`, existingItem);
      } else {
        const item: DictionaryItem = {
          id: canonicalId,
          mufret: idm.arabic,
          anlam_tr: idm.meaningTr,
          kok: "-",
          tur: "ifade",
        };
        unifiedList.push(item);
        if (normAr) normMap.set(normAr, item);
        if (cleanAr) cleanMap.set(cleanAr, item);

        idMap.set(idm.id, item);
        idMap.set(canonicalId, item);
        idMap.set(`idm_${idm.id}`, item);

        detailMap.set(idm.id, idm);
        detailMap.set(canonicalId, idm);
        detailMap.set(`idm_${idm.id}`, idm);
      }
    }

    // 3. Her kayıt için kategori, kök, Kur'ân Köprüsü, ortak kelime ve arama indekslerini bir kez hesapla
    const metaMap = new Map<string, PreparedWordMeta>();
    for (const item of unifiedList) {
      const idmDetail = detailMap.get(item.id);
      const isIdiom =
        (item.tur || "").toLowerCase() === "ifade" ||
        item.id.startsWith("idiom_") ||
        Boolean(idmDetail);
      const category = getWordCategory(item);
      const rawArJoined = [
        item.mufret || "",
        item.cemi || "",
        item.mazi || "",
        item.muzari || "",
        item.masdar || "",
        item.kok || "",
      ]
        .filter(Boolean)
        .join(" ");

      metaMap.set(item.id, {
        category,
        isIdiom,
        cognateInfo: getCognateInfoForDictionaryItem(item),
        classicalBridge: getClassicalBridgeForRoot(item.kok),
        cleanRoot:
          item.kok && item.kok !== "-"
            ? cleanArabicText(item.kok).replace(/\s+/g, "")
            : "",
        searchLowerTr: [
          item.anlam_tr || "",
          idmDetail?.literalTr || "",
          idmDetail?.usageNote || "",
        ]
          .join(" ")
          .toLowerCase(),
        searchRawAr: rawArJoined,
        searchCleanAr: cleanArabicText(rawArJoined),
        searchNormAr: normalizeArabicText(rawArJoined),
      });
    }

    return {
      idiomsByIdMap: idMap,
      idiomDetailsByIdMap: detailMap,
      unifiedAllWordsAndIdioms: unifiedList,
      preparedMetaMap: metaMap,
    };
  }, []);

  const getWordMeta = useMemo(() => {
    return (word: DictionaryItem): PreparedWordMeta => {
      const cached = preparedMetaMap.get(word.id);
      if (cached) return cached;
      const idmDetail = idiomDetailsByIdMap.get(word.id);
      const isIdiom =
        (word.tur || "").toLowerCase() === "ifade" ||
        word.id.startsWith("idiom_") ||
        Boolean(idmDetail);
      const rawArJoined = [
        word.mufret || "",
        word.cemi || "",
        word.mazi || "",
        word.muzari || "",
        word.masdar || "",
        word.kok || "",
      ]
        .filter(Boolean)
        .join(" ");
      const fallback: PreparedWordMeta = {
        category: getWordCategory(word),
        isIdiom,
        cognateInfo: getCognateInfoForDictionaryItem(word),
        classicalBridge: getClassicalBridgeForRoot(word.kok),
        cleanRoot:
          word.kok && word.kok !== "-"
            ? cleanArabicText(word.kok).replace(/\s+/g, "")
            : "",
        searchLowerTr: [
          word.anlam_tr || "",
          idmDetail?.literalTr || "",
          idmDetail?.usageNote || "",
        ]
          .join(" ")
          .toLowerCase(),
        searchRawAr: rawArJoined,
        searchCleanAr: cleanArabicText(rawArJoined),
        searchNormAr: normalizeArabicText(rawArJoined),
      };
      preparedMetaMap.set(word.id, fallback);
      return fallback;
    };
  }, [preparedMetaMap, idiomDetailsByIdMap]);

  // Seçili diyaloğun morfolojik kelime haritası (getDialogueVocabulary ile)
  const dialogueContextMap = useMemo(() => {
    if (selectedDialogueId === "all") return null;
    const entries = getDialogueVocabulary(selectedDialogueId);
    const map = new Map<string, DialogueVocabularyEntry>();
    entries.forEach((e) => map.set(e.item.id, e));
    return map;
  }, [selectedDialogueId]);

  const totalAllItemsCount = unifiedAllWordsAndIdioms.length;

  const basePool = useMemo(() => {
    if (dialogueContextMap) {
      const vocabItems = Array.from(dialogueContextMap.values()).map((e) => ({
        ...e.item,
      }));
      const dlgObj = diyaloglar.find((d) => d.id === selectedDialogueId);
      const dlgIdioms = dlgObj
        ? extractDialogueIdioms(dlgObj.satirlar, dlgObj.seviye)
        : [];
      const seenByCleanAr = new Map<string, DictionaryItem>();
      for (const v of vocabItems) {
        const cKey = cleanArabicText(
          (v.mufret || v.mazi || "").split("/")[0].trim()
        );
        if (cKey) seenByCleanAr.set(cKey, v);
      }

      const extraDlgIdiomItems: DictionaryItem[] = [];
      for (const dIdm of dlgIdioms) {
        const cleanAr = cleanArabicText(dIdm.arabic.split("/")[0].trim());
        const existingVocab = cleanAr ? seenByCleanAr.get(cleanAr) : undefined;
        if (existingVocab) {
          existingVocab.anlam_tr = mergeTurkishMeanings(
            existingVocab.anlam_tr,
            dIdm.meaningTr
          );
        } else if (cleanAr) {
          const resolved = idiomsByIdMap.get(dIdm.id) || {
            id: `idiom_${dIdm.id}`,
            mufret: dIdm.arabic,
            anlam_tr: dIdm.meaningTr,
            kok: "-",
            tur: "ifade",
          };
          seenByCleanAr.set(cleanAr, resolved);
          extraDlgIdiomItems.push(resolved);
        }
      }
      return [...vocabItems, ...extraDlgIdiomItems];
    }
    return unifiedAllWordsAndIdioms;
  }, [
    dialogueContextMap,
    selectedDialogueId,
    idiomsByIdMap,
    unifiedAllWordsAndIdioms,
  ]);

  // Sekme üstü anlık kayıt sayıları (O(N) hafif meta okuması)
  const sectionCounts = useMemo(() => {
    const counts = {
      all: 0,
      isim: 0,
      fiil: 0,
      edat: 0,
      "ozel-isim": 0,
      ifade: 0,
      cognates: 0,
      classical: 0,
    };
    for (const w of basePool) {
      if (!w || !w.id || !(w.mufret || w.mazi) || !w.anlam_tr) continue;
      counts.all += 1;
      const meta = getWordMeta(w);
      if (meta.isIdiom) {
        counts.ifade += 1;
      } else {
        counts[meta.category] += 1;
      }
      if (meta.cognateInfo) counts.cognates += 1;
      if (meta.classicalBridge) counts.classical += 1;
    }
    return counts;
  }, [basePool, getWordMeta]);

  const filteredWords = useMemo(() => {
    let result: DictionaryItem[] = basePool;

    // 1. Öğrenilme / Favori / Zorlandıklarım durumuna göre filtreleme
    if (mounted) {
      if (statusFilter === "mistakes") {
        const resolvedMistakes = resolveMistakesPool(mistakeIds);
        const mistakeWordIds = new Set(resolvedMistakes.words.map((w) => w.id));
        const baseMap = new Map(result.map((w) => [w.id, w]));
        const finalMistakeWords: DictionaryItem[] = [];
        const seenM = new Set<string>();

        for (const mw of resolvedMistakes.words) {
          if (dialogueContextMap && !baseMap.has(mw.id)) continue;
          if (!seenM.has(mw.id)) {
            seenM.add(mw.id);
            finalMistakeWords.push(baseMap.get(mw.id) || mw);
          }
        }
        for (const w of result) {
          if (
            (mistakeWordIds.has(w.id) || isMistake(w.id)) &&
            !seenM.has(w.id)
          ) {
            seenM.add(w.id);
            finalMistakeWords.push(w);
          }
        }
        result = finalMistakeWords;
      } else if (statusFilter === "learned") {
        const baseIds = new Set(result.map((w) => w.id));
        const extraLearnedIdioms: DictionaryItem[] = [];
        if (!dialogueContextMap) {
          for (const lId of learnedWords) {
            if (!baseIds.has(lId) && idiomsByIdMap.has(lId)) {
              const resolved = idiomsByIdMap.get(lId)!;
              if (!baseIds.has(resolved.id)) {
                baseIds.add(resolved.id);
                extraLearnedIdioms.push(resolved);
              }
            }
          }
        }
        const learnedSet = new Set(learnedWords);
        result = [...result, ...extraLearnedIdioms].filter(
          (w) =>
            Boolean(w && w.id && (w.mufret || w.mazi) && w.anlam_tr) &&
            (learnedSet.has(w.id) ||
              learnedSet.has(w.id.replace(/^idiom_/, "")))
        );
      } else if (statusFilter === "unlearned") {
        const learnedSet = new Set(learnedWords);
        result = result.filter(
          (w) =>
            !learnedSet.has(w.id) &&
            !learnedSet.has(w.id.replace(/^idiom_/, ""))
        );
      } else if (statusFilter === "favorites") {
        const baseMap = new Map<string, DictionaryItem>();
        result.forEach((w) => baseMap.set(w.id, w));

        const resolvedFavorites: DictionaryItem[] = [];
        const seenFavIds = new Set<string>();

        for (const fw of favoriteWords) {
          if (!fw || !fw.id) continue;
          const fromBase = baseMap.get(fw.id);
          const fromIdiom = idiomsByIdMap.get(fw.id);
          const candidate: DictionaryItem | undefined =
            fromBase ||
            (fw.mufret || fw.mazi ? fw : undefined) ||
            fromIdiom;

          if (
            candidate &&
            (candidate.mufret || candidate.mazi) &&
            candidate.anlam_tr &&
            !seenFavIds.has(candidate.id)
          ) {
            if (!dialogueContextMap || baseMap.has(candidate.id)) {
              seenFavIds.add(candidate.id);
              resolvedFavorites.push(candidate);
            }
          }
        }
        result = resolvedFavorites;
      }
    }

    // 2. Kelime türüne göre O(1) meta filtreleme
    if (typeFilter === "ifade") {
      result = result.filter((w) => getWordMeta(w).isIdiom);
    } else if (typeFilter !== "all") {
      result = result.filter((w) => {
        const meta = getWordMeta(w);
        return !meta.isIdiom && meta.category === typeFilter;
      });
    }

    // 2.5. Kök Ailesi (İştikak) Filtresi
    if (rootFilter && rootFilter !== "-") {
      const targetRootClean = cleanArabicText(rootFilter).replace(/\s+/g, "");
      if (targetRootClean.length >= 2) {
        result = result.filter(
          (w) => getWordMeta(w).cleanRoot === targetRootClean
        );
      }
    }

    // 2.6. Türkçeyle Ortak Kelimeler veya Kur'ân & Klasik Köprü Hızlı Filtresi
    if (bridgeFilter === "cognates") {
      result = result.filter((w) => Boolean(getWordMeta(w).cognateInfo));
    } else if (bridgeFilter === "classical") {
      result = result.filter((w) => Boolean(getWordMeta(w).classicalBridge));
    }

    // 3. Ön-indeksli Arapça / Türkçe Anlık Arama
    const trimmedQuery = deferredSearch.trim();
    if (trimmedQuery) {
      const qLower = trimmedQuery.toLowerCase();
      const qCleanAr = cleanArabicText(trimmedQuery);
      const qNormAr = normalizeArabicText(trimmedQuery);
      const morphMatched = analyzeAndMatchWord(trimmedQuery);
      const morphMatchedId = morphMatched?.item.id;

      result = result.filter((word) => {
        if (morphMatchedId && morphMatchedId === word.id) return true;
        const meta = getWordMeta(word);
        if (meta.searchLowerTr.includes(qLower)) return true;
        if (meta.searchRawAr.includes(trimmedQuery)) return true;
        if (qCleanAr.length > 0 && meta.searchCleanAr.includes(qCleanAr)) {
          return true;
        }
        if (qNormAr.length > 0 && meta.searchNormAr.includes(qNormAr)) {
          return true;
        }
        return false;
      });
    }

    return result.filter((w) =>
      Boolean(w && w.id && (w.mufret || w.mazi) && w.anlam_tr)
    );
  }, [
    basePool,
    dialogueContextMap,
    typeFilter,
    bridgeFilter,
    rootFilter,
    statusFilter,
    deferredSearch,
    mounted,
    learnedWords,
    favoriteWords,
    mistakeIds,
    isMistake,
    idiomsByIdMap,
    getWordMeta,
  ]);

  // Performans dostu sayfalama (slice): Sadece aktif sayfadaki kartlar DOM'a basılır
  const pagination = useMemo(
    () => paginateDictionaryItems(filteredWords, currentPage, itemsPerPage),
    [filteredWords, currentPage, itemsPerPage]
  );

  const handlePageChange = (nextPage: number) => {
    playClick();
    setCurrentPage(nextPage);
    if (typeof window !== "undefined" && listTopRef.current) {
      listTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleItemsPerPageChange = (nextLimit: ItemsPerPageOption) => {
    playClick();
    setItemsPerPage(nextLimit);
    setCurrentPage(1);
  };

  // Kelimeyi sesli dinle (Çift Cinsiyetli MP3 varsa MP3, yoksa seçili cinsiyette TTS)
  const handleListenWord = async (
    word: DictionaryItem,
    customArabic?: string
  ) => {
    playClick();
    const primaryArabic =
      customArabic ||
      (word.mufret || word.mazi || word.muzari || "").split("/")[0].trim();
    if (!primaryArabic) return;

    const rate = mounted ? speechRate : 1;
    setSpeakingWordId(word.id);

    try {
      if (!customArabic && (word.ses_erkek || word.ses_kadin)) {
        await playDualGenderAudio({
          text: primaryArabic,
          id: word.id,
          ses_erkek: word.ses_erkek,
          ses_kadin: word.ses_kadin,
          rate,
          gender: preferredVoiceGender,
        });
      } else if (
        manifest.words &&
        manifest.words.includes(word.id) &&
        !customArabic
      ) {
        await playAudio(`/audio/words/${word.id}.mp3`, 0, rate);
      } else {
        await playTTS(
          primaryArabic,
          rate,
          preferredVoiceGender === "kadin" ? "kadin" : "erkek"
        );
      }
    } catch {
      await playTTS(
        primaryArabic,
        rate,
        preferredVoiceGender === "kadin" ? "kadin" : "erkek"
      );
    } finally {
      setSpeakingWordId(null);
    }
  };

  // Kelimenin tüm formlarını hazırla (Gölgeleme modalı için)
  const prepareForms = (word: DictionaryItem) => {
    const forms: { label: string; arabic: string }[] = [];
    const category = getWordCategory(word);
    if (category === "fiil" || word.mazi || word.muzari) {
      if (word.mazi) forms.push({ label: "Mâzî (Geçmiş)", arabic: word.mazi });
      if (word.muzari)
        forms.push({ label: "Muzâri (Şimdiki/Geniş)", arabic: word.muzari });
      if (word.masdar)
        forms.push({ label: "Masdar (İsim Hali)", arabic: word.masdar });
      if (forms.length === 0 && word.mufret) {
        forms.push({ label: "Fiil Formu", arabic: word.mufret });
      }
    } else {
      if (word.mufret)
        forms.push({ label: "Müfret (Tekil)", arabic: word.mufret });
      if (word.cemi && word.cemi !== "-")
        forms.push({ label: "Cemî (Çoğul)", arabic: word.cemi });
    }
    return forms.length > 0 ? forms : null;
  };

  const handleMicClick = (word: DictionaryItem) => {
    playClick();
    const forms = prepareForms(word);
    if (forms && forms.length > 0) {
      setShadowingTarget({
        text: forms[0].arabic,
        itemId: word.id,
        refAudioUrl: getDualGenderAudioUrl(word, preferredVoiceGender),
        forms,
      });
    }
  };

  const handlePlayExampleSentence = async (ex: ExampleSentenceMatch) => {
    playClick();
    const key = `${ex.dialogueId}_${ex.sira}`;
    const rate = mounted ? speechRate : 1;
    setPlayingSentenceKey(key);
    try {
      if (hasMp3(ex.dialogueId, ex.sira)) {
        await playAudio(getMp3Path(ex.dialogueId, ex.sira), 0, rate);
      } else {
        await playTTS(ex.arapca, rate);
      }
    } catch {
      await playTTS(ex.arapca, rate);
    } finally {
      setPlayingSentenceKey(null);
    }
  };

  const hasActiveFilter =
    selectedDialogueId !== "all" ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    bridgeFilter !== "none" ||
    Boolean(rootFilter);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* GÖLGELEME MODALI */}
      {shadowingTarget && (
        <ShadowingModal
          text={shadowingTarget.text}
          itemId={shadowingTarget.itemId}
          refAudioUrl={shadowingTarget.refAudioUrl}
          forms={shadowingTarget.forms}
          onClose={() => setShadowingTarget(null)}
        />
      )}

      {/* ÜST BAŞLIK & SESLENDİRİCİ CİNSİYET SEÇİCİ */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            onClick={() => playClick()}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 flex items-center justify-center text-[var(--foreground)] hover:bg-[#EFE3CE] active:border-b-2 active:translate-y-0.5 transition-all shrink-0"
            aria-label="Ana Sayfaya Dön"
          >
            <ChevronLeft size={19} strokeWidth={2.5} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-extrabold text-[var(--foreground)] tracking-tight leading-tight truncate">
              İnteraktif Arapça Sözlük
            </h1>
            <p className="text-[11px] sm:text-xs font-medium text-[var(--muted)] truncate">
              {basePool.length.toLocaleString("tr-TR")} Kelime &amp; İfade • Fiil / İsim / Edat renk kodlamalı morfolojik kök sözlüğü
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowPhonemeHeatmap(true);
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-2 border-[#6741D9] border-b-4 text-xs font-extrabold text-[#4C28B5] dark:text-[#d0bfff] hover:opacity-95 transition-all cursor-pointer shrink-0"
          >
            🗣️ 28 Harf Mahreç Haritam
          </button>

          <div className="flex items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--surface)] p-1 rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)]">
            <span className="text-[11px] font-extrabold text-[var(--muted)] px-1.5 hidden sm:inline">
              Ses:
            </span>
            {(
              [
                { id: "erkek", label: "👨 Erkek" },
                { id: "kadin", label: "👩 Kadın" },
              ] as { id: VoiceGender; label: string }[]
            ).map((g) => {
              const active =
                (mounted ? preferredVoiceGender : "erkek") === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    setPreferredVoiceGender(g.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    active
                      ? "bg-[#087F5B] text-white shadow-2xs"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-extrabold text-[var(--foreground)] tabular-nums shrink-0">
            {filteredWords.length.toLocaleString("tr-TR")} /{" "}
            {basePool.length.toLocaleString("tr-TR")}
          </div>
        </div>
      </div>

      {/* KOMPAKT KONTROL ŞERİDİ (MOBİLDE TEK SATIR ARAMA + FİLTRELER + ALT SEKMELER) */}
      <section className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-2 sm:p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Anlık Arapça/Türkçe Arama */}
          <div className="relative flex-1 min-w-[160px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Arapça, Türkçe veya kök ara..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] rounded-xl pl-8 pr-8 text-xs font-semibold text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#087F5B]"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                aria-label="Aramayı Temizle"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Mobilde [SlidersHorizontal] Filtreler Açılır/Kapanır Butonu */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setMobileFiltersOpen((v) => !v);
            }}
            className={`sm:hidden h-9 px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
              mobileFiltersOpen || hasActiveFilter
                ? "bg-[#6741D9] border-[#5230B5] text-white"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>Filtreler</span>
          </button>

          {/* 2. Diyaloğa Göre Filtreleme Dropdown (Masaüstünde görünür, mobilde Filtreler içinde) */}
          <div className="hidden sm:flex bg-white dark:bg-[var(--background)] rounded-xl px-2 h-9 border border-[#E6D7BE] dark:border-[var(--border)] items-center">
            <select
              value={selectedDialogueId}
              onChange={(e) => {
                playClick();
                setSelectedDialogueId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-bold text-[var(--foreground)] focus:outline-none cursor-pointer max-w-[190px] truncate"
            >
              <option value="all">Tüm Sözlük ({totalAllItemsCount})</option>
              {diyaloglar.map((dlg) => {
                const num = dlg.id.replace("dlg_", "");
                return (
                  <option key={dlg.id} value={dlg.id}>
                    #{num} — {dlg.baslik_tr} ({dlg.seviye})
                  </option>
                );
              })}
            </select>
          </div>

          {/* 3. Öğrenme Durumu Hapları (Masaüstünde görünür) */}
          <div className="hidden sm:flex bg-white dark:bg-[var(--background)] rounded-xl p-1 border border-[#E6D7BE] dark:border-[var(--border)] items-center gap-1 flex-wrap">
            {(
              [
                { id: "all", label: "Tümü" },
                {
                  id: "learned",
                  label: `Öğrendim (${mounted ? learnedWords.length : 0})`,
                },
                { id: "unlearned", label: "Çalışılmadı" },
                {
                  id: "favorites",
                  label: `Favori (${mounted ? favoriteWords.length : 0})`,
                },
                {
                  id: "mistakes",
                  label: `⚡ Hata Defterim (${mounted ? mistakeIds.length : 0})`,
                },
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    playClick();
                    setStatusFilter(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2 py-1 text-xs rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? tab.id === "mistakes"
                        ? "bg-amber-600 text-white font-semibold shadow-2xs"
                        : "bg-[#087F5B] text-white font-semibold shadow-2xs"
                      : "text-[var(--muted)] font-medium hover:text-[var(--foreground)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Mobil Uyumlu Kategori ve Hızlı Alt Sekmeler (Her sekme kendi verisi üzerinde bağımsız sayfalanır) */}
        <div className="relative">
          <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap sm:flex-wrap gap-1.5 sm:gap-2 items-center py-1 pr-6 sm:pr-0">
          {(
            [
              {
                id: "all",
                label: `Tümü (${sectionCounts.all.toLocaleString("tr-TR")})`,
                activeClass: "bg-[#087F5B] border-[#065F46] text-white",
              },
              {
                id: "isim",
                label: `📘 İsimler (${sectionCounts.isim.toLocaleString("tr-TR")})`,
                activeClass: "bg-sky-600 border-sky-700 text-white",
              },
              {
                id: "fiil",
                label: `⚡ Fiiller (${sectionCounts.fiil.toLocaleString("tr-TR")})`,
                activeClass: "bg-amber-600 border-amber-700 text-white",
              },
              {
                id: "edat",
                label: `🔗 Edatlar (${sectionCounts.edat.toLocaleString("tr-TR")})`,
                activeClass: "bg-purple-600 border-purple-700 text-white",
              },
              {
                id: "ozel-isim",
                label: `👤 Özel İsimler (${sectionCounts["ozel-isim"].toLocaleString("tr-TR")})`,
                activeClass: "bg-teal-600 border-teal-700 text-white",
              },
              {
                id: "ifade",
                label: `✨ Kalıp İfadeler (${sectionCounts.ifade.toLocaleString("tr-TR")})`,
                activeClass: "bg-[#6741D9] border-[#5230B5] text-white",
              },
            ] as { id: TypeFilter; label: string; activeClass: string }[]
          ).map((t) => {
            const active =
              typeFilter === t.id &&
              bridgeFilter === "none" &&
              statusFilter !== "mistakes";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  playClick();
                  setTypeFilter(t.id);
                  setBridgeFilter("none");
                  setCurrentPage(1);
                  if (statusFilter === "mistakes") {
                    setStatusFilter("all");
                  }
                }}
                className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all shrink-0 cursor-pointer ${
                  active
                    ? `${t.activeClass} font-bold shadow-2xs`
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] font-medium hover:text-[var(--foreground)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}

          {/* Alt Sekme: 🤝 Türkçeyle Ortak Kelimeler */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setBridgeFilter((prev) =>
                prev === "cognates" ? "none" : "cognates"
              );
              setTypeFilter("all");
              if (statusFilter === "mistakes") {
                setStatusFilter("all");
              }
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all shrink-0 cursor-pointer ${
              bridgeFilter === "cognates"
                ? "bg-emerald-700 border-emerald-800 text-white font-bold shadow-2xs"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-emerald-800 dark:text-emerald-300 font-semibold hover:border-emerald-500"
            }`}
          >
            🤝 Türkçeyle Ortak Kelimeler ({sectionCounts.cognates.toLocaleString("tr-TR")})
          </button>

          {/* Alt Sekme: 🕌 Kur'ân & Klasik Köprü */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setBridgeFilter((prev) =>
                prev === "classical" ? "none" : "classical"
              );
              setTypeFilter("all");
              if (statusFilter === "mistakes") {
                setStatusFilter("all");
              }
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all shrink-0 cursor-pointer ${
              bridgeFilter === "classical"
                ? "bg-[#92400E] border-[#78350F] text-white font-bold shadow-2xs"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[#92400E] dark:text-amber-300 font-semibold hover:border-amber-500"
            }`}
          >
            🕌 Kur&apos;ân &amp; Klasik Köprü ({sectionCounts.classical.toLocaleString("tr-TR")})
          </button>

          {/* Hızlı Filtre: ⚡ Hata Defterim (Hem Mobil Hem Masaüstünde Tek Dokunuşla) */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setStatusFilter((prev) =>
                prev === "mistakes" ? "all" : "mistakes"
              );
              setCurrentPage(1);
            }}
            className={`whitespace-nowrap px-3 py-1.5 text-xs sm:text-sm rounded-xl border transition-all shrink-0 cursor-pointer ${
              statusFilter === "mistakes"
                ? "bg-amber-600 border-amber-700 text-white font-bold shadow-2xs"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-amber-700 dark:text-amber-300 font-semibold hover:border-amber-400"
            }`}
          >
            ⚡ Hata Defterim ({mounted ? mistakeIds.length : 0})
          </button>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none sm:hidden absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-[#FBF6EC] dark:from-[var(--surface)] to-transparent flex items-center justify-end pr-0.5 text-[var(--muted)]/80"
          >
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Mobilde [SlidersHorizontal] Filtreler Açıkken Diyalog Seçici ve Öğrenme Durumu */}
        {mobileFiltersOpen && (
          <div className="sm:hidden pt-2 border-t border-dashed border-[#E2D3B8] space-y-2">
            <div className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 h-9 border border-[#E6D7BE] dark:border-[var(--border)] flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--muted)] mr-2 shrink-0">
                Diyalog:
              </span>
              <select
                value={selectedDialogueId}
                onChange={(e) => {
                  playClick();
                  setSelectedDialogueId(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent text-xs font-bold text-[var(--foreground)] focus:outline-none cursor-pointer w-full truncate"
              >
                <option value="all">Tüm Sözlük ({totalAllItemsCount})</option>
                {diyaloglar.map((dlg) => {
                  const num = dlg.id.replace("dlg_", "");
                  return (
                    <option key={dlg.id} value={dlg.id}>
                      #{num} — {dlg.baslik_tr} ({dlg.seviye})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5 py-0.5">
              {(
                [
                  { id: "all", label: "Tümü" },
                  {
                    id: "learned",
                    label: `Öğrendim (${mounted ? learnedWords.length : 0})`,
                  },
                  { id: "unlearned", label: "Çalışılmadı" },
                  {
                    id: "favorites",
                    label: `Favori (${mounted ? favoriteWords.length : 0})`,
                  },
                  {
                    id: "mistakes",
                    label: `⚡ Hata Defterim (${mounted ? mistakeIds.length : 0})`,
                  },
                ] as { id: StatusFilter; label: string }[]
              ).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      playClick();
                      setStatusFilter(tab.id);
                      setCurrentPage(1);
                    }}
                    className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-xl border transition-all shrink-0 cursor-pointer ${
                      active
                        ? "bg-[#087F5B] border-[#065F46] text-white font-semibold"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--muted)] font-medium"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Aktif Kök Ailesi (İştikak) Filtresi Şeridi */}
        {rootFilter && (
          <div className="pt-2 border-t border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-wrap items-center justify-between gap-2 bg-emerald-50/90 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700/60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-[#065F46] dark:text-emerald-300">
                🌿 Kök Ailesi:
              </span>
              <bdi
                dir="rtl"
                className="arabic font-arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-200 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700"
              >
                {getDisplayArabic(rootFilter)}
              </bdi>
              <span className="text-[11px] font-semibold text-[var(--muted)]">
                ({filteredWords.length} türemiş kelime gösteriliyor)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                playClick();
                setRootFilter(null);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 border border-emerald-400 hover:border-rose-400 text-xs font-extrabold text-[var(--foreground)] hover:text-rose-600 transition-all cursor-pointer shrink-0"
            >
              ✕ Kök Filtresini Kaldır
            </button>
          </div>
        )}
      </section>

      {/* LİSTE BAŞI ÇAPASI + SAYFA BAŞINA GÖSTER & HIZLI SAYFA ÖZETİ */}
      <div ref={listTopRef} className="scroll-mt-20" />

      {/* SÖZLÜK KARTLARI IZGARASI */}
      {filteredWords.length === 0 ? (
        <div className="bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-2xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 p-10 text-center space-y-3">
          <p className="text-base font-extrabold text-[var(--foreground)]">
            {statusFilter === "mistakes"
              ? "Harika! Şu an hata defterinizde zorlandığınız bir kelime veya kalıp ifade bulunmuyor."
              : "Arama kriterlerinize uygun kelime veya kalıp ifade bulunamadı."}
          </p>
          <button
            type="button"
            onClick={() => {
              playClick();
              setSearch("");
              setSelectedDialogueId("all");
              setStatusFilter("all");
              setTypeFilter("all");
              setBridgeFilter("none");
              setRootFilter(null);
              setCurrentPage(1);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#087F5B] text-white text-xs font-bold border-b-4 border-[#065F46] cursor-pointer"
          >
            Filtreleri Temizle
          </button>
        </div>
      ) : (
        <>
          <SmartPaginationBar
            compactTop={true}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            tokens={pagination.tokens}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pagination.items.map((word) => {
              const wordMeta = getWordMeta(word);
              const isFav = mounted && isWordFavorite(word.id);
              const isLearned =
                mounted &&
                (isWordLearned(word.id) ||
                  isWordLearned(word.id.replace(/^idiom_/, "")));
              const isSpeaking = speakingWordId === word.id;
              const mainArabic = word.mufret || word.mazi || "";
              const contextEntry = dialogueContextMap?.get(word.id);
              const isIdiomCard = wordMeta.isIdiom;
              const idiomDetail = idiomDetailsByIdMap.get(word.id);
              const srsRecord = mounted
                ? getSrsRecord(word.id) ||
                  getSrsRecord(word.id.replace(/^idiom_/, ""))
                : undefined;
              const srsBadge = formatSrsBadgeInfo(srsRecord);
              const category = wordMeta.category;
            const theme = isIdiomCard
              ? {
                  leftBorder: "border-l-4 border-l-[#6741D9]",
                  badgeText: "✨ Kalıp İfade (تعبير اصطلاحي)",
                  badgeClass:
                    "bg-[#F3F0FF] text-[#6741D9] border-[#6741D9]/30 dark:bg-indigo-950/70 dark:text-indigo-200 dark:border-indigo-500/40",
                  arabicColor:
                    "text-[#065F46] dark:text-emerald-400 group-hover:text-[#065F46]",
                }
              : getCategoryCardTheme(category);

            return (
              <div
                key={word.id}
                className={`rounded-2xl border-2 border-b-4 ${
                  theme.leftBorder
                } p-4 flex flex-col justify-between transition-all ${
                  isLearned
                    ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9]"
                    : "bg-[#F7EFE1] dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)]"
                }`}
              >
                <div className="space-y-2.5">
                  {/* Üst Satır: Tür Rozeti + Kök + Arapça Ana Kelime / Kalıp İfade */}
                  <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] pb-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${theme.badgeClass}`}
                        >
                          {theme.badgeText}
                        </span>
                        {idiomDetail?.level && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-[#065F46] dark:text-emerald-300 text-[10px] font-extrabold">
                            {idiomDetail.level}
                          </span>
                        )}
                        {!isIdiomCard && word.kok && word.kok !== "-" && (
                          <button
                            type="button"
                            dir="ltr"
                            onClick={() => {
                              playClick();
                              setRootFilter((prev) =>
                                prev === word.kok ? null : word.kok || null
                              );
                              setCurrentPage(1);
                            }}
                            title="Bu kökten türeyen tüm kelimeleri (Kök Ailesini) filtrelemek için tıklayın"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold transition-all cursor-pointer ${
                              rootFilter === word.kok
                                ? "bg-emerald-600 border-emerald-700 text-white shadow-2xs"
                                : "bg-white/80 dark:bg-slate-800/80 border-[#E6D7BE] dark:border-slate-700 text-[var(--muted)] hover:border-[#087F5B] hover:text-[#065F46] dark:text-emerald-400"
                            }`}
                          >
                            <span>🌿 Kök:</span>
                            <bdi
                              dir="rtl"
                              className={`arabic font-arabic text-sm font-bold inline-block ${
                                rootFilter === word.kok
                                  ? "text-white"
                                  : "text-[var(--foreground)]"
                              }`}
                            >
                              {getDisplayArabic(word.kok)}
                            </bdi>
                          </button>
                        )}
                      </div>

                      <p
                        dir="ltr"
                        className="text-sm font-extrabold text-[var(--foreground)] leading-snug text-left"
                      >
                        {splitMixedBidiText(word.anlam_tr).map((seg, sIdx) =>
                          seg.isArabic ? (
                            <bdi
                              key={sIdx}
                              dir="rtl"
                              className="arabic font-arabic font-bold inline-block mx-0.5"
                            >
                              {getDisplayArabic(seg.text)}
                            </bdi>
                          ) : (
                            <span key={sIdx}>{seg.text}</span>
                          )
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleListenWord(word)}
                      data-tooltip="Kelimeyi sesli dinlemek için tıklayın"
                      className="text-right group cursor-pointer shrink-0 max-w-[55%]"
                    >
                      <span
                        dir="rtl"
                        className={`arabic font-arabic ${
                          isIdiomCard ? "text-2xl sm:text-3xl" : "text-3xl"
                        } font-bold transition-colors block leading-tight ${
                          theme.arabicColor
                        }`}
                      >
                        {getDisplayArabic(mainArabic)}
                      </span>
                      {contextEntry?.contextWord && (
                        <span
                          dir="ltr"
                          className="inline-flex items-center justify-end gap-1 text-xs md:text-sm font-medium text-[#6741D9] mt-0.5"
                        >
                          <span>Metinde:</span>
                          <bdi
                            dir="rtl"
                            className="arabic text-base md:text-lg font-arabic font-bold inline-block"
                          >
                            {getDisplayArabic(contextEntry.contextWord)}
                          </bdi>
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Kalıp İfade Harfiyen Anlamı ve Kullanım İpucu Kutucuğu (Gece modu dark: uyumlu) */}
                  {isIdiomCard &&
                    (idiomDetail?.literalTr || idiomDetail?.usageNote) && (
                      <div
                        dir="ltr"
                        className="rounded-xl bg-white dark:bg-slate-900/90 border border-[#E6D7BE] dark:border-slate-700 p-2.5 space-y-1 text-left"
                      >
                        {idiomDetail.literalTr && (
                          <p className="text-xs font-bold text-[#4C28B5] dark:text-indigo-200 leading-snug">
                            <span className="font-extrabold">
                              Harfiyen Anlamı:
                            </span>{" "}
                            <span className="font-semibold text-[var(--foreground)] dark:text-slate-200">
                              {idiomDetail.literalTr}
                            </span>
                          </p>
                        )}
                        {idiomDetail.usageNote && (
                          <p className="text-[11px] font-semibold text-[var(--muted)] dark:text-slate-300 leading-snug">
                            <span className="font-extrabold text-[#065F46] dark:text-emerald-300">
                              💡 Kullanım İpucu:
                            </span>{" "}
                            {idiomDetail.usageNote}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Seçili Diyalog Bağlamı & Morfolojik Not */}
                  {contextEntry?.morphologyNote && (
                    <div
                      dir="ltr"
                      className="bg-white dark:bg-[var(--background)] rounded-xl px-2.5 py-1.5 border border-[#E6D7BE] text-[11px] font-bold text-[#4C28B5] text-left"
                    >
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase text-[#6741D9] block mb-0.5">
                        <Sparkles size={10} />
                        <span>Diyalogdaki Morfolojik Yapı:</span>
                      </span>
                      <span dir="ltr" className="block text-left leading-relaxed">
                        {splitMixedBidiText(contextEntry.morphologyNote).map(
                          (seg, sIdx) =>
                            seg.isArabic ? (
                              <bdi
                                key={sIdx}
                                dir="rtl"
                                className="arabic font-arabic text-sm font-bold inline-block mx-0.5"
                              >
                                {getDisplayArabic(seg.text)}
                              </bdi>
                            ) : (
                              <span key={sIdx}>{seg.text}</span>
                            )
                        )}
                      </span>
                    </div>
                  )}

                  {/* Orta Satır: Çekimler / Formlar (Tıklanabilir Sesli) */}
                  {!isIdiomCard && (
                    <div className="py-1.5 border-b border-dashed border-[#E2D3B8] dark:border-[var(--border-dashed)] flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm font-medium">
                      {category === "fiil" || word.mazi || word.muzari ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {word.muzari && (
                            <button
                              type="button"
                              onClick={() =>
                                handleListenWord(word, word.muzari)
                              }
                              className="inline-flex items-center gap-1 bg-white dark:bg-[var(--background)] px-2 py-0.5 rounded-lg border border-[#E6D7BE] dark:border-[var(--border)] hover:border-amber-500 cursor-pointer"
                              title="Muzâri halini dinle"
                            >
                              <span className="text-xs md:text-sm font-medium text-[var(--muted)]">
                                Muzâri:
                              </span>
                              <span
                                dir="rtl"
                                className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]"
                              >
                                {getDisplayArabic(word.muzari)}
                              </span>
                            </button>
                          )}
                          {word.masdar && (
                            <button
                              type="button"
                              onClick={() =>
                                handleListenWord(word, word.masdar)
                              }
                              className="inline-flex items-center gap-1 bg-white dark:bg-[var(--background)] px-2 py-0.5 rounded-lg border border-[#E6D7BE] dark:border-[var(--border)] hover:border-amber-500 cursor-pointer"
                              title="Masdar halini dinle"
                            >
                              <span className="text-xs md:text-sm font-medium text-[var(--muted)]">
                                Masdar:
                              </span>
                              <span
                                dir="rtl"
                                className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]"
                              >
                                {getDisplayArabic(word.masdar)}
                              </span>
                            </button>
                          )}
                          {!word.muzari && !word.masdar && (
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                              Fiil Çekim Formu
                            </span>
                          )}
                        </div>
                      ) : category === "edat" ? (
                        <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
                          Sabit Edat / Konuşma Kalıbı
                        </span>
                      ) : category === "ozel-isim" ? (
                        <span className="text-xs md:text-sm font-medium text-teal-700 dark:text-teal-300">
                          Müfret:{" "}
                          <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                            {getDisplayArabic(mainArabic)}
                          </strong>
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {word.mufret && (
                            <span className="text-xs md:text-sm font-medium text-[var(--muted)]">
                              Müfret:{" "}
                              <strong className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]">
                                {getDisplayArabic(word.mufret)}
                              </strong>
                            </span>
                          )}
                          {word.cemi && word.cemi !== "-" ? (
                            <button
                              type="button"
                              onClick={() => handleListenWord(word, word.cemi)}
                              className="inline-flex items-center gap-1.5 bg-white dark:bg-[var(--background)] px-2.5 py-1 rounded-lg border border-[#E6D7BE] dark:border-[var(--border)] hover:border-sky-500 transition-colors cursor-pointer"
                              data-tooltip="Çoğul halini sesli dinle"
                            >
                              <span className="text-xs md:text-sm font-medium text-[var(--muted)]">
                                Cemî:
                              </span>
                              <span
                                dir="rtl"
                                className="arabic text-base md:text-lg font-arabic font-bold text-[var(--foreground)]"
                              >
                                {getDisplayArabic(word.cemi)}
                              </span>
                              <Volume2 size={12} className="text-sky-600" />
                            </button>
                          ) : (
                            !word.mufret && (
                              <span className="text-[11px] font-medium text-[var(--muted)]">
                                Tekil İsim Formu
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Öğe Bazlı Hafıza Durumu & Deneme Geçmişi Rozeti (SRS) */}
                  {srsBadge && (
                    <div
                      dir="ltr"
                      className="flex flex-wrap items-center justify-between gap-1.5 pt-1"
                    >
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold ${srsBadge.badgeClass}`}
                      >
                        {srsBadge.label}
                      </span>
                      {srsBadge.statsText && (
                        <span className="text-[10px] font-bold text-[var(--muted)] tabular-nums">
                          {srsBadge.statsText}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sözlük Kartı Altında Ortak Kelime / Kur'ân Köprüsü + Açılır/Kapanır Çekmece (O(1) Önbellekli) */}
                  {(() => {
                    const cognateInfo = wordMeta.cognateInfo;
                    const classicalBridge = wordMeta.classicalBridge;
                    const isDrawerOpen = Boolean(expandedCardIds[word.id]);
                    const showClassicalBridgePanel =
                      Boolean(classicalBridge) &&
                      (bridgeFilter === "classical" || isDrawerOpen);
                    const rootSiblings =
                      isDrawerOpen && word.kok && word.kok !== "-"
                        ? getCachedRootSiblings(word.kok, word.id)
                        : [];
                    const exampleSentences = isDrawerOpen
                      ? getCachedExampleSentences(word)
                      : [];

                    return (
                      <div className="pt-1 space-y-2">
                        {cognateInfo && (
                          <div
                            className={`rounded-xl border px-2.5 py-1.5 text-[11px] space-y-1 ${
                              cognateInfo.isFalseFriend
                                ? "bg-amber-50 dark:bg-amber-950/45 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100"
                                : "bg-emerald-50/70 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <span className="font-extrabold">
                                🤝 Türkçeyle Ortak:{" "}
                                <strong className="underline decoration-dotted">
                                  {cognateInfo.turkishCognate}
                                </strong>
                              </span>
                              {cognateInfo.isFalseFriend && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 text-[10px] font-black">
                                  ⚠️ Yalancı Eşdeğer / Anlam Farkı
                                </span>
                              )}
                            </div>
                            {cognateInfo.nuanceNoteTr && (
                              <p className="text-[11px] font-medium leading-snug opacity-95">
                                {cognateInfo.nuanceNoteTr}
                              </p>
                            )}
                          </div>
                        )}

                        {showClassicalBridgePanel && classicalBridge && (
                          <div className="rounded-xl bg-gradient-to-br from-emerald-50 via-[#FDFBF7] to-amber-50/80 dark:from-emerald-950/45 dark:via-[var(--surface)] dark:to-amber-950/30 border-2 border-emerald-300/80 dark:border-emerald-700/70 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2 border-b border-emerald-200/80 dark:border-emerald-800/60 pb-1.5">
                              <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-200">
                                🕌 Fasih ↔ Kur&apos;ân ve Klasik Metin Köprüsü
                              </span>
                              <span
                                dir="rtl"
                                lang="ar"
                                className="arabic font-arabic text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"
                              >
                                {classicalBridge.rootSpaced}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                              <div className="rounded-lg bg-white/85 dark:bg-[var(--background)] border border-emerald-200/70 dark:border-emerald-800/60 p-2 space-y-0.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                                  Günlük Fasih Kullanım
                                </span>
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="arabic font-arabic text-sm font-bold text-[var(--foreground)] leading-relaxed text-right"
                                >
                                  {getDisplayArabic(classicalBridge.modernUsageAr)}
                                </p>
                                <p className="text-[11px] font-medium text-[var(--muted)]">
                                  {classicalBridge.modernUsageTr}
                                </p>
                              </div>

                              <div className="rounded-lg bg-white/85 dark:bg-[var(--background)] border border-amber-200/80 dark:border-amber-800/60 p-2 space-y-0.5">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                                  Klasik Istılah
                                </span>
                                <p
                                  dir="rtl"
                                  lang="ar"
                                  className="arabic font-arabic text-sm font-bold text-[var(--foreground)] leading-relaxed text-right"
                                >
                                  {getDisplayArabic(classicalBridge.classicalTermAr)}
                                </p>
                                <p className="text-[11px] font-medium text-[var(--muted)]">
                                  {classicalBridge.classicalTermTr}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-700/70 p-2 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                  📖 Kur&apos;ân-ı Kerîm&apos;den Örnek ({classicalBridge.surahRef})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playClick();
                                    void playTTS(
                                      classicalBridge.quranicExampleAr,
                                      mounted ? speechRate : 1
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-white dark:bg-[var(--background)] border border-amber-300 dark:border-amber-700 text-[10px] font-extrabold text-amber-900 dark:text-amber-200 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Volume2 size={11} />
                                  <span>Dinle</span>
                                </button>
                              </div>
                              <p
                                dir="rtl"
                                lang="ar"
                                className="arabic font-arabic text-base font-bold text-[#064E3B] dark:text-emerald-200 leading-[1.95] text-right"
                              >
                                ﴿ {getDisplayArabic(classicalBridge.quranicExampleAr)} ﴾
                              </p>
                              <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100 leading-snug">
                                &ldquo;{classicalBridge.quranicExampleTr}&rdquo;
                              </p>
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            playClick();
                            setExpandedCardIds((prev) => ({
                              ...prev,
                              [word.id]: !prev[word.id],
                            }));
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl border text-[11px] font-extrabold flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                            isDrawerOpen
                              ? "bg-[#F3F0FF] dark:bg-[var(--lavender-bg)] border-[#6741D9] text-[#4C28B5] dark:text-[#d0bfff]"
                              : "bg-white/75 dark:bg-[var(--background)]/75 border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[#6741D9]/60"
                          }`}
                        >
                          <span>
                            {classicalBridge && bridgeFilter !== "classical"
                              ? "🕌 Kur'ân Köprüsü, Kök & Örnekler"
                              : "📖 Örnek Cümleler & Kök Ailesi"}
                          </span>
                          {isDrawerOpen ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )}
                        </button>

                        {isDrawerOpen && (
                          <div className="mt-2 p-2.5 rounded-xl bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] space-y-2.5 text-left animate-in fade-in duration-150">
                            {/* 1. Aynı Kökten Türeyen Kelimeler (Kök Ailesi / İştikak) */}
                            {word.kok && word.kok !== "-" && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#065F46] dark:text-emerald-300">
                                    🌿 Aynı Kökten Türeyenler ({word.kok})
                                  </span>
                                  {rootSiblings.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playClick();
                                        setRootFilter(word.kok || null);
                                        setCurrentPage(1);
                                      }}
                                      className="text-[10px] font-extrabold text-[#6741D9] dark:text-indigo-300 hover:underline cursor-pointer"
                                    >
                                      Tümünü Filtrele →
                                    </button>
                                  )}
                                </div>

                                {rootSiblings.length === 0 ? (
                                  <p className="text-[11px] font-medium text-[var(--muted)]">
                                    Sözlükte bu kökten kayıtlı başka türev bulunmuyor.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {rootSiblings.map((sib) => {
                                      const sibAr =
                                        (sib.mufret || sib.mazi || "").split(
                                          "/"
                                        )[0];
                                      return (
                                        <button
                                          key={sib.id}
                                          type="button"
                                          onClick={() => handleListenWord(sib)}
                                          title={`${sib.anlam_tr} — Dinlemek için tıkla`}
                                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F7EFE1] dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] text-[11px] transition-all cursor-pointer"
                                        >
                                          <bdi
                                            dir="rtl"
                                            className="arabic font-arabic text-sm font-bold text-[#065F46] dark:text-emerald-300"
                                          >
                                            {getDisplayArabic(sibAr)}
                                          </bdi>
                                          <span className="font-semibold text-[var(--foreground)] max-w-[120px] truncate">
                                            {sib.anlam_tr.split(",")[0]}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 2. Diyaloglardan Gerçek Örnek Cümleler */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-indigo-300 block">
                                📖 Diyaloglardan Örnek Cümleler
                              </span>
                              {exampleSentences.length === 0 ? (
                                <p className="text-[11px] font-medium text-[var(--muted)]">
                                  Bu ifade için doğrudan eşleşen diyalog satırı bulunamadı.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {exampleSentences.map((ex) => {
                                    const exKey = `${ex.dialogueId}_${ex.sira}`;
                                    const isExPlaying =
                                      playingSentenceKey === exKey;
                                    return (
                                      <div
                                        key={exKey}
                                        className="p-2 rounded-lg bg-[#F7EFE1]/70 dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] space-y-1"
                                      >
                                        <div className="flex items-center justify-between gap-1.5">
                                          <Link
                                            href={`/diyalog/${ex.dialogueId}`}
                                            onClick={() => playClick()}
                                            className="text-[10px] font-extrabold text-[#065F46] dark:text-emerald-300 hover:underline truncate"
                                          >
                                            #{ex.rawNum} {ex.dialogueTitle}
                                          </Link>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void handlePlayExampleSentence(ex)
                                            }
                                            title="Örnek cümleyi sesli dinle"
                                            className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                                              isExPlaying
                                                ? "bg-[#087F5B] border-[#087F5B] text-white"
                                                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)] hover:border-[#087F5B]"
                                            }`}
                                          >
                                            <Volume2 size={11} />
                                            <span>Dinle</span>
                                          </button>
                                        </div>
                                        <p
                                          dir="rtl"
                                          className="arabic font-arabic text-base font-bold text-[var(--foreground)] text-right leading-snug"
                                        >
                                          {getDisplayArabic(ex.arapca)}
                                        </p>
                                        <p
                                          dir="ltr"
                                          className="text-[11px] font-medium text-[var(--muted)] leading-snug"
                                        >
                                          {ex.turkce}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Alt Aksiyon Butonları */}
                <div className="pt-3 flex items-center justify-between gap-2">
                  {/* Sesli Dinle Butonu */}
                  <button
                    type="button"
                    onClick={() => handleListenWord(word)}
                    data-tooltip="Kelimeyi doğal Arapça seslendirmeyle dinle"
                    className={`flex-1 h-9 px-3 rounded-xl border-2 border-b-3 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSpeaking
                        ? "bg-[#087F5B] border-[#065F46] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                    }`}
                  >
                    <Volume2
                      size={15}
                      className={isSpeaking ? "text-white" : "text-[#065F46] dark:text-emerald-400"}
                    />
                    <span>Dinle</span>
                  </button>

                  {/* Telaffuz / Gölgeleme Butonu */}
                  <button
                    type="button"
                    onClick={() => handleMicClick(word)}
                    className="h-9 px-3 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 text-xs font-extrabold text-[var(--foreground)] hover:border-[#6741D9] hover:text-[#6741D9] flex items-center justify-center gap-1 transition-all cursor-pointer"
                    data-tooltip="Telaffuz & Mahreç Kontrolü"
                  >
                    <Mic size={14} />
                    <span>{isIdiomCard ? "Telaffuz Et" : "Telaffuz"}</span>
                  </button>

                  {/* Favori Butonu */}
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      toggleFavoriteWord(word);
                    }}
                    data-tooltip={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                    aria-label={isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                    className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isFav
                        ? "bg-red-50 border-red-300 text-red-600"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-red-500"
                    }`}
                  >
                    <Heart size={15} fill={isFav ? "currentColor" : "none"} />
                  </button>

                  {/* Öğrendim Butonu */}
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      toggleLearnedWord(word.id);
                      if (!isLearned && isMistake(word.id)) {
                        removeMistake(word.id);
                      }
                    }}
                    data-tooltip={
                      isLearned
                        ? "Öğrenildi İşaretini Kaldır"
                        : "Öğrendim Olarak İşaretle"
                    }
                    aria-label={
                      isLearned
                        ? "Öğrenildi İşaretini Kaldır"
                        : "Öğrendim Olarak İşaretle"
                    }
                    className={`h-9 w-9 rounded-xl border-2 border-b-3 flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isLearned
                        ? "bg-[#6741D9] border-[#5230B5] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#065F46] dark:text-emerald-400"
                    }`}
                  >
                    <CheckCircle2 size={15} />
                  </button>

                  {/* Görsel Kart Paylaş Butonu */}
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      const matchedVisualImg =
                        (word as unknown as { gorsel?: string }).gorsel ||
                        visualWordImageByAr.get(normalizeArabicText(mainArabic));
                      const morphPartsAr: string[] = [];
                      if (word.kok && word.kok !== "-") {
                        morphPartsAr.push(`Kök: ${word.kok}`);
                      }
                      if (word.mazi || word.muzari) {
                        morphPartsAr.push(
                          `Mâzî / Muzâri: ${[word.mazi, word.muzari]
                            .filter(Boolean)
                            .join(" • ")}`
                        );
                      } else if (word.mufret && word.cemi) {
                        morphPartsAr.push(
                          `Müfret / Cemî: ${word.mufret} • ${word.cemi}`
                        );
                      } else if (word.cemi) {
                        morphPartsAr.push(`Müfret / Cemî: ${word.cemi}`);
                      }
                      if (word.ornek_ar) {
                        morphPartsAr.push(`Örnek: ${word.ornek_ar}`);
                      }

                      setShareCardTarget({
                        type: isIdiomCard ? "sentence" : "visual_word",
                        arabicText: mainArabic,
                        turkishText: word.anlam_tr,
                        subInfoAr:
                          morphPartsAr.length > 0
                            ? morphPartsAr.join("  |  ")
                            : undefined,
                        subInfoTr: word.ornek_tr
                          ? `Örnek: ${word.ornek_tr}`
                          : idiomDetail?.literalTr
                          ? `Harfiyen: ${idiomDetail.literalTr}`
                          : undefined,
                        level: word.cefr,
                        category: isIdiomCard ? "Kalıp İfade" : theme.badgeText,
                        imageUrl: matchedVisualImg,
                        deepLink: `https://app.muallimun.net/sozluk?q=${encodeURIComponent(
                          mainArabic
                        )}`,
                      });
                    }}
                    data-tooltip="Görsel Kart Olarak Paylaş"
                    data-tooltip-align="right"
                    aria-label="Görsel Kart Olarak Paylaş"
                    className="h-9 w-9 rounded-xl border-2 border-b-3 bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#065F46] hover:border-[#087F5B] dark:hover:text-emerald-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
                  >
                    <Share2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>

          <SmartPaginationBar
            compactTop={false}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            tokens={pagination.tokens}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        </>
      )}

      {shareCardTarget && (
        <ShareContentCardModal
          payload={shareCardTarget}
          onClose={() => setShareCardTarget(null)}
        />
      )}

      {showPhonemeHeatmap && (
        <PhonemeHeatmapModal
          isOpen={showPhonemeHeatmap}
          onClose={() => setShowPhonemeHeatmap(false)}
        />
      )}
    </div>
  );
}