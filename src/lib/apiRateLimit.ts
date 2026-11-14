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

/**
 * İstemci IP adresini proxy başlıklarından (`x-forwarded-for`, `x-real-ip`) güvenli biçimde çıkarır.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const firstIp = xff.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
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
      const normalizedIp = (ip || "local").trim() || "local";
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
