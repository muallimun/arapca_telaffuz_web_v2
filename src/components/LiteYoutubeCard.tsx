"use client";

import React, { useState, useEffect, useId, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  ExternalLink,
  Check,
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
  Plus,
  SkipBack,
  SkipForward,
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
import { useEscapeKey } from "@/lib/modalStack";
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

// YouTube IFrame API (infoDelivery) tarafından bildirilen gerçek oynatma listesi bölüm sayılarını önbellekte tutar
const cachedPlaylistTotalCounts = new Map<string, number>();

interface UseYoutubeIframePlaylistSyncParams {
  itemId: string;
  isPlaylist: boolean;
  isOpen: boolean;
  activeEpisode: number;
  setPlaylistLastEpisode: (videoId: string, episodeNum: number) => void;
}

function useYoutubeIframePlaylistSync({
  itemId,
  isPlaylist,
  isOpen,
  activeEpisode,
  setPlaylistLastEpisode,
}: UseYoutubeIframePlaylistSyncParams) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytApiReadyRef = useRef(false);
  const activeEpisodeRef = useRef(activeEpisode);

  useEffect(() => {
    activeEpisodeRef.current = activeEpisode;
  }, [activeEpisode]);

  const [reportedTotals, setReportedTotals] = useState<Record<string, number>>(
    () => Object.fromEntries(cachedPlaylistTotalCounts.entries())
  );

  const sessionKey = `${itemId}__${isOpen ? "open" : "closed"}`;
  const [iframeSrcLock, setIframeSrcLock] = useState<{
    sessionKey: string;
    episode: number;
  }>(() => ({
    sessionKey,
    episode: activeEpisode,
  }));

  const effectiveSrcEpisode =
    iframeSrcLock.sessionKey === sessionKey
      ? iframeSrcLock.episode
      : activeEpisode;

  const realTotalCount = isPlaylist
    ? reportedTotals[itemId] ?? cachedPlaylistTotalCounts.get(itemId) ?? null
    : null;

  const sendListeningHandshake = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({
          event: "listening",
          id: itemId,
          channel: "widget",
        }),
        "https://www.youtube.com"
      );
      win.postMessage(
        JSON.stringify({
          event: "command",
          func: "addEventListener",
          args: ["onStateChange"],
          id: itemId,
          channel: "widget",
        }),
        "https://www.youtube.com"
      );
    } catch {
      // Cross-origin frame henüz hazır değilse yoksay
    }
  }, [itemId]);

  useEffect(() => {
    ytApiReadyRef.current = false;
    if (!isOpen || !itemId) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.youtube.com" &&
        event.origin !== "https://www.youtube-nocookie.com"
      ) {
        return;
      }
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) {
        return;
      }

      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!payload || typeof payload !== "object") return;

      const data = payload as {
        event?: string;
        info?: {
          playlist?: unknown[];
          playlistIndex?: number;
        };
      };

      ytApiReadyRef.current = true;

      if (
        data.event === "infoDelivery" ||
        data.event === "initialDelivery" ||
        data.event === "onReady"
      ) {
        const playlistArr = data.info?.playlist;
        if (isPlaylist && Array.isArray(playlistArr) && playlistArr.length > 0) {
          const total = playlistArr.length;
          cachedPlaylistTotalCounts.set(itemId, total);
          setReportedTotals((prev) =>
            prev[itemId] === total ? prev : { ...prev, [itemId]: total }
          );
          if (activeEpisodeRef.current > total) {
            setIframeSrcLock((prev) =>
              prev.sessionKey === sessionKey
                ? prev
                : { sessionKey, episode: total }
            );
            setPlaylistLastEpisode(itemId, total);
          }
        }

        const rawIdx = data.info?.playlistIndex;
        if (
          isPlaylist &&
          typeof rawIdx === "number" &&
          Number.isFinite(rawIdx) &&
          rawIdx >= 0
        ) {
          const nextEp = Math.floor(rawIdx) + 1;
          if (nextEp !== activeEpisodeRef.current) {
            // Iframe src adresinin yeniden yüklenmesini önlemek için mevcut oturum src değerini sabitle
            setIframeSrcLock((prev) =>
              prev.sessionKey === sessionKey
                ? prev
                : { sessionKey, episode: activeEpisodeRef.current }
            );
            activeEpisodeRef.current = nextEp;
            setPlaylistLastEpisode(itemId, nextEp);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

    const t1 = window.setTimeout(() => {
      if (!ytApiReadyRef.current) sendListeningHandshake();
    }, 300);
    const t2 = window.setTimeout(() => {
      if (!ytApiReadyRef.current) sendListeningHandshake();
    }, 900);
    const t3 = window.setTimeout(() => {
      if (!ytApiReadyRef.current) sendListeningHandshake();
    }, 2000);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [
    isOpen,
    itemId,
    isPlaylist,
    sessionKey,
    sendListeningHandshake,
    setPlaylistLastEpisode,
  ]);

  const lockSessionEpisode = useCallback(
    (targetSessionKey: string, episodeNum: number) => {
      setIframeSrcLock({
        sessionKey: targetSessionKey,
        episode: episodeNum,
      });
    },
    []
  );

  const commandSelectEpisode = useCallback(
    (episodeNum: number) => {
      const maxAllowed = realTotalCount ?? 500;
      const clamped = Math.max(1, Math.min(maxAllowed, Math.floor(episodeNum)));
      activeEpisodeRef.current = clamped;
      setPlaylistLastEpisode(itemId, clamped);

      const win = iframeRef.current?.contentWindow;
      if (isOpen && win && ytApiReadyRef.current) {
        try {
          // Mevcut oturum src'sini sabitle ki state güncellemesi iframe'i baştan yüklemesin
          setIframeSrcLock((prev) =>
            prev.sessionKey === sessionKey
              ? prev
              : { sessionKey, episode: effectiveSrcEpisode }
          );
          win.postMessage(
            JSON.stringify({
              event: "command",
              func: "playVideoAt",
              args: [clamped - 1],
            }),
            "https://www.youtube.com"
          );
          return;
        } catch {
          // postMessage başarısız olursa alttaki src fallback devreye girer
        }
      }

      // YouTube JS API henüz el sıkışmadıysa src üzerinden doğrudan ilgili bölüme geç
      setIframeSrcLock({
        sessionKey,
        episode: clamped,
      });
    },
    [
      effectiveSrcEpisode,
      isOpen,
      itemId,
      realTotalCount,
      sessionKey,
      setPlaylistLastEpisode,
    ]
  );

  return {
    iframeRef,
    realTotalCount,
    effectiveSrcEpisode,
    handleIframeLoad: sendListeningHandshake,
    lockSessionEpisode,
    commandSelectEpisode,
  };
}

export default function LiteYoutubeCard({
  item,
  onOpenCinemaModal,
  compact = false,
}: LiteYoutubeCardProps) {
  const instanceId = useId();
  const { showHareke, harekeMode, speechRate } = useSettings();
  const {
    watchedVideos,
    toggleWatchedVideo,
    playlistWatchedEpisodes,
    playlistLastEpisode,
    togglePlaylistEpisodeWatched,
    setPlaylistLastEpisode,
  } = useUserStore();

  const [mounted, setMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [inlineExtraBatches, setInlineExtraBatches] = useState(0);

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
  const isPlaylistItem =
    item.tur === "playlist" || Boolean(!videoId && playlistId);

  const savedLastEpisode =
    mounted && isPlaylistItem ? playlistLastEpisode?.[item.id] || 1 : 1;
  const activeEpisode = isPlaylistItem ? savedLastEpisode : 1;
  const watchedEpisodesForItem =
    mounted && isPlaylistItem ? playlistWatchedEpisodes?.[item.id] || [] : [];
  const watchedEpisodeCount = watchedEpisodesForItem.length;
  const isActiveEpisodeWatched =
    isPlaylistItem && watchedEpisodesForItem.includes(activeEpisode);

  const {
    iframeRef,
    realTotalCount,
    effectiveSrcEpisode,
    handleIframeLoad,
    lockSessionEpisode,
    commandSelectEpisode,
  } = useYoutubeIframePlaylistSync({
    itemId: item.id,
    isPlaylist: isPlaylistItem,
    isOpen: isPlaying,
    activeEpisode,
    setPlaylistLastEpisode,
  });

  const thumbnailUrl =
    videoId && !imageError
      ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      : null;

  const embedUrl = buildYoutubeEmbedUrl(item, {
    autoplay: true,
    playlistIndex: isPlaylistItem ? effectiveSrcEpisode : undefined,
  });

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

  const highestKnownEp = Math.max(
    activeEpisode,
    watchedEpisodesForItem.length > 0 ? Math.max(...watchedEpisodesForItem) : 1
  );
  const fallbackOptionCount = Math.min(
    500,
    (Math.max(1, Math.ceil(highestKnownEp / 20)) + inlineExtraBatches) * 20
  );
  const inlineEpisodeTotal = realTotalCount ?? fallbackOptionCount;

  const handleStartInlinePlay = () => {
    playClick();
    stopAllAudio();
    if (!embedUrl) return;
    lockSessionEpisode(`${item.id}__open`, activeEpisode);
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

  const handleSelectPlaylistEpisode = (episodeNum: number) => {
    playClick();
    stopAllAudio();
    if (!isPlaying && embedUrl) {
      lockSessionEpisode(`${item.id}__open`, episodeNum);
      setPlaylistLastEpisode(item.id, episodeNum);
      notifyActiveInlineYoutube(instanceId);
      setIsPlaying(true);
      return;
    }
    commandSelectEpisode(episodeNum);
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

  const handleToggleActiveEpisodeWatched = () => {
    playClick();
    if (!isActiveEpisodeWatched) {
      playSuccess();
    }
    togglePlaylistEpisodeWatched(item.id, activeEpisode);
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
        {/* ÜST GÖRSEL KAPAK VEYA GÖMÜLÜ OYNATICI (Üstteki Sinema/Kapat butonları video başlığını kapatmaması için alt şeride taşındı) */}
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 border-b border-[#E6D7BE] dark:border-[var(--border)]">
          {isPlaying && embedUrl ? (
            <div className="relative w-full h-full bg-black">
              <iframe
                ref={iframeRef}
                key={item.id}
                src={embedUrl}
                onLoad={handleIframeLoad}
                title={item.baslik_tr}
                className="w-full h-full aspect-video border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
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
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-600/95 group-hover:bg-rose-500 text-white border-2 border-white/85 shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play size={22} className="fill-white ml-0.5" />
                    </span>
                  </div>
                </>
              ) : (
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

              {/* Üst Rozetler */}
              {(() => {
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
                            <span className="truncate">
                              {realTotalCount
                                ? `Oynatma Listesi · ${realTotalCount} Blm`
                                : "Oynatma Listesi"}
                            </span>
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

              {/* Alt Kanal & İzlendi / Bölüm İlerlemesi Rozeti */}
              <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between gap-2 z-10 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md bg-black/70 text-white/95 text-[11px] font-bold border border-white/10 truncate max-w-[65%]">
                  📺 {item.kanal_adi}
                </span>
                {isWatched ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black shadow-xs inline-flex items-center gap-1 shrink-0">
                    <CheckCircle2 size={11} />
                    <span>İzlendi</span>
                  </span>
                ) : isPlaylistItem && watchedEpisodeCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-700/90 text-white text-[10px] font-black shadow-xs inline-flex items-center gap-1 shrink-0">
                    <span>
                      📊 {watchedEpisodeCount}
                      {realTotalCount ? `/${realTotalCount}` : ""} Bölüm
                    </span>
                  </span>
                ) : null}
              </div>
            </button>
          )}
        </div>

        {/* VİDEO OYNATILIRKEN HEMEN ALTINDAKİ İNCE KONTROL VE AÇILIR BÖLÜM SEÇİCİ ŞERİDİ */}
        {isPlaying && Boolean(embedUrl) && (
          <div
            aria-label="Satır İçi Oynatıcı Kontrol Şeridi"
            className="px-2.5 py-2 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0"
          >
            {isPlaylistItem ? (
              <>
                <button
                  type="button"
                  disabled={activeEpisode <= 1}
                  onClick={() => {
                    if (activeEpisode > 1) {
                      handleSelectPlaylistEpisode(activeEpisode - 1);
                    }
                  }}
                  title="Önceki Bölüm"
                  aria-label="Önceki Bölüm"
                  className="w-8 h-8 shrink-0 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--foreground)] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  <SkipBack size={14} />
                </button>

                <select
                  aria-label="Oynatma Listesi Bölüm Seçici"
                  value={String(activeEpisode)}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "__more__") {
                      playClick();
                      setInlineExtraBatches((prev) => prev + 1);
                      return;
                    }
                    const nextEp = parseInt(val, 10);
                    if (Number.isFinite(nextEp) && nextEp >= 1) {
                      handleSelectPlaylistEpisode(nextEp);
                    }
                  }}
                  className="flex-1 min-w-0 h-8 px-2 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#D4C3A3] dark:border-[var(--border)] focus:border-[#087F5B] focus:outline-none text-xs font-extrabold text-[var(--foreground)] cursor-pointer truncate"
                >
                  {Array.from({ length: inlineEpisodeTotal }, (_, idx) => {
                    const ep = idx + 1;
                    const epDone = watchedEpisodesForItem.includes(ep);
                    return (
                      <option key={ep} value={String(ep)}>
                        {epDone ? "✓ " : ""}
                        {ep}. Bölüm
                        {realTotalCount ? ` / ${realTotalCount}` : ""}
                      </option>
                    );
                  })}
                  {!realTotalCount && inlineEpisodeTotal < 500 && (
                    <option value="__more__">+ Sonraki 20 Bölümü Yükle...</option>
                  )}
                </select>

                <button
                  type="button"
                  disabled={
                    realTotalCount
                      ? activeEpisode >= realTotalCount
                      : activeEpisode >= 500
                  }
                  onClick={() => {
                    const limit = realTotalCount ?? 500;
                    if (activeEpisode < limit) {
                      handleSelectPlaylistEpisode(activeEpisode + 1);
                    }
                  }}
                  title="Sonraki Bölüm"
                  aria-label="Sonraki Bölüm"
                  className="w-8 h-8 shrink-0 rounded-lg bg-white dark:bg-[var(--surface)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--foreground)] inline-flex items-center justify-center cursor-pointer transition-colors"
                >
                  <SkipForward size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleToggleActiveEpisodeWatched}
                  aria-pressed={isActiveEpisodeWatched}
                  title={
                    isActiveEpisodeWatched
                      ? `${activeEpisode}. Bölüm İzlendi (Kaldır)`
                      : `${activeEpisode}. Bölümü İzlendi İşaretle`
                  }
                  aria-label={`${activeEpisode}. Bölüm İzlendi Durumu`}
                  className={`h-8 px-2 shrink-0 rounded-lg border text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                    isActiveEpisodeWatched
                      ? "bg-emerald-600 border-emerald-800 text-white"
                      : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
                  }`}
                >
                  <Check size={14} />
                </button>
              </>
            ) : (
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-[var(--muted)] truncate">
                  🎬 Oynatılıyor
                </span>
                <button
                  type="button"
                  onClick={handleToggleWatched}
                  aria-pressed={isWatched}
                  title={isWatched ? "İzlenenlerden çıkar" : "İzledim işaretle"}
                  className={`ml-auto h-8 px-2.5 shrink-0 rounded-lg border text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                    isWatched
                      ? "bg-emerald-600 border-emerald-800 text-white"
                      : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
                  }`}
                >
                  <Check size={13} />
                  <span>{isWatched ? "İzlendi" : "İzledim"}</span>
                </button>
              </div>
            )}

            {onOpenCinemaModal && (
              <button
                type="button"
                onClick={handleOpenCinema}
                title="Sinema Modunda Geniş Ekranda Aç"
                aria-label="Sinema Modu"
                className="h-8 px-2.5 shrink-0 rounded-lg bg-[#6741D9] hover:bg-[#5B35C5] text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Maximize2 size={13} />
                <span className="hidden sm:inline">Sinema</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStopInlinePlay}
              title="Oynatıcıyı Kapat"
              aria-label="Oynatıcıyı Kapat"
              className="w-8 h-8 shrink-0 rounded-lg bg-white dark:bg-[var(--surface)] hover:bg-rose-600 border border-[#E6D7BE] dark:border-[var(--border)] hover:border-rose-700 text-[var(--foreground)] hover:text-white inline-flex items-center justify-center cursor-pointer transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

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

          {/* Odak Kelimeler */}
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

      {/* TEK SATIR DENGELİ ALT AKSİYON ÇUBUĞU (2 satıra taşma kesin olarak engellendi) */}
      <div className="px-3.5 pb-3.5 pt-2 border-t border-dashed border-[#E6D7BE] dark:border-[var(--border)] flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={() => {
            if (isPlaying) {
              handleStopInlinePlay();
            } else {
              handleStartInlinePlay();
            }
          }}
          className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white border-b-3 border-[#065F46] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs"
        >
          {isPlaying ? (
            <>
              <X size={13} className="shrink-0" />
              <span className="truncate">Oynatıcıyı Kapat</span>
            </>
          ) : isPlaylistItem && savedLastEpisode > 1 ? (
            <span className="truncate">
              ▶ {savedLastEpisode}. Bölümden Devam Et
            </span>
          ) : (
            <>
              <Play size={13} className="fill-white shrink-0" />
              <span className="truncate">Uygulama İçinde İzle</span>
            </>
          )}
        </button>

        {onOpenCinemaModal && (
          <button
            type="button"
            onClick={handleOpenCinema}
            title="Sinema Modu"
            aria-label="Sinema Modu"
            className="w-9 h-[38px] shrink-0 rounded-xl bg-[#F3F0FF] dark:bg-indigo-950/60 border-2 border-[#6741D9]/40 dark:border-indigo-700 border-b-3 hover:border-[#6741D9] text-[#6741D9] dark:text-indigo-200 inline-flex items-center justify-center cursor-pointer transition-all"
          >
            <Maximize2 size={14} className="shrink-0" />
          </button>
        )}

        {isPlaylistItem ? (
          <button
            type="button"
            onClick={() => {
              if (!isPlaying && isWatched && watchedEpisodeCount === 0) {
                handleToggleWatched();
              } else {
                handleToggleActiveEpisodeWatched();
              }
            }}
            aria-pressed={isActiveEpisodeWatched || isWatched}
            title={
              watchedEpisodeCount > 0
                ? `${watchedEpisodeCount}${
                    realTotalCount ? `/${realTotalCount}` : ""
                  } Bölüm İzlendi (${activeEpisode}. bölümü işaretle/kaldır)`
                : `${activeEpisode}. Bölümü İzledim İşaretle`
            }
            className={`h-[38px] px-2.5 shrink-0 rounded-xl border-2 border-b-3 text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-all whitespace-nowrap ${
              isActiveEpisodeWatched || isWatched
                ? "bg-emerald-600 border-emerald-800 text-white"
                : watchedEpisodeCount > 0
                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
            }`}
          >
            <Check size={13} className="shrink-0" />
            <span>
              {watchedEpisodeCount > 0
                ? `${watchedEpisodeCount}${
                    realTotalCount ? `/${realTotalCount}` : ""
                  } Blm`
                : isWatched
                ? "İzlendi"
                : "İzledim"}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleWatched}
            aria-pressed={isWatched}
            title={
              isWatched
                ? "İzlenenlerden çıkar"
                : "Bu içeriği izledim olarak işaretle"
            }
            className={`h-[38px] px-2.5 shrink-0 rounded-xl border-2 border-b-3 text-[11px] font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-all whitespace-nowrap ${
              isWatched
                ? "bg-emerald-600 border-emerald-800 text-white"
                : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
            }`}
          >
            {isWatched ? (
              <CheckCircle2 size={13} className="shrink-0" />
            ) : (
              <Circle size={13} className="shrink-0" />
            )}
            <span>{isWatched ? "İzlendi" : "İzledim"}</span>
          </button>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            playClick();
            stopAllAudio();
          }}
          title="YouTube'da Aç"
          aria-label="YouTube'da Aç"
          className="w-9 h-[38px] shrink-0 rounded-xl bg-white dark:bg-[var(--background)] border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-3 hover:border-rose-500 text-[var(--foreground)] inline-flex items-center justify-center transition-all"
        >
          <ExternalLink size={14} className="text-rose-600 shrink-0" />
        </a>
      </div>
    </article>
  );
}

/* ============================================================================
 * GENİŞ SİNEMA MODU OYNATICI MODALI — SPLIT-CINEMA (Masaüstü 2 Sütun + Dikey Bölüm Listesi)
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
  const {
    watchedVideos,
    toggleWatchedVideo,
    playlistWatchedEpisodes,
    playlistLastEpisode,
    togglePlaylistEpisodeWatched,
    setPlaylistLastEpisode,
  } = useUserStore();

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [extraBatchesByItem, setExtraBatchesByItem] = useState<
    Record<string, number>
  >({});
  const episodeListRef = useRef<HTMLDivElement | null>(null);

  const hasItems = Boolean(items && items.length > 0);
  const safeIndex = hasItems
    ? Math.min(Math.max(0, activeIndex), items.length - 1)
    : 0;
  const activeItem = hasItems ? items[safeIndex] : null;

  const resolvedIds = activeItem
    ? resolveYoutubeIds(activeItem)
    : { videoId: undefined, playlistId: undefined };
  const activeIsPlaylist = activeItem
    ? activeItem.tur === "playlist" ||
      Boolean(!resolvedIds.videoId && resolvedIds.playlistId)
    : false;

  const activeItemId = activeItem?.id ?? "";
  const activeEpisode =
    activeItem && activeIsPlaylist
      ? playlistLastEpisode?.[activeItem.id] || 1
      : 1;
  const activeWatchedEpisodes =
    activeItem && activeIsPlaylist
      ? playlistWatchedEpisodes?.[activeItem.id] || []
      : [];
  const activeWatchedEpCount = activeWatchedEpisodes.length;
  const isActiveEpisodeWatched =
    activeIsPlaylist && activeWatchedEpisodes.includes(activeEpisode);

  useEscapeKey(onClose, hasItems);

  useEffect(() => {
    stopAllAudio();
    notifyActiveInlineYoutube(null);
  }, []);

  const {
    iframeRef,
    realTotalCount,
    effectiveSrcEpisode,
    handleIframeLoad,
    lockSessionEpisode,
    commandSelectEpisode,
  } = useYoutubeIframePlaylistSync({
    itemId: activeItemId,
    isPlaylist: activeIsPlaylist,
    isOpen: hasItems,
    activeEpisode,
    setPlaylistLastEpisode,
  });

  // Aktif bölüm değiştiğinde dikey listedeki satırı görünür alanda tut
  useEffect(() => {
    if (!activeIsPlaylist) return;
    const listEl = episodeListRef.current;
    if (!listEl) return;
    const rowEl = listEl.querySelector<HTMLElement>(
      `[data-cinema-episode="${activeEpisode}"]`
    );
    if (rowEl && typeof rowEl.scrollIntoView === "function") {
      rowEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeEpisode, activeIsPlaylist, activeItemId]);

  if (!activeItem) return null;

  const embedUrl = buildYoutubeEmbedUrl(activeItem, {
    autoplay: true,
    playlistIndex: activeIsPlaylist ? effectiveSrcEpisode : undefined,
  });
  const meta =
    YOUTUBE_CATEGORY_META[activeItem.kategori] ||
    YOUTUBE_CATEGORY_META.cizgi_animasyon;
  const isWatched = (watchedVideos || []).includes(activeItem.id);

  const effectiveHarekeMode = !showHareke
    ? "none"
    : harekeMode === "irab-only"
    ? "irab-only"
    : "full";

  const extraBatches = extraBatchesByItem[activeItem.id] || 0;
  const highestKnownEpisode = Math.max(
    activeEpisode,
    activeWatchedEpisodes.length > 0 ? Math.max(...activeWatchedEpisodes) : 1
  );
  const fallbackVisibleCount = Math.min(
    500,
    (Math.max(1, Math.ceil(highestKnownEpisode / 20)) + extraBatches) * 20
  );
  const visibleEpisodeCount = realTotalCount ?? fallbackVisibleCount;

  const handleModalSelectEpisode = (episodeNum: number) => {
    playClick();
    stopAllAudio();
    commandSelectEpisode(episodeNum);
  };

  const handleModalToggleSeriesCompleted = () => {
    playClick();
    if (!isWatched) {
      playSuccess();
    }
    toggleWatchedVideo(activeItem.id);
  };

  return (
    <div
      className="fixed inset-0 z-[85] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-[95vw] max-w-5xl max-h-[94dvh] flex flex-col rounded-2xl sm:rounded-3xl border-2 border-[#E6D7BE] dark:border-[var(--border)] border-b-4 bg-[#FDFBF7] dark:bg-[var(--surface)] shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Üst Bar */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#F7EFE1] dark:bg-[var(--background)] border-b border-[#E6D7BE] dark:border-[var(--border)] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`px-2 py-0.5 rounded-lg text-xs font-black border shrink-0 ${
                CEFR_BADGE_STYLE[activeItem.cefr] || CEFR_BADGE_STYLE.A1
              }`}
            >
              {activeItem.cefr}
            </span>
            {activeIsPlaylist && (
              <span className="px-2 py-0.5 rounded-lg bg-[#087F5B]/15 dark:bg-emerald-950/60 border border-[#087F5B]/35 text-[#065F46] dark:text-emerald-300 text-xs font-extrabold shrink-0">
                🎬 {activeEpisode}
                {realTotalCount ? `/${realTotalCount}` : ""}. Bölüm
              </span>
            )}
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
                  const nextSavedEp = playlistLastEpisode?.[cand.id] || 1;
                  lockSessionEpisode(`${cand.id}__open`, nextSavedEp);
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

        {/* SPLIT-CINEMA GÖVDESİ: Oynatma listesinde masaüstünde Sol Video+Detay / Sağ Dikey Bölüm Listesi */}
        <div
          className={
            activeIsPlaylist
              ? "flex flex-col lg:grid lg:grid-cols-[1fr_280px] flex-1 min-h-0 overflow-hidden"
              : "flex flex-col flex-1 min-h-0 overflow-y-auto"
          }
        >
          {/* SOL SÜTUN: 16:9 Oynatıcı + Tam Okunur Başlık, Pedagojik Not ve Odak Kelimeler */}
          <div className="flex flex-col min-h-0 overflow-y-auto">
            <div className="w-full aspect-video max-h-[58dvh] bg-black shrink-0">
              {embedUrl ? (
                <iframe
                  ref={iframeRef}
                  key={activeItem.id}
                  src={embedUrl}
                  onLoad={handleIframeLoad}
                  title={activeItem.baslik_tr}
                  className="w-full h-full border-0"
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

            {/* Video Altı Geniş ve Kesintisiz Detay Alanı */}
            <div className="p-3.5 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--foreground)] leading-snug">
                    {activeItem.baslik_tr}
                  </h3>
                  <p
                    lang="ar"
                    dir="rtl"
                    className="arabic text-lg sm:text-xl font-bold text-[#065F46] dark:text-emerald-400 leading-[1.85]"
                  >
                    {formatArabicByHarekeMode(
                      activeItem.baslik_ar,
                      effectiveHarekeMode
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeIsPlaylist ? (
                    <button
                      type="button"
                      onClick={() => {
                        playClick();
                        if (!isActiveEpisodeWatched) playSuccess();
                        togglePlaylistEpisodeWatched(
                          activeItem.id,
                          activeEpisode
                        );
                      }}
                      aria-pressed={isActiveEpisodeWatched}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border-2 border-b-3 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isActiveEpisodeWatched
                          ? "bg-emerald-600 border-emerald-800 text-white"
                          : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
                      }`}
                    >
                      <Check size={15} />
                      <span>
                        {isActiveEpisodeWatched
                          ? `${activeEpisode}. Bölüm İzlendi`
                          : `${activeEpisode}. Bölümü İzledim`}
                      </span>
                    </button>
                  ) : (
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
                      {isWatched ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Circle size={15} />
                      )}
                      <span>
                        {isWatched ? "İzlendi İşaretlendi" : "İzledim İşaretle"}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {activeItem.pedagojik_not && (
                <p className="text-xs sm:text-sm font-medium text-[var(--muted)] bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] rounded-xl p-3 leading-relaxed">
                  💡 <strong>Pedagojik Rehber:</strong>{" "}
                  {activeItem.pedagojik_not}
                </p>
              )}

              {Array.isArray(activeItem.odak_kelimeler) &&
                activeItem.odak_kelimeler.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-extrabold text-[var(--muted)] mr-1">
                      🎯 Odak Kelimeler:
                    </span>
                    {activeItem.odak_kelimeler.map((word) => (
                      <div
                        key={word}
                        className="inline-flex items-center rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] bg-white dark:bg-[var(--background)] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={async () => {
                            playClick();
                            stopAllAudio();
                            setSpeakingWord(word);
                            try {
                              await speakHybrid({
                                text: word,
                                rate: speechRate,
                              });
                            } finally {
                              setSpeakingWord((prev) =>
                                prev === word ? null : prev
                              );
                            }
                          }}
                          className={`px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                            speakingWord === word
                              ? "bg-[#087F5B] text-white"
                              : "text-[var(--foreground)] hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          }`}
                        >
                          <Volume2 size={12} />
                          <span
                            lang="ar"
                            dir="rtl"
                            className="arabic text-base"
                          >
                            {formatArabicByHarekeMode(
                              word,
                              effectiveHarekeMode
                            )}
                          </span>
                        </button>
                        <Link
                          href={`/sozluk?q=${encodeURIComponent(word)}`}
                          onClick={() => playClick()}
                          title={`${word} kelimesini sözlükte incele`}
                          className="px-1.5 py-1 border-l border-[#E6D7BE] dark:border-[var(--border)] text-[var(--muted)] hover:text-[#6741D9] transition-colors"
                        >
                          <BookOpen size={11} />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* SAĞ SÜTUN: Fare Tekerleğiyle Kaydırılabilir Dikey Bölüm Listesi */}
          {activeIsPlaylist && (
            <aside
              aria-label="Oynatma Listesi Bölümleri"
              className="flex flex-col border-t lg:border-t-0 lg:border-l border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1]/60 dark:bg-[var(--background)] min-h-0 shrink-0 lg:shrink"
            >
              {/* Sabit Bölüm Üst Başlığı */}
              <div className="p-2.5 border-b border-[#E6D7BE] dark:border-[var(--border)] bg-[#F7EFE1] dark:bg-[var(--surface)] space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-black text-[var(--foreground)] truncate">
                    📑 Bölümler ({activeWatchedEpCount}/
                    {realTotalCount ?? visibleEpisodeCount})
                  </span>

                  <button
                    type="button"
                    onClick={handleModalToggleSeriesCompleted}
                    aria-pressed={isWatched}
                    title="Tüm seriyi tamamlandı olarak işaretle"
                    className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
                      isWatched
                        ? "bg-emerald-600 border-emerald-800 text-white"
                        : "bg-white dark:bg-[var(--background)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-emerald-500"
                    }`}
                  >
                    <Check size={11} />
                    <span>Tüm Seri</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeEpisode <= 1}
                    onClick={() => {
                      if (activeEpisode > 1) {
                        handleModalSelectEpisode(activeEpisode - 1);
                      }
                    }}
                    title="Önceki Bölüm"
                    aria-label="Önceki Bölüm"
                    className="flex-1 h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <SkipBack size={12} />
                    <span>Önceki</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      realTotalCount
                        ? activeEpisode >= realTotalCount
                        : activeEpisode >= 500
                    }
                    onClick={() => {
                      const limit = realTotalCount ?? 500;
                      if (activeEpisode < limit) {
                        handleModalSelectEpisode(activeEpisode + 1);
                      }
                    }}
                    title="Sonraki Bölüm"
                    aria-label="Sonraki Bölüm"
                    className="flex-1 h-7 px-2 rounded-lg bg-white dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] hover:border-[#087F5B] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-extrabold text-[var(--foreground)] inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>Sonraki</span>
                    <SkipForward size={12} />
                  </button>
                </div>
              </div>

              {/* Dikey Bölüm Satırları (Fare Tekerleği ve Dokunmatik Kaydırma) */}
              <div
                ref={episodeListRef}
                className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[220px] lg:max-h-none"
              >
                {Array.from({ length: visibleEpisodeCount }, (_, idx) => {
                  const ep = idx + 1;
                  const isCurrent = ep === activeEpisode;
                  const isEpWatched = activeWatchedEpisodes.includes(ep);
                  return (
                    <div
                      key={ep}
                      data-cinema-episode={ep}
                      className={`flex items-center gap-1 rounded-xl border p-1 transition-colors ${
                        isCurrent
                          ? "bg-[#087F5B] border-[#065F46] text-white shadow-xs"
                          : isEpWatched
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400/80 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100"
                          : "bg-white dark:bg-[var(--surface)] border-[#E6D7BE] dark:border-[var(--border)] text-[var(--foreground)] hover:border-[#087F5B]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleModalSelectEpisode(ep)}
                        aria-current={isCurrent ? "true" : undefined}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg text-left text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Play
                          size={12}
                          className={
                            isCurrent
                              ? "fill-white text-white shrink-0"
                              : "text-[#087F5B] dark:text-emerald-400 shrink-0"
                          }
                        />
                        <span className="truncate">{ep}. Bölüm</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playClick();
                          if (!isEpWatched) playSuccess();
                          togglePlaylistEpisodeWatched(activeItem.id, ep);
                        }}
                        aria-pressed={isEpWatched}
                        title={
                          isEpWatched
                            ? `${ep}. Bölüm İzlendi (Kaldır)`
                            : `${ep}. Bölümü İzlendi İşaretle`
                        }
                        aria-label={`${ep}. Bölüm İzlendi İşaretle`}
                        className={`w-7 h-7 shrink-0 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                          isEpWatched
                            ? isCurrent
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-600 text-white"
                            : isCurrent
                            ? "bg-white/15 hover:bg-white/30 text-white/80"
                            : "bg-[#F7EFE1]/80 dark:bg-[var(--background)] hover:bg-emerald-100 dark:hover:bg-emerald-950 text-[var(--muted)] hover:text-emerald-700"
                        }`}
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  );
                })}

                {!realTotalCount && visibleEpisodeCount < 500 && (
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      setExtraBatchesByItem((prev) => ({
                        ...prev,
                        [activeItem.id]: (prev[activeItem.id] || 0) + 1,
                      }));
                    }}
                    className="w-full min-h-[34px] px-2.5 py-1.5 rounded-xl border border-dashed border-[#087F5B]/65 bg-white/90 dark:bg-[var(--surface)] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-[#087F5B] dark:text-emerald-300 text-xs font-extrabold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={13} className="shrink-0" />
                    <span>Daha Fazla Bölüm Yükle</span>
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
