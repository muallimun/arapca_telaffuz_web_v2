import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  synthesizeEdgeTtsBuffer,
  synthesizeGoogleTtsBuffer,
} from "@/lib/serverTts";

export const runtime = "nodejs";

export type AdminDatasetKey =
  | "gorsel_kelimeler"
  | "cumleler_1111"
  | "atasozleri_508"
  | "diyaloglar_120"
  | "metinler_60"
  | "sozluk"
  | "diyalog_gramer"
  | "metin_gramer"
  | "ek_gramer"
  | "seviye_sorulari"
  | "youtube_tavsiyeleri";

export type AdminPostAction =
  | "verify_access"
  | "save_json"
  | "upload_media"
  | "generate_and_save_tts";

const DATASET_FILE_MAP: Record<AdminDatasetKey, string> = {
  gorsel_kelimeler: "gorselKelimeler_guncel.json",
  cumleler_1111: "1111_cumle.json",
  atasozleri_508: "atasozleri.json",
  diyaloglar_120: "tum_diyaloglar_120.json",
  metinler_60: "tum_metinler_60.json",
  sozluk: "yeni_tum_sozluk.json",
  diyalog_gramer: "diyaloglar_gramer_hap_bilgi.json",
  metin_gramer: "metinler_gramer_hap_bilgi.json",
  ek_gramer: "ek_gramer_hap_bilgi.json",
  seviye_sorulari: "seviye_tespit_sorulari.json",
  youtube_tavsiyeleri: "youtube_tavsiyeleri.json",
};

// Sıkı Depo Beyaz Listesi (Allowlist)
const ALLOWED_OWNER = "muallimun";
const ALLOWED_CODE_REPO = "arapca_telaffuz_web_v2";
const ALLOWED_MEDIA_REPO = "arapca_telaffuz_medya";

// Maksimum medya yükleme boyutu: 10 MB
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

// Doğrulanmış GitHub Token SHA-256 önbelleği (5 dakika TTL)
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
interface CachedTokenEntry {
  expiresAt: number;
  canPush: boolean;
}
const verifiedTokenCache = new Map<string, CachedTokenEntry>();

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function timingSafeEqualSecret(expected: string, provided: string): boolean {
  const expectedDigest = crypto
    .createHash("sha256")
    .update(expected, "utf8")
    .digest();
  const providedDigest = crypto
    .createHash("sha256")
    .update(provided, "utf8")
    .digest();
  const digestsMatch = crypto.timingSafeEqual(expectedDigest, providedDigest);
  return digestsMatch && expected.length === provided.length;
}

/**
 * Sunucu Tarafı Yönetici Yazma Yetkisi Doğrulaması:
 * 1. ADMIN_SECRET tanımlıysa x-admin-secret başlığını timing-safe olarak doğrular.
 * 2. githubToken gönderilmişse GitHub API üzerinden muallimun/arapca_telaffuz_web_v2
 *    deposunda gerçek yazma izni (permissions?.push === true) olduğunu doğrular ve
 *    SHA-256 özetiyle 5 dakika bellekte önbellekler.
 * 3. Token yoksa yalnızca NODE_ENV === "development" (ve action !== "verify_access") ise
 *    yerel geliştirici yazımına izin verir; aksi halde 401 Unauthorized döndürür.
 */
async function verifyAdminWriteAccess(params: {
  req: NextRequest;
  action: AdminPostAction;
  githubToken: string;
}): Promise<{ authorized: boolean; status: number; error?: string; mode?: "github" | "local-dev" }> {
  const { req, action, githubToken } = params;

  const configuredSecret = (process.env.ADMIN_SECRET || "").trim();
  if (configuredSecret.length > 0) {
    const headerSecret = (req.headers.get("x-admin-secret") || "").trim();
    if (!headerSecret || !timingSafeEqualSecret(configuredSecret, headerSecret)) {
      return {
        authorized: false,
        status: 401,
        error: "Yetkisiz erişim: Geçersiz veya eksik x-admin-secret başlığı.",
      };
    }
  }

  const trimmedToken = (githubToken || "").trim();
  if (!trimmedToken) {
    if (process.env.NODE_ENV === "development" && action !== "verify_access") {
      return {
        authorized: true,
        status: 200,
        mode: "local-dev",
      };
    }
    return {
      authorized: false,
      status: 401,
      error:
        "Yetkisiz işlem (401): Geçerli bir GitHub Personal Access Token (github_pat_... / ghp_...) gereklidir.",
    };
  }

  const tokenHash = sha256Hex(trimmedToken);
  const now = Date.now();
  const cached = verifiedTokenCache.get(tokenHash);
  if (cached && cached.expiresAt > now && cached.canPush) {
    return {
      authorized: true,
      status: 200,
      mode: "github",
    };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let ghRes: Response;
    try {
      ghRes = await fetch(
        `https://api.github.com/repos/${ALLOWED_OWNER}/${ALLOWED_CODE_REPO}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${trimmedToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Muallimun-Admin-Studio",
          },
          cache: "no-store",
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timer);
    }

    if (!ghRes.ok) {
      verifiedTokenCache.delete(tokenHash);
      return {
        authorized: false,
        status: 401,
        error: `GitHub erişim anahtarı doğrulanamadı (${ghRes.status}). Anahtarın geçerli olduğundan emin olun.`,
      };
    }

    const repoInfo = (await ghRes.json().catch(() => null)) as {
      permissions?: { push?: boolean; admin?: boolean; maintain?: boolean };
    } | null;

    if (repoInfo?.permissions?.push !== true) {
      verifiedTokenCache.delete(tokenHash);
      return {
        authorized: false,
        status: 401,
        error: `Bu GitHub anahtarının ${ALLOWED_OWNER}/${ALLOWED_CODE_REPO} deposunda yazma (push) yetkisi bulunmuyor.`,
      };
    }

    verifiedTokenCache.set(tokenHash, {
      expiresAt: now + TOKEN_CACHE_TTL_MS,
      canPush: true,
    });

    // Bellek sızıntısını önlemek için süresi dolmuş önbellek kayıtlarını temizle
    if (verifiedTokenCache.size > 64) {
      for (const [k, v] of verifiedTokenCache.entries()) {
        if (v.expiresAt <= now) {
          verifiedTokenCache.delete(k);
        }
      }
    }

    return {
      authorized: true,
      status: 200,
      mode: "github",
    };
  } catch {
    return {
      authorized: false,
      status: 401,
      error:
        "GitHub yetki doğrulama servisine ulaşılamadı. Ağ bağlantınızı kontrol edip tekrar deneyin.",
    };
  }
}

/**
 * Path Traversal (`..`), Null-Byte, Backslash, URL-Encoded Traversal ve Uzantı Kilidi
 */
export function validateSafeMediaPath(rawPath: string): {
  ok: boolean;
  error?: string;
  normalizedTarget?: string;
  cleanRelPath?: string;
  repoFilePath?: string;
  resolvedLocalPath?: string;
} {
  if (!rawPath || typeof rawPath !== "string") {
    return { ok: false, error: "Hedef medya dosya yolu boş olamaz." };
  }

  const rawTrimmed = rawPath.trim();
  if (
    rawTrimmed.includes("\0") ||
    rawTrimmed.includes("\\") ||
    /%2e|%2f|%5c|%00/i.test(rawTrimmed)
  ) {
    return {
      ok: false,
      error: "Geçersiz hedef dosya yolu: Yasaklı karakter veya dizin geçişi tespit edildi.",
    };
  }

  const stripped = rawTrimmed
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^muallimun\/arapca_telaffuz_medya\/main\//i, "")
    .replace(/^public\//, "")
    .trim();

  if (!stripped || stripped.includes("\0") || stripped.includes("\\")) {
    return { ok: false, error: "Geçersiz hedef dosya yolu." };
  }

  const segments = stripped.split("/");
  if (
    segments.some(
      (seg) =>
        !seg ||
        seg === "." ||
        seg === ".." ||
        seg.includes("..") ||
        !/^[a-zA-Z0-9._-]+$/.test(seg)
    )
  ) {
    return {
      ok: false,
      error: "Geçersiz hedef dosya yolu: '..' veya izin verilmeyen dosya adı karakteri.",
    };
  }

  const cleanRelPath = segments.join("/");

  if (!/^(sesler|gorseller|efect)\//.test(cleanRelPath)) {
    return {
      ok: false,
      error:
        "Yalnızca izin verilen medya klasörlerine (sesler/, gorseller/, efect/) yükleme yapılabilir.",
    };
  }

  if (!/\.(mp3|wav|webp)$/i.test(cleanRelPath)) {
    return {
      ok: false,
      error:
        "Yalnızca izin verilen medya uzantıları (.mp3, .wav, .webp) kabul edilir.",
    };
  }

  if (cleanRelPath.startsWith("gorseller/") && !/\.webp$/i.test(cleanRelPath)) {
    return {
      ok: false,
      error: "Görsel klasörüne (gorseller/) yalnızca .webp uzantılı dosyalar yüklenebilir.",
    };
  }

  if (
    (cleanRelPath.startsWith("sesler/") || cleanRelPath.startsWith("efect/")) &&
    !/\.(mp3|wav)$/i.test(cleanRelPath)
  ) {
    return {
      ok: false,
      error: "Ses klasörlerine (sesler/, efect/) yalnızca .mp3 veya .wav dosyaları yüklenebilir.",
    };
  }

  const publicRoot = path.resolve(process.cwd(), "public");
  const resolvedLocalPath = path.resolve(publicRoot, cleanRelPath);
  if (!resolvedLocalPath.startsWith(publicRoot + path.sep)) {
    return {
      ok: false,
      error: "Geçersiz hedef dosya yolu (Path Traversal engellendi).",
    };
  }

  const normalizedTarget = "/" + cleanRelPath;
  const repoFilePath = cleanRelPath.startsWith("efect/")
    ? cleanRelPath
    : `public/${cleanRelPath}`;

  return {
    ok: true,
    normalizedTarget,
    cleanRelPath,
    repoFilePath,
    resolvedLocalPath,
  };
}

/**
 * Üretimde (NODE_ENV === "production") yerel diske yazmayı tamamen kapatır;
 * geliştirme ortamında ise önce `.tmp` dosyasına yazıp `fs.renameSync` ile atomik günceller.
 */
function writeLocalFileAtomicInDev(
  targetFilePath: string,
  content: string | Buffer
): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(targetFilePath), { recursive: true });
    const tmpFilePath = `${targetFilePath}.tmp`;
    if (typeof content === "string") {
      fs.writeFileSync(tmpFilePath, content, "utf-8");
    } else {
      fs.writeFileSync(tmpFilePath, content);
    }
    fs.renameSync(tmpFilePath, targetFilePath);
    return true;
  } catch {
    return false;
  }
}

async function githubGetFileSha(params: {
  token: string;
  owner: string;
  repo: string;
  repoFilePath: string;
}): Promise<string | undefined> {
  const { token, owner, repo, repoFilePath } = params;
  if (!token) return undefined;
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/contents/${repoFilePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Muallimun-Admin-Studio",
      },
      cache: "no-store",
    });
    if (res.ok) {
      const meta = (await res.json()) as { sha?: string };
      if (meta && typeof meta.sha === "string") {
        return meta.sha;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function githubPutFile(params: {
  token: string;
  owner: string;
  repo: string;
  repoFilePath: string;
  base64Content: string;
  commitMessage: string;
  baseSha?: string;
}): Promise<{
  ok: boolean;
  status: number;
  htmlUrl?: string;
  newSha?: string;
  conflict?: boolean;
  error?: string;
}> {
  const {
    token,
    owner,
    repo,
    repoFilePath,
    base64Content,
    commitMessage,
    baseSha,
  } = params;
  const apiUrl = `https://api.github.com/repos/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(repo)}/contents/${repoFilePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Muallimun-Admin-Studio",
  };

  let existingSha: string | undefined;
  try {
    const getRes = await fetch(apiUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (getRes.ok) {
      const meta = (await getRes.json()) as { sha?: string };
      if (meta && typeof meta.sha === "string") {
        existingSha = meta.sha;
      }
    }
  } catch {
    // Dosya henüz mevcut değilse yeni oluşturulacak
  }

  // Çakışma Koruması (Optimistic Concurrency / baseSha Kontrolü)
  if (baseSha && existingSha && baseSha !== existingSha) {
    return {
      ok: false,
      status: 409,
      conflict: true,
      error:
        "Çakışma tespit edildi (409 Conflict): Dosya GitHub üzerinde başka bir oturumda güncellenmiş. Lütfen veriyi yenileyip tekrar kaydedin.",
    };
  }

  const bodyPayload: Record<string, string> = {
    message: commitMessage,
    content: base64Content,
  };
  if (existingSha) {
    bodyPayload.sha = existingSha;
  }

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    return {
      ok: false,
      status: putRes.status,
      conflict: putRes.status === 409,
      error: `GitHub API Hatası (${putRes.status}): ${errText.slice(0, 240)}`,
    };
  }

  const resultJson = (await putRes.json().catch(() => ({}))) as {
    content?: { html_url?: string; sha?: string };
  };
  return {
    ok: true,
    status: putRes.status,
    htmlUrl: resultJson?.content?.html_url,
    newSha: resultJson?.content?.sha,
  };
}

/**
 * Microsoft Edge Neural TTS (ar-SA-HamedNeural / ar-SA-ZariyahNeural)
 */


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataset = searchParams.get("dataset") as AdminDatasetKey | null;

    if (!dataset || !(dataset in DATASET_FILE_MAP)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Geçersiz veya eksik veri seti (dataset) parametresi.",
          supportedDatasets: Object.keys(DATASET_FILE_MAP),
        },
        { status: 400 }
      );
    }

    const fileName = DATASET_FILE_MAP[dataset];
    const dataRoot = path.resolve(process.cwd(), "src", "data");
    const filePath = path.resolve(dataRoot, fileName);
    if (!filePath.startsWith(dataRoot + path.sep)) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz veri seti dosya yolu." },
        { status: 400 }
      );
    }

    const rawContent = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(rawContent);

    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const baseSha = bearerToken
      ? await githubGetFileSha({
          token: bearerToken,
          owner: ALLOWED_OWNER,
          repo: ALLOWED_CODE_REPO,
          repoFilePath: `src/data/${fileName}`,
        })
      : undefined;

    return NextResponse.json({
      ok: true,
      dataset,
      fileName,
      baseSha,
      count: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
      data: parsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen okuma hatası";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action as AdminPostAction | undefined;

    if (
      action !== "verify_access" &&
      action !== "save_json" &&
      action !== "upload_media" &&
      action !== "generate_and_save_tts"
    ) {
      return NextResponse.json(
        { ok: false, error: "Geçersiz işlem türü (action)." },
        { status: 400 }
      );
    }

    const githubToken =
      typeof body?.githubToken === "string" ? body.githubToken.trim() : "";
    const owner =
      typeof body?.owner === "string" && body.owner.trim()
        ? body.owner.trim()
        : ALLOWED_OWNER;
    const codeRepo =
      typeof body?.codeRepo === "string" && body.codeRepo.trim()
        ? body.codeRepo.trim()
        : ALLOWED_CODE_REPO;
    const mediaRepo =
      typeof body?.mediaRepo === "string" && body.mediaRepo.trim()
        ? body.mediaRepo.trim()
        : ALLOWED_MEDIA_REPO;

    // 1. SIKI DEPO BEYAZ LİSTESİ (Allowlist) KONTROLÜ
    if (
      owner !== ALLOWED_OWNER ||
      codeRepo !== ALLOWED_CODE_REPO ||
      mediaRepo !== ALLOWED_MEDIA_REPO
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Yasaklı işlem (403 Forbidden): Yalnızca yetkili muallimun depolarına erişilebilir.",
        },
        { status: 403 }
      );
    }

    // 2. SUNUCU TARAFI YAZMA YETKİSİ DOĞRULAMASI (Tüm POST aksiyonlarında zorunlu)
    const accessCheck = await verifyAdminWriteAccess({
      req,
      action,
      githubToken,
    });
    if (!accessCheck.authorized) {
      return NextResponse.json(
        {
          ok: false,
          authorized: false,
          error: accessCheck.error || "Yetkisiz erişim (401 Unauthorized).",
        },
        { status: accessCheck.status || 401 }
      );
    }

    // 3. YÖNETİCİ KİLİT EKRANI YETKİ DOĞRULAMASI (verify_access)
    if (action === "verify_access") {
      return NextResponse.json({
        ok: true,
        authorized: true,
        owner: ALLOWED_OWNER,
        codeRepo: ALLOWED_CODE_REPO,
        mediaRepo: ALLOWED_MEDIA_REPO,
      });
    }

    // 4. JSON VERİ TABANI KAYDETME (save_json)
    if (action === "save_json") {
      const dataset = body?.dataset as AdminDatasetKey | undefined;
      const data = body?.data;
      const baseSha =
        typeof body?.baseSha === "string" && body.baseSha.trim()
          ? body.baseSha.trim()
          : undefined;

      if (!dataset || !(dataset in DATASET_FILE_MAP)) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz veri seti (dataset) adı." },
          { status: 400 }
        );
      }
      if (data === undefined || data === null) {
        return NextResponse.json(
          { ok: false, error: "Kaydedilecek JSON verisi (data) boş olamaz." },
          { status: 400 }
        );
      }

      if (dataset === "youtube_tavsiyeleri") {
        if (!Array.isArray(data) || data.length === 0) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "youtube_tavsiyeleri veri seti boş olmayan bir dizi (array) olmalıdır.",
            },
            { status: 400 }
          );
        }
        const allowedCategories = new Set([
          "cizgi_animasyon",
          "diyalog_egitim",
          "hikaye_kissa",
          "tarihi_dizi_film",
          "islami_sohbet_ders",
          "belgesel_basin",
        ]);
        const allowedLevels = new Set(["A1", "A2", "B1", "B2"]);
        for (let i = 0; i < data.length; i++) {
          const item = data[i] as Record<string, unknown>;
          if (
            !item ||
            typeof item !== "object" ||
            typeof item.id !== "string" ||
            !item.id.trim() ||
            typeof item.cefr !== "string" ||
            !allowedLevels.has(item.cefr) ||
            (item.tur !== "video" && item.tur !== "playlist") ||
            typeof item.kategori !== "string" ||
            !allowedCategories.has(item.kategori) ||
            typeof item.baslik_tr !== "string" ||
            !item.baslik_tr.trim() ||
            typeof item.baslik_ar !== "string" ||
            !item.baslik_ar.trim() ||
            typeof item.kanal_adi !== "string" ||
            !item.kanal_adi.trim() ||
            typeof item.url !== "string" ||
            !item.url.trim()
          ) {
            return NextResponse.json(
              {
                ok: false,
                error: `youtube_tavsiyeleri kayıt #${i + 1} şema doğrulamasından geçemedi (id, cefr, tur, kategori, baslik_tr, baslik_ar, kanal_adi ve url zorunludur).`,
              },
              { status: 400 }
            );
          }
        }
      }

      const fileName = DATASET_FILE_MAP[dataset];
      const dataRoot = path.resolve(process.cwd(), "src", "data");
      const localFilePath = path.resolve(dataRoot, fileName);
      if (!localFilePath.startsWith(dataRoot + path.sep)) {
        return NextResponse.json(
          { ok: false, error: "Geçersiz hedef veri dosyası yolu." },
          { status: 400 }
        );
      }

      const jsonString = JSON.stringify(data, null, 2).normalize("NFC") + "\n";
      const commitMessage =
        body?.commitMessage ||
        `chore(data): ${fileName} yönetim stüdyosu üzerinden güncellendi`;

      const localSaved = writeLocalFileAtomicInDev(localFilePath, jsonString);

      if (githubToken) {
        const base64Content = Buffer.from(jsonString, "utf-8").toString(
          "base64"
        );
        const ghRes = await githubPutFile({
          token: githubToken,
          owner: ALLOWED_OWNER,
          repo: ALLOWED_CODE_REPO,
          repoFilePath: `src/data/${fileName}`,
          base64Content,
          commitMessage,
          baseSha,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            {
              ok: false,
              conflict: ghRes.conflict,
              localSaved,
              error: ghRes.error,
            },
            { status: ghRes.status || 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          mode: "github",
          localSaved,
          fileName,
          newSha: ghRes.newSha,
          repoPath: `${ALLOWED_OWNER}/${ALLOWED_CODE_REPO}/src/data/${fileName}`,
          htmlUrl: ghRes.htmlUrl,
        });
      }

      if (localSaved) {
        return NextResponse.json({
          ok: true,
          mode: "local",
          localSaved: true,
          fileName,
          repoPath: `src/data/${fileName}`,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Canlı ortamda kaydetmek için geçerli bir GitHub Token (github_pat_... / ghp_...) gereklidir.",
        },
        { status: 401 }
      );
    }

    // 5. MEDYA (.mp3 / .wav / .webp) YÜKLEME VE DEĞİŞTİRME (upload_media)
    if (action === "upload_media") {
      const rawBase64 = typeof body?.base64Content === "string" ? body.base64Content : "";
      const targetPath = typeof body?.targetPath === "string" ? body.targetPath : "";
      const baseSha =
        typeof body?.baseSha === "string" && body.baseSha.trim()
          ? body.baseSha.trim()
          : undefined;

      if (!rawBase64 || !targetPath) {
        return NextResponse.json(
          {
            ok: false,
            error: "base64Content ve targetPath alanları zorunludur.",
          },
          { status: 400 }
        );
      }

      const pathValidation = validateSafeMediaPath(targetPath);
      if (
        !pathValidation.ok ||
        !pathValidation.normalizedTarget ||
        !pathValidation.repoFilePath ||
        !pathValidation.resolvedLocalPath
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: pathValidation.error || "Geçersiz hedef dosya yolu.",
          },
          { status: 400 }
        );
      }

      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, "").trim();
      const mediaBuffer = Buffer.from(cleanBase64, "base64");
      if (mediaBuffer.byteLength === 0) {
        return NextResponse.json(
          { ok: false, error: "Yüklenen medya dosyası boş veya geçersiz." },
          { status: 400 }
        );
      }
      if (mediaBuffer.byteLength > MAX_MEDIA_BYTES) {
        return NextResponse.json(
          {
            ok: false,
            error: "Dosya boyutu çok büyük! Maksimum yükleme boyutu 10 MB ile sınırlıdır.",
          },
          { status: 413 }
        );
      }

      const { normalizedTarget, repoFilePath, resolvedLocalPath } =
        pathValidation;
      const commitMessage =
        body?.commitMessage ||
        `chore(media): ${repoFilePath} yönetim stüdyosu üzerinden yüklendi`;

      const localSaved = writeLocalFileAtomicInDev(
        resolvedLocalPath,
        mediaBuffer
      );

      if (githubToken) {
        const ghRes = await githubPutFile({
          token: githubToken,
          owner: ALLOWED_OWNER,
          repo: ALLOWED_MEDIA_REPO,
          repoFilePath,
          base64Content: mediaBuffer.toString("base64"),
          commitMessage,
          baseSha,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            {
              ok: false,
              conflict: ghRes.conflict,
              localSaved,
              error: ghRes.error,
            },
            { status: ghRes.status || 500 }
          );
        }

        // Eğer görsel kelime resmi ise (örn. gorseller/kelimeler/0002_01_arap.webp),
        // aynı zamanda kanonik gorsel_0002.webp yoluna da senkronize et
        const visualAliasMatch = normalizedTarget.match(
          /^\/gorseller\/kelimeler\/(\d{4})_[^/]+\.webp$/i
        );
        if (visualAliasMatch) {
          const canonicalRepoPath = `public/gorseller/kelimeler/gorsel_${visualAliasMatch[1]}.webp`;
          if (canonicalRepoPath !== repoFilePath) {
            await githubPutFile({
              token: githubToken,
              owner: ALLOWED_OWNER,
              repo: ALLOWED_MEDIA_REPO,
              repoFilePath: canonicalRepoPath,
              base64Content: mediaBuffer.toString("base64"),
              commitMessage: `${commitMessage} (gorsel_${visualAliasMatch[1]}.webp senkronizasyonu)`,
            }).catch(() => {});
          }
        }

        return NextResponse.json({
          ok: true,
          mode: "github",
          localSaved,
          targetPath: normalizedTarget,
          repoFilePath,
          newSha: ghRes.newSha,
          htmlUrl: ghRes.htmlUrl,
        });
      }

      if (localSaved) {
        return NextResponse.json({
          ok: true,
          mode: "local",
          localSaved: true,
          targetPath: normalizedTarget,
          repoFilePath,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Medya deposuna yüklemek için geçerli bir GitHub Token (github_pat_... / ghp_...) gereklidir.",
        },
        { status: 401 }
      );
    }

    // 6. OTOMATİK TTS SES ÜRETİP MEDYA DEPOSUNA KAYDETME (generate_and_save_tts)
    if (action === "generate_and_save_tts") {
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      const gender = (body?.gender || "male") as
        | "male"
        | "female"
        | "erkek"
        | "kadin";
      const rate = typeof body?.rate === "number" ? body.rate : 1.0;
      const targetPath =
        typeof body?.targetPath === "string" ? body.targetPath.trim() : "";
      const baseSha =
        typeof body?.baseSha === "string" && body.baseSha.trim()
          ? body.baseSha.trim()
          : undefined;

      if (!text || !targetPath) {
        return NextResponse.json(
          {
            ok: false,
            error: "Arapça metin (text) ve hedef ses yolu (targetPath) zorunludur.",
          },
          { status: 400 }
        );
      }

      if (text.length > 1000) {
        return NextResponse.json(
          {
            ok: false,
            error: "Seslendirilecek metin en fazla 1000 karakter olabilir.",
          },
          { status: 400 }
        );
      }

      const pathValidation = validateSafeMediaPath(targetPath);
      if (
        !pathValidation.ok ||
        !pathValidation.normalizedTarget ||
        !pathValidation.repoFilePath ||
        !pathValidation.resolvedLocalPath
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: pathValidation.error || "Geçersiz hedef ses dosyası yolu.",
          },
          { status: 400 }
        );
      }

      let audioBuffer = await synthesizeEdgeTtsBuffer(text, gender, rate);
      let ttsEngine = "edge-neural-tts";
      if (!audioBuffer) {
        audioBuffer = await synthesizeGoogleTtsBuffer(text, rate);
        ttsEngine = "google-tts";
      }

      if (!audioBuffer) {
        return NextResponse.json(
          {
            ok: false,
            error: "TTS ses sentezleme başarısız oldu. Lütfen tekrar deneyin.",
          },
          { status: 502 }
        );
      }

      if (audioBuffer.byteLength > MAX_MEDIA_BYTES) {
        return NextResponse.json(
          { ok: false, error: "Üretilen ses dosyası 10 MB sınırını aşıyor." },
          { status: 413 }
        );
      }

      const cleanBase64 = audioBuffer.toString("base64");
      const { normalizedTarget, repoFilePath, resolvedLocalPath } =
        pathValidation;
      const commitMessage =
        body?.commitMessage ||
        `chore(tts): ${repoFilePath} otomatik seslendirildi (${ttsEngine})`;

      const localSaved = writeLocalFileAtomicInDev(
        resolvedLocalPath,
        audioBuffer
      );

      if (githubToken) {
        const ghRes = await githubPutFile({
          token: githubToken,
          owner: ALLOWED_OWNER,
          repo: ALLOWED_MEDIA_REPO,
          repoFilePath,
          base64Content: cleanBase64,
          commitMessage,
          baseSha,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            {
              ok: false,
              conflict: ghRes.conflict,
              localSaved,
              base64Audio: `data:audio/mpeg;base64,${cleanBase64}`,
              error: ghRes.error,
            },
            { status: ghRes.status || 500 }
          );
        }

        return NextResponse.json({
          ok: true,
          mode: "github",
          ttsEngine,
          localSaved,
          targetPath: normalizedTarget,
          repoFilePath,
          newSha: ghRes.newSha,
          htmlUrl: ghRes.htmlUrl,
          base64Audio: `data:audio/mpeg;base64,${cleanBase64}`,
        });
      }

      if (localSaved) {
        return NextResponse.json({
          ok: true,
          mode: "local",
          ttsEngine,
          localSaved: true,
          targetPath: normalizedTarget,
          repoFilePath,
          base64Audio: `data:audio/mpeg;base64,${cleanBase64}`,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Canlı ortamda TTS ses kaydetmek için geçerli GitHub Token gereklidir.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Geçersiz işlem türü (action)." },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sunucu hatası";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
