import crypto from "crypto";

export type ServerTtsVoiceInput =
  | "ar-SA-HamedNeural"
  | "ar-SA-ZariyahNeural"
  | "male"
  | "female"
  | "erkek"
  | "kadin"
  | "K"
  | "E"
  | string;

/**
 * 175 karakterden uzun Arapça cümleleri (örn. dlg_12 satır 4: 345 karakter)
 * Arapça noktalama işaretlerinden (، . ؛ ؟ !) veya kelime boşluklarından <= 175 karakterlik parçalara böler.
 */
export function splitArabicTextIntoChunks(
  text: string,
  maxChunkLength = 175
): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChunkLength) return [cleaned];

  const chunks: string[] = [];
  const segments = cleaned
    .split(/(?<=[،.؛؟!,?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let current = "";
  const pushWordsSplit = (longSegment: string) => {
    const words = longSegment.split(/\s+/).filter(Boolean);
    let wordBuf = "";
    for (const word of words) {
      if (!wordBuf) {
        wordBuf = word.slice(0, maxChunkLength);
      } else if (wordBuf.length + 1 + word.length <= maxChunkLength) {
        wordBuf += " " + word;
      } else {
        chunks.push(wordBuf);
        wordBuf = word.slice(0, maxChunkLength);
      }
    }
    if (wordBuf) {
      chunks.push(wordBuf);
    }
  };

  for (const seg of segments) {
    if (seg.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      pushWordsSplit(seg);
    } else if (!current) {
      current = seg;
    } else if (current.length + 1 + seg.length <= maxChunkLength) {
      current += " " + seg;
    } else {
      chunks.push(current);
      current = seg;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [cleaned.slice(0, maxChunkLength)];
}

/**
 * Katman 2A: Microsoft Edge Neural TTS (Ücretsiz WebSocket Sentezleyici)
 * Sesler: ar-SA-HamedNeural (Erkek), ar-SA-ZariyahNeural (Kadın)
 */
export async function synthesizeEdgeTtsBuffer(
  text: string,
  voiceOrGender: ServerTtsVoiceInput = "male",
  rate = 1.0,
  timeoutMs = 4200
): Promise<Buffer | null> {
  try {
    const ratePercent = Math.round((rate - 1) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    const normalized = String(voiceOrGender).trim();
    const isFemale =
      normalized === "female" ||
      normalized === "kadin" ||
      normalized === "K" ||
      normalized === "ar-SA-ZariyahNeural";
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
              // ignore close errors
            }
            ws = null;
          }
          resolve(val);
        };

        const timeout = setTimeout(() => {
          safeCloseAndResolve(null);
        }, timeoutMs);

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

async function fetchSingleGoogleTtsChunk(
  chunkText: string,
  rate: number
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 8000);

  try {
    const ttsspeed = rate < 0.9 ? "0.24" : "1";
    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&ttsspeed=${ttsspeed}&q=${encodeURIComponent(
      chunkText
    )}`;

    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      signal: controller.signal,
    });

    if (res.ok) {
      const arr = await res.arrayBuffer();
      if (arr.byteLength > 128) {
        return Buffer.from(arr);
      }
    }
  } catch {
    // Sessizce geç
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * Katman 2B: Google Translate Doğal Arapça TTS Akışı (Harekeli metin ve >175 karakter uzun cümle birleştirme uyumlu)
 */
export async function synthesizeGoogleTtsBuffer(
  text: string,
  rate = 1.0
): Promise<Buffer | null> {
  const chunks = splitArabicTextIntoChunks(text, 175);
  if (chunks.length === 0) return null;

  if (chunks.length === 1) {
    return fetchSingleGoogleTtsChunk(chunks[0], rate);
  }

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    const partBuf = await fetchSingleGoogleTtsChunk(chunk, rate);
    if (!partBuf) {
      return null;
    }
    buffers.push(partBuf);
  }

  if (buffers.length === 0) return null;
  return Buffer.concat(buffers);
}
