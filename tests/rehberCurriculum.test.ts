import test from "node:test";
import assert from "node:assert/strict";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import {
  build24WeekCurriculum,
  computeCurriculumProgress,
  getDynamicKttTopicCount,
} from "@/lib/rehberCurriculum";

test("24 Haftalık Müfredat (build24WeekCurriculum) 120 Diyalog ve 60 Okuma Metnini kayıpsız eşleştirir", () => {
  const weeks = build24WeekCurriculum();
  assert.equal(weeks.length, 24, "Toplam 24 hafta üretilmelidir");

  const levelWeekCounts = { A1: 0, A2: 0, B1: 0, B2: 0 };
  const dialogueIds = new Set<string>();
  const readingIds = new Set<string>();
  const kttTopicsSeen = new Set<string>();

  let visualSum = 0;
  let sentenceSum = 0;
  let proverbSum = 0;

  for (const w of weeks) {
    levelWeekCounts[w.level] += 1;
    assert.equal(
      w.dialogues.length,
      5,
      `${w.weekNumber}. haftada tam 5 diyalog yer almalıdır`
    );
    assert.ok(
      w.readings.length >= 1 && w.readings.length <= 4,
      `${w.weekNumber}. haftada 1–4 okuma metni yer almalıdır`
    );

    w.dialogues.forEach((d, idx) => {
      const expectedSeq = (w.weekNumber - 1) * 5 + idx + 1;
      assert.equal(d.seviye, w.level);
      assert.equal(d.codeLabel, `Diyalog ${expectedSeq}`);
      assert.equal(d.href, `/diyalog/${d.id}`);
      assert.ok(d.id.startsWith("dlg_"));
      dialogueIds.add(d.id);
    });
    for (const r of w.readings) {
      assert.equal(r.seviye, w.level);
      assert.ok(r.href.startsWith("/metin/metin_"));
      readingIds.add(r.id);
    }
    for (const k of w.kttTopics) {
      assert.ok(k.href.startsWith("/seviye-tespit?mode=topic&topic="));
      kttTopicsSeen.add(k.ustKonu);
    }

    visualSum += w.visualWordsQuota;
    sentenceSum += w.sentencesQuota;
    proverbSum += w.proverbsQuota;
  }

  assert.deepEqual(levelWeekCounts, { A1: 6, A2: 6, B1: 6, B2: 6 });
  assert.equal(dialogueIds.size, CONTENT_INVENTORY.dialoguesCount);
  assert.equal(readingIds.size, CONTENT_INVENTORY.readingsCount);
  assert.equal(visualSum, CONTENT_INVENTORY.visualWordsCount);
  assert.equal(sentenceSum, CONTENT_INVENTORY.sentencesCount);
  assert.equal(proverbSum, CONTENT_INVENTORY.proverbsCount);
  assert.equal(kttTopicsSeen.size, getDynamicKttTopicCount());

  // 6, 12, 18, 24. haftalarda Kur Bitirme sınavı bulunmalı
  assert.equal(weeks[5].milestoneExam?.level, "A1");
  assert.equal(weeks[11].milestoneExam?.level, "A2");
  assert.equal(weeks[17].milestoneExam?.level, "B1");
  assert.equal(weeks[23].milestoneExam?.level, "B2");
  assert.equal(weeks[0].milestoneExam, null);
});

test("computeCurriculumProgress completedDialogues ve completedReadings verilerini canlı birleştirir", () => {
  const weeks = build24WeekCurriculum();
  const week1 = weeks[0];

  const allWeek1DialogueIds = week1.dialogues.map((d) => d.id);
  const allWeek1ReadingIds = week1.readings.map((r) => r.id);

  // Diyaloglar completedDialogues'tan, okuma metinleri completedReadings'ten geldiğinde 1. hafta %100 olmalı
  const summary = computeCurriculumProgress(
    weeks,
    allWeek1DialogueIds,
    allWeek1ReadingIds,
    ["A1"]
  );

  assert.equal(summary.byWeek[1].isWeekCompleted, true);
  assert.equal(summary.byWeek[1].percent, 100);
  assert.equal(summary.completedDialoguesTotal, 5);
  assert.equal(summary.completedReadingsTotal, allWeek1ReadingIds.length);
  assert.equal(
    summary.completedUnitsTotal,
    5 + allWeek1ReadingIds.length
  );
  assert.equal(summary.byLevel.A1.examCompleted, true);
  assert.equal(summary.byLevel.A2.examCompleted, false);
});
