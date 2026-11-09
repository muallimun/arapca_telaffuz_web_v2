import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

export type AdminDatasetKey =
  | "gorsel_kelimeler"
  | "cumleler_1111"
  | "atasozleri_508"
  | "diyaloglar_120"
  | "metinler_60"
  | "sozluk"
  | "diyalog_gramer"
  | "metin_gramer";

const DATASET_FILE_MAP: Record<AdminDatasetKey, string> = {
  gorsel_kelimeler: "gorselKelimeler_guncel.json",
  cumleler_1111: "1111_cumle.json",
  atasozleri_508: "atasozleri.json",
  diyaloglar_120: "tum_diyaloglar_120.json",
  metinler_60: "tum_metinler_60.json",
  sozluk: "yeni_tum_sozluk.json",
  diyalog_gramer: "diyaloglar_gramer_hap_bilgi.json",
  metin_gramer: "metinler_gramer_hap_bilgi.json",
};

function normalizeTargetPath(rawPath: string): string {
  const clean = (rawPath || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/^muallimun\/arapca_telaffuz_medya\/main\//i, "")
    .replace(/^public\//, "");
  return "/" + clean;
}

function toMediaRepoPath(targetPath: string): string {
  const norm = normalizeTargetPath(targetPath);
  return norm.startsWith("/efect/") ? norm.slice(1) : "public" + norm;
}

async function githubPutFile(params: {
  token: string;
  owner: string;
  repo: string;
  repoFilePath: string;
  base64Content: string;
  commitMessage: string;
}): Promise<{ ok: boolean; status: number; htmlUrl?: string; error?: string }> {
  const { token, owner, repo, repoFilePath, base64Content, commitMessage } =
    params;
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
      error: `GitHub API Hatası (${putRes.status}): ${errText.slice(0, 240)}`,
    };
  }

  const resultJson = (await putRes.json().catch(() => ({}))) as {
    content?: { html_url?: string };
  };
  return {
    ok: true,
    status: putRes.status,
    htmlUrl: resultJson?.content?.html_url,
  };
}

/**
 * Microsoft Edge Neural TTS (ar-SA-HamedNeural / ar-SA-ZariyahNeural)
 */
async function synthesizeEdgeTtsBuffer(
  text: string,
  gender: "male" | "female" | "erkek" | "kadin",
  rate = 1.0
): Promise<Buffer | null> {
  try {
    const ratePercent = Math.round((rate - 1) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const isFemale = gender === "female" || gender === "kadin";
    const resolvedVoice = isFemale
      ? "ar-SA-ZariyahNeural"
      : "ar-SA-HamedNeural";

    const trustedToken = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    const ticks =
      Math.floor(Date.now() / 1000 + 11644473600) -
      (Math.floor(Date.now() / 1000 + 11644473600) % 300);
    const strToHash = `${ticks * 1e7}${trustedToken}`;
    const secMsGec = crypto
      .createHash("sha256")
      .update(strToHash, "ascii")
      .digest("hex")
      .toUpperCase();

    if (typeof WebSocket !== "undefined") {
      const mp3Buffer = await new Promise<ArrayBuffer | null>((resolve) => {
        let ws: WebSocket | null = null;
        let settled = false;

        const safeCloseAndResolve = (val: ArrayBuffer | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (ws) {
            try {
              ws.onopen = null;
              ws.onmessage = null;
              ws.onerror = null;
              ws.close();
            } catch {
              // ignore
            }
            ws = null;
          }
          resolve(val);
        };

        const timeout = setTimeout(() => {
          safeCloseAndResolve(null);
        }, 4500);

        try {
          const reqId = crypto.randomUUID().replace(/-/g, "");
          const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${trustedToken}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${reqId}`;
          ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";
          const audioChunks: Uint8Array[] = [];

          ws.onopen = () => {
            if (!ws || settled) return;
            const configMsg =
              `X-Timestamp:${new Date().toISOString()}\r\n` +
              `Content-Type:application/json; charset=utf-8\r\n` +
              `Path:speech.config\r\n\r\n` +
              JSON.stringify({
                context: {
                  synthesis: {
                    audio: {
                      metadataoptions: {
                        sentenceBoundaryEnabled: "false",
                        wordBoundaryEnabled: "false",
                      },
                      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                    },
                  },
                },
              });
            ws.send(configMsg);

            const escapedText = text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");

            const ssml =
              `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-SA'>` +
              `<voice name='${resolvedVoice}'>` +
              `<prosody pitch='+0Hz' rate='${rateStr}' volume='+0%'>${escapedText}</prosody>` +
              `</voice></speak>`;

            const ssmlMsg =
              `X-RequestId:${reqId}\r\n` +
              `Content-Type:application/ssml+xml\r\n` +
              `X-Timestamp:${new Date().toISOString()}Z\r\n` +
              `Path:ssml\r\n\r\n` +
              ssml;

            ws.send(ssmlMsg);
          };

          ws.onmessage = (event) => {
            if (settled) return;
            if (typeof event.data === "string") {
              if (event.data.includes("Path:turn.end")) {
                if (audioChunks.length === 0) {
                  safeCloseAndResolve(null);
                  return;
                }
                const totalLen = audioChunks.reduce(
                  (acc, c) => acc + c.byteLength,
                  0
                );
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const chunk of audioChunks) {
                  merged.set(chunk, offset);
                  offset += chunk.byteLength;
                }
                safeCloseAndResolve(merged.buffer);
              }
            } else if (event.data instanceof ArrayBuffer) {
              const view = new DataView(event.data);
              const headerLen = view.getUint16(0, false);
              if (event.data.byteLength > headerLen + 2) {
                const body = new Uint8Array(event.data, headerLen + 2);
                audioChunks.push(body);
              }
            }
          };

          ws.onerror = () => {
            safeCloseAndResolve(null);
          };
        } catch {
          safeCloseAndResolve(null);
        }
      });

      if (mp3Buffer && mp3Buffer.byteLength > 256) {
        return Buffer.from(mp3Buffer);
      }
    }
  } catch {
    // Fallback'e geç
  }
  return null;
}

async function synthesizeGoogleTtsBuffer(
  text: string,
  rate = 1.0
): Promise<Buffer | null> {
  try {
    const ttsspeed = rate < 0.9 ? "0.24" : "1";
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&ttsspeed=${ttsspeed}&q=${encodeURIComponent(
      text.slice(0, 190)
    )}`;
    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (res.ok) {
      const arr = await res.arrayBuffer();
      if (arr.byteLength > 128) {
        return Buffer.from(arr);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

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
    const filePath = path.join(process.cwd(), "src", "data", fileName);
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(rawContent);

    return NextResponse.json({
      ok: true,
      dataset,
      fileName,
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
    const action = body?.action as
      | "save_json"
      | "upload_media"
      | "generate_and_save_tts"
      | undefined;

    const githubToken = (body?.githubToken || "").trim();
    const owner = (body?.owner || "muallimun").trim();
    const codeRepo = (body?.codeRepo || "arapca_telaffuz_web_v2").trim();
    const mediaRepo = (body?.mediaRepo || "arapca_telaffuz_medya").trim();

    // 1. JSON VERİ TABANI KAYDETME (save_json)
    if (action === "save_json") {
      const dataset = body?.dataset as AdminDatasetKey | undefined;
      const data = body?.data;

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

      const fileName = DATASET_FILE_MAP[dataset];
      const jsonString = JSON.stringify(data, null, 2) + "\n";
      const commitMessage =
        body?.commitMessage ||
        `chore(data): ${fileName} yönetim stüdyosu üzerinden güncellendi`;

      let localSaved = false;
      try {
        const localFilePath = path.join(
          process.cwd(),
          "src",
          "data",
          fileName
        );
        fs.writeFileSync(localFilePath, jsonString, "utf-8");
        localSaved = true;
      } catch {
        // Salt okunur sunucu dosya sistemi ise GitHub üzerinden devam eder
      }

      if (githubToken) {
        const base64Content = Buffer.from(jsonString, "utf-8").toString(
          "base64"
        );
        const ghRes = await githubPutFile({
          token: githubToken,
          owner,
          repo: codeRepo,
          repoFilePath: `src/data/${fileName}`,
          base64Content,
          commitMessage,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            {
              ok: false,
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
          repoPath: `${owner}/${codeRepo}/src/data/${fileName}`,
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
            "Canlı ortamda kaydetmek için üst bardan GitHub Token (ghp_...) giriniz.",
        },
        { status: 400 }
      );
    }

    // 2. MEDYA (.mp3 / .webp) YÜKLEME VE DEĞİŞTİRME (upload_media)
    if (action === "upload_media") {
      const rawBase64 = (body?.base64Content || "") as string;
      const targetPath = (body?.targetPath || "") as string;

      if (!rawBase64 || !targetPath) {
        return NextResponse.json(
          {
            ok: false,
            error: "base64Content ve targetPath alanları zorunludur.",
          },
          { status: 400 }
        );
      }

      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, "").trim();
      const normalizedTarget = normalizeTargetPath(targetPath);
      const repoFilePath = toMediaRepoPath(normalizedTarget);
      const commitMessage =
        body?.commitMessage ||
        `chore(media): ${repoFilePath} yönetim stüdyosu üzerinden yüklendi`;

      let localSaved = false;
      try {
        const localMediaPath = path.join(
          process.cwd(),
          "public",
          normalizedTarget.slice(1)
        );
        fs.mkdirSync(path.dirname(localMediaPath), { recursive: true });
        fs.writeFileSync(localMediaPath, Buffer.from(cleanBase64, "base64"));
        localSaved = true;
      } catch {
        // Salt okunur ortamda geç
      }

      if (githubToken) {
        const ghRes = await githubPutFile({
          token: githubToken,
          owner,
          repo: mediaRepo,
          repoFilePath,
          base64Content: cleanBase64,
          commitMessage,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            { ok: false, localSaved, error: ghRes.error },
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
              owner,
              repo: mediaRepo,
              repoFilePath: canonicalRepoPath,
              base64Content: cleanBase64,
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
            "Medya deposuna yüklemek için üst bardan GitHub Token (ghp_...) giriniz.",
        },
        { status: 400 }
      );
    }

    // 3. OTOMATİK TTS SES ÜRETİP MEDYA DEPOSUNA KAYDETME (generate_and_save_tts)
    if (action === "generate_and_save_tts") {
      const text = (body?.text || "").trim();
      const gender = (body?.gender || "male") as
        | "male"
        | "female"
        | "erkek"
        | "kadin";
      const rate = typeof body?.rate === "number" ? body.rate : 1.0;
      const targetPath = (body?.targetPath || "").trim();

      if (!text || !targetPath) {
        return NextResponse.json(
          {
            ok: false,
            error: "Arapça metin (text) ve hedef ses yolu (targetPath) zorunludur.",
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

      const cleanBase64 = audioBuffer.toString("base64");
      const normalizedTarget = normalizeTargetPath(targetPath);
      const repoFilePath = toMediaRepoPath(normalizedTarget);
      const commitMessage =
        body?.commitMessage ||
        `chore(tts): ${repoFilePath} otomatik seslendirildi (${ttsEngine})`;

      let localSaved = false;
      try {
        const localMediaPath = path.join(
          process.cwd(),
          "public",
          normalizedTarget.slice(1)
        );
        fs.mkdirSync(path.dirname(localMediaPath), { recursive: true });
        fs.writeFileSync(localMediaPath, audioBuffer);
        localSaved = true;
      } catch {
        // ignore on read-only fs
      }

      if (githubToken) {
        const ghRes = await githubPutFile({
          token: githubToken,
          owner,
          repo: mediaRepo,
          repoFilePath,
          base64Content: cleanBase64,
          commitMessage,
        });

        if (!ghRes.ok) {
          return NextResponse.json(
            {
              ok: false,
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
          htmlUrl: ghRes.htmlUrl,
          base64Audio: `data:audio/mpeg;base64,${cleanBase64}`,
        });
      }

      return NextResponse.json({
        ok: true,
        mode: localSaved ? "local" : "memory-preview",
        ttsEngine,
        localSaved,
        targetPath: normalizedTarget,
        repoFilePath,
        base64Audio: `data:audio/mpeg;base64,${cleanBase64}`,
      });
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
