"use client";

import React, { useState, useEffect, useId } from "react";
import Link from "next/link";
import {
  Play,
  ExternalLink,
  CheckCircle2,
  Circle,
  Volume2,
  Maximize2,
  X,
  BookOpen,
  ListVideo,
  Film,
  Sparkles,
  Link2,
} from "lucide-react";
import { YoutubeRecommendationItem } from "@/types/data";
import {
  YOUTUBE_CATEGORY_META,
  buildYoutubeEmbedUrl,
  getContentLinkHref,
  resolveYoutubeIds,
} from "@/lib/youtubeUtils";
import { formatArabicByHarekeMode } from "@/lib/arabicTextUtils";
import { speakHybrid, stopAllAudio } from "@/lib/audio";
import { playClick, playSuccess } from "@/lib/sfxManager";
import { useSettings } from "@/store/settings";
import { useUserStore } from "@/store/userStore";

interface LiteYoutubeCardProps {
  item: YoutubeRecommendationItem;
  onOpenCinemaModal?: (item: YoutubeRecommendationItem) => void;
  compact?: boolean;
}

const CEFR_BADGE_STYLE: Record<string, string> = {
  A1: "bg-emerald-600 text-white border-emerald-800",
  A2: "bg-teal-600 text-white border-teal-800",
  B1: "bg-[#6741D9] text-white border-[#4C28B5]",
  B2: "bg-amber-600 text-white border-amber-800",
};

// Sayfa genelinde aynı anda yalnızca TEK BİR gömülü YouTube <iframe> oynatıcısının açık kalmasını sağlar
let activeInlineYoutubeInstanceId: string | null = null;
const inlineYoutubeSubscribers = new Set<(activeId: string | null) => void>();

function notifyActiveInlineYoutube(nextId: string | null) {
  activeInlineYoutubeInstanceId = nextId;
  inlineYoutubeSubscribers.forEach((listener) => listener(nextId));
}

export default function LiteYoutubeCard({
  item,
  onOpenCinemaModal,
  compact = false,
}: LiteYoutubeCardProps) {
  const instanceId = useId();
  const { showHareke, harekeMode, speechRate } = useSettings();
  const { watchedVideos, toggleWatchedVideo } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const handleActiveChange = (activeId: string | null) => {
      if (activeId !== instanceId) {
        setIsPlaying(false);
      }
    };
    inlineYoutubeSubscribers.add(handleActiveChange);
    return () => {
      inlineYoutubeSubscribers.delete(handleActiveChange);
      if (activeInlineYoutubeInstanceId === instanceId) {
        activeInlineYoutubeInstanceId = null;
      }
    };
  }, [instanceId]);

  const { videoId, playlistId } = resolveYoutubeIds(item);
  const thumbnailUrl =
    videoId && !imageError
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : null;

  const embedUrl = buildYoutubeEmbedUrl(item, { autoplay: true });
  const meta =
    YOUTUBE_CATEGORY_META[item.kategori] ||
    YOUTUBE_CATEGORY_META.cizgi_animasyon;
  const contentLink = getContentLinkHref(item.bagli_icerik_id);

  const isWatched = mounted && (watchedVideos || []).includes(item.id);
  const effectiveHarekeMode = !showHareke
    ? "none"
    : harekeMode === "irab-only"
    ? "irab-only"
    : "full";
  const displayArabicTitle = formatArabicByHarekeMode(
    item.baslik_ar,
    effectiveHarekeMode
  );

  const handleStartInlinePlay = () => {
    playClick();
    stopAllAudio();
    if (!embedUrl) return;
    notifyActiveInlineYoutube(instanceId);
    setIsPlaying(true);
  };

  const handleStopInlinePlay = () => {
    playClick();
    if (activeInlineYoutubeInstanceId === instanceId) {
      notifyActiveInlineYoutube(null);
    }
    setIsPlaying(false);
  };

  const handleOpenCinema = () => {
    playClick();
    stopAllAudio();
    notifyActiveInlineYoutube(null);
    setIsPlaying(false);
    onOpenCinemaModal?.(item);
  };

  const handleToggleWatched = () => {
    playClick();
    if (!isWatched) {
      playSuccess();
    }
    toggleWatchedVideo(item.id);
  };

  const handleSpeakWord = async (word: string) => {
    playClick();
    stopAllAudio();
    setSpeakingWord(word);
    try {
      await speakHybrid({ text: word, rate: speechRate });
    } finally {
      setSpeakingWord((prev) => (prev === word ? null : prev));
    }
  };

  return (
    <article
      className={`rounded-2xl border-2 border-b-4 transition-all flex flex-col justify-between overflow-hidden shadow-xs min-w-0 ${
        isWatched
          ? "border-emerald-400/90 dark:border-emerald-700 bg-[#F4FBF7] dark:bg-emerald-950/20"
          : "border-[#E6D7BE] dark:border-[var(--border)] bg-[#FDFBF7] dark:bg-[var(--surface)] hover:border-[#087F5B]"
      }`}
    >
      <div>
        {/* ÜST GÖRSEL KAPAK (isPlaying === false iken KESİNLİKLE iframe render edilmez) VEYA GÖMÜLÜ OYNATICI */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-[#E6D7BE] dark:border-[var(--border)]">
          {isPlaying && embedUrl ? (
            <div className="relative w-full h-full bg-black">
              <iframe
                src={embedUrl}
                title={item.baslik_tr}
                className="w-full h-full aspect-video border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                {onOpenCinemaModal && (
                  <button
                    type="button"
                    onClick={handleOpenCinema}
                    title="Geniş Sinema Modunda Aç"
                    className="px-2.5 py-1 rounded-lg bg-black/80 hover:bg-black text-white text-[11px] font-extrabold border border-white/20 flex items-center gap-1 cursor-pointer shadow-md"
                  >
                    <Maximize2 size={12} />
                    <span>Sinema Modu</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStopInlinePlay}
                  title="Oynatıcıyı Kapat"
                  className="px-2 py-1 rounded-lg bg-black/80 hover:bg-rose-700 text-white text-[11px] font-extrabold border border-white/20 flex items-center gap-1 cursor-pointer shadow-md"
                  aria-label="Oynatıcıyı Kapat"
                >
                  <X size={13} />
                  <span>Kapat</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartInlinePlay}
              className="group relative w-full h-full text-left cursor-pointer focus:outline-none block"
              aria-label={`${item.baslik_tr} — Uygulama içinde oynat`}
            >
              {thumbnailUrl ? (
                <>
                  <img
                    src={thumbnailUrl}
                    alt={item.baslik_tr}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    onError={() => setImageError(true)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/45" />
                  {/* Görsel Kapak Varken Merkez Oynat İkonu */}
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-600/95 group-hover:bg-rose-500 text-white border-2 border-white/85 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={22} className="fill-white ml-0.5" />
                    </span>
                  </div>
                </>
              ) : (
                /* video_id yoksa veya kapak resmi yüklenemezse (imageError) zümrüt/yeşil CSS gradyan kapak + Play ikonu + Arapça başlık */
                <div className="w-full h-full bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-emerald-50 px-3.5 sm:px-4 pt-9 pb-8 flex flex-col items-center justify-center gap-2 text-center relative overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-4 -bottom-4 text-7xl opacity-[0.07] select-none"
                  >
                    {meta.emoji}
                  </div>

                  <span className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-rose-600/95 group-hover:bg-rose-500 text-white border-2 border-white/85 shadow-lg flex items-center justify-center shrink-0 z-10 group-hover:scale-110 transition-transform">
                    <Play size={20} className="fill-white ml-0.5" />
                  </span>

                  <p
                    lang="ar"
                    dir="rtl"
                    className="arabic text-base sm:text-xl font-bold leading-[1.85] py-0.5 drop-shadow-sm line-clamp-2 max-w-[96%] z-10"
                  >
                    {displayArabicTitle}
                  </p>
                </div>
              )}

              {/* Üst Rozetler (CEFR + Tür / Süre Etiketi - Mükerrer Oynatma Listesi rozeti engellenir) */}
              {(() => {
                const isPlaylistItem =
                  item.tur === "playlist" || Boolean(!videoId && playlistId);
                const rawDuration = item.sure_etiketi?.trim() || "";
                const showDurationTag =
                  Boolean(rawDuration) &&
                  !(
                    isPlaylistItem &&
                    rawDuration.toLocaleLowerCase("tr-TR") === "oynatma listesi"
                  );

                return (
                  <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between gap-1.5 z-10 pointer-events-none">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black border shadow-xs shrink-0 ${
                          CEFR_BADGE_STYLE[item.cefr] || CEFR_BADGE_STYLE.A1
                        }`}
                      >
                        {item.cefr}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-black/70 text-white text-[11px] font-bold border border-white/15 inline-flex items-center gap-1 backdrop-blur-2xs truncate">
                        {isPlaylistItem ? (
                          <>
                            <ListVideo
                              size={12}
                              className="text-amber-300 shrink-0"
                            />
                            <span className="truncate">Oynatma Listesi</span>
                          </>
                        ) : (
                          <>
                            <Film
                              size={12}
                              className="text-emerald-300 shrink-0"
                            />
                            <span>Video</span>
                          </>
                        )}
                      </span>
                    </div>

                    {showDurationTag && (
                      <span className="px-2 py-0.5 rounded-lg bg-black/70 text-amber-200 text-[10px] font-extrabold border border-white/15 backdrop-blur-2xs truncate max-w-[130px] shrink-0">
                        {rawDuration}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Alt Kanal & İzlendi Rozeti */}
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between gap-2 z-10 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/70 text-white/95 text-[11px] font-bold border border-white/10 truncate max-w-[68%]">
                  📺 {item.kanal_adi}
                </span>
                {isWatched && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black shadow-xs inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 size={11} />
                    <span>İzlendi</span>
                  </span>
                )}
              </div>
            </button>
          )}
        </div>

        {/* KART İÇERİĞİ */}
        <div className="p-3.5 sm:p-4 space-y-2.5">
          {/* Kategori & Bağlı Ders Rozeti */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-lg border text-[11px] font-extrabold inline-flex items-center gap-1 ${meta.badgeClass}`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.shortLabel}</span>
            </span>

            {contentLink && (
              <Link
                href={contentLink.href}
                onClick={() => playClick()}
                className="px-2 py-0.5 rounded-lg bg-[#F3F0FF] dark:bg-indigo-950/60 border border-[#6741D9]/35 text-[#6741D9] dark:text-indigo-300 text-[11px] font-extrabold inline-flex items-center gap-1 hover:border-[#6741D9] transition-colors"
              >
                <Link2 size={11} />
                <span>{contentLink.label}</span>
              </Link>
            )}
          </div>

          {/* Türkçe ve Arapça Başlıklar */}
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold text-[var(--foreground)] leading-snug">
              {item.baslik_tr}
            </h3>
            <p
              lang="ar"
              dir="rtl"
              className="arabic text-base sm:text-lg font-bold text-[#065F46] dark:text-emerald-400 text-right leading-[1.85] py-0.5"
            >
              {displayArabicTitle}
            </p>
          </div>

          {/* Pedagojik İzleme Notu */}
          {!compact && item.pedagojik_not && (
            <div className="rounded-xl bg-[#F7EFE1]/85 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-2.5 text-xs font-medium text-[var(--muted)] leading-relaxed flex items-start gap-2">
              <Sparkles
                size={14}
                className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              />
              <span>{item.pedagojik_not}</span>
            </div>
          )}

          {compact && item.pedagojik_not && (
            <p className="text-xs font-medium text-[var(--muted)] line-clamp-2 leading-relaxed">
              {item.pedagojik_not}
            </p>
          )}

          {/* Odak Kelimeler (Tıklandığında Seslendirir + Sözlük Bağlantısı) */}
          {!compact &&
            Array.isArray(item.odak_kelimeler) &&
            item.odak_kelimeler.length > 0 && (
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  <span>🎯 Odak Kelimeler (Dinlemek İçin Tıklayın)</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.odak_kelimeler.map((word) => {
                    const formattedWord = formatArabicByHarekeMode(
                      word,
                      effectiveHarekeMode
                    );
                    const isActiveWord = speakingWord === word;
                    return (
                      <div
                        key={word}
                        className="inline-flex items-center rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)] overflow-hidden shadow-2xs"
                      >
                        <button
                          type="button"
                          onClick={() => void handleSpeakWord(word)}
                          className={`px-2.5 py-1 inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            isActiveWord
                              ? "bg-[#087F5B] text-white"
                              : "hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[var(--foreground)]"
                          }`}
                          title={`${word} kelimesini sesli dinle`}
                        >
                          <Volume2
                            size={12}
                            className={
                              isActiveWord ? "text-white" : "text-[#087F5B]"
                            }
                          />
                          <span
                            lang="ar"
                            dir="rtl"
                            className="arabic text-sm sm:text-base font-bold leading-none"
                          >
                            {formattedWord}
                          </span>
                        </button>
                        <Link
                          href={`/sozluk?q=${encodeURIComponent(word)}`}
                          onClick={() => playClick()}
                          title={`${word} kelimesini sözlükte incele`}
                          className="px-1.5 py-1 border-l border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#6741D9] hover:bg-[#F3F0FF] dark:hover:bg-indigo-950/40 transition-colors"
                        >
                          <BookOpen size={11} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* ALT AKSİYON ÇUBUĞU */}
      <div className="px-3.5 pb-3.5 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (isPlaying) {
              handleStopInlinePlay();
            } else {
              handleStartInlinePlay();
            }
          }}
          className="flex-1 min-w-[140px] min-h-[38px] px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-[#065F46] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap"
        >
          {isPlaying ? (
            <>
              <X size={13} className="shrink-0" />
              <span>Oynatıcıyı Kapat</span>
            </>
          ) : (
            <>
              <Play size={13} className="fill-white shrink-0" />
              <span>Uygulama İçinde İzle</span>
            </>
          )}
        </button>

        {onOpenCinemaModal && (
          <button
            type="button"
            onClick={handleOpenCinema}
            title="Sinema Modunda Geniş Ekranda İzle"
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/60 border-2 border-[#6741D9]/40 dark:border-indigo-700 border-b-3 hover:border-[#6741D9] text-[#6741D9] dark:text-indigo-200 text-xs font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-all whitespace-nowrap"
          >
            <Maximize2 size={13} className="shrink-0" />
            <span>Sinema Modu</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleWatched}
          aria-pressed={isWatched}
          className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-all whitespace-nowrap ${
            isWatched
              ? "bg-emerald-600 border-emerald-800 text-white"
              : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
          }`}
          title={
            isWatched ? "İzlenenlerden çıkar" : "Bu içeriği izledim olarak işaretle"
          }
        >
          {isWatched ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          <span>{isWatched ? "İzlendi" : "İzledim"}</span>
        </button>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            playClick();
            stopAllAudio();
          }}
          title="YouTube'da Yeni Sekmede Aç"
          className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-rose-500 text-xs font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1 transition-all whitespace-nowrap"
        >
          <span className="hidden sm:inline">YouTube&apos;da Aç</span>
          <span className="sm:hidden">YT</span>
          <ExternalLink size={13} className="text-rose-600 shrink-0" />
        </a>
      </div>
    </article>
  );
}

/* ============================================================================
 * GENİŞ SİNEMA MODU OYNATICI MODALI (Diyalog, Metin, Gramer, Ana Sayfa & Kütüphane)
 * ============================================================================ */

interface YoutubePlayerModalProps {
  items: YoutubeRecommendationItem[];
  initialIndex?: number;
  onClose: () => void;
}

export function YoutubePlayerModal({
  items,
  initialIndex = 0,
  onClose,
}: YoutubePlayerModalProps) {
  const { showHareke, harekeMode, speechRate } = useSettings();
  const { watchedVideos, toggleWatchedVideo } = useUserStore();

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);

  useEffect(() => {
    stopAllAudio();
    notifyActiveInlineYoutube(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!items || items.length === 0) return null;
  const safeIndex = Math.min(Math.max(0, activeIndex), items.length - 1);
  const activeItem = items[safeIndex];
  const embedUrl = buildYoutubeEmbedUrl(activeItem, { autoplay: true });
  const meta =
    YOUTUBE_CATEGORY_META[activeItem.kategori] ||
    YOUTUBE_CATEGORY_META.cizgi_animasyon;
  const isWatched = (watchedVideos || []).includes(activeItem.id);

  const effectiveHarekeMode = !showHareke
    ? "none"
    : harekeMode === "irab-only"
    ? "irab-only"
    : "full";

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-[95vw] max-w-4xl max-h-[94dvh] flex flex-col rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Üst Bar: Sol Bilgi + Sağda Net "YouTube'da Aç ↗" ve "✕ Kapat" Butonları */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`px-2 py-0.5 rounded-lg text-xs font-black border shrink-0 ${
                CEFR_BADGE_STYLE[activeItem.cefr] || CEFR_BADGE_STYLE.A1
              }`}
            >
              {activeItem.cefr}
            </span>
            <span className="text-xs font-extrabold text-[var(--muted)] truncate">
              {meta.emoji} {meta.shortLabel} • 📺 {activeItem.kanal_adi}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <a
              href={activeItem.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                playClick();
                stopAllAudio();
              }}
              className="min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-b-2 border-rose-800 text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <span>YouTube&apos;da Aç ↗</span>
            </a>

            <button
              type="button"
              onClick={() => {
                playClick();
                onClose();
              }}
              className="min-h-[34px] px-2.5 sm:px-3 py-1 rounded-xl bg-white dark:bg-[var(--surface)] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-400 text-xs font-extrabold text-[var(--foreground)] hover:text-rose-700 dark:hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap transition-colors"
              aria-label="Sinema Modunu Kapat"
            >
              <span>✕ Kapat</span>
            </button>
          </div>
        </div>

        {/* Birden fazla bağlı video varsa sekme seçici */}
        {items.length > 1 && (
          <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[var(--surface)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {items.map((cand, idx) => (
              <button
                key={cand.id}
                type="button"
                onClick={() => {
                  playClick();
                  stopAllAudio();
                  setActiveIndex(idx);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold border whitespace-nowrap cursor-pointer transition-all ${
                  idx === safeIndex
                    ? "bg-[#087F5B] border-[#065F46] text-white"
                    : "bg-[#F7EFE1]/70 dark:bg-[var(--background)] border-[#E6D7BE] text-[var(--foreground)]"
                }`}
              >
                #{idx + 1} {cand.baslik_tr}
              </button>
            ))}
          </div>
        )}

        {/* 16:9 YouTube Gömülü Oynatıcı (Hem mobilde w-[95vw] aspect-video hem masaüstünde max-w-4xl) */}
        <div className="w-full aspect-video bg-black shrink-0">
          {embedUrl ? (
            <iframe
              key={activeItem.id}
              src={embedUrl}
              title={activeItem.baslik_tr}
              className="w-full h-full aspect-video border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 text-center gap-3">
              <p className="text-sm font-bold">
                Bu içerik doğrudan YouTube üzerinden izlenebilir.
              </p>
              <a
                href={activeItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <span>YouTube&apos;da Aç ↗</span>
              </a>
            </div>
          )}
        </div>

        {/* Kaydırılabilir Alt Detaylar & Aksiyonlar */}
        <div className="p-3.5 sm:p-5 space-y-3 overflow-y-auto min-h-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <h3 className="text-sm sm:text-lg font-extrabold text-[var(--foreground)] leading-snug">
                {activeItem.baslik_tr}
              </h3>
              <p
                lang="ar"
                dir="rtl"
                className="arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400"
              >
                {formatArabicByHarekeMode(
                  activeItem.baslik_ar,
                  effectiveHarekeMode
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playClick();
                  if (!isWatched) playSuccess();
                  toggleWatchedVideo(activeItem.id);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer ${
                  isWatched
                    ? "bg-emerald-600 border-emerald-800 text-white"
                    : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)]"
                }`}
              >
                {isWatched ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                <span>
                  {isWatched ? "İzlendi İşaretlendi" : "İzledim İşaretle"}
                </span>
              </button>
            </div>
          </div>

          {activeItem.pedagojik_not && (
            <p className="text-xs sm:text-sm font-medium text-[var(--muted)] bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] rounded-xl p-3 leading-relaxed">
              💡 <strong>Pedagojik Rehber:</strong> {activeItem.pedagojik_not}
            </p>
          )}

          {Array.isArray(activeItem.odak_kelimeler) &&
            activeItem.odak_kelimeler.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-extrabold text-[var(--muted)] mr-1">
                  🎯 Odak Kelimeler:
                </span>
                {activeItem.odak_kelimeler.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={async () => {
                      playClick();
                      stopAllAudio();
                      setSpeakingWord(word);
                      try {
                        await speakHybrid({ text: word, rate: speechRate });
                      } finally {
                        setSpeakingWord((prev) =>
                          prev === word ? null : prev
                        );
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                      speakingWord === word
                        ? "bg-[#087F5B] border-[#065F46] text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                    }`}
                  >
                    <Volume2 size={12} />
                    <span lang="ar" dir="rtl" className="arabic text-base">
                      {formatArabicByHarekeMode(word, effectiveHarekeMode)}
                    </span>
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
