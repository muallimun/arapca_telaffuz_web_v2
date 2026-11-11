import { NextRequest, NextResponse } from "next/server";
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;

type ServerAsrOutputItem = { text?: string };
type ServerAsrOutput = ServerAsrOutputItem | ServerAsrOutputItem[];
type ServerAsrPipelineFn = (
  audio: Float32Array,
  options: Record<string, unknown>
) => Promise<ServerAsrOutput>;

let serverTranscriberPromise: Promise<ServerAsrPipelineFn> | null = null;

async function getServerTranscriber(): Promise<ServerAsrPipelineFn> {
  if (!serverTranscriberPromise) {
    serverTranscriberPromise = (async () => {
      const candidates = [
        "onnx-community/whisper-tiny",
        "Xenova/whisper-tiny",
        "onnx-community/whisper-base",
      ];
      let lastErr: unknown = null;
      for (const modelId of candidates) {
        try {
          const pipe = await pipeline(
            "automatic-speech-recognition",
            modelId,
            {
              dtype: "q8",
            }
          );
          return pipe as unknown as ServerAsrPipelineFn;
        } catch (err) {
          lastErr = err;
        }
      }
      serverTranscriberPromise = null;
      throw lastErr || new Error("Sunucu STT modeli yüklenemedi.");
    })();
  }
  return serverTranscriberPromise;
}

class UnsupportedWavFormatError extends Error {
  constructor(message = "Desteklenmeyen ses biçimi") {
    super(message);
    this.name = "UnsupportedWavFormatError";
  }
}

function resampleMonoFloat32To16k(
  samples: Float32Array,
  sourceSampleRate: number
): Float32Array {
  const targetRate = 16000;
  if (!samples || samples.length === 0) return new Float32Array(0);
  if (sourceSampleRate === targetRate) return samples;
  const ratio = sourceSampleRate / targetRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(samples.length - 1, i0 + 1);
    const frac = srcPos - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

/**
 * RIFF/WAVE ikili verisini (ArrayBuffer) doğrular (PCM 16/32-bit veya IEEE Float 32-bit,
 * 1-2 kanal, 8000-48000 Hz), gerekiyorsa stereo -> mono birleştirir ve 16000 Hz Float32Array'e örnekler.
 * Geçersiz veya WebM/Ogg gibi WAV-dışı verilerde UnsupportedWavFormatError (HTTP 415) fırlatır.
 */
function parseWavBufferToFloat32(buffer: ArrayBuffer): Float32Array {
  if (!buffer || buffer.byteLength < 44) {
    throw new UnsupportedWavFormatError("Desteklenmeyen ses biçimi: Geçersiz WAV başlığı.");
  }
  const view = new DataView(buffer);

  const isRiff =
    view.getUint8(0) === 0x52 && // R
    view.getUint8(1) === 0x49 && // I
    view.getUint8(2) === 0x46 && // F
    view.getUint8(3) === 0x46;   // F
  const isWave =
    view.getUint8(8) === 0x57 &&  // W
    view.getUint8(9) === 0x41 &&  // A
    view.getUint8(10) === 0x56 && // V
    view.getUint8(11) === 0x45;   // E

  if (!isRiff || !isWave) {
    throw new UnsupportedWavFormatError(
      "Desteklenmeyen ses biçimi: Yalnızca RIFF/WAVE ses verisi kabul edilir."
    );
  }

  let fmtFound = false;
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkBodyStart = offset + 8;

    if (chunkId === "fmt ") {
      if (chunkSize < 16 || chunkBodyStart + 16 > buffer.byteLength) {
        throw new UnsupportedWavFormatError("Desteklenmeyen ses biçimi: Bozuk fmt alt-parçası.");
      }
      fmtFound = true;
      audioFormat = view.getUint16(chunkBodyStart, true);
      numChannels = view.getUint16(chunkBodyStart + 2, true);
      sampleRate = view.getUint32(chunkBodyStart + 4, true);
      bitsPerSample = view.getUint16(chunkBodyStart + 14, true);
    } else if (chunkId === "data") {
      dataOffset = chunkBodyStart;
      dataLength = Math.max(0, Math.min(chunkSize, buffer.byteLength - dataOffset));
      break;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    if (paddedSize < 0 || offset + 8 + paddedSize <= offset) break;
    offset += 8 + paddedSize;
  }

  if (!fmtFound || dataOffset < 0) {
    throw new UnsupportedWavFormatError(
      "Desteklenmeyen ses biçimi: Eksik fmt veya data alt-parçası."
    );
  }

  const validFormat =
    (audioFormat === 1 && (bitsPerSample === 16 || bitsPerSample === 32)) ||
    (audioFormat === 3 && bitsPerSample === 32);
  const validChannels = numChannels === 1 || numChannels === 2;
  const validRate = sampleRate >= 8000 && sampleRate <= 48000;

  if (!validFormat || !validChannels || !validRate) {
    throw new UnsupportedWavFormatError(
      "Desteklenmeyen ses biçimi: Yalnızca 8-48kHz, 1-2 kanal, PCM 16/32 veya Float32 WAV desteklenir."
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * numChannels;
  const frameCount = Math.floor(dataLength / frameSize);
  if (frameCount <= 0) {
    return new Float32Array(0);
  }

  const mono = new Float32Array(frameCount);
  for (let f = 0; f < frameCount; f++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const samplePos = dataOffset + f * frameSize + ch * bytesPerSample;
      let val = 0;
      if (audioFormat === 1 && bitsPerSample === 16) {
        const s16 = view.getInt16(samplePos, true);
        val = s16 < 0 ? s16 / 0x8000 : s16 / 0x7fff;
      } else if (audioFormat === 1 && bitsPerSample === 32) {
        const s32 = view.getInt32(samplePos, true);
        val = s32 < 0 ? s32 / 0x80000000 : s32 / 0x7fffffff;
      } else {
        const f32 = view.getFloat32(samplePos, true);
        val = Number.isFinite(f32) ? Math.max(-1, Math.min(1, f32)) : 0;
      }
      sum += val;
    }
    mono[f] = sum / numChannels;
  }

  return resampleMonoFloat32To16k(mono, sampleRate);
}

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_AUDIO_SAMPLES = 16000 * 30; // 30 saniye @ 16kHz
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 dakika
const RATE_LIMIT_MAX_REQUESTS = 20;

const ipRequestHistory = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const prev = ipRequestHistory.get(ip) || [];
  const valid = prev.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (valid.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequestHistory.set(ip, valid);
    return true;
  }
  valid.push(now);
  ipRequestHistory.set(ip, valid);
  if (ipRequestHistory.size > 500) {
    for (const [k, list] of ipRequestHistory.entries()) {
      if (list.every((ts) => now - ts >= RATE_LIMIT_WINDOW_MS)) {
        ipRequestHistory.delete(k);
      }
    }
  }
  return false;
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "stt",
      status: "ready",
      maxBytes: MAX_BODY_BYTES,
      maxDurationSec: 30,
      rateLimitPerMinute: RATE_LIMIT_MAX_REQUESTS,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip")?.trim() ||
      "anonymous";

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        {
          ok: false,
          text: "",
          error:
            "Dakikada en fazla 20 ses çözümleme isteği gönderilebilir. Lütfen kısa bir süre bekleyin.",
        },
        { status: 429 }
      );
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLen = Number(contentLengthHeader);
      if (Number.isFinite(contentLen) && contentLen > MAX_BODY_BYTES) {
        return NextResponse.json(
          {
            ok: false,
            text: "",
            error: "Ses verisi boyutu 2 MB sınırını aşıyor.",
          },
          { status: 413 }
        );
      }
      if (Number.isFinite(contentLen) && contentLen === 0) {
        return NextResponse.json(
          {
            ok: false,
            text: "",
            error: "Boş istek gövdesi gönderildi.",
          },
          { status: 400 }
        );
      }
    }

    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let pcm16k: Float32Array = new Float32Array(0);

    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await req.formData();
      } catch {
        return NextResponse.json(
          { ok: false, text: "", error: "Geçersiz multipart/form-data gövdesi." },
          { status: 400 }
        );
      }
      const file = (formData.get("file") || formData.get("audio")) as Blob | null;
      if (!file || typeof file.arrayBuffer !== "function") {
        return NextResponse.json(
          { ok: false, text: "", error: "Ses dosyası (file/audio) bulunamadı." },
          { status: 400 }
        );
      }
      if (file.size > MAX_BODY_BYTES) {
        return NextResponse.json(
          { ok: false, text: "", error: "Ses dosyası 2 MB sınırını aşıyor." },
          { status: 413 }
        );
      }
      const ab = await file.arrayBuffer();
      if (ab.byteLength > MAX_BODY_BYTES) {
        return NextResponse.json(
          { ok: false, text: "", error: "Ses dosyası 2 MB sınırını aşıyor." },
          { status: 413 }
        );
      }
      pcm16k = parseWavBufferToFloat32(ab);
    } else if (contentType.includes("application/json")) {
      const rawText = await req.text();
      if (!rawText || !rawText.trim()) {
        return NextResponse.json(
          { ok: false, text: "", error: "Boş JSON gövdesi gönderildi." },
          { status: 400 }
        );
      }
      if (new TextEncoder().encode(rawText).byteLength > MAX_BODY_BYTES) {
        return NextResponse.json(
          { ok: false, text: "", error: "JSON gövdesi 2 MB sınırını aşıyor." },
          { status: 413 }
        );
      }
      let body: { samples?: number[]; audioBase64?: string };
      try {
        body = JSON.parse(rawText) as {
          samples?: number[];
          audioBase64?: string;
        };
      } catch {
        return NextResponse.json(
          { ok: false, text: "", error: "Geçersiz JSON formatı." },
          { status: 400 }
        );
      }
      if (Array.isArray(body?.samples) && body.samples.length > 0) {
        if (body.samples.length > MAX_AUDIO_SAMPLES) {
          return NextResponse.json(
            {
              ok: false,
              text: "",
              error: "Ses örneği sayısı 30 saniye (480.000 örnek) sınırını aşıyor.",
            },
            { status: 413 }
          );
        }
        pcm16k = Float32Array.from(body.samples);
      } else if (typeof body?.audioBase64 === "string" && body.audioBase64.trim()) {
        const binary = Buffer.from(body.audioBase64, "base64");
        if (binary.byteLength > MAX_BODY_BYTES) {
          return NextResponse.json(
            { ok: false, text: "", error: "Ses verisi 2 MB sınırını aşıyor." },
            { status: 413 }
          );
        }
        const ab = binary.buffer.slice(
          binary.byteOffset,
          binary.byteOffset + binary.byteLength
        );
        pcm16k = parseWavBufferToFloat32(ab);
      } else {
        return NextResponse.json(
          {
            ok: false,
            text: "",
            error: "İstek gövdesinde geçerli 'samples' veya 'audioBase64' alanı bulunamadı.",
          },
          { status: 400 }
        );
      }
    } else {
      const ab = await req.arrayBuffer();
      if (!ab || ab.byteLength === 0) {
        return NextResponse.json(
          { ok: false, text: "", error: "Boş ses gövdesi gönderildi." },
          { status: 400 }
        );
      }
      if (ab.byteLength > MAX_BODY_BYTES) {
        return NextResponse.json(
          { ok: false, text: "", error: "Ses gövdesi 2 MB sınırını aşıyor." },
          { status: 413 }
        );
      }
      pcm16k = parseWavBufferToFloat32(ab);
    }

    if (pcm16k.length > MAX_AUDIO_SAMPLES) {
      pcm16k = pcm16k.slice(0, MAX_AUDIO_SAMPLES);
    }

    // Çok kısa (< 0.15s = 2400 örnek) veya boş ses kontrolü
    if (!pcm16k || pcm16k.length < 2400) {
      return NextResponse.json({ ok: true, text: "" });
    }

    // Tepe genliği normalizasyonu
    let maxAbs = 0;
    for (let i = 0; i < pcm16k.length; i++) {
      const abs = Math.abs(pcm16k[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    if (maxAbs < 0.002) {
      return NextResponse.json({ ok: true, text: "" });
    }
    if (maxAbs < 0.8) {
      const gain = 0.88 / maxAbs;
      const normalized = new Float32Array(pcm16k.length);
      for (let i = 0; i < pcm16k.length; i++) {
        normalized[i] = Math.max(-1, Math.min(1, pcm16k[i] * gain));
      }
      pcm16k = normalized;
    }

    const asr = await getServerTranscriber();
    const output = await asr(pcm16k, {
      language: "arabic",
      task: "transcribe",
      temperature: 0,
      chunk_length_s: 30,
      stride_length_s: 5,
      no_repeat_ngram_size: 3,
      repetition_penalty: 1.2,
      max_new_tokens: 100,
    });

    let recognizedText = (
      Array.isArray(output)
        ? output.map((o) => o.text || "").join(" ")
        : output?.text || ""
    ).trim();

    const hallucinationPatterns = [
      /اشتركوا في القناة/gi,
      /لا تنسوا الاشتراك/gi,
      /ترجمة نانسي قنقر/gi,
      /شكراً? للمشاهدة/gi,
      /ترجمة وتحرير/gi,
    ];
    for (const pat of hallucinationPatterns) {
      recognizedText = recognizedText.replace(pat, "").trim();
    }

    return NextResponse.json({ ok: true, text: recognizedText });
  } catch (err) {
    if (err instanceof UnsupportedWavFormatError) {
      return NextResponse.json(
        { ok: false, text: "", error: "Desteklenmeyen ses biçimi" },
        { status: 415 }
      );
    }
    const message =
      err instanceof Error ? err.message : "Sunucu STT çözümleme hatası";
    return NextResponse.json(
      { ok: false, text: "", error: message },
      { status: 503 }
    );
  }
}
