export function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hashStringSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function allocateExam100Points(
  countA: number,
  countB: number,
  countC: number
): {
  perQuestionA: number[];
  perQuestionB: number[];
  perQuestionC: number[];
  totalA: number;
  totalB: number;
  totalC: number;
  grandTotal: number;
} {
  const cA = Math.max(0, Math.floor(countA));
  const cB = Math.max(0, Math.floor(countB));
  const cC = Math.max(0, Math.floor(countC));
  if (cA + cB + cC === 0) {
    return {
      perQuestionA: [],
      perQuestionB: [],
      perQuestionC: [],
      totalA: 0,
      totalB: 0,
      totalC: 0,
      grandTotal: 0,
    };
  }

  const rawWeights = [cA > 0 ? 30 : 0, cB > 0 ? 40 : 0, cC > 0 ? 30 : 0];
  const weightSum = rawWeights[0] + rawWeights[1] + rawWeights[2];
  const exactShares = rawWeights.map((w) => (100 * w) / weightSum);
  const sectionTotals = exactShares.map((s) => Math.floor(s));
  let sectionRem =
    100 - (sectionTotals[0] + sectionTotals[1] + sectionTotals[2]);

  const orderByFrac = [0, 1, 2]
    .filter((idx) => rawWeights[idx] > 0)
    .sort(
      (i, j) =>
        exactShares[j] - sectionTotals[j] - (exactShares[i] - sectionTotals[i])
    );

  let cursor = 0;
  while (sectionRem > 0 && orderByFrac.length > 0) {
    const targetIdx = orderByFrac[cursor % orderByFrac.length];
    sectionTotals[targetIdx] += 1;
    sectionRem -= 1;
    cursor += 1;
  }

  const splitIntoIntegers = (sectionTotal: number, count: number): number[] => {
    if (count <= 0 || sectionTotal <= 0) return [];
    const base = Math.floor(sectionTotal / count);
    const rem = sectionTotal % count;
    return Array.from({ length: count }, (_, idx) =>
      idx < rem ? base + 1 : base
    );
  };

  const perQuestionA = splitIntoIntegers(sectionTotals[0], cA);
  const perQuestionB = splitIntoIntegers(sectionTotals[1], cB);
  const perQuestionC = splitIntoIntegers(sectionTotals[2], cC);

  const totalA = perQuestionA.reduce((s, n) => s + n, 0);
  const totalB = perQuestionB.reduce((s, n) => s + n, 0);
  const totalC = perQuestionC.reduce((s, n) => s + n, 0);

  return {
    perQuestionA,
    perQuestionB,
    perQuestionC,
    totalA,
    totalB,
    totalC,
    grandTotal: totalA + totalB + totalC,
  };
}

export interface SixSectionPointsAllocation {
  sectionTotals: [number, number, number, number, number, number];
  perQuestion: [number[], number[], number[], number[], number[], number[]];
  grandTotal: number;
  totalQuestions: number;
}

/**
 * 6 bölümlü A4 yazılı sınavda aktif (soru sayısı > 0) bölümlere toplam 100 puanı dağıtır.
 * Toplam soru sayısı <= 100 olduğunda her soruya en az 1 tam sayı puan garantisi verir.
 * Toplam soru sayısı > 100 olan çalışma yapraklarında bölüm toplamları yine tam 100 puan eder.
 */
export function allocateExam100PointsSixSections(
  counts: readonly [number, number, number, number, number, number]
): SixSectionPointsAllocation {
  const safeCounts = counts.map((n) => Math.max(0, Math.floor(n))) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const totalQuestions = safeCounts.reduce((acc, c) => acc + c, 0);
  if (totalQuestions === 0) {
    return {
      sectionTotals: [0, 0, 0, 0, 0, 0],
      perQuestion: [[], [], [], [], [], []],
      grandTotal: 0,
      totalQuestions: 0,
    };
  }

  const activeIndices = [0, 1, 2, 3, 4, 5].filter((i) => safeCounts[i] > 0);
  const sectionTotals: [number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0,
  ];

  if (totalQuestions <= 100) {
    // Önce her soruya 1 taban puan garanti et, kalan (100 - totalQuestions) puanı ağırlıklı dağıt
    const baseWeights = [1.0, 1.15, 1.1, 1.25, 0.9, 1.2];
    const weightedPool = safeCounts.map((c, idx) =>
      c > 0 ? c * baseWeights[idx] : 0
    );
    const weightSum = weightedPool.reduce((s, w) => s + w, 0);
    const remainingBudget = 100 - totalQuestions;

    const exactExtras = weightedPool.map((w) =>
      weightSum > 0 ? (remainingBudget * w) / weightSum : 0
    );
    const extraInts = exactExtras.map((e) => Math.floor(e));
    let rem =
      remainingBudget - extraInts.reduce((acc, val) => acc + val, 0);

    const byFrac = [...activeIndices].sort(
      (a, b) =>
        exactExtras[b] - extraInts[b] - (exactExtras[a] - extraInts[a])
    );

    let cursor = 0;
    while (rem > 0 && byFrac.length > 0) {
      const targetIdx = byFrac[cursor % byFrac.length];
      extraInts[targetIdx] += 1;
      rem -= 1;
      cursor += 1;
    }

    for (const idx of activeIndices) {
      sectionTotals[idx] = safeCounts[idx] + extraInts[idx];
    }
  } else {
    // Çok yüksek soru sayılı (ör. >100 soru) çalışma yaprağı modunda bölüm toplamlarını 100 puana tamamla
    const exactShares = safeCounts.map((c) => (100 * c) / totalQuestions);
    for (const idx of activeIndices) {
      sectionTotals[idx] = Math.max(1, Math.floor(exactShares[idx]));
    }
    let currentSum = sectionTotals.reduce((a, b) => a + b, 0);
    const byFracDesc = [...activeIndices].sort(
      (a, b) =>
        exactShares[b] -
        Math.floor(exactShares[b]) -
        (exactShares[a] - Math.floor(exactShares[a]))
    );
    let cursor = 0;
    while (currentSum < 100 && byFracDesc.length > 0) {
      const idx = byFracDesc[cursor % byFracDesc.length];
      sectionTotals[idx] += 1;
      currentSum += 1;
      cursor += 1;
    }
    while (currentSum > 100 && byFracDesc.length > 0) {
      const rev = [...byFracDesc].reverse();
      const idx = rev.find((i) => sectionTotals[i] > 1);
      if (idx === undefined) break;
      sectionTotals[idx] -= 1;
      currentSum -= 1;
    }
  }

  const splitQuestionPoints = (secTotal: number, count: number): number[] => {
    if (count <= 0 || secTotal <= 0) return [];
    if (secTotal >= count) {
      const base = Math.floor(secTotal / count);
      const rem = secTotal % count;
      return Array.from({ length: count }, (_, idx) =>
        idx < rem ? base + 1 : base
      );
    }
    // secTotal < count olduğunda (toplam soru > 100 durumu) kesirli puan (örn. 0.5p)
    const unit = Math.round((secTotal / count) * 10) / 10;
    return Array.from({ length: count }, () => Math.max(0.1, unit));
  };

  const perQuestion: [
    number[],
    number[],
    number[],
    number[],
    number[],
    number[],
  ] = [
    splitQuestionPoints(sectionTotals[0], safeCounts[0]),
    splitQuestionPoints(sectionTotals[1], safeCounts[1]),
    splitQuestionPoints(sectionTotals[2], safeCounts[2]),
    splitQuestionPoints(sectionTotals[3], safeCounts[3]),
    splitQuestionPoints(sectionTotals[4], safeCounts[4]),
    splitQuestionPoints(sectionTotals[5], safeCounts[5]),
  ];

  const grandTotal = sectionTotals.reduce((a, b) => a + b, 0);

  return {
    sectionTotals,
    perQuestion,
    grandTotal,
    totalQuestions,
  };
}
