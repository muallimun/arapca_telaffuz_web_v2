import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "src", "data");

const ALL_JSON_FILES = [
  "1111_cumle.json",
  "atasozleri.json",
  "gorselKelimeler_guncel.json",
  "yeni_tum_sozluk.json",
  "tum_diyaloglar_120.json",
  "tum_metinler_60.json",
  "diyaloglar_gramer_hap_bilgi.json",
  "metinler_gramer_hap_bilgi.json",
];

function readDataJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  return { raw, parsed: JSON.parse(raw) };
}

function collectStrings(node, out = []) {
  if (typeof node === "string") {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
  } else if (node && typeof node === "object") {
    for (const val of Object.values(node)) collectStrings(val, out);
  }
  return out;
}

test("1. Tüm 8 JSON dosyası hatasız parse edilir, 0 tatweel (\\u0640) içerir ve %100 NFC kanonik formdadır", () => {
  for (const fileName of ALL_JSON_FILES) {
    const { raw, parsed } = readDataJson(fileName);
    assert.ok(Array.isArray(parsed), `${fileName} kök düzeyde bir dizi olmalıdır`);
    assert.ok(parsed.length > 0, `${fileName} boş olmamalıdır`);

    assert.equal(
      raw.includes("\u0640"),
      false,
      `${fileName} içinde tatweel (\\u0640) bulunmamalıdır`
    );

    assert.equal(
      raw.includes("ə") || raw.includes("Ə"),
      false,
      `${fileName} içinde bozuk 'ə' karakteri bulunmamalıdır`
    );

    const strings = collectStrings(parsed);
    for (const str of strings) {
      assert.equal(
        str,
        str.normalize("NFC"),
        `${fileName} içinde NFC formunda olmayan metin bulundu: ${str.slice(0, 40)}`
      );
    }
  }
});

test("2. Sözlük, Diyalog, Metin, 1111 Cümle, Atasözü ve Görsel Kelime dosyalarında mükerrer ID yoktur", () => {
  const expectedCounts = [
    ["yeni_tum_sozluk.json", 1895],
    ["tum_diyaloglar_120.json", 120],
    ["tum_metinler_60.json", 60],
    ["1111_cumle.json", 1111],
    ["atasozleri.json", 508],
    ["gorselKelimeler_guncel.json", 998],
  ];

  for (const [fileName, expectedLength] of expectedCounts) {
    const { parsed } = readDataJson(fileName);
    assert.equal(
      parsed.length,
      expectedLength,
      `${fileName} kayıt sayısı ${expectedLength} olmalıdır`
    );

    const seenIds = new Set();
    const duplicates = [];
    for (const item of parsed) {
      assert.ok(
        typeof item.id === "string" && item.id.trim().length > 0,
        `${fileName} içindeki her kaydın geçerli bir 'id' alanı olmalıdır`
      );
      if (seenIds.has(item.id)) {
        duplicates.push(item.id);
      }
      seenIds.add(item.id);
    }

    assert.deepEqual(
      duplicates,
      [],
      `${fileName} içinde mükerrer ID bulunmamalıdır (bulunan: ${duplicates.join(", ")})`
    );
  }
});

test("3. 120/120 diyalog gramer, 60/60 metin gramer ve 180/180 ayrintili_anlatim ile yanlis !== dogru kuralı tamdır", () => {
  const { parsed: diyaloglar } = readDataJson("tum_diyaloglar_120.json");
  const { parsed: metinler } = readDataJson("tum_metinler_60.json");
  const { parsed: dlgGramer } = readDataJson("diyaloglar_gramer_hap_bilgi.json");
  const { parsed: metinGramer } = readDataJson("metinler_gramer_hap_bilgi.json");

  assert.equal(dlgGramer.length, 120, "120 diyalog gramer notu bulunmalıdır");
  assert.equal(metinGramer.length, 60, "60 metin gramer notu bulunmalıdır");

  const dlgGramerIds = new Set(dlgGramer.map((g) => g.bagli_id));
  for (const d of diyaloglar) {
    assert.ok(
      dlgGramerIds.has(d.id),
      `${d.id} diyaloğu için gramer hap bilgi kaydı eksik`
    );
  }

  const metinGramerIds = new Set(metinGramer.map((g) => g.bagli_id));
  for (const m of metinler) {
    assert.ok(
      metinGramerIds.has(m.id),
      `${m.id} okuma metni için gramer hap bilgi kaydı eksik`
    );
  }

  const allGrammar = [...dlgGramer, ...metinGramer];
  assert.equal(allGrammar.length, 180, "Toplam gramer kaydı 180 olmalıdır");

  for (const g of allGrammar) {
    const aa = g.ayrintili_anlatim;
    assert.ok(aa, `${g.bagli_id} içinde 'ayrintili_anlatim' bulunmalıdır`);
    assert.ok(
      typeof aa.formul_sema === "string" && aa.formul_sema.trim().length > 0,
      `${g.bagli_id} içinde 'formul_sema' dolu olmalıdır`
    );
    assert.ok(
      Array.isArray(aa.adim_adim_anlatim) && aa.adim_adim_anlatim.length >= 2,
      `${g.bagli_id} içinde 'adim_adim_anlatim' en az 2 adım içermelidir`
    );
    assert.ok(
      aa.ozet_tablo &&
        Array.isArray(aa.ozet_tablo.sutunlar) &&
        Array.isArray(aa.ozet_tablo.satirlar) &&
        aa.ozet_tablo.satirlar.length > 0,
      `${g.bagli_id} içinde 'ozet_tablo' geçerli olmalıdır`
    );
    assert.ok(
      Array.isArray(aa.irab_tahlili) && aa.irab_tahlili.length >= 2,
      `${g.bagli_id} içinde 'irab_tahlili' en az 2 öge içermelidir`
    );
    assert.ok(
      aa.dikkat_sik_hata &&
        typeof aa.dikkat_sik_hata.yanlis === "string" &&
        typeof aa.dikkat_sik_hata.dogru === "string",
      `${g.bagli_id} içinde 'dikkat_sik_hata' bulunmalıdır`
    );
    assert.notEqual(
      aa.dikkat_sik_hata.yanlis.trim(),
      aa.dikkat_sik_hata.dogru.trim(),
      `${g.bagli_id} içinde 'dikkat_sik_hata.yanlis' ile 'dogru' aynı olmamalıdır`
    );
  }

  // Somut filolojik düzeltmelerin regresyon kontrolü
  const dlg119 = dlgGramer.find((g) => g.bagli_id === "dlg_119");
  assert.equal(
    JSON.stringify(dlg119).includes("INS"),
    false,
    "dlg_119 içinde Latin 'INS' dizgesi kalmamalıdır"
  );

  const dlg007 = diyaloglar.find((d) => d.id === "dlg_007");
  const line5 = dlg007.satirlar.find((s) => s.sira === 5);
  assert.equal(
    line5.arapca,
    "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ.".normalize("NFC"),
    "dlg_007 5. satır hemze-i vasıl ve sıra sayısıyla düzeltilmiş olmalıdır"
  );

  const dlg020 = diyaloglar.find((d) => d.id === "dlg_020");
  assert.equal(
    JSON.stringify(dlg020).includes("تَنْصَحِينَنِي".normalize("NFC")),
    true,
    "dlg_020 içinde sükûnlu 'تَنْصَحِينَنِي' bulunmalıdır"
  );

  const metin27 = metinGramer.find((g) => g.bagli_id === "metin_27");
  assert.equal(
    metin27.ayrintili_anlatim.ozet_tablo.sutunlar[2],
    "Tamamlayıcı Öge (Muzâfun İleyh / Câr-Mecrûr)",
    "metin_27 3. sütun başlığı güncellenmiş olmalıdır"
  );
});

test("4. Admin sabit şifresi kaldırılmış, API güvenlik kilitleri ve PWA orientation 'any' aktiftir", () => {
  const adminPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "admin", "page.tsx"),
    "utf8"
  );
  assert.equal(
    adminPageCode.includes("muallimun-admin-2026"),
    false,
    "src/app/admin/page.tsx içinde sabit 'muallimun-admin-2026' şifresi bulunmamalıdır"
  );
  assert.equal(
    adminPageCode.includes("sessionStorage"),
    true,
    "Admin token sessionStorage üzerinde tutulmalıdır"
  );

  const adminApiCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  assert.equal(
    adminApiCode.includes("verifyAdminWriteAccess"),
    true,
    "/api/admin içinde verifyAdminWriteAccess bulunmalıdır"
  );
  assert.equal(
    adminApiCode.includes("validateSafeMediaPath"),
    true,
    "/api/admin içinde validateSafeMediaPath (path traversal koruması) bulunmalıdır"
  );

  const statsApiCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stats", "route.ts"),
    "utf8"
  );
  assert.equal(
    statsApiCode.includes("clientKnownTotalUsers"),
    false,
    "/api/stats istemciden gelen sayaç şişirme değerlerine güvenmemelidir"
  );

  const manifestCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "manifest.ts"),
    "utf8"
  );
  assert.equal(
    manifestCode.includes('orientation: "any"'),
    true,
    "PWA manifest orientation 'any' olmalıdır"
  );
});

// --- FAZ 2 Regresyon Testleri İçin Hafif TypeScript + @/ Alias Yükleyici ---
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function resolveCandidateFile(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.json`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.js"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return c;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/dynamic") {
      return nextResolve("next/dynamic.js", context);
    }
    if (specifier.startsWith("@/")) {
      const target = resolveCandidateFile(
        path.join(ROOT_DIR, "src", specifier.slice(2))
      );
      if (target) {
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const target = resolveCandidateFile(path.resolve(parentDir, specifier));
      if (target) {
        return { url: pathToFileURL(target).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:")) {
      const filePath = fileURLToPath(url);
      if (filePath.endsWith(".json")) {
        const rawJson = fs.readFileSync(filePath, "utf8");
        return {
          format: "module",
          source: `export default ${rawJson};`,
          shortCircuit: true,
        };
      }
      if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
        const rawTs = fs.readFileSync(filePath, "utf8");
        const transpiled = ts.transpileModule(rawTs, {
          fileName: filePath,
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
            esModuleInterop: true,
          },
        });
        return {
          format: "module",
          source: transpiled.outputText,
          shortCircuit: true,
        };
      }
    }
    return nextLoad(url, context);
  },
});

test("5. FAZ 2 — Mahreç çiftleri (ق/ك، س/ص), vakıf (ة/ه), kelime sırası hizalaması, dürüst hareke onayı ve illetli kökler", async () => {
  const { matchArabicPronunciation } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "universalStt.ts")).href
  );
  const { evaluateSentenceWords, extractArabicRoot } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicNlpEngine.ts")).href
  );

  // Kritik mahreç karışıklıkları reddedilmeli
  const qalbVsKalb = matchArabicPronunciation("قَلْبٌ", ["كلب"]);
  assert.equal(
    qalbVsKalb.isMatch,
    false,
    "قَلْبٌ yerine كلب okunması yanlış-pozitif olarak kabul edilmemelidir"
  );
  assert.equal(qalbVsKalb.errorType, "makhraj");

  const saraVsSwara = matchArabicPronunciation("سار", ["صار"]);
  assert.equal(
    saraVsSwara.isMatch,
    false,
    "سار yerine صار okunması mahreç hatası olarak reddedilmelidir"
  );

  // Vakıf halinde ة -> ه dönüşümü korunmalı
  const waqfRes = matchArabicPronunciation("مَدْرَسَةٌ", ["مدرسه"]);
  assert.equal(
    waqfRes.isMatch,
    true,
    "Vakıf halinde ة -> ه (مَدْرَسَةٌ -> مدرسه) kabul edilmelidir"
  );

  // Ters kelime sırasıyla okunan cümle %100 veya geçerli eşleşme sayılmamalı
  const reversedSentence = matchArabicPronunciation(
    "ذَهَبَ عَلِيٌّ إِلَى الْبَيْتِ",
    ["البيت إلى علي ذهب"]
  );
  assert.equal(reversedSentence.isExact100, false);
  assert.equal(
    reversedSentence.isMatch,
    false,
    "Ters kelime sırasıyla okunan cümle eşleşmiş sayılmamalıdır"
  );

  // Harekesiz STT çıktısında hareke doğrulanmış (diacriticsVerified: true) iddia edilmemeli
  const unvocalizedSttEval = evaluateSentenceWords(
    "ذَهَبَ الطَّالِبُ",
    "ذهب الطالب"
  );
  assert.equal(
    unvocalizedSttEval.words.every((w) => w.diacriticsVerified === false),
    true,
    "Harekesiz STT çıktısında diacriticsVerified: false olmalıdır"
  );

  // İlletli kökler korunmalı
  assert.equal(extractArabicRoot("وَلَدٌ"), "ولد");
  assert.equal(extractArabicRoot("قَالَ"), "قول");
  assert.equal(extractArabicRoot("بَاعَ"), "بيع");
});

test("6. FAZ 2 — Harekeli eşyazımlı (homograf) sözlük ayrımı (عِلْمٌ vs عَلَمٌ، شِعْرٌ vs شَعْرٌ) ve çok kelimeli deyim tespiti", async () => {
  const { analyzeAndMatchWord } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "dict.ts")).href
  );
  const { findIdiomSpanAtWordIndex } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicIdioms.ts")).href
  );

  const ilmMatch = analyzeAndMatchWord("عِلْمٌ");
  assert.ok(ilmMatch.item, "عِلْمٌ sözlükte bulunmalıdır");
  assert.equal(
    /bayrak/i.test(ilmMatch.item.anlam_tr),
    false,
    "عِلْمٌ kelimesi 'bayrak' anlamıyla eşleşmemelidir"
  );
  assert.equal(
    /ilim|bilgi|bilim/i.test(ilmMatch.item.anlam_tr),
    true,
    "عِلْمٌ kelimesi 'ilim/bilgi/bilim' anlamıyla eşleşmelidir"
  );

  const alamMatch = analyzeAndMatchWord("عَلَمٌ");
  assert.ok(alamMatch.item, "عَلَمٌ sözlükte bulunmalıdır");
  assert.equal(
    /bayrak|sancak/i.test(alamMatch.item.anlam_tr),
    true,
    "عَلَمٌ kelimesi 'bayrak/sancak' anlamıyla eşleşmelidir"
  );

  const shiirMatch = analyzeAndMatchWord("شِعْرٌ");
  assert.ok(shiirMatch.item, "شِعْرٌ sözlükte bulunmalıdır");
  assert.equal(/şiir/i.test(shiirMatch.item.anlam_tr), true);

  const shaarMatch = analyzeAndMatchWord("شَعْرٌ");
  assert.ok(shaarMatch.item, "شَعْرٌ sözlükte bulunmalıdır");
  assert.equal(/saç/i.test(shaarMatch.item.anlam_tr), true);

  const idiomHit = findIdiomSpanAtWordIndex("السَّلَامُ عَلَيْكُمْ يَا أَخِي", 0);
  assert.ok(
    idiomHit && idiomHit.endWordIndex >= 1,
    "Çok kelimeli kalıp ifade (السَّلَامُ عَلَيْكُمْ) tespit edilmelidir"
  );
});

test("7. FAZ 2 — Kesilmeyen otomatik sürümlü QR matrisi (140+ bayt Türkçe başlıklı URL) ve ödev sözleşmesi (listen=0)", async () => {
  const { generateQrMatrix } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "qrCode.ts")).href
  );
  const { buildHomeworkUrl, parseHomeworkParams } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "homeworkContract.ts")).href
  );

  const trTitle = "10-A Sınıfı Haftalık Arapça Diyalog ve Telaffuz Ödevi";
  const longUrl = buildHomeworkUrl("https://app.muallimun.net", {
    contentId: "dlg_014",
    listen: false,
    pronTargetCount: 5,
    quiz: true,
    title: trTitle,
  });

  const byteLen = Buffer.byteLength(longUrl, "utf8");
  assert.ok(
    byteLen >= 140,
    `Üretilen ödev URL'si en az 140 UTF-8 bayt olmalıdır (ölçülen: ${byteLen})`
  );

  const matrix = generateQrMatrix(longUrl);
  assert.ok(
    Array.isArray(matrix) && matrix.length >= 45,
    `140+ baytlık URL için QR matris boyutu V7+ (>=45) olmalıdır (ölçülen: ${matrix.length})`
  );
  assert.equal(
    matrix.every((row) => row.length === matrix.length),
    true,
    "QR matrisi tam kare olmalıdır"
  );

  const parsedFromGenerated = parseHomeworkParams(
    new URL(longUrl).search,
    "dlg_014"
  );
  assert.equal(parsedFromGenerated.active, true);
  assert.equal(parsedFromGenerated.listen, false);
  assert.equal(parsedFromGenerated.pronTargetCount, 5);
  assert.equal(parsedFromGenerated.quiz, true);
  assert.equal(parsedFromGenerated.title, trTitle);

  const parsedExplicitListenZero = parseHomeworkParams(
    "?hw=1&listen=0&pron=3&quiz=1"
  );
  assert.equal(
    parsedExplicitListenZero.listen,
    false,
    "?listen=0 gönderildiğinde dinleme görevi kapalı (false) olmalıdır"
  );
});

test("8. FAZ 3 — Yerel Arapça font varlıkları (Arakom.ttf & WinSoftPro-Med.otf) ve globals.css @font-face doğrulaması", () => {
  const arakomPath = path.join(ROOT_DIR, "public", "fonts", "Arakom.ttf");
  const winsoftPath = path.join(
    ROOT_DIR,
    "public",
    "fonts",
    "WinSoftPro-Med.otf"
  );

  assert.equal(
    fs.existsSync(arakomPath),
    true,
    "public/fonts/Arakom.ttf mevcut olmalıdır"
  );
  assert.equal(
    fs.existsSync(winsoftPath),
    true,
    "public/fonts/WinSoftPro-Med.otf mevcut olmalıdır"
  );
  assert.ok(
    fs.statSync(arakomPath).size > 50_000,
    "public/fonts/Arakom.ttf geçerli boyutta olmalıdır"
  );
  assert.ok(
    fs.statSync(winsoftPath).size > 50_000,
    "public/fonts/WinSoftPro-Med.otf geçerli boyutta olmalıdır"
  );

  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  assert.equal(globalsCss.includes("/fonts/WinSoftPro-Med.otf"), true);
  assert.equal(globalsCss.includes("/fonts/Arakom.ttf"), true);
});

test("9. FAZ 3 — Tekil useSfxStore birleştirmesi, bellek abonelik temizliği ve kanonik çevrimdışı ses anahtarı", async () => {
  const sfxManagerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "sfxManager.ts"),
    "utf8"
  );
  assert.equal(
    sfxManagerCode.includes("create<"),
    false,
    "sfxManager.ts içinde mükerrer Zustand store tanımlanmamalıdır"
  );
  assert.equal(
    sfxManagerCode.includes("setRecordingMuted"),
    true,
    "sfxManager.ts mikrofon kaydı sırasında SFX susturma (setRecordingMuted) sunmalıdır"
  );

  const speechManagerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "speechManager.ts"),
    "utf8"
  );
  assert.equal(
    speechManagerCode.includes("unsubscribeSettings"),
    true,
    "HybridSpeechManager.terminate() içinde store aboneliği temizlenmelidir"
  );

  const { toCanonicalAudioCacheKey } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "audio.ts")).href
  );
  assert.equal(
    toCanonicalAudioCacheKey(
      "https://cdn.jsdelivr.net/gh/muallimun/arapca_telaffuz_medya@main/public/sesler/diyaloglar/dlg_001_01.mp3"
    ),
    "/sesler/diyaloglar/dlg_001_01.mp3"
  );
  assert.equal(
    toCanonicalAudioCacheKey("sesler/diyaloglar/dlg_001_01.mp3"),
    "/sesler/diyaloglar/dlg_001_01.mp3"
  );
});

test("10. FAZ 3 — Alıştırma çeldirici kalitesi, tam indeksli boşluk doldurma, ipucu kilidi ve süresiz sınıf kapışması", async () => {
  const { generateFillInBlanks, selectSmartWordDistractors } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "quiz.ts")).href
  );

  const { parsed: sozluk } = readDataJson("yeni_tum_sozluk.json");
  const sampleTargetWord = (sozluk.find((item) => item.mufret && item.mufret.length >= 3) || sozluk[0]).mufret.trim();

  // Tam kelime indeksiyle boşluk bırakma: önceki birleşik kelimenin alt-dizgesini bozmamalı
  const sampleLines = [
    {
      sira: 1,
      konusmaci: "Ali",
      konusmaci_ar: "عَلِيٌّ",
      arapca: `${sampleTargetWord}ي وَ${sampleTargetWord} جَدِيدٌ، ${sampleTargetWord}.`,
      turkce: "Test cümlesi.",
    },
  ];
  const blanks = generateFillInBlanks(sampleLines, sozluk);
  assert.ok(blanks.length >= 1, "Boşluk doldurma sorusu üretilmelidir");
  for (const blankQ of blanks) {
    assert.equal(
      (blankQ.sentenceWithBlank.match(/______/g) || []).length,
      1,
      "Cümlede yalnızca tek bir hedef kelime (tam indeks) boşluğa dönüştürülmelidir"
    );
    assert.equal(
      blankQ.sentenceWithBlank.includes("______ي") ||
        blankQ.sentenceWithBlank.includes("وَ______"),
      false,
      "Önceki kelimenin alt-dizgesi kısmi olarak silinmemelidir"
    );
  }

  const distractors = selectSmartWordDistractors(sozluk[0], sozluk, 3);
  assert.equal(distractors.length, 3);
  const uniqueAnlam = new Set(distractors.map((d) => d.anlam_tr));
  assert.equal(
    uniqueAnlam.size,
    3,
    "Seçilen 3 kelime çeldiricisinin Türkçe anlamları birbirinden farklı olmalıdır"
  );

  const morphCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      "MorphologyAndContextQuiz.tsx"
    ),
    "utf8"
  );
  assert.equal(
    morphCode.includes("showLiteralHint"),
    true,
    "MorphologyAndContextQuiz cevap öncesi lafzî ipucunu gizlemelidir"
  );

  const battleCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      "ClassroomTeamBattle.tsx"
    ),
    "utf8"
  );
  assert.equal(
    battleCode.includes("isUnlimitedTime"),
    true,
    "ClassroomTeamBattle süresiz (timeLimit === null || 0) modunu desteklemelidir"
  );
});

test("11. FAZ 3 — A4 PDF Üreticisi: escapeHtml, Arakom.ttf, tohumlu A/B Kitapçık PRNG, tam 100 puan dağıtıcı ve Maarif rubriği", async () => {
  const pdfModalPath = path.join(
    ROOT_DIR,
    "src",
    "components",
    "ui",
    "DialoguePdfModal.tsx"
  );
  const pdfCode = fs.readFileSync(pdfModalPath, "utf8");

  assert.equal(
    pdfCode.includes("Arakom-Regular.ttf") ||
      pdfCode.includes("Arakom-Bold.ttf"),
    false,
    "DialoguePdfModal içinde var olmayan Arakom-Regular/Bold.ttf yolları kalmamalıdır"
  );
  assert.equal(
    pdfCode.includes("/fonts/Arakom.ttf"),
    true,
    "DialoguePdfModal /fonts/Arakom.ttf yolunu kullanmalıdır"
  );
  assert.equal(
    pdfCode.includes("doc.fonts"),
    true,
    "DialoguePdfModal yazdırma öncesi doc.fonts.ready beklemelidir"
  );

  const {
    escapeHtml,
    hashStringSeed,
    mulberry32,
    seededShuffle,
    allocateExam100Points,
    MAARIF_RUBRIC_CRITERIA,
  } = await import(pathToFileURL(pdfModalPath).href);

  assert.equal(
    escapeHtml(`<img src=x onerror="alert('xss')">&`),
    "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;"
  );

  // Tohumlu A/B kitapçık determinizmi ve farklılığı
  const items = ["S1", "S2", "S3", "S4", "S5", "S6"];
  const orderA1 = seededShuffle(
    items,
    mulberry32(hashStringSeed("dlg_001::BOOKLET_A::v3"))
  );
  const orderA2 = seededShuffle(
    items,
    mulberry32(hashStringSeed("dlg_001::BOOKLET_A::v3"))
  );
  const orderB = seededShuffle(
    items,
    mulberry32(hashStringSeed("dlg_001::BOOKLET_B::v3"))
  );
  assert.deepEqual(
    orderA1,
    orderA2,
    "Aynı kitapçık tohumu her zaman birebir aynı soru sırasını üretmelidir"
  );
  assert.notDeepEqual(
    orderA1,
    orderB,
    "A ve B kitapçıkları birbirinden farklı soru sırası üretmelidir"
  );

  // Kısa veya tam diyaloglarda her zaman tam 100 tam sayı puan
  for (const [cA, cB, cC] of [
    [6, 5, 4],
    [3, 2, 1],
    [4, 0, 3],
    [2, 2, 0],
    [1, 1, 1],
  ]) {
    const alloc = allocateExam100Points(cA, cB, cC);
    assert.equal(
      alloc.grandTotal,
      100,
      `(${cA},${cB},${cC}) soru dağılımında toplam puan tam 100 olmalıdır`
    );
    assert.equal(
      alloc.perQuestionA.every((n) => Number.isInteger(n) && n > 0),
      true
    );
    assert.equal(
      alloc.perQuestionB.every((n) => Number.isInteger(n) && n > 0),
      true
    );
    assert.equal(
      alloc.perQuestionC.every((n) => Number.isInteger(n) && n > 0),
      true
    );
  }

  // Maarif 4 beceri rubriği (4 x 25 = 100 puan)
  assert.equal(MAARIF_RUBRIC_CRITERIA.length, 4);
  const rubricSum = MAARIF_RUBRIC_CRITERIA.reduce(
    (s, r) => s + r.maxPoints,
    0
  );
  assert.equal(rubricSum, 100);
});

test("12. FAZ 4A — seviye_tespit_sorulari.json: benzersiz ID, NFC, 0 tatweel, tüm üst konular ve %100 çeldirici analizi bütünlüğü", async () => {
  const { raw, parsed } = readDataJson("seviye_tespit_sorulari.json");
  const { ASSESSMENT_TOPICS } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );

  assert.ok(Array.isArray(parsed), "seviye_tespit_sorulari.json dizi olmalıdır");
  assert.ok(parsed.length >= 180, "Toplam soru sayısı en az 180 olmalıdır");
  assert.equal(
    raw.includes("\u0640"),
    false,
    "seviye_tespit_sorulari.json içinde tatweel (\\u0640) bulunmamalıdır"
  );

  const strings = collectStrings(parsed);
  for (const s of strings) {
    assert.equal(
      s,
      s.normalize("NFC"),
      `seviye_tespit_sorulari.json içinde NFC olmayan metin bulundu: ${s.slice(0, 40)}`
    );
  }

  const seenIds = new Set();
  const seenTopics = new Set();
  const validLetters = ["A", "B", "C", "D"];

  for (const q of parsed) {
    assert.ok(typeof q.id === "string" && q.id.length > 0);
    assert.equal(seenIds.has(q.id), false, `Mükerrer soru ID: ${q.id}`);
    seenIds.add(q.id);

    assert.ok(["A1", "A2", "B1", "B2"].includes(q.seviye), `${q.id} geçersiz seviye`);
    assert.ok([1, 2, 3].includes(q.zorluk_basamagi), `${q.id} geçersiz zorluk_basamagi`);
    seenTopics.add(q.ust_konu);

    assert.equal(Array.isArray(q.secenekler) && q.secenekler.length === 4, true, `${q.id} 4 şıklı olmalıdır`);
    assert.deepEqual(
      q.secenekler.map((o) => o.harf),
      validLetters,
      `${q.id} şıkları tam A,B,C,D sırasıyla tanımlı olmalıdır`
    );
    assert.ok(validLetters.includes(q.dogru_secenek), `${q.id} geçersiz dogru_secenek`);

    assert.ok(q.cozum_detayi?.soru_cevirisi_tr?.trim().length > 0, `${q.id} soru_cevirisi_tr boş`);
    assert.ok(q.cozum_detayi?.odak_kural?.trim().length > 0, `${q.id} odak_kural boş`);
    assert.ok(q.cozum_detayi?.dogru_cevap_gerekcesi?.trim().length > 0, `${q.id} dogru_cevap_gerekcesi boş`);

    const expectedWrongLetters = validLetters.filter((l) => l !== q.dogru_secenek);
    const actualAnalizKeys = Object.keys(q.cozum_detayi?.celdirici_analizi || {}).sort();
    assert.deepEqual(
      actualAnalizKeys,
      expectedWrongLetters,
      `${q.id} celdirici_analizi anahtarları yanlış 3 şıkla birebir eşleşmelidir`
    );
    for (const wl of expectedWrongLetters) {
      assert.ok(
        q.cozum_detayi.celdirici_analizi[wl].trim().length > 0,
        `${q.id} ${wl} şıkkı çeldirici analizi boş olmamalıdır`
      );
    }
  }

  assert.equal(seenTopics.size, ASSESSMENT_TOPICS.length, "Üst konu sayısı ASSESSMENT_TOPICS ile eşleşmelidir");
  const configuredTopics = new Set(ASSESSMENT_TOPICS.map((t) => t.ust_konu));
  assert.deepEqual(seenTopics, configuredTopics);
});

test("13. FAZ 4A — 3 Kademeli Hareke Solması (full / irab-only / none) harf iskeleti ve son harf i'rab koruması", async () => {
  const { formatArabicByHarekeMode, removeArabicHarakat } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts")).href
  );

  const sampleSentences = [
    "ذَهَبَ الطَّالِبُ الْمُجْتَهِدُ إِلَى مَدْرَسَةٍ كَبِيرَةٍ.",
    "إِنَّ الْمُعَلِّمِينَ كَتَبُوا دَرْسًا جَدِيدًا.",
  ];

  for (const s of sampleSentences) {
    const fullOut = formatArabicByHarekeMode(s, "full", "amiri");
    const irabOut = formatArabicByHarekeMode(s, "irab-only", "amiri");
    const noneOut = formatArabicByHarekeMode(s, "none", "amiri");

    // Üç modda da ünsüz harf iskeleti %100 aynı kalmalı
    const skelFull = removeArabicHarakat(fullOut);
    const skelIrab = removeArabicHarakat(irabOut);
    const skelNone = removeArabicHarakat(noneOut);
    assert.equal(skelFull, skelIrab, "full ve irab-only ünsüz iskeleti birebir aynı olmalıdır");
    assert.equal(skelFull, skelNone, "full ve none ünsüz iskeleti birebir aynı olmalıdır");

    // none modunda hiçbir hareke kalmamalı
    assert.equal(
      /[\u064B-\u065F\u0670]/.test(noneOut),
      false,
      "none modunda hiçbir hareke bulunmamalıdır"
    );

    // irab-only modunda tam harekeden daha az hareke olmalı ama şedde/tenvin/son harf i'rabı korunmalı
    assert.ok(
      irabOut.length < fullOut.length && irabOut.length > noneOut.length,
      "irab-only uzunluğu none ile full arasında olmalıdır"
    );
    assert.equal(irabOut.includes("\u0651"), true, "irab-only şeddeyi korumalıdır");
  }

  // Kelime sonu damme ve iç fethaların ayrımı: "الطَّالِبُ" -> iç kesra (\u0650) silinmeli, şedde+fetha? (şedde korunur, iç fetha silinir), son damme (\u064F) korunmalı!
  const wordIrab = formatArabicByHarekeMode("الطَّالِبُ", "irab-only", "amiri");
  assert.equal(wordIrab.endsWith("بُ"), true, "Kelime sonu i'rab harekesi (بُ) korunmalıdır");
  assert.equal(wordIrab.includes("لِ"), false, "Kelime içi kesra (لِ) soyulmalıdır");

  // Cemi müzekker fiil (كَتَبُوا): sessiz eliften önceki بُ dammesi korunmalı, iç تَ fethası soyulmalı
  const verbIrab = formatArabicByHarekeMode("كَتَبُوا", "irab-only", "amiri");
  assert.equal(verbIrab.includes("بُوا"), true, "Sessiz elif öncesi fiil harekesi (بُوا) korunmalıdır");
  assert.equal(verbIrab.includes("تَ"), false, "Fiil içi kısa hareke (تَ) soyulmalıdır");
});

test("14. FAZ 4A — Şık karıştırma kilidi, sade terim dönüştürücü, Leech kliniği, dinamik import disiplini ve Admin entegrasyonu", async () => {
  const {
    prepareQuestionOptions,
    isSelectedOptionCorrect,
    getDistractorAnalysisForSelection,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );
  const { mulberry32, hashStringSeed } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx")
    ).href
  );
  const { getLeechSrsItems } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "mistakeUtils.ts")).href
  );
  const { simplifyGrammarTerminology } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts")).href
  );

  const { parsed: questions } = readDataJson("seviye_tespit_sorulari.json");
  const normalQ = questions.find((q) => q.soru_tipi !== "hata_bulma");
  const hataBulmaQ = questions.find((q) => q.soru_tipi === "hata_bulma");

  // Normal soruda şıklar karışsa bile origHarf üzerinden doğru şık ve çeldirici analizi %100 eşleşmeli
  const rng = mulberry32(hashStringSeed("shuffle_lock_test_42"));
  const prepared = prepareQuestionOptions(normalQ, rng);
  const rightOpt = prepared.find((o) => o.origHarf === normalQ.dogru_secenek);
  const wrongOpt = prepared.find((o) => o.origHarf !== normalQ.dogru_secenek);
  assert.equal(isSelectedOptionCorrect(normalQ, rightOpt.origHarf), true);
  assert.equal(isSelectedOptionCorrect(normalQ, wrongOpt.origHarf), false);
  assert.equal(
    getDistractorAnalysisForSelection(normalQ, wrongOpt.origHarf),
    normalQ.cozum_detayi.celdirici_analizi[wrongOpt.origHarf]
  );

  // hata_bulma sorularında şık sırası A-B-C-D kilitli kalmalı
  if (hataBulmaQ) {
    const locked = prepareQuestionOptions(
      hataBulmaQ,
      mulberry32(hashStringSeed("any_seed"))
    );
    assert.deepEqual(
      locked.map((o) => o.origHarf),
      ["A", "B", "C", "D"],
      "hata_bulma sorularında şık sırası A-B-C-D olarak sabit kalmalıdır"
    );
  }

  // Sade anlatım dönüştürücü Arapçaya dokunmadan ağır terimleri sadeleştirmeli
  const simplified = simplifyGrammarTerminology(
    "Mübteda (الْعِلْمُ) merfûdur; Muzâfun İleyh mecrûrdur."
  );
  assert.equal(simplified.includes("İsim Cümlesi Öznesi"), true);
  assert.equal(simplified.includes("Tamlayan İsim"), true);
  assert.equal(simplified.includes("الْعِلْمُ"), true);

  // Leech Kliniği: wrongCount >= 3 filtrelemesi ve azalan sıralama
  const leeches = getLeechSrsItems({
    w1: { id: "w1", type: "word", box: 1, nextReviewAt: 0, correctStreak: 0, wrongCount: 2, lastReviewedAt: 10 },
    w2: { id: "w2", type: "word", box: 1, nextReviewAt: 0, correctStreak: 0, wrongCount: 5, lastReviewedAt: 20 },
    w3: { id: "w3", type: "word", box: 1, nextReviewAt: 0, correctStreak: 0, wrongCount: 3, lastReviewedAt: 30 },
  });
  assert.deepEqual(
    leeches.map((l) => l.id),
    ["w2", "w3"],
    "getLeechSrsItems yalnızca wrongCount >= 3 öğeleri azalan sırayla döndürmelidir"
  );

  // Dinamik paketleme disiplini: seviye_tespit_sorulari.json global dosyalara statik import edilmemeli
  for (const rel of [
    ["src", "lib", "data.ts"],
    ["src", "app", "page.tsx"],
    ["src", "components", "layout", "Header.tsx"],
  ]) {
    const srcCode = fs.readFileSync(path.join(ROOT_DIR, ...rel), "utf8");
    assert.equal(
      srcCode.includes("seviye_tespit_sorulari.json"),
      false,
      `${rel.join("/")} içinde seviye_tespit_sorulari.json statik import edilmemelidir`
    );
  }

  const seviyePageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    seviyePageCode.includes('import("@/data/seviye_tespit_sorulari.json")'),
    true,
    "/seviye-tespit sayfası soru bankasını dinamik import() ile yüklemelidir"
  );

  const adminApiCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  assert.equal(
    adminApiCode.includes('seviye_sorulari: "seviye_tespit_sorulari.json"'),
    true,
    "/api/admin içinde seviye_sorulari veri kümesi tanımlı olmalıdır"
  );
});

test("15. FAZ 4B — 6 Yeni İnteraktif Alıştırma & Oyun Modülü, next/dynamic Yükleme, Gramer Kısayolları ve Sıfır Dış Veri Havuzu Doğrulaması", async () => {
  const newExerciseFiles = [
    "ErrorHunter.tsx",
    "BlindDictation.tsx",
    "ClozeDialogueRoleplay.tsx",
    "GenderSortingGame.tsx",
    "ReadingEvidenceHunter.tsx",
    "IrabColorPainter.tsx",
  ];

  // 1. Altı yeni bileşen dosyası mevcut ve RTL / dokunmatik kurallarına uyumlu olmalı
  for (const fileName of newExerciseFiles) {
    const fullPath = path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      fileName
    );
    assert.equal(
      fs.existsSync(fullPath),
      true,
      `src/components/exercises/${fileName} dosyası mevcut olmalıdır`
    );
    const code = fs.readFileSync(fullPath, "utf8");
    assert.equal(
      code.includes('dir="rtl"'),
      true,
      `${fileName} içinde Arapça RTL yönlendirmesi bulunmalıdır`
    );
    assert.equal(
      code.includes("min-h-[48px]"),
      true,
      `${fileName} içinde dokunmatik/tahta ergonomisi (min-h-[48px]) bulunmalıdır`
    );
    assert.equal(
      code.includes("recordSkillAttempt"),
      true,
      `${fileName} beceri haritasına (recordSkillAttempt) veri kaydetmelidir`
    );
  }

  // 2. Alıştırma Merkezi 6 yeni modülü next/dynamic ile yüklemeli ve 14 modül sayısını yansıtmalı
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  for (const modName of [
    "ErrorHunter",
    "BlindDictation",
    "ClozeDialogueRoleplay",
    "GenderSortingGame",
    "ReadingEvidenceHunter",
    "IrabColorPainter",
  ]) {
    assert.equal(
      alistirmalarCode.includes(`@/components/exercises/${modName}`),
      true,
      `alistirmalar/page.tsx içinde ${modName} dinamik import edilmelidir`
    );
  }

  for (const modeId of [
    "error-hunter",
    "blind-dictation",
    "cloze-roleplay",
    "gender-sorting",
    "evidence-hunter",
    "irab-painter",
  ]) {
    assert.equal(
      alistirmalarCode.includes(`"${modeId}"`),
      true,
      `alistirmalar/page.tsx içinde "${modeId}" modu tanımlı olmalıdır`
    );
  }

  // Kategori filtre sekmeleri
  assert.equal(alistirmalarCode.includes("Kelime & Görsel"), true);
  assert.equal(alistirmalarCode.includes("Gramer & İ'rab"), true);
  assert.equal(alistirmalarCode.includes("Dinleme, Diyalog & Okuma"), true);
  assert.equal(alistirmalarCode.includes("Sınıf Yarışması"), true);

  // CONTENT_INVENTORY.exerciseModulesCount === 14
  const dataTsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "data.ts"),
    "utf8"
  );
  assert.equal(
    dataTsCode.includes("exerciseModulesCount: 14"),
    true,
    "CONTENT_INVENTORY.exerciseModulesCount 14 olarak güncellenmelidir"
  );

  // GrammarHapBilgiPanel kısayol bağlantıları
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  assert.equal(grammarPanelCode.includes("mode=error-hunter"), true);
  assert.equal(grammarPanelCode.includes("mode=irab-painter"), true);

  // 3. Altı modülün sıfır dış veriyle beslendiği yerel JSON havuzları dolu ve geçerli olmalı
  const { parsed: dlgGrammar } = readDataJson("diyaloglar_gramer_hap_bilgi.json");
  const { parsed: mtnGrammar } = readDataJson("metinler_gramer_hap_bilgi.json");
  const allGrammar = [...dlgGrammar, ...mtnGrammar];

  const errorHunterNotes = allGrammar.filter(
    (g) =>
      g.ayrintili_anlatim?.dikkat_sik_hata?.yanlis &&
      g.ayrintili_anlatim?.dikkat_sik_hata?.dogru
  );
  assert.equal(
    errorHunterNotes.length,
    180,
    "Hata Avcısı 180 gramer notunun tamamından beslenebilmelidir"
  );

  const irabNotes = allGrammar.filter(
    (g) =>
      Array.isArray(g.ayrintili_anlatim?.irab_tahlili) &&
      g.ayrintili_anlatim.irab_tahlili.length >= 2
  );
  assert.equal(
    irabNotes.length,
    180,
    "İ'rab Boyama 180 gramer notunun tamamından beslenebilmelidir"
  );

  const { parsed: visualWords } = readDataJson("gorselKelimeler_guncel.json");
  const mascNouns = visualWords.filter(
    (w) => w.tur === "isim" && w.soru_kalibi === "مَا هَذَا؟"
  );
  const femNouns = visualWords.filter(
    (w) => w.tur === "isim" && w.soru_kalibi === "مَا هَذِهِ؟"
  );
  assert.ok(mascNouns.length > 200, "Müzekker görsel isim havuzu > 200 olmalıdır");
  assert.ok(femNouns.length > 150, "Müennes görsel isim havuzu > 150 olmalıdır");
  assert.equal(
    mascNouns.length + femNouns.length,
    640,
    "Toplam müzekker + müennes görsel isim havuzu 640 olmalıdır"
  );

  const { parsed: dialogues } = readDataJson("tum_diyaloglar_120.json");
  const totalPairs = dialogues.reduce(
    (acc, d) => acc + Math.max(0, (d.satirlar?.length || 0) - 1),
    0
  );
  assert.ok(totalPairs > 500, "Diyalog boş replik çifti havuzu > 500 olmalıdır");

  const { parsed: readings } = readDataJson("tum_metinler_60.json");
  const totalReadingQuestions = readings.reduce(
    (acc, m) => acc + (m.sorular?.length || 0),
    0
  );
  assert.ok(
    totalReadingQuestions >= 120,
    "Metin Kanıt Dedektifi soru havuzu >= 120 olmalıdır"
  );

  // 4. İ'rab 5 Kanonik Fırça Sınıflandırıcısı Doğrulaması
  const { classifyIrabRoleToBrush } = await import(
    pathToFileURL(
      path.join(
        ROOT_DIR,
        "src",
        "components",
        "exercises",
        "IrabColorPainter.tsx"
      )
    ).href
  );
  assert.equal(classifyIrabRoleToBrush("Mübteda (Özne)"), "merfu_subject");
  assert.equal(classifyIrabRoleToBrush("Haber (Yüklem)"), "haber_predicate");
  assert.equal(classifyIrabRoleToBrush("Mef'ûlün Bih (Nesne)"), "mansub_object");
  assert.equal(
    classifyIrabRoleToBrush("Muzafun İleyh"),
    "mecrur_genitive"
  );
  assert.equal(classifyIrabRoleToBrush("Fiil + Fâil"), "verb_other");
});

test("16. FAZ 5A — Akıllı Tahta Konsolu, İkili Bilgi Boşluğu (A/B) Konuşma Kartları ve Yarışma Sonuç Raporu Doğrulaması", async () => {
  // 1. SmartboardOverlay & InfoGapPairModal varlığı ve next/dynamic({ ssr: false }) disiplini
  const smartboardOverlayPath = path.join(
    ROOT_DIR,
    "src",
    "components",
    "classroom",
    "SmartboardOverlay.tsx"
  );
  const smartboardMountPath = path.join(
    ROOT_DIR,
    "src",
    "components",
    "classroom",
    "SmartboardMount.tsx"
  );
  const infoGapModalPath = path.join(
    ROOT_DIR,
    "src",
    "components",
    "classroom",
    "InfoGapPairModal.tsx"
  );

  assert.equal(
    fs.existsSync(smartboardOverlayPath),
    true,
    "SmartboardOverlay.tsx mevcut olmalıdır"
  );
  assert.equal(
    fs.existsSync(smartboardMountPath),
    true,
    "SmartboardMount.tsx mevcut olmalıdır"
  );
  assert.equal(
    fs.existsSync(infoGapModalPath),
    true,
    "InfoGapPairModal.tsx mevcut olmalıdır"
  );

  const overlayCode = fs.readFileSync(smartboardOverlayPath, "utf8");
  assert.equal(
    overlayCode.includes("print:hidden"),
    true,
    "SmartboardOverlay yazdırma görünümünde gizlenmelidir (print:hidden)"
  );
  assert.equal(
    overlayCode.includes("mixBlendMode"),
    true,
    "Fosforlu İ'rab vurgulayıcı harekeleri kapatmamak için mixBlendMode kullanmalıdır"
  );
  assert.equal(
    overlayCode.includes("min-h-[48px]"),
    true,
    "Akıllı tahta butonları min-h-[48px] dokunma ergonomisine sahip olmalıdır"
  );
  assert.equal(
    overlayCode.includes("Tahta Perdesi"),
    true,
    "Sürüklenebilir Tahta Perdesi bulunmalıdır"
  );
  assert.equal(
    overlayCode.includes("Seçileni Bu Derste Tekrar Seçme"),
    true,
    "Kura çarkında tekrarsız seçim seçeneği bulunmalıdır"
  );

  const mountCode = fs.readFileSync(smartboardMountPath, "utf8");
  assert.equal(
    mountCode.includes('import("@/components/classroom/SmartboardOverlay")') &&
      mountCode.includes("ssr: false"),
    true,
    "SmartboardOverlay next/dynamic({ ssr: false }) ile tembel yüklenmelidir"
  );

  const layoutCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  assert.equal(
    layoutCode.includes("SmartboardOverlay"),
    false,
    "layout.tsx ağır SmartboardOverlay bileşenini doğrudan statik import etmemelidir"
  );
  assert.equal(
    layoutCode.includes("<SmartboardMount />"),
    true,
    "layout.tsx içinde <SmartboardMount /> yer almalıdır"
  );

  const diyalogPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  assert.equal(
    diyalogPageCode.includes('import("@/components/classroom/InfoGapPairModal")') &&
      diyalogPageCode.includes("ssr: false"),
    true,
    "diyalog/[id]/page.tsx InfoGapPairModal bileşenini next/dynamic({ ssr: false }) ile yüklemelidir"
  );

  // 2. İkili Bilgi Boşluğu (A/B) Üreticisi: Tamamlayıcı satırlar ve sıfır kopya sızıntısı
  const { buildInfoGapPairCards, PAIR_SPEAKING_RUBRIC_CRITERIA } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "infoGapBuilder.ts")).href
  );
  assert.equal(PAIR_SPEAKING_RUBRIC_CRITERIA.length, 4);
  assert.equal(
    PAIR_SPEAKING_RUBRIC_CRITERIA.reduce((acc, c) => acc + c.maxPoints, 0),
    100
  );

  const { parsed: dialogues } = readDataJson("tum_diyaloglar_120.json");
  const sampleDlg = dialogues[0];
  const deck = buildInfoGapPairCards(sampleDlg, []);
  assert.equal(deck.studentACard.length, sampleDlg.satirlar.length);
  assert.equal(deck.studentBCard.length, sampleDlg.satirlar.length);

  for (let i = 0; i < sampleDlg.satirlar.length; i++) {
    const aLine = deck.studentACard[i];
    const bLine = deck.studentBCard[i];
    const metaLine = deck.lines[i];
    const isOdd = (i + 1) % 2 === 1;

    assert.equal(aLine.isFull, isOdd, `Satır #${i + 1} Öğrenci A tamlık durumu hatalı`);
    assert.equal(bLine.isFull, !isOdd, `Satır #${i + 1} Öğrenci B tamlık durumu hatalı`);

    const maskedCardLine = isOdd ? bLine : aLine;
    assert.equal(
      maskedCardLine.displayArabic.includes("[ .................. ]"),
      true,
      `Maskeli kart satırında boşluk yer tutucusu bulunmalıdır (#${i + 1})`
    );
    assert.ok(
      metaLine.hiddenWordsAr.length >= 1,
      `Her satırda en az 1 hedef kelime gizlenmelidir (#${i + 1})`
    );
    for (const hiddenAr of metaLine.hiddenWordsAr) {
      assert.equal(
        maskedCardLine.displayTurkishCue.includes(hiddenAr),
        false,
        `Türkçe ipucu alanında gizlenen Arapça kelime sızmamalıdır: ${hiddenAr}`
      );
    }
  }

  // 3. DialoguePdfModal A/B Eşli Kart Şablonu ve ClassroomTeamBattle PNG + A4 Özet Raporu
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  assert.equal(
    pdfModalCode.includes('"pair-infogap"'),
    true,
    "DialoguePdfModal içinde pair-infogap modu tanımlı olmalıdır"
  );
  assert.equal(
    pdfModalCode.includes("Buradan Kesiniz"),
    true,
    "DialoguePdfModal eşli konuşma şablonunda kesme çizgisi (Buradan Kesiniz) bulunmalıdır"
  );

  const battleCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      "ClassroomTeamBattle.tsx"
    ),
    "utf8"
  );
  assert.equal(
    battleCode.includes("Yarışma Sonuç Kartını İndir (PNG)"),
    true,
    "ClassroomTeamBattle içinde PNG sonuç kartı indirme butonu bulunmalıdır"
  );
  assert.equal(
    battleCode.includes("Sınıfça Tekrar Edilecek Kelimeler"),
    true,
    "ClassroomTeamBattle özetinde Sınıfça Tekrar Edilecek Kelimeler bölümü bulunmalıdır"
  );
  assert.equal(
    battleCode.includes("window.open"),
    false,
    "ClassroomTeamBattle iframe güvenliği için window.open kullanmamalıdır"
  );
});

test("17. FAZ 5B: Klasik/Kur'ân Kök Köprüsü, Ortak Kelimeler, 28 Harf Mahreç Haritası, Çift Ses Eğrisi ve Sosyal Kart Motoru doğrulanır", async () => {
  // 1. Classical Bridge & Turkish-Arabic Cognates: >=45 kök, >=60 ortak kelime, %100 NFC, 0 tatweel
  const {
    CLASSICAL_ROOT_BRIDGE,
    TURKISH_ARABIC_COGNATES,
    getClassicalBridgeForRoot,
    getCognateInfoForArabicWord,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "classicalBridgeData.ts")).href
  );

  const rootKeys = Object.keys(CLASSICAL_ROOT_BRIDGE);
  const cognateKeys = Object.keys(TURKISH_ARABIC_COGNATES);
  assert.ok(
    rootKeys.length >= 45,
    `CLASSICAL_ROOT_BRIDGE en az 45 sülâsî kök içermelidir (bulunan: ${rootKeys.length})`
  );
  assert.ok(
    cognateKeys.length >= 60,
    `TURKISH_ARABIC_COGNATES en az 60 ortak kelime içermelidir (bulunan: ${cognateKeys.length})`
  );

  for (const key of rootKeys) {
    const entry = CLASSICAL_ROOT_BRIDGE[key];
    for (const field of [
      "root",
      "rootSpaced",
      "modernUsageAr",
      "modernUsageTr",
      "classicalTermAr",
      "classicalTermTr",
      "quranicExampleAr",
      "quranicExampleTr",
      "surahRef",
    ]) {
      const val = entry[field];
      assert.ok(
        typeof val === "string" && val.trim().length > 0,
        `CLASSICAL_ROOT_BRIDGE[${key}].${field} boş olmamalıdır`
      );
      assert.equal(
        val.includes("\u0640"),
        false,
        `CLASSICAL_ROOT_BRIDGE[${key}].${field} tatweel (\\u0640) içermemelidir`
      );
      assert.equal(
        val,
        val.normalize("NFC"),
        `CLASSICAL_ROOT_BRIDGE[${key}].${field} NFC formunda olmalıdır`
      );
    }
  }

  for (const key of cognateKeys) {
    const entry = TURKISH_ARABIC_COGNATES[key];
    for (const field of ["arabicKey", "arabicVocalized", "turkishCognate", "meaningTr"]) {
      const val = entry[field];
      assert.ok(
        typeof val === "string" && val.trim().length > 0,
        `TURKISH_ARABIC_COGNATES[${key}].${field} boş olmamalıdır`
      );
      assert.equal(
        val.includes("\u0640"),
        false,
        `TURKISH_ARABIC_COGNATES[${key}].${field} tatweel içermemelidir`
      );
      assert.equal(
        val,
        val.normalize("NFC"),
        `TURKISH_ARABIC_COGNATES[${key}].${field} NFC formunda olmalıdır`
      );
    }
    if (entry.nuanceNoteTr) {
      assert.equal(entry.nuanceNoteTr, entry.nuanceNoteTr.normalize("NFC"));
    }
  }

  // Boşluklu sözlük kökü ("ع ل م") ve bitişik kök ("علم") aynı kaydı döndürmeli
  const ilmSpaced = getClassicalBridgeForRoot("ع ل م");
  const ilmCompact = getClassicalBridgeForRoot("علم");
  assert.ok(ilmSpaced && ilmCompact, "ع ل م kökü klasik köprüde bulunmalıdır");
  assert.equal(ilmSpaced.surahRef, ilmCompact.surahRef);

  // Yalancı eşdeğer (مُسَافِرٌ -> yolcu) uyarısı doğrulanmalı
  const musafirCognate = getCognateInfoForArabicWord("مُسَافِرٌ");
  assert.ok(musafirCognate, "مُسَافِرٌ ortak kelimeler tablosunda yer almalıdır");
  assert.equal(musafirCognate.isFalseFriend, true);
  assert.ok(
    musafirCognate.nuanceNoteTr && musafirCognate.nuanceNoteTr.includes("yolcu"),
    "مُسَافِرٌ nüans notu 'yolcu' anlam farkını açıklamalıdır"
  );

  // 2. 28 Harf Kişisel Mahreç Motoru (userStore + universalStt)
  const {
    useUserStore,
    ARABIC_28_LETTERS,
    buildPhonemeAttemptsFromEvaluatedWords,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "store", "userStore.ts")).href
  );
  const { detectCriticalMakhrajSubstitution } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "universalStt.ts")).href
  );

  assert.equal(ARABIC_28_LETTERS.length, 28, "Arap alfabesi 28 temel harf içermelidir");

  const evaluatedSample = [
    {
      targetWord: "قَلْبٌ",
      spokenWord: "كَلْبٌ",
      status: "wrong",
      score: 40,
    },
    {
      targetWord: "سَلَامٌ",
      spokenWord: "سَلَامٌ",
      status: "correct",
      score: 100,
    },
  ];
  const batch = buildPhonemeAttemptsFromEvaluatedWords(
    evaluatedSample,
    detectCriticalMakhrajSubstitution
  );
  const qafAttempt = batch.find((b) => b.letter === "ق");
  assert.ok(qafAttempt, "ق harfi deneme listesinde yer almalıdır");
  assert.equal(qafAttempt.ok, false);
  assert.equal(qafAttempt.confusedWith, "ك");

  useUserStore.getState().resetProgress();
  useUserStore.getState().recordPhonemeAttempt(batch);
  const afterStats = useUserStore.getState().phonemeStats;
  assert.equal(afterStats["ق"].attempts, 1);
  assert.equal(afterStats["ق"].cleanHits, 0);
  assert.equal(afterStats["ق"].confusions, 1);
  assert.equal(afterStats["ق"].lastConfusedWith, "ك");
  assert.equal(afterStats["س"].cleanHits, 1);

  const exportedJson = useUserStore.getState().exportProgress();
  useUserStore.getState().resetProgress();
  assert.deepEqual(useUserStore.getState().phonemeStats, {});
  const importRes = useUserStore.getState().importProgress(exportedJson, "overwrite");
  assert.equal(importRes, true);
  assert.equal(useUserStore.getState().phonemeStats["ق"].lastConfusedWith, "ك");

  // 3. PhonemeHeatmapModal 28 harf rehberi ve 3 giriş noktasında next/dynamic kontrolü
  const { PHONEME_28_GUIDE } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "components", "ui", "PhonemeHeatmapModal.tsx")
    ).href
  );
  for (const ltr of ARABIC_28_LETTERS) {
    assert.ok(
      PHONEME_28_GUIDE[ltr] && PHONEME_28_GUIDE[ltr].articulationDetailTr.length > 10,
      `${ltr} harfi için Türkçe mahreç açıklaması tanımlı olmalıdır`
    );
  }

  for (const relPage of [
    ["src", "app", "page.tsx"],
    ["src", "app", "alistirmalar", "page.tsx"],
    ["src", "app", "sozluk", "page.tsx"],
  ]) {
    const code = fs.readFileSync(path.join(ROOT_DIR, ...relPage), "utf8");
    assert.equal(
      code.includes('import("@/components/ui/PhonemeHeatmapModal")') &&
        code.includes("28 Harf Mahreç Haritam"),
      true,
      `${relPage.join("/")} içinde next/dynamic PhonemeHeatmapModal ve '28 Harf Mahreç Haritam' butonu bulunmalıdır`
    );
  }

  // 4. ShadowingModal çift ses dalgası eğrisi & ShareContentCardModal 1:1 / 9:16 / Çift Kart / Mini QR / Blob temizliği
  const shadowingCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ShadowingModal.tsx"),
    "utf8"
  );
  assert.equal(
    shadowingCode.includes("Üst Üste Eğri") &&
      shadowingCode.includes("Bu bölgede uzatma/vurgu referanstan daha kısa kaldı"),
    true,
    "ShadowingModal içinde Üst Üste Eğri modu ve erken sönümlenme uyarısı bulunmalıdır"
  );

  const shareCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ShareContentCardModal.tsx"),
    "utf8"
  );
  assert.equal(
    shareCardCode.includes("Soru → Cevap Çift Kart") &&
      shareCardCode.includes("generateQrMatrix") &&
      shareCardCode.includes("URL.revokeObjectURL") &&
      shareCardCode.includes("1920"),
    true,
    "ShareContentCardModal 1:1/9:16 (1920px), Soru->Cevap Çift Kart, Mini QR ve ObjectURL temizliği içermelidir"
  );
  assert.equal(
    shareCardCode.includes("toDataURL("),
    false,
    "ShareContentCardModal bellek sızıntısını önlemek için toDataURL yerine toBlob + ObjectURL kullanmalıdır"
  );

  // 5. layout.tsx güncel açıklama doğrulaması
  const { CONTENT_INVENTORY } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href
  );
  assert.equal(CONTENT_INVENTORY.dialoguesCount, 120);
  assert.equal(CONTENT_INVENTORY.readingsCount, 60);
  assert.equal(CONTENT_INVENTORY.exerciseModulesCount, 14);

  const layoutSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  assert.equal(
    layoutSrc.includes("180 soruluk Seviye Tespit & Konu Tarama Merkezi") &&
      layoutSrc.includes("modüllü interaktif alıştırma merkezi"),
    true,
    "layout.tsx APP_FULL_DESCRIPTION güncel 180 soruluk tarama ve 14 modüllü alıştırma bilgisini içermelidir"
  );
  assert.equal(
    layoutSrc.includes("60 CEFR") || layoutSrc.includes("5 modlu"),
    false,
    "layout.tsx içinde eski '60 CEFR' veya '5 modlu' ifadeleri bulunmamalıdır"
  );
});

test("18. CANLI TEST ONARIMLARI — 3 Bölgeli Header, Yaprak Test Türkçe Font & Sayfa Kırılımı, Sürüklenebilir Geometrik Akıllı Tahta ve 6 Yeni Oyun Vitrini", async () => {
  // 1. Header.tsx: absolute çakışma kaldırılmış, 3 esnek bölge ve Araçlar menüsü mevcut
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  assert.equal(
    headerCode.includes("left-1/2 -translate-x-1/2"),
    false,
    "Header.tsx orta menüsünde çakışmaya yol açan absolute left-1/2 -translate-x-1/2 kalmamalıdır"
  );
  assert.equal(
    headerCode.includes('aria-label="Ana Navigasyon"') &&
      headerCode.includes("MoreHorizontal") &&
      headerCode.includes("Muallimun Arapça"),
    true,
    "Header.tsx 3 esnek bölgeye, Muallimun Arapça markasına ve kompakt Diğer Araçlar menüsüne sahip olmalıdır"
  );

  // Ana sayfa 14 Farklı Modül ve Günün 6 Kelimesi tam genişlik Arapça satır
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  assert.equal(
    homeCode.includes("14 Farklı Modül • Görsel & Sesli"),
    true,
    "Ana sayfa Kelime Alıştırmaları kartı '14 Farklı Modül • Görsel & Sesli' göstermelidir"
  );
  assert.equal(
    homeCode.includes("6 Farklı Modül • Görsel & Sesli"),
    false,
    "Ana sayfada eski '6 Farklı Modül' metni kalmamalıdır"
  );

  // OnboardingTourModal RTL mahreç çifti izolasyonu ve 88dvh mobil kaydırma koruması
  const tourCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );
  assert.equal(
    tourCode.includes("max-h-[88dvh]") &&
      /dir="rtl"\s+lang="ar"/.test(tourCode),
    true,
    "OnboardingTourModal mobil 88dvh koruması ve izole RTL mahreç çiftleri içermelidir"
  );

  // 2. Yaprak Test: WinSoftPrint kaldırılmış, Inter + Noto Naskh Arabic ayrımı, B kitapçığı break-before: page ve 2 düzen modu
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    seviyeCode.includes("WinSoftPrint"),
    false,
    "Yaprak Test yazdırma şablonunda Türkçe karakterleri bozan WinSoftPrint kullanılmamalıdır"
  );
  assert.equal(
    seviyeCode.includes(".booklet-sheet + .booklet-sheet") &&
      seviyeCode.includes("break-before: page !important") &&
      seviyeCode.includes("page-break-before: always !important"),
    true,
    "B Kitapçığı ve Cevap Anahtarı her zaman yeni A4 sayfasından başlamalıdır"
  );
  assert.equal(
    seviyeCode.includes('"single-tight"') && seviyeCode.includes('"two-column"'),
    true,
    "Yaprak Test modalında Tek Sütun Sıkı ve Çift Sütun Klasik düzen seçicisi bulunmalıdır"
  );

  // 3. SmartboardOverlay: Serbest sürükleme, 6 geometrik şekil ve dairesel renk paleti + özel renk seçici
  const smartboardCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "classroom",
      "SmartboardOverlay.tsx"
    ),
    "utf8"
  );
  const { BOARD_COLOR_SWATCHES } = await import(
    pathToFileURL(
      path.join(
        ROOT_DIR,
        "src",
        "components",
        "classroom",
        "SmartboardOverlay.tsx"
      )
    ).href
  );
  assert.equal(
    Array.isArray(BOARD_COLOR_SWATCHES) && BOARD_COLOR_SWATCHES.length === 10,
    true,
    "SmartboardOverlay 10 dairesel renk paleti (5x2) sunmalıdır"
  );
  for (const shapeTool of [
    '"circle"',
    '"square"',
    '"rect"',
    '"triangle"',
    '"line"',
    '"arrow"',
  ]) {
    assert.equal(
      smartboardCode.includes(shapeTool),
      true,
      `SmartboardOverlay ${shapeTool} geometrik çizim aracını desteklemelidir`
    );
  }
  assert.equal(
    smartboardCode.includes('type="color"'),
    true,
    "SmartboardOverlay özel renk seçici (<input type=\"color\">) içermelidir"
  );
  const smartboardComponentBody = smartboardCode.slice(
    smartboardCode.indexOf("export default function SmartboardOverlay")
  );
  assert.equal(
    smartboardComponentBody.includes("BOARD_COLOR_SWATCHES.map") &&
      !smartboardComponentBody.includes("IRAB_SEMANTIC_PALETTE.map") &&
      !smartboardComponentBody.includes("Özne / Merfû"),
    true,
    "SmartboardOverlay içinde taşmaya yol açan uzun 'Özne / Merfû' buton metinleri yerine BOARD_COLOR_SWATCHES dairesel paleti kullanılmalıdır"
  );

  // 4. Alıştırma Merkezi: 14 modül vitrini korunurken geçici 'Yeni İnteraktif Oyunlar' sekmesi ve '✨ YENİ' rozetleri kaldırılmış olmalı
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    alistirmalarCode.includes('"new_games"') ||
      alistirmalarCode.includes("Yeni İnteraktif Oyunlar") ||
      alistirmalarCode.includes("✨ YENİ"),
    false,
    "Alıştırma Merkezinde geçici 'Yeni İnteraktif Oyunlar' sekmesi ve '✨ YENİ' rozetleri bulunmamalıdır"
  );
});

test("19. SEVİYE TESPİT İYİLEŞTİRMELERİ — Çok Satırlı Diyalog Konuşmacı Ayrıştırması & RTL Noktalama, Soru Navigatörü, Tam Gerekçeli Çözüm & 2x2 İnceleme Şıkları ve Dinamik Konu/Kur Filtreleme", async () => {
  const {
    splitArabicDialogueLines,
    buildDynamicAssessmentTopics,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );

  // 1. Çok satırlı diyalog soruları konuşmacı + replik olarak bölünmeli ve "د." kısaltması RLM (\u200F) ile izole edilmeli
  const multiLineSample =
    "د. حَسَنٌ: مَا رَأْيُكَ فِي الْخُطَّةِ؟\nد. طَارِقٌ: هِيَ ______ جِدًّا.";
  const splitMulti = splitArabicDialogueLines(multiLineSample);
  assert.equal(splitMulti.length, 2, "Çok satırlı diyalog 2 ayrı konuşmacı satırına bölünmelidir");
  assert.equal(splitMulti[0].isDialogueLine, true);
  assert.equal(splitMulti[0].speaker, "د.\u200F حَسَنٌ");
  assert.equal(splitMulti[0].utterance, "مَا رَأْيُكَ فِي الْخُطَّةِ؟");
  assert.equal(splitMulti[1].isDialogueLine, true);
  assert.equal(splitMulti[1].speaker, "د.\u200F طَارِقٌ");
  assert.equal(splitMulti[1].utterance, "هِيَ ______ جِدًّا.");

  // Tek satırlı düz cümlede iki nokta bulunsa bile ("قَالَ الْمُدِيرُ: ...") diyalog konuşmacısı olarak bölünmemeli
  const singleLineColon = "قَالَ الْمُدِيرُ: ______ مُجْتَهِدَانِ.";
  const splitSingle = splitArabicDialogueLines(singleLineColon);
  assert.equal(splitSingle.length, 1);
  assert.equal(splitSingle[0].isDialogueLine, false);
  assert.equal(splitSingle[0].speaker, null);

  // 2. Dinamik Konu Keşfi: JSON'a yeni bir ust_konu eklendiğinde kod değişikliği gerektirmeden otomatik tanınmalı
  const { parsed: bank } = readDataJson("seviye_tespit_sorulari.json");
  const baseDynamicTopics = buildDynamicAssessmentTopics(bank);
  assert.ok(baseDynamicTopics.length >= 29);

  const extendedBank = [
    ...bank,
    {
      ...bank[0],
      id: "sts_b2_dynamic_test_001",
      seviye: "B2",
      ust_konu: "Belâgat ve Üslup Analizi",
    },
  ];
  const extendedTopics = buildDynamicAssessmentTopics(extendedBank);
  assert.equal(
    extendedTopics.length,
    baseDynamicTopics.length + 1,
    "Yeni ust_konu eklendiğinde dinamik konu listesi otomatik olarak +1 konuya çıkmalıdır"
  );
  const addedTopic = extendedTopics.find(
    (t) => t.ust_konu === "Belâgat ve Üslup Analizi"
  );
  assert.ok(addedTopic, "Yeni eklenen ust_konu dinamik listede bulunmalıdır");
  assert.equal(addedTopic.levelCounts.B2, 1);
  assert.equal(addedTopic.primaryLevel, "B2");
  assert.equal(addedTopic.questionCount, 1);

  // 3. seviye-tespit/page.tsx: Soru Navigatörü, Önceki/Sonraki/Bitir, Gerekçeli Çözüm başlığı, 2x2 şık incelemesi, A4 çok satırlı diyalog ve CEFR filtresi
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    seviyeCode.includes("Soru Navigatörü") &&
      seviyeCode.includes("scrollIntoView") &&
      seviyeCode.includes("Önceki") &&
      seviyeCode.includes("Sonraki"),
    true,
    "seviye-tespit/page.tsx içinde Soru Navigatörü, scrollIntoView ve Önceki/Sonraki kontrolleri bulunmalıdır"
  );
  assert.equal(
    seviyeCode.includes(".q-arabic-line + .q-arabic-line") &&
      seviyeCode.includes("[unicode-bidi:isolate]"),
    true,
    "seviye-tespit/page.tsx hem ekranda hem A4 çıktısında çok satırlı konuşmacı ve unicode-bidi:isolate koruması içermelidir"
  );
  assert.equal(
    seviyeCode.includes("Doğru:") &&
      seviyeCode.includes("Seçiminiz:") &&
      !seviyeCode.includes("💡 Gerekçeli"),
    true,
    "DetailedSolutionBox çift ampul içermemeli; Doğru ve Seçiminiz alanlarını eksiksiz göstermelidir"
  );
  assert.equal(
    seviyeCode.includes('aria-label="CEFR Kur Filtresi"') &&
      seviyeCode.includes("Konu veya kural ara"),
    true,
    "Konu Tarama sekmesinde CEFR Kur Filtresi ve Konu Arama Kutusu bulunmalıdır"
  );

  // 4. Sabit "13 Konu" ifadesi arayüz dosyalarından tamamen kaldırılmış olmalı
  for (const rel of [
    ["src", "app", "page.tsx"],
    ["src", "app", "alistirmalar", "page.tsx"],
    ["src", "components", "layout", "Header.tsx"],
    ["src", "app", "seviye-tespit", "page.tsx"],
  ]) {
    const uiCode = fs.readFileSync(path.join(ROOT_DIR, ...rel), "utf8");
    assert.equal(
      uiCode.includes("13 Konu"),
      false,
      `${rel.join("/")} içinde sabit '13 Konu' ifadesi bulunmamalıdır`
    );
  }
});

test("20. ÜST BAR SIFIR ÇAKIŞMA & MUALLİMUN ARAPÇA MARKASI, EXCALIDRAW SINIFI AKILLI TAHTA İKON DOCK + GEOMETRİK SİLGİ ÇARPIŞMASI VE ROZET HİJYENİ", async () => {
  // 1. Muallimun Arapça isimlendirmesi, 6 kompakt masaüstü sekme, 4 sağ ikon ve MobileNav 5 sekme
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const mobileNavCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "MobileNav.tsx"),
    "utf8"
  );
  const layoutCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );

  assert.equal(
    headerCode.includes("Muallimun Arapça") &&
      !headerCode.includes("Arapça Telaffuz & Diyalog") &&
      headerCode.includes("data-tooltip={item.tooltip}") &&
      headerCode.includes('tooltip: "Ana Sayfa"') &&
      headerCode.includes('tooltip: "İnteraktif Sözlük"') &&
      headerCode.includes('tooltip: "Ayarlar"') &&
      headerCode.includes('data-tooltip="Arapça Font ve Yazı Boyutu"') &&
      headerCode.includes('data-tooltip="Tahta Çizim ve Sınıf Araçları"') &&
      headerCode.includes('data-tooltip="Ders Sayacı ve Sınıf Kurası"') &&
      headerCode.includes('data-tooltip="Diğer Araçlar ve Yardım"'),
    true,
    "Header.tsx Muallimun Arapça başlığına, metinsiz büyük ikonlu orta menüye ve sağ araç ikonlarına sahip olmalıdır"
  );
  assert.equal(
    mobileNavCode.includes('href: "/seviye-tespit"') &&
      mobileNavCode.includes('label: "Sınav"'),
    true,
    "MobileNav.tsx 5 temel sekme içinde 'Sınav' (/seviye-tespit) bağlantısını sunmalıdır"
  );
  assert.equal(
    layoutCode.includes("Muallimun Arapça") &&
      layoutCode.includes(
        "İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu"
      ),
    true,
    "layout.tsx metadata ve footer alanları Muallimun Arapça kurumsal kimliğini içermelidir"
  );
  assert.equal(
    globalsCss.includes("z-index: 120") &&
      globalsCss.includes('[data-tooltip][data-tooltip-pos="bottom"]::after'),
    true,
    "globals.css kesilmeyen yüksek z-index'li tooltip konumlandırmasını desteklemelidir"
  );

  // 2. SmartboardOverlay: Geometrik şekil silgi çarpışma testi (isItemHitByEraser) ve kilitlenmeyen z-[80]/z-[90] İkon Dock mimarisi
  const { pointToSegmentDistance, isItemHitByEraser } = await import(
    pathToFileURL(
      path.join(
        ROOT_DIR,
        "src",
        "components",
        "classroom",
        "SmartboardOverlay.tsx"
      )
    ).href
  );

  assert.equal(
    Math.round(pointToSegmentDistance({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })),
    10,
    "pointToSegmentDistance doğru parçasına dik uzaklığı doğru hesaplamalıdır"
  );

  // Düz çizgi ve ok silme testi
  const lineEl = {
    id: "line-1",
    kind: "line",
    color: "#ef4444",
    strokeWidth: 4,
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
    ],
  };
  assert.equal(isItemHitByEraser(lineEl, { x: 200, y: 108 }, 14), true);
  assert.equal(isItemHitByEraser(lineEl, { x: 200, y: 160 }, 14), false);

  const arrowEl = {
    id: "arrow-1",
    kind: "arrow",
    color: "#3b82f6",
    strokeWidth: 4,
    points: [
      { x: 100, y: 200 },
      { x: 260, y: 200 },
    ],
  };
  assert.equal(isItemHitByEraser(arrowEl, { x: 255, y: 206 }, 14), true);
  assert.equal(isItemHitByEraser(arrowEl, { x: 50, y: 50 }, 14), false);

  // Dikdörtgen ve kare kenar silme testi (içi boş merkez silinmez, kenar silinir)
  const rectEl = {
    id: "rect-1",
    kind: "rect",
    color: "#10b981",
    strokeWidth: 4,
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 260 },
    ],
  };
  assert.equal(isItemHitByEraser(rectEl, { x: 100, y: 180 }, 14), true, "Dikdörtgen sol kenarı silgiyle yakalanmalıdır");
  assert.equal(isItemHitByEraser(rectEl, { x: 200, y: 180 }, 14), false, "Dikdörtgenin boş iç merkezi uzaktaysa silinmemelidir");

  const squareEl = {
    id: "sq-1",
    kind: "square",
    color: "#f59e0b",
    strokeWidth: 4,
    points: [
      { x: 100, y: 100 },
      { x: 240, y: 220 },
    ],
  };
  assert.equal(isItemHitByEraser(squareEl, { x: 240, y: 160 }, 14), true, "Kare sağ kenarı silgiyle yakalanmalıdır");

  // Üçgen hipotenüs/kenar silme testi
  const triEl = {
    id: "tri-1",
    kind: "triangle",
    color: "#8b5cf6",
    strokeWidth: 4,
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ],
  };
  assert.equal(isItemHitByEraser(triEl, { x: 200, y: 300 }, 14), true, "Üçgen taban kenarı silgiyle yakalanmalıdır");
  assert.equal(isItemHitByEraser(triEl, { x: 150, y: 200 }, 14), true, "Üçgen sol yan kenarı silgiyle yakalanmalıdır");

  // Daire/elips çevre silme testi
  const circleEl = {
    id: "cir-1",
    kind: "circle",
    color: "#ec4899",
    strokeWidth: 4,
    points: [
      { x: 100, y: 100 },
      { x: 300, y: 300 },
    ],
  };
  assert.equal(isItemHitByEraser(circleEl, { x: 300, y: 200 }, 14), true, "Daire sağ tepe çevresi silgiyle yakalanmalıdır");
  assert.equal(isItemHitByEraser(circleEl, { x: 200, y: 200 }, 14), false, "Dairenin boş merkezi silinmemelidir");

  const smartboardCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "classroom",
      "SmartboardOverlay.tsx"
    ),
    "utf8"
  );
  assert.equal(
    smartboardCode.includes("z-[80]") &&
      smartboardCode.includes("z-[90]") &&
      smartboardCode.includes("stopPropagation") &&
      smartboardCode.includes("w-[38px] h-[38px]") &&
      smartboardCode.includes("w-[48px] h-[48px]"),
    true,
    "SmartboardOverlay z-[80]/z-[90] katman izolasyonuna, 38x38 metinsiz İkon Dock butonlarına ve 48x48 küçültülmüş kalem ikonuna sahip olmalıdır"
  );

  // 3. Uygulama genelinde gereksiz 'YENİ' / '✨ Yeni' rozetleri temizlenmiş olmalı
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  assert.equal(
    homeCode.includes('badge: "Yeni"') ||
      homeCode.includes("✨ Yeni") ||
      alistirmalarCode.includes("✨ YENİ") ||
      sozlukCode.includes('>Yeni<'),
    false,
    "Ana Sayfa, Alıştırmalar ve Sözlük ekranlarında gereksiz 'YENİ' rozetleri bulunmamalıdır"
  );
  assert.equal(
    homeCode.includes('badge: "A1-B2"'),
    true,
    "Ana sayfadaki 60 Okuma Metni kartı 'A1-B2' seviye etiketi taşımalıdır"
  );
});

test("21. BÜYÜK İKONLU METİNSİZ ÜST BAR, BAĞIMSIZ SAYAÇ & KURA, AKILLI TAHTA TEK/ÇİFT SIRA + EKRAN SINIR KİLİDİ + 48x48 KALEM İKONU VE ORTALANMIŞ ALIŞTIRMA KARTLARI", async () => {
  // 1. GÖREV 1: Header.tsx tamamı metinsiz 6 büyük ikon (w-11 h-11, size={22}), lg:w-10 lg:h-10 sağ butonlar ve doğrudan Sayaç & Kura erişimi
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  for (const tip of [
    'tooltip: "Ana Sayfa"',
    'tooltip: "Eğitim Kütüphanesi"',
    'tooltip: "Alıştırmalar ve Oyunlar"',
    'tooltip: "Sınav ve Konu Tarama"',
    'tooltip: "İnteraktif Sözlük"',
    'tooltip: "Ayarlar"',
  ]) {
    assert.equal(
      headerCode.includes(tip),
      true,
      `Header.tsx 6 ana navigasyon ikonunda ${tip} bulunmalıdır`
    );
  }
  assert.equal(
    headerCode.includes("w-11 h-11 rounded-xl") &&
      headerCode.includes("size={22}") &&
      headerCode.includes("strokeWidth={isActive ? 2.5 : 2.1}") &&
      !headerCode.includes("<span>{item.label}</span>"),
    true,
    "Header.tsx orta navigasyonu tamamen metinsiz, w-11 h-11 ve size={22} büyük ikonlardan oluşmalıdır"
  );
  assert.equal(
    headerCode.includes("lg:w-10 lg:h-10") &&
      headerCode.includes('data-tooltip="Ders Sayacı ve Sınıf Kurası"') &&
      headerCode.includes("Kronometre &amp; Geri Sayım") &&
      headerCode.includes("Sınıf Kura Çarkı"),
    true,
    "Header.tsx sağ araç grubu lg:w-10 lg:h-10 boyutunda olmalı, Sayaç & Kura hızlı butonunu ve ⋯ menüsünün en üstündeki Kronometre/Kura satırlarını içermelidir"
  );

  // 2. GÖREV 1 & 2.4: Bağımsız Sayaç & Kura Store + SmartboardMount davranışı (çizim aracı kapalıyken çalışabilme)
  const { useClassroomToolsStore } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "store", "classroomToolsStore.ts")
    ).href
  );
  // Başlangıç durumuna sıfırla
  useClassroomToolsStore.setState({
    isOpen: false,
    isCollapsed: false,
    timerOpen: false,
    pickerOpen: false,
    curtainOpen: false,
  });
  useClassroomToolsStore.getState().toggleTimer();
  assert.equal(
    useClassroomToolsStore.getState().timerOpen === true &&
      useClassroomToolsStore.getState().isOpen === false,
    true,
    "toggleTimer() çizim çubuğunu (isOpen) açmaya zorlamadan bağımsız Kronometre penceresini açmalıdır"
  );
  useClassroomToolsStore.getState().togglePicker();
  assert.equal(
    useClassroomToolsStore.getState().pickerOpen === true &&
      useClassroomToolsStore.getState().isOpen === false,
    true,
    "togglePicker() çizim çubuğunu (isOpen) açmaya zorlamadan bağımsız Sınıf Kura Çarkını açmalıdır"
  );
  // Çizim çubuğu açılıp kapatılsa bile bağımsız açık olan Sayaç kapanmamalı
  useClassroomToolsStore.getState().openToolbar("pen");
  useClassroomToolsStore.getState().closeToolbar();
  assert.equal(
    useClassroomToolsStore.getState().isOpen === false &&
      useClassroomToolsStore.getState().timerOpen === true,
    true,
    "Çizim çubuğu kapatıldığında bağımsız çalışan Ders Sayacı kapanmamalıdır"
  );
  useClassroomToolsStore.setState({
    isOpen: false,
    timerOpen: false,
    pickerOpen: false,
  });

  const mountCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "classroom",
      "SmartboardMount.tsx"
    ),
    "utf8"
  );
  assert.equal(
    mountCode.includes("s.isOpen || s.timerOpen || s.pickerOpen || s.curtainOpen"),
    true,
    "SmartboardMount çizim aracı kapalı olsa bile Sayaç veya Kura açıldığında bileşeni yüklemelidir"
  );

  // 3. GÖREV 2 & 4: SmartboardOverlay üst kontrol yerleşimi, 1x/2x Çift Sıra, ResizeObserver sınır kilidi (1280x720, 1366x768, 1536x864, 360x800) ve 48x48 yuvarlak Kalem İkonu
  const { clampBoxToViewport } = await import(
    pathToFileURL(
      path.join(
        ROOT_DIR,
        "src",
        "components",
        "classroom",
        "SmartboardOverlay.tsx"
      )
    ).href
  );

  for (const [vw, vh] of [
    [1280, 720],
    [1366, 768],
    [1536, 864],
    [360, 800],
  ]) {
    // Negatif taşma -> (8, 8)
    const topLeftClamp = clampBoxToViewport(-50, -30, 96, 440, vw, vh);
    assert.deepEqual(topLeftClamp, { x: 8, y: 8 });
    // Sağ/alt taşma -> [vw - w - 8, vh - h - 8]
    const bottomRightClamp = clampBoxToViewport(9999, 9999, 96, 440, vw, vh);
    assert.deepEqual(bottomRightClamp, {
      x: vw - 96 - 8,
      y: vh - 440 - 8,
    });
  }

  const smartboardCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "classroom",
      "SmartboardOverlay.tsx"
    ),
    "utf8"
  );

  // Kontrol butonları (Küçült, Tek/Çift Sıra, Kapat) çizim araçlarından (Gezin / Tıklama Modu) ÖNCE yer almalı
  const minimizeIdx = smartboardCode.indexOf(
    'data-tooltip="Sadece Kalem İkonuna Küçült"'
  );
  const rowToggleIdx = smartboardCode.indexOf(
    'data-tooltip="Tek Sıra / Çift Sıra Görünüm"'
  );
  const closeIdx = smartboardCode.indexOf(
    'data-tooltip="Tahta Araçlarını Kapat"'
  );
  const firstToolIdx = smartboardCode.indexOf('tooltip: "Gezin / Tıklama Modu"');
  assert.equal(
    minimizeIdx > 0 &&
      rowToggleIdx > 0 &&
      closeIdx > 0 &&
      firstToolIdx > closeIdx,
    true,
    "SmartboardOverlay içinde Küçült, Tek/Çift Sıra ve Kapat butonları listenin en üstünde/başında yer almalıdır"
  );

  assert.equal(
    smartboardCode.includes("new ResizeObserver") &&
      smartboardCode.includes("grid-cols-2 gap-1.5") &&
      smartboardCode.includes("w-[48px] h-[48px] rounded-full") &&
      smartboardCode.includes(
        'data-tooltip="Çizim Araçlarını Aç (Taşımak için sürükleyin)"'
      ) &&
      smartboardCode.includes("⏳ Geri Sayım") &&
      smartboardCode.includes("⏱️ Kronometre") &&
      smartboardCode.includes('{ sec: 600, label: "10 dk" }'),
    true,
    "SmartboardOverlay ResizeObserver kilidine, Çift Sıra (grid-cols-2) düzenine, 48x48 yuvarlak Kalem ikonuna ve 10 dk dahil çift sekmeli sürüklenebilir Sayaca sahip olmalıdır"
  );

  // 4. GÖREV 3: Alıştırmalar sayfasında son satır kartlarının ortalanması (flex flex-wrap justify-center gap-3.5)
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    alistirmalarCode.includes(
      "flex flex-wrap justify-center items-stretch gap-3.5"
    ) &&
      alistirmalarCode.includes(
        "w-full sm:w-[calc(50%-0.4375rem)] lg:w-[calc(25%-0.65625rem)]"
      ),
    true,
    "Alıştırmalar sayfasındaki modül kartları flex-wrap justify-center gap-3.5 ile son satırı simetrik ortalamalıdır"
  );
});

test("22) Ders Sayacı Otomatik Kompakt Saat Görünümü (Mini HUD): isTimerCompact, transparan buzlu cam kapsül, tabular-nums okunabilirlik, 2px ilerleme barı ve kontrol ikonları", () => {
  const smartboardCode = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "classroom",
      "SmartboardOverlay.tsx"
    ),
    "utf8"
  );

  // 1. Başlık kısalığı ("Ders Sayacı") ve yarıda kesilen uzun başlığın kaldırılması
  assert.equal(
    smartboardCode.includes("<span>Ders Sayacı</span>") &&
      !smartboardCode.includes("<span>Ders Sayacı &amp; Kronometre</span>") &&
      !smartboardCode.includes("<span>Ders Sayacı & Kronometre</span>"),
    true,
    "Tam kart başlığı kesilmemesi için 'Ders Sayacı' olmalı, uzun 'Ders Sayacı & Kronometre' başlığı kaldırılmalıdır"
  );

  // 2. isTimerCompact state, Başlat ile otomatik geçiş ve başlık çubuğunda Küçült (Minimize2) ikonu
  assert.equal(
    smartboardCode.includes("const [isTimerCompact, setIsTimerCompact] = useState<boolean>(false)") &&
      smartboardCode.includes("setTimerRunning(true);\n                      setIsTimerCompact(true);") &&
      smartboardCode.includes('data-tooltip="Kompakt Saat Görünümü"') &&
      smartboardCode.includes("<Minimize2 size={15} />"),
    true,
    "Sayaç başlatıldığında otomatik olarak isTimerCompact = true olmalı ve tam kart başlığında Minimize2 küçültme ikonu bulunmalıdır"
  );

  // 3. Kompakt Saat Kapsülü görsel kontrastı, tabular-nums rakam okunabilirliği, son 10/5 sn uyarıları ve 2px alt ilerleme çizgisi
  assert.equal(
    smartboardCode.includes(
      "bg-slate-900/78 dark:bg-slate-950/82 backdrop-blur-md border shadow-xl rounded-2xl px-3.5 py-2 text-white select-none"
    ) &&
      smartboardCode.includes(
        "font-mono tabular-nums font-extrabold text-2xl sm:text-3xl tracking-wider leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
      ) &&
      smartboardCode.includes("text-rose-400 animate-pulse") &&
      smartboardCode.includes("text-amber-300") &&
      smartboardCode.includes("border-amber-400 ring-2 ring-amber-400/60") &&
      smartboardCode.includes("h-[2px] rounded-full bg-white/15"),
    true,
    "Kompakt kapsül buzlu cam arka plana, tabular-nums gölgeli rakamlara, son 10/5 sn renk uyarılarına ve 2px alt ilerleme barına sahip olmalıdır"
  );

  // 4. Kompakt görünüm metinsiz kontrol ikonları, tooltip'ler ve gövdeden sürükleme + ResizeObserver/Viewport Clamp uyumu
  assert.equal(
    smartboardCode.includes('data-tooltip="Duraklat / Devam Et"') &&
      smartboardCode.includes('data-tooltip="Sıfırla / Baştan Başlat"') &&
      smartboardCode.includes('data-tooltip="Sayaç Kartını Tam Aç"') &&
      smartboardCode.includes('data-tooltip="Sayacı Kapat"') &&
      smartboardCode.includes("<Maximize2 size={15}") &&
      smartboardCode.includes("[timerOpen, timerMode, isTimerCompact, enforceTimerInViewport]"),
    true,
    "Kompakt kapsül 4 metinsiz kontrol ikonuna (Duraklat/Devam Et, Sıfırla, Tam Aç, Kapat) ve isTimerCompact değişiminde Viewport Clamp korumasına sahip olmalıdır"
  );
});

test("23. Yan Yana Gramer (Split-View Grammar Panel) — Tekil Durum Makinesi, 2 Sütunlu Grid & Mobil Çekmece, 2 Satırlı Kompakt Üst Bar ve Parantezli Arapça Kırılmazlığı (/diyalog/[id] & /metin/[id])", async () => {
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  const storeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "store", "classroomToolsStore.ts"),
    "utf8"
  );
  const stopperCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "AudioStopper.tsx"),
    "utf8"
  );
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  const dialoguePageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const readingPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );

  // 1. Üst Header z-50 ve --header-height CSS değişkeni (48px / 56px)
  assert.equal(
    headerCode.includes("fixed top-0 left-0 right-0 z-50") &&
      globalsCss.includes("--header-height: 48px;") &&
      globalsCss.includes("--header-height: 56px;"),
    true,
    "Header z-50 olmalı ve globals.css --header-height (48px / 56px) tanımlamalıdır"
  );

  // 2. Store & Rota Koruyucusu (Kural D: Ders dışına çıkınca kapat, dersler arası geçişte açık tut)
  assert.equal(
    storeCode.includes("isGrammarSplitOpen: boolean;") &&
      storeCode.includes('export type GrammarSplitSide = "left" | "right";') &&
      storeCode.includes("toggleGrammarSplitSide: () => void;") &&
      stopperCode.includes(
        'pathname.startsWith("/diyalog/") || pathname.startsWith("/metin/")'
      ) &&
      stopperCode.includes("setGrammarSplitOpen(false)"),
    true,
    "classroomToolsStore yan panel durumunu tutmalı ve AudioStopper yalnızca ders detay rotaları dışında paneli kapatmalıdır"
  );

  // 3. Diyalog ve Okuma Metni Birebir Eşitlik & Sıfır Çift Kart (Kural A, B, C + 2 Sütunlu CSS Grid)
  for (const [label, pageCode] of [
    ["diyalog/[id]", dialoguePageCode],
    ["metin/[id]", readingPageCode],
  ]) {
    assert.equal(
      pageCode.includes("const handleToggleGrammarSplit = useCallback") &&
        pageCode.includes(
          'isGrammarSplitOpen ? "Gramer Panelini Kapat" : "Yan Yana Gramer"'
        ) &&
        pageCode.includes("aria-pressed={isGrammarSplitOpen}") &&
        pageCode.includes('if (tab.id === "gramer" && isGrammarSplitOpen)') &&
        pageCode.includes(
          'studyMode === "gramer" && !isGrammarSplitOpen && grammarNote'
        ) &&
        pageCode.includes("lg:grid-cols-[400px_minmax(0,1fr)]") &&
        pageCode.includes("lg:grid-cols-[minmax(0,1fr)_400px]") &&
        pageCode.includes("<LessonGrammarSplitPanel") &&
        pageCode.includes("onOpenSplitView={() => {") &&
        !pageCode.includes("yan tarafta açık tutmak ister misiniz?") &&
        !pageCode.includes("isGrammarQuickModalOpen"),
      true,
      `${label} sayfası gerçek toggle, çift kart yasağı, 2 sütunlu CSS Grid, sarı şerit temizliği ve LessonGrammarSplitPanel entegrasyonuna sahip olmalıdır`
    );
  }

  // 4. LessonGrammarSplitPanel: Header altı sticky masaüstü, <1024px max-h-[82dvh] alt çekmece ve 2 satırlı kompakt üst bar
  assert.equal(
    grammarPanelCode.includes("export function LessonGrammarSplitPanel") &&
      grammarPanelCode.includes("max-h-[82dvh]") &&
      grammarPanelCode.includes("bg-black/45") &&
      grammarPanelCode.includes(
        "lg:sticky lg:inset-auto lg:top-[calc(var(--header-height,56px)+12px)]"
      ) &&
      grammarPanelCode.includes('data-tooltip="Paneli Sola / Sağa Al"') &&
      grammarPanelCode.includes('data-tooltip="Tam Ekran Görünümüne Geç"') &&
      grammarPanelCode.includes('data-tooltip="Yan Paneli Kapat (ESC)"') &&
      grammarPanelCode.includes("grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100 dark:bg-slate-800") &&
      grammarPanelCode.includes("Metinle Yan Yana Aç") &&
      grammarPanelCode.includes("hideLessonSelfLink={true}"),
    true,
    "LessonGrammarSplitPanel 2 satırlı kompakt üst bara, ESC/çekmece desteğine, duplike rozet/ders linki gizlemesine ve Metinle Yan Yana Aç aksiyonuna sahip olmalıdır"
  );

  // 5. Parantezli Arapça ifadelerin satır sonunda '(' yetim bırakmaması (tokenizeTurkishWithParentheticalArabic + whitespace-nowrap)
  assert.equal(
    grammarPanelCode.includes("export function tokenizeTurkishWithParentheticalArabic") &&
      grammarPanelCode.includes('kind: "paren-arabic"') &&
      grammarPanelCode.includes('kind: "bound-arabic"') &&
      grammarPanelCode.includes("inline-block whitespace-nowrap font-arabic mx-0.5"),
    true,
    "Parantezli Arapça kalıplar inline-block whitespace-nowrap font-arabic ile tek blok olarak sarılmalıdır"
  );
});

test("24. Sınıf / Tahta Modu (isClassroomMode) — createPortal ile Viewport Sabit Alt Kontrol Çubuğu ve Telefon (< 768px) Koruması (/diyalog/[id] & /metin/[id])", async () => {
  const dialoguePageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const readingPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );

  for (const [label, pageCode] of [
    ["diyalog/[id]", dialoguePageCode],
    ["metin/[id]", readingPageCode],
  ]) {
    // 1. createPortal(..., document.body) + fixed bottom-5 left-1/2 -translate-x-1/2 z-40 + pb-28
    assert.equal(
      pageCode.includes('import { createPortal } from "react-dom";') &&
        pageCode.includes("createPortal(") &&
        pageCode.includes("document.body") &&
        pageCode.includes(
          "hidden md:flex print:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40"
        ) &&
        pageCode.includes(
          'isClassroomMode ? "pb-28" : "pb-28 md:pb-10"'
        ) &&
        pageCode.includes("px-1 sm:px-4 md:px-8 pb-28 transition-all duration-300"),
      true,
      `${label} Sınıf Modu alt çubuğu createPortal ile document.body altına fixed bottom-5 left-1/2 -translate-x-1/2 z-40 olarak sabitlenmeli ve pb-28 alt boşluk sağlamalıdır`
    );

    // 2. Telefon ekranlarında (< 768px) buton ve barların gizlenmesi + otomatik kapanma
    assert.equal(
      pageCode.includes(
        "hidden md:inline-flex px-2.5 py-1.5 rounded-xl border text-xs font-extrabold items-center gap-1 transition-all cursor-pointer shrink-0"
      ) &&
        pageCode.includes(
          "hidden md:flex print:hidden rounded-2xl bg-gradient-to-r from-emerald-900"
        ) &&
        pageCode.includes("window.innerWidth < 768") &&
        pageCode.includes("setIsClassroomMode(false);"),
      true,
      `${label} telefon ekranlarında (< 768px) Sınıf/Tahta Modu buton ve panellerini gizlemeli ve isClassroomMode durumunu otomatik kapatmalıdır`
    );
  }
});

test("25. Konu Tarama Testi (KTT) — Tekil Ana Seviye (primaryLevel), Net Konu/Soru Filtreleri, Pedagojik Sıralama, Dinamik 10/Tüm Sorular Butonu ve Dinamik Konu Başlıkları", async () => {
  const { parsed: bank } = readDataJson("seviye_tespit_sorulari.json");
  const { buildDynamicAssessmentTopics } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );

  const topics = buildDynamicAssessmentTopics(bank);
  const validLevels = ["A1", "A2", "B1", "B2"];
  const rank = { A1: 0, A2: 1, B1: 2, B2: 3 };

  // 1. Her üst konuya tek bir primaryLevel atanmalı ve A1+A2+B1+B2 toplamı Tümü (topics.length) ile birebir eşit olmalı
  const byLevel = {
    A1: topics.filter((t) => t.primaryLevel === "A1"),
    A2: topics.filter((t) => t.primaryLevel === "A2"),
    B1: topics.filter((t) => t.primaryLevel === "B1"),
    B2: topics.filter((t) => t.primaryLevel === "B2"),
  };
  assert.equal(
    byLevel.A1.length + byLevel.A2.length + byLevel.B1.length + byLevel.B2.length,
    topics.length,
    "A1 + A2 + B1 + B2 konu sayılarının toplamı Tümü (topics.length) ile birebir eşit olmalıdır"
  );

  for (const t of topics) {
    assert.ok(validLevels.includes(t.primaryLevel), `${t.ust_konu} tekil bir CEFR primaryLevel değerine sahip olmalıdır`);
    assert.equal(t.levelRange, t.primaryLevel, `${t.ust_konu} levelRange tekil primaryLevel olmalıdır`);
  }

  // Pedagojik eşitlik kırılımı kontrolü: Günlük Kelime ve Bağlam -> A1, Okuduğunu Anlama -> A2
  const vocabTopic = topics.find((t) => t.ust_konu === "Günlük Kelime ve Bağlam");
  const readingTopic = topics.find((t) => t.ust_konu === "Okuduğunu Anlama");
  assert.equal(vocabTopic?.primaryLevel, "A1");
  assert.equal(readingTopic?.primaryLevel, "A2");

  // 2. Seviye bazlı toplam soru sayıları bölünmeden tüm havuza eşit olmalı
  const totalQSum = topics.reduce((sum, t) => sum + t.questionCount, 0);
  assert.equal(totalQSum, bank.length, "Konu soru sayılarının toplamı soru bankası toplamına eşit olmalıdır");

  // 3. Pedagojik sıralama: A1 -> A2 -> B1 -> B2; aynı seviyede sarf_nahiv konuları önce, genel beceri konuları en sonda
  for (let i = 1; i < topics.length; i++) {
    const prev = topics[i - 1];
    const curr = topics[i];
    assert.ok(
      rank[prev.primaryLevel] <= rank[curr.primaryLevel],
      `Kartlar A1 -> A2 -> B1 -> B2 sırasıyla dizilmelidir (${prev.ust_konu} [${prev.primaryLevel}] -> ${curr.ust_konu} [${curr.primaryLevel}])`
    );
    if (prev.primaryLevel === curr.primaryLevel) {
      assert.ok(
        !(prev.isGeneralSkill && !curr.isGeneralSkill),
        `Aynı seviyede genel beceri konusu (${prev.ust_konu}) dilbilgisi konusundan (${curr.ust_konu}) önce gelmemelidir`
      );
    }
  }
  assert.equal(
    byLevel.A1[byLevel.A1.length - 1]?.ust_konu,
    "Günlük Kelime ve Bağlam",
    "A1 seviyesinin en sonunda 'Günlük Kelime ve Bağlam' yer almalıdır"
  );
  assert.equal(
    byLevel.A2[byLevel.A2.length - 1]?.ust_konu,
    "Okuduğunu Anlama",
    "A2 seviyesinin en sonunda 'Okuduğunu Anlama' yer almalıdır"
  );

  // 4 & 5. seviye-tespit/page.tsx: Filtre rozetleri, tekil primaryLevel rozeti, dinamik buton metni ve sabit sayı olmaması
  const pageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    pageCode.includes("t.primaryLevel !== topicLevelFilter") &&
      pageCode.includes("{labelPrefix} ({stats.topicCount} Konu)") &&
      pageCode.includes("{stats.questionCount} Soru") &&
      pageCode.includes("{topic.primaryLevel}") &&
      !pageCode.includes("t.levelCounts[lvl] > 0") &&
      !pageCode.includes("preferredLevel !== \"ALL\""),
    true,
    "KTT filtreleri primaryLevel üzerinden çalışmalı, konu+soru sayılarını göstermeli ve konu havuzunu bölmemelidir"
  );
  assert.equal(
    pageCode.includes("`${Math.min(10, qCount)} Soruluk Tarama Başlat`") &&
      pageCode.includes("`Tüm Soruları Çöz (${qCount} Soru)`") &&
      !pageCode.includes("Sorunun Tümünü Çöz"),
    true,
    "KTT kart butonları '10 Soruluk Tarama Başlat' ve 'Tüm Soruları Çöz (X Soru)' metinlerini dinamik göstermelidir"
  );
  assert.equal(
    !pageCode.includes("29 Konu") &&
      !pageCode.includes("29 Üst Konu") &&
      !pageCode.includes("13 Konu") &&
      pageCode.includes("{uniqueTopics.length} Konu Tarama") &&
      pageCode.includes("{uniqueTopics.length} Üst Konu Tarama Testi"),
    true,
    "KTT başlık ve sekmeleri sabit sayı yerine dinamik uniqueTopics.length kullanmalıdır"
  );
});



