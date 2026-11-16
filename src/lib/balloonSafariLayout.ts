export type SafariAtmosphereMode = "auto" | "day" | "sunset" | "night";
export type ResolvedSafariAtmosphere = "day" | "sunset" | "night";
export type SafariStageLevel = 1 | 2 | 3 | 4 | 5;
export type SafariScoreDifficulty = "easy" | "medium" | "hard";

export const SAFARI_DESKTOP_STAGE = {
  width: 1120,
  height: 620,
  minY: 165,
  maxY: 415,
  horizontalSpacing: 235,
  firstSpawnOffset: 85,
} as const;

export const SAFARI_PORTRAIT_STAGE = {
  width: 540,
  height: 860,
  minY: 185,
  maxY: 610,
  horizontalSpacing: 210,
  firstSpawnOffset: 70,
} as const;

export const SAFARI_GOLDEN_SPAWN_CHANCE = 0.15;
export const SAFARI_GOLDEN_SCORE_MULTIPLIER = 5;
export const SAFARI_GOLDEN_SPEED_MULTIPLIER = 1.42;

export function computeSafariLevelFromRound(roundNum: number): SafariStageLevel {
  if (roundNum <= 3) return 1;
  if (roundNum <= 7) return 2;
  if (roundNum <= 12) return 3;
  if (roundNum <= 17) return 4;
  return 5;
}

export function getSafariBalloonCountForLevel(level: SafariStageLevel): number {
  if (level === 1) return 2;
  if (level === 2) return 3;
  if (level === 3) return 4;
  return 5;
}

/**
 * game.js motoru puanlama ve seri (combo) çarpanı hesabı:
 * - Zorluk taban puanı: difficultyMode === 'hard' ? 15 : 12
 * - Seviye katkısı: (level - 1) * 3
 * - Seri çarpanı: combo >= 10 -> 2x, combo >= 3 -> 1.5x, aksi halde 1x
 */
export function getSafariDifficultyBasePoints(
  difficultyMode: SafariScoreDifficulty
): number {
  return difficultyMode === "hard" ? 15 : 12;
}

export function getSafariComboMultiplier(combo: number): number {
  if (combo >= 10) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export function computeSafariWordPopScore(params: {
  difficultyMode: SafariScoreDifficulty;
  level: SafariStageLevel;
  combo: number;
}): {
  basePoints: number;
  comboMultiplier: number;
  gainedPoints: number;
} {
  const basePoints =
    getSafariDifficultyBasePoints(params.difficultyMode) +
    (params.level - 1) * 3;
  const comboMultiplier = getSafariComboMultiplier(params.combo);
  const gainedPoints = Math.round(basePoints * comboMultiplier);
  return {
    basePoints,
    comboMultiplier,
    gainedPoints,
  };
}

export function computeSafariGoldenBonusScore(params: {
  difficultyMode: SafariScoreDifficulty;
  level: SafariStageLevel;
}): number {
  const basePoints =
    getSafariDifficultyBasePoints(params.difficultyMode) +
    (params.level - 1) * 3;
  return basePoints * SAFARI_GOLDEN_SCORE_MULTIPLIER;
}

export function resolveSafariAtmosphere(params: {
  mode: SafariAtmosphereMode;
  level: SafariStageLevel;
  isDarkTheme: boolean;
}): ResolvedSafariAtmosphere {
  const { mode, level, isDarkTheme } = params;
  if (mode !== "auto") return mode;
  if (isDarkTheme || level >= 5) return "night";
  if (level >= 3) return "sunset";
  return "day";
}

export function getNextSafariAtmosphereMode(
  current: SafariAtmosphereMode
): SafariAtmosphereMode {
  if (current === "auto") return "day";
  if (current === "day") return "sunset";
  if (current === "sunset") return "night";
  return "auto";
}

/**
 * Ardışık iki balonun dikeyde birbirine olabildiğince uzak şeritlere
 * yerleşmesini sağlayan deterministik kademeli zikzak (staggered) sıra üretir.
 */
export function buildStaggeredLaneOrder(
  count: number,
  invertParity = false
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count === 2) return invertParity ? [1, 0] : [0, 1];
  if (count === 3) return invertParity ? [2, 0, 1] : [0, 2, 1];
  if (count === 4) return invertParity ? [2, 0, 3, 1] : [1, 3, 0, 2];

  // 5 ve üzeri için alt-üst yarım düzlemleri fermuar gibi (interleaved) dağıt: [0, 3, 1, 4, 2]
  const half = Math.ceil(count / 2);
  const order: number[] = [];
  for (let i = 0; i < half; i++) {
    order.push(i);
    if (i + half < count) {
      order.push(i + half);
    }
  }
  return invertParity ? [...order].reverse() : order;
}

export interface WaveSlotPlacement {
  x: number;
  baseY: number;
  speedX: number;
  speed: number;
}

export interface WaveLayoutConfig {
  isPortraitMobile: boolean;
  count: number;
  baseSpeed: number;
  roundNum: number;
}

/**
 * game.js motoruna uygun olarak balonları ekranın sağ dışarısından dizi halinde başlatır:
 * - Masaüstü (1120x620): startX = STAGE_W + 85 + (index * horizontalSpacing) + ((index % 2) * 26)
 * - Dikey Mobil (540x860): startX = PORTRAIT_STAGE_W + 70 + (index * horizontalSpacing)
 */
export function computeSafariWavePlacements(
  config: WaveLayoutConfig
): WaveSlotPlacement[] {
  const { isPortraitMobile, count, baseSpeed, roundNum } = config;
  if (count <= 0) return [];

  const stage = isPortraitMobile ? SAFARI_PORTRAIT_STAGE : SAFARI_DESKTOP_STAGE;
  const speedScale = isPortraitMobile ? 0.78 : 1;
  const uniformSpeedX = baseSpeed * speedScale;
  const uniformFrameSpeed = uniformSpeedX / 60;

  // 2 balon varken şeritleri biraz içeriden al, 3+ balon varken tam [minY, maxY] aralığını kullan
  const effectiveMinY =
    count === 2 ? stage.minY + (isPortraitMobile ? 35 : 20) : stage.minY;
  const effectiveMaxY =
    count === 2 ? stage.maxY - (isPortraitMobile ? 35 : 20) : stage.maxY;

  const evenlySpacedLanes: number[] = Array.from({ length: count }, (_, idx) =>
    count === 1
      ? (effectiveMinY + effectiveMaxY) / 2
      : effectiveMinY +
        (idx * (effectiveMaxY - effectiveMinY)) / (count - 1)
  );

  const zigzagIndices = buildStaggeredLaneOrder(count, roundNum % 2 === 0);

  return Array.from({ length: count }, (_, index) => {
    const laneIdx = zigzagIndices[index] ?? index;
    const baseY = Math.round(evenlySpacedLanes[laneIdx] ?? stage.minY);
    const startX = isPortraitMobile
      ? stage.width + 70 + index * stage.horizontalSpacing
      : stage.width +
        85 +
        index * stage.horizontalSpacing +
        (index % 2) * 26;
    return {
      x: startX,
      baseY,
      speedX: uniformSpeedX,
      speed: uniformFrameSpeed,
    };
  });
}

/**
 * Sol kenardan çıkan balonun sağdan tekrar girerken sahnedeki en sağdaki balonla
 * arasındaki minimum yatay mesafeyi (horizontalSpacing) korumasını sağlar.
 */
export function computeWrappedBalloonX(params: {
  isPortraitMobile: boolean;
  otherActiveBalloonXs: readonly number[];
}): number {
  const stage = params.isPortraitMobile
    ? SAFARI_PORTRAIT_STAGE
    : SAFARI_DESKTOP_STAGE;
  const minRightEntry = stage.width + stage.firstSpawnOffset;
  if (params.otherActiveBalloonXs.length === 0) {
    return minRightEntry;
  }
  const maxOtherX = Math.max(...params.otherActiveBalloonXs);
  return Math.max(minRightEntry, maxOtherX + stage.horizontalSpacing);
}
