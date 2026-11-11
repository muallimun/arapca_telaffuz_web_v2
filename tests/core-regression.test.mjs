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

