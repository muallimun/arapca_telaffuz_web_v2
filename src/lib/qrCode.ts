// src/lib/qrCode.ts
// ISO/IEC 18004 Uyumlu Reed-Solomon QR Matris ve SVG Üretici (Sürüm 1–15, EC Level L, 520+ UTF-8 Bayt)
// URL veya metni ASLA kesmez (.slice() yapmaz); veri uzunluğuna göre en uygun QR sürümünü ve maskeyi seçer.

interface QrVersionSpec {
  version: number;
  ecPerBlock: number;
  dataBlockSizes: number[];
  alignmentCenters: number[];
}

const QR_VERSION_SPECS_L: QrVersionSpec[] = [
  { version: 1, ecPerBlock: 7, dataBlockSizes: [19], alignmentCenters: [] },
  { version: 2, ecPerBlock: 10, dataBlockSizes: [34], alignmentCenters: [6, 18] },
  { version: 3, ecPerBlock: 15, dataBlockSizes: [55], alignmentCenters: [6, 22] },
  { version: 4, ecPerBlock: 20, dataBlockSizes: [80], alignmentCenters: [6, 26] },
  { version: 5, ecPerBlock: 26, dataBlockSizes: [108], alignmentCenters: [6, 30] },
  { version: 6, ecPerBlock: 18, dataBlockSizes: [68, 68], alignmentCenters: [6, 34] },
  { version: 7, ecPerBlock: 20, dataBlockSizes: [78, 78], alignmentCenters: [6, 22, 38] },
  { version: 8, ecPerBlock: 24, dataBlockSizes: [97, 97], alignmentCenters: [6, 24, 42] },
  { version: 9, ecPerBlock: 30, dataBlockSizes: [116, 116], alignmentCenters: [6, 26, 46] },
  { version: 10, ecPerBlock: 18, dataBlockSizes: [68, 68, 69, 69], alignmentCenters: [6, 28, 50] },
  { version: 11, ecPerBlock: 20, dataBlockSizes: [81, 81, 81, 81], alignmentCenters: [6, 30, 54] },
  { version: 12, ecPerBlock: 24, dataBlockSizes: [92, 92, 93, 93], alignmentCenters: [6, 32, 58] },
  { version: 13, ecPerBlock: 26, dataBlockSizes: [107, 107, 107, 107], alignmentCenters: [6, 34, 62] },
  { version: 14, ecPerBlock: 30, dataBlockSizes: [115, 115, 115, 116], alignmentCenters: [6, 26, 46, 66] },
  { version: 15, ecPerBlock: 22, dataBlockSizes: [87, 87, 87, 87, 87, 88], alignmentCenters: [6, 26, 48, 70] },
];

const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function computeReedSolomonBlockEC(data: number[], ecCount: number): number[] {
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen = next;
  }

  const msg = [...data, ...new Array<number>(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

function selectSpecForPayload(byteLen: number): QrVersionSpec {
  for (const spec of QR_VERSION_SPECS_L) {
    const totalDataCodewords = spec.dataBlockSizes.reduce((s, n) => s + n, 0);
    // Byte mode: 4-bit mode (0100) + (8-bit length for V1-9, 16-bit length for V10+)
    const headerBits = spec.version <= 9 ? 12 : 20;
    const maxBytes = Math.floor((totalDataCodewords * 8 - headerBits) / 8);
    if (byteLen <= maxBytes) {
      return spec;
    }
  }
  throw new Error(
    `QR kod kapasitesi aşıldı (${byteLen} bayt > maksimum 520 bayt).`
  );
}

function computeFormatInfoBits(ecIndicator: number, maskPattern: number): number {
  const data = ((ecIndicator & 0b11) << 3) | (maskPattern & 0b111);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionInfoBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x1f25 << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function evaluateMaskFunction(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (r + c) % 2 === 0;
  }
}

function computePenaltyScore(grid: boolean[][]): number {
  const N = grid.length;
  let penalty = 0;

  // N1: 5+ ardışık aynı renk modül (yatay ve dikey)
  for (let r = 0; r < N; r++) {
    let runLen = 1;
    for (let c = 1; c < N; c++) {
      if (grid[r][c] === grid[r][c - 1]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let c = 0; c < N; c++) {
    let runLen = 1;
    for (let r = 1; r < N; r++) {
      if (grid[r][c] === grid[r - 1][c]) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // N2: 2x2 aynı renk bloklar
  for (let r = 0; r < N - 1; r++) {
    for (let c = 0; c < N - 1; c++) {
      const v = grid[r][c];
      if (
        grid[r][c + 1] === v &&
        grid[r + 1][c] === v &&
        grid[r + 1][c + 1] === v
      ) {
        penalty += 3;
      }
    }
  }

  // N4: Koyu modül oranı dengesi
  let darkCount = 0;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) darkCount++;
    }
  }
  const total = N * N;
  const pct = (darkCount * 100) / total;
  const fiveStep = Math.floor(Math.abs(pct - 50) / 5);
  penalty += fiveStep * 10;

  return penalty;
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Bytes = Array.from(new TextEncoder().encode(text || ""));
  const spec = selectSpecForPayload(utf8Bytes.length);
  const { version, ecPerBlock, dataBlockSizes, alignmentCenters } = spec;
  const N = 17 + 4 * version;
  const totalDataCodewords = dataBlockSizes.reduce((s, n) => s + n, 0);

  // 1. Veri bit akışını oluştur (Byte Mode = 0100, ASLA kesme/truncation yapma!)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4);
  pushBits(utf8Bytes.length, version <= 9 ? 8 : 16);
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  const maxDataBits = totalDataCodewords * 8;
  pushBits(0, Math.min(4, maxDataBits - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    dataBytes.push(b);
  }

  let padToggle = true;
  while (dataBytes.length < totalDataCodewords) {
    dataBytes.push(padToggle ? 0xec : 0x11);
    padToggle = !padToggle;
  }

  // 2. Bloklara ayır, her blok için Reed-Solomon EC üret ve blokları serpiştir (interleave)
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const blockSize of dataBlockSizes) {
    const block = dataBytes.slice(offset, offset + blockSize);
    offset += blockSize;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonBlockEC(block, ecPerBlock));
  }

  const interleavedCodewords: number[] = [];
  const maxBlockDataLen = Math.max(...dataBlockSizes);
  for (let col = 0; col < maxBlockDataLen; col++) {
    for (const block of dataBlocks) {
      if (col < block.length) {
        interleavedCodewords.push(block[col]);
      }
    }
  }
  for (let col = 0; col < ecPerBlock; col++) {
    for (const ec of ecBlocks) {
      interleavedCodewords.push(ec[col]);
    }
  }

  const fullBits: number[] = [];
  for (const cw of interleavedCodewords) {
    for (let i = 7; i >= 0; i--) {
      fullBits.push((cw >> i) & 1);
    }
  }

  const remainderBits =
    version >= 2 && version <= 6 ? 7 : version >= 14 && version <= 15 ? 3 : 0;
  for (let i = 0; i < remainderBits; i++) {
    fullBits.push(0);
  }

  // 3. Sabit fonksiyon desenlerini yerleştir
  const baseGrid: boolean[][] = Array.from({ length: N }, () =>
    Array<boolean>(N).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: N }, () =>
    Array<boolean>(N).fill(false)
  );

  const placeFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N) {
          reserved[rr][cc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            baseGrid[rr][cc] = isBorder || isInner;
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  for (const cr of alignmentCenters) {
    for (const cc of alignmentCenters) {
      const overlapsFinder =
        (cr === 6 && cc === 6) ||
        (cr === 6 && cc === N - 7) ||
        (cr === N - 7 && cc === 6);
      if (overlapsFinder) continue;

      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = cr + dr;
          const col = cc + dc;
          reserved[rr][col] = true;
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          baseGrid[rr][col] = isBorder || isCenter;
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    if (!reserved[6][i]) {
      reserved[6][i] = true;
      baseGrid[6][i] = i % 2 === 0;
    }
    if (!reserved[i][6]) {
      reserved[i][6] = true;
      baseGrid[i][6] = i % 2 === 0;
    }
  }

  // Format info & Dark Module rezervasyonu
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][N - 1 - i] = true;
    reserved[N - 1 - i][8] = true;
  }
  baseGrid[N - 8][8] = true;

  // Version 7+ için 18-bit Version Info blokları
  if (version >= 7) {
    const vBits = computeVersionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + N - 11;
      reserved[a][b] = true;
      baseGrid[a][b] = bit;
      reserved[b][a] = true;
      baseGrid[b][a] = bit;
    }
  }

  // 4. 8 maske adayını dene ve en düşük ceza puanlı matrisi seç
  let bestGrid: boolean[][] | null = null;
  let bestPenalty = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseGrid.map((row) => [...row]);
    let bitIdx = 0;
    let upward = true;

    for (let col = N - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < N; step++) {
        const r = upward ? N - 1 - step : step;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          if (!reserved[r][c]) {
            const dataBit =
              bitIdx < fullBits.length ? fullBits[bitIdx] === 1 : false;
            bitIdx++;
            const invert = evaluateMaskFunction(mask, r, c);
            candidate[r][c] = dataBit !== invert;
          }
        }
      }
      upward = !upward;
    }

    // EC Level L format indicator = 0b01
    const formatBits = computeFormatInfoBits(0b01, mask);
    const fBit = (idx: number) => ((formatBits >> idx) & 1) === 1;

    // Sol-üst format bitleri (MSB=14 .. LSB=0)
    for (let i = 0; i <= 5; i++) candidate[8][i] = fBit(14 - i);
    candidate[8][7] = fBit(8);
    candidate[8][8] = fBit(7);
    candidate[7][8] = fBit(6);
    for (let i = 0; i <= 5; i++) candidate[5 - i][8] = fBit(5 - i);

    // Sağ-üst ve sol-alt format bitleri
    for (let i = 0; i <= 7; i++) candidate[8][N - 1 - i] = fBit(i);
    for (let i = 0; i <= 6; i++) candidate[N - 7 + i][8] = fBit(14 - i);

    const score = computePenaltyScore(candidate);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestGrid = candidate;
    }
  }

  return bestGrid || baseGrid;
}

export function generateQrSvg(
  text: string,
  size = 148,
  options?: { borderColor?: string; borderRadiusPx?: number; quietZone?: number }
): string {
  const grid = generateQrMatrix(text);
  const N = grid.length;
  const quietZone = options?.quietZone ?? 3;
  const borderColor = options?.borderColor ?? "#cbd5e1";
  const borderRadius = options?.borderRadiusPx ?? 12;
  const totalView = N + quietZone * 2;

  const rects: string[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (grid[r][c]) {
        rects.push(
          `<rect x="${c + quietZone}" y="${
            r + quietZone
          }" width="1" height="1" fill="#0f172a" />`
        );
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalView} ${totalView}" width="${size}" height="${size}" shape-rendering="crispEdges" style="display:block;background:#ffffff;border:2px solid ${borderColor};border-radius:${borderRadius}px;">${rects.join(
    ""
  )}</svg>`;
}
