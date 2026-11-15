import test from "node:test";
import assert from "node:assert/strict";
import {
  SAFARI_DESKTOP_STAGE,
  SAFARI_PORTRAIT_STAGE,
  computeSafariLevelFromRound,
  computeSafariWavePlacements,
  computeWrappedBalloonX,
  resolveSafariAtmosphere,
  getNextSafariAtmosphereMode,
} from "../src/lib/balloonSafariLayout";

test("Desktop (1120x620) wave placements share uniform speedX, minY=165..maxY=415, and 235px horizontal spacing", () => {
  for (const count of [2, 3, 4, 5]) {
    const slots = computeSafariWavePlacements({
      isPortraitMobile: false,
      count,
      baseSpeed: 80,
      roundNum: count,
    });
    assert.equal(slots.length, count);
    const firstSpeed = slots[0]!.speedX;
    assert.equal(firstSpeed, 80);

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]!;
      assert.equal(s.speedX, firstSpeed);
      assert.ok(s.baseY >= SAFARI_DESKTOP_STAGE.minY && s.baseY <= SAFARI_DESKTOP_STAGE.maxY);
      if (i > 0) {
        assert.equal(s.x - slots[i - 1]!.x, 235);
      }
      // Every balloon whose left edge enters the 1120px stage at t=0 must fit 100% inside [0, 1120] without right-edge half-clipping
      if (s.x - 92 < SAFARI_DESKTOP_STAGE.width) {
        assert.ok(s.x - 92 >= 0 && s.x + 92 <= SAFARI_DESKTOP_STAGE.width);
      }
    }
  }
});

test("Portrait mobile (540x860) wave placements share uniform speedX, minY=185..maxY=610, >=200px vertical diff for 3 balloons, 210px horizontal spacing, and zero right-edge clipping at t=0", () => {
  const slots3 = computeSafariWavePlacements({
    isPortraitMobile: true,
    count: 3,
    baseSpeed: 80,
    roundNum: 4,
  });
  assert.equal(slots3.length, 3);
  const firstSpeed = slots3[0]!.speedX;
  for (let i = 0; i < slots3.length; i++) {
    assert.equal(slots3[i]!.speedX, firstSpeed);
    assert.ok(
      slots3[i]!.baseY >= SAFARI_PORTRAIT_STAGE.minY &&
        slots3[i]!.baseY <= SAFARI_PORTRAIT_STAGE.maxY
    );
    if (slots3[i]!.x - 92 < SAFARI_PORTRAIT_STAGE.width) {
      assert.ok(
        slots3[i]!.x - 92 >= 0 &&
          slots3[i]!.x + 92 <= SAFARI_PORTRAIT_STAGE.width,
        `Portrait balloon ${i} at x=${slots3[i]!.x} must not be clipped at right edge (540)`
      );
    }
    if (i > 0) {
      assert.equal(slots3[i]!.x - slots3[i - 1]!.x, 210);
      assert.ok(
        Math.abs(slots3[i]!.baseY - slots3[i - 1]!.baseY) >= 200,
        `Portrait 3-balloon adjacent vertical delta must be >= 200px, got ${Math.abs(
          slots3[i]!.baseY - slots3[i - 1]!.baseY
        )}`
      );
    }
  }

  // Simulate 30 seconds of flight with wrap-around: no two balloons ever come closer than 210px horizontally
  let active = slots3.map((s, idx) => ({ id: idx, x: s.x, speedX: s.speedX }));
  const dt = 0.05;
  for (let step = 0; step < 600; step++) {
    active = active.map((b) => ({ ...b, x: b.x - b.speedX * dt }));
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
