import test from "node:test";
import assert from "node:assert/strict";
import {
  SAFARI_DESKTOP_STAGE,
  SAFARI_PORTRAIT_STAGE,
  SAFARI_GOLDEN_SPAWN_CHANCE,
  SAFARI_GOLDEN_SCORE_MULTIPLIER,
  SAFARI_GOLDEN_SPEED_MULTIPLIER,
  computeSafariLevelFromRound,
  computeSafariWavePlacements,
  computeWrappedBalloonX,
  getSafariDifficultyBasePoints,
  getSafariComboMultiplier,
  computeSafariWordPopScore,
  computeSafariGoldenBonusScore,
  resolveSafariAtmosphere,
  getNextSafariAtmosphereMode,
} from "../src/lib/balloonSafariLayout";

test("Desktop (1120x620) wave placements spawn off-screen right using STAGE_W + 85 + (index * horizontalSpacing) + ((index % 2) * 26)", () => {
  for (const count of [2, 3, 4, 5]) {
    const slots = computeSafariWavePlacements({
      isPortraitMobile: false,
      count,
      baseSpeed: 126,
      roundNum: count,
    });
    assert.equal(slots.length, count);
    const firstSpeedX = slots[0]!.speedX;
    const firstSpeed = slots[0]!.speed;
    assert.equal(firstSpeedX, 126);
    assert.ok(Math.abs(firstSpeed - 126 / 60) < 1e-9);

    for (let index = 0; index < slots.length; index++) {
      const s = slots[index]!;
      assert.equal(s.speedX, firstSpeedX);
      assert.equal(s.speed, firstSpeed);
      assert.ok(
        s.baseY >= SAFARI_DESKTOP_STAGE.minY &&
          s.baseY <= SAFARI_DESKTOP_STAGE.maxY
      );
      const expectedStartX =
        SAFARI_DESKTOP_STAGE.width +
        85 +
        index * SAFARI_DESKTOP_STAGE.horizontalSpacing +
        (index % 2) * 26;
      assert.equal(s.x, expectedStartX);
      // Every balloon starts strictly outside the right edge of the 1120px stage
      assert.ok(s.x > SAFARI_DESKTOP_STAGE.width);
    }
  }
});

test("Portrait mobile (540x860) wave placements spawn off-screen right using PORTRAIT_STAGE_W + 70 + (index * horizontalSpacing) and keep >=210px spacing", () => {
  const slots3 = computeSafariWavePlacements({
    isPortraitMobile: true,
    count: 3,
    baseSpeed: 120,
    roundNum: 4,
  });
  assert.equal(slots3.length, 3);
  const firstSpeedX = slots3[0]!.speedX;
  const firstSpeed = slots3[0]!.speed;

  for (let index = 0; index < slots3.length; index++) {
    assert.equal(slots3[index]!.speedX, firstSpeedX);
    assert.equal(slots3[index]!.speed, firstSpeed);
    assert.ok(
      slots3[index]!.baseY >= SAFARI_PORTRAIT_STAGE.minY &&
        slots3[index]!.baseY <= SAFARI_PORTRAIT_STAGE.maxY
    );
    const expectedStartX =
      SAFARI_PORTRAIT_STAGE.width +
      70 +
      index * SAFARI_PORTRAIT_STAGE.horizontalSpacing;
    assert.equal(slots3[index]!.x, expectedStartX);
    assert.ok(slots3[index]!.x > SAFARI_PORTRAIT_STAGE.width);

    if (index > 0) {
      assert.equal(slots3[index]!.x - slots3[index - 1]!.x, 210);
      assert.ok(
        Math.abs(slots3[index]!.baseY - slots3[index - 1]!.baseY) >= 200,
        `Portrait 3-balloon adjacent vertical delta must be >= 200px, got ${Math.abs(
          slots3[index]!.baseY - slots3[index - 1]!.baseY
        )}`
      );
    }
  }

  // Simulate 30 seconds of flight using b.x -= b.speed * timeScale with wrap-around: no two balloons ever come closer than 210px horizontally
  let active = slots3.map((s, idx) => ({ id: idx, x: s.x, speed: s.speed }));
  const dt = 0.05;
  const timeScale = dt * 60;
  for (let step = 0; step < 600; step++) {
    active = active.map((b) => ({ ...b, x: b.x - b.speed * timeScale }));
    for (let i = 0; i < active.length; i++) {
      if (active[i]!.x < -125) {
        const others = active
          .filter((_, idx) => idx !== i && active[idx]!.x >= -125)
          .map((o) => o.x);
        active[i]!.x = computeWrappedBalloonX({
          isPortraitMobile: true,
          otherActiveBalloonXs: others,
        });
      }
    }
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        assert.ok(
          Math.abs(active[i]!.x - active[j]!.x) >= 209.9,
          `Collision risk at step ${step}: x1=${active[i]!.x}, x2=${active[j]!.x}`
        );
      }
    }
  }
});

test("game.js scoring, combo (>=3 & >=10), difficulty points (hard: 15, normal: 12), and golden balloon (15%, 5x, fast flow) rules", () => {
  assert.equal(getSafariDifficultyBasePoints("easy"), 12);
  assert.equal(getSafariDifficultyBasePoints("medium"), 12);
  assert.equal(getSafariDifficultyBasePoints("hard"), 15);

  assert.equal(getSafariComboMultiplier(1), 1);
  assert.equal(getSafariComboMultiplier(2), 1);
  assert.equal(getSafariComboMultiplier(3), 1.5);
  assert.equal(getSafariComboMultiplier(9), 1.5);
  assert.equal(getSafariComboMultiplier(10), 2);
  assert.equal(getSafariComboMultiplier(18), 2);

  const medCombo1 = computeSafariWordPopScore({
    difficultyMode: "medium",
    level: 1,
    combo: 1,
  });
  assert.equal(medCombo1.gainedPoints, 12);

  const hardCombo1 = computeSafariWordPopScore({
    difficultyMode: "hard",
    level: 1,
    combo: 1,
  });
  assert.equal(hardCombo1.gainedPoints, 15);

  const medCombo4 = computeSafariWordPopScore({
    difficultyMode: "medium",
    level: 1,
    combo: 4,
  });
  assert.equal(medCombo4.gainedPoints, 18);

  const hardCombo10 = computeSafariWordPopScore({
    difficultyMode: "hard",
    level: 1,
    combo: 10,
  });
  assert.equal(hardCombo10.gainedPoints, 30);

  assert.equal(SAFARI_GOLDEN_SPAWN_CHANCE, 0.15);
  assert.equal(SAFARI_GOLDEN_SCORE_MULTIPLIER, 5);
  assert.ok(SAFARI_GOLDEN_SPEED_MULTIPLIER > 1.3);
  assert.equal(
    computeSafariGoldenBonusScore({ difficultyMode: "medium", level: 1 }),
    60
  );
  assert.equal(
    computeSafariGoldenBonusScore({ difficultyMode: "hard", level: 1 }),
    75
  );
});

test("3-atmosphere resolution and cycle order work across levels and dark theme", () => {
  assert.equal(computeSafariLevelFromRound(1), 1);
  assert.equal(computeSafariLevelFromRound(5), 2);
  assert.equal(computeSafariLevelFromRound(9), 3);
  assert.equal(computeSafariLevelFromRound(15), 4);
  assert.equal(computeSafariLevelFromRound(19), 5);

  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 1, isDarkTheme: false }),
    "day"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 2, isDarkTheme: false }),
    "day"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 3, isDarkTheme: false }),
    "sunset"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 4, isDarkTheme: false }),
    "sunset"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 5, isDarkTheme: false }),
    "night"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 1, isDarkTheme: true }),
    "night"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "sunset", level: 1, isDarkTheme: true }),
    "sunset"
  );

  assert.equal(getNextSafariAtmosphereMode("auto"), "day");
  assert.equal(getNextSafariAtmosphereMode("day"), "sunset");
  assert.equal(getNextSafariAtmosphereMode("sunset"), "night");
  assert.equal(getNextSafariAtmosphereMode("night"), "auto");
});
