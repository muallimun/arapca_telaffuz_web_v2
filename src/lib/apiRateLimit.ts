/**
 * Ortak Sunucu Tarafı Dakika Bazlı IP İstek Sınırlandırma (Rate-Limit) Yardımcıları
 * `/api/stt`, `/api/admin` ve diğer hassas API uçlarında ortak kullanılır.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface IpRateLimiterOptions {
  maxRequestsPerMinute: number;
  windowMs?: number;
  maxTrackedIps?: number;
}

export interface IpRateLimiter {
  isRateLimited: (ip: string, now?: number) => boolean;
  resetAll: () => void;
}

export const MAX_CLIENT_IP_LENGTH = 128;

const SAFE_IP_CANDIDATE_REGEX = /^[0-9a-fA-F:.%[\]-]{2,128}$/;

function extractFirstValidIp(rawHeader: string | null): string | null {
  if (!rawHeader) return null;
  const parts = rawHeader.split(",");
  for (const part of parts) {
    const candidate = part.trim();
    if (!candidate || candidate.length > MAX_CLIENT_IP_LENGTH) continue;
    if (candidate === "localhost") return candidate;
    if (
      SAFE_IP_CANDIDATE_REGEX.test(candidate) &&
      (candidate.includes(".") || candidate.includes(":"))
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * İstemci IP adresini Vercel ve standart reverse-proxy başlıklarından güvenli öncelik sırasıyla
 * (`x-vercel-forwarded-for`, `x-real-ip`, `cf-connecting-ip`, `x-forwarded-for` ilk geçerli IP
 * ve maksimum 128 karakter uzunluk sınırı ile) çıkarır.
 */
export function getClientIp(req: Request): string {
  const orderedHeaders = [
    "x-vercel-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-forwarded-for",
  ] as const;

  for (const headerName of orderedHeaders) {
    const validIp = extractFirstValidIp(req.headers.get(headerName));
    if (validIp) {
      return validIp;
    }
  }

  return "local";
}

/**
 * Bellek sızıntısına karşı otomatik temizlemeli, dakika/pencere bazlı IP rate-limiter üretir.
 */
export function createIpRateLimiter({
  maxRequestsPerMinute,
  windowMs = 60_000,
  maxTrackedIps = 5_000,
}: IpRateLimiterOptions): IpRateLimiter {
  const buckets = new Map<string, RateLimitBucket>();

  function pruneExpired(now: number): void {
    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    isRateLimited(ip: string, now = Date.now()): boolean {
      const normalizedIp =
        (ip || "local").trim().slice(0, MAX_CLIENT_IP_LENGTH) || "local";
      const existing = buckets.get(normalizedIp);

      if (!existing || existing.resetAt <= now) {
        if (buckets.size >= maxTrackedIps) {
          pruneExpired(now);
          if (buckets.size >= maxTrackedIps) {
            const oldestKey = buckets.keys().next().value;
            if (oldestKey !== undefined) {
              buckets.delete(oldestKey);
            }
          }
        }
        buckets.set(normalizedIp, { count: 1, resetAt: now + windowMs });
        return false;
      }

      if (existing.count >= maxRequestsPerMinute) {
        return true;
      }

      existing.count += 1;
      return false;
    },
    resetAll(): void {
      buckets.clear();
    },
  };
}
