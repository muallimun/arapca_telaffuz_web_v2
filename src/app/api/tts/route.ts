import { NextRequest, NextResponse } from "next/server";
import {
  synthesizeEdgeTtsBuffer,
  synthesizeGoogleTtsBuffer,
} from "@/lib/serverTts";

export const runtime = "nodejs";

// Sunucu tarafı bellek içi ses önbelleği (Aynı cümle tekrar istendiğinde anında döner)
const serverAudioCache = new Map<string, Uint8Array>();
const MAX_CACHE_ITEMS = 300;

// IP bazlı bellek içi hız sınırlaması (Rate Limiting: dakikada maksimum 45 istek)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 45;
const MAX_MAP_SIZE = 2000;

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  // Süresi dolmuş eski IP kayıtlarını temizle (Bellek sızıntısı önlemi)
  if (rateLimitMap.size > 500) {
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(key);
      }
    }
    if (rateLimitMap.size > MAX_MAP_SIZE) {
      const oldestKey = rateLimitMap.keys().next().value;
      if (oldestKey) rateLimitMap.delete(oldestKey);
    }
  }

  const current = rateLimitMap.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

function setServerCache(key: string, bytes: Uint8Array) {
  if (serverAudioCache.size >= MAX_CACHE_ITEMS) {
    const firstKey = serverAudioCache.keys().next().value;
    if (firstKey) serverAudioCache.delete(firstKey);
  }
  serverAudioCache.set(key, bytes);
}

export async function GET(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp =
    (forwardedFor ? forwardedFor.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip") ||
    "anonymous";

  if (!checkIpRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Çok fazla seslendirme isteği gönderildi. Lütfen kısa bir süre bekleyin." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawText = (searchParams.get("text") || "").trim();
  const voiceParam = searchParams.get("voice") || "male";
  const rawSpeed = searchParams.get("rate") || searchParams.get("speed") || "1";
  const clampedRate = Math.min(1.5, Math.max(0.5, Number(rawSpeed) || 1.0));

  if (!rawText) {
    return NextResponse.json(
      { error: "Metin parametresi (text) gerekli." },
      { status: 400 }
    );
  }

  const trimmedText = rawText.slice(0, 600);
  const voiceKey =
    voiceParam === "female" ||
    voiceParam === "K" ||
    voiceParam === "ar-SA-ZariyahNeural"
      ? "ar-SA-ZariyahNeural"
      : "ar-SA-HamedNeural";

  const cacheKey = `${voiceKey}:${clampedRate}:${trimmedText}`;
  const cached = serverAudioCache.get(cacheKey);
  if (cached) {
    return new NextResponse(new Uint8Array(cached), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400, immutable",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-TTS-Provider": "cache",
      },
    });
  }

  // 1. Birincil: Microsoft Edge Neural TTS (HamedNeural / ZariyahNeural)
  let audioBuffer = await synthesizeEdgeTtsBuffer(
    trimmedText,
    voiceKey,
    clampedRate,
    3800
  );
  let provider = "edge-neural";

  // 2. Yedek: Google Translate Doğal Arapça TTS
  if (!audioBuffer) {
    audioBuffer = await synthesizeGoogleTtsBuffer(trimmedText, clampedRate);
    provider = "google-tts";
  }

  if (!audioBuffer) {
    return NextResponse.json(
      { error: "Çevrimiçi TTS servisine ulaşılamadı, istemci yedek sesine geçiliyor." },
      { status: 503 }
    );
  }

  const responseBytes = new Uint8Array(audioBuffer);
  setServerCache(cacheKey, responseBytes);

  return new NextResponse(responseBytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=86400, immutable",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-TTS-Provider": provider,
    },
  });
}
