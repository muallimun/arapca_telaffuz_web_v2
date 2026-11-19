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

function toCanonicalArabicShaddaNfc(str) {
  return str.normalize("NFC").replace(/([\u064B-\u0650])\u0651/g, "\u0651$1");
}

function collectStrings(node, out = [], keyName = "") {
  if (typeof node === "string") {
    out.push({ text: node, keyName });
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out, keyName);
  } else if (node && typeof node === "object") {
    for (const [k, val] of Object.entries(node)) collectStrings(val, out, k);
  }
  return out;
}

test("1. Tüm 8 JSON dosyası hatasız parse edilir, 0 tatweel (\\u0640) içerir ve %100 NFC + kanonik şedde+hareke formundadır", () => {
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

    const entries = collectStrings(parsed);
    for (const { text: str, keyName } of entries) {
      if (keyName === "yanlis") continue;
      assert.equal(
        str,
        toCanonicalArabicShaddaNfc(str),
        `${fileName} içinde kanonik NFC+şedde formunda olmayan metin bulundu: ${str.slice(0, 40)}`
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
    toCanonicalArabicShaddaNfc("اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ."),
    "dlg_007 5. satır hemze-i vasıl ve sıra sayısıyla düzeltilmiş olmalıdır"
  );

  const dlg020 = diyaloglar.find((d) => d.id === "dlg_020");
  assert.equal(
    JSON.stringify(dlg020).includes(toCanonicalArabicShaddaNfc("تَنْصَحِينَنِي")),
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
    if (
      specifier === "next/dynamic" ||
      specifier === "next/link" ||
      specifier === "next/navigation" ||
      specifier === "next/image"
    ) {
      return nextResolve(`${specifier}.js`, context);
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

test("8. FAZ 3 — Yerel Arapça font varlığı (Arakom.ttf), lisans kısıtlı/mükerrer fontların kaldırılması ve globals.css @font-face doğrulaması", () => {
  const arakomPath = path.join(ROOT_DIR, "public", "fonts", "Arakom.ttf");
  const winsoftPath = path.join(
    ROOT_DIR,
    "public",
    "fonts",
    "WinSoftPro-Med.otf"
  );
  const dupDataFontsDir = path.join(ROOT_DIR, "src", "data", "fonts");

  assert.equal(
    fs.existsSync(arakomPath),
    true,
    "public/fonts/Arakom.ttf mevcut olmalıdır"
  );
  assert.ok(
    fs.statSync(arakomPath).size > 50_000,
    "public/fonts/Arakom.ttf geçerli boyutta olmalıdır"
  );
  assert.equal(
    fs.existsSync(winsoftPath),
    false,
    "Lisans kısıtlı public/fonts/WinSoftPro-Med.otf silinmiş olmalıdır"
  );
  assert.equal(
    fs.existsSync(dupDataFontsDir),
    false,
    "Mükerrer src/data/fonts klasörü tamamen silinmiş olmalıdır"
  );

  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  assert.equal(globalsCss.includes("/fonts/WinSoftPro-Med.otf"), false);
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
  const { ASSESSMENT_TOPICS, buildDynamicAssessmentTopics } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );

  assert.ok(Array.isArray(parsed), "seviye_tespit_sorulari.json dizi olmalıdır");
  assert.ok(parsed.length >= 180, "Toplam soru sayısı en az 180 olmalıdır");
  assert.equal(
    raw.includes("\u0640"),
    false,
    "seviye_tespit_sorulari.json içinde tatweel (\\u0640) bulunmamalıdır"
  );

  const entries = collectStrings(parsed);
  for (const { text: s, keyName } of entries) {
    if (keyName === "yanlis") continue;
    assert.equal(
      s,
      toCanonicalArabicShaddaNfc(s),
      `seviye_tespit_sorulari.json içinde kanonik NFC+şedde olmayan metin bulundu: ${s.slice(0, 40)}`
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

  for (const baseTopic of ASSESSMENT_TOPICS) {
    assert.equal(
      seenTopics.has(baseTopic.ust_konu),
      true,
      `Temel müfredat üst konusu soru bankasında bulunmalıdır: ${baseTopic.ust_konu}`
    );
  }
  const dynamicTopics = buildDynamicAssessmentTopics(parsed);
  assert.equal(
    seenTopics.size,
    dynamicTopics.length,
    "Üst konu sayısı buildDynamicAssessmentTopics ile birebir eşleşmelidir"
  );
  assert.deepEqual(
    seenTopics,
    new Set(dynamicTopics.map((t) => t.ust_konu))
  );
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

  // Kategori filtre sekmeleri (5 sekmeli yeni vitrin mimarisi)
  assert.equal(alistirmalarCode.includes("Görsel Oyunlar"), true);
  assert.equal(alistirmalarCode.includes("Kelime & Kartlar"), true);
  assert.equal(alistirmalarCode.includes("Gramer & İ'rab"), true);
  assert.equal(alistirmalarCode.includes("Dinleme, Diyalog & Sınıf"), true);

  // CONTENT_INVENTORY.exerciseModulesCount === 18
  const dataTsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "data.ts"),
    "utf8"
  );
  const contentInvCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "contentInventory.ts"),
    "utf8"
  );
  assert.equal(
    (dataTsCode.includes("CONTENT_INVENTORY") &&
      contentInvCode.includes("exerciseModulesCount: 18")) ||
      dataTsCode.includes("exerciseModulesCount: 18"),
    true,
    "CONTENT_INVENTORY.exerciseModulesCount 18 olarak güncellenmelidir"
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
  assert.equal(CONTENT_INVENTORY.assessmentQuestionsCount, 550);
  assert.equal(CONTENT_INVENTORY.exerciseModulesCount, 18);

  const layoutSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  assert.equal(
    layoutSrc.includes(
      "${CONTENT_INVENTORY.assessmentQuestionsCount} soruluk Seviye Tespit ve Konu Tarama Merkezi"
    ) && layoutSrc.includes("modüllü interaktif alıştırma merkezi"),
    true,
    "layout.tsx APP_FULL_DESCRIPTION güncel 550 soruluk Seviye Tespit ve Konu Tarama Merkezi ve 14 modüllü alıştırma bilgisini içermelidir"
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

  // Ana sayfa 18 Farklı Modül ve Günün 6 Kelimesi tam genişlik Arapça satır
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  assert.equal(
    homeCode.includes("18 Farklı Modül • Görsel & Sesli"),
    true,
    "Ana sayfa Kelime Alıştırmaları kartı '18 Farklı Modül • Görsel & Sesli' göstermelidir"
  );
  assert.equal(
    /(?<![0-9])6 Farklı Modül • Görsel & Sesli/.test(homeCode),
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

test("26. ek_gramer_hap_bilgi.json entegrasyonu: 195 Hap Bilgi kartı, seviye/ktt_ust_konu alanları ve KTT bağlantısı", async () => {
  const ekGramerRaw = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "ek_gramer_hap_bilgi.json"),
      "utf8"
    )
  );
  const dlgGramerRaw = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "diyaloglar_gramer_hap_bilgi.json"),
      "utf8"
    )
  );
  const txtGramerRaw = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "metinler_gramer_hap_bilgi.json"),
      "utf8"
    )
  );

  assert.equal(ekGramerRaw.length, 15, "ek_gramer_hap_bilgi.json 15 müstakil kart içermelidir");
  assert.equal(
    ekGramerRaw.length + dlgGramerRaw.length + txtGramerRaw.length,
    195,
    "Toplam Hap Bilgi kart sayısı 195 (15 + 120 + 60) olmalıdır"
  );

  const validLevels = ["A1", "A2", "B1", "B2"];
  ekGramerRaw.forEach((card, idx) => {
    const expectedId = `grm_${String(idx + 1).padStart(3, "0")}`;
    assert.equal(card.bagli_id, expectedId, `Kart ID ${expectedId} olmalıdır`);
    assert.ok(validLevels.includes(card.seviye), `${card.bagli_id} doğrudan geçerli seviye alanına sahip olmalıdır`);
    assert.ok(
      typeof card.ktt_ust_konu === "string" && card.ktt_ust_konu.trim().length > 0,
      `${card.bagli_id} doğrudan ktt_ust_konu alanına sahip olmalıdır`
    );
  });

  const dataTsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "data.ts"),
    "utf8"
  );
  assert.equal(
    dataTsCode.includes("@/data/ek_gramer_hap_bilgi.json") &&
      dataTsCode.includes("export const ekGramerNotlari") &&
      dataTsCode.includes("ekGramerNotlari.length +"),
    true,
    "src/lib/data.ts ek_gramer_hap_bilgi.json verisini dahil etmeli ve grammarNoteCount hesabına katmalıdır"
  );

  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    kutuphaneCode.includes("`Tümü (${grammarDomainCounts.all})`") &&
      kutuphaneCode.includes("gItem.kttUstKonu") &&
      kutuphaneCode.includes("Bu Konunun Tarama Testini Çöz") &&
      kutuphaneCode.includes("/seviye-tespit?mode=topic&topic=${encodeURIComponent("),
    true,
    "Kütüphane Gramer sayfası 195 kartı, ktt_ust_konu etiketini ve 'Bu Konunun Tarama Testini Çöz' butonunu içermelidir"
  );

  const panelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  assert.equal(
    panelCode.includes("...ekGramerNotlari") &&
      panelCode.includes('targetId.startsWith("grm_")') &&
      panelCode.includes("Bu Konunun Tarama Testini Çöz") &&
      panelCode.includes("/seviye-tespit?mode=topic&topic=${encodeURIComponent("),
    true,
    "GrammarHapBilgiPanel grm_ kartlarının seviye ve ktt_ust_konu alanlarını doğrudan okumalı ve KTT bağlantı butonunu göstermelidir"
  );
});

test("27. Gramer Atlası Seçenek A 4 alanlı tasnif, A4 Ders Föyü PDF, Toplu Kur Kitapçığı PDF ve WhatsApp doğrudan kart paylaşımı", async () => {
  const taxonomyMod = await import(
    path.join(ROOT_DIR, "src", "lib", "grammarTaxonomy.ts")
  );
  const ekGramerNotlari = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "ek_gramer_hap_bilgi.json"),
      "utf8"
    )
  );
  const diyalogGramerNotlari = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "diyaloglar_gramer_hap_bilgi.json"),
      "utf8"
    )
  );
  const metinGramerNotlari = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "metinler_gramer_hap_bilgi.json"),
      "utf8"
    )
  );
  const diyaloglar = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "tum_diyaloglar_120.json"),
      "utf8"
    )
  );
  const metinler = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "tum_metinler_60.json"),
      "utf8"
    )
  );

  const catalog = taxonomyMod.buildUnifiedGrammarAtlasCatalog({
    ekGramerNotlari,
    diyalogGramerNotlari,
    metinGramerNotlari,
    diyaloglar,
    metinler,
  });
  assert.equal(catalog.length, 195, "Birleşik Gramer Atlası kataloğu 195 kart içermelidir");

  const counts = {};
  for (const domainId of taxonomyMod.GRAMMAR_DOMAIN_ORDER) {
    counts[domainId] = catalog.filter((item) => item.domainId === domainId).length;
    assert.ok(counts[domainId] > 0, `${domainId} alanında en az 1 kart bulunmalıdır`);
  }
  const sumCounts = Object.values(counts).reduce((acc, val) => acc + val, 0);
  assert.equal(
    sumCounts,
    195,
    "4 dil bilimsel alanın kart sayıları toplamı eksiksiz 195 olmalıdır"
  );

  // Pedagojik sıralama kontrolü (A1 -> A2 -> B1 -> B2)
  const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 };
  for (let i = 1; i < catalog.length; i++) {
    assert.ok(
      levelRank[catalog[i].level] >= levelRank[catalog[i - 1].level],
      "Gramer Atlası kartları pedagojik kur sırasına (A1 -> A2 -> B1 -> B2) göre dizilmelidir"
    );
  }

  // WhatsApp paylaşım formatı ve #card= hash doğrudan kart linki kontrolü
  const sampleCard = ekGramerNotlari[0];
  const waText = taxonomyMod.buildGrammarWhatsAppText(sampleCard);
  assert.ok(waText.includes("📌 *Muallimun Arapça Gramer Atlası*"));
  assert.ok(waText.includes(`*📚 Konu:* ${sampleCard.konu_basligi}`));
  assert.ok(waText.includes("*💡 Hap Kural:*"));
  assert.ok(waText.includes("*📐 Formül:*"));
  assert.ok(waText.includes("*🎯 Örnek:*"));
  assert.ok(
    waText.includes(
      `https://arapcatellaffuzwebv2.vercel.app/kutuphane#card=${sampleCard.bagli_id}`
    )
  );
  assert.equal(
    taxonomyMod.buildGrammarCardDeepLink("grm_005", "https://custom.vercel.app"),
    "https://custom.vercel.app/kutuphane#card=grm_005"
  );
  assert.equal(
    taxonomyMod.extractGrammarCardIdFromUrl("#card=grm_007", ""),
    "grm_007"
  );
  assert.equal(
    taxonomyMod.extractGrammarCardIdFromUrl("", "?tab=gramer&card=grm_012"),
    "grm_012"
  );

  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    !kutuphaneCode.includes("Temel & İleri Gramer") &&
      !kutuphaneCode.includes("Diyalog Grameri (") &&
      !kutuphaneCode.includes("Metin Grameri (") &&
      !kutuphaneCode.includes("Müstakil Gramer"),
    true,
    "Yapay kaynak sekmeleri ve teknik kaynak rozetleri kaldırılmış olmalıdır"
  );
  assert.equal(
    kutuphaneCode.includes("GRAMMAR_DOMAIN_ORDER") &&
      kutuphaneCode.includes("🖨️ A4 Ders Föyü (PDF)") &&
      kutuphaneCode.includes("📑 Kur Kitapçığı İndir (PDF)") &&
      kutuphaneCode.includes("📲 WhatsApp") &&
      kutuphaneCode.includes("extractGrammarCardIdFromUrl") &&
      kutuphaneCode.includes("window.location.hash") &&
      kutuphaneCode.includes('"hashchange"') &&
      kutuphaneCode.includes("scrollIntoView"),
    true,
    "Kütüphane sayfası #card= hash yönlendirmesi, hashchange dinleyicisi, scrollIntoView ve otomatik detay paneli açılışını desteklemelidir"
  );

  const pdfGenCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "grammarPdfGenerator.ts"),
    "utf8"
  );
  assert.equal(
    pdfGenCode.includes("size: A4 portrait") &&
      pdfGenCode.includes("printSingleGrammarSheetPdf") &&
      pdfGenCode.includes("printGrammarBookletPdf") &&
      pdfGenCode.includes("booklet-cover") &&
      pdfGenCode.includes("toc-section") &&
      pdfGenCode.includes("Temel Kural Özeti") &&
      pdfGenCode.includes("Görsel Formül Şeması") &&
      pdfGenCode.includes("Karşılaştırmalı Özet Tablo") &&
      pdfGenCode.includes("Sık Yapılan Hatalar"),
    true,
    "PDF üretici modül A4 dikey düzen, kapak + içindekiler, tekli ders föyü ve 7 kutulu gramer anlatım bölümlerini içermelidir"
  );
});

test("28. Sözlük & Kur'ân Köprüsü Performans ve Sayfalama Mimarisi ([25, 50, 100, 500, Tümü], varsayılan 50, akıllı sayfalama ve O(1) önbellek)", async () => {
  const {
    DEFAULT_ITEMS_PER_PAGE,
    ITEMS_PER_PAGE_OPTIONS,
    buildPaginationTokens,
    paginateDictionaryItems,
  } = await import("../src/lib/dictionaryPagination.ts");

  assert.equal(
    DEFAULT_ITEMS_PER_PAGE,
    50,
    "Varsayılan sayfa başına gösterim sayısı 50 olmalıdır"
  );

  assert.deepEqual(
    ITEMS_PER_PAGE_OPTIONS.map((opt) => opt.value),
    [25, 50, 100, 500, "all"],
    "Sayfa başına gösterim seçenekleri [25, 50, 100, 500, Tümü] olmalıdır"
  );

  const mockDataset = Array.from({ length: 3335 }, (_, idx) => ({
    id: `w_${idx + 1}`,
  }));

  const page1 = paginateDictionaryItems(mockDataset, 1, 50);
  assert.equal(page1.totalPages, 67, "3.335 kayıt 50'şerli 67 sayfa olmalıdır");
  assert.equal(page1.items.length, 50, "1. sayfada tam 50 kayıt yer almalıdır");
  assert.equal(page1.startIndex, 0);
  assert.equal(page1.endIndex, 50);
  assert.equal(
    page1.tokens.length <= 7,
    true,
    "Akıllı sayfalama dizisi mobilde taşmaması için en fazla 7 elemanlı olmalıdır"
  );

  const lastPage = paginateDictionaryItems(mockDataset, 999, 50);
  assert.equal(
    lastPage.currentPage,
    67,
    "Aralık dışı sayfa isteği güvenli biçimde son sayfaya sabitlenmelidir"
  );
  assert.equal(
    lastPage.items.length,
    35,
    "Son sayfada kalan 35 kayıt gösterilmelidir"
  );

  const midTokens = buildPaginationTokens(15, 67);
  assert.deepEqual(midTokens, [
    1,
    "ellipsis-left",
    14,
    15,
    16,
    "ellipsis-right",
    67,
  ]);

  const allItemsResult = paginateDictionaryItems(mockDataset, 3, "all");
  assert.equal(allItemsResult.totalPages, 1);
  assert.equal(allItemsResult.currentPage, 1);
  assert.equal(allItemsResult.items.length, 3335);

  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );

  assert.equal(
    !sozlukCode.includes("IntersectionObserver") &&
      !sozlukCode.includes("visibleCount"),
    true,
    "Eski sonsuz kaydırma (IntersectionObserver / visibleCount) kaldırılmış olmalıdır"
  );

  assert.equal(
    sozlukCode.includes("paginateDictionaryItems") &&
      sozlukCode.includes("Sayfa Başına Göster:") &&
      sozlukCode.includes("« Önceki") &&
      sozlukCode.includes("Sonraki »") &&
      sozlukCode.includes("setCurrentPage(1)") &&
      sozlukCode.includes("useDeferredValue") &&
      sozlukCode.includes("preparedMetaMap") &&
      sozlukCode.includes("showClassicalBridgePanel"),
    true,
    "Sözlük sayfası dilimli sayfalama, Sayfa Başına Göster seçicisi, O(1) meta önbelleği ve hızlı Kur'ân Köprüsü panelini içermelidir"
  );
});

test("29. Depo Hijyeni: Mükerrer varlık/paket temizliği, metadata.json korunumu ve güncel sayaç metinleri", () => {
  // 1. metadata.json korunmalı ve mikrofon izni içermelidir
  const metadataPath = path.join(ROOT_DIR, "metadata.json");
  assert.equal(fs.existsSync(metadataPath), true, "metadata.json silinmemelidir");
  const metadataJson = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  assert.deepEqual(metadataJson.requestFramePermissions, ["microphone"]);
  assert.equal(
    metadataJson.description.includes(
      "120 Diyalog, 60 Okuma Metni, 195 Gramer Notu ve 18 Modüllü Alıştırma Merkezi"
    ),
    true
  );

  // 2. Silinmesi gereken şablon ikonları, mükerrer favicon ve atıl SettingsContext
  for (const relPath of [
    "public/file.svg",
    "public/globe.svg",
    "public/next.svg",
    "public/vercel.svg",
    "public/window.svg",
    "src/app/favicon.ico",
    "src/context/SettingsContext.tsx",
    "src/data/fonts",
    "public/fonts/WinSoftPro-Med.otf",
  ]) {
    assert.equal(
      fs.existsSync(path.join(ROOT_DIR, relPath)),
      false,
      `${relPath} silinmiş olmalıdır`
    );
  }

  // 3. package.json: wavesurfer.js kaldırılmış ve açıklama güncellenmiş olmalı
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")
  );
  assert.equal(
    "wavesurfer.js" in (pkgJson.dependencies || {}),
    false,
    "wavesurfer.js paketi dependencies altından kaldırılmalıdır"
  );
  assert.equal(
    pkgJson.description.includes(
      "120 Diyalog, 60 Okuma Metni, 195 Gramer Notu ve 18 Modüllü Alıştırma Merkezi"
    ),
    true
  );

  // 4. .gitignore mükerrer deploy/ satırı teke indirilmiş olmalı
  const gitignoreLines = fs
    .readFileSync(path.join(ROOT_DIR, ".gitignore"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l === "deploy/");
  assert.equal(gitignoreLines.length, 1, ".gitignore içinde tek deploy/ satırı olmalıdır");

  // 5. repair-and-validate-data.mjs içinde ek_gramer_hap_bilgi.json ve seviye_tespit_sorulari.json bulunmalı
  const repairScript = fs.readFileSync(
    path.join(ROOT_DIR, "scripts", "repair-and-validate-data.mjs"),
    "utf8"
  );
  assert.equal(
    repairScript.includes('"ek_gramer_hap_bilgi.json"') &&
      repairScript.includes('"seviye_tespit_sorulari.json"'),
    true
  );

  // 6. opengraph-image.tsx ve README.md güncellemeleri, 998 Görsel Kelime düzeltmesi
  const ogCode = fs
    .readFileSync(path.join(ROOT_DIR, "src", "app", "opengraph-image.tsx"), "utf8")
    .replace(/\s+/g, " ");
  assert.equal(
    ogCode.includes(
      "${CONTENT_INVENTORY.exerciseModulesCount} Modüllü Alıştırma Merkezi"
    ) ||
      ogCode.includes(
        "${CONTENT_INVENTORY.exerciseModulesCount} İnteraktif Oyun & Alıştırma"
      ),
    true
  );

  const readmeCode = fs.readFileSync(path.join(ROOT_DIR, "README.md"), "utf8");
  assert.equal(
    readmeCode.includes(
      "120 Diyalog, 60 Okuma Metni, 195 Gramer Notu ve 18 Modüllü Alıştırma Merkezi"
    ),
    true
  );

  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    !alistirmalarCode.includes("999 Görsel") &&
      !kutuphaneCode.includes("999 Görsel") &&
      !kutuphaneCode.includes("999 GÖRSEL"),
    true,
    "999 Görsel Kelime ifadeleri 998 Görsel Kelime olarak düzeltilmiş olmalıdır"
  );
});

test("30. 8 Kritik İşlevsel ve Davranışsal Hata Düzeltmesi Doğrulaması", async () => {
  const metinPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const diyalogPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );

  // 1. metin/[id]/page.tsx içinde WordTooltip forceShowHareke prop'u lineHarekeOverrides[line.sira] olmalı
  assert.equal(
    metinPageCode.includes("forceShowHareke={effectiveLineHareke}"),
    false,
    "metin/[id]/page.tsx WordTooltip bileşenine boolean effectiveLineHareke geçerek irab-only modunu ezmemelidir"
  );
  assert.equal(
    metinPageCode.includes("forceShowHareke={lineHarekeOverrides[line.sira]}"),
    true,
    "metin/[id]/page.tsx yalnızca satır bazlı override varsa forceShowHareke geçmelidir"
  );

  // 2. sentenceLoopCount ayarı hem diyalog hem metin sayfasında okunmalı
  assert.equal(
    metinPageCode.includes("useSettings.getState().sentenceLoopCount") &&
      diyalogPageCode.includes("useSettings.getState().sentenceLoopCount"),
    true,
    "Hem diyalog hem metin sayfalarında handleToggleLoopLine sentenceLoopCount ayarını okumalıdır"
  );

  // 3. Alıştırma zamanlayıcı referans temizliği (FillInBlanks, BlindDictation, MultipleChoice)
  const fillCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "FillInBlanks.tsx"),
    "utf8"
  );
  const blindCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BlindDictation.tsx"),
    "utf8"
  );
  const mcCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  assert.equal(
    fillCode.includes("autoAdvanceTimerRef") &&
      fillCode.includes("clearPendingTimers"),
    true,
    "FillInBlanks zamanlayıcıları useRef ile takip edilip temizlenmelidir"
  );
  assert.equal(
    blindCode.includes("clearPendingTimers"),
    true,
    "BlindDictation zamanlayıcıları useRef ile takip edilip temizlenmelidir"
  );
  assert.equal(
    mcCode.includes("autoAdvanceTimerRef") &&
      mcCode.includes("clearAutoAdvanceTimer"),
    true,
    "MultipleChoice zamanlayıcıları useRef ile takip edilip temizlenmelidir"
  );

  // 4. alistirmalar/page.tsx grammarFilter URL temizliği ve useEffect bağımlılıkları
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    alistirmalarCode.includes("clearGrammarFilterAndUrl") &&
      alistirmalarCode.includes("router.replace(") &&
      alistirmalarCode.includes("}, [searchParams]);"),
    true,
    "alistirmalar/page.tsx grammar parametresini URL'den silmeli ve useEffect bağımlılığından srsRecords/mistakeIds çıkarılmalıdır"
  );

  // 5. studyMinutes sayacının global AudioStopper bileşenine taşınması
  const audioStopperCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "AudioStopper.tsx"),
    "utf8"
  );
  const homePageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  assert.equal(
    audioStopperCode.includes("addStudyMinutes(1)") &&
      !homePageCode.includes("addStudyMinutes(1)"),
    true,
    "60 saniyelik studyMinutes sayacı page.tsx yerine global AudioStopper içinde çalışmalıdır"
  );

  // 6. ShareAchievementModal pronTargetCount > 0 kontrolü
  const shareModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ShareAchievementModal.tsx"),
    "utf8"
  );
  assert.equal(
    shareModalCode.includes("if (pronTargetCount > 0)"),
    true,
    "ShareAchievementModal pronTargetCount === 0 iken Telaffuz 0/0 metnini gizlemelidir"
  );

  // 7. VisitorCounterBadge POST döngüsünün kaldırılması
  const visitorCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "VisitorCounterBadge.tsx"),
    "utf8"
  );
  assert.equal(
    !visitorCode.includes("knownTotalUsers > normalized.totalUsers") &&
      !visitorCode.includes("!hasRegisteredThisPageLoad || knownTotalUsers > 0"),
    true,
    "VisitorCounterBadge refreshVisitorStatsLive içinde sunucu sayacı düşükse tekrar POST atmamalıdır"
  );

  // 8. Ortak serverTts.ts modülü
  const serverTtsPath = path.join(ROOT_DIR, "src", "lib", "serverTts.ts");
  assert.equal(
    fs.existsSync(serverTtsPath),
    true,
    "src/lib/serverTts.ts ortak modülü mevcut olmalıdır"
  );
  const { splitArabicTextIntoChunks } = await import(
    pathToFileURL(serverTtsPath).href
  );
  const longSample =
    "السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ، كَيْفَ حَالُكُمْ يَا أَصْدِقَائِي الْأَعِزَّاءَ فِي هَذَا الْيَوْمِ الْجَمِيلِ الْمُبَارَكِ؟ نَحْنُ نَدْرُسُ اللُّغَةَ الْعَرَبِيَّةَ الْفُصْحَى بِجِدٍّ وَاجْتِهَادٍ كَبِيرٍ كُلَّ يَوْمٍ.";
  const chunks = splitArabicTextIntoChunks(longSample, 175);
  assert.ok(chunks.length >= 2 && chunks.every((c) => c.length <= 175));

  const ttsRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "tts", "route.ts"),
    "utf8"
  );
  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  assert.equal(
    ttsRouteCode.includes('@/lib/serverTts') &&
      adminRouteCode.includes('@/lib/serverTts') &&
      !adminRouteCode.includes("async function synthesizeEdgeTtsBuffer"),
    true,
    "/api/tts ve /api/admin ortak @/lib/serverTts fonksiyonlarını kullanmalıdır"
  );
});

test("31. Header, Genel Ayarlar, Diyalog/Metin, Admin, PWA ve Kılavuz Modalları Senkronizasyonu", () => {
  const settingsStoreCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "store", "settings.ts"),
    "utf8"
  );
  const ayarlarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const offlineManagerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "offlineManager.ts"),
    "utf8"
  );
  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  const adminPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "admin", "page.tsx"),
    "utf8"
  );
  const swCode = fs.readFileSync(
    path.join(ROOT_DIR, "public", "sw.js"),
    "utf8"
  );
  const onboardingCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );
  const guideModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    "utf8"
  );

  // 1. click-reveal görünüm modu senkronizasyonu
  assert.equal(
    ayarlarCode.includes('id: "click-reveal"') &&
      diyalogCode.includes('viewMode === "click-reveal"') &&
      diyalogCode.includes("setClickToRevealTr(false)") &&
      metinCode.includes('viewMode === "click-reveal"') &&
      metinCode.includes("setClickToRevealTr(false)"),
    true,
    "click-reveal modu Ayarlar, Diyalog ve Metin sayfaları arasında tam senkronize olmalıdır"
  );

  // 2. speechRate 0.5x - 1.5x döngüsü
  assert.equal(
    ayarlarCode.includes("[0.5, 0.75, 1, 1.25, 1.5]") &&
      diyalogCode.includes("[0.5, 0.75, 1, 1.25, 1.5]") &&
      metinCode.includes("[0.5, 0.75, 1, 1.25, 1.5]"),
    true,
    "Ayarlar, Diyalog ve Metin sayfalarında 5 kademeli (0.5x - 1.5x) hız seçimi desteklenmelidir"
  );

  // 3. Header.tsx More menüsünde Seslendirici Tercihi ve Gramer Anlatımı
  assert.equal(
    headerCode.includes("preferredVoiceGender") &&
      headerCode.includes("togglePreferredVoiceGender") &&
      headerCode.includes("grammarDepthMode") &&
      headerCode.includes("toggleGrammarDepthMode"),
    true,
    "Header.tsx More menüsünde Seslendirici Tercihi ve Gramer Anlatımı hızlı kontrolleri yer almalıdır"
  );

  // 4. Ayarlar sayfasında 5 yeni kontrol (STT, readingLayoutMode, CEFR, PhonemeHeatmapModal, 180 çevrimdışı ders)
  assert.equal(
    settingsStoreCode.includes("readingLayoutMode") &&
      settingsStoreCode.includes("setReadingLayoutMode") &&
      metinCode.includes("readingLayoutMode") &&
      metinCode.includes("setReadingLayoutMode"),
    true,
    "readingLayoutMode global settings store ile metin sayfası arasında çift yönlü senkronize olmalıdır"
  );
  assert.equal(
    ayarlarCode.includes("setSttEngine") &&
      ayarlarCode.includes("setLocalSttOnly") &&
      ayarlarCode.includes("setDetectedCefrLevel") &&
      ayarlarCode.includes("/seviye-tespit") &&
      ayarlarCode.includes("PhonemeHeatmapModal") &&
      ayarlarCode.includes("28 Harf Mahreç Haritam") &&
      ayarlarCode.includes("180") &&
      offlineManagerCode.includes("[...diyaloglar, ...metinler]"),
    true,
    "Ayarlar sayfasında STT motoru, aktif CEFR seviyesi, 28 Harf Mahreç Haritam ve 180 çevrimdışı ders paketi yer almalıdır"
  );

  // 5. Admin Stüdyosu ek_gramer ve PWA sw.js /seviye-tespit önbelleği
  assert.equal(
    adminRouteCode.includes('ek_gramer: "ek_gramer_hap_bilgi.json"') &&
      adminPageCode.includes('key: "ek_gramer"') &&
      adminPageCode.includes("ek_gramer_hap_bilgi.json") &&
      swCode.includes('"/seviye-tespit"'),
    true,
    "/api/admin, /admin ve public/sw.js içinde ek_gramer ve /seviye-tespit tanımlı olmalıdır"
  );

  // 6. OnboardingTourModal ve GuideAndInfoModalBody güncellemeleri
  assert.equal(
    onboardingCode.includes("{CONTENT_INVENTORY.exerciseModulesCount} Etkileşimli Modül") &&
      onboardingCode.includes("Tıkla-Gör") &&
      guideModalCode.includes("Özel İsim (علم) — Turkuaz") &&
      guideModalCode.includes("{CONTENT_INVENTORY.grammarNotesCount} Kartlık Gramer Atlası") &&
      guideModalCode.includes("{totalOfflineLessons} Çevrimdışı Ders Paketi"),
    true,
    "OnboardingTourModal ve GuideAndInfoModalBody güncel özellikleri eksiksiz yansıtmalıdır"
  );
});

test("32. Mobil UX, Arayüz Ferahlığı, Hata Defterim Standartlaştırması, Sarf/İ'rab Koruması ve Modal Kısayol Kilidi Doğrulaması", () => {
  const scrollTopCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ScrollToTopButton.tsx"),
    "utf8"
  );
  const smartboardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "classroom", "SmartboardOverlay.tsx"),
    "utf8"
  );
  const visualRosettaCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "VisualRosettaQuiz.tsx"),
    "utf8"
  );
  const mobileNavCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "MobileNav.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
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
  const fillInBlanksCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "FillInBlanks.tsx"),
    "utf8"
  );
  const blindDictationCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BlindDictation.tsx"),
    "utf8"
  );
  const genderSortingCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "GenderSortingGame.tsx"),
    "utf8"
  );

  // 1. Mobil sağ alt köşe sabit buton çakışmasının giderilmesi
  assert.equal(
    scrollTopCode.includes("right-3 bottom-20") &&
      smartboardCode.includes("left-3 sm:left-5") &&
      !smartboardCode.includes("fixed bottom-20 lg:bottom-5 right-3"),
    true,
    "SmartboardOverlay küçültülmüş kalem ikonu sol alt köşede konumlanarak ScrollToTopButton ile çakışmamalıdır"
  );

  // 2. VisualRosettaQuiz 100dvh mobil sıkışmasının esnetilmesi
  assert.equal(
    visualRosettaCode.includes("min-h-[calc(100dvh-146px)]") &&
      visualRosettaCode.includes("overflow-y-auto") &&
      !visualRosettaCode.includes("max-h-[calc(100dvh-146px)]"),
    true,
    "VisualRosettaQuiz küçük ve yatay mobil ekranlarda sıkışmamak için min-h + overflow-y-auto kullanmalıdır"
  );

  // 3. Sanal klavye açıldığında MobileNav'ın gizlenmesi
  assert.equal(
    mobileNavCode.includes("visualViewport") &&
      mobileNavCode.includes("focusin") &&
      mobileNavCode.includes("isKeyboardOpen"),
    true,
    "MobileNav mobilde input odaklandığında veya visualViewport daraldığında geçici olarak gizlenmelidir"
  );

  // 4. Yatay sekmelerde kaydırma ipucu ve Kütüphane kişisel sekme gruplaması
  assert.equal(
    diyalogCode.includes("bg-gradient-to-l") &&
      metinCode.includes("bg-gradient-to-l") &&
      kutuphaneCode.includes("bg-gradient-to-l") &&
      sozlukCode.includes("bg-gradient-to-l") &&
      kutuphaneCode.includes('aria-label="Kişisel Çalışma Sekmeleri"'),
    true,
    "Yatay kaydırılan sekmelerde sağ kenar kaydırma ipucu ve Kütüphane kişisel sekme ayrımı bulunmalıdır"
  );

  // 5. Diyalog/Metin araç çubuğu sadeleştirmesi, Alıştırmalar hızlı başlat ve Hata Defterim standartlaştırması
  assert.equal(
    diyalogCode.includes("Ek Araçlar &amp; Modlar") &&
      !diyalogCode.includes('className="sm:hidden border-t border-[var(--border)] mt-1 pt-1"') &&
      metinCode.includes("Ek Araçlar &amp; Modlar") &&
      !metinCode.includes('className="sm:hidden border-t border-[var(--border)] mt-1 pt-1"'),
    true,
    "Diyalog ve Metin sayfalarında ikincil araçlar hem mobil hem masaüstünde Araçlar (...) menüsünde toplanmalıdır"
  );
  assert.equal(
    alistirmalarCode.includes("Alıştırmayı Başlat") &&
      alistirmalarCode.includes("Hata Defterim") &&
      sozlukCode.includes("⚡ Hata Defterim") &&
      !sozlukCode.includes("⚡ Zorlandıklarım") &&
      !alistirmalarCode.includes('"⚡ Hata Defteri"'),
    true,
    "Alıştırmalar hızlı başlat butonu bulunmalı ve tüm hata listeleri 'Hata Defterim' adıyla standartlaştırılmalıdır"
  );

  // 6. FillInBlanks sarf/i'rab koruması (sentetik son hareke/tenvin yamama kaldırılmış olmalı)
  assert.equal(
    !fillInBlanksCode.includes("adaptDistractorToTargetSurface") &&
      fillInBlanksCode.includes("selectInflectionMatchedDistractors"),
    true,
    "FillInBlanks sentetik hareke yamama yapmadan doğrulanmış sahih kelime formlarından çeldirici seçmelidir"
  );

  // 7. Açık modal varken klavye kısayolu kilidi (Akıllı Tahta SVG hariç)
  assert.equal(
    blindDictationCode.includes(
      '[role="dialog"], .fixed.inset-0:not(svg):not([data-smartboard-canvas])'
    ) &&
      genderSortingCode.includes(
        '[role="dialog"], .fixed.inset-0:not(svg):not([data-smartboard-canvas])'
      ),
    true,
    "BlindDictation ve GenderSortingGame açık modal varken klavye kısayollarını kilitlemeli ancak Akıllı Tahta SVG katmanını hariç tutmalıdır"
  );
});

test("33. YouTube Video & İzleme Rehberi (45 Gerçek Kayıt), CSP, Zero-Lag LiteYoutubeCard, 14 Harici Platform, Çapraz Ders Bağlantıları ve Admin Desteği Doğrulaması", async () => {
  // 1. next.config.ts CSP kontrolü
  const nextConfigCode = fs.readFileSync(
    path.join(ROOT_DIR, "next.config.ts"),
    "utf8"
  );
  assert.equal(
    nextConfigCode.includes(
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be; child-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com;"
    ) &&
      nextConfigCode.includes("https://i.ytimg.com") &&
      nextConfigCode.includes("https://img.youtube.com") &&
      nextConfigCode.includes("https://*.ytimg.com"),
    true,
    "next.config.ts CSP başlığında YouTube gömülü oynatıcı (frame-src + child-src) ve kapak görseli (img-src) kuralları yer almalıdır"
  );

  // 2. youtube_tavsiyeleri.json 60 gerçek kaydın bütünlüğü, 0 tatweel ve %100 NFC kontrolü
  const { raw: ytRaw, parsed: ytItems } = readDataJson(
    "youtube_tavsiyeleri.json"
  );
  assert.equal(
    Array.isArray(ytItems) && ytItems.length === 60,
    true,
    "youtube_tavsiyeleri.json 60 gerçek kaydı eksiksiz korumalıdır"
  );
  assert.equal(
    ytRaw.includes("\u0640"),
    false,
    "youtube_tavsiyeleri.json içinde tatweel (\\u0640) bulunmamalıdır"
  );

  const allowedCefr = new Set(["A1", "A2", "B1", "B2"]);
  const allowedCategories = new Set([
    "cizgi_animasyon",
    "diyalog_egitim",
    "hikaye_kissa",
    "tarihi_dizi_film",
    "islami_sohbet_ders",
    "belgesel_basin",
  ]);
  for (let i = 0; i < ytItems.length; i++) {
    const item = ytItems[i];
    const expectedId = `yt_${String(i + 1).padStart(3, "0")}`;
    assert.equal(item.id, expectedId, `Kayıt #${i + 1} ID'si ${expectedId} olmalıdır`);
    assert.equal(allowedCefr.has(item.cefr), true, `${item.id} geçerli CEFR seviyesine sahip olmalıdır`);
    assert.equal(
      item.tur === "video" || item.tur === "playlist",
      true,
      `${item.id} tur alanı video veya playlist olmalıdır`
    );
    assert.equal(
      allowedCategories.has(item.kategori),
      true,
      `${item.id} geçerli kategoriye sahip olmalıdır`
    );
    assert.equal(
      typeof item.baslik_ar === "string" && item.baslik_ar.trim().length > 0,
      true
    );
    assert.equal(
      typeof item.baslik_tr === "string" && item.baslik_tr.trim().length > 0,
      true
    );
    assert.equal(
      typeof item.pedagojik_not === "string" && item.pedagojik_not.trim().length > 0,
      true
    );
  }

  // 3. youtubeUtils.ts fonksiyonları ve 14 harici platform kontrolü
  const {
    EXTERNAL_WATCH_PLATFORM_GROUPS,
    extractYoutubeIdsFromUrl,
    buildYoutubeEmbedUrl,
    getYoutubeThumbnailUrls,
    doesYoutubeItemMatchContentId,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts")).href
  );

  const totalExternalPlatforms = EXTERNAL_WATCH_PLATFORM_GROUPS.reduce(
    (sum, g) => sum + g.platforms.length,
    0
  );
  assert.equal(
    totalExternalPlatforms,
    14,
    "Harici platformlar rehberinde 3 grup altında tam 14 platform yer almalıdır"
  );

  const parsedWatch = extractYoutubeIdsFromUrl(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&t=45s"
  );
  assert.equal(parsedWatch.videoId, "dQw4w9WgXcQ");
  assert.equal(parsedWatch.playlistId, "PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx");
  assert.equal(parsedWatch.startSeconds, 45);

  const playlistOnlyEmbed = buildYoutubeEmbedUrl({
    url: "https://www.youtube.com/playlist?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
    playlist_id: "PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
  });
  assert.equal(
    playlistOnlyEmbed,
    "https://www.youtube.com/embed/videoseries?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&rel=0&modestbranding=1&autoplay=1&enablejsapi=1"
  );

  const dualEmbed = buildYoutubeEmbedUrl({
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
    video_id: "dQw4w9WgXcQ",
    playlist_id: "PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
  });
  assert.equal(
    dualEmbed,
    "https://www.youtube.com/embed/dQw4w9WgXcQ?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&rel=0&modestbranding=1&autoplay=1&enablejsapi=1"
  );

  const thumbs = getYoutubeThumbnailUrls("dQw4w9WgXcQ");
  assert.equal(
    thumbs[0],
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );

  // Sıfır dolgulu ID toleransı: metin_005 <-> metin_05
  assert.equal(
    doesYoutubeItemMatchContentId(
      { bagli_icerik_id: "metin_005" },
      "metin_05"
    ),
    true,
    "bagli_icerik_id metin_005 ile metin_05 esnek olarak eşleşmelidir"
  );

  // 4. data.ts (bellekte NFC normalizasyonu) ve userStore.ts watchedVideos entegrasyonu
  const {
    youtubeTavsiyeleri,
    getYoutubeRecommendationsByContentId,
    CONTENT_INVENTORY,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href
  );
  assert.equal(youtubeTavsiyeleri.length, 60);
  assert.equal(CONTENT_INVENTORY.youtubeVideosCount, 60);
  for (const runtimeItem of youtubeTavsiyeleri) {
    assert.equal(
      runtimeItem.baslik_ar,
      toCanonicalArabicShaddaNfc(runtimeItem.baslik_ar)
    );
    assert.equal(runtimeItem.baslik_tr, runtimeItem.baslik_tr.normalize("NFC"));
    assert.equal(
      runtimeItem.pedagojik_not,
      toCanonicalArabicShaddaNfc(runtimeItem.pedagojik_not)
    );
  }
  assert.ok(getYoutubeRecommendationsByContentId("dlg_001").length >= 1);
  assert.ok(getYoutubeRecommendationsByContentId("metin_05").length >= 1);
  assert.ok(getYoutubeRecommendationsByContentId("grm_012").length >= 1);

  const { useUserStore } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "store", "userStore.ts")).href
  );
  useUserStore.getState().resetProgress();
  assert.deepEqual(useUserStore.getState().watchedVideos, []);
  useUserStore.getState().toggleWatchedVideo("yt_001");
  assert.equal(useUserStore.getState().isVideoWatched("yt_001"), true);
  const exported = useUserStore.getState().exportProgress();
  useUserStore.getState().resetProgress();
  assert.equal(useUserStore.getState().isVideoWatched("yt_001"), false);
  useUserStore.getState().importProgress(exported, "merge");
  assert.equal(useUserStore.getState().isVideoWatched("yt_001"), true);

  // 5. Bileşen, Sayfa ve Admin Stüdyosu bağlantıları
  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  const adminPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "admin", "page.tsx"),
    "utf8"
  );

  assert.equal(
    liteCardCode.includes("stopAllAudio") &&
      liteCardCode.includes("speakHybrid") &&
      liteCardCode.includes("/sozluk?q=") &&
      liteCardCode.includes("YoutubePlayerModal"),
    true,
    "LiteYoutubeCard ses çakışma koruması (stopAllAudio), odak kelime telaffuz/sözlük köprüsü ve Sinema Modu içermelidir"
  );
  assert.equal(
    kutuphaneCode.includes("Video & İzleme Rehberi") &&
      kutuphaneCode.includes("Nasıl İzlemeliyim? &amp; Harici Platformlar Rehberi") &&
      homeCode.includes("Seviyenize Uygun Tavsiye İzleme") &&
      diyalogCode.includes("İlgili Tavsiye") &&
      metinCode.includes("İlgili Tavsiye") &&
      grammarPanelCode.includes("İlgili Tavsiye") &&
      adminRouteCode.includes('youtube_tavsiyeleri: "youtube_tavsiyeleri.json"') &&
      adminPageCode.includes('key: "youtube_tavsiyeleri"'),
    true,
    "Kütüphane, Ana Sayfa, Diyalog, Metin, Gramer Paneli ve Admin Stüdyosu YouTube entegrasyonlarını eksiksiz içermelidir"
  );
});

test("34. 400 Eş & Zıt Anlamlılar (المرادفات والأضداد) veri bütünlüğü, O(1) sözlük eşleşmesi, çakışmasız quiz motoru, SRS/Hata Defteri ve Admin Stüdyosu entegrasyonu", async () => {
  // 1. JSON dosyası bütünlüğü: 400 kayıt, 0 BOM, 0 tatweel (\u0640), %100 NFC
  const fullPath = path.join(DATA_DIR, "es_zit_anlamlilar.json");
  const rawBuffer = fs.readFileSync(fullPath);
  assert.equal(
    rawBuffer[0] === 0xef && rawBuffer[1] === 0xbb && rawBuffer[2] === 0xbf,
    false,
    "es_zit_anlamlilar.json başında UTF-8 BOM bulunmamalıdır"
  );
  const { raw, parsed } = readDataJson("es_zit_anlamlilar.json");
  assert.equal(parsed.length, 400, "es_zit_anlamlilar.json tam 400 ana madde içermelidir");
  assert.equal(raw.includes("\u0640"), false, "es_zit_anlamlilar.json içinde tatweel bulunmamalıdır");

  const seenIds = new Set();
  const allowedCefr = new Set(["A1", "A2", "B1", "B2"]);
  const allowedTur = new Set(["isim", "fiil", "sifat", "zarf"]);
  let totalSubWords = 0;

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const expectedId = `ez_${String(i + 1).padStart(3, "0")}`;
    assert.equal(item.id, expectedId, `Sıra #${i + 1} ID değeri ${expectedId} olmalıdır`);
    assert.equal(seenIds.has(item.id), false, `Mükerrer ID bulundu: ${item.id}`);
    seenIds.add(item.id);
    assert.equal(allowedCefr.has(item.cefr), true, `Geçersiz CEFR seviyesi: ${item.cefr}`);
    assert.equal(allowedTur.has(item.tur), true, `Geçersiz kelime türü: ${item.tur}`);
    assert.ok(typeof item.kelime_ar === "string" && item.kelime_ar.trim().length > 0);
    assert.ok(typeof item.anlam_tr === "string" && item.anlam_tr.trim().length > 0);
    assert.ok(Array.isArray(item.es_anlamlilar));
    assert.ok(Array.isArray(item.zit_anlamlilar));
    assert.ok(
      item.es_anlamlilar.length + item.zit_anlamlilar.length >= 1,
      `${item.id} en az 1 eş veya zıt anlamlı kelime içermelidir`
    );
    totalSubWords += 1 + item.es_anlamlilar.length + item.zit_anlamlilar.length;
    assert.ok(typeof item.ornek_cumle_ar === "string" && item.ornek_cumle_ar.trim().length > 0);
    assert.ok(typeof item.ornek_cumle_tr === "string" && item.ornek_cumle_tr.trim().length > 0);
  }
  assert.ok(totalSubWords >= 1800, `Toplam kelime havuzu 1800+ olmalıdır (bulunan: ${totalSubWords})`);

  for (const { text: s, keyName } of collectStrings(parsed)) {
    if (keyName === "yanlis") continue;
    assert.equal(
      s,
      toCanonicalArabicShaddaNfc(s),
      `Kanonik NFC+şedde formunda olmayan metin: ${s.slice(0, 40)}`
    );
  }

  // 2. data.ts & dict.ts O(1) eş/zıt anlam arama doğrulaması
  const { pathToFileURL } = await import("node:url");
  const {
    esZitAnlamlilar,
    getSynonymsAntonymsByLevel,
    getSynonymAntonymById,
    CONTENT_INVENTORY,
    getContentCatalogStats,
  } = await import(pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href);

  assert.equal(esZitAnlamlilar.length, 400);
  assert.equal(CONTENT_INVENTORY.synonymsAntonymsCount, 400);
  assert.equal(getContentCatalogStats().totalSynonymsAntonyms, 400);
  assert.equal(getSynonymAntonymById("ez_001")?.id, "ez_001");
  assert.ok(getSynonymsAntonymsByLevel("A1").length > 0);
  assert.ok(getSynonymsAntonymsByLevel("B2").length > 0);

  const { findSynonymAntonymForWord } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "dict.ts")).href
  );
  const firstEntry = esZitAnlamlilar[0];
  const matchedHead = findSynonymAntonymForWord(firstEntry.kelime_ar);
  assert.ok(matchedHead, "Ana kelime üzerinden O(1) Eş/Zıt kaydı bulunmalıdır");
  if (firstEntry.es_anlamlilar[0]) {
    const matchedSub = findSynonymAntonymForWord(firstEntry.es_anlamlilar[0].ar);
    assert.ok(matchedSub, "Alt eş anlamlı kelime üzerinden de ters indeksle kayıt bulunmalıdır");
  }

  // 3. Quiz Üreticileri: Çoktan Seçmeli, Çakışmasız Eşleştirme Tahtası ve Boşluk Doldurma
  const {
    getFilteredSynonymAntonymEntries,
    generatePoolFromSynonymsAntonyms,
    generateSynonymAntonymMcQuestions,
    generateSynonymAntonymMatchingPairs,
    generateSynonymAntonymFillQuestions,
  } = await import(pathToFileURL(path.join(ROOT_DIR, "src", "lib", "quiz.ts")).href);

  const fiilSubset = getFilteredSynonymAntonymEntries({ level: "B1", tur: "fiil" });
  assert.ok(fiilSubset.length > 0 && fiilSubset.every((e) => e.cefr === "B1" && e.tur === "fiil"));

  const dictPool = generatePoolFromSynonymsAntonyms({ level: "A1" });
  assert.ok(Array.isArray(dictPool) && dictPool.length > 0 && dictPool.every((w) => w.level === "A1"));

  const mcQuestions = generateSynonymAntonymMcQuestions(esZitAnlamlilar, 15);
  assert.equal(mcQuestions.length, 15);
  for (const q of mcQuestions) {
    assert.equal(q.options.length, 4, "Her çoktan seçmeli soruda tam 4 benzersiz şık olmalıdır");
    assert.equal(new Set(q.options.map((o) => o.text)).size, 4, "Şıklar birbirinden benzersiz olmalıdır");
    assert.equal(q.options.filter((o) => o.isCorrect).length, 1, "Tam 1 doğru şık olmalıdır");
    assert.ok(q.wordId.startsWith("ez_"));
  }

  const matchBoard = generateSynonymAntonymMatchingPairs(esZitAnlamlilar, 5);
  assert.equal(matchBoard.length, 5);
  const seenPrompts = new Set();
  const seenAnswers = new Set();
  for (const pair of matchBoard) {
    assert.equal(seenPrompts.has(pair.trText), false, "Eşleştirme sol sütununda mükerrer kart olmamalıdır");
    assert.equal(seenAnswers.has(pair.arText), false, "Eşleştirme sağ sütununda mükerrer Arapça cevap olmamalıdır");
    seenPrompts.add(pair.trText);
    seenAnswers.add(pair.arText);
  }

  const fillQuestions = generateSynonymAntonymFillQuestions(esZitAnlamlilar, 10);
  assert.equal(fillQuestions.length, 10);
  for (const fq of fillQuestions) {
    assert.ok(fq.correctWord.length > 0, "Hedef kelime boş olmamalıdır");
    assert.equal(fq.options.includes(fq.correctWord), true, "Kelime bankası hedef kelimeyi içermelidir");
    assert.equal(new Set(fq.options).size, 4, "Boşluk doldurma şıkları 4 benzersiz kelimeden oluşmalıdır");
  }

  // 4. SRS & Hata Defteri Kanonik ID Çözümleme (ez_XXX & mc_ez_XXX)
  const { normalizeToCanonicalMistakeId, resolveMistakesPool } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "mistakeUtils.ts")).href
  );
  assert.equal(normalizeToCanonicalMistakeId("mc_ez_005"), "ez_005");
  assert.equal(normalizeToCanonicalMistakeId("mg_ez_012"), "ez_012");
  assert.equal(normalizeToCanonicalMistakeId("fill_ez_020"), "ez_020");
  const resolvedMistakes = resolveMistakesPool(["mc_ez_001", "ez_002"]);
  assert.equal(resolvedMistakes.words.length, 2);
  assert.equal(resolvedMistakes.totalMistakeItems, 2);

  const { useUserStore } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "store", "userStore.ts")).href
  );
  useUserStore.getState().resetProgress();
  useUserStore.getState().addMistake("mc_ez_007");
  assert.equal(useUserStore.getState().isMistake("ez_007"), true);
  useUserStore.getState().removeMistake("ez_007");
  assert.equal(useUserStore.getState().isMistake("ez_007"), false);

  // 5. Sözlük, WordTooltip, Kütüphane, Alıştırmalar ve Admin Stüdyosu bağlantıları
  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  const tooltipCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "WordTooltip.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  const adminPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "admin", "page.tsx"),
    "utf8"
  );

  assert.equal(
    sozlukCode.includes("Eş & Zıt Anlamlılar") &&
      tooltipCode.includes("findSynonymAntonymForWord") &&
      kutuphaneCode.includes('id: "es-zit"') &&
      alistirmalarCode.includes('"synonyms_antonyms"') &&
      adminRouteCode.includes('es_zit_anlamlilar: "es_zit_anlamlilar.json"') &&
      adminPageCode.includes('key: "es_zit_anlamlilar"'),
    true,
    "Sözlük, WordTooltip, Kütüphane, Alıştırmalar ve Admin Stüdyosu Eş & Zıt Anlamlılar entegrasyonunu eksiksiz içermelidir"
  );
});

test("35. YouTube Standart Embed + Çakışmasız Playlist Kapağı, Kütüphane Sekme/Kategori Kesilmezliği, Ziyaretçi Sayacı Cold-Start & Tıklanabilir Modal, Kompakt Kronometre Hover/Tap ve KTT Konu İpucu Gizleme Doğrulaması", async () => {
  // 1. YouTube standart embed URL'leri (undefined videoId olmadan) ve LiteYoutubeCard çakışmasız kapak/rozet yapısı
  const { buildYoutubeEmbedUrl } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts")).href
  );
  const plOnly = buildYoutubeEmbedUrl(
    {
      url: "https://www.youtube.com/playlist?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
      playlist_id: "PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
      tur: "playlist",
    },
    { autoplay: true }
  );
  assert.equal(
    plOnly,
    "https://www.youtube.com/embed/videoseries?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&rel=0&modestbranding=1&autoplay=1&enablejsapi=1",
    "Sadece playlist_id içeren kayıtlar youtube.com/embed/videoseries adresini üretmeli ve undefined içermemelidir"
  );
  assert.equal(plOnly.includes("undefined"), false);

  const singleVid = buildYoutubeEmbedUrl({
    url: "https://youtu.be/dQw4w9WgXcQ?t=30",
    video_id: "dQw4w9WgXcQ",
    tur: "video",
  });
  assert.equal(
    singleVid,
    "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&autoplay=1&start=30&enablejsapi=1",
    "Tekil videolar youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&start=...&enablejsapi=1 adresini üretmelidir"
  );

  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  assert.equal(
    liteCardCode.includes('rawDuration.toLocaleLowerCase("tr-TR") === "oynatma listesi"') &&
      liteCardCode.includes("flex flex-col items-center justify-center gap-2 text-center") &&
      !liteCardCode.includes("{meta.arabicTitle}"),
    true,
    "LiteYoutubeCard tipografik playlist kapaklarında Play ikonu ile Arapça başlığı üst üste bindirmemeli ve mükerrer Oynatma Listesi rozetini gizlemelidir"
  );

  // 2. Kütüphane üst sekme barı (md:ml-auto kaldırılmış dengeli flex-wrap) ve Video 6 kategori şeridi
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    !kutuphaneCode.includes("shrink-0 md:ml-auto") &&
      kutuphaneCode.includes(
        "flex overflow-x-auto md:overflow-visible md:flex-wrap no-scrollbar whitespace-nowrap md:whitespace-normal items-center gap-1.5 py-1 px-1.5 pr-7 md:px-0 md:pr-0 max-w-full"
      ),
    true,
    "Kütüphane üst sekmelerinde md:ml-auto kaynaklı kırılma giderilmeli ve Video kategorileri hem mobil hem masaüstünde kesilmemelidir"
  );

  // 3. Ziyaretçi sayacı cold-start başlangıç tabanı (SEED_TOTAL_USERS / SEED_TOTAL_SESSIONS) ve tıklanabilir canlı detay modalı
  const statsRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stats", "route.ts"),
    "utf8"
  );
  const visitorBadgeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "VisitorCounterBadge.tsx"),
    "utf8"
  );
  assert.equal(
    statsRouteCode.includes("export const SEED_TOTAL_USERS = 1480") &&
      statsRouteCode.includes("export const SEED_TOTAL_SESSIONS = 3920") &&
      statsRouteCode.includes("MAX_RECOVERY_GAP_USERS") &&
      visitorBadgeCode.includes("handleOpenDetailModal") &&
      visitorBadgeCode.includes('aria-label="Canlı Ziyaretçi İstatistikleri"'),
    true,
    "Ziyaretçi sayacı cold-start tabanına sahip olmalı ve rozete tıklandığında canlı detay modalı açılmalıdır"
  );

  // 4. Kompakt Kronometre (SmartboardOverlay) varsayılan gizli kontrol butonları + hover/dokunuş ile açılma
  const smartboardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "classroom", "SmartboardOverlay.tsx"),
    "utf8"
  );
  assert.equal(
    smartboardCode.includes("const [compactControlsOpen, setCompactControlsOpen] = useState<boolean>(false)") &&
      smartboardCode.includes("max-w-0 opacity-0") &&
      smartboardCode.includes("group-hover:max-w-[160px] group-hover:opacity-100"),
    true,
    "Kompakt kronometrede sağdaki 4 kontrol butonu varsayılan olarak gizli olmalı, mouse hover veya mobil dokunuşta açılmalıdır"
  );

  // 5. KTT Yaprak Test PDF üreticisinde Sorularda Konu Bilgisini Göster seçeneği (varsayılan: false / GİZLİ)
  const seviyeTespitCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    seviyeTespitCode.includes("const [showTopicInQuestions, setShowTopicInQuestions] =\n    useState<boolean>(false)") &&
      seviyeTespitCode.includes("Sorularda Konu Bilgisini Göster") &&
      seviyeTespitCode.includes("showTopicInQuestions\n                ? `<span class=\"q-meta\">"),
    true,
    "KTT Yaprak Test PDF çıktısında soru üstü konu bilgisi varsayılan olarak gizli (false) olmalı ve isteğe bağlı açılabilmelidir"
  );
});

test("36. Global Punto Senkronizasyonu, Çok Büyük Etiketi, Büyütülmüş Alıştırma/Sözlük Tipografisi, Hızlı Etkinlik Şeridi ve Dinlenen Kelime Vurgusu 2x2 Düzeni", async () => {
  const {
    computeArabicPuntoScale,
    computeTurkishPuntoScale,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts")).href
  );

  assert.equal(computeArabicPuntoScale(28, "sm"), 0.9);
  assert.equal(computeArabicPuntoScale(34, "md"), 1.0);
  assert.equal(computeArabicPuntoScale(42, "lg"), 1.2);
  assert.equal(computeArabicPuntoScale(50, "xl"), 1.4);
  assert.equal(computeTurkishPuntoScale(50, 16) > 1.1, true);

  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  assert.equal(
    globalsCss.includes("--text-2xl: calc(1.5rem * var(--font-arabic-scale, 1));") &&
      globalsCss.includes(".tr-scale {") &&
      globalsCss.includes(".arabic-inline-mixed {"),
    true,
    "globals.css içinde .arabic/.font-arabic ve .tr-scale için Tailwind v4 CSS değişken ölçeklemesi tanımlı olmalıdır"
  );

  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const settingsEffectsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "SettingsEffects.tsx"),
    "utf8"
  );
  assert.equal(
    headerCode.includes('{preset.label.split(" (")[0]}') &&
      !headerCode.includes('{preset.label.split(" ")[0]}') &&
      settingsEffectsCode.includes("applyGlobalTypographyCssVars({"),
    true,
    "Üst bar T menüsünde Çok Büyük etiketi 'Çok' olarak kesilmemeli ve applyGlobalTypographyCssVars SettingsEffects ile tüm uygulamaya senkronize edilmelidir"
  );

  const mcCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  assert.equal(
    mcCode.includes("isPureArabicOption") &&
      mcCode.includes("text-2xl sm:text-3xl font-bold leading-relaxed text-right") &&
      mcCode.includes("text-left font-bold text-sm sm:text-base leading-snug"),
    true,
    "MultipleChoice.tsx içinde saf Arapça şıklar text-2xl sm:text-3xl text-right ve Türkçe şıklar text-sm sm:text-base boyutunda ferah gösterilmelidir"
  );

  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    alistirmalarCode.includes("tr-scale") &&
      sozlukCode.includes("tr-scale") &&
      kutuphaneCode.includes("tr-scale") &&
      seviyeCode.includes("tr-scale"),
    true,
    "Alıştırmalar, Sözlük, Kütüphane ve Seviye Tespit sayfaları global .tr-scale punto ölçekleyicisine bağlı olmalıdır"
  );

  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  assert.equal(
    diyalogCode.includes("✨ Hızlı Etkinlik:") &&
      diyalogCode.includes("👥 İkili Kart (A/B)") &&
      diyalogCode.includes("👁️ Kör Dinleme") &&
      metinCode.includes("✨ Hızlı Etkinlik:") &&
      metinCode.includes("👁️ Kör Dinleme") &&
      !diyalogCode.includes("grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white") &&
      !metinCode.includes("grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white") &&
      diyalogCode.includes("var(--font-arabic-optical-scale, 1)") &&
      metinCode.includes("var(--font-arabic-optical-scale, 1)"),
    true,
    "Diyalog ve Metin sayfalarında Hızlı Etkinlik şeridi bulunmalı, Dinlenen Kelime Vurgusu 2x2 düzende kesilmeden görünmeli ve çift ölçekleme engellenmelidir"
  );
});

test("37. YouTube Iframe COEP/COOP Blok Kaldırma, CSP Tam İzinleri, 60 Kayıtta Standart www.youtube.com/embed URL Doğrulaması, Regex Ayıklama, Zero-Iframe Kapak + imageError Fallback ve Mobil Sinema Modu", async () => {
  // 1. next.config.ts COEP/COOP kaldırılmış olmalı, Referrer-Policy ve CSP tam uyumlu olmalı
  const nextConfigCode = fs.readFileSync(
    path.join(ROOT_DIR, "next.config.ts"),
    "utf8"
  );
  assert.equal(
    nextConfigCode.includes('"Cross-Origin-Embedder-Policy"') ||
      nextConfigCode.includes('"Cross-Origin-Opener-Policy"'),
    false,
    "next.config.ts içinde YouTube iframe'lerini ERR_BLOCKED_BY_RESPONSE ile bloklayan COEP/COOP başlıkları bulunmamalıdır"
  );
  assert.equal(
    nextConfigCode.includes('value: "strict-origin-when-cross-origin"') &&
      nextConfigCode.includes(
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be;"
      ) &&
      nextConfigCode.includes(
        "child-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com;"
      ) &&
      nextConfigCode.includes("https://*.ytimg.com") &&
      nextConfigCode.includes("https://*.googlevideo.com"),
    true,
    "next.config.ts Referrer-Policy ve CSP kuralları YouTube iframe, kapak ve medya akışlarına tam izin vermelidir"
  );

  // 2. Tüm 60 kayıtta standart www.youtube.com/embed/... URL kontrolü ve Regex fallback doğrulaması
  const { buildYoutubeEmbedUrl } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts")).href
  );
  const { parsed: ytItems } = readDataJson("youtube_tavsiyeleri.json");
  for (const item of ytItems) {
    const embedUrl = buildYoutubeEmbedUrl(item);
    assert.equal(
      embedUrl.startsWith("https://www.youtube.com/embed/"),
      true,
      `${item.id} standart https://www.youtube.com/embed/ ile başlamalıdır`
    );
    assert.equal(
      embedUrl.includes("undefined") ||
        embedUrl.includes("null") ||
        embedUrl.includes("youtube-nocookie.com"),
      false,
      `${item.id} embed URL'sinde undefined, null veya youtube-nocookie.com bulunmamalıdır`
    );
    assert.equal(
      embedUrl.includes("rel=0&modestbranding=1&autoplay=1"),
      true,
      `${item.id} embed URL'si rel=0&modestbranding=1&autoplay=1 içermelidir`
    );
  }

  // video_id ve playlist_id eksik veya "undefined" metni olsa bile URL'den regex ile ayıklama
  const regexFallbackUrl = buildYoutubeEmbedUrl({
    url: "https://www.youtube.com/watch?v=N6kslYvDUDE&list=PLt_luoZum2FEQdmjzu72c_ENdoHZ28rGp",
    video_id: "undefined",
    playlist_id: "",
  });
  assert.equal(
    regexFallbackUrl,
    "https://www.youtube.com/embed/N6kslYvDUDE?list=PLt_luoZum2FEQdmjzu72c_ENdoHZ28rGp&rel=0&modestbranding=1&autoplay=1&enablejsapi=1"
  );

  // 3. LiteYoutubeCard ve YoutubePlayerModal iframe & mobil ergonomi kontrolü
  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  assert.equal(
    liteCardCode.includes("const [isPlaying, setIsPlaying] = useState(false)") &&
      liteCardCode.includes("const [imageError, setImageError] = useState(false)") &&
      liteCardCode.includes("https://i.ytimg.com/vi/${videoId}/hqdefault.jpg") &&
      !liteCardCode.includes("sandbox=") &&
      liteCardCode.includes('className="w-full h-full aspect-video border-0"') &&
      liteCardCode.includes(
        'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"'
      ) &&
      liteCardCode.includes('referrerPolicy="strict-origin-when-cross-origin"') &&
      liteCardCode.includes("w-[95vw] max-w-5xl") &&
      liteCardCode.includes("✕ Kapat") &&
      liteCardCode.includes("YouTube&apos;da Aç ↗"),
    true,
    "LiteYoutubeCard ilk yüklemede iframe basmamalı, imageError gradyan yedeği kullanmalı, sandbox içermemeli ve Sinema Modu mobil/masaüstü uyumlu olmalıdır"
  );
});

test("38. Ölü YouTube Link Temizliği (60 Sıralı Kayıt + Tek Aktif Iframe), Gramer Modal Z-Index/Başlık/2 Sütun Buton/1111 Ses Yolu, Görsel Kelime Kart/Modal/Hemze-i Vasıl İmlası ve Mobil Safe-Area/md Breakpoint Koruması", async () => {
  // 1. 10 ölü playlist'in kaldırıldığını ve yt_001..yt_060 / sira 1..60 dizilimini doğrula
  const { raw: ytRaw, parsed: ytItems } = readDataJson(
    "youtube_tavsiyeleri.json"
  );
  const removedPlaylists = [
    "PL-WDURy0fRf-mck3BfgGOUbP55yPlmRxf",
    "PLnmMHGHL1sYU8yz3n56YJgxeJ2PUs2R83",
    "PLEM4OKFQO5J3rlg7pBlwKK_bYsF6M71nZ",
    "PLGQT5cJOzEnIYS9syaI5IfAC39VNN3eUC",
    "PLZhY-MJA-pw9VLX8xXm1MSMz-8qw6NvXo",
    "PLtHEKBuBgFdUohIFK6BTp0iUbFv11tpjQ",
    "PLodYDGnGsvlbLjWgB1LVL4fSHfee5IOIk",
    "PL9nkZtQYDOGsT3Pf3ILhy9TB-ur2Ve2LW",
    "PLOpvfjrLz9uf2KZoY0zxAXwfiGulloRP_",
    "PLOpvfjrLz9ud1R6KskpOGZFctyb_TB9MC",
  ];
  assert.equal(ytItems.length, 60, "youtube_tavsiyeleri.json tam 60 kayıt içermelidir");
  for (const deadPl of removedPlaylists) {
    assert.equal(
      ytRaw.includes(deadPl),
      false,
      `Ölü oynatma listesi (${deadPl}) tamamen kaldırılmış olmalıdır`
    );
  }
  for (let i = 0; i < ytItems.length; i++) {
    assert.equal(ytItems[i].id, `yt_${String(i + 1).padStart(3, "0")}`);
    assert.equal(ytItems[i].sira, i + 1);
  }

  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  assert.equal(
    liteCardCode.includes("activeInlineYoutubeInstanceId") &&
      liteCardCode.includes("notifyActiveInlineYoutube(instanceId)") &&
      liteCardCode.includes("notifyActiveInlineYoutube(null)") &&
      liteCardCode.includes("leading-[1.85] py-0.5"),
    true,
    "LiteYoutubeCard aynı anda yalnızca tek aktif iframe oynatıcıya izin vermeli ve Arapça başlıklarda hareke kesilmesini önlemelidir"
  );

  // 2. Gramer Hap Bilgi Modalları (z-[85], 2 satırlı sticky başlık, 2 sütunlu aksiyon çubuğu ve 1111 cümle ses yolu)
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  assert.equal(
    grammarPanelCode.includes("fixed inset-0 lg:top-[var(--header-height,56px)] z-[85]") &&
      grammarPanelCode.includes("sticky top-0 z-20") &&
      grammarPanelCode.includes('aria-label="Gramer Anlatım Derinliği Seçici"') &&
      grammarPanelCode.includes("grid grid-cols-2 sm:flex sm:flex-wrap") &&
      grammarPanelCode.includes("/sesler/cumleler/erkek/${sent.id}.mp3") &&
      grammarPanelCode.includes("/sesler/cumleler/kadin/${sent.id}.mp3") &&
      !grammarPanelCode.includes("_m.mp3") &&
      !grammarPanelCode.includes("_f.mp3"),
    true,
    "GrammarHapBilgiPanel mobil z-[85], çakışmasız 2 satırlı başlık, kompakt 2 sütunlu buton ızgarası ve gerçek CDN cümle ses yollarını içermelidir"
  );

  // 3. Görsel Kelime Kartları, Detay Modalı ve Hemze-i Vasıl (اشْتَرَيْتُ) İmla Doğrulaması
  const { parsed: visualWords } = readDataJson("gorselKelimeler_guncel.json");
  const hediyeItem = visualWords.find((w) => w.id === "0004_01_hediye");
  assert.ok(hediyeItem, "0004_01_hediye kaydı bulunmalıdır");
  assert.equal(
    hediyeItem.ornek_ar,
    toCanonicalArabicShaddaNfc("اشْتَرَيْتُ هَدِيَّةً جَمِيلَةً لِصَدِيقِي."),
    "İftial babı اشْتَرَيْتُ fiili hemze-i kat' (إ) olmadan hemze-i vasıl ile yazılmalıdır"
  );

  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const tooltipCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "WordTooltip.tsx"),
    "utf8"
  );
  assert.equal(
    !kutuphaneCode.includes('#${currentVisual.id.replace("gorsel_", "")}') &&
      kutuphaneCode.includes("currentVisual.sira") &&
      kutuphaneCode.includes("centered") &&
      tooltipCode.includes("centered?: boolean;") &&
      kutuphaneCode.includes('aria-label="Önceki Kart"') &&
      kutuphaneCode.includes('aria-label="Sonraki Kart"') &&
      kutuphaneCode.includes("flex flex-wrap items-center gap-1.5 pt-1"),
    true,
    "Görsel Kelime kartları ve detay modalı 360px taşmasız butonlara, temiz sıra rozetine, ortalanmış Arapça kelimeye ve simetrik Önceki/Sonraki oklarına sahip olmalıdır"
  );

  // 4. Mobil Safe-Area, md: Breakpoint Tutarlılığı ve metadata.json Koruması
  const layoutCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  const mobileNavCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "MobileNav.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const scrollTopCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ScrollToTopButton.tsx"),
    "utf8"
  );
  const keyboardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ArabicVirtualKeyboard.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );

  assert.equal(
    layoutCode.includes('viewportFit: "cover"') &&
      mobileNavCode.includes("pb-[max(0.25rem,env(safe-area-inset-bottom))]") &&
      alistirmalarCode.includes("pb-20 md:pb-4") &&
      scrollTopCode.includes("fixed right-3 bottom-20 md:bottom-6 md:right-6") &&
      keyboardCode.includes("mb-16 md:mb-2") &&
      diyalogCode.includes("leading-[1.85] py-0.5") &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Safe-area, md: breakpoint uyumu, Arapça başlık satır yüksekliği ve metadata.json eksiksiz korunmalıdır"
  );
});

test("39. 6 Kritik Runtime Mantık, Klavye Kısayolu, CAT Yarış Koruması, FlowMode, 3 Aşamalı Hareke ve Alıştırma Havuzu Senkronizasyonu Doğrulaması", async () => {
  // 1. Akıllı Tahta SVG katmanı klavye kısayollarını kilitlememeli
  const smartboardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "classroom", "SmartboardOverlay.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const flashcardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "Flashcard.tsx"),
    "utf8"
  );
  const blindDictationCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BlindDictation.tsx"),
    "utf8"
  );
  const genderSortingCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "GenderSortingGame.tsx"),
    "utf8"
  );

  const safeModalSelector =
    '[role="dialog"], .fixed.inset-0:not(svg):not([data-smartboard-canvas])';

  assert.equal(
    smartboardCode.includes('data-smartboard-canvas="true"') &&
      smartboardCode.includes("fixed top-0 left-0 w-screen h-screen z-[80]") &&
      !smartboardCode.includes("fixed inset-0 w-screen h-screen z-[80]"),
    true,
    "SmartboardOverlay SVG katmanı inset-0 yerine top-0 left-0 w-screen h-screen ve data-smartboard-canvas kullanmalıdır"
  );
  assert.equal(
    diyalogCode.includes(safeModalSelector) &&
      metinCode.includes(safeModalSelector) &&
      flashcardCode.includes(safeModalSelector) &&
      blindDictationCode.includes(safeModalSelector) &&
      genderSortingCode.includes(safeModalSelector),
    true,
    "Tüm klavye dinleyicileri açık modalları kontrol ederken Akıllı Tahta SVG katmanını hariç tutmalıdır"
  );

  // 2. Seviye Tespit 180ms yarış kilidi (advanceLockRef & advanceTimerRef) ve dinamik CAT dinleme slotları
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    seviyeCode.includes("advanceLockRef") &&
      seviyeCode.includes("advanceTimerRef") &&
      seviyeCode.includes("clearPendingAdvance") &&
      seviyeCode.includes("function getCatListeningSlots(") &&
      !seviyeCode.includes("CAT_LISTENING_SLOTS = new Set"),
    true,
    "Seviye Tespit sayfası 180ms çift ilerleme kilidine (advanceLockRef/advanceTimerRef) ve dinamik CAT dinleme slotu hesabına sahip olmalıdır"
  );

  // 3. Diyalog ve Metin sayfalarında flowMode = 'single' sıfırlaması ve mükerrer resize kancasının kaldırılması
  const viewportHookMatches = diyalogCode.match(/const checkViewportForClassroom =/g) || [];
  assert.equal(
    viewportHookMatches.length,
    1,
    "diyalog/[id]/page.tsx içinde mükerrer checkViewportForClassroom resize kancası bulunmamalıdır"
  );
  assert.equal(
    !diyalogCode.includes('if (flowMode === "sequential") {\n      setIsPlayingAll(true);') &&
      !metinCode.includes('if (flowMode === "sequential") {\n      setIsPlayingAll(true);') &&
      diyalogCode.includes('setFlowMode("single");') &&
      metinCode.includes('setFlowMode("single");'),
    true,
    "Diyalog ve Metin sayfalarında Durdur ve tekil satır seslendirme (handlePlayLine) işlemleri flowMode değerini 'single' moduna döndürmelidir"
  );

  // 4. 3 Aşamalı Hareke Modu (full | irab-only | none) Metin, Kütüphane ve Sözlük senkronizasyonu
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  assert.equal(
    !metinCode.includes("getDisplayText(line.arapca, effectiveLineHareke)") &&
      metinCode.includes("lineHarekeOverrides[line.sira]") &&
      kutuphaneCode.includes("formatArabicByHarekeMode") &&
      sozlukCode.includes("formatArabicByHarekeMode"),
    true,
    "Metin, Kütüphane ve Sözlük sayfalarının tamamı 3 aşamalı hareke modunu (formatArabicByHarekeMode / irab-only) eksiksiz desteklemelidir"
  );

  // 5. Üst Bar & Ayarlar canlı speechRate senkronizasyonu, viewMode değişiminde reveal sıfırlama ve Okuma Metni Düzeni hızlı ayarı
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const ayarlarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    headerCode.includes("useAudioStore.getState().setPlaybackRate(rate)") &&
      ayarlarCode.includes("useAudioStore.getState().setPlaybackRate(rate)") &&
      headerCode.includes("Okuma Metni Düzeni") &&
      headerCode.includes("setReadingLayoutMode") &&
      diyalogCode.includes("setRevealedTrLines({});\n        setRevealedArLines({});") &&
      metinCode.includes("setRevealedTrLines({});\n        setRevealedArLines({});"),
    true,
    "Header ve Ayarlar canlı ses hızı senkronizasyonunu, Okuma Metni Düzeni hızlı geçişini ve viewMode değişiminde reveal sıfırlamayı içermelidir"
  );

  // 6. Alıştırma Merkezi 11 havuzun tamamının görünürlüğü ve aktif filtre değişiminde itemsSignature yenilenmesi
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const mcCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  const fibCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "FillInBlanks.tsx"),
    "utf8"
  );
  assert.equal(
    !alistirmalarCode.includes("poolOptions.slice(0, 9)") &&
      alistirmalarCode.includes("const quickPoolPills = poolOptions;") &&
      mcCode.includes("d.satirlar.length") &&
      fibCode.includes("d.satirlar.length") &&
      flashcardCode.includes("d.satirlar.length"),
    true,
    "Alıştırma Merkezinde 11 havuzun tamamı görünür olmalı ve alıştırma bileşenlerinde itemsSignature satır içeriğine duyarlı olmalıdır"
  );
});

test("40. Veri Envanteri (550 Soru, 14 Modül, 998 Görsel Kelime), Arapça Pedagojik Motor (Muzâri/Zamir Tenvin Kalkanı, Eş Anlamlı Çeldirici Filtresi, Gramer Hata Çözümleme, Dürüst Tempo Puanı) ve Açılış Turu / Kılavuz Senkronizasyonu", async () => {
  const { CONTENT_INVENTORY, esZitAnlamlilar } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href
  );
  const { selectSmartWordDistractors } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "quiz.ts")).href
  );
  const { normalizeToCanonicalMistakeId, resolveMistakesPool } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "mistakeUtils.ts")).href
  );
  const { calculateTempoScore } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "audioAnalysis.ts")).href
  );
  const { buildRealisticArabicMutations } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "components", "exercises", "ErrorHunter.tsx")
    ).href
  );
  const { SHARE_APP_TEXT } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "shareApp.ts")).href
  );

  // 1. Sayısal Envanter Eşitlemesi (550 soru, 14 modül, 998 görsel kelime, 10/15/20 adaptif CAT)
  assert.equal(
    CONTENT_INVENTORY.assessmentQuestionsCount,
    550,
    "CONTENT_INVENTORY.assessmentQuestionsCount 550 olmalıdır"
  );
  assert.equal(
    SHARE_APP_TEXT.includes("550 soruluk Seviye Tespit ve Konu Tarama Merkezi"),
    true,
    "SHARE_APP_TEXT 550 soruluk Seviye Tespit ve Konu Tarama Merkezi içermelidir"
  );

  const filesToReject180 = [
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    path.join(ROOT_DIR, "src", "app", "manifest.ts"),
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    path.join(ROOT_DIR, "src", "lib", "shareApp.ts"),
    path.join(ROOT_DIR, "README.md"),
  ];
  for (const fp of filesToReject180) {
    const content = fs.readFileSync(fp, "utf8");
    assert.equal(
      /180\s+[sS]oruluk/.test(content),
      false,
      `${path.basename(fp)} içinde eski '180 soruluk' ifadesi kalmamalıdır`
    );
  }

  const shareAchCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ShareAchievementModal.tsx"),
    "utf8"
  );
  assert.equal(
    shareAchCode.includes("${CONTENT_INVENTORY.exerciseModulesCount} Modül Alıştırma") &&
      !shareAchCode.includes("14 Modül Alıştırma") &&
      !shareAchCode.includes("8 Modül Alıştırma"),
    true,
    "ShareAchievementModal dinamik modül sayısını (CONTENT_INVENTORY.exerciseModulesCount) göstermelidir"
  );

  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    alistirmalarCode.includes("998 görsel kelime") &&
      !alistirmalarCode.includes("640 görsel ismi") &&
      !alistirmalarCode.includes("640 Görsel İsim"),
    true,
    "alistirmalar/page.tsx içinde '640 görsel ismi' yerine '998 görsel kelime' yer almalıdır"
  );

  // 2a. ErrorHunter muzâri fiil ve muttasıl zamir tenvin kalkanı
  const muzariAndPronounForms = [
    "يَكْتُبُ",
    "تَذْهَبُ",
    "أَدْرُسُ",
    "نَعْمَلُ",
    "كِتَابُهُ",
    "بَيْتُهَا",
    "مُعَلِّمُهُمْ",
    "قَلَمُكَ",
    "مَدْرَسَتُنَا",
  ];
  for (const form of muzariAndPronounForms) {
    const muts = buildRealisticArabicMutations(form, new Set([form]), []);
    assert.ok(muts.length >= 2, `${form} için gerçekçi çeldiriciler üretilmelidir`);
    for (const m of muts) {
      assert.equal(
        /[\u064B\u064C\u064D]|ًا$/u.test(m),
        false,
        `${form} kelimesinden üretilen '${m}' çeldiricisinde yapay tenvin bulunmamalıdır`
      );
    }
  }

  // 2b. selectSmartWordDistractors eş anlamlı (es_anlamlilar) dışlama koruması
  const sampleSynEntry = esZitAnlamlilar.find(
    (e) => e.es_anlamlilar.length >= 2 && e.tur === "isim"
  );
  assert.ok(sampleSynEntry, "Örnek eş anlamlı kaydı bulunmalıdır");
  const targetDictWord = {
    id: "test_target_syn",
    tur: "isim",
    kok: "-",
    cefr: sampleSynEntry.cefr,
    mufret: sampleSynEntry.kelime_ar,
    anlam_tr: sampleSynEntry.anlam_tr,
  };
  const injectedSynonym = {
    id: "test_injected_syn",
    tur: "isim",
    kok: "-",
    cefr: sampleSynEntry.cefr,
    mufret: sampleSynEntry.es_anlamlilar[0].ar,
    anlam_tr: "Farklı Yazılmış Eş Anlam Etiketi",
  };
  const safeDistractors = [
    { id: "d1", tur: "isim", kok: "كتب", cefr: sampleSynEntry.cefr, mufret: "مَكْتَبَةٌ", anlam_tr: "Kütüphane" },
    { id: "d2", tur: "isim", kok: "ركب", cefr: sampleSynEntry.cefr, mufret: "سَفِينَةٌ", anlam_tr: "Gemi" },
    { id: "d3", tur: "isim", kok: "فتح", cefr: sampleSynEntry.cefr, mufret: "مِفْتَاحٌ", anlam_tr: "Anahtar" },
    { id: "d4", tur: "isim", kok: "شجر", cefr: sampleSynEntry.cefr, mufret: "شَجَرَةٌ", anlam_tr: "Ağaç" },
  ];
  const pickedDistractors = selectSmartWordDistractors(
    targetDictWord,
    [injectedSynonym, ...safeDistractors],
    3
  );
  assert.equal(
    pickedDistractors.some((d) => d.id === "test_injected_syn"),
    false,
    "Hedef kelimenin eş anlamlısı (es_anlamlilar) yanlış şık olarak seçilmemelidir"
  );

  // 2c. Diyalog ve Metin hwMiniQuizQuestions bağlamsal çeldirici kontrolü
  const diyalogPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinPageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  assert.equal(
    diyalogPageCode.includes("otherLineArabicWords") &&
      metinPageCode.includes("otherLineArabicWords") &&
      !diyalogPageCode.includes('"نَعَمْ", "شُكْراً", "هُنَا"') &&
      !metinPageCode.includes('"نَعَمْ", "شُكْراً", "هُنَا"'),
    true,
    "Diyalog ve Metin mini sınav yedek çeldiricileri diğer satırlardaki kelimelerden üretilmelidir"
  );

  // 2d. mistakeUtils.ts grm_XXX gramer kartı çözümlemesi
  assert.equal(normalizeToCanonicalMistakeId("grm_001"), "grm_001");
  assert.equal(normalizeToCanonicalMistakeId("errhunt_grm_001"), "grm_001");
  assert.equal(normalizeToCanonicalMistakeId("grm_2"), "grm_002");
  const resolvedGrm = resolveMistakesPool(["grm_001", "errhunt_grm_002"]);
  assert.equal(
    resolvedGrm.words.length,
    2,
    "grm_001 ve errhunt_grm_002 gramer kartları resolveMistakesPool tarafından eksiksiz çözümlenmelidir"
  );
  assert.ok(
    resolvedGrm.words[0].mufret && resolvedGrm.words[0].anlam_tr,
    "Çözümlenen gramer kartı geçerli Arapça örnek ve Türkçe anlam içermelidir"
  );

  // 2e. audioAnalysis.ts dürüst tempo puanı (yapay >= 85 tabanı kaldırılmış)
  const slowShortTempo = calculateTempoScore(1.1, 3.3);
  const exactTempo = calculateTempoScore(1.5, 1.5);
  assert.ok(
    slowShortTempo < 50,
    `3 kat yavaş okunan kısa cümlede tempo puanı yapay 85 tabanına takılmamalıdır (hesaplanan: ${slowShortTempo})`
  );
  assert.equal(exactTempo, 100, "Eşit sürede tempo puanı 100 olmalıdır");

  // 3. OnboardingTourModal ve GuideAndInfoModalBody senkronizasyonu
  const tourSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );
  const guideSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    "utf8"
  );
  assert.equal(
    tourSrc.includes("onClick={handleTemporaryClose}") &&
      tourSrc.includes('if (e.key === "Escape") {\n        setIsOpen(false);') &&
      tourSrc.includes("`ADIM ${safeStep + 1} / ${steps.length}") &&
      !tourSrc.includes("step < 5") &&
      tourSrc.includes("soruluk Seviye Tespit ve Konu Tarama Merkezi") &&
      tourSrc.includes("Kartlık Gramer Atlası") &&
      tourSrc.includes("28 Harf Kişisel Mahreç Isı Haritası") &&
      tourSrc.includes("Eş &amp; Zıt Anlamlılar") &&
      tourSrc.includes("Seçkin Video &amp; İzleme Rehberi"),
    true,
    "OnboardingTourModal geçici kapatma, dinamik adım rozeti ve 5 yeni ana modülü eksiksiz içermelidir"
  );
  const actualAssessmentBank = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "seviye_tespit_sorulari.json"),
      "utf8"
    )
  );
  assert.equal(
    CONTENT_INVENTORY.assessmentQuestionsCount,
    actualAssessmentBank.length,
    "CONTENT_INVENTORY.assessmentQuestionsCount gerçek seviye_tespit_sorulari.json soru sayısıyla birebir aynı olmalıdır"
  );
  assert.equal(
    guideSrc.includes("10, 15 veya 20 soruluk adaptif CAT") &&
      !guideSrc.includes("12 soruluk adaptif") &&
      guideSrc.includes("soruluk Seviye Tespit ve Konu Tarama Merkezi") &&
      guideSrc.includes("{CONTENT_INVENTORY.grammarNotesCount} Kartlık Gramer Atlası") &&
      guideSrc.includes("28 Harf Kişisel Mahreç Isı Haritası") &&
      guideSrc.includes("Eş &amp; Zıt Anlamlılar") &&
      guideSrc.includes("Seçkin Video &amp; İzleme Rehberi"),
    true,
    "GuideAndInfoModalBody 10/15/20 adaptif CAT ve 5 yeni ana modülü eksiksiz içermelidir"
  );
});

test("41. İstemci Paket Boyutu Küçültme, Ölü Kod/Paket/Font/SW Temizliği, Settings Göç Koruması ve Admin/AudioStopper Sertleştirmesi", async () => {
  // 0. metadata.json kesinlikle korunmuş olmalıdır
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizindeki metadata.json dosyası kesinlikle silinmemelidir"
  );

  // 1. contentInventory.ts hafif modülü ve gerçek veri sayılarıyla birebir eşitlik
  const contentInventoryPath = path.join(
    ROOT_DIR,
    "src",
    "lib",
    "contentInventory.ts"
  );
  assert.equal(
    fs.existsSync(contentInventoryPath),
    true,
    "src/lib/contentInventory.ts hafif modülü mevcut olmalıdır"
  );
  const contentInventoryCode = fs.readFileSync(contentInventoryPath, "utf8");
  assert.equal(
    !contentInventoryCode.includes("@/data/") &&
      !contentInventoryCode.includes(".json"),
    true,
    "contentInventory.ts hiçbir JSON veri dosyasını import etmemelidir"
  );
  const { CONTENT_INVENTORY: lightInventory } = await import(
    pathToFileURL(contentInventoryPath).href
  );
  const {
    CONTENT_INVENTORY: dataReExportInventory,
    getDynamicContentStats,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href
  );
  const dynStats = getDynamicContentStats();
  assert.deepEqual(
    lightInventory,
    dataReExportInventory,
    "data.ts içindeki CONTENT_INVENTORY re-export ile contentInventory.ts birebir aynı olmalıdır"
  );
  assert.equal(lightInventory.dialoguesCount, dynStats.dialogueCount);
  assert.equal(lightInventory.readingsCount, dynStats.readingCount);
  assert.equal(lightInventory.sentencesCount, dynStats.sentenceCount);
  assert.equal(lightInventory.proverbsCount, dynStats.proverbCount);
  assert.equal(lightInventory.visualWordsCount, dynStats.visualWordCount);
  assert.equal(lightInventory.grammarNotesCount, dynStats.grammarNoteCount);
  assert.equal(lightInventory.dictionaryWordsCount, dynStats.dictionaryWordCount);
  assert.equal(lightInventory.youtubeVideosCount, dynStats.youtubeCount);
  assert.equal(lightInventory.synonymsAntonymsCount, dynStats.synonymsAntonymsCount);
  assert.equal(
    lightInventory.assessmentQuestionsCount,
    dynStats.assessmentQuestionsCount
  );

  // OnboardingTourModal, layout ve FeedbackModal dinamik yükleme kontrolü
  const onboardingSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );
  const layoutSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  const feedbackShellSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "FeedbackModal.tsx"),
    "utf8"
  );
  assert.equal(
    onboardingSrc.includes('@/lib/contentInventory') &&
      !onboardingSrc.includes('@/lib/data') &&
      layoutSrc.includes('@/lib/contentInventory') &&
      !layoutSrc.includes('@/lib/data'),
    true,
    "OnboardingTourModal.tsx ve layout.tsx doğrudan hafif @/lib/contentInventory modülünü kullanmalıdır"
  );
  assert.equal(
    feedbackShellSrc.includes('from "next/dynamic"') &&
      feedbackShellSrc.includes("ssr: false") &&
      !feedbackShellSrc.includes('@/lib/data') &&
      fs.existsSync(
        path.join(ROOT_DIR, "src", "components", "ui", "FeedbackModalBody.tsx")
      ),
    true,
    "FeedbackModal.tsx next/dynamic (ssr: false) ile yalnızca açıldığında FeedbackModalBody ve veriyi yüklemelidir"
  );

  // 2. Ölü dosya (sound.ts), kullanılmayan paketler, kanonik Arakom fontu, SW ve .gitignore temizliği
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "src", "lib", "sound.ts")),
    false,
    "Hiçbir yerde import edilmeyen ölü src/lib/sound.ts dosyası silinmiş olmalıdır"
  );
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8")
  );
  assert.equal(
    !("framer-motion" in (pkgJson.dependencies || {})) &&
      !("clsx" in (pkgJson.dependencies || {})) &&
      !("tailwind-merge" in (pkgJson.dependencies || {})),
    true,
    "package.json dependencies içinden kullanılmayan framer-motion, clsx ve tailwind-merge kaldırılmış olmalıdır"
  );

  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  const arabicTextUtilsSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts"),
    "utf8"
  );
  const teamBattleSrc = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      "ClassroomTeamBattle.tsx"
    ),
    "utf8"
  );
  const seviyeTespitSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  assert.equal(
    globalsCss.includes('font-family: "Arakom";') &&
      !globalsCss.includes("ArakomFont") &&
      !arabicTextUtilsSrc.includes("ArakomFont") &&
      !teamBattleSrc.includes("ArakomFont") &&
      !seviyeTespitSrc.includes("ArakomPrint"),
    true,
    "Arakom.ttf font ailesi tek bir kanonik 'Arakom' adında birleştirilmiş olmalıdır"
  );

  const swSrc = fs.readFileSync(
    path.join(ROOT_DIR, "public", "sw.js"),
    "utf8"
  );
  const sozlukPageSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  const gitignoreSrc = fs.readFileSync(
    path.join(ROOT_DIR, ".gitignore"),
    "utf8"
  );
  assert.equal(
    !swSrc.includes("/audio/manifest.json") &&
      !sozlukPageSrc.includes("/audio/words/"),
    true,
    "public/sw.js içinden var olmayan /audio/manifest.json ve sozluk/page.tsx içinden ölü /audio/words/ kontrolü kaldırılmış olmalıdır"
  );
  assert.equal(
    gitignoreSrc.includes("!.env.example"),
    true,
    ".gitignore dosyasına !.env.example istisnası eklenmiş olmalıdır"
  );

  // 3. settings.ts DEFAULT_SETTINGS göç koruması, tekil SettingsEffects ve ayarlar CEFR senkronizasyonu
  const settingsSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "store", "settings.ts"),
    "utf8"
  );
  const settingsEffectsSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "SettingsEffects.tsx"),
    "utf8"
  );
  const headerSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const ayarlarSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );
  assert.equal(
    settingsSrc.includes("export const DEFAULT_SETTINGS") &&
      settingsSrc.includes("...DEFAULT_SETTINGS"),
    true,
    "settings.ts DEFAULT_SETTINGS sabiti tanımlamalı ve migrate sonunda varsayılanlarla birleştirmelidir"
  );
  assert.equal(
    settingsEffectsSrc.includes("applyGlobalTypographyCssVars") &&
      layoutSrc.includes("<SettingsEffects />") &&
      !headerSrc.includes("applyGlobalTypographyCssVars") &&
      !ayarlarSrc.includes("applyGlobalTypographyCssVars"),
    true,
    "Tema ve global tipografi CSS değişkeni yan etkileri tekil SettingsEffects bileşeninde toplanmalıdır"
  );
  assert.equal(
    ayarlarSrc.includes("effectiveCefrLevel") &&
      ayarlarSrc.includes('preferredLevel === "İleri"') &&
      ayarlarSrc.includes('preferredLevel === "Orta"') &&
      ayarlarSrc.includes("setDetectedCefrLevel(lvl)") &&
      ayarlarSrc.includes("setPreferredLevel("),
    true,
    "ayarlar/page.tsx içinde detectedCefrLevel ve preferredLevel tek kaynaklı olarak senkronize edilmelidir"
  );

  // 4. Admin Stüdyosu (.wav + ata_0001 + flex-wrap) ve AudioStopper 3 dk etkileşim koruması
  const adminSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "admin", "page.tsx"),
    "utf8"
  );
  const audioStopperSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "AudioStopper.tsx"),
    "utf8"
  );
  assert.equal(
    adminSrc.includes("ses_erkek: `/sesler/kelimeler/erkek/${pad4}.wav`") &&
      adminSrc.includes("ses_kadin: `/sesler/kelimeler/kadin/${pad4}.wav`") &&
      adminSrc.includes("id: `ata_${pad4}`") &&
      adminSrc.includes("gorsel: `/gorseller/atasozleri/ata_${pad4}.webp`") &&
      adminSrc.includes("ses_erkek: `/sesler/atasozleri/erkek/ata_${pad4}.wav`") &&
      adminSrc.includes("ses_kadin: `/sesler/atasozleri/kadin/ata_${pad4}.wav`") &&
      adminSrc.includes('className="flex flex-wrap gap-1.5"') &&
      !adminSrc.includes("xl:grid-cols-11"),
    true,
    "admin/page.tsx gorsel_kelimeler ve atasozleri_508 için .wav + 4 haneli ata_0001 üretmeli ve 13 sekmeyi flex-wrap ile dizmelidir"
  );
  assert.equal(
    audioStopperSrc.includes("lastInteractionAt") &&
      audioStopperSrc.includes("3 * 60 * 1000") &&
      audioStopperSrc.includes("isAudioCurrentlyPlaying") &&
      audioStopperSrc.includes("addStudyMinutes(1)"),
    true,
    "AudioStopper.tsx son 3 dakikada kullanıcı etkileşimi veya aktif ses çalma kontrolü yapmalıdır"
  );
});

test("42. Metin/Diyalog Üst Bar Tekrar Temizliği, Seslendirici Tercihi Kapsam Netleştirmesi, Rozet Hizalaması, HTTPS Harici İzleme Platformları ve 60 Kayıtlık YouTube Envanteri", async () => {
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const ayarlarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );

  // 1. Metin ve Diyalog sayfalarında Kadın/Erkek ses değiştirme butonu bulunmamalı, doğrudan kendi ses_dosyasi oynatılmalı
  assert.equal(
    !metinCode.includes("preferredVoiceGender") &&
      !metinCode.includes("togglePreferredVoiceGender") &&
      !metinCode.includes('aria-label="Seslendirici Cinsiyeti"') &&
      !diyalogCode.includes("preferredVoiceGender") &&
      !diyalogCode.includes("togglePreferredVoiceGender") &&
      !diyalogCode.includes('aria-label="Seslendirici Cinsiyeti"') &&
      metinCode.includes("getMp3Path(readingText.id, line.sira)") &&
      diyalogCode.includes("getMp3Path(dialogue.id, line.sira)"),
    true,
    "Metin ve Diyalog sayfalarında işlevsiz Erkek/Kadın ses değiştirici yer almamalı, her satır kendi orijinal ses_dosyasi kaydını çalmalıdır"
  );

  // Header (...) menüsü ve Ayarlar sayfasında kapsam açıklaması yer almalı
  const expectedScopeNote =
    "1111 Cümle, Görsel Kelimeler ve Atasözleri için geçerlidir";
  assert.equal(
    headerCode.includes(expectedScopeNote) &&
      ayarlarCode.includes(expectedScopeNote),
    true,
    "Header.tsx ve ayarlar/page.tsx içinde Seslendirici Tercihi kapsam açıklaması yer almalıdır"
  );

  // 2. Üst kontrol çubuğu (3. Satır) ve Hızlı Etkinlik şeridi (4. Satır) tekrarlarının giderilmesi
  const countOccurrences = (src, needle) => src.split(needle).length - 1;
  assert.equal(
    countOccurrences(metinCode, "handleToggleGrammarSplit()") === 1 &&
      countOccurrences(diyalogCode, "handleToggleGrammarSplit()") === 1 &&
      !diyalogCode.includes('aria-label="Rol Yapma Modu"') &&
      countOccurrences(diyalogCode, "🎭 Rol Yapma") === 1 &&
      !metinCode.includes("🎙️ Sesli Okuma") &&
      !metinCode.includes("❓ Anlama Soruları ("),
    true,
    "Metin ve Diyalog sayfalarında Yan Yana Gramer, Rol Yapma, Sesli Okuma ve Anlama Soruları butonları mükerrer olarak tekrarlanmamalıdır"
  );

  // Hızlı Etkinlik şeridinde benzersiz pedagojik araçlar korunmalı
  assert.equal(
    diyalogCode.includes("👥 İkili Kart (A/B)") &&
      diyalogCode.includes("👁️ Kör Dinleme") &&
      diyalogCode.includes("📄 A4 PDF") &&
      diyalogCode.includes("🎯 Ödev &amp; Paylaş") &&
      diyalogCode.includes("🖼️ Görsel Kart") &&
      metinCode.includes("👁️ Kör Dinleme") &&
      metinCode.includes("📄 A4 PDF") &&
      metinCode.includes("🎯 Ödev &amp; Paylaş") &&
      metinCode.includes("🖼️ Görsel Kart"),
    true,
    "Hızlı Etkinlik şeridi benzersiz sınıf ve çalışma araçlarını eksiksiz korumalıdır"
  );

  // 3. Üst bilgi rozetleri ferah gap-2.5 ve tutarlı 'Diyalog #01 • A1' / 'Metin #55 • B2' formatında olmalı
  assert.equal(
    diyalogCode.includes(
      'Diyalog #{String(rawNum).padStart(2, "0")} • {dialogue.seviye}'
    ) &&
      metinCode.includes(
        'Metin #{String(rawNum).padStart(2, "0")} • {readingText.seviye}'
      ) &&
      diyalogCode.includes('<div className="flex flex-wrap items-center gap-2.5">') &&
      metinCode.includes('<div className="flex flex-wrap items-center gap-2.5">'),
    true,
    "Diyalog ve Metin üst bilgi rozetleri tutarlı formatta ve gap-2.5 boşlukla hizalanmalıdır"
  );

  // 4. Harici İzleme Platformları: Ücretli/ölü/HTTP linklerin temizlenmesi ve 4 resmi ücretsiz HTTPS kanalın eklenmesi
  const { EXTERNAL_WATCH_PLATFORM_GROUPS } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts")).href
  );
  const allPlatforms = EXTERNAL_WATCH_PLATFORM_GROUPS.flatMap(
    (g) => g.platforms
  );
  const allUrls = allPlatforms.map((p) => p.url);

  for (const banned of [
    "muzzybbc",
    "NatGeoAbuDhabi",
    "cartoon3rbi",
    "arabic-toons",
  ]) {
    assert.equal(
      allUrls.some((u) => u.toLowerCase().includes(banned.toLowerCase())),
      false,
      `Kaldırılan ölü/ücretli/HTTP platform (${banned}) listede bulunmamalıdır`
    );
  }
  assert.equal(
    allUrls.every((u) => u.startsWith("https://")),
    true,
    "Tüm harici izleme platformu bağlantıları güvenli HTTPS protokolünü kullanmalıdır"
  );
  for (const requiredUrl of [
    "https://www.youtube.com/@LearnwithZakaria",
    "https://www.youtube.com/@KhanAcademyArabi",
    "https://www.youtube.com/@dwdocumentaryar",
    "https://www.youtube.com/@ajpluskabreet",
  ]) {
    assert.equal(
      allUrls.includes(requiredUrl),
      true,
      `Yeni resmi ücretsiz Fasih Arapça kanalı (${requiredUrl}) harici platform listesinde yer almalıdır`
    );
  }

  // 5. 60 kayıtlık youtube_tavsiyeleri.json (A1:15, A2:15, B1:15, B2:15) ve metadata.json koruması
  const { parsed: ytItems } = readDataJson("youtube_tavsiyeleri.json");
  const byCefr = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const item of ytItems) {
    byCefr[item.cefr] = (byCefr[item.cefr] || 0) + 1;
  }
  assert.deepEqual(byCefr, { A1: 15, A2: 15, B1: 15, B2: 15 });

  const { CONTENT_INVENTORY } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "contentInventory.ts")).href
  );
  assert.equal(CONTENT_INVENTORY.youtubeVideosCount, 60);
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizindeki metadata.json dosyası korunmalıdır"
  );
});

test("43. UTF-8 Bütünlüğü, API Güvenlik Sertleştirmesi, 195 Gramer İlmî/Terminolojik Doğruluğu, 60 Metin odak_gramer & 120 Diyalog CEFR Sıralaması ve board-mode Katmanı", () => {
  // 1. UTF-8 geçerliliği, CESU-8 vekil çifti yokluğu, bun.lock silinmesi ve metadata.json korunması
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "bun.lock")),
    false,
    "Kök dizindeki kullanılmayan bun.lock dosyası silinmiş olmalıdır"
  );
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizindeki metadata.json dosyası korunmalıdır"
  );

  const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
  const walkSourceFiles = (dirPath, acc = []) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git"
      ) {
        continue;
      }
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walkSourceFiles(full, acc);
      } else if (/\.(ts|tsx|json)$/.test(entry.name)) {
        acc.push(full);
      }
    }
    return acc;
  };

  const allCheckedFiles = walkSourceFiles(path.join(ROOT_DIR, "src"));
  assert.ok(
    allCheckedFiles.length >= 60,
    "src/ altında en az 60 adet .ts/.tsx/.json dosyası taranmalıdır"
  );

  for (const filePath of allCheckedFiles) {
    const rawBuf = fs.readFileSync(filePath);
    let decoded = "";
    assert.doesNotThrow(() => {
      decoded = strictUtf8Decoder.decode(rawBuf);
    }, `${filePath} %100 geçerli UTF-8 olmalıdır`);

    for (let i = 0; i < rawBuf.length - 2; i++) {
      if (rawBuf[i] === 0xed && rawBuf[i + 1] >= 0xa0 && rawBuf[i + 1] <= 0xbf) {
        assert.fail(
          `${filePath} içinde CESU-8 vekil çifti (surrogate byte sequence) bulundu (byte ${i})`
        );
      }
    }
    assert.equal(
      decoded.isWellFormed(),
      true,
      `${filePath} içinde bozuk/tekil UTF-16 surrogate karakteri bulunmamalıdır`
    );
  }

  const assessmentTypesCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "types", "assessment.ts"),
    "utf8"
  );
  assert.equal(
    assessmentTypesCode.includes('icon: known?.icon || "\\u{1F3DB}\\uFE0F"'),
    true,
    "src/types/assessment.ts içindeki varsayılan ikon saf ASCII Unicode kaçış dizisi olmalıdır"
  );

  // 2. API Güvenlik Sertleştirmeleri (/api/stt, /api/admin, /api/stats, /api/feedback) ve MultipleChoice senkron tıklama kilidi
  const sttCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stt", "route.ts"),
    "utf8"
  );
  assert.equal(
    sttCode.includes("!Number.isFinite(v)") &&
      sttCode.includes("status: 400") &&
      sttCode.includes("Math.max(-1, Math.min(1, v))"),
    true,
    "/api/stt samples elemanlarının sonlu sayı olduğunu doğrulamalı (400) ve [-1, 1] aralığına sıkıştırmalıdır"
  );

  const adminCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  assert.equal(
    adminCode.includes('process.env.NODE_ENV === "production" && !configuredSecret') &&
      adminCode.includes("status: 503"),
    true,
    "/api/admin üretim ortamında ADMIN_SECRET eksikse 503 Service Unavailable döndürmelidir"
  );

  const statsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stats", "route.ts"),
    "utf8"
  );
  const feedbackCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "feedback", "route.ts"),
    "utf8"
  );
  assert.equal(
    statsCode.includes("60_000") &&
      statsCode.includes("isStatsRateLimited") &&
      statsCode.includes("status: 429") &&
      feedbackCode.includes("60_000") &&
      feedbackCode.includes("isRateLimited") &&
      feedbackCode.includes("status: 429"),
    true,
    "/api/stats ve /api/feedback uçlarında dakika bazlı IP rate-limiting (HTTP 429) aktif olmalıdır"
  );

  const mcCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  assert.equal(
    mcCode.includes("answerLockedRef") &&
      mcCode.includes("selected || answerLockedRef.current") &&
      mcCode.includes("answerLockedRef.current = true"),
    true,
    "MultipleChoice.tsx içinde ardışık çift tıklamayı engelleyen senkron answerLockedRef kilidi bulunmalıdır"
  );

  // 3. Gramer Notlarında İlmî Düzeltmeler ve Terminoloji Standardizasyonu (195 Not)
  const { parsed: dlgGramer } = readDataJson("diyaloglar_gramer_hap_bilgi.json");
  const { parsed: metinGramer } = readDataJson("metinler_gramer_hap_bilgi.json");
  const { parsed: ekGramer } = readDataJson("ek_gramer_hap_bilgi.json");

  const g111 = dlgGramer.find((g) => g.bagli_id === "dlg_111");
  assert.equal(
    g111?.ayrintili_anlatim?.dikkat_sik_hata?.neden,
    "Sâhibu'l-Hâl'in belirli (marife) olması temel ve yaygın kuraldır; ancak tahsis veya umum (nefy/istifham) gibi belirli dilbilgisel şartlarda nekra isim de sâhibu'l-hâl olabilir.",
    "dlg_111 Sâhibu'l-Hâl ilmî açıklaması güncellenmiş olmalıdır"
  );

  const g081 = dlgGramer.find((g) => g.bagli_id === "dlg_081");
  assert.equal(
    g081?.ayrintili_anlatim?.dikkat_sik_hata?.neden,
    "أَنْ edatı muzâri fiili mansûb yapar. Nasb alâmeti sahih fiillerde açık fetha, illetli fiillerde takdirî fetha, ef'âl-i hamse'de ise nûn harfinin düşmesidir (hazfü'n-nûn).",
    "dlg_081 Muzâri nasb alâmetleri ilmî açıklaması güncellenmiş olmalıdır"
  );

  const g110 = dlgGramer.find((g) => g.bagli_id === "dlg_110");
  assert.equal(
    g110?.ayrintili_anlatim?.dikkat_sik_hata?.neden,
    "Temyiz, kendisinden önceki kapalılığı gideren mansûb bir isimdir (mef'ûlün bih ile karıştırılmamalıdır).",
    "dlg_110 Temyiz açıklaması 'nesne gibi' ifadesinden arındırılmış olmalıdır"
  );

  const g001 = dlgGramer.find((g) => g.bagli_id === "dlg_001");
  const g001Steps = (g001?.ayrintili_anlatim?.adim_adim_anlatim || []).join(" ");
  assert.equal(
    g001Steps.includes("şibh-i cümle") &&
      g001Steps.includes("isim cümlesi") &&
      g001Steps.includes("fiil cümlesi"),
    true,
    "dlg_001 İsim Cümlesi anlatımında haberin cümle ve şibh-i cümle olarak da gelebileceği belirtilmelidir"
  );

  const unstandardizedRegex =
    /(?<![A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû])(?:mazi|muzari|mef['\u2019]ul|mevsul)[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]*/gi;
  for (const [fileName, parsedData] of [
    ["diyaloglar_gramer_hap_bilgi.json", dlgGramer],
    ["metinler_gramer_hap_bilgi.json", metinGramer],
    ["ek_gramer_hap_bilgi.json", ekGramer],
  ]) {
    const leftover = JSON.stringify(parsedData).match(unstandardizedRegex) || [];
    assert.deepEqual(
      leftover,
      [],
      `${fileName} içinde şapkasız mazi/muzari/mef'ul/mevsul terimi kalmamalıdır`
    );
  }

  // 4. 60 Okuma Metninde odak_gramer ve 120 Diyalogda CEFR sira (A1:1-30, A2:31-60, B1:61-90, B2:91-120)
  const { parsed: metinler } = readDataJson("tum_metinler_60.json");
  assert.equal(metinler.length, 60);
  const metinGramerMap = new Map(
    metinGramer.map((g) => [g.bagli_id, g.konu_basligi])
  );
  for (const m of metinler) {
    assert.equal(
      typeof m.odak_gramer === "string" && m.odak_gramer.trim().length > 0,
      true,
      `${m.id} okuma metninde odak_gramer alanı dolu olmalıdır`
    );
    assert.equal(
      m.odak_gramer,
      metinGramerMap.get(m.id),
      `${m.id} odak_gramer değeri metinler_gramer_hap_bilgi.json konu_basligi ile eşleşmelidir`
    );
  }

  const { parsed: diyaloglar } = readDataJson("tum_diyaloglar_120.json");
  assert.equal(diyaloglar.length, 120);
  const seenDlgIds = new Set();
  for (let i = 0; i < diyaloglar.length; i++) {
    const d = diyaloglar[i];
    seenDlgIds.add(d.id);
    assert.equal(d.sira, i + 1, `Diyalog sira değeri ${i + 1} olmalıdır`);
    const expectedLevel =
      i < 30 ? "A1" : i < 60 ? "A2" : i < 90 ? "B1" : "B2";
    assert.equal(
      d.seviye,
      expectedLevel,
      `sira=${d.sira} (${d.id}) diyaloğunun seviyesi ${expectedLevel} olmalıdır`
    );
  }
  assert.equal(seenDlgIds.size, 120, "120 benzersiz dlg_XXX kimliği korunmalıdır");
  for (let n = 1; n <= 120; n++) {
    const expectedId = `dlg_${String(n).padStart(3, "0")}`;
    assert.equal(
      seenDlgIds.has(expectedId),
      true,
      `${expectedId} kimliği korunmuş olmalıdır`
    );
  }

  // 5. Akıllı Tahta (board-mode) Ölçeklendirme Katmanı
  const settingsEffectsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "SettingsEffects.tsx"),
    "utf8"
  );
  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  assert.equal(
    settingsEffectsCode.includes('classList.toggle("board-mode"') &&
      settingsEffectsCode.includes('classList.remove("board-mode")'),
    true,
    "SettingsEffects.tsx html.board-mode sınıfını açılışta eklemeli ve kapanışta kaldırmalıdır"
  );
  assert.equal(
    globalsCss.includes("@media (min-width: 1366px)") &&
      globalsCss.includes("html.board-mode main .arabic") &&
      globalsCss.includes("html.board-mode main .font-arabic") &&
      globalsCss.includes("line-height: 2.1;") &&
      !globalsCss.includes("min-height: 52px") &&
      !globalsCss.includes("font-size: 19px"),
    true,
    "globals.css yalnızca >= 1366px altında html.board-mode main .arabic satır aralığını (line-height: 2.1) desteklemeli, modal veya sekme buton yüksekliklerini ezmemelidir"
  );
});

test("44. A4 Yazılı Sınav, Ders Notu (Okuma Metni) & Quiz Üretici Stüdyosu — 6 Materyal Kaynağı, 6 Bölümlü 100 Puan Dağılımı, Konu Özeti ve 3 Ders Notu Mizanpajı", async () => {
  const {
    STUDIO_MATERIAL_SOURCES,
    STUDIO_DEFAULT_PAPER_TITLE,
    buildSixSectionExamData,
    listStudioPackOptions,
    resolveStudioMaterialBundle,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "a4ExamStudioEngine.ts")).href
  );
  const { allocateExam100PointsSixSections } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "pdfDeterministicUtils.ts")).href
  );

  // 1. 6 Materyal Kaynağı eksiksiz mevcut olmalı ve her biri için paket/demet üretilebilmeli
  const expectedSourceIds = [
    "diyaloglar",
    "metinler",
    "gorsel_kelimeler",
    "cumleler_1111",
    "atasozleri",
    "es_zit_anlamlilar",
  ];
  assert.deepEqual(
    STUDIO_MATERIAL_SOURCES.map((s) => s.id),
    expectedSourceIds,
    "6 materyal kaynağı eksiksiz tanımlı olmalıdır"
  );
  assert.equal(
    STUDIO_DEFAULT_PAPER_TITLE.toLocaleUpperCase("tr-TR").includes("ARAPÇA DERSİ"),
    true,
    "Varsayılan sınav/çalışma kağıdı başlığı tanımlı olmalıdır"
  );

  for (const srcId of expectedSourceIds) {
    const packs = listStudioPackOptions(srcId, "A1");
    assert.ok(packs.length > 0, `${srcId} kaynağı için A1 paketleri üretilmelidir`);
    const bundle = resolveStudioMaterialBundle({
      sourceId: srcId,
      levelFilter: "A1",
      packId: packs[0].id,
    });
    assert.ok(
      bundle.dialogue.satirlar.length > 0 && bundle.vocabCandidates.length > 0,
      `${srcId} demeti hem satır hem kelime havuzu üretmelidir`
    );
  }

  // 2. 6 Bölümlü Sınav üretimi: 0 seçilen bölüm gizlenmeli, aktif bölümlerin toplam puanı 100 olmalı
  const sampleBundle = resolveStudioMaterialBundle({
    sourceId: "diyaloglar",
    levelFilter: "A1",
    packId: "dlg_001",
  });
  const examData = buildSixSectionExamData({
    bundle: sampleBundle,
    counts: {
      sec1ArToTr: 4,
      sec2TrToAr: 4,
      sec3FillBlank: 0, // 0 seçilen bölüm gizlenmeli!
      sec4MultipleChoice: 4,
      sec5Matching: 5,
      sec6Morphology: 3,
    },
    bookletGroup: "A",
  });

  assert.equal(
    examData.sec3FillBlank.length,
    0,
    "Sayısı 0 yapılan bölüm (Boşluk Doldurma) üretilmemeli / gizlenmelidir"
  );
  assert.equal(examData.sec1ArToTr.length, 4);
  assert.equal(examData.sec2TrToAr.length, 4);
  assert.equal(examData.sec4MultipleChoice.length, 4);
  assert.equal(examData.sec5Matching.length, 5);
  assert.equal(examData.sec6Morphology.length, 3);
  assert.equal(
    examData.pointsAllocation.grandTotal,
    100,
    "Aktif bölümlerin toplam sınav puanı tam 100 olmalıdır"
  );

  const zeroAlloc = allocateExam100PointsSixSections([0, 0, 0, 0, 0, 0]);
  assert.equal(zeroAlloc.grandTotal, 0);

  // 3. DialoguePdfModal.tsx içinde 3 Ders Notu mizanpajı, Konu Özeti kutusu ve Stüdyo başlığı
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  assert.equal(
    pdfModalCode.includes("A4 Yazılı Sınav, Ders Notu &amp; Quiz Üretici") ||
      pdfModalCode.includes("A4 Yazılı Sınav, Ders Notu & Quiz Üretici"),
    true,
    "DialoguePdfModal stüdyo başlığını içermelidir"
  );
  assert.equal(
    pdfModalCode.includes("STUDIO_MATERIAL_SOURCES") &&
      pdfModalCode.includes("includeTopicSummary") &&
      pdfModalCode.includes("Konu Özeti Kutusu") &&
      pdfModalCode.includes("Yan Yana") &&
      pdfModalCode.includes("Sadece Arapça") &&
      pdfModalCode.includes("Alt Alta Satır"),
    true,
    "DialoguePdfModal 6 kaynak seçici, Konu Özeti kutusu ve 3 Ders Notu mizanpajını içermelidir"
  );
});

test("45. 2 Yeni İnteraktif Oyun Modülü — Balon Safari (BalloonSafariGame) & 3D Hafıza Kartları (MemoryFlipGame) ve 16 Modül Envanter Doğrulaması", () => {
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const balloonCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );
  const memoryCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );

  // 1. Alıştırmalar sayfasında 16 modülün tamamı ssr: false ile lazy-load edilmeli ve yeni oyunlar vitrinde olmalı
  assert.equal(
    alistirmalarCode.includes('import("@/components/exercises/BalloonSafariGame")') &&
      alistirmalarCode.includes('import("@/components/exercises/MemoryFlipGame")') &&
      alistirmalarCode.includes('id: "balloon-safari"') &&
      alistirmalarCode.includes('id: "memory-flip"'),
    true,
    "BalloonSafariGame ve MemoryFlipGame dinamik olarak yüklenmeli ve alıştırma kartlarında yer almalıdır"
  );

  // 2. Balon Safari: 60fps fizik, 4 seviye, güçlendirmeler, hata grafiği ve A4/PNG Başarı Sertifikası
  assert.equal(
    balloonCode.includes("سَفَارِي البَالُونَات") &&
      balloonCode.includes("requestAnimationFrame") &&
      balloonCode.includes("الوَضْعُ العادِيّ") &&
      balloonCode.includes("تَحَدِّي الوَقْت") &&
      balloonCode.includes("تَجْمِيد") &&
      balloonCode.includes("تَلْمِيحَة") &&
      balloonCode.includes("جَائِزَة 5x") &&
      balloonCode.includes("إِعَادَة الصَّوْت") &&
      balloonCode.includes("أَكْثَرُ الأَخْطَاء") &&
      balloonCode.includes("تَدَرَّبْ عَلَى الأَخْطَاء") &&
      balloonCode.includes("شَهَادَة نَجَاح") &&
      balloonCode.includes("canvas.toBlob"),
    true,
    "BalloonSafariGame tüm fizik, seviye, güçlendirme, hata pratiği ve sertifika özelliklerini içermelidir"
  );
  assert.equal(
    balloonCode.includes("window.open") ||
      balloonCode.includes("window.alert") ||
      balloonCode.includes("style={{"),
    false,
    "BalloonSafariGame içinde window.open, window.alert veya satır içi style={{ bulunmamalıdır"
  );

  // 3. Hafızanı Yokla (3D Hafıza Kartları): gerçek CSS 3D perspektif, 4/6/8 çift seviyeleri, 1.5s ipucu ve SRS entegrasyonu
  assert.equal(
    memoryCode.includes("لُعْبَةُ الذَّاكِرَةِ") &&
      memoryCode.includes("[perspective:1000px]") &&
      memoryCode.includes("[transform-style:preserve-3d]") &&
      memoryCode.includes("[backface-visibility:hidden]") &&
      memoryCode.includes("[transform:rotateY(180deg)]") &&
      memoryCode.includes("4 çift • 20 sn") &&
      memoryCode.includes("6 çift • 15 sn") &&
      memoryCode.includes("8 çift • 10 sn") &&
      memoryCode.includes("Kartları 1.5 Saniye Göster") &&
      memoryCode.includes("recordItemAttempt") &&
      memoryCode.includes("addMistake"),
    true,
    "MemoryFlipGame gerçek CSS 3D dönüşüm, 3 zorluk seviyesi (4/6/8 çift), 1.5 sn ipucu ve Hata Defteri/SRS entegrasyonunu içermelidir"
  );
  assert.equal(
    memoryCode.includes("window.open") ||
      memoryCode.includes("window.alert") ||
      memoryCode.includes("style={{"),
    false,
    "MemoryFlipGame içinde window.open, window.alert veya satır içi style={{ bulunmamalıdır"
  );
});

test("46. Öğrenme İstatistikleri, Başarı Rozetleri ve A4 Öğretmen Raporu (StatsAndBadgesModal & learningAnalytics) — 4 Rütbe, 8 Rozet, CEFR/Modül Grafikleri ve 3 Tek Tıkla Erişim Noktası", async () => {
  const {
    computeLearnerRank,
    computeLearningAnalyticsSnapshot,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "learningAnalytics.ts")).href
  );
  const { sozluk } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "data.ts")).href
  );

  // 1. 4 kademeli rütbe hesaplama motoru doğrulaması
  assert.equal(computeLearnerRank(0).title, "Bronz Talebe (Seviye 1)");
  assert.equal(computeLearnerRank(450).title, "Gümüş Hatip (Seviye 2)");
  assert.equal(computeLearnerRank(1100).title, "Altın Edip (Seviye 3)");
  assert.equal(computeLearnerRank(2200).title, "Fasih Üstad (Seviye 4)");

  const realWordId = sozluk[0].id;
  const realSentenceId = "sent_dlg_001_1";

  // 2. Gerçek userStore verisiyle anlık analiz kesiti (8 rozet, 4 CEFR seviyesi, 6 ana modül, hata sıralaması)
  const snapshot = computeLearningAnalyticsSnapshot({
    completedDialogues: ["dlg_001", "dlg_002", "txt_001"],
    learnedWords: sozluk.slice(0, 30).map((w) => w.id),
    favoriteWords: [],
    weakWords: [],
    mistakeIds: [realWordId, realSentenceId],
    srsRecords: {
      [realWordId]: {
        id: realWordId,
        box: 1,
        nextReviewAt: 0,
        lastReviewedAt: 1000,
        correctCount: 1,
        wrongCount: 5,
      },
      [realSentenceId]: {
        id: realSentenceId,
        box: 1,
        nextReviewAt: 0,
        lastReviewedAt: 1000,
        correctCount: 1,
        wrongCount: 2,
      },
    },
    pronunciationScores: [92, 85],
    pronunciationHistory: [
      { id: "p1", textAr: "مَرْحَبًا", score: 92, date: "2026-11-13" },
    ],
    totalPronunciationAttempts: 2,
    studyMinutes: 20,
    activityXp: 1100,
    streakDays: 4,
    lastStudyDate: "2026-11-13",
    todayStr: "2026-11-13",
    yesterdayStr: "2026-11-12",
    dailyGoalMinutes: 15,
    topicMastery: {},
    skillStats: {
      okuma: { correct: 10, total: 12 },
      dinleme: { correct: 8, total: 10 },
      konusma: { correct: 5, total: 6 },
      kelime: { correct: 25, total: 30 },
      gramer: { correct: 6, total: 8 },
    },
    completedLevelExams: ["A1"],
    phonemeStats: {
      ع: { attempts: 6, cleanHits: 2, confusions: 4, lastConfusedWith: "أ" },
    },
    watchedVideos: ["vid_1", "vid_2", "vid_3", "vid_4", "vid_5"],
    storedLastExercise: {
      hasData: true,
      moduleName: "3D Hafıza Kartları",
      solved: 16,
      correct: 14,
      wrong: 2,
      accuracyPercent: 88,
    },
  });

  assert.equal(snapshot.badges.length, 8, "Tam 8 adet rozet tanımlı olmalıdır");
  const expectedBadgeTitles = [
    "İlk Kıvılcım",
    "Kelime Avcısı",
    "Muhâdese Yıldızı",
    "Cümle Üstadı",
    "İstikrar Abidesi",
    "Arapça Hatibi",
    "Gramer Kaşifi",
    "Dinleme Seyyahı",
  ];
  assert.deepEqual(
    snapshot.badges.map((b) => b.title),
    expectedBadgeTitles,
    "8 rozet başlığı eksiksiz eşleşmelidir"
  );
  assert.equal(
    snapshot.badges.find((b) => b.title === "İlk Kıvılcım")?.statusTag,
    "[☑️ KAZANILDI]"
  );
  assert.equal(
    snapshot.badges.find((b) => b.title === "Kelime Avcısı")?.statusTag,
    "[☑️ KAZANILDI]"
  );
  assert.equal(
    snapshot.badges.find((b) => b.title === "İstikrar Abidesi")?.statusTag,
    "[☑️ KAZANILDI]"
  );
  assert.equal(
    snapshot.badges.find((b) => b.title === "Dinleme Seyyahı")?.statusTag,
    "[☑️ KAZANILDI]"
  );
  assert.equal(
    snapshot.badges.find((b) => b.title === "Gramer Kaşifi")?.statusTag,
    "[🔒 KİLİTLİ]"
  );

  assert.deepEqual(
    snapshot.cefrProgress.map((c) => c.level),
    ["A1", "A2", "B1", "B2"],
    "CEFR başarı grafiği A1, A2, B1, B2 seviyelerini içermelidir"
  );
  assert.equal(
    snapshot.moduleProgress.length,
    6,
    "6 temel modül (120 Diyalog, 60 Okuma Metni, 998 Görsel Kelime, 1111 Cümle, 508 Atasözü, 400 Eş-Zıt Anlamlı) yer almalıdır"
  );
  assert.ok(
    snapshot.frequentMistakes.length >= 3 &&
      snapshot.frequentMistakes[0].wrongCount >= snapshot.frequentMistakes[1].wrongCount,
    "En çok hata yapılanlar listesi hata sıklığına göre azalan sırada dizilmeli ve 28 Harf Mahreç zayıflıklarını da içermelidir"
  );

  // 3. StatsAndBadgesModal.tsx yapısı ve 3 tek-tık giriş noktası (page.tsx, kutuphane/page.tsx, ayarlar/page.tsx)
  const modalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "StatsAndBadgesModal.tsx"),
    "utf8"
  );
  assert.equal(
    modalCode.includes("Öğrenme İstatistikleri, Başarı Rozetleri ve Öğretmen Raporu") &&
      modalCode.includes("Rozetler & Kilometre Taşları") &&
      modalCode.includes("Paket & Diyalog Başarı Grafikleri") &&
      modalCode.includes("En Çok Hata Yapılanlar & Ses Dinleme") &&
      modalCode.includes("Sesi Dinle") &&
      modalCode.includes("Hemen Tekrar Et") &&
      modalCode.includes("Öğretmen / Öğrenci Gelişim Raporunu Yazdır (A4)"),
    true,
    "StatsAndBadgesModal 3 sekmeyi, Sesi Dinle, Hemen Tekrar Et ve A4 Öğretmen Raporu butonlarını içermelidir"
  );
  assert.equal(
    modalCode.includes("window.open") ||
      modalCode.includes("window.alert") ||
      modalCode.includes("style={{"),
    false,
    "StatsAndBadgesModal içinde window.open, window.alert veya satır içi style={{ kullanılmamalıdır"
  );

  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const ayarlarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );

  assert.equal(
    homeCode.includes('import("@/components/ui/StatsAndBadgesModal")') &&
      kutuphaneCode.includes('import("@/components/ui/StatsAndBadgesModal")') &&
      ayarlarCode.includes('import("@/components/ui/StatsAndBadgesModal")'),
    true,
    "StatsAndBadgesModal hem Ana Sayfa'dan hem Kütüphane (Defterim) hem de Ayarlar sayfasından tek tıkla açılabilmelidir"
  );
});

test("47. WordTooltip Taşma/Kaydırma Onarımı, Vercel Standalone Kotası Koruması, Veri Arayüzü Tip Uyumu ve Ana Sayfa/Kütüphane Modal Bağlantıları", () => {
  // 1. WordTooltip.tsx: max-h-[82dvh] sm:max-h-[calc(100dvh-5rem)], sticky üst başlık, kaydırılabilir gövde ve ResizeObserver hizalaması
  const tooltipCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "WordTooltip.tsx"),
    "utf8"
  );
  assert.equal(
    tooltipCode.includes("max-h-[80dvh] overflow-y-auto flex flex-col") &&
      tooltipCode.includes("shrink-0 sticky top-0 z-10") &&
      tooltipCode.includes("overflow-y-auto overscroll-contain pr-1.5 pb-4") &&
      tooltipCode.includes("new ResizeObserver") &&
      tooltipCode.includes("popoverRef.current.contains(e.target)"),
    true,
    "WordTooltip sabit üst başlık, kaydırılabilir gövde, max-h-[80dvh] overflow-y-auto sınırı ve viewport ResizeObserver hizalamasına sahip olmalıdır"
  );

  // 2. next.config.ts: Vercel standalone kota koruması + typescript.ignoreBuildErrors
  const nextConfigCode = fs.readFileSync(
    path.join(ROOT_DIR, "next.config.ts"),
    "utf8"
  );
  assert.equal(
    nextConfigCode.includes('output: process.env.VERCEL ? undefined : "standalone"') &&
      nextConfigCode.includes("ignoreBuildErrors: false"),
    true,
    "next.config.ts Vercel için koşullu standalone çıktısını ve ignoreBuildErrors: false tip güvenliği ayarını içermelidir"
  );

  // 3. src/types/data.ts: ResimliKelime ve AtasozuDeyim opsiyonel tip uyumu + metadata.json koruması
  const dataTypesCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "types", "data.ts"),
    "utf8"
  );
  const kelimeMatches = dataTypesCode.match(/kelime_ar\?:\s*string;/g) || [];
  const anlamMatches = dataTypesCode.match(/anlam_tr\?:\s*string;/g) || [];
  assert.equal(
    kelimeMatches.length >= 2 &&
      anlamMatches.length >= 2 &&
      dataTypesCode.includes("mufret?: string;") &&
      dataTypesCode.includes("cemi?: string;"),
    true,
    "ResimliKelime ve AtasozuDeyim arayüzleri opsiyonel uyumluluk alanlarını içermelidir"
  );
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizindeki metadata.json dosyası korunmalıdır"
  );

  // 4. Ana Sayfa ve Kütüphane üzerinden hem StatsAndBadgesModal hem DialoguePdfModal tek tıkla açılabilmeli
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    homeCode.includes('import("@/components/ui/StatsAndBadgesModal")') &&
      homeCode.includes('import("@/components/ui/DialoguePdfModal")') &&
      kutuphaneCode.includes('import("@/components/ui/StatsAndBadgesModal")') &&
      kutuphaneCode.includes('import("@/components/ui/DialoguePdfModal")'),
    true,
    "Hem Ana Sayfa hem Kütüphane üzerinden İstatistik/Rozetler ve 6 Bölümlü A4 Sınav/Ders Notu Üretici modalları açılabilmelidir"
  );
});

test("48. Hafızanı Yokla (MemoryFlipGame) & Balon Safari (BalloonSafariGame) Tam Görsel ve Mekanik Yenileme Doğrulaması", () => {
  const memoryCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );
  const balloonCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );

  // 1. Hafızanı Yokla: 2 sütunlu başlangıç ekranı, 3 mod (YZ / İki kişilik / Antrenman), deniz kabuğu kartlar, büyük tipografi ve Bilgi Notu
  assert.equal(
    memoryCode.includes("Hafızanı Yokla") &&
      memoryCode.includes("Yapay zekâya karşı") &&
      memoryCode.includes("1 • Sırayla oyna; rakibin bazen unutur.") &&
      memoryCode.includes("İki kişilik") &&
      memoryCode.includes("2 • Aynı ekranda arkadaşınla yarış.") &&
      memoryCode.includes("Antrenman") &&
      memoryCode.includes("3 • Tek başına çalış, hafızanı ısıt.") &&
      memoryCode.includes("Nasıl oynanır?") &&
      memoryCode.includes("1200") &&
      memoryCode.includes("aiMemoryRef") &&
      memoryCode.includes("#EFE3C8") &&
      memoryCode.includes("#E05A47") &&
      memoryCode.includes("#1F6E50") &&
      memoryCode.includes("text-2xl sm:text-3xl font-bold") &&
      memoryCode.includes("text-sm sm:text-base md:text-lg font-extrabold") &&
      memoryCode.includes("Sıra sende: iki kart çevir.") &&
      memoryCode.includes("Yapay zekâ düşünüyor...") &&
      memoryCode.includes("strokeDashoffset") &&
      memoryCode.includes("Bilgi Notu"),
    true,
    "MemoryFlipGame 2 sütunlu mod ekranı, 1.2 sn düşünen YZ rakibi, #EFE3C8 deniz kabuğu kartları, #1F6E50 eşleşme zemini, büyük tipografi, dairesel tur sayacı ve canlı Bilgi Notu kutusunu içermelidir"
  );

  // 2. Balon Safari: Panoramik doğa manzarası, gerçek sıcak hava balonu (#F4F6F0 kubbe, #F3E5AB hasır sepet, #2196F3/#FF9800 etiket) ve yüzer hap HUD
  assert.equal(
    balloonCode.includes("safariSkyGrad") &&
      balloonCode.includes("safariSunsetSkyGrad") &&
      balloonCode.includes("safariNightSkyGrad") &&
      balloonCode.includes("/images/background.png") &&
      balloonCode.includes("/images/balon.png") &&
      balloonCode.includes("hotAirDomeClip") &&
      balloonCode.includes("hotAirWordImgClip") &&
      balloonCode.includes("#F4F6F0") &&
      balloonCode.includes("#F3E5AB") &&
      balloonCode.includes("#2196F3") &&
      balloonCode.includes("#FF9800") &&
      balloonCode.includes("#FACC15") &&
      balloonCode.includes("rounded-full") &&
      balloonCode.includes("النِّقَاط:") &&
      balloonCode.includes("المُسْتَوَى:") &&
      balloonCode.includes("المُحَاوَلَات:") &&
      balloonCode.includes("إِعَادَة الصَّوْت"),
    true,
    "BalloonSafariGame panoramik doğa manzarası, gerçek sıcak hava balonu katmanları (#F4F6F0 kubbe, #F3E5AB hasır sepet, #2196F3/#FF9800 etiket) ve yüzer hap HUD tasarımını içermelidir"
  );
});

test("49. Tam Ekran (100dvh) Oyunlar, Saf Görsel Kelime Havuzu, Kaydırmasız Hafızanı Yokla Izgarası, Karma Aralık (Range) A4 Sınav Üretici ve Sadeleştirilmiş Önizleme", () => {
  const memoryCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );
  const balloonCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const studioEngineCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "a4ExamStudioEngine.ts"),
    "utf8"
  );
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  const tooltipCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "WordTooltip.tsx"),
    "utf8"
  );

  // 1. Yeni oyunların Tam Ekran (fixed inset-0 z-[9999] ... flex flex-col overflow-hidden) ve "✕ Çıkış / Listeye Dön" desteği
  assert.equal(
    memoryCode.includes(
      "fixed inset-0 z-[9999] bg-[#FAF4E8] dark:bg-[var(--surface)] flex flex-col overflow-hidden"
    ) &&
      balloonCode.includes(
        "fixed inset-0 z-[9999] bg-[#FAF4E8] dark:bg-[var(--surface)] flex flex-col overflow-hidden"
      ) &&
      memoryCode.includes("✕ Çıkış / Listeye Dön") &&
      balloonCode.includes("✕ Çıkış / Listeye Dön"),
    true,
    "BalloonSafariGame ve MemoryFlipGame tam ekran (fixed inset-0 z-[9999]) ve '✕ Çıkış / Listeye Dön' üst bar butonuna sahip olmalıdır"
  );

  // 2. Her iki oyunun ve /alistirmalar sayfasının yalnızca Görsel Kelimeler (gorselKelimeler_guncel.json) ile çalışması
  assert.equal(
    memoryCode.includes("canonicalVisualById") &&
      !memoryCode.includes("esZitAnlamlilar") &&
      !memoryCode.includes("extractDialogueVocabulary") &&
      balloonCode.includes("canonicalVisualById") &&
      !balloonCode.includes("esZitAnlamlilar") &&
      alistirmalarCode.includes("strictVisualWordsOnlyPool") &&
      alistirmalarCode.includes("visualPool={strictVisualWordsOnlyPool}"),
    true,
    "Balon Safari ve Hafızanı Yokla yalnızca gorselKelimeler_guncel.json (Görsel Kelimeler) kayıtlarıyla beslenmelidir"
  );

  // 3. Hafızanı Yokla kaydırmasız (overflow-hidden) masaüstü ızgarası, clamp(5.2rem,17vh,8.8rem) kart boyutu, lg:w-60 xl:w-64 yan panel ve Kök + Örnek Cümle Bilgi Notu
  assert.equal(
    memoryCode.includes("h-[clamp(5.2rem,17vh,8.8rem)]") &&
      memoryCode.includes("lg:w-60 xl:w-64") &&
      memoryCode.includes("lg:overflow-hidden") &&
      memoryCode.includes("text-2xl sm:text-3xl font-bold") &&
      memoryCode.includes("Kök:") &&
      memoryCode.includes("ÖRNEK CÜMLE"),
    true,
    "MemoryFlipGame masaüstünde sıfır kaydırma (lg:overflow-hidden), h-[clamp(5.2rem,17vh,8.8rem)] kart yüksekliği, dar sağ panel (lg:w-60 xl:w-64) ve Kök + Örnek Cümle Bilgi Notu içermelidir"
  );

  // 4. A4 Sınav Üretici Stüdyosunda Karma Aralık Seçimi (Range) motoru ve UI kontrolleri
  assert.equal(
    studioEngineCode.includes('export type StudioSelectionMode = "single" | "range";') &&
      studioEngineCode.includes("export function clampStudioRangeBounds(") &&
      studioEngineCode.includes("export function listStudioRangeItems(") &&
      studioEngineCode.includes("Günlük Diyaloglar Karma Sınavı (") &&
      studioEngineCode.includes("Okuma Metinleri Karma Sınavı (") &&
      pdfModalCode.includes("🎛️ Karma Aralık Seçimi") &&
      pdfModalCode.includes('aria-label="Başlangıç Sırası"') &&
      pdfModalCode.includes('aria-label="Bitiş Sırası"'),
    true,
    "A4 Sınav Stüdyosu Başlangıç–Bitiş sıralı Karma Aralık Seçimi (Range) motoruna ve kontrollerine sahip olmalıdır"
  );

  // 5. Masaüstü 2 Sütunlu Split-Studio PDF Mimarisi (Sol Ayar Paneli + Sağ Tam Boy A4 Önizleme) ve WordTooltip max-h-[80dvh] overflow-y-auto koruması
  assert.equal(
    pdfModalCode.includes("md:grid md:grid-cols-[350px_1fr] lg:grid-cols-[380px_1fr]") &&
      pdfModalCode.includes("flex-1 min-h-0 overflow-hidden") &&
      !pdfModalCode.includes("⚙️ Gelişmiş Mizanpaj Ayarları") &&
      !pdfModalCode.includes("md:min-h-[60dvh]") &&
      tooltipCode.includes("max-h-[80dvh] overflow-y-auto"),
    true,
    "DialoguePdfModal masaüstünde 2 sütunlu Split-Studio mimarisi kullanmalı, gizli akordiyon içermemeli ve WordTooltip max-h-[80dvh] overflow-y-auto korumasına sahip olmalıdır"
  );
});

test("50. Başarılarım ve Rütbem Hızlı Erişim Butonları, Tam Adlı 6 A4 Sınav Bölümü, Görsel Kelime Flashcard Resimleri ve Yeni '🖼️ Bu Nedir? (صُورَةٌ وَكَلِمَةٌ)' Modülü", () => {
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const ayarlarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "ayarlar", "page.tsx"),
    "utf8"
  );
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  const flashcardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "Flashcard.tsx"),
    "utf8"
  );
  const whatIsThisCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "WhatIsThisGame.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );

  // 1. 🏆 Başarılarım ve Rütbem tek tıkla açılış butonları (Ana sayfa üst şerit, Header Hızlı Menü ve Ayarlar)
  assert.equal(
    homeCode.includes("Başarılarım ve Rütbem") &&
      homeCode.includes("<Trophy") &&
      homeCode.includes("computeLearnerRank") &&
      headerCode.includes("🏆 Başarılarım ve Rütbem") &&
      headerCode.includes('import("@/components/ui/StatsAndBadgesModal")') &&
      ayarlarCode.includes("🏆 Başarılarım ve Rütbem"),
    true,
    "Ana sayfa üst şeridinde, Header Hızlı Menüde ve Ayarlar sayfasında 'Başarılarım ve Rütbem' tek tıkla açılış butonu yer almalıdır"
  );

  // 2. 🖨️ A4 Sınav Üretici 6 bölümün tam ve kesintisiz etiketleri
  for (const fullLabel of [
    "1) Arapça → Türkçe",
    "2) Türkçe → Arapça",
    "3) Boşluk Doldurma",
    "4) Çoktan Seçmeli",
    "5) Eşleştirme",
    "6) Sarf Tablosu",
  ]) {
    assert.equal(
      pdfModalCode.includes(fullLabel),
      true,
      `DialoguePdfModal üst soru sayısı ızgarasında '${fullLabel}' tam etiketi bulunmalıdır`
    );
  }
  assert.equal(
    pdfModalCode.includes('"1) AR→TR"') || pdfModalCode.includes('"5) Eşleş."'),
    false,
    "DialoguePdfModal içinde eski kısaltılmış '1) AR→TR' veya '5) Eşleş.' etiketleri kalmamalıdır"
  );

  // 3. 🖼️ Flashcard.tsx içinde Görsel Kelimeler seçildiğinde kırpılmayan (object-contain) görsel gösterimi
  assert.equal(
    flashcardCode.includes("resolveImageUrl") &&
      flashcardCode.includes("VISUAL_IMAGE_BY_ID") &&
      flashcardCode.includes("isVisualWordsMode") &&
      flashcardCode.includes("object-contain"),
    true,
    "Flashcard.tsx Görsel Kelimeler seçildiğinde kelime resmini resolveImageUrl ve object-contain ile göstermelidir"
  );

  // 4. 🎯 Yeni '🖼️ Bu Nedir? (صُورَةٌ وَكَلِمَةٌ)' modülü ve /alistirmalar entegrasyonu
  assert.equal(
    whatIsThisCode.includes("Bu görselin Arapçası nedir?") &&
      whatIsThisCode.includes("selectSmartVisualDistractors") &&
      whatIsThisCode.includes("resolveImageUrl") &&
      whatIsThisCode.includes("object-contain") &&
      whatIsThisCode.includes("playDualGenderAudio") &&
      whatIsThisCode.includes("recordItemAttempt") &&
      whatIsThisCode.includes("addMistake") &&
      whatIsThisCode.includes("saveLastExerciseSummary"),
    true,
    "WhatIsThisGame büyük object-contain görsel, 4 harekeli şık, çift cinsiyetli ses, SRS/Hata Defteri ve son özet kaydını içermelidir"
  );
  assert.equal(
    whatIsThisCode.includes("window.open") ||
      whatIsThisCode.includes("window.alert") ||
      whatIsThisCode.includes("style={{"),
    false,
    "WhatIsThisGame içinde window.open, window.alert veya satır içi style={{ bulunmamalıdır"
  );
  assert.equal(
    alistirmalarCode.includes('import("@/components/exercises/WhatIsThisGame")') &&
      alistirmalarCode.includes('id: "what-is-this"') &&
      alistirmalarCode.includes('title: "Bu Nedir?"') &&
      alistirmalarCode.includes("صُورَةٌ وَكَلِمَةٌ") &&
      alistirmalarCode.includes("<WhatIsThisGame"),
    true,
    "alistirmalar/page.tsx 'Bu Nedir? (صُورَةٌ وَكَلِمَةٌ)' modülünü vitrinde ve aktif oyun ekranında barındırmalıdır"
  );
});

test("51. UTF-8/CESU-8 Kesin Doğrulaması, Tüm Alıştırma Modüllerinde Görsel Kelime Resimleri, Hafızanı Yokla Tek Ekran Sığdırma, answerLockedRef Çift Tıklama Koruması ve API Hız/Süre Sınırları", async () => {
  // 1. P0: assessment.ts satır 539 ve tüm kaynak/JSON dosyalarında %100 geçerli UTF-8 kontrolü
  const assessmentLines = fs
    .readFileSync(path.join(ROOT_DIR, "src", "types", "assessment.ts"), "utf8")
    .split("\n");
  assert.equal(
    assessmentLines[538]?.trim(),
    'icon: known?.icon || "\\u{1F3DB}\\uFE0F",',
    "src/types/assessment.ts 539. satırda saf ASCII 'icon: known?.icon || \"\\u{1F3DB}\\uFE0F\",' bulunmalıdır"
  );

  const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
  const loneSurrogateRegex =
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

  function verifyValidUtf8Tree(dirPath) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        verifyValidUtf8Tree(full);
      } else if (/\.(ts|tsx|json)$/.test(entry.name)) {
        const bytes = fs.readFileSync(full);
        const decoded = utf8Decoder.decode(bytes);
        assert.equal(
          loneSurrogateRegex.test(decoded),
          false,
          `${full} dosyasında bozuk CESU-8 veya tekil vekil çifti (surrogate) bulunmamalıdır`
        );
      }
    }
  }
  verifyValidUtf8Tree(path.join(ROOT_DIR, "src"));
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizindeki metadata.json dosyası korunmalıdır"
  );

  // 2. P0: Görsel Kelimeler seçildiğinde frozenPools sıfırlama ve Flashcard / MultipleChoice / MatchingGame / FillInBlanks görsel gösterimi
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const lookupCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "visualWordImageLookup.ts"),
    "utf8"
  );
  const flashcardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "Flashcard.tsx"),
    "utf8"
  );
  const multipleChoiceCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  const matchingCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MatchingGame.tsx"),
    "utf8"
  );
  const fillInBlanksCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "FillInBlanks.tsx"),
    "utf8"
  );

  assert.equal(
    alistirmalarCode.includes("setFrozenPools(null)") &&
      alistirmalarCode.includes("frozenPools?.isVisualWordsMode") &&
      alistirmalarCode.includes("isVisualWordsMode={"),
    true,
    "alistirmalar/page.tsx havuz/filtre değişimlerinde frozenPools önbelleğini sıfırlamalı ve isVisualWordsMode aktarmalıdır"
  );
  assert.equal(
    lookupCode.includes("removeArabicHarakat") &&
      lookupCode.includes("lookupVisualWordGorsel"),
    true,
    "visualWordImageLookup.ts hem id hem harekesiz Arapça eşleştirmesiyle görsel bulmalıdır"
  );

  const flashcardImgMatches = flashcardCode.match(/h-32 sm:h-40 w-full object-contain/g) || [];
  assert.equal(
    flashcardImgMatches.length >= 2 &&
      flashcardCode.includes("lookupVisualWordGorsel") &&
      flashcardCode.includes("resolveImageUrl"),
    true,
    "Flashcard.tsx görseli hem ön hem arka yüzde h-32 sm:h-40 w-full object-contain çerçevesinde göstermelidir"
  );
  assert.equal(
    multipleChoiceCode.includes("lookupVisualWordGorsel") &&
      multipleChoiceCode.includes("resolveImageUrl") &&
      multipleChoiceCode.includes("h-20 sm:h-36") &&
      multipleChoiceCode.includes("object-contain rounded-2xl"),
    true,
    "MultipleChoice.tsx Görsel Kelime sorularında h-20 sm:h-36 object-contain rounded-2xl resmi soru metninin üzerinde göstermelidir"
  );
  assert.equal(
    matchingCode.includes("lookupVisualWordGorsel") &&
      matchingCode.includes("resolveImageUrl") &&
      matchingCode.includes("object-contain"),
    true,
    "MatchingGame.tsx Görsel Kelime kartlarında küçük kelime resmini object-contain ile göstermelidir"
  );
  assert.equal(
    fillInBlanksCode.includes("lookupVisualWordGorsel") &&
      fillInBlanksCode.includes("resolveImageUrl") &&
      fillInBlanksCode.includes("h-28 sm:h-36") &&
      fillInBlanksCode.includes("object-contain rounded-2xl"),
    true,
    "FillInBlanks.tsx Görsel Kelime cümle tamamlama sorularında kelime görselini cümlenin üstünde göstermelidir"
  );

  // 3. Hafızanı Yokla masaüstü tek ekran (sıfır scroll) dinamik kart yüksekliği ve kırpılmaz görsel kontrolü
  const memoryCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );
  assert.equal(
    memoryCode.includes("flex-1 min-h-0 grid") &&
      memoryCode.includes("content-center") &&
      memoryCode.includes("h-[clamp(5.2rem,17vh,8.8rem)]") &&
      memoryCode.includes("w-full lg:w-60 xl:w-64") &&
      memoryCode.includes("object-contain") &&
      memoryCode.includes("text-2xl sm:text-3xl font-bold"),
    true,
    "MemoryFlipGame masaüstünde flex-1 min-h-0 grid content-center, h-[clamp(5.2rem,17vh,8.8rem)], lg:w-60 xl:w-64 ve object-contain içermelidir"
  );

  // 4. Alıştırmalarda çift tıklama / çift Enter kilidi (answerLockedRef)
  const blindDictationCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BlindDictation.tsx"),
    "utf8"
  );
  const whatIsThisCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "WhatIsThisGame.tsx"),
    "utf8"
  );
  for (const [modName, modCode] of [
    ["MultipleChoice.tsx", multipleChoiceCode],
    ["FillInBlanks.tsx", fillInBlanksCode],
    ["BlindDictation.tsx", blindDictationCode],
    ["WhatIsThisGame.tsx", whatIsThisCode],
  ]) {
    assert.equal(
      modCode.includes("answerLockedRef") &&
        modCode.includes("answerLockedRef.current = true") &&
        modCode.includes("answerLockedRef.current = false"),
      true,
      `${modName} içinde senkron answerLockedRef çift tıklama/Enter koruması bulunmalıdır`
    );
  }

  // 5. Ortak API hız sınırı yardımcısı (/api/admin 30 istek/dk, /api/stt 20 istek/dk) ve 30 sn / 35 sn ses sınırı
  const rateLimitHelperCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "apiRateLimit.ts"),
    "utf8"
  );
  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  const sttRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stt", "route.ts"),
    "utf8"
  );

  assert.equal(
    rateLimitHelperCode.includes("export function createIpRateLimiter") &&
      rateLimitHelperCode.includes("export function getClientIp"),
    true,
    "src/lib/apiRateLimit.ts ortak createIpRateLimiter ve getClientIp yardımcılarını dışa aktarmalıdır"
  );
  assert.equal(
    adminRouteCode.includes("createIpRateLimiter") &&
      adminRouteCode.includes("const ADMIN_RATE_LIMIT_MAX_REQUESTS = 30;") &&
      adminRouteCode.includes("maxRequestsPerMinute: ADMIN_RATE_LIMIT_MAX_REQUESTS") &&
      adminRouteCode.includes("status: 429"),
    true,
    "/api/admin dakikada IP başına 30 istek sınırına (HTTP 429) sahip olmalıdır"
  );
  assert.equal(
    sttRouteCode.includes("createIpRateLimiter") &&
      sttRouteCode.includes("const RATE_LIMIT_MAX_REQUESTS = 20;") &&
      sttRouteCode.includes("maxRequestsPerMinute: RATE_LIMIT_MAX_REQUESTS") &&
      sttRouteCode.includes("status: 429") &&
      sttRouteCode.includes("const MAX_AUDIO_SECONDS = 30;") &&
      sttRouteCode.includes("const HARD_LIMIT_AUDIO_SECONDS = 35;") &&
      sttRouteCode.includes(
        "Ses kaydı 30 saniye sınırını aşıyor, lütfen daha kısa bir kayıt gönderin."
      ),
    true,
    "/api/stt dakikada 20 istek (429), 30 sn üst sınır ve >35 sn için HTTP 400 Türkçe uyarı mesajı içermelidir"
  );

  const { createIpRateLimiter } = await import("../src/lib/apiRateLimit.ts");
  const limiter = createIpRateLimiter({ maxRequestsPerMinute: 3, windowMs: 60_000 });
  assert.equal(limiter.isRateLimited("203.0.113.10", 1_000), false);
  assert.equal(limiter.isRateLimited("203.0.113.10", 2_000), false);
  assert.equal(limiter.isRateLimited("203.0.113.10", 3_000), false);
  assert.equal(
    limiter.isRateLimited("203.0.113.10", 4_000),
    true,
    "Dakikalık limiti aşan 4. istek hız sınırına (true) takılmalıdır"
  );
  assert.equal(
    limiter.isRateLimited("203.0.113.10", 65_000),
    false,
    "1 dakikalık pencere geçtikten sonra IP hız sınırı sıfırlanmalıdır"
  );
});

test("52. CEFR Kazanım & 5 Temel Beceri Haritası, Çift Yönlü Gramer-Alıştırma Köprüsü, A1 Sezdirme Özeti ve 30 Dakikalık Çalışma Rotası", async () => {
  // 1. learningAnalytics.ts: 5 Temel Dil Becerisi + 195 Gramer Kazanım Isı Haritası (A1, A2, B1, B2)
  const { computeLearningAnalyticsSnapshot } = await import(
    "../src/lib/learningAnalytics.ts"
  );

  const snapshot = computeLearningAnalyticsSnapshot({
    learnedWords: ["كِتَابٌ", "قَلَمٌ", "مَدْرَسَةٌ"],
    completedDialogues: ["dlg_001", "dlg_066", "metin_07"],
    mistakeIds: ["dlg_070"],
    srsRecords: {
      grm_001: {
        id: "grm_001",
        type: "word",
        box: 2,
        status: "learning",
        nextReviewAt: "2026-11-20T00:00:00.000Z",
        lastReviewedAt: "2026-11-14T10:00:00.000Z",
        correctCount: 2,
        wrongCount: 1,
      },
    },
    pronunciationScores: [88, 94],
    pronunciationHistory: [
      { id: "p1", score: 91, timestamp: "2026-11-14T10:00:00.000Z" },
    ],
    totalPronunciationAttempts: 3,
    studyMinutes: 25,
    activityXp: 1400,
    streakDays: 5,
    lastStudyDate: "2026-11-14",
    todayStr: "2026-11-14",
    yesterdayStr: "2026-11-13",
    dailyGoalMinutes: 30,
    topicMastery: {
      grm_002: { correct: 3, total: 5 },
    },
    skillStats: {
      okuma: { correct: 9, total: 10 },
      dinleme: { correct: 8, total: 10 },
      konusma: { correct: 6, total: 7 },
      kelime: { correct: 22, total: 25 },
      gramer: { correct: 7, total: 9 },
    },
    completedLevelExams: ["A1"],
    phonemeStats: {
      ع: { attempts: 5, cleanHits: 4, confusions: 1 },
    },
    watchedVideos: ["vid_1", "vid_2"],
    storedLastExercise: null,
  });

  assert.equal(
    Array.isArray(snapshot.fiveCoreSkills) && snapshot.fiveCoreSkills.length === 5,
    true,
    "5 Temel Dil Becerisi ilerleme dizisi tam 5 beceri satırı içermelidir"
  );
  assert.deepEqual(
    snapshot.fiveCoreSkills.map((s) => s.titleAr),
    [
      "المُفْرَدَات",
      "الفَهْمُ القِرَائِيّ",
      "الاِسْتِمَاعُ وَالمُحَادَثَة",
      "القَوَاعِدُ وَالإِعْرَاب",
      "النُّطْقُ وَالمَخَارِج",
    ],
    "5 Temel Dil Becerisi Arapça başlıkları eksiksiz eşleşmelidir"
  );

  assert.deepEqual(
    snapshot.grammarCompetencyMatrix.map((g) => g.level),
    ["A1", "A2", "B1", "B2"],
    "Gramer kazanım matrisi A1, A2, B1 ve B2 CEFR gruplarını içermelidir"
  );
  const allMatrixItems = snapshot.grammarCompetencyMatrix.flatMap((g) => g.items);
  assert.equal(
    allMatrixItems.length,
    195,
    "Gramer kazanım matrisi 195 birleşik gramer kazanımının tamamını kapsamalıdır"
  );
  assert.equal(
    allMatrixItems.find((i) => i.bagliId === "dlg_066")?.status,
    "completed",
    "Tamamlanan diyaloğa ait gramer kazanımı 'completed' (✓ Tamamlandı) olarak işaretlenmelidir"
  );
  assert.equal(
    allMatrixItems.find((i) => i.bagliId === "metin_07")?.status,
    "completed",
    "Tamamlanan okuma metnine ait gramer kazanımı 'completed' (✓ Tamamlandı) olarak işaretlenmelidir"
  );
  assert.equal(
    allMatrixItems.find((i) => i.bagliId === "dlg_070")?.status,
    "studying",
    "Hata defterindeki gramer kazanımı 'studying' (◐ Çalışılıyor) olarak işaretlenmelidir"
  );

  // 2. StatsAndBadgesModal.tsx: 4. Sekme "🧭 CEFR & Beceri Haritası" ve sıfır satır içi style={{
  const statsModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "StatsAndBadgesModal.tsx"),
    "utf8"
  );
  assert.equal(
    statsModalCode.includes('"cefr_map"') &&
      statsModalCode.includes("🧭 CEFR & Beceri Haritası") &&
      statsModalCode.includes("fiveCoreSkills") &&
      statsModalCode.includes("grammarCompetencyMatrix") &&
      statsModalCode.includes("router.push(item.targetHref)"),
    true,
    "StatsAndBadgesModal 4. sekme olarak CEFR & Beceri Haritası'nı ve doğrudan hedef derse/alıştırmaya yönlendirmeyi içermelidir"
  );
  assert.equal(
    statsModalCode.includes("style={{"),
    false,
    "StatsAndBadgesModal içinde satır içi style={{ kullanılmamalıdır"
  );

  // 3. GrammarHapBilgiPanel.tsx + kutuphane/page.tsx: İleri köprü + A1 Sezdirme + A1'de kapalı İ'rab Tahlili
  const { resolveGrammarNoteAndSentences } = await import(
    "../src/components/ui/GrammarHapBilgiPanel.tsx"
  );
  const resolvedMetin007 = resolveGrammarNoteAndSentences({ sourceId: "metin_007" });
  assert.equal(
    resolvedMetin007.resolvedNote?.bagli_id === "metin_07" &&
      resolvedMetin007.linkedLevel === "A1",
    true,
    "resolveGrammarNoteAndSentences 3 haneli 'metin_007' kimliğini 'metin_07' (A1) olarak çözümlemelidir"
  );

  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  assert.equal(
    grammarPanelCode.includes("🌱 A1 Başlangıç Özeti (Kalıp Olarak Öğren)") &&
      (grammarPanelCode.includes("🔍 Kelime Kelime İ'rab Tahlilini Göster ▾") ||
        grammarPanelCode.includes("🔍 Kelime Kelime İ&apos;rab Tahlilini Göster ▾")) &&
      grammarPanelCode.includes("🎯 Bu Konuyu Alıştırmalarda Çalış") &&
      grammarPanelCode.includes("📖 Bağlı Diyalog / Metne Git") &&
      grammarPanelCode.includes("!isA1Level"),
    true,
    "GrammarHapBilgiPanel A1 Sezdirme özetini, A1'de varsayılan kapalı İ'rab katmanını ve çift yönlü köprü butonlarını içermelidir"
  );

  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  assert.equal(
    kutuphaneCode.includes("🎯 Bu Konuyu Alıştırmalarda Çalış") &&
      kutuphaneCode.includes("📖 Bağlı Diyalog / Metne Git"),
    true,
    "Kütüphane Gramer Atlası kartlarında her iki köprü butonu yer almalıdır"
  );

  // 4. Alıştırmadan Gramere Ters Köprü: MultipleChoice.tsx, ErrorHunter.tsx, IrabColorPainter.tsx
  for (const modFile of [
    "MultipleChoice.tsx",
    "ErrorHunter.tsx",
    "IrabColorPainter.tsx",
  ]) {
    const code = fs.readFileSync(
      path.join(ROOT_DIR, "src", "components", "exercises", modFile),
      "utf8"
    );
    assert.equal(
      code.includes("💡 İlgili Gramer Kuralını Gör") &&
        code.includes("GrammarHapBilgiModal"),
      true,
      `${modFile} yanlış cevapta '💡 İlgili Gramer Kuralını Gör' butonuyla GrammarHapBilgiModal açmalıdır`
    );
  }

  // 5. Ana Sayfa (src/app/page.tsx): "Bugünkü 30 Dakikalık Arapça Çalışma Rotam" 4 adımlı canlı rehber
  const homePageCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  assert.equal(
    homePageCode.includes("Bugünkü 30 Dakikalık Arapça Çalışma Rotam") &&
      homePageCode.includes("1. Adım · 5 dk") &&
      homePageCode.includes("2. Adım · 10 dk") &&
      homePageCode.includes("3. Adım · 10 dk") &&
      homePageCode.includes("4. Adım · 5 dk") &&
      homePageCode.includes("✓ Tamamlandı") &&
      homePageCode.includes("Başla →"),
    true,
    "Ana sayfada 4 adımlı 'Bugünkü 30 Dakikalık Arapça Çalışma Rotam' canlı rehberi yer almalıdır"
  );
});

test("53. Merkezi Modal/Escape Yığını (modalStack), Mobil safe-area-inset-bottom Koruması, Çevrimdışı Arakom PDF/Hareke Garantisi ve Tam UTF-8 / Veri / 17 Modül Bütünlüğü", async () => {
  // 1. Merkezi Modal / Escape Yığını (src/lib/modalStack.ts) LIFO davranışı + 7 bileşen entegrasyonu
  const {
    registerModal,
    unregisterModal,
    isTopModal,
    getModalStackIds,
    dispatchEscapeToTopModal,
    clearModalStackForTests,
  } = await import("../src/lib/modalStack.ts");

  clearModalStackForTests();
  let closedLayers = [];
  const unregisterGame = registerModal("balloon_safari", () => {
    closedLayers.push("balloon_safari");
  });
  const _unregisterTooltip = registerModal("word_tooltip", () => {
    closedLayers.push("word_tooltip");
    unregisterModal("word_tooltip");
  });
  const _unregisterShadowing = registerModal("shadowing_modal", () => {
    closedLayers.push("shadowing_modal");
    unregisterModal("shadowing_modal");
  });

  assert.deepEqual(
    getModalStackIds(),
    ["balloon_safari", "word_tooltip", "shadowing_modal"],
    "Modal yığını açılış sırasına göre LIFO dizilmelidir"
  );
  assert.equal(isTopModal("shadowing_modal"), true);
  assert.equal(isTopModal("word_tooltip"), false);
  assert.equal(isTopModal("balloon_safari"), false);

  let propagationStopped = 0;
  let immediateStopped = 0;
  const mockEscEvent = {
    key: "Escape",
    preventDefault() {},
    stopPropagation() {
      propagationStopped += 1;
    },
    stopImmediatePropagation() {
      immediateStopped += 1;
    },
  };

  // 1. Escape basışı: YALNIZCA en üstteki shadowing_modal kapanmalı, oyun ve tooltip açık kalmalı
  assert.equal(dispatchEscapeToTopModal(mockEscEvent), true);
  assert.deepEqual(closedLayers, ["shadowing_modal"]);
  assert.equal(propagationStopped, 1);
  assert.equal(immediateStopped, 1);
  assert.equal(isTopModal("word_tooltip"), true);

  // 2. Escape basışı: YALNIZCA word_tooltip kapanmalı, alttaki balloon_safari açık kalmalı
  assert.equal(dispatchEscapeToTopModal(mockEscEvent), true);
  assert.deepEqual(closedLayers, ["shadowing_modal", "word_tooltip"]);
  assert.equal(isTopModal("balloon_safari"), true);

  unregisterGame();
  clearModalStackForTests();

  const escapeStackTargetFiles = [
    ["src", "components", "ui", "WordTooltip.tsx"],
    ["src", "components", "ui", "DialoguePdfModal.tsx"],
    ["src", "components", "ui", "StatsAndBadgesModal.tsx"],
    ["src", "components", "ui", "GrammarHapBilgiPanel.tsx"],
    ["src", "components", "ui", "ShadowingModal.tsx"],
    ["src", "components", "exercises", "BalloonSafariGame.tsx"],
    ["src", "components", "exercises", "MemoryFlipGame.tsx"],
  ];
  for (const relParts of escapeStackTargetFiles) {
    const fileCode = fs.readFileSync(path.join(ROOT_DIR, ...relParts), "utf8");
    assert.equal(
      fileCode.includes("@/lib/modalStack") && fileCode.includes("useEscapeKey("),
      true,
      `${relParts.join("/")} merkezi modalStack / useEscapeKey kancasını kullanmalıdır`
    );
  }

  // 2. Mobil safe-area-inset-bottom koruması: ScrollToTopButton, ShadowingModal, DialoguePdfModal
  for (const relParts of [
    ["src", "components", "ui", "ScrollToTopButton.tsx"],
    ["src", "components", "ui", "ShadowingModal.tsx"],
    ["src", "components", "ui", "DialoguePdfModal.tsx"],
  ]) {
    const fileCode = fs.readFileSync(path.join(ROOT_DIR, ...relParts), "utf8");
    assert.equal(
      fileCode.includes("pb-[max(0.75rem,env(safe-area-inset-bottom))]"),
      true,
      `${relParts.join("/")} alt kontrol/buton alanında pb-[max(0.75rem,env(safe-area-inset-bottom))] güvenli alan boşluğu bulunmalıdır`
    );
  }

  // 3. PDF ve A4 Sınav Üreticide Çevrimdışı / Okul Ağı Font (Arakom) ve Hareke Kırpılma Koruması
  const dialoguePdfCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  const grammarPdfCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "grammarPdfGenerator.ts"),
    "utf8"
  );
  for (const [label, code] of [
    ["DialoguePdfModal.tsx", dialoguePdfCode],
    ["grammarPdfGenerator.ts", grammarPdfCode],
  ]) {
    assert.equal(
      code.includes("/fonts/Arakom.ttf") &&
        code.includes('doc.fonts') &&
        code.includes('.load(\'700 18px "Arakom"\')') &&
        code.includes('media="print"') &&
        code.includes('.arabic, [dir="rtl"]') &&
        code.includes("line-height: 2.05 !important;") &&
        code.includes("overflow: visible !important;") &&
        code.includes("padding-block: 0.08em;"),
      true,
      `${label} çevrimdışı Arakom birincil fontunu, bloklamayan Google Fonts yapısını ve hareke kırpılma korumasını (.arabic, [dir="rtl"]) içermelidir`
    );
  }

  // 4A. Tüm src/ dosyalarının %100 geçerli UTF-8 olması ve sıfır CESU-8 surrogate baytı kontrolü
  const strictUtf8Decoder = new TextDecoder("utf-8", { fatal: true });
  function collectAllSrcFiles(dirPath, out = []) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        collectAllSrcFiles(full, out);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
    return out;
  }
  const allSrcFiles = collectAllSrcFiles(path.join(ROOT_DIR, "src"));
  assert.ok(allSrcFiles.length > 50, "src/ altında tüm kaynak dosyalar taranmalıdır");

  for (const fullFilePath of allSrcFiles) {
    const rawBuf = fs.readFileSync(fullFilePath);
    // Fatal UTF-8 decode kontrolü
    assert.doesNotThrow(
      () => strictUtf8Decoder.decode(rawBuf),
      `${path.relative(ROOT_DIR, fullFilePath)} geçerli UTF-8 olmalıdır`
    );
    // CESU-8 UTF-16 surrogate bayt dizisi kontrolü (0xED 0xA0..0xBF 0x80..0xBF)
    let hasCesu8Surrogate = false;
    for (let i = 0; i + 2 < rawBuf.length; i++) {
      if (
        rawBuf[i] === 0xed &&
        rawBuf[i + 1] >= 0xa0 &&
        rawBuf[i + 1] <= 0xbf &&
        rawBuf[i + 2] >= 0x80 &&
        rawBuf[i + 2] <= 0xbf
      ) {
        hasCesu8Surrogate = true;
        break;
      }
    }
    assert.equal(
      hasCesu8Surrogate,
      false,
      `${path.relative(ROOT_DIR, fullFilePath)} içinde bozuk CESU-8 surrogate baytı bulunmamalıdır`
    );
  }

  // 4B. Veri Bütünlüğü: 120 Diyalog (A1->B2 monotonik sira), 60 Metin (odak_gramer), 998 Görsel Kelime, 1111 Cümle, 508 Atasözü, 400 Eş-Zıt, 60 YouTube
  const { parsed: dialogues120 } = readDataJson("tum_diyaloglar_120.json");
  const { parsed: readings60 } = readDataJson("tum_metinler_60.json");
  const { parsed: visualWords998 } = readDataJson("gorselKelimeler_guncel.json");
  const { parsed: sentences1111 } = readDataJson("1111_cumle.json");
  const { parsed: proverbs508 } = readDataJson("atasozleri.json");
  const { parsed: synAnt400 } = readDataJson("es_zit_anlamlilar.json");
  const { parsed: youtube60 } = readDataJson("youtube_tavsiyeleri.json");

  assert.equal(dialogues120.length, 120, "120 diyalog kaydı bulunmalıdır");
  const cefrRank = { A1: 1, A2: 2, B1: 3, B2: 4 };
  for (let i = 0; i < dialogues120.length; i++) {
    const d = dialogues120[i];
    assert.equal(d.sira, i + 1, `Diyalog sira alanı monotonik 1..120 olmalıdır (beklenen ${i + 1}, gelen ${d.sira})`);
    if (i > 0) {
      const prevRank = cefrRank[dialogues120[i - 1].seviye];
      const currRank = cefrRank[d.seviye];
      assert.ok(
        currRank >= prevRank,
        `120 diyalog CEFR kurları A1->B2 monotonik sırada ilerlemelidir (${dialogues120[i - 1].id} -> ${d.id})`
      );
    }
  }

  assert.equal(readings60.length, 60, "60 okuma metni kaydı bulunmalıdır");
  for (const m of readings60) {
    assert.equal(
      typeof m.odak_gramer === "string" && m.odak_gramer.trim().length > 0,
      true,
      `${m.id} okuma metninde odak_gramer alanı dolu olmalıdır`
    );
  }

  assert.equal(visualWords998.length, 998, "998 görsel kelime kaydı bulunmalıdır");
  assert.equal(sentences1111.length, 1111, "1111 günlük cümle kaydı bulunmalıdır");
  assert.equal(proverbs508.length, 508, "508 atasözü kaydı bulunmalıdır");
  assert.equal(synAnt400.length, 400, "400 eş ve zıt anlamlı kaydı bulunmalıdır");
  assert.equal(youtube60.length, 60, "60 YouTube tavsiyesi kaydı bulunmalıdır");

  // 4C. 18 Alıştırma Modülü + 6 Bölümlü A4 Sınav & Karma Aralık (Range) Motoru Doğrulaması
  const { CONTENT_INVENTORY } = await import("../src/lib/contentInventory.ts");
  assert.equal(
    CONTENT_INVENTORY.exerciseModulesCount,
    18,
    "CONTENT_INVENTORY.exerciseModulesCount 18 olmalıdır"
  );

  const {
    resolveStudioMaterialBundle,
    buildSixSectionExamData,
    clampStudioRangeBounds,
  } = await import("../src/lib/a4ExamStudioEngine.ts");

  const clampedRange = clampStudioRangeBounds(30, 1, 6);
  assert.equal(clampedRange.start, 1);
  assert.equal(clampedRange.end, 6);

  const rangeBundle = resolveStudioMaterialBundle({
    sourceId: "diyaloglar",
    levelFilter: "A1",
    packId: "range::1::6",
    selectionMode: "range",
    rangeStart: 1,
    rangeEnd: 6,
  });
  assert.ok(
    rangeBundle.dialogue.baslik_tr.includes("Karma Sınavı") &&
      rangeBundle.vocabCandidates.length >= 10,
    "Karma Aralık (Range) modu birden fazla diyalogdan zengin kelime ve cümle havuzu birleştirmelidir"
  );

  const rangeExam = buildSixSectionExamData({
    bundle: rangeBundle,
    counts: {
      sec1ArToTr: 5,
      sec2TrToAr: 5,
      sec3FillBlank: 4,
      sec4MultipleChoice: 4,
      sec5Matching: 5,
      sec6Morphology: 2,
    },
    bookletGroup: "B",
  });
  assert.equal(rangeExam.pointsAllocation.grandTotal, 100);
  assert.equal(rangeExam.sec1ArToTr.length, 5);
  assert.equal(rangeExam.sec2TrToAr.length, 5);
  assert.equal(rangeExam.sec3FillBlank.length, 4);
  assert.equal(rangeExam.sec4MultipleChoice.length, 4);
  assert.equal(rangeExam.sec5Matching.length, 5);
  assert.equal(rangeExam.sec6Morphology.length, 2);
});

test("54. board-mode Modal Koruması, A4 Stüdyo Milimetrik Hizalama & Ders Föyü / Alt Bar Koruması, StatsAndBadgesModal Sabit Sekmeler & Tek Satır Filtre ve Eş-Zıt Anlam Flashcard Etiketlemesi", async () => {
  // 1. globals.css: html.board-mode kuralı modal ve küçük sekmeleri bozmamalı
  const globalsCss = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "globals.css"),
    "utf8"
  );
  assert.equal(
    globalsCss.includes("html.board-mode main .arabic") &&
      globalsCss.includes("html.board-mode main .font-arabic") &&
      !globalsCss.includes("font-size: 19px") &&
      !globalsCss.includes("min-height: 52px"),
    true,
    "globals.css içinde genel font-size: 19px ve min-height: 52px kuralları kaldırılmış olmalıdır"
  );

  // 2. DialoguePdfModal.tsx: Ferah "Tümü" seviye butonu (px-2.5), yalnızca sınav modunda 6 bölüm soru sayısı ve kesilmeyen alt bar koruması
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  assert.equal(
    pdfModalCode.includes('lvl === "all" ? "px-2.5 shrink-0" : "flex-1 min-w-0 px-1.5"') &&
      pdfModalCode.includes('effectivePdfDocMode === "quiz-sheet" && (') &&
      !pdfModalCode.includes("md:min-h-[60dvh]") &&
      pdfModalCode.includes("print:hidden shrink-0 z-10 bg-[#F7EFE1]"),
    true,
    "DialoguePdfModal ferah Tümü buton dolgusu (px-2.5), quiz-sheet koşullu 6 bölüm soru sayısı ve shrink-0 z-10 alt aksiyon çubuğunu içermelidir"
  );

  // 3. StatsAndBadgesModal.tsx: Sabit (pinned) 4 ana sekme ve tek satır durum filtreleri
  const statsModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "StatsAndBadgesModal.tsx"),
    "utf8"
  );
  const tablistIdx = statsModalCode.indexOf('role="tablist"');
  const scrollBodyIdx = statsModalCode.indexOf(
    "flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4"
  );
  assert.equal(
    tablistIdx > 0 &&
      scrollBodyIdx > tablistIdx &&
      statsModalCode.includes(
        "inline-flex flex-nowrap items-center gap-1 bg-[#F7EFE1] dark:bg-[var(--background)] p-1 rounded-xl border border-[#E6D7BE] dark:border-[var(--border)] overflow-x-auto max-w-full shrink-0"
      ) &&
      statsModalCode.includes(
        "h-8 min-h-0! px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5"
      ) &&
      !statsModalCode.includes("style={{"),
    true,
    "StatsAndBadgesModal 4 ana sekmeyi kaydırılabilir gövdenin üstünde sabit tutmalı ve matris durum filtrelerini tek satırda hizalamalıdır"
  );

  // 4. Eş & Zıt Anlamlılar -> DictionaryItem & Flashcard: 'Çoğul:' yerine Eş Anlam / Zıt Anlam / 💡 Nüans
  const { synonymEntryToDictionaryItem } = await import(
    "../src/lib/mistakeUtils.ts"
  );
  const { parsed: synAnt400 } = readDataJson("es_zit_anlamlilar.json");
  assert.equal(synAnt400.length, 400);

  for (const entry of synAnt400) {
    const mapped = synonymEntryToDictionaryItem(entry);
    assert.equal(
      mapped.cemi,
      undefined,
      `${entry.id} için synonymEntryToDictionaryItem cemi alanına eş anlamlı yazmamalıdır`
    );
    assert.equal(
      typeof mapped.es_anlam_ar === "string" && mapped.es_anlam_ar.length > 0,
      true,
      `${entry.id} için es_anlam_ar alanı dolu olmalıdır`
    );
  }

  const sampleMapped = synonymEntryToDictionaryItem(synAnt400[0]);
  assert.ok(
    sampleMapped.es_anlam_ar?.includes("عَظِيمٌ") &&
      sampleMapped.zit_anlam_ar?.includes("صَغِيرٌ") &&
      sampleMapped.es_anlam_tr?.includes("büyük") &&
      sampleMapped.zit_anlam_tr?.includes("küçük") &&
      typeof sampleMapped.nuans_tr === "string" &&
      sampleMapped.nuans_tr.length > 0,
    "ez_001 (كَبِيرٌ) kaydı es_anlam_ar, zit_anlam_ar, es_anlam_tr, zit_anlam_tr ve nuans_tr alanlarını eksiksiz taşımalıdır"
  );

  const flashcardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "Flashcard.tsx"),
    "utf8"
  );
  assert.equal(
    flashcardCode.includes("isSynAntCard") &&
      flashcardCode.includes("Eş Anlam (المُرَادِف):") &&
      flashcardCode.includes("Zıt Anlam (الضِّدّ):") &&
      flashcardCode.includes("💡 Nüans:"),
    true,
    "Flashcard.tsx Eş & Zıt Anlamlılar kartlarında ön yüzde Eş Anlam / Zıt Anlam, arka yüzde Türkçe anlamları ve 💡 Nüans bilgisini göstermelidir"
  );
});

test("55. A4 PDF Split-Studio Mimarisi, Mobil Hızlı PDF Kartı, Pedagojik pair-infogap Kısıtı, Sıfır Ölü Buton, Ortak Geniş Banner & Akıllı Alt Yazdırma Çubuğu", async () => {
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "DialoguePdfModal.tsx"),
    "utf8"
  );
  const assessmentCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "types", "assessment.ts"),
    "utf8"
  );
  const { isPairInfoGapSupported, STUDIO_POOL_PACK_ID } = await import(
    "../src/lib/a4ExamStudioEngine.ts"
  );

  // 1. Masaüstü 2 Sütunlu Split-Studio + Üst Başlıktan Tekrarlı Yazdır Butonunun Kaldırılması + Mobil Ultra Sade Hızlı PDF Kartı
  assert.equal(
    pdfModalCode.includes("md:grid md:grid-cols-[350px_1fr] lg:grid-cols-[380px_1fr]") &&
      pdfModalCode.includes("📄 Hızlı A4 PDF &amp; Sınav Üretici") &&
      !pdfModalCode.includes("<span>🖨️ Öğrenci Kağıdını Yazdır</span>"),
    true,
    "DialoguePdfModal masaüstünde 2 sütunlu Split-Studio ve mobilde Hızlı A4 PDF kartı sunmalı, üst başlıktaki tekrarlı yazdır butonunu kaldırmalıdır"
  );

  // 2. 5 Belge Şablonunun Tek Listede Birleştirilmesi ve pair-infogap Pedagojik Kaynak Kısıtı
  assert.equal(
    pdfModalCode.includes("2. Belge Türü / Şablon Seçin") &&
      pdfModalCode.includes("📝 6 Bölümlü Yazılı Sınav (A/B)") &&
      pdfModalCode.includes("📄 Temiz Ders Föyü / Çalışma Yaprağı") &&
      pdfModalCode.includes("✍️ Harekesiz Yoklama + Maarif Rubriği") &&
      pdfModalCode.includes("✂️ Kes-Katla Kelime Kartları") &&
      pdfModalCode.includes("🗣️ Eşli Konuşma Kartı (Öğrenci A &amp; B)") &&
      pdfModalCode.includes("{canUsePairInfoGap && ("),
    true,
    "5 belge şablonu tek listede birleştirilmeli ve pair-infogap canUsePairInfoGap koşuluna bağlanmalıdır"
  );

  assert.equal(isPairInfoGapSupported("diyaloglar", "single", "dlg_001"), true);
  assert.equal(isPairInfoGapSupported("dialogues", "single", "dlg_001"), true);
  assert.equal(isPairInfoGapSupported("diyaloglar", "range", "dlg_001"), false);
  assert.equal(
    isPairInfoGapSupported("diyaloglar", "single", STUDIO_POOL_PACK_ID),
    false
  );
  assert.equal(isPairInfoGapSupported("metinler", "single", "metin_01"), false);
  assert.equal(
    isPairInfoGapSupported("gorsel_kelimeler", "single", STUDIO_POOL_PACK_ID),
    false
  );
  assert.equal(
    isPairInfoGapSupported("cumleler_1111", "single", STUDIO_POOL_PACK_ID),
    false
  );
  assert.equal(
    isPairInfoGapSupported("atasozleri", "single", STUDIO_POOL_PACK_ID),
    false
  );
  assert.equal(
    isPairInfoGapSupported("es_zit_anlamlilar", "single", STUDIO_POOL_PACK_ID),
    false
  );
  assert.equal(
    isPairInfoGapSupported("defterim_custom", "single", "kutuphane_defterim"),
    false
  );

  // 3. Sıfır İşlevsiz Buton: Şablona Özgü Kontroller ve pair-infogap Türkçe İpucu Bağlantısı
  assert.equal(
    pdfModalCode.includes('effectivePdfDocMode === "quiz-sheet" && (') &&
      pdfModalCode.includes('effectivePdfDocMode === "handout" && (') &&
      pdfModalCode.includes('effectivePdfDocMode === "unvocalized-rubric" && (') &&
      pdfModalCode.includes('effectivePdfDocMode === "flashcards" && (') &&
      pdfModalCode.includes('effectivePdfDocMode === "pair-infogap" && (') &&
      pdfModalCode.includes("showPairTurkishCue") &&
      pdfModalCode.includes("Gizle (Sadece Arapça)") &&
      pdfModalCode.includes('{translationMode !== "hide" && ('),
    true,
    "Her şablon yalnızca kendi çalışan ayarlarını göstermeli, Sadece Arapça modunda tercüme yerleşimi gizlenmeli ve pair-infogap Türkçe İpucu anahtarı aktif olmalıdır"
  );

  // 4. Antette Küçük Görsel Kontrolü (Gizle / Göster) ve CDN / http URL Koruması
  const compactOptionMatches =
    pdfModalCode.match(/Göster \(Antette Küçük\)/g) || [];
  assert.equal(
    compactOptionMatches.length >= 4 &&
      pdfModalCode.includes("function resolvePrintAssetUrl(") &&
      pdfModalCode.includes('if (resolved.startsWith("http")) return resolved;') &&
      !pdfModalCode.includes("Geniş Banner"),
    true,
    "Tüm şablonlarda Görsel Görünümü 2 seçenekli (Gizle / Göster (Antette Küçük)) olmalı, Geniş Banner kaldırılmalı ve resolvePrintAssetUrl http kontrolü içermelidir"
  );

  // 5. Akıllı Alt Yazdırma Çubuğu (1 Buton vs 3 Buton) ve assessment.ts Satır 539 UTF-8 Koruması
  assert.equal(
    pdfModalCode.includes("🖨️ Çalışma Kağıdını / Kartları Yazdır (A4 PDF)") &&
      pdfModalCode.includes("🖨️ Öğrenci Kağıdı (Cevapsız)") &&
      pdfModalCode.includes("🔑 Sadece Cevap Anahtarı") &&
      pdfModalCode.includes("📚 İkisini Birlikte Yazdır") &&
      assessmentCode.includes('icon: known?.icon || "\\u{1F3DB}\\uFE0F",') &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Alt yazdırma çubuğu soru/boşluk durumuna göre 1 veya 3 buton göstermeli, assessment.ts saf ASCII kaçış dizisi içermeli ve metadata.json korunmalıdır"
  );
});

test("56. Resmi A4 Sınav ve Ders Föyü Anteti (Maks. 3-3.5 cm, Sıfır Renkli Rozet, Dış Önizleme Çubuğu, Sınav Varsayılanları ve Tekrarsız Konu Özeti)", async () => {
  const pdfModalCode = fs.readFileSync(
    path.join(ROOT_DIR, "src/components/ui/DialoguePdfModal.tsx"),
    "utf8"
  );
  const { resolveStudioMaterialBundle, STUDIO_DEFAULT_PAPER_TITLE } =
    await import("../src/lib/a4ExamStudioEngine.ts");

  // 1. A4 kağıdı üzerinde renkli/çerçeveli buton rozetlerinin tamamen kaldırılması
  assert.equal(
    !pdfModalCode.includes("badge-row") &&
      !pdfModalCode.includes("OKUMA METNİ #") &&
      !pdfModalCode.includes("KÜTÜPHANE ÇALIŞMA FÖYÜ") &&
      !pdfModalCode.includes("Dinlemek için okutun") &&
      pdfModalCode.includes("mastheadSourceLineTr") &&
      pdfModalCode.includes("Kaynak: [${dialogue.id}] ${dialogue.baslik_tr}  •  Seviye: ${dialogue.seviye}  •  Muallimun.Net"),
    true,
    "A4 kağıdı ve cevap anahtarında tüm renkli hap rozetler kaldırılmalı, üstte resmi düz metin kaynak satırı kullanılmalıdır"
  );

  // 2. Canlı önizleme durum çubuğunun beyaz A4 kağıdının (a4PageRef) DIŞINA taşınması
  const previewBannerIdx = pdfModalCode.indexOf("Canlı A4 Çalışma Kağıdı Önizlemesi");
  const a4PageRefIdx = pdfModalCode.indexOf("ref={a4PageRef}");
  assert.equal(
    previewBannerIdx > 0 && a4PageRefIdx > previewBannerIdx,
    true,
    "Canlı A4 Çalışma Kağıdı Önizlemesi bilgi çubuğu beyaz A4 kağıdının (a4PageRef) dışına ve üstüne taşınmalıdır"
  );

  // 3. Tek parça resmi antet (.official-masthead), 44x44px görsel/QR + 'Dinle' ve bitişik 4 hücreli öğrenci tablosu
  const officialMastheadMatches =
    pdfModalCode.match(/official-masthead/g) || [];
  assert.equal(
    officialMastheadMatches.length >= 4 &&
      pdfModalCode.includes("border: 1.5px solid #334155;") &&
      pdfModalCode.includes("grid-template-columns: 1.5fr 1fr 1.1fr 0.8fr;") &&
      pdfModalCode.includes("sm:grid-cols-[1.5fr_1fr_1.1fr_0.8fr]") &&
      pdfModalCode.includes("w-[44px] h-[44px]") &&
      pdfModalCode.includes('<span class="qr-caption">Dinle</span>'),
    true,
    "Hem canlı önizleme hem yazdırma HTML çıktısı hem de Cevap Anahtarı 1.5px #334155 çerçeveli tek parça resmi antet, 44x44px QR/görsel ve 4 hücreli bitişik öğrenci şeridi kullanmalıdır"
  );

  // 4. Yazılı sınav ciddiyeti varsayılanları ve Konu Özeti kutusunda sıfır tekrar
  assert.equal(
    STUDIO_DEFAULT_PAPER_TITLE === "Arapça Dersi Yazılı Sınavı" &&
      pdfModalCode.includes(
        "const [includeTopicSummary, setIncludeTopicSummary] = useState<boolean>(false);"
      ) &&
      pdfModalCode.includes(
        'initialDocMode === "quiz-sheet" || initialDocMode === "unvocalized-rubric"\n      ? "hide"\n      : "compact"'
      ),
    true,
    "Yazılı sınavlarda varsayılan görsel modu Gizle ve Konu Özeti kutusu kapalı (false) olmalı, varsayılan başlık öz ve resmi olmalıdır"
  );

  const bundle = resolveStudioMaterialBundle({
    sourceId: "metinler",
    levelFilter: "A1",
    packId: "metin_04",
    selectionMode: "single",
  });
  const duplicateRuleRow = bundle.topicSummary.rows.some(
    (r) => r.detailTr.trim() === bundle.topicSummary.ruleSummaryTr.trim()
  );
  assert.equal(
    duplicateRuleRow,
    false,
    "Konu Özeti kutusu açıldığında temel kaide özeti (hap_kural) hem üst paragrafta hem alt satırda iki kez tekrarlanmamalıdır"
  );
});

test("57. ErrorHunter Şık Tıklanabilirliği, Slash (/) Çoklu Örnek Eşleştirmesi, Med Harfi Hareke Kalkanı ve Mobil Alıştırma Tam Odak Modu Doğrulaması", async () => {
  const errorHunterCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "ErrorHunter.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const multipleChoiceCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );

  // 1. ErrorHunter handleSelectRepairOption effectiveStage !== "repair" kontrolü ve stage senkronizasyonu
  assert.equal(
    errorHunterCode.includes('effectiveStage !== "repair"') &&
      !errorHunterCode.includes('if (!currentItem || stage !== "repair") return;') &&
      errorHunterCode.includes("!currentItem.hasSingleSpanDiff"),
    true,
    "ErrorHunter.tsx içinde handleSelectRepairOption effectiveStage !== 'repair' kontrolü yapmalı ve !hasSingleSpanDiff durumunda tıklamaları kabul etmelidir"
  );

  const {
    buildErrorHunterCatalog,
    buildRealisticArabicMutations,
  } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "components", "exercises", "ErrorHunter.tsx")
    ).href
  );

  // 2. Slash (/) ile ayrılmış çoklu örneklerin simetrik eşleştirilmesi ve / kalıntısı kalmaması
  const catalog = buildErrorHunterCatalog();
  assert.ok(catalog.length >= 195, "ErrorHunter kataloğu zengin örnekler üretmelidir");

  for (const item of catalog) {
    assert.equal(
      item.wrongSentenceAr.includes("/") ||
        item.correctSentenceAr.includes("/") ||
        item.wrongSpanText.includes("/") ||
        item.correctSpanText.includes("/"),
      false,
      `${item.id} kaydında '/' ile birleştirilmiş ham çoklu örnek kalıntısı bulunmamalıdır (Y: ${item.wrongSentenceAr} | D: ${item.correctSentenceAr})`
    );
  }

  const allamaniItem = catalog.find(
    (it) =>
      toCanonicalArabicShaddaNfc(it.wrongSentenceAr).includes(
        toCanonicalArabicShaddaNfc("عَلَّمَي")
      ) &&
      toCanonicalArabicShaddaNfc(it.correctSentenceAr).includes(
        toCanonicalArabicShaddaNfc("عَلَّمَنِي")
      )
  );
  const iyyakaItem = catalog.find(
    (it) =>
      toCanonicalArabicShaddaNfc(it.wrongSentenceAr).includes(
        toCanonicalArabicShaddaNfc("إِيَّاكَ نَعْبُدُ وَنَسْتَعِينُكَ")
      ) &&
      toCanonicalArabicShaddaNfc(it.correctSentenceAr).includes(
        toCanonicalArabicShaddaNfc("إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ")
      )
  );
  assert.ok(allamaniItem, "عَلَّمَي -> عَلَّمَنِي örneği müstakil soru olarak eşleşmelidir");
  assert.ok(
    iyyakaItem,
    "إِيَّاكَ نَعْبُدُ وَنَسْتَعِينُكَ -> إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ örneği müstakil soru olarak eşleşmelidir"
  );

  // 3. Med harfleri (ا / و / ي / ى) ve نون الوقاية (ـنِي) üzerinde geçersiz hareke/tenvin/sükûn yasağı
  const maddWords = ["عَلَّمَنِي", "كِتَابِي", "يَكْتُبُوا", "رَمَى", "يَدْعُو", "مَدْرَسَتُنَا"];
  const invalidFinalMaddRegex = /[اويى][\u064B-\u0652](?:[^\p{L}\u064B-\u0652]|$)/u;
  for (const w of maddWords) {
    const muts = buildRealisticArabicMutations(w, new Set([w]), []);
    assert.ok(muts.length >= 2, `${w} için en az 2 gerçekçi çeldirici üretilmelidir`);
    for (const m of muts) {
      assert.equal(
        invalidFinalMaddRegex.test(m),
        false,
        `${w} kelimesinden üretilen '${m}' çeldiricisinde med harfi üzerinde hareke/sükûn bulunmamalıdır`
      );
    }
  }
  const allamaniMuts = buildRealisticArabicMutations(
    "عَلَّمَنِي",
    new Set(["عَلَّمَنِي"]),
    []
  );
  assert.equal(
    allamaniMuts.some((m) => ["عَلَّمَي", "عَلَّمُنِي", "عَلَّمْنِي"].includes(m)),
    true,
    "عَلَّمَنِي için نون الوقاية düşmesi veya zamir öncesi hareke hatası üretilmelidir"
  );

  const allamaniTarget = allamaniItem.hasSingleSpanDiff
    ? allamaniItem.correctSpanText
    : allamaniItem.correctSentenceAr;
  const allamaniGeneratedOptions = [
    allamaniTarget,
    ...buildRealisticArabicMutations(
      allamaniTarget,
      new Set([allamaniTarget, allamaniItem.wrongSpanText]),
      []
    ),
  ];
  for (const optText of allamaniGeneratedOptions) {
    assert.equal(
      invalidFinalMaddRegex.test(optText),
      false,
      `عَلَّمَنِي şıklarında ('${optText}') imlâ dışı harekeli med harfi bulunmamalıdır`
    );
  }

  // 4. Mobil Alıştırma "Tam Odak Modu" (alistirmalar/page.tsx + MultipleChoice.tsx)
  assert.equal(
    alistirmalarCode.includes("max-md:fixed max-md:inset-0 max-md:z-[90]") &&
      alistirmalarCode.includes("h-11 min-h-[44px] max-h-[44px]") &&
      alistirmalarCode.includes("← Çık") &&
      alistirmalarCode.includes("Doğru:") &&
      alistirmalarCode.includes("hidden md:flex"),
    true,
    "alistirmalar/page.tsx isPlaying aktifken mobilde (<768px) Header/MobileNav'ı gizleyen tam ekran odak moduna ve 44px tek satır üst şeride geçmelidir"
  );

  assert.equal(
    multipleChoiceCode.includes("sm:hidden w-full h-2 rounded-full") &&
      multipleChoiceCode.includes("hidden sm:flex sm:flex-wrap") &&
      multipleChoiceCode.includes("p-3 sm:p-6") &&
      multipleChoiceCode.includes("h-20 sm:h-36") &&
      multipleChoiceCode.includes("py-1 sm:py-2") &&
      multipleChoiceCode.includes("text-2xl sm:text-4xl"),
    true,
    "MultipleChoice.tsx mobilde (<640px) 1..10 kutuları yerine ince ilerleme çubuğu göstermeli ve p-3 sm:p-6 / h-20 sm:h-36 / text-2xl sm:text-4xl kompakt ölçülerini kullanmalıdır"
  );
});

test("58) Alıştırmalar Sayfası (alistirmalar/page.tsx) 2 Aşamalı Sade Vitrin + Hızlı Başlatma Çekmecesi Mimarisi", () => {
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );

  // 1. Sadeleştirilmiş Üst Başlık ve Tek Satırlık Hızlı Tekrar Bandı
  assert.equal(
    (alistirmalarCode.includes("İnteraktif Alıştırma & Oyun Merkezi") ||
      alistirmalarCode.includes("İnteraktif Alıştırma &amp; Oyun Merkezi")) &&
      alistirmalarCode.includes("Alıştırma &amp; Oyunlar") &&
      alistirmalarCode.includes("Mahreç Haritam") &&
      alistirmalarCode.includes("Hızlı Tekrar:") &&
      alistirmalarCode.includes("Hemen Çalış →") &&
      alistirmalarCode.includes("handleQuickReviewBannerStart"),
    true,
    "Vitrin üst başlığı masaüstünde 'İnteraktif Alıştırma & Oyun Merkezi' / mobilde 'Alıştırma & Oyunlar', sağda 'Mahreç Haritam' butonu ve tek satırlık '⚡ Hızlı Tekrar' bandı içermelidir"
  );

  // 2. Yatay kaydırılabilir 5 net kategori sekmesi (Tümü 17 = 4 + 4 + 4 + 5) ve kırpılmayan tam kart başlıkları
  assert.equal(
    alistirmalarCode.includes("flex overflow-x-auto no-scrollbar") &&
      alistirmalarCode.includes("🌟 Tümü") &&
      alistirmalarCode.includes("🎮 Görsel Oyunlar") &&
      alistirmalarCode.includes("📖 Kelime & Kartlar") &&
      alistirmalarCode.includes("📐 Gramer & İ'rab") &&
      alistirmalarCode.includes("🎧 Dinleme, Diyalog & Sınıf"),
    true,
    "5 kategori sekmesi yatay kaydırılabilir (flex overflow-x-auto no-scrollbar) olmalı ve yeni etiketleri taşımalıdır"
  );

  const visualGameMatches =
    alistirmalarCode.match(/category:\s*"visual_games"/g) || [];
  const vocabCardMatches =
    alistirmalarCode.match(/category:\s*"vocab_cards"/g) || [];
  const grammarIrabMatches =
    alistirmalarCode.match(/category:\s*"grammar_irab"/g) || [];
  const listenClassMatches =
    alistirmalarCode.match(/category:\s*"listen_dialogue_class"/g) || [];

  assert.equal(visualGameMatches.length, 5, "Görsel Oyunlar kategorisinde 5 modül olmalıdır");
  assert.equal(vocabCardMatches.length, 4, "Kelime & Kartlar kategorisinde 4 modül olmalıdır");
  assert.equal(grammarIrabMatches.length, 4, "Gramer & İ'rab kategorisinde 4 modül olmalıdır");
  assert.equal(
    listenClassMatches.length,
    5,
    "Dinleme, Diyalog & Sınıf kategorisinde 5 modül olmalıdır"
  );

  // Kart başlığı (card.title) üzerinde line-clamp-1 veya truncate bulunmamalıdır
  const cardTitleBlockMatch = alistirmalarCode.match(
    /<h2[^>]*>\s*\{card\.title\}\s*<\/h2>/
  );
  assert.ok(cardTitleBlockMatch, "Modül kartında {card.title} h2 etiketi bulunmalıdır");
  assert.equal(
    cardTitleBlockMatch[0].includes("truncate") ||
      cardTitleBlockMatch[0].includes("line-clamp-1"),
    false,
    "Modül kartı başlıkları (card.title) kırpılmadan tam okunmalıdır"
  );

  // 3. Ana sayfa altında kalıcı ayar yığını ve çift başlatma butonu kalmamalı; tek başlatma butonu kurulum çekmecesinde olmalıdır
  const startBtnOccurrences =
    alistirmalarCode.match(/onClick=\{handleStartExercise\}/g) || [];
  assert.equal(
    startBtnOccurrences.length,
    1,
    "Sayfada mükerrer başlatma butonu olmamalı, yalnızca Hızlı Başlatma Çekmecesi içinde 1 adet birincil başlatma butonu bulunmalıdır"
  );
  assert.equal(
    alistirmalarCode.includes("Alıştırma Kapsamı ve Veri Havuzu"),
    false,
    "Eski sayfa altı sabit ayar yığını ('Alıştırma Kapsamı ve Veri Havuzu') tamamen kaldırılmış olmalıdır"
  );

  // 4. Hızlı Başlatma Çekmecesi (Mobilde Bottom Sheet rounded-t-3xl max-h-[85dvh], Masaüstünde sm:max-w-lg sm:rounded-3xl) ve Grup A / B / C akıllı filtreleme
  assert.equal(
    alistirmalarCode.includes("isSetupDrawerOpen") &&
      alistirmalarCode.includes("useEscapeKey") &&
      alistirmalarCode.includes("rounded-t-3xl sm:rounded-3xl") &&
      alistirmalarCode.includes("max-h-[85dvh]") &&
      alistirmalarCode.includes("sm:max-w-lg") &&
      alistirmalarCode.includes("isVisualWordsOnlyGame") &&
      alistirmalarCode.includes("isSelfContainedCorpusModule") &&
      alistirmalarCode.includes("compatibleDrawerPools") &&
      alistirmalarCode.includes("Oyunu Başlat (") &&
      alistirmalarCode.includes("Alıştırmayı Başlat (") &&
      alistirmalarCode.includes('autostartParam === "1"'),
    true,
    "Hızlı Başlatma Çekmecesi mobil Bottom Sheet / masaüstü Modal mimarisine, Grup A/B/C uyumlu ayar süzgecine ve autostart=1 doğrudan başlatma desteğine sahip olmalıdır"
  );
});

test("59) BalloonSafariGame Dikey Mobil (540x860 + xMidYMid slice) Tam Ekran Sahne & Tek Satır HUD ve MemoryFlipGame Mobil Sıfır Çakışma / auto-rows-fr Tek Ekran Onarımı", () => {
  const balloonCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );
  const memoryCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );

  // 1. BalloonSafariGame: Dikey mobil algılama (windowWidth < 640 && windowHeight > windowWidth), 540x860 dikey koordinatlar, preserveAspectRatio="xMidYMid slice" ve tek satır mobil HUD
  assert.equal(
    balloonCode.includes("const PORTRAIT_STAGE_W = 540;") &&
      balloonCode.includes("const PORTRAIT_STAGE_H = 860;") &&
      balloonCode.includes("windowWidth < 640 && windowHeight > windowWidth") &&
      balloonCode.includes('preserveAspectRatio="xMidYMid slice"') &&
      balloonCode.includes("const balloonScale = isPortraitMobile ? 1.06 : 1;") &&
      balloonCode.includes("sm:hidden absolute top-2 inset-x-2 z-20 h-10") &&
      balloonCode.includes("hidden sm:flex sm:absolute sm:top-3") &&
      !balloonCode.includes("style={{"),
    true,
    "BalloonSafariGame dikey mobilde 540x860 tam ekran sahneye, xMidYMid slice ölçeklemesine ve tek satır mobil HUD barına sahip olmalıdır"
  );

  // 2. MemoryFlipGame: Tek satır 48px mobil başlık, h-11 mobil skor/süre şeridi, overflow-hidden + auto-rows-fr + grid-cols-2 / grid-cols-3 / grid-cols-4 ve h-full min-h-0 kart yüksekliği
  assert.equal(
    memoryCode.includes("h-12 min-h-[48px] max-h-[48px]") &&
      memoryCode.includes("lg:hidden shrink-0 z-20 h-11") &&
      memoryCode.includes("hidden lg:flex lg:order-2 w-full lg:w-60 xl:w-64") &&
      memoryCode.includes("overflow-hidden relative z-10 flex-1 min-w-0 min-h-0") &&
      memoryCode.includes("grid-cols-2 lg:grid-cols-4") &&
      memoryCode.includes("grid-cols-3 lg:grid-cols-4") &&
      memoryCode.includes('"grid-cols-4"') &&
      memoryCode.includes("auto-rows-fr lg:auto-rows-auto lg:content-center") &&
      memoryCode.includes("h-full min-h-0 lg:h-[clamp(5.2rem,17vh,8.8rem)]") &&
      !memoryCode.includes("style={{"),
    true,
    "MemoryFlipGame mobilde tek satır 48px başlığa, h-11 skor/süre şeridine, sıfır çakışmalı auto-rows-fr 2/3/4 sütunlu ızgaraya ve alt Bilgi Notu bandına sahip olmalıdır"
  );
});

test("60) Ana Sayfalar (diyalog, metin, sozluk, seviye-tespit, Header ve ScrollToTopButton) Mobil Mağaza Ergonomisi Doğrulaması", () => {
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const sozlukCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "sozluk", "page.tsx"),
    "utf8"
  );
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  const headerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const scrollTopCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ScrollToTopButton.tsx"),
    "utf8"
  );

  // 1. Diyalog & Metin Mobil Üst Panel Sadeleştirmesi (w-11 h-11 kapak, 3'lü mod, taşmayan 4 sütunlu oynatıcı ve Mobil Araç Çekmecesi)
  assert.equal(
    diyalogCode.includes("w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16") &&
      diyalogCode.includes("📖 İncele") &&
      diyalogCode.includes("🎭 Rol") &&
      diyalogCode.includes("grid grid-cols-[1fr_auto_auto_auto] items-center gap-1.5 w-full min-w-0") &&
      diyalogCode.includes("🧰 Araçlar") &&
      diyalogCode.includes("isMobileToolsSheetOpen") &&
      diyalogCode.includes('useEscapeKey(\n    () => setIsMobileToolsSheetOpen(false)') &&
      metinCode.includes("w-11 h-11 sm:w-14 sm:h-14 md:w-16 md:h-16") &&
      metinCode.includes("📖 İncele") &&
      metinCode.includes("grid grid-cols-[1fr_auto_auto_auto] items-center gap-1.5 w-full min-w-0") &&
      metinCode.includes("🧰 Araçlar") &&
      metinCode.includes("isMobileToolsSheetOpen") &&
      metinCode.includes('useEscapeKey(\n    () => setIsMobileToolsSheetOpen(false)'),
    true,
    "Diyalog ve Metin sayfaları mobilde 2 satırlık kompakt başlık, w-11 h-11 kapak, 3'lü mod sekmesi, taşmayan 4 sütunlu kontrol satırı ve Mobil Ders Araçları Çekmecesine sahip olmalıdır"
  );

  // 2. Sözlük Sol Kenar Kesilme Onarımı (justify-start px-1 scroll-px-2) ve İnce Mobil Sayfalama Barı (h-10)
  assert.equal(
    sozlukCode.includes("justify-start overflow-x-auto no-scrollbar whitespace-nowrap") &&
      sozlukCode.includes("px-1 scroll-px-2") &&
      sozlukCode.includes("sm:hidden bg-[#F7EFE1] dark:bg-[var(--surface)] rounded-xl border-2 border-[#E6D7BE] dark:border-[var(--border)] h-10 flex items-center justify-between px-3") &&
      sozlukCode.includes("Sayfa Başına:"),
    true,
    "Sözlük sayfasında yatay çipler sol kenardan kesilmemeli, mobilde h-10 tek satır sayfalama barı kullanılmalı ve Sayfa Başına seçicisi Filtreler çekmecesinde yer almalıdır"
  );

  // 3. Seviye Tespit / Konu Tarama Mobil Tek Satır Yatay Kaydırılabilir Filtre Şeridi
  assert.equal(
    seviyeCode.includes("flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5 pb-1") &&
      seviyeCode.includes("{labelPrefix} ({stats.questionCount})") &&
      seviyeCode.includes("{labelPrefix} ({stats.topicCount} Konu)"),
    true,
    "Seviye Tespit ve Konu Tarama sayfasında kur filtreleri mobilde tek satır yatay kaydırılabilir hap şeridi olmalı ve masaüstü rozetleri korunmalıdır"
  );

  // 4. Header Mobil İkon Hizası & ScrollToTopButton Ergonomisi (scrollY > 600, opacity-80, tam ekran gizleme)
  assert.equal(
    headerCode.includes("h-11 sm:h-12 lg:h-14") &&
      headerCode.includes("w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10") &&
      scrollTopCode.includes("scrollY > 600") &&
      scrollTopCode.includes("opacity-80 hover:opacity-100") &&
      scrollTopCode.includes("isFullscreenOverlayOpen") &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Header mobilde kompakt buton hizasına sahip olmalı, ScrollToTopButton yalnızca scrollY > 600 iken opacity-80 ile görünmeli ve tam ekran oyun/modal açıkken gizlenmelidir"
  );
});

test("61) Oynatma Listeleri İçin Uygulama İçi Bölüm Seçici, Kaldığı Bölümü Hatırlama (playlistLastEpisode) ve Bölüm Bazlı İzlendi Takibi (playlistWatchedEpisodes)", async () => {
  const { buildYoutubeEmbedUrl } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts")).href
  );
  const { useUserStore } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "store", "userStore.ts")).href
  );
  const { parsed: ytItems } = readDataJson("youtube_tavsiyeleri.json");

  const playlistItems = ytItems.filter((x) => x.tur === "playlist");
  const singleVideoItems = ytItems.filter((x) => x.tur === "video");
  assert.equal(playlistItems.length, 40, "40 adet oynatma listesi bulunmalıdır");
  assert.equal(singleVideoItems.length, 20, "20 adet tekil video bulunmalıdır");

  // 1. youtubeUtils.ts: playlistIndex > 1 olduğunda (video_id olsa bile) videoseries?list=...&index=N-1 üretilmeli
  const plWithVideo = {
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
    video_id: "dQw4w9WgXcQ",
    playlist_id: "PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx",
    tur: "playlist",
  };
  assert.equal(
    buildYoutubeEmbedUrl(plWithVideo, { autoplay: true, playlistIndex: 1 }),
    "https://www.youtube.com/embed/dQw4w9WgXcQ?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&rel=0&modestbranding=1&autoplay=1&enablejsapi=1",
    "playlistIndex === 1 olduğunda mevcut 1. bölüm URL davranışı ve enablejsapi=1 korunmalıdır"
  );
  assert.equal(
    buildYoutubeEmbedUrl(plWithVideo, { autoplay: true, playlistIndex: 4 }),
    "https://www.youtube.com/embed/videoseries?list=PLEM4OKFQO5J02EA68cT2o6ZQrN35JKEJx&index=3&rel=0&modestbranding=1&autoplay=1&enablejsapi=1",
    "playlistIndex === 4 olduğunda videoId atlanarak doğrudan videoseries?list=...&index=3&...&enablejsapi=1 (0-tabanlı) üretilmelidir"
  );

  // 40 oynatma listesinin tamamında 7. bölüm URL'si index=6 ve enablejsapi=1 içermeli
  for (const pl of playlistItems) {
    const ep7Url = buildYoutubeEmbedUrl(pl, { autoplay: true, playlistIndex: 7 });
    assert.equal(
      ep7Url.startsWith("https://www.youtube.com/embed/videoseries?list=") &&
        ep7Url.includes("&index=6&rel=0&modestbranding=1&autoplay=1&enablejsapi=1"),
      true,
      `${pl.id} oynatma listesinde 7. bölüm seçildiğinde videoseries, &index=6 ve &enablejsapi=1 üretilmelidir`
    );
  }

  // 20 tekil videonun tamamı playlistIndex verilse bile mevcut tekil video davranışını korumalı
  for (const vid of singleVideoItems) {
    const baseUrl = buildYoutubeEmbedUrl(vid, { autoplay: true });
    const withIdxUrl = buildYoutubeEmbedUrl(vid, {
      autoplay: true,
      playlistIndex: 3,
    });
    assert.equal(
      withIdxUrl,
      baseUrl,
      `${vid.id} tekil videosunun URL üretimi bozulmamalıdır`
    );
  }

  // 2. userStore.ts: playlistLastEpisode, togglePlaylistEpisodeWatched ve >= 5 bölümde otomatik watchedVideos senkronizasyonu
  useUserStore.getState().resetProgress();
  assert.deepEqual(useUserStore.getState().playlistWatchedEpisodes, {});
  assert.deepEqual(useUserStore.getState().playlistLastEpisode, {});

  useUserStore.getState().setPlaylistLastEpisode("yt_001", 6);
  assert.equal(
    useUserStore.getState().playlistLastEpisode["yt_001"],
    6,
    "Öğrencinin kaldığı son bölüm (6. Bölüm) kaydedilmelidir"
  );

  for (const ep of [3, 1, 4, 2]) {
    useUserStore.getState().togglePlaylistEpisodeWatched("yt_001", ep);
  }
  assert.deepEqual(
    useUserStore.getState().playlistWatchedEpisodes["yt_001"],
    [1, 2, 3, 4],
    "İzlenen bölümler küçükten büyüğe sıralı tutulmalıdır"
  );
  assert.equal(
    useUserStore.getState().watchedVideos.includes("yt_001"),
    false,
    "Henüz 4 bölüm izlendiğinde oynatma listesi tümüyle tamamlandı sayılmamalıdır"
  );

  // 5. bölüm işaretlendiğinde otomatik olarak watchedVideos içine eklenmeli
  useUserStore.getState().togglePlaylistEpisodeWatched("yt_001", 5);
  assert.deepEqual(
    useUserStore.getState().playlistWatchedEpisodes["yt_001"],
    [1, 2, 3, 4, 5]
  );
  assert.equal(
    useUserStore.getState().watchedVideos.includes("yt_001"),
    true,
    "En az 5 bölüm izlendiğinde oynatma listesi otomatik olarak watchedVideos listesine eklenmelidir"
  );

  // Yedekleme / İçe Aktarma (exportProgress & importProgress) doğrulaması
  const exportedJson = useUserStore.getState().exportProgress();
  useUserStore.getState().resetProgress();
  assert.deepEqual(useUserStore.getState().playlistWatchedEpisodes, {});
  assert.deepEqual(useUserStore.getState().playlistLastEpisode, {});

  const importedOk = useUserStore.getState().importProgress(exportedJson, "merge");
  assert.equal(importedOk, true, "Yedek başarıyla geri yüklenmelidir");
  assert.deepEqual(
    useUserStore.getState().playlistWatchedEpisodes["yt_001"],
    [1, 2, 3, 4, 5]
  );
  assert.equal(useUserStore.getState().playlistLastEpisode["yt_001"], 6);
  assert.equal(useUserStore.getState().watchedVideos.includes("yt_001"), true);
  useUserStore.getState().resetProgress();

  // 3. LiteYoutubeCard.tsx & YoutubePlayerModal arayüz doğrulaması
  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  assert.equal(
    liteCardCode.includes('aria-label="Oynatma Listesi Bölüm Seçici"') &&
      liteCardCode.includes("📑 Bölümler (") &&
      liteCardCode.includes("Tüm Seri") &&
      liteCardCode.includes(". Bölümden Devam Et") &&
      liteCardCode.includes(". Bölümü İzledim") &&
      liteCardCode.includes(". Bölüm İzlendi") &&
      liteCardCode.includes("playlistIndex: isPlaylistItem ? effectiveSrcEpisode : undefined") &&
      liteCardCode.includes("playlistIndex: activeIsPlaylist ? effectiveSrcEpisode : undefined") &&
      !liteCardCode.includes("style={{") &&
      !liteCardCode.includes("sandbox=") &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "LiteYoutubeCard ve YoutubePlayerModal oynatma listeleri için Bölüm Seçici, Kaldığı Bölümden Devam Et ve Bölüm Bazlı İzlendi kontrollerini eksiksiz içermelidir"
  );
});

test("62) Arapça (RTL — Sağdan Sola) Okuma Ergonomisi, İkili Sütun Yönü ve Akıllı Şık Hizalama Standartlaştırması", () => {
  const evidenceCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "ReadingEvidenceHunter.tsx"),
    "utf8"
  );
  const morphCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MorphologyAndContextQuiz.tsx"),
    "utf8"
  );
  const errorHunterCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "ErrorHunter.tsx"),
    "utf8"
  );
  const clozeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "ClozeDialogueRoleplay.tsx"),
    "utf8"
  );
  const whatIsThisCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "WhatIsThisGame.tsx"),
    "utf8"
  );
  const mcCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MultipleChoice.tsx"),
    "utf8"
  );
  const seviyeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const genderCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "GenderSortingGame.tsx"),
    "utf8"
  );

  // 1. ReadingEvidenceHunter: Masaüstünde metin sağda (lg:order-2), soru solda yapışkan (lg:order-1 lg:sticky lg:top-4), mobilde kanıt adımında scrollIntoView + üst uyarı şeridi, satır ve şıklar RTL
  assert.equal(
    evidenceCode.includes("order-1 lg:order-2 lg:col-span-7") &&
      evidenceCode.includes("order-2 lg:order-1 lg:col-span-5 lg:sticky lg:top-4") &&
      evidenceCode.includes("readingPanelRef.current?.scrollIntoView") &&
      evidenceCode.includes("🖍️ Şimdi cevabın kanıtı olan cümleye dokunun!") &&
      evidenceCode.includes('<div dir="rtl" className="flex items-start gap-2.5">') &&
      evidenceCode.includes('w-full text-right pb-3 border-b') &&
      !evidenceCode.includes("style={{"),
    true,
    "ReadingEvidenceHunter RTL iki sütun yerleşimini, mobil otomatik odak kaydırmasını ve sağ baş satır/şık rozetlerini içermelidir"
  );

  // 2. MorphologyAndContextQuiz: Masaüstünde hedef kart sağda (lg:order-2), 4 şık solda (lg:order-1), Arapça şık üst satırı RTL, Sarf Çekim Şeması sağdan sola (⬅)
  assert.equal(
    morphCode.includes("order-1 lg:order-2 lg:col-span-5") &&
      morphCode.includes("order-2 lg:order-1 lg:col-span-7") &&
      morphCode.includes('dir={isTurkishGrammarOption ? "ltr" : "rtl"}') &&
      morphCode.includes("⬅"),
    true,
    "MorphologyAndContextQuiz masaüstünde hedef kartı sağda, şıkları solda, Arapça şık başlıklarını RTL ve Sarf Çekim Şemasını sağdan sola (⬅) göstermelidir"
  );

  // 3. ErrorHunter, ClozeDialogueRoleplay ve WhatIsThisGame: Arapça şık butonlarında dir="rtl", konuşma balonlarında konuşmacı sağ başta / ses butonu sol sonda
  assert.equal(
    errorHunterCode.includes('dir="rtl"') &&
      clozeCode.includes('<div dir="rtl" className="flex items-center justify-between gap-2">') &&
      clozeCode.includes('type="button"\n                  dir="rtl"') &&
      whatIsThisCode.includes('type="button"\n                dir="rtl"') &&
      !whatIsThisCode.includes("style={{"),
    true,
    "ErrorHunter, ClozeDialogueRoleplay ve WhatIsThisGame Arapça şık ve replik balonlarında RTL hizalamayı eksiksiz uygulamalıdır"
  );

  // 4. MultipleChoice & seviye-tespit: Saf Arapça / Türkçe şık yönünü otomatik algılayan akıllı dir={... ? 'rtl' : 'ltr'}
  assert.equal(
    mcCode.includes('dir={isPureArabicOption ? "rtl" : "ltr"}') &&
      mcCode.includes('dir={isReviewPureArabic ? "rtl" : "ltr"}') &&
      seviyeCode.includes("function isPureArabicAssessmentOption(") &&
      seviyeCode.includes('dir={isArOpt ? "rtl" : "ltr"}'),
    true,
    "MultipleChoice ve seviye-tespit/page.tsx şık dilini algılayarak Arapça şıklarda dir='rtl', Türkçe şıklarda dir='ltr' uygulamalıdır"
  );

  // 5. metin/[id] Sorular sekmesi (A-D sağ başta, soru sağa yaslı) ve GenderSortingGame (masaüstünde هَذَا sağda sm:order-2, هَذِهِ solda sm:order-1)
  assert.equal(
    metinCode.includes("{optLetter}") &&
      metinCode.includes('dir="rtl"') &&
      genderCode.includes("order-1 sm:order-2") &&
      genderCode.includes("order-2 sm:order-1") &&
      genderCode.includes("Sağ Ok (→)") &&
      genderCode.includes("Sol Ok (←)") &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "metin/[id] Sorular sekmesi sağ baş A-D rozetlerini göstermeli ve GenderSortingGame masaüstünde هَذَا sepetini sağda, هَذِهِ sepetini solda konumlandırmalıdır"
  );
});

test("63) Oynatma Listesi Split-Cinema Yan Yana Dikey Bölüm Listesi, Satır İçi <select> Bölüm Barı ve YouTube enablejsapi=1 postMessage Senkronizasyonu", () => {
  const liteCardCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "LiteYoutubeCard.tsx"),
    "utf8"
  );
  const ytUtilsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "youtubeUtils.ts"),
    "utf8"
  );

  // 1. Split-Cinema masaüstü 2 sütun (max-w-5xl, lg:grid-cols-[1fr_280px], max-h-[58dvh]) + fare tekerleğiyle kaydırılan dikey bölüm listesi
  assert.equal(
    liteCardCode.includes("max-w-5xl max-h-[94dvh]") &&
      liteCardCode.includes(
        "flex flex-col lg:grid lg:grid-cols-[1fr_280px] flex-1 min-h-0 overflow-hidden"
      ) &&
      liteCardCode.includes("w-full aspect-video max-h-[58dvh] bg-black shrink-0") &&
      liteCardCode.includes("data-cinema-episode={ep}") &&
      liteCardCode.includes('rowEl.scrollIntoView({ block: "nearest" })') &&
      liteCardCode.includes("flex-1 overflow-y-auto p-2 space-y-1 max-h-[220px] lg:max-h-none"),
    true,
    "YoutubePlayerModal masaüstünde max-w-5xl ve lg:grid-cols-[1fr_280px] Split-Cinema düzeni ile fare tekerleğiyle kayan dikey bölüm listesi sunmalıdır"
  );

  // 2. Satır içi oynatıcıda video başlığını kapatan top-2 right-2 butonların kaldırılması, <select> açılır bölüm seçici ve taşmayan tek satır kart alt aksiyon barı
  assert.equal(
    !liteCardCode.includes("absolute top-2 right-2") &&
      liteCardCode.includes("<select") &&
      liteCardCode.includes('aria-label="Oynatma Listesi Bölüm Seçici"') &&
      liteCardCode.includes('aria-label="Satır İçi Oynatıcı Kontrol Şeridi"') &&
      liteCardCode.includes(
        "flex items-center gap-1.5 min-w-0"
      ) &&
      liteCardCode.includes('title="Sinema Modu"') &&
      liteCardCode.includes('title="YouTube\'da Aç"'),
    true,
    "LiteYoutubeCard video başlığını kapatan üst butonları kaldırmalı, satır içinde <select> bölüm seçici ve altta tek satır kompakt aksiyon barı kullanmalıdır"
  );

  // 3. YouTube enablejsapi=1 gerçek bölüm sayısı (info.playlist.length), otomatik bölüm takibi (info.playlistIndex) ve playVideoAt komutu
  assert.equal(
    ytUtilsCode.includes("&enablejsapi=1") &&
      liteCardCode.includes('event: "listening"') &&
      liteCardCode.includes('data.event === "infoDelivery"') &&
      liteCardCode.includes("data.info?.playlist") &&
      liteCardCode.includes("data.info?.playlistIndex") &&
      liteCardCode.includes('func: "playVideoAt"') &&
      !liteCardCode.includes("style={{") &&
      !liteCardCode.includes("sandbox=") &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "youtubeUtils.ts &enablejsapi=1 üretmeli ve LiteYoutubeCard infoDelivery üzerinden gerçek bölüm sayısı ile playVideoAt senkronizasyonu sağlamalıdır"
  );
});

test("64) Mobil Mağaza Ergonomisi — 360px Taşmasız Üst Kontroller, Tek Satır Diyalog Kart Başlığı, Kütüphane Çift İkon/Sekme Kesilme Onarımı, Tutarlı Oyun Başlıkları ve Koşullu Mobil Footer", () => {
  const diyalogCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "diyalog", "[id]", "page.tsx"),
    "utf8"
  );
  const metinCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "metin", "[id]", "page.tsx"),
    "utf8"
  );
  const shadowingBtnCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "ShadowingButton.tsx"),
    "utf8"
  );
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );
  const homeCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );
  const layoutCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  const conditionalFooterCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "ConditionalFooter.tsx"),
    "utf8"
  );

  // 1. Diyalog & Metin: 360px taşmasız grid-cols-[1fr_auto_auto_auto], tek satır diyalog kart başlığı (w-8 h-8 rounded-lg) ve yan yana 2 sütunlu Önceki/Sonraki kartlar
  assert.equal(
    diyalogCode.includes("grid grid-cols-[1fr_auto_auto_auto] items-center gap-1.5 w-full min-w-0") &&
      metinCode.includes("grid grid-cols-[1fr_auto_auto_auto] items-center gap-1.5 w-full min-w-0") &&
      shadowingBtnCode.includes("w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl") &&
      diyalogCode.includes("grid grid-cols-2 gap-2 sm:gap-3") &&
      metinCode.includes("grid grid-cols-2 gap-2 sm:gap-3") &&
      !diyalogCode.includes("🏆 Başarı Kartını Paylaş") &&
      !metinCode.includes("🏆 Başarı Kartını Paylaş"),
    true,
    "Diyalog ve Metin sayfaları taşmasız 4 sütunlu mobil kontrol satırı, tek satır konuşmacı+ikon başlığı, emojisiz Başarı Kartı ve 2 sütunlu Önceki/Sonraki kartlarına sahip olmalıdır"
  );

  // 2. Kütüphane: Çift ikon (🖨️ / 🏆) temizliği, mobilde 2 sütunlu üst butonlar, ChevronRight kesilme onarımı + scrollIntoView(center) ve pr-4 durum filtresi
  assert.equal(
    !kutuphaneCode.includes("🖨️ A4 Sınav") &&
      !kutuphaneCode.includes("🏆 İstatistik") &&
      kutuphaneCode.includes("grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto") &&
      kutuphaneCode.includes("A4 Sınav &amp; Not") &&
      kutuphaneCode.includes("İstatistik &amp; Rozet") &&
      kutuphaneCode.includes("data-kutuphane-tab={tab.id}") &&
      kutuphaneCode.includes('inline: "center"') &&
      kutuphaneCode.includes("flex overflow-x-auto no-scrollbar whitespace-nowrap items-center gap-1.5 py-0.5 pr-4"),
    true,
    "Kütüphane sayfasında çift ikonlar kaldırılmalı, üst butonlar mobilde 2 eşit sütunda durmalı, sekme çubuğu otomatik ortalanmalı ve durum filtresinde pr-4 bulunmalıdır"
  );

  // 3. Alıştırmalar & Ana Sayfa: Görsel oyun başlıklarında çift emoji olmaması, 'Alıştırma & Oyunlar' mobil başlığı, tek satır Hızlı Tekrar ve hizalı Rütbem butonu
  assert.equal(
    alistirmalarCode.includes('title: "Balon Safari"') &&
      alistirmalarCode.includes('title: "Hafızanı Yokla"') &&
      alistirmalarCode.includes('title: "Bu Nedir?"') &&
      !alistirmalarCode.includes('title: "🎈 Balon Safari"') &&
      !alistirmalarCode.includes('title: "🃏 Hafızanı Yokla"') &&
      !alistirmalarCode.includes('title: "🖼️ Bu Nedir?"') &&
      alistirmalarCode.includes("Alıştırma &amp; Oyunlar") &&
      alistirmalarCode.includes(">Çalış →<") &&
      homeCode.includes(">Rütbem<") &&
      !homeCode.includes("🏆 Başarılarım ve Rütbem"),
    true,
    "Alıştırmalar görsel oyun başlıklarında emoji tekrarı olmamalı, mobil başlık 'Alıştırma & Oyunlar' olmalı ve Ana Sayfa Rütbem butonu başlık karşısında tek satırda hizalanmalıdır"
  );

  // 4. İç Çalışma ve Oyun Sayfalarında Mobil Global Web Footer'ın Gizlenmesi (ConditionalFooter)
  assert.equal(
    layoutCode.includes("<ConditionalFooter") &&
      conditionalFooterCode.includes('cleanPath === "/" || cleanPath === "/ayarlar"') &&
      conditionalFooterCode.includes('showFooterOnMobile ? "block" : "hidden lg:block"') &&
      fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Global footer masaüstünde tüm sayfalarda korunmalı, mobilde (< 1024px) yalnızca '/' ve '/ayarlar' sayfalarında gösterilmelidir"
  );
});

test("65) TTS Öncesi UTF-8 Derleme Koruması ve JSON Arapça Fonetik/Hareke/Lam-Elif İmlâ Doğrulaması", () => {
  // 1. src/types/assessment.ts saf UTF-8 bayt dizisi ve tsconfig.json / metadata.json varlığı
  const assessmentPath = path.join(ROOT_DIR, "src", "types", "assessment.ts");
  const assessmentBytes = fs.readFileSync(assessmentPath);
  for (let i = 0; i < assessmentBytes.length - 2; i++) {
    assert.equal(
      assessmentBytes[i] === 0xed &&
        assessmentBytes[i + 1] >= 0xa0 &&
        assessmentBytes[i + 1] <= 0xbf,
      false,
      `assessment.ts içinde CESU-8 / vekil bayt dizisi bulunmamalıdır (offset: ${i})`
    );
  }
  const strictUtf8 = new TextDecoder("utf-8", { fatal: true });
  const assessmentText = strictUtf8.decode(assessmentBytes);
  const line539 = assessmentText.split(/\r?\n/)[538]?.trim();
  assert.equal(
    line539,
    'icon: known?.icon || "\\u{1F3DB}\\uFE0F",',
    "src/types/assessment.ts 539. satırda saf ASCII '\\u{1F3DB}\\uFE0F' kaçış dizisi bulunmalıdır"
  );
  assert.equal(
    Buffer.from("🏛️", "utf8").toString("hex"),
    "f09f8f9befb88f",
    "🏛️ ikonu standart 4+3 baytlık UTF-8 dizisi olmalıdır"
  );

  const tsconfigPath = path.join(ROOT_DIR, "tsconfig.json");
  assert.equal(fs.existsSync(tsconfigPath), true, "Kök dizinde tsconfig.json bulunmalıdır");
  const tsconfigJson = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  assert.deepEqual(
    tsconfigJson?.compilerOptions?.paths?.["@/*"],
    ["./src/*"],
    "tsconfig.json içinde '@/*': ['./src/*'] path alias tanımı korunmalıdır"
  );
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, "metadata.json")),
    true,
    "Kök dizinde metadata.json korunmalıdır"
  );

  // 2. atasozleri.json çift hareke, i'rab ve şemsî lam onarımları
  const atasozleri = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "atasozleri.json"), "utf8")
  );
  const byAtaId = new Map(atasozleri.map((x) => [x.id, x]));
  const dupHarakatRegex = /([\u064B-\u0652])\1/;
  for (const item of atasozleri) {
    assert.equal(
      dupHarakatRegex.test(item.arapca),
      false,
      `${item.id} kaydında üst üste binmiş çift hareke bulunmamalıdır: ${item.arapca}`
    );
  }
  assert.equal(byAtaId.get("ata_0062")?.arapca.includes(toCanonicalArabicShaddaNfc("الطُّرُقِ")), true);
  assert.equal(byAtaId.get("ata_0102")?.arapca.includes(toCanonicalArabicShaddaNfc("الطُّيُورَ")), true);
  assert.equal(byAtaId.get("ata_0137")?.arapca.includes(toCanonicalArabicShaddaNfc("السُّفُنُ")), true);
  assert.equal(byAtaId.get("ata_0185")?.arapca.includes(toCanonicalArabicShaddaNfc("يُحِبُّهُ")), true);
  assert.equal(byAtaId.get("ata_0186")?.arapca.includes(toCanonicalArabicShaddaNfc("يَدُلُّكَ")), true);
  assert.equal(byAtaId.get("ata_0348")?.arapca.includes(toCanonicalArabicShaddaNfc("الرُّتَبُ")), true);
  assert.equal(byAtaId.get("ata_0369")?.arapca.includes(toCanonicalArabicShaddaNfc("بِالصُّرَعَةِ")), true);
  assert.equal(
    byAtaId.get("ata_0370")?.arapca.includes("مَنْ يَكْفِيكَ"),
    true,
    "ata_0370 kaydında مَنْ يَكْفِيكَ imlâsı bulunmalıdır"
  );
  assert.equal(
    byAtaId.get("ata_0480")?.arapca.includes(toCanonicalArabicShaddaNfc("لِلْمُطَفِّفِينَ")),
    true,
    "ata_0480 kaydında sahih Kur'anî imla لِلْمُطَفِّفِينَ bulunmalıdır"
  );

  // 3. 1111_cumle.json şemsî lam ve vasl hemzesi onarımları
  const cumleler = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "1111_cumle.json"), "utf8")
  );
  const byCumleId = new Map(cumleler.map((x) => [x.id, x]));
  assert.equal(
    byCumleId.get("cumle_0395")?.arapca.includes(toCanonicalArabicShaddaNfc("الطَّائِرُ")) &&
      !byCumleId.get("cumle_0395")?.arapca.includes(toCanonicalArabicShaddaNfc("اَلْطَّائِرُ")),
    true,
    "cumle_0395 kaydında اَلْطَّائِرُ -> الطَّائِرُ olarak düzeltilmelidir"
  );
  assert.equal(
    byCumleId.get("cumle_1038")?.arapca.includes(toCanonicalArabicShaddaNfc("اللَّازِمَةَ")) &&
      !byCumleId.get("cumle_1038")?.arapca.includes(toCanonicalArabicShaddaNfc("الْلَّازِمَةَ")),
    true,
    "cumle_1038 kaydında الْلَّازِمَةَ -> اللَّازِمَةَ olarak düzeltilmelidir"
  );

  // 4. Lam-Elif (لا) ligatüründe med elifi (ا) üzerine kaymış fetha/şedde kalmaması
  const badLamAlifRegex = /\u0644[\u064B-\u065F]*\u0627[\u064E\u0651]+/;
  const targetDataFiles = [
    "tum_diyaloglar_120.json",
    "tum_metinler_60.json",
    "gorselKelimeler_guncel.json",
    "es_zit_anlamlilar.json",
    "yeni_tum_sozluk.json",
    "diyaloglar_gramer_hap_bilgi.json",
    "metinler_gramer_hap_bilgi.json",
    "seviye_tespit_sorulari.json",
  ];
  for (const fileName of targetDataFiles) {
    const raw = fs.readFileSync(path.join(ROOT_DIR, "src", "data", fileName), "utf8");
    assert.equal(
      badLamAlifRegex.test(raw),
      false,
      `${fileName} içinde med elifi (ا) üzerine kaymış لاَ / لاَّ harekesi kalmamalıdır`
    );
  }

  // 5. Vasl hemzesi, şedde ve tekil bağlam onarımları
  const diyaloglar = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "tum_diyaloglar_120.json"), "utf8")
  );
  const dlg119 = diyaloglar.find((d) => d.id === "dlg_119");
  assert.equal(
    dlg119?.baslik_ar.includes("وَابْنُ سِينَا") &&
      !dlg119?.baslik_ar.includes("وَإِبْنُ سِينَا"),
    true,
    "dlg_119 başlığında vasl hemzeli وَابْنُ سِينَا yer almalıdır"
  );

  const metinler = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "tum_metinler_60.json"), "utf8")
  );
  const metin32 = metinler.find((m) => m.id === "metin_32");
  const metin51 = metinler.find((m) => m.id === "metin_51");
  assert.equal(
    JSON.stringify(metin32).includes(toCanonicalArabicShaddaNfc("النَّشِيطُ")) &&
      !JSON.stringify(metin32).includes("النشِيطُ"),
    true,
    "metin_32 içinde النَّشِيطُ şeddeli olmalıdır"
  );
  assert.equal(
    JSON.stringify(metin51).includes("الْمُؤْتَمَرَاتُ") &&
      !JSON.stringify(metin51).includes("المؤْتَمَرَاتُ"),
    true,
    "metin_51 içinde الْمُؤْتَمَرَاتُ harekeli olmalıdır"
  );

  const gorselKelimeler = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "gorselKelimeler_guncel.json"), "utf8")
  );
  const lakapItem = gorselKelimeler.find((g) => g.id === "0005_01_lakap");
  assert.equal(
    lakapItem?.ornek_ar,
    "مَا لَقَبُ عَائِلَتِكَ يَا صَدِيقِي؟",
    "0005_01_lakap örnek cümlesi tekil عَائِلَتِكَ ile kurulmalıdır"
  );

  const sozluk = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "src", "data", "yeni_tum_sozluk.json"), "utf8")
  );
  const kelime1540 = sozluk.find((k) => k.id === "kelime_1540");
  assert.equal(
    kelime1540?.mufret,
    "اِثْنَيْنِ",
    "kelime_1540 müfret alanı vasl hemzeli اِثْنَيْنِ olmalıdır"
  );
});

test("66. Kullanım Kılavuzu, Tanıtım Turu, AppIntroSplash Dinamik CONTENT_INVENTORY Uyumu, Yedekleme/Sıfırlama (Playlist & Sınav/Alıştırma Özeti) ve 18 Modül Meta Senkronizasyonu", async () => {
  const { pathToFileURL } = await import("node:url");

  // 0. Kök dizinde metadata.json ve tsconfig.json kesinlikle mevcut olmalı ve 18 Modül içermeli
  const metadataPath = path.join(ROOT_DIR, "metadata.json");
  const tsconfigPath = path.join(ROOT_DIR, "tsconfig.json");
  assert.equal(fs.existsSync(metadataPath), true, "metadata.json silinmemelidir");
  assert.equal(fs.existsSync(tsconfigPath), true, "tsconfig.json silinmemelidir");

  const metadataJson = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  assert.equal(
    metadataJson.description.includes("18 Modüllü Alıştırma Merkezi") &&
      !metadataJson.description.includes("14 Modüllü"),
    true,
    "metadata.json güncel 18 Modüllü Alıştırma Merkezi açıklamasını içermelidir"
  );
  assert.equal(
    pkgJson.description.includes("18 Modüllü Alıştırma Merkezi") &&
      !pkgJson.description.includes("14 Modüllü"),
    true,
    "package.json güncel 18 Modüllü Alıştırma Merkezi açıklamasını içermelidir"
  );

  // 1. Hiçbir arayüz/meta dosyasında eski sabit "14 modül" / "14 Etkileşimli Modül" kalmamalıdır
  const targetFiles = [
    "src/components/ui/GuideAndInfoModalBody.tsx",
    "src/components/ui/OnboardingTourModal.tsx",
    "src/components/ui/AppIntroSplash.tsx",
    "src/components/ui/ShareAchievementModal.tsx",
    "src/app/ayarlar/page.tsx",
    "src/app/opengraph-image.tsx",
    "metadata.json",
    "package.json",
    "README.md",
  ];
  for (const rel of targetFiles) {
    const content = fs.readFileSync(path.join(ROOT_DIR, rel), "utf8");
    assert.equal(
      /14\s*(modül|etkileşimli|alıştırma|pedagojik)/iu.test(content),
      false,
      `${rel} içinde eski sabit '14 modül' ifadesi kalmamalıdır`
    );
  }

  // 2. GuideAndInfoModalBody, OnboardingTourModal ve AppIntroSplash CONTENT_INVENTORY ve 4 yeni özellik sütununu içermelidir
  const guideCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    "utf8"
  );
  const tourCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );
  const splashCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "AppIntroSplash.tsx"),
    "utf8"
  );

  for (const [name, src] of [
    ["GuideAndInfoModalBody.tsx", guideCode],
    ["OnboardingTourModal.tsx", tourCode],
    ["AppIntroSplash.tsx", splashCode],
  ]) {
    assert.equal(
      src.includes('@/lib/contentInventory') && src.includes("CONTENT_INVENTORY"),
      true,
      `${name} doğrudan hafif CONTENT_INVENTORY sabitini kullanmalıdır`
    );
  }

  // 4 ana güncel özelliğin hem Kullanım Kılavuzunda hem Tanıtım Turunda yer alması
  for (const [name, src] of [
    ["GuideAndInfoModalBody.tsx", guideCode],
    ["OnboardingTourModal.tsx", tourCode],
  ]) {
    assert.equal(
      src.includes("Hızlı Başlatma Çekmecesi") &&
        src.includes("Balon Safari") &&
        src.includes("Hafızanı Yokla") &&
        src.includes("Bu Nedir?") &&
        src.includes("3–3.5 cm") &&
        src.includes("Karma Aralık (Range)") &&
        (src.includes("40 oynatma listesinde") ||
          src.includes(
            "{CONTENT_INVENTORY.youtubePlaylistsCount} oynatma listesinde"
          )) &&
        src.includes("CEFR Kazanım Isı Haritası") &&
        src.includes("4 sekmeli"),
      true,
      `${name} 2 Aşamalı Oyun Vitrini, 2 Sütunlu A4 Sınav Stüdyosu (Karma Aralık), 40 Oynatma Listesi Bölüm Seçici ve CEFR Kazanım Isı Haritası özelliklerini anlatmalıdır`
    );
  }

  // 3. userStore.ts yedekleme (exportUserData / importUserData) ve sıfırlama (resetProgress) fonksiyonel doğrulaması
  const { useUserStore } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "store", "userStore.ts")).href
  );

  useUserStore.getState().resetProgress();

  // Playlist bölüm hafızası, izlenen bölümler, beceri istatistikleri ve son sınav/alıştırma özetlerini doldur
  useUserStore.getState().setPlaylistLastEpisode("yt_pl_01", 7);
  useUserStore.getState().togglePlaylistEpisodeWatched("yt_pl_01", 3);
  useUserStore.getState().togglePlaylistEpisodeWatched("yt_pl_01", 7);
  useUserStore.getState().recordSkillAttempt("kelime", true);
  useUserStore.getState().recordSkillAttempt("gramer", false);
  useUserStore.getState().setLastExerciseSummary({
    moduleName: "Balon Safari",
    solved: 8,
    correct: 7,
    wrong: 1,
    accuracyPercent: 88,
    updatedAt: "2026-10-10T10:00:00.000Z",
  });
  useUserStore.getState().setLastExamSummary({
    mode: "cat",
    title: "Adaptif Seviye Tespit (CAT)",
    level: "B1",
    solved: 10,
    correct: 9,
    wrong: 1,
    accuracyPercent: 90,
    updatedAt: "2026-10-10T10:05:00.000Z",
  });

  const backupJson = useUserStore.getState().exportUserData();
  const parsedBackup = JSON.parse(backupJson);
  assert.deepEqual(parsedBackup.playlistLastEpisode, { yt_pl_01: 7 });
  assert.deepEqual(parsedBackup.playlistWatchedEpisodes, { yt_pl_01: [3, 7] });
  assert.equal(parsedBackup.skillStats.kelime.correct, 1);
  assert.equal(parsedBackup.lastExerciseSummary?.moduleName, "Balon Safari");
  assert.equal(parsedBackup.lastExamSummary?.level, "B1");

  // Sıfırlama (resetProgress) tüm bu alanları tertemiz sıfırlamalıdır
  useUserStore.getState().resetProgress();
  const afterReset = useUserStore.getState();
  assert.deepEqual(afterReset.playlistLastEpisode, {});
  assert.deepEqual(afterReset.playlistWatchedEpisodes, {});
  assert.equal(afterReset.skillStats.kelime.total, 0);
  assert.equal(afterReset.lastExerciseSummary, null);
  assert.equal(afterReset.lastExamSummary, null);

  // Overwrite ile geri yükleme
  const overwriteOk = useUserStore.getState().importUserData(backupJson, "overwrite");
  assert.equal(overwriteOk, true, "importUserData overwrite başarılı olmalıdır");
  const afterOverwrite = useUserStore.getState();
  assert.deepEqual(afterOverwrite.playlistLastEpisode, { yt_pl_01: 7 });
  assert.deepEqual(afterOverwrite.playlistWatchedEpisodes, { yt_pl_01: [3, 7] });
  assert.equal(afterOverwrite.skillStats.kelime.correct, 1);
  assert.equal(afterOverwrite.skillStats.gramer.total, 1);
  assert.equal(afterOverwrite.lastExerciseSummary?.accuracyPercent, 88);
  assert.equal(afterOverwrite.lastExamSummary?.mode, "cat");

  // Merge ile birleştirme (farklı oynatma listesi + daha yeni alıştırma özeti korunmalı)
  useUserStore.getState().resetProgress();
  useUserStore.getState().setPlaylistLastEpisode("yt_pl_02", 4);
  useUserStore.getState().togglePlaylistEpisodeWatched("yt_pl_01", 1);
  useUserStore.getState().setLastExerciseSummary({
    moduleName: "Hafızanı Yokla",
    solved: 20,
    correct: 19,
    wrong: 1,
    accuracyPercent: 95,
    updatedAt: "2026-10-12T12:00:00.000Z",
  });

  const mergeOk = useUserStore.getState().importUserData(backupJson, "merge");
  assert.equal(mergeOk, true, "importUserData merge başarılı olmalıdır");
  const afterMerge = useUserStore.getState();
  assert.deepEqual(afterMerge.playlistLastEpisode, { yt_pl_02: 4, yt_pl_01: 7 });
  assert.deepEqual(afterMerge.playlistWatchedEpisodes.yt_pl_01, [1, 3, 7]);
  assert.equal(
    afterMerge.lastExerciseSummary?.moduleName,
    "Hafızanı Yokla",
    "Merge modunda zaman damgası daha yeni olan alıştırma özeti korunmalıdır"
  );
  assert.equal(
    afterMerge.lastExamSummary?.level,
    "B1",
    "Merge modunda mevcut sınav özeti yoksa yedekteki sınav özeti alınmalıdır"
  );

  useUserStore.getState().resetProgress();
});

test("67. ⚡ Görsel Hız Seansı (VisualSwipeSprintGame — سِبَاقُ الصُّوَرِ): 998 Resimli Kelime, 4 Mikro-Etkileşim, 60 FPS Kaydırma/Klavye, SRS Hata Döngüsü ve 18. Modül Entegrasyonu", async () => {
  const { pathToFileURL } = await import("node:url");

  const sprintPath = path.join(
    ROOT_DIR,
    "src",
    "components",
    "exercises",
    "VisualSwipeSprintGame.tsx"
  );
  assert.equal(
    fs.existsSync(sprintPath),
    true,
    "VisualSwipeSprintGame.tsx bileşeni oluşturulmuş olmalıdır"
  );

  const sprintCode = fs.readFileSync(sprintPath, "utf8");
  const alistirmalarCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "alistirmalar", "page.tsx"),
    "utf8"
  );

  // 1. Tam ekran responsive sahne, sıfır satır-içi JSX style={{ ve hem pointer kaydırma hem ok tuşu desteği
  assert.equal(
    sprintCode.includes("fixed inset-0 z-[9999]") &&
      sprintCode.includes("h-[100dvh]") &&
      sprintCode.includes("overflow-hidden") &&
      !sprintCode.includes("style={{"),
    true,
    "VisualSwipeSprintGame fixed inset-0 z-[9999] h-[100dvh] overflow-hidden tam ekran olmalı ve JSX inline style={{ içermemelidir"
  );

  assert.equal(
    sprintCode.includes("onPointerDown") &&
      sprintCode.includes("onPointerMove") &&
      sprintCode.includes("onPointerUp") &&
      sprintCode.includes('"ArrowUp"') &&
      sprintCode.includes('"ArrowDown"') &&
      sprintCode.includes('"ArrowLeft"') &&
      sprintCode.includes('"ArrowRight"'),
    true,
    "VisualSwipeSprintGame hem dokunmatik/fare kaydırma (onPointerDown/Move/Up) hem masaüstü ok tuşları (ArrowUp/Down/Left/Right) ile çalışmalıdır"
  );

  // 2. Üst HUD, 2 Dk / 5 Dk seans seçimi ve yalnızca görseli olan gorselKelimeler_guncel.json filtresi
  assert.equal(
    sprintCode.includes("2 Dk Hızlı Seans") &&
      sprintCode.includes("5 Dk Tam Seans") &&
      sprintCode.includes("Kombo x") &&
      sprintCode.includes("Tekrar Dinle") &&
      sprintCode.includes("Boolean(item.gorsel") &&
      sprintCode.includes("playDualGenderAudio"),
    true,
    "Üst HUD ve başlangıç ekranı 2 Dk / 5 Dk seans seçimi, Kombo xN, Tekrar Dinle, görsel doğrulaması ve otomatik seslendirme içermelidir"
  );

  // 3. 4 klavyesiz mikro-etkileşim türü + SRS & Hata Defteri + Seans Sonu Hız Karnesi
  assert.equal(
    sprintCode.includes('"drop_intro"') &&
      sprintCode.includes('"up_down_tf"') &&
      sprintCode.includes('"left_right_pick"') &&
      sprintCode.includes('"syllable_tap"') &&
      sprintCode.includes('recordItemAttempt(target.id, "word", isCorrect)') &&
      sprintCode.includes('recordSkillAttempt("kelime", isCorrect)') &&
      sprintCode.includes("addMistake(target.id)") &&
      sprintCode.includes("dueAtStep") &&
      sprintCode.includes("Kelime / Dk") &&
      sprintCode.includes("Zorlandığım Kelimelerle 1 Dk Tekrar Yap"),
    true,
    "4 mikro-etkileşim (drop_intro, up_down_tf, left_right_pick, syllable_tap), SRS kaydı, yeniden kuyruklama ve Hız Karnesi eksiksiz olmalıdır"
  );

  // 4. splitArabicWordIntoSyllableChunks fonksiyonel doğrulaması (998 görsel kelime üzerinde hareke bütünlüğü ve 1-4 parça sınırı)
  const { splitArabicWordIntoSyllableChunks } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts")).href
  );
  const { parsed: visualWords } = readDataJson("gorselKelimeler_guncel.json");
  assert.equal(visualWords.length, 998);

  const leadingMarkRegex = /^[\u064B-\u065F\u0670\u06D6-\u06ED]/u;
  let multiSyllableCount = 0;

  for (const item of visualWords) {
    assert.ok(item.gorsel, `${item.id} kaydının görseli bulunmalıdır`);
    const { chunks, hasWordSpaces } = splitArabicWordIntoSyllableChunks(
      item.arapca
    );
    assert.ok(
      chunks.length >= 1 && chunks.length <= 4,
      `${item.id} (${item.arapca}) hece sayısı 1..4 aralığında olmalıdır, üretilen: ${chunks.length}`
    );
    if (chunks.length >= 2) {
      multiSyllableCount += 1;
    }
    for (const chunk of chunks) {
      assert.equal(
        leadingMarkRegex.test(chunk),
        false,
        `${item.id} (${item.arapca}) içinde kopuk başlangıç harekesi olmamalıdır: "${chunk}"`
      );
    }
    const rejoined = chunks.join(hasWordSpaces ? " " : "");
    const expectedClean = item.arapca
      .normalize("NFC")
      .split(/\s+/u)
      .map((p) => p.replace(/[؟?!.,،؛:"'«»()[\]{}\-]/gu, "").trim())
      .filter(Boolean)
      .join(hasWordSpaces ? " " : "");
    assert.equal(
      rejoined,
      expectedClean,
      `${item.id} sağdan sola heceler birleştiğinde orijinal harekeli kelimeyi vermelidir`
    );
  }
  assert.ok(
    multiSyllableCount >= 950,
    "998 görsel kelimenin ezici çoğunluğu en az 2 hece baloncuğuna ayrılmalıdır"
  );

  // 5. /alistirmalar sayfası entegrasyonu (yeni ana menü açmadan mevcut Hızlı Başlatma Çekmecesi ile çalışma)
  assert.equal(
    alistirmalarCode.includes('id: "visual-swipe-sprint"') &&
      alistirmalarCode.includes("Görsel Hız Seansı") &&
      alistirmalarCode.includes("سِبَاقُ الصُّوَرِ") &&
      alistirmalarCode.includes("<VisualSwipeSprintGame") &&
      alistirmalarCode.includes('selectedType === "visual-swipe-sprint"'),
    true,
    "alistirmalar/page.tsx içinde Görsel Hız Seansı (visual-swipe-sprint) Görsel Oyunlar kategorisine ve Hızlı Başlatma Çekmecesine entegre edilmiş olmalıdır"
  );
});

test("68. Kütüphane ve Gramer Yan Paneli: Büyük Kart Modalı Z-Katmanı & Esc Önceliği, Split Push Düzeni, A1 Özet Tekilleştirmesi, Terim Parantez Tekrarı Temizliği ve Akıllı Odak Kalıp Eşleşmesi", async () => {
  const kutuphaneCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );

  // 1. Büyük kart modalı üzerinde açılan gramer penceresinin katman ve Esc sırası
  assert.equal(
    grammarPanelCode.includes("elevatedOverModal?: boolean") &&
      grammarPanelCode.includes('elevatedOverModal ? "lg:z-[95]" : "lg:z-[45]"') &&
      kutuphaneCode.includes("elevatedOverModal={selectedCardIndex !== null}") &&
      kutuphaneCode.includes("if (activeGrammarModal) return;") &&
      kutuphaneCode.includes("lg:mr-[420px] lg:w-[calc(95vw-440px)]"),
    true,
    "Büyük kart modalı açıkken GrammarHapBilgiModal lg:z-[95] katmanına çıkmalı, yan yana hizalanmalı ve Esc tuşu önce gramer penceresini kapatmalıdır"
  );

  // 2. Kütüphane masaüstü Split Push düzeni
  assert.equal(
    grammarPanelCode.includes("onStateChange?:") &&
      kutuphaneCode.includes("isDesktopGrammarDrawerDocked") &&
      kutuphaneCode.includes("lg:pr-[422px]") &&
      kutuphaneCode.includes("lg:pl-[422px]") &&
      kutuphaneCode.includes("lg:grid-cols-1 xl:grid-cols-2"),
    true,
    "Kütüphane sayfası gramer çekmecesi açıkken sağdan/soldan 422px push boşluğu bırakmalı ve kart ızgaralarını daraltmalıdır"
  );

  // 3. A1 Başlangıç Özeti yalnızca sade modda ve mükerrer hap_kural kutusu olmadan görünmeli
  assert.equal(
    grammarPanelCode.includes("{isA1Level && isSimpleMode && (") &&
      !grammarPanelCode.includes(
        "simplifyGrammarTerminology(activeNote.hap_kural)"
      ),
    true,
    "A1 Başlangıç Özeti yalnızca Sade Anlatım modunda görünmeli ve içindeki mükerrer hap_kural beyaz kutusu kaldırılmış olmalıdır"
  );

  // 4. simplifyGrammarTerminology parantez içi mükerrer terim temizliği
  const { simplifyGrammarTerminology } = await import(
    "../src/lib/arabicTextUtils.ts"
  );
  assert.equal(
    simplifyGrammarTerminology(
      "Cümlede etkilenen nesne (Mef'ûlün Bih) daima üstünlüdür."
    ),
    "Cümlede etkilenen nesne daima üstünlüdür.",
    "simplifyGrammarTerminology 'etkilenen nesne (Etkilenen Nesne)' tekrarını tekilleştirmelidir"
  );
  assert.equal(
    simplifyGrammarTerminology("tamlayan isim (Muzâfun İleyh)"),
    "tamlayan isim",
    "simplifyGrammarTerminology 'tamlayan isim (Tamlayan İsim)' tekrarını tekilleştirmelidir"
  );

  // 5. 1111 Cümle odak_kalip -> Ana gramer kartı akıllı kanonik eşleştirme
  const { resolveGrammarNoteAndSentences } = await import(
    "../src/components/ui/GrammarHapBilgiPanel.tsx"
  );
  const resolvedMubteda = resolveGrammarNoteAndSentences({
    grammarTopic: "Mübteda ve Haber (Müennes)",
  });
  assert.ok(resolvedMubteda.resolvedNote, "Mübteda ve Haber (Müennes) çözümlenmelidir");
  assert.equal(
    resolvedMubteda.resolvedNote.konu_basligi,
    "Mübteda ve Haber (Müennes)",
    "Üst başlıkta tıklanan özel odak_kalip korunmalıdır"
  );
  assert.ok(
    resolvedMubteda.matchedCanonicalTitle &&
      resolvedMubteda.matchedCanonicalTitle.length > 0,
    "Eşleşen ana gramer kartının başlığı matchedCanonicalTitle olarak döndürülmelidir"
  );
  assert.equal(
    resolvedMubteda.resolvedNote.hap_kural.includes(
      "Arapçada cümle kurarken kelimeler arasındaki görev"
    ),
    false,
    "Parantezli odak_kalip jenerik şablon yerine gerçek kanonik hap_kural metnini yüklemelidir"
  );
  assert.ok(
    (resolvedMubteda.resolvedNote.ayrintili_anlatim?.irab_tahlili?.length || 0) > 0,
    "Eşleşen kanonik gramer kartının gerçek i'rab tahlili yüklenmelidir"
  );

  // 6. Çift ikon temizliği ve tek satır Diyaloğu Aç butonu
  assert.equal(
    !grammarPanelCode.includes("🖨️ A4 Ders Föyü (PDF)") &&
      !grammarPanelCode.includes("📲 WhatsApp") &&
      !kutuphaneCode.includes("📥 Çevrimdışı İndir") &&
      kutuphaneCode.includes("whitespace-nowrap shrink-0"),
    true,
    "GrammarHapBilgiPanel ve Diyalog kartlarındaki çift ikon (SVG + emoji) tekrarları temizlenmiş ve Diyaloğu Aç butonu tek satıra sabitlenmiş olmalıdır"
  );
});

// ============================================================================
// TEST 69: Tekil İ'rab Butonu, Akademik Mod Senkronizasyonu, Çoklu Hata Örneği
// Ayrıştırması ve Katmanlı & Hafızalı 20 Soru Kur Sınavı Algoritması
// ============================================================================
test("GrammarHapBilgiPanel tekil İ'rab butonu + Akademik mod açık varsayılanı ve buildBalancedLevelExamQuestions 4 kur dengesi doğrulanmalı", async () => {
  const grammarPanelCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GrammarHapBilgiPanel.tsx"),
    "utf8"
  );
  const seviyeTespitCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "seviye-tespit", "page.tsx"),
    "utf8"
  );

  // 1. Mükerrer eski İ'rab açma butonu kaldırılmış, tekil "🔍 Kelime Kelime İ'rab Tahlilini Göster ▾" ve Akademik mod senkronizasyonu kurulmuş olmalı
  assert.equal(
    grammarPanelCode.includes("İleri Düzey (B1-B2) Akademik İ"),
    false,
    "Mükerrer eski 'İleri Düzey (B1-B2) Akademik İ'rab Tahlilini Göster' etiketi tamamen kaldırılmalıdır"
  );
  assert.equal(
    grammarPanelCode.includes(
      'const defaultDeepIrabOpen = grammarDepthMode === "academic" || !isA1DeepLevel;'
    ) &&
      grammarPanelCode.includes(
        'const defaultInlineIrabOpen = grammarDepthMode === "academic" || !isA1Level;'
      ) &&
      grammarPanelCode.includes(
        "${grammarNote.bagli_id}::${effectiveDeepLevel}::${grammarDepthMode}"
      ) &&
      grammarPanelCode.includes(
        "${activeBagliId}::${effectiveLevel}::${grammarDepthMode}"
      ),
    true,
    "Akademik mod seçildiğinde A1 dahil tüm kurlarda kelime kelime İ'rab tablosu varsayılan olarak açık gelmelidir"
  );

  // 2. Çoklu `/` kullanım örnekleri dikey satırlara ayrılmalı
  const { splitUsageExamplesList } = await import(
    "../src/components/ui/GrammarHapBilgiPanel.tsx"
  );
  const multiSlash = splitUsageExamplesList(
    "الطَّقْسُ الْحَارُّ / السَّمَاءُ صَافِيٌ"
  );
  assert.equal(
    multiSlash.length,
    2,
    "Slash (/) ile ayrılan çoklu Arapça örnekler ayrı satırlara bölünmelidir"
  );
  assert.equal(multiSlash[0].arabicPart, "الطَّقْسُ الْحَارُّ");
  assert.equal(multiSlash[1].arabicPart, "السَّمَاءُ صَافِيٌ");

  const withParenNotes = splitUsageExamplesList(
    "جَوَازِي فِي حَقِيبَةٍ صَغِيرَةٍ (Belirli çanta ise) / جَوَازِي الْجَدِيدٌ."
  );
  assert.equal(withParenNotes.length, 2);
  assert.deepEqual(withParenNotes[0].turkishNotes, ["Belirli çanta ise"]);

  // 3. Katmanlı & Hafızalı 20 Soru Kur Bitirme Sınavı Algoritması
  const bank = JSON.parse(
    fs.readFileSync(
      path.join(ROOT_DIR, "src", "data", "seviye_tespit_sorulari.json"),
      "utf8"
    )
  );
  const {
    buildBalancedLevelExamQuestions,
    readSeenLevelExamQuestionIds,
    recordLevelExamWrongQuestionIds,
  } = await import("../src/types/assessment.ts");

  const createMemoryStorage = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };

  let seed = 42;
  const deterministicRng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const expectedInitialTopics = { A1: 16, A2: 19, B1: 20, B2: 10 };

  for (const lvl of ["A1", "A2", "B1", "B2"]) {
    const mem = createMemoryStorage();
    const res1 = buildBalancedLevelExamQuestions(bank, lvl, {
      storage: mem,
      rng: deterministicRng,
    });

    assert.equal(
      res1.questions.length,
      20,
      `${lvl} Kur Sınavı tam 20 soru üretmelidir`
    );
    assert.equal(
      new Set(res1.questions.map((q) => q.id)).size,
      20,
      `${lvl} Kur Sınavında mükerrer soru bulunmamalıdır`
    );
    assert.equal(
      res1.questions.every((q) => q.seviye === lvl),
      true,
      `${lvl} Kur Sınavındaki tüm sorular ${lvl} seviyesine ait olmalıdır`
    );
    assert.equal(
      res1.selectedTopicCount,
      expectedInitialTopics[lvl],
      `${lvl} ilk Kur Sınavı Round-Robin ile ${expectedInitialTopics[lvl]} farklı üst konuyu kapsamalıdır`
    );
    assert.equal(
      res1.selectedSkillAreaCount,
      5,
      `${lvl} Kur Sınavı 5 temel beceri alanının tamamını içermelidir`
    );
    assert.ok(
      res1.skillBreakdown.sarf_nahiv >= 7 && res1.skillBreakdown.sarf_nahiv <= 10,
      `${lvl} Kur Sınavında sarf_nahiv dengeli olmalıdır (gerçekleşen: ${res1.skillBreakdown.sarf_nahiv})`
    );

    // Tek bir konudan yığılma olmamalı (A1/A2/B1 <= 2, B2 <= 3)
    const perTopic = {};
    for (const q of res1.questions) {
      perTopic[q.ust_konu] = (perTopic[q.ust_konu] || 0) + 1;
    }
    const maxInSingleTopic = Math.max(...Object.values(perTopic));
    assert.ok(
      maxInSingleTopic <= (lvl === "B2" ? 3 : 2),
      `${lvl} Kur Sınavında tek konudan aşırı soru yığılmamalıdır (en çok: ${maxInSingleTopic})`
    );

    // Kademeli zorluk sıralaması (1 -> 2 -> 3)
    for (let i = 1; i < res1.questions.length; i++) {
      assert.ok(
        res1.questions[i - 1].zorluk_basamagi <=
          res1.questions[i].zorluk_basamagi,
        `${lvl} Kur Sınavı soruları artan zorluk basamağına göre sıralanmalıdır`
      );
    }

    // 2. sınavda ilk sınavdaki hiçbir soru tekrar gelmemeli (%100 çözülmemiş önceliği)
    const res2 = buildBalancedLevelExamQuestions(bank, lvl, {
      storage: mem,
      rng: deterministicRng,
    });
    assert.equal(res2.freshUnseenSelectedCount, 20);
    const firstIds = new Set(res1.questions.map((q) => q.id));
    assert.equal(
      res2.questions.some((q) => firstIds.has(q.id)),
      false,
      `${lvl} 2. Kur Sınavında 1. sınavda sorulan hiçbir soru tekrar gelmemelidir`
    );
  }

  // B2 havuzunda (90 soru) 4 sınav (80 soru) sonrası 5. sınavda (< 20 çözülmemiş = 10 soru)
  // kalan 10 çözülmemiş soru + yanlış yapılan sorular önceliklendirilip döngü sıfırlanmalı
  const cycleMem = createMemoryStorage();
  const b2Run1 = buildBalancedLevelExamQuestions(bank, "B2", {
    storage: cycleMem,
    rng: deterministicRng,
  });
  const simulatedWrongIds = [b2Run1.questions[0].id, b2Run1.questions[1].id];
  recordLevelExamWrongQuestionIds("B2", simulatedWrongIds, [], cycleMem);

  for (let k = 0; k < 3; k++) {
    const r = buildBalancedLevelExamQuestions(bank, "B2", {
      storage: cycleMem,
      rng: deterministicRng,
    });
    assert.equal(r.cycleResetOccurred, false);
    assert.equal(r.freshUnseenSelectedCount, 20);
  }
  assert.equal(readSeenLevelExamQuestionIds("B2", cycleMem).length, 80);

  const b2ResetRun = buildBalancedLevelExamQuestions(bank, "B2", {
    storage: cycleMem,
    rng: deterministicRng,
  });
  assert.equal(
    b2ResetRun.cycleResetOccurred,
    true,
    "Havuzda 20'den az çözülmemiş soru kaldığında döngü sıfırlanmalıdır"
  );
  assert.equal(
    b2ResetRun.freshUnseenSelectedCount,
    10,
    "Sıfırlama sınavında kalan 10 çözülmemiş sorunun tamamı öncelikle seçilmelidir"
  );
  const resetIds = new Set(b2ResetRun.questions.map((q) => q.id));
  assert.equal(
    simulatedWrongIds.every((wId) => resetIds.has(wId)),
    true,
    "Döngü sıfırlanırken daha önce yanlış yapılan sorular öncelikle sınava dahil edilmelidir"
  );
  assert.equal(
    readSeenLevelExamQuestionIds("B2", cycleMem).length,
    20,
    "Döngü sıfırlandıktan sonra localStorage hafızası yeni 20 soruyla temiz başlamalıdır"
  );

  // seviye-tespit/page.tsx entegrasyonu ve şeffaf bilgi rozeti kontrolü
  assert.equal(
    seviyeTespitCode.includes("buildBalancedLevelExamQuestions") &&
      seviyeTespitCode.includes("Farklı Üst Konu") &&
      seviyeTespitCode.includes("Beceri Alanı Dengeli"),
    true,
    "seviye-tespit/page.tsx yeni akıllı Kur Sınavı motorunu ve şeffaf konu/beceri etiketini kullanmalıdır"
  );
});

test("70. Stüdyo TTS Öncesi 12 JSON Veri Tabanında Şedde+Hareke Sırası, Lafzatullah, الْاِ Hemze-i Vasıl, Atasözü CEFR (A2+) ve İ'rab Terminolojisi Doğrulaması", () => {
  const all12Files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  assert.equal(all12Files.length, 12, "src/data altında 12 JSON veri dosyası bulunmalıdır");

  const reversedShaddaRegex = /[\u064B-\u0650]\u0651/;
  const wrongLamKasraSeq = "\u0627\u0644\u0650\u0627"; // الِا
  const allahBoundaryRegex =
    /(^|[^\u0621-\u064A\u0671])([وفبتك]?[\u064B-\u0652]*)(?:ا[\u064B-\u0652]*ل[\u064B-\u0652]*ل[\u064E\u0670]*ه|ل[\u064B-\u0652]*ل[\u064E\u0670]*ه)([\u064B-\u0652]*)(?=$|[^\u0621-\u064A\u0671])/g;

  for (const fileName of all12Files) {
    const { parsed } = readDataJson(fileName);
    const entries = collectStrings(parsed);
    for (const { text, keyName } of entries) {
      if (keyName === "yanlis") continue;
      assert.equal(
        reversedShaddaRegex.test(text),
        false,
        `${fileName} içinde harekenin şeddeden önce geldiği ters dizilim kalmamalıdır: ${text.slice(0, 50)}`
      );
      assert.equal(
        text.includes(wrongLamKasraSeq),
        false,
        `${fileName} içinde lâm altında yanlış kesralı الِا dizilimi kalmamalıdır: ${text.slice(0, 50)}`
      );
      allahBoundaryRegex.lastIndex = 0;
      let m;
      while ((m = allahBoundaryRegex.exec(text)) !== null) {
        assert.equal(
          m[0].includes("\u0651"),
          true,
          `${fileName} içinde şeddesiz Lafzatullah kalmamalıdır: ${m[0]}`
        );
      }
    }
  }

  // Kasıtlı yanlış örnekler (hata_bulma ve dikkat_sik_hata.yanlis) korunmuş olmalı
  const { parsed: sts } = readDataJson("seviye_tespit_sorulari.json");
  const ktt09 = sts.find((q) => q.id === "ktt_grm_001_09");
  assert.ok(ktt09, "ktt_grm_001_09 sorusu korunmalıdır");
  assert.equal(
    ktt09.soru_metni_ar.includes("\u0627\u0644\u0652\u0634\u0651\u064E\u0645\u0652\u0633\u064F") &&
      ktt09.secenekler.some(
        (o) => o.harf === "B" && o.metin === "\u0627\u0644\u0652\u0634\u0651\u064E\u0645\u0652\u0633\u064F"
      ),
    true,
    "ktt_grm_001_09 hata_bulma sorusundaki kasıtlı الْشَّمْسُ kelimesi korunmalıdır"
  );

  const { parsed: dlgGramer } = readDataJson("diyaloglar_gramer_hap_bilgi.json");
  const byDlgG = new Map(dlgGramer.map((g) => [g.bagli_id, g]));
  assert.equal(
    byDlgG.get("dlg_041")?.ayrintili_anlatim?.dikkat_sik_hata?.yanlis.includes(
      "\u0627\u0644\u0652\u0627\u0650\u0632\u0652\u062F\u0650\u062D\u064E\u0627\u0645\u064F."
    ),
    true,
    "dlg_041 dikkat_sik_hata.yanlis içinde kasıtlı ötreli الْاِزْدِحَامُ. örneği vasl hemzesi düzeltilmiş şekilde korunmalıdır"
  );
  assert.equal(
    byDlgG.get("dlg_041")?.ayrintili_anlatim?.dikkat_sik_hata?.dogru.includes(
      "\u0627\u0644\u0652\u0627\u0650\u0632\u0652\u062F\u0650\u062D\u064E\u0627\u0645\u0650"
    ),
    true,
    "dlg_041 dikkat_sik_hata.dogru içinde الْاِزْدِحَامِ yer almalıdır"
  );

  // Med elifi (كَاَدَتْ -> كَادَتْ ve (وَاْوُ -> (وَاوُ) düzeltmeleri
  const { parsed: diyaloglar } = readDataJson("tum_diyaloglar_120.json");
  const byDlg = new Map(diyaloglar.map((d) => [d.id, d]));
  assert.equal(
    byDlg.get("dlg_103")?.satirlar[0]?.arapca.startsWith("كَادَتْ ") &&
      !JSON.stringify(byDlgG.get("dlg_103")).includes("كَاَدَتْ") &&
      JSON.stringify(byDlgG.get("dlg_103")).includes("كَادَتْ"),
    true,
    "dlg_103 içinde كَاَدَتْ -> كَادَتْ düzeltilmiş olmalıdır"
  );
  assert.equal(
    !JSON.stringify(byDlgG.get("dlg_107")).includes("(وَاْوُ") &&
      JSON.stringify(byDlgG.get("dlg_107")).includes("(وَاوُ"),
    true,
    "dlg_107 içinde (وَاْوُ -> (وَاوُ düzeltilmiş olmalıdır"
  );
  assert.equal(
    byDlg
      .get("dlg_055")
      ?.satirlar.find((s) => s.sira === 11)
      ?.arapca.includes("الْاِثْنَيْنِ"),
    true,
    "dlg_055 11. satırda الْاِثْنَيْنِ vasl hemzesiyle yazılmalıdır"
  );

  // 1111_cumle.json nokta atışı düzeltmeler
  const { parsed: cumleler } = readDataJson("1111_cumle.json");
  const byC = new Map(cumleler.map((c) => [c.id, c]));
  assert.equal(byC.get("cumle_0488")?.arapca, "اِشْهَدْنَ لِمَا أَقُولُ!");
  assert.equal(byC.get("cumle_0492")?.arapca.includes("فَاسْتَكْبَرَ"), true);
  assert.equal(byC.get("cumle_0496")?.arapca.includes("وَانْهَزَمَ"), true);
  assert.equal(
    byC.get("cumle_0257")?.arapca.includes("بِاجْتِهَادِهِن\u0651\u064E"),
    true
  );
  assert.equal(
    byC.get("cumle_0414")?.arapca.includes("الْاِقْتِصَادِي\u0651\u064Eةِ"),
    true
  );
  assert.equal(byC.get("cumle_0696")?.arapca.includes("اِقْتِرَاحًا"), true);
  assert.equal(byC.get("cumle_0957")?.arapca.includes("اِحْتِرَامَهُمْ"), true);
  assert.equal(
    byC.get("cumle_1090")?.arapca.includes("اِسْتِرَاتِيجِي\u0651\u064Eةٍ"),
    true
  );
  assert.equal(byC.get("cumle_0787")?.arapca.includes("الْاِثْنَيْنِ"), true);
  for (const id of ["cumle_0040", "cumle_0277", "cumle_0481", "cumle_0490"]) {
    assert.equal(
      byC.get(id)?.odak_kalip.includes("الاِثْنَيْنِ"),
      true,
      `${id} odak_kalip içinde الاِثْنَيْنِ bulunmalıdır`
    );
  }
  assert.equal(
    byC.get("cumle_0564")?.turkce,
    "Zulmün bütün insanlar için bir kötülük olduğunu gördüm."
  );

  // atasozleri.json düzeltmeleri ve A1 -> A2 seviye güncellemesi
  const { parsed: atasozleri } = readDataJson("atasozleri.json");
  const byAta = new Map(atasozleri.map((a) => [a.id, a]));
  assert.equal(byAta.get("ata_0003")?.arapca.startsWith("الْاِبْنُ"), true);
  assert.equal(
    byAta.get("ata_0004")?.arapca.startsWith("الْاِت\u0651\u0650حَادُ"),
    true
  );
  assert.equal(byAta.get("ata_0079")?.arapca.startsWith("الْاِعْتِرَافُ"), true);
  assert.equal(byAta.get("ata_0115")?.arapca.startsWith("الْاِنْتِظَارُ"), true);
  assert.equal(byAta.get("ata_0116")?.arapca.startsWith("اِنْتِظَارُ"), true);
  assert.equal(
    atasozleri.filter((a) => a.cefr === "A1").length,
    0,
    "atasozleri.json içinde A1 etiketli kayıt kalmamalı, tamamı en az A2 olmalıdır"
  );

  // yeni_tum_sozluk.json düzeltmeleri
  const { parsed: sozluk } = readDataJson("yeni_tum_sozluk.json");
  const bySoz = new Map(sozluk.map((k) => [k.id, k]));
  assert.equal(bySoz.get("kelime_1530")?.mufret, "اِت\u0651\u0650حَادٌ");
  assert.equal(bySoz.get("kelime_1530")?.cemi, "اِت\u0651\u0650حَادَاتٌ");
  assert.equal(bySoz.get("kelime_1621")?.mufret, "اِسْتِرَاتِيجِي\u0651\u064Eةٌ");
  assert.equal(bySoz.get("kelime_1621")?.cemi, "اِسْتِرَاتِيجِي\u0651\u064Eاتٌ");

  // Cemi müennes sâlim i'rab terminolojisi netliği
  const { parsed: metinGramer } = readDataJson("metinler_gramer_hap_bilgi.json");
  const byMetG = new Map(metinGramer.map((g) => [g.bagli_id, g]));
  assert.equal(
    JSON.stringify(byDlgG.get("dlg_074")).includes(
      "fetha yerine kesra ile mansûb (nasb alâmeti kesra)"
    ),
    true
  );
  for (const mId of ["metin_53", "metin_57", "metin_59"]) {
    assert.equal(
      JSON.stringify(byMetG.get(mId)).includes(
        "fetha yerine kesra ile mansûb (nasb alâmeti kesra)"
      ),
      true,
      `${mId} içinde cemi müennes sâlim nasb açıklaması netleştirilmiş olmalıdır`
    );
  }
});

test("71. Saf ASCII Kaçış Yaması & ignoreBuildErrors: false, normalizeArabicForTtsAndNlp Katmanı, Genişletilmiş simplifyGrammarTerminology ve Güvenilir Proxy IP / Payload Koruması", async () => {
  const { pathToFileURL } = await import("node:url");

  // 1) assessment.ts satır 539 saf ASCII kaçışı ve next.config.ts ignoreBuildErrors: false
  const assessmentRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "types", "assessment.ts"),
    "utf8"
  );
  const line539 = assessmentRaw.split(/\r?\n/)[538];
  assert.equal(
    line539.trim(),
    'icon: known?.icon || "\\u{1F3DB}\\uFE0F",',
    "assessment.ts 539. satırda ham emoji baytı yerine saf ASCII kaçış dizisi bulunmalıdır"
  );
  assert.equal(
    /^[\x00-\x7F]+$/.test(line539),
    true,
    "assessment.ts 539. satırı yalnızca 7-bit saf ASCII karakterlerden oluşmalıdır"
  );

  const { buildDynamicAssessmentTopics } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "types", "assessment.ts")).href
  );
  const sampleDynamic = buildDynamicAssessmentTopics([
    {
      id: "test_unknown_topic",
      seviye: "B1",
      zorluk_basamagi: 2,
      ust_konu: "Özel Yeni Konu",
      alt_grup: "Alt Grup",
      beceri_alani: "sarf_nahiv",
      soru_tipi: "bosluk_doldurma",
      soru_yonergesi_tr: "Yönerge",
      soru_metni_ar: "كَتَبَ",
      secenek_dili: "ar",
      secenekler: [
        { harf: "A", metin: "أ" },
        { harf: "B", metin: "ب" },
        { harf: "C", metin: "ج" },
        { harf: "D", metin: "د" },
      ],
      dogru_secenek: "A",
    },
  ]);
  assert.equal(sampleDynamic[0]?.icon, "🏛️");

  const nextConfigCode = fs.readFileSync(
    path.join(ROOT_DIR, "next.config.ts"),
    "utf8"
  );
  assert.equal(
    nextConfigCode.includes("ignoreBuildErrors: false") &&
      !nextConfigCode.includes("ignoreBuildErrors: true"),
    true,
    "next.config.ts içinde ignoreBuildErrors: false etkin olmalıdır"
  );

  // 2) normalizeArabicForTtsAndNlp (6 adımlı fonetik/imlâ katmanı), serverTts, audio ve /api/tts 500 karakter sınırı
  const {
    normalizeArabicForTtsAndNlp,
    simplifyGrammarTerminology,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "arabicTextUtils.ts")).href
  );

  assert.equal(
    normalizeArabicForTtsAndNlp("\u0644\u0627\u064E"),
    "\u0644\u064E\u0627",
    "Lâm-Elif ligatüründe med elifi üzerine kaymış fetha düzeltilmelidir"
  );
  assert.equal(
    normalizeArabicForTtsAndNfcCheck(normalizeArabicForTtsAndNlp("كَاَدَتْ")),
    "كَادَتْ",
    "Med elifi üzerindeki yanlış fetha (كَاَدَتْ -> كَادَتْ) düzeltilmelidir"
  );
  assert.equal(
    normalizeArabicForTtsAndNlp("مُعَل\u0650\u0651مٌ"),
    "مُعَل\u0651\u0650مٌ",
    "Haraka + şedde ters dizilimi (\u0650\u0651 -> \u0651\u0650) düzeltilmelidir"
  );
  assert.equal(
    normalizeArabicForTtsAndNlp("الط\u064F\u064F\u0651ر\u064F\u064Fق\u0650"),
    "الط\u0651\u064Fر\u064Fق\u0650",
    "Üst üste binmiş aynı harekeler tekilleştirilmelidir"
  );
  assert.equal(
    normalizeArabicForTtsAndNlp("الْش\u064E\u0651مْسُ فِي الِاسْتِقْبَالِ"),
    "الش\u0651\u064Eمْسُ فِي الْاِسْتِقْبَالِ",
    "Şemsî harf öncesi yanlış lâm sükûnu temizlenmeli ve الِا -> الْاِ düzeltilmelidir"
  );
  assert.equal(
    normalizeArabicForTtsAndNlp("بِاللهِ وَالحَمْدُ للهِ لِلْهُدُوءِ"),
    "بِالل\u0651\u064Eهِ وَالحَمْدُ لِل\u0651\u064Eهِ لِلْهُدُوءِ",
    "Şeddesiz الله / بالله / لله lafızları şeddeli اللَّه biçimine tamamlanmalı, لِلْهُدُوءِ korunmalıdır"
  );

  function normalizeArabicForTtsAndNfcCheck(v) {
    return v;
  }

  const serverTtsCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "serverTts.ts"),
    "utf8"
  );
  const audioCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "audio.ts"),
    "utf8"
  );
  const ttsRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "tts", "route.ts"),
    "utf8"
  );

  assert.equal(
    serverTtsCode.includes("normalizeArabicForTtsAndNlp") &&
      serverTtsCode.includes(
        'const ttsspeed = rate <= 0.75 ? "0.24" : rate < 0.95 ? "0.6" : "1";'
      ),
    true,
    "serverTts.ts normalizeArabicForTtsAndNlp kullanmalı ve 3 kademeli ttsspeed hız duyarlılığına sahip olmalıdır"
  );
  assert.equal(
    audioCode.includes("normalizeArabicForTtsAndNlp"),
    true,
    "audio.ts TTS motoruna gönderilen Arapça metinleri normalizeArabicForTtsAndNlp üzerinden geçirmelidir"
  );
  assert.equal(
    ttsRouteCode.includes("MAX_TTS_TEXT_LENGTH = 500") &&
      ttsRouteCode.includes("rawText.length > MAX_TTS_TEXT_LENGTH") &&
      ttsRouteCode.includes("normalizeArabicForTtsAndNlp"),
    true,
    "/api/tts/route.ts 500 karakter üst sınırını güvenli şekilde kontrol etmelidir"
  );

  // 3) simplifyGrammarTerminology genişletilmiş kurallar ve mükerrer parantez temizliği
  assert.equal(simplifyGrammarTerminology("Mef'ûlün Fîh"), "Zaman/Yer Zarfı");
  assert.equal(simplifyGrammarTerminology("Mef'ûlün fîh"), "Zaman/Yer Zarfı");
  assert.equal(
    simplifyGrammarTerminology("Mef'ûlün Fîh (Zaman/Yer Zarfı)"),
    "Zaman/Yer Zarfı"
  );
  assert.equal(
    simplifyGrammarTerminology("Zaman/Yer Zarfı (zaman/yer zarfı)"),
    "Zaman/Yer Zarfı"
  );
  assert.equal(
    simplifyGrammarTerminology("Mef'ûl-i Mutlak ve Mef'ûlün Mutlak"),
    "Pekiştirme Mastarı ve Pekiştirme Mastarı"
  );
  assert.equal(
    simplifyGrammarTerminology("Mef'ûlün Li-eclih veya Mef'ûlün له"),
    "Sebep Bildiren Tümleç veya Sebep Bildiren Tümleç"
  );
  assert.equal(
    simplifyGrammarTerminology("Sâhibu'l-Hâl"),
    "Durumu Belirtilen İsim"
  );
  assert.equal(
    simplifyGrammarTerminology("Gayr-ı Munsarif / Gayri Munsarif"),
    "Tenvin ve Esre Almayan İsim / Tenvin ve Esre Almayan İsim"
  );
  assert.equal(
    simplifyGrammarTerminology(
      "Tenvin ve Esre Almayan İsim (tenvin ve esre almayan isim)"
    ),
    "Tenvin ve Esre Almayan İsim"
  );

  // 4) getClientIp güvenli proxy başlık önceliği + 128 karakter sınırı ve POST gövde boyutu korumaları
  const { getClientIp, MAX_CLIENT_IP_LENGTH } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "apiRateLimit.ts")).href
  );
  assert.equal(MAX_CLIENT_IP_LENGTH, 128);

  const reqVercelWins = new Request("https://example.com/api/test", {
    headers: {
      "x-vercel-forwarded-for": "198.51.100.11, 10.0.0.1",
      "x-real-ip": "198.51.100.22",
      "cf-connecting-ip": "198.51.100.33",
      "x-forwarded-for": "198.51.100.44",
    },
  });
  assert.equal(getClientIp(reqVercelWins), "198.51.100.11");

  const reqRealIpWins = new Request("https://example.com/api/test", {
    headers: {
      "x-real-ip": "198.51.100.22",
      "cf-connecting-ip": "198.51.100.33",
      "x-forwarded-for": "198.51.100.44",
    },
  });
  assert.equal(getClientIp(reqRealIpWins), "198.51.100.22");

  const reqCfWins = new Request("https://example.com/api/test", {
    headers: {
      "cf-connecting-ip": "2001:db8::abcd",
      "x-forwarded-for": "198.51.100.44",
    },
  });
  assert.equal(getClientIp(reqCfWins), "2001:db8::abcd");

  const overlongSpoof = "1".repeat(140) + ".1.1.1";
  const reqXffFiltered = new Request("https://example.com/api/test", {
    headers: {
      "x-forwarded-for": `${overlongSpoof}, invalid_script<>, 203.0.113.77`,
    },
  });
  assert.equal(getClientIp(reqXffFiltered), "203.0.113.77");

  const adminRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "admin", "route.ts"),
    "utf8"
  );
  const feedbackRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "feedback", "route.ts"),
    "utf8"
  );
  const statsRouteCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "api", "stats", "route.ts"),
    "utf8"
  );

  for (const [label, code] of [
    ["/api/admin", adminRouteCode],
    ["/api/feedback", feedbackRouteCode],
    ["/api/stats", statsRouteCode],
  ]) {
    assert.equal(
      code.includes('req.headers.get("content-length")') &&
        code.includes("Buffer.byteLength(") &&
        code.includes("status: 413") &&
        code.includes("getClientIp"),
      true,
      `${label} POST ucu content-length / Buffer.byteLength gövde boyutu üst sınırına (413) ve getClientIp çözümlemesine sahip olmalıdır`
    );
  }
});

// ============================================================================
// DENETİM PAKETİ: 6 ÇEKİRDEK DOĞRULAMA TESTİ (Sıfır Dış Bağımlılık)
// ============================================================================

test("72. [Denetim 1/6] UTF-8 Bütünlük Testi: src/ ve src/data/ altındaki tüm .ts, .tsx, .json, .css dosyaları Buffer.toString('utf8') ve surrogate kontrolünden sıfır hatayla geçmelidir", () => {
  function collectSourceFiles(dirPath, acc = []) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        collectSourceFiles(fullPath, acc);
      } else if (/\.(ts|tsx|json|css)$/.test(entry.name)) {
        acc.push(fullPath);
      }
    }
    return acc;
  }

  const srcDir = path.join(ROOT_DIR, "src");
  const allFiles = collectSourceFiles(srcDir);
  const assessmentPath = path.join(srcDir, "types", "assessment.ts");
  assert.ok(
    allFiles.includes(assessmentPath),
    "src/types/assessment.ts taranan dosyalar arasında yer almalıdır"
  );
  assert.ok(
    allFiles.length >= 120,
    "src/ ve src/data/ altındaki tüm kaynak ve veri dosyaları taranmalıdır"
  );

  const utf8Errors = [];
  for (const filePath of allFiles) {
    const rawBuf = fs.readFileSync(filePath);
    const decoded = rawBuf.toString("utf8");
    const relPath = path.relative(ROOT_DIR, filePath);

    if (decoded.includes("\uFFFD")) {
      utf8Errors.push(`${relPath}: U+FFFD replacement karakteri tespit edildi`);
    }
    if (!Buffer.from(decoded, "utf8").equals(rawBuf)) {
      utf8Errors.push(`${relPath}: Geçersiz CESU-8 / UTF-8 bayt dizisi tespit edildi`);
    }
    for (let i = 0; i < decoded.length; i++) {
      const code = decoded.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = decoded.charCodeAt(i + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) {
          utf8Errors.push(`${relPath}: Eşleşmemiş high surrogate (index ${i})`);
        } else {
          i++;
        }
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        utf8Errors.push(`${relPath}: Eşleşmemiş low surrogate (index ${i})`);
      }
    }
  }

  assert.deepEqual(
    utf8Errors,
    [],
    `UTF-8 veya surrogate hatası bulunmamalıdır: ${utf8Errors.join(" | ")}`
  );
});

test("73. [Denetim 2/6] 12 JSON Veri Tabanı Sayım ve Benzersiz ID Testi (120 diyalog, 60 metin, 1111 cümle, 508 atasözü, 998 görsel kelime, 400 eş-zıt, 1895 sözlük, 550 sınav sorusu, 195 gramer notu, 60 YouTube)", () => {
  const expectedDatasets = [
    { file: "tum_diyaloglar_120.json", count: 120, idKey: "id" },
    { file: "tum_metinler_60.json", count: 60, idKey: "id" },
    { file: "1111_cumle.json", count: 1111, idKey: "id" },
    { file: "atasozleri.json", count: 508, idKey: "id" },
    { file: "gorselKelimeler_guncel.json", count: 998, idKey: "id" },
    { file: "es_zit_anlamlilar.json", count: 400, idKey: "id" },
    { file: "yeni_tum_sozluk.json", count: 1895, idKey: "id" },
    { file: "seviye_tespit_sorulari.json", count: 550, idKey: "id" },
    { file: "diyaloglar_gramer_hap_bilgi.json", count: 120, idKey: "bagli_id" },
    { file: "metinler_gramer_hap_bilgi.json", count: 60, idKey: "bagli_id" },
    { file: "ek_gramer_hap_bilgi.json", count: 15, idKey: "bagli_id" },
    { file: "youtube_tavsiyeleri.json", count: 60, idKey: "id" },
  ];

  const actualJsonFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  assert.equal(
    actualJsonFiles.length,
    12,
    "src/data/ altında tam 12 JSON veri tabanı bulunmalıdır"
  );

  const loadedMap = new Map();
  for (const spec of expectedDatasets) {
    const { parsed } = readDataJson(spec.file);
    loadedMap.set(spec.file, parsed);
    assert.equal(
      parsed.length,
      spec.count,
      `${spec.file} tam ${spec.count} kayıt içermelidir`
    );

    const idSet = new Set();
    for (const item of parsed) {
      const idVal = item[spec.idKey];
      assert.ok(
        typeof idVal === "string" && idVal.trim().length > 0,
        `${spec.file} içindeki her kaydın dolu '${spec.idKey}' alanı olmalıdır`
      );
      assert.equal(
        idSet.has(idVal),
        false,
        `${spec.file} içinde mükerrer ID bulunmamalıdır: ${idVal}`
      );
      idSet.add(idVal);
    }
  }

  // 195 gramer notunun (120 + 60 + 15) birleşik tekil ID kontrolü
  const combinedGrammar = [
    ...loadedMap.get("diyaloglar_gramer_hap_bilgi.json"),
    ...loadedMap.get("metinler_gramer_hap_bilgi.json"),
    ...loadedMap.get("ek_gramer_hap_bilgi.json"),
  ];
  assert.equal(
    combinedGrammar.length,
    195,
    "Toplam gramer notu sayısı 195 (120+60+15) olmalıdır"
  );
  assert.equal(
    new Set(combinedGrammar.map((g) => g.bagli_id)).size,
    195,
    "195 gramer notunun tamamı birleşik havuzda benzersiz bagli_id taşımalıdır"
  );

  // 120 diyalogda A1 -> A2 -> B1 -> B2 monotonik seviye ve sira (1..120) kontrolü
  const cefrOrder = { A1: 1, A2: 2, B1: 3, B2: 4 };
  const dialogues = loadedMap.get("tum_diyaloglar_120.json");
  for (let i = 0; i < dialogues.length; i++) {
    const d = dialogues[i];
    assert.equal(
      d.sira,
      i + 1,
      `tum_diyaloglar_120.json ${d.id} sira değeri ${i + 1} olmalıdır`
    );
    assert.ok(
      cefrOrder[d.seviye] !== undefined,
      `${d.id} geçerli bir CEFR seviyesine (A1-B2) sahip olmalıdır`
    );
    if (i > 0) {
      assert.ok(
        cefrOrder[d.seviye] >= cefrOrder[dialogues[i - 1].seviye],
        `Diyalog CEFR seviyeleri A1->B2 monotonik ilerlemelidir (${dialogues[i - 1].id}:${dialogues[i - 1].seviye} -> ${d.id}:${d.seviye})`
      );
    }
  }

  // 60 okuma metninde odak_gramer tamlığı
  const readings = loadedMap.get("tum_metinler_60.json");
  for (const m of readings) {
    assert.ok(
      typeof m.odak_gramer === "string" && m.odak_gramer.trim().length > 0,
      `${m.id} okuma metninde odak_gramer alanı dolu olmalıdır`
    );
  }
});

test("74. [Denetim 3/6] Diyalog Cinsiyet & Ses Uzantısı Testi: 120 diyaloğun tüm satırlarında E/_E.mp3 ve K/_K.mp3 uyumu ile dolu arapca/turkce metinler", () => {
  const { parsed: dialogues } = readDataJson("tum_diyaloglar_120.json");
  assert.equal(dialogues.length, 120);

  for (const dlg of dialogues) {
    assert.ok(
      Array.isArray(dlg.satirlar) && dlg.satirlar.length > 0,
      `${dlg.id} en az 1 satır içermelidir`
    );
    for (const line of dlg.satirlar) {
      assert.ok(
        line.cinsiyet === "E" || line.cinsiyet === "K",
        `${dlg.id}#${line.sira} satırında cinsiyet 'E' veya 'K' olmalıdır`
      );
      const expectedSuffix = line.cinsiyet === "E" ? "_E.mp3" : "_K.mp3";
      assert.ok(
        typeof line.ses_dosyasi === "string" &&
          line.ses_dosyasi.endsWith(expectedSuffix),
        `${dlg.id}#${line.sira} ses_dosyasi (${line.ses_dosyasi}) cinsiyet (${line.cinsiyet}) ile uyumlu '${expectedSuffix}' uzantısıyla bitmelidir`
      );
      assert.ok(
        typeof line.arapca === "string" && line.arapca.trim().length > 0,
        `${dlg.id}#${line.sira} arapca alanı boş olmamalıdır`
      );
      assert.ok(
        typeof line.turkce === "string" && line.turkce.trim().length > 0,
        `${dlg.id}#${line.sira} turkce alanı boş olmamalıdır`
      );
    }
  }
});

test("75. [Denetim 4/6] 550 Sınav Sorusu Yapısal Testi: Tüm sorularda 4 benzersiz şık (A, B, C, D) ve geçerli dogru_secenek", () => {
  const { parsed: questions } = readDataJson("seviye_tespit_sorulari.json");
  assert.equal(questions.length, 550);

  const validLetters = ["A", "B", "C", "D"];
  for (const q of questions) {
    assert.ok(
      Array.isArray(q.secenekler) && q.secenekler.length === 4,
      `${q.id} tam 4 seçenek içermelidir`
    );
    const letters = q.secenekler.map((opt) => opt.harf);
    assert.deepEqual(
      letters,
      validLetters,
      `${q.id} şıkları sırasıyla A, B, C, D olmalıdır`
    );
    const optionTexts = q.secenekler.map((opt) => String(opt.metin ?? "").trim());
    assert.ok(
      optionTexts.every((t) => t.length > 0),
      `${q.id} içinde boş şık metni bulunmamalıdır`
    );
    assert.equal(
      new Set(optionTexts).size,
      4,
      `${q.id} içindeki 4 şık metni birbirinden benzersiz olmalıdır`
    );
    assert.ok(
      validLetters.includes(q.dogru_secenek),
      `${q.id} dogru_secenek değeri A, B, C veya D olmalıdır`
    );
  }
});

test("76. [Denetim 5/6] Arapça TTS/NLP Fonetik Hijyen Testi: كَاَدَتْ ve اِشْهَدْنِ kalıntılarının yokluğu ve 12 JSON'da sıfır çift hareke", () => {
  const { raw: dlgRaw } = readDataJson("tum_diyaloglar_120.json");
  assert.equal(
    dlgRaw.includes("كَاَدَتْ"),
    false,
    "tum_diyaloglar_120.json içinde hatalı med elifi harekesi (كَاَدَتْ) bulunmamalıdır"
  );

  const { raw: cumleRaw } = readDataJson("1111_cumle.json");
  assert.equal(
    cumleRaw.includes("اِشْهَدْنِ"),
    false,
    "1111_cumle.json içinde eksik yâ yazılışı (اِشْهَدْنِ) bulunmamalıdır"
  );

  const stackedHarakaRegex = /([\u064B-\u0650\u0652])\1/;
  const all12JsonFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"));
  assert.equal(all12JsonFiles.length, 12);

  for (const fileName of all12JsonFiles) {
    const { raw } = readDataJson(fileName);
    assert.equal(
      stackedHarakaRegex.test(raw),
      false,
      `${fileName} içinde üst üste binmiş aynı hareke (([\\u064B-\\u0650\\u0652])\\1) bulunmamalıdır`
    );
  }
});

test("77. [Denetim 6/6] PWA Service Worker (public/sw.js v2.2 + offlineManager uyumu) ve Envanter (exerciseModulesCount: 18) Varlık Testi", async () => {
  const vm = await import("node:vm");
  const { pathToFileURL } = await import("node:url");

  const swPath = path.join(ROOT_DIR, "public", "sw.js");
  assert.equal(fs.existsSync(swPath), true, "public/sw.js dosyası mevcut olmalıdır");
  const swSource = fs.readFileSync(swPath, "utf8");

  assert.ok(
    swSource.includes('const CACHE_NAME = "muallimun-arapca-pwa-v2.2";'),
    'public/sw.js içinde CACHE_NAME = "muallimun-arapca-pwa-v2.2" tanımlı olmalıdır'
  );
  assert.ok(
    swSource.includes('"muallimun-offline-audio-v1"') &&
      swSource.includes('"transformers-cache"') &&
      swSource.includes("PROTECTED_CACHES") &&
      swSource.includes("Promise.allSettled"),
    "public/sw.js PROTECTED_CACHES ve Promise.allSettled korumalarını içermelidir"
  );

  const offlineManagerCode = fs.readFileSync(
    path.join(ROOT_DIR, "src", "lib", "offlineManager.ts"),
    "utf8"
  );
  assert.ok(
    offlineManagerCode.includes(
      'export const OFFLINE_PWA_CACHE_NAME = "muallimun-arapca-pwa-v2.2";'
    ) &&
      offlineManagerCode.includes(
        'export const OFFLINE_AUDIO_CACHE_NAME = "muallimun-offline-audio-v1";'
      ),
    "offlineManager.ts önbellek adları public/sw.js ile %100 senkronize olmalıdır"
  );

  // Content Inventory doğrulaması
  const { CONTENT_INVENTORY } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "contentInventory.ts")).href
  );
  assert.equal(
    CONTENT_INVENTORY.exerciseModulesCount,
    18,
    "CONTENT_INVENTORY.exerciseModulesCount değeri 18 olmalıdır"
  );

  // public/sw.js çalışma zamanı (install / activate / fetch) simülasyonu
  const listeners = new Map();
  const storeByCacheName = new Map();
  let skipWaitingCalled = false;
  let clientsClaimCalled = false;
  const networkCalls = [];

  function makeCacheBucket(name) {
    if (!storeByCacheName.has(name)) {
      storeByCacheName.set(name, new Map());
    }
    const bucket = storeByCacheName.get(name);
    return {
      async add(assetUrl) {
        const key = assetUrl.startsWith("http")
          ? new URL(assetUrl).pathname
          : assetUrl;
        bucket.set(
          key,
          new Response(`precached:${key}`, { status: 200 })
        );
      },
      async put(reqOrUrl, res) {
        const key =
          typeof reqOrUrl === "string"
            ? reqOrUrl
            : new URL(reqOrUrl.url).pathname;
        bucket.set(key, res);
      },
      async match(reqOrUrl) {
        const key =
          typeof reqOrUrl === "string"
            ? reqOrUrl
            : new URL(reqOrUrl.url).pathname;
        return bucket.get(key);
      },
    };
  }

  const mockCaches = {
    async open(name) {
      return makeCacheBucket(name);
    },
    async keys() {
      return Array.from(storeByCacheName.keys());
    },
    async delete(name) {
      return storeByCacheName.delete(name);
    },
    async match(reqOrUrl) {
      for (const bucket of storeByCacheName.values()) {
        const key =
          typeof reqOrUrl === "string"
            ? reqOrUrl
            : new URL(reqOrUrl.url).pathname;
        if (bucket.has(key)) return bucket.get(key);
      }
      return undefined;
    },
  };

  let simulateOffline = false;
  const mockFetch = async (req) => {
    const reqUrl = typeof req === "string" ? req : req.url;
    networkCalls.push(reqUrl);
    if (simulateOffline) {
      throw new Error("Network offline");
    }
    return new Response(`network:${reqUrl}`, { status: 200 });
  };

  const sandbox = {
    URL,
    Response,
    Promise,
    caches: mockCaches,
    fetch: mockFetch,
    self: {
      location: { origin: "https://app.muallimun.net" },
      addEventListener(type, fn) {
        listeners.set(type, fn);
      },
      skipWaiting() {
        skipWaitingCalled = true;
        return Promise.resolve();
      },
      clients: {
        claim() {
          clientsClaimCalled = true;
          return Promise.resolve();
        },
      },
    },
  };
  vm.runInNewContext(swSource, sandbox);

  // 1) install olayı testi
  let installPromise;
  listeners.get("install")({
    waitUntil(p) {
      installPromise = p;
    },
  });
  await installPromise;
  assert.equal(skipWaitingCalled, true, "install sonunda self.skipWaiting() çağrılmalıdır");
  const shellBucket = storeByCacheName.get("muallimun-arapca-pwa-v2.2");
  for (const requiredRoute of [
    "/",
    "/offline",
    "/kutuphane",
    "/alistirmalar",
    "/sozluk",
    "/seviye-tespit",
    "/ayarlar",
    "/fonts/Arakom.ttf",
  ]) {
    assert.equal(
      shellBucket.has(requiredRoute),
      true,
      `install aşamasında ${requiredRoute} önbelleğe alınmalıdır`
    );
  }

  // 2) activate olayı: eski önbelleği silmeli, PROTECTED_CACHES önbelleklerine ASLA dokunmamalı
  await mockCaches.open("muallimun-arapca-pwa-v2.1");
  const audioCache = await mockCaches.open("muallimun-offline-audio-v1");
  await audioCache.put(
    "/sesler/diyaloglar/dlg_001/satir_01_E.mp3",
    new Response("cached-mp3-bytes", { status: 200 })
  );
  await mockCaches.open("transformers-cache");

  let activatePromise;
  listeners.get("activate")({
    waitUntil(p) {
      activatePromise = p;
    },
  });
  await activatePromise;
  assert.equal(clientsClaimCalled, true, "activate sonunda self.clients.claim() çağrılmalıdır");
  assert.equal(
    storeByCacheName.has("muallimun-arapca-pwa-v2.1"),
    false,
    "Eski PWA kabuk önbelleği activate sırasında silinmelidir"
  );
  assert.equal(
    storeByCacheName.has("muallimun-offline-audio-v1") &&
      storeByCacheName.has("transformers-cache"),
    true,
    "PROTECTED_CACHES (muallimun-offline-audio-v1 ve transformers-cache) kesinlikle korunmalıdır"
  );

  // 3) fetch olayı testleri (/api/* bypass, /sesler/* cache-first, navigate offline fallback)
  async function dispatchFetch(urlStr, opts = {}) {
    let responded = null;
    listeners.get("fetch")({
      request: {
        url: urlStr,
        method: opts.method || "GET",
        mode: opts.mode || "cors",
        headers: { get: () => null },
      },
      respondWith(p) {
        responded = p;
      },
    });
    return responded ? await responded : null;
  }

  networkCalls.length = 0;
  const apiRes = await dispatchFetch("https://app.muallimun.net/api/tts", {
    method: "POST",
  });
  assert.equal(await apiRes.text(), "network:https://app.muallimun.net/api/tts");
  assert.equal(networkCalls.length, 1, "/api/tts POST isteği doğrudan ağa yönlendirilmelidir");

  networkCalls.length = 0;
  const cachedAudioRes = await dispatchFetch(
    "https://app.muallimun.net/sesler/diyaloglar/dlg_001/satir_01_E.mp3"
  );
  assert.equal(await cachedAudioRes.text(), "cached-mp3-bytes");
  assert.equal(
    networkCalls.length,
    0,
    "/sesler/* isteği muallimun-offline-audio-v1 içinde varsa ağa çıkmadan cache-first dönmelidir"
  );

  simulateOffline = true;
  const offlineNavRes = await dispatchFetch(
    "https://app.muallimun.net/diyalog/dlg_999",
    { mode: "navigate" }
  );
  assert.equal(
    await offlineNavRes.text(),
    "precached:/offline",
    "İnternet yokken önbellekte bulunmayan sayfa navigasyonu /offline sayfasına düşmelidir"
  );
});

test("78. 360px Mobil Ekran Ergonomisi (IrabColorPainter & ReadingEvidenceHunter), Sözlük/Video Envanter Tutarlılığı (1895 vs 3225, 60=20+40) ve Ters Karma Aralık (start > end) Koruması", async () => {
  const { pathToFileURL } = await import("node:url");

  // 1) IrabColorPainter ve ReadingEvidenceHunter 360px dar ekran kontrolleri
  const irabSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "IrabColorPainter.tsx"),
    "utf8"
  );
  assert.ok(
    irabSrc.includes("flex flex-wrap gap-1.5") &&
      irabSrc.includes("px-2.5 py-1.5"),
    "IrabColorPainter 5 renkli fırça çubuğu ve üst barı 360px ekranlar için flex-wrap gap-1.5 ve px-2.5 py-1.5 kompakt boşluk içermelidir"
  );

  const evidenceSrc = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "exercises",
      "ReadingEvidenceHunter.tsx"
    ),
    "utf8"
  );
  assert.ok(
    evidenceSrc.includes("w-6 h-6 shrink-0") &&
      evidenceSrc.includes("w-8 h-8 shrink-0") &&
      evidenceSrc.includes("flex flex-wrap items-center gap-1.5") &&
      evidenceSrc.includes("flex-1 min-w-0 break-words"),
    "ReadingEvidenceHunter satır numarası (w-6 h-6 shrink-0), ses butonu (w-8 h-8 shrink-0) ve üst barı (flex-wrap gap-1.5) 360px uyumlu olmalıdır"
  );

  // 2) contentInventory.ts, kutuphane/page.tsx, GuideAndInfoModalBody.tsx ve OnboardingTourModal.tsx tutarlılığı
  const { CONTENT_INVENTORY } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "contentInventory.ts")).href
  );
  assert.equal(CONTENT_INVENTORY.coreDictionaryWordsCount, 1895);
  assert.equal(CONTENT_INVENTORY.dictionaryWordsCount, 3224);
  assert.equal(CONTENT_INVENTORY.youtubeVideosCount, 60);
  assert.equal(CONTENT_INVENTORY.youtubeSingleVideosCount, 20);
  assert.equal(CONTENT_INVENTORY.youtubePlaylistsCount, 40);
  assert.equal(
    CONTENT_INVENTORY.youtubeSingleVideosCount +
      CONTENT_INVENTORY.youtubePlaylistsCount,
    CONTENT_INVENTORY.youtubeVideosCount
  );
  assert.equal(CONTENT_INVENTORY.exerciseModulesCount, 18);

  const kutuphaneSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const guideSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    "utf8"
  );
  const tourSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "OnboardingTourModal.tsx"),
    "utf8"
  );

  assert.equal(
    kutuphaneSrc.includes("55 KAYIT"),
    false,
    "kutuphane/page.tsx içinde eski '55 KAYIT' ifadesi kalmamalıdır"
  );
  for (const [label, src] of [
    ["kutuphane/page.tsx", kutuphaneSrc],
    ["GuideAndInfoModalBody.tsx", guideSrc],
    ["OnboardingTourModal.tsx", tourSrc],
  ]) {
    assert.ok(
      src.includes("CONTENT_INVENTORY.coreDictionaryWordsCount") &&
        src.includes("CONTENT_INVENTORY.dictionaryWordsCount") &&
        src.includes("CONTENT_INVENTORY.youtubeVideosCount") &&
        src.includes("CONTENT_INVENTORY.youtubeSingleVideosCount") &&
        src.includes("CONTENT_INVENTORY.youtubePlaylistsCount") &&
        src.includes("CONTENT_INVENTORY.exerciseModulesCount"),
      `${label} sözlük (1895 vs 3225), YouTube (60 = 20 + 40) ve 18 modül sayılarını CONTENT_INVENTORY üzerinden dinamik okumalıdır`
    );
  }

  // 3) a4ExamStudioEngine.ts ters aralık (start > end) koruması
  const {
    clampStudioRangeBounds,
    resolveStudioMaterialBundle,
    buildSixSectionExamData,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "a4ExamStudioEngine.ts"))
      .href
  );

  assert.deepEqual(clampStudioRangeBounds(120, 15, 5), { start: 5, end: 15 });
  assert.deepEqual(clampStudioRangeBounds(60, 999, -4), { start: 1, end: 60 });

  for (const sourceId of [
    "diyaloglar",
    "metinler",
    "gorsel_kelimeler",
    "cumleler_1111",
    "atasozleri",
    "es_zit_anlamlilar",
  ]) {
    const reversedBundle = resolveStudioMaterialBundle({
      sourceId,
      levelFilter: "all",
      packId: "range::18::6",
      selectionMode: "range",
      rangeStart: 18,
      rangeEnd: 6,
    });
    assert.ok(
      reversedBundle.vocabCandidates.length > 0 &&
        reversedBundle.dialogue.satirlar.length > 0,
      `${sourceId} için start > end (18 > 6) girildiğinde boş materyal/soru listesi oluşmamalıdır`
    );

    const examData = buildSixSectionExamData({
      bundle: reversedBundle,
      counts: {
        sec1ArToTr: 5,
        sec2TrToAr: 5,
        sec3FillBlank: 5,
        sec4MultipleChoice: 5,
        sec5Matching: 5,
        sec6Morphology: 5,
      },
      bookletGroup: "A",
    });
    const totalQuestions =
      examData.sec1ArToTr.length +
      examData.sec2TrToAr.length +
      examData.sec3FillBlank.length +
      examData.sec4MultipleChoice.length +
      examData.sec5Matching.length +
      examData.sec6Morphology.length;
    assert.ok(
      totalQuestions > 0,
      `${sourceId} ters aralıkta (18 > 6) sıfırdan büyük soru üretmelidir`
    );
  }
});

test("79. Mobil Alt Navigasyon (MobileNav) Güvenli Boşluğu, Kütüphane Üst/Alt Mobil Ergonomisi ve Balon Safarisi Çarpışmasız 3 Atmosferli Panoramik Ufuk Doğrulaması", async () => {
  const layoutSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );
  const kutuphaneSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "kutuphane", "page.tsx"),
    "utf8"
  );
  const balloonSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );

  // 1) layout.tsx <main> alt boşluğu ve kutuphane/page.tsx alt/üst mobil düzeni
  assert.ok(
    layoutSrc.includes(
      "pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8"
    ),
    "layout.tsx içindeki <main> etiketi MobileNav arkasında kart/buton kalmaması için pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8 içermelidir"
  );
  assert.ok(
    kutuphaneSrc.includes("grid grid-cols-1 sm:flex") &&
      kutuphaneSrc.includes("İnteraktif Kök Sözlüğü") &&
      kutuphaneSrc.includes("Kütüphane Havuzuyla Alıştırma Yap") &&
      kutuphaneSrc.includes("hidden sm:flex w-10 h-10") &&
      kutuphaneSrc.includes("line-clamp-1") &&
      kutuphaneSrc.includes("h-9 px-2.5 sm:px-3 rounded-xl bg-[#6741D9]") &&
      kutuphaneSrc.includes('aria-label="Sekmeleri sola kaydır"') &&
      kutuphaneSrc.includes('aria-label="Sekmeleri sağa kaydır"') &&
      kutuphaneSrc.includes('mobileLabel: "🏛️ Vitrin"') &&
      kutuphaneSrc.includes('mobileLabel: "❤️ Defterim"') &&
      kutuphaneSrc.includes('mobileLabel: "🎯 Mahreç"'),
    "kutuphane/page.tsx mobil üst başlık kompaktlığını, ‹/› sekme kaydırma butonlarını, kısa mobil sekme etiketlerini ve tam genişlikli alt özet butonlarını içermelidir"
  );

  // 2) BalloonSafariGame klip-art temizliği ve 3 atmosferli panoramik ufuk + HUD atmosfer değiştirici
  assert.equal(
    balloonSrc.includes("fence_l_") ||
      balloonSrc.includes("flower_") ||
      balloonSrc.includes("pine_") ||
      balloonSrc.includes("safariRiverGrad") ||
      balloonSrc.includes("translate(-290, 240)"),
    false,
    "BalloonSafariGame içinden eski sivri dağ, çit, nehir, papatya ve translate(-290, 240) kalıntıları tamamen kaldırılmış olmalıdır"
  );
  assert.ok(
    balloonSrc.includes("safariSkyGrad") &&
      balloonSrc.includes("safariSunsetSkyGrad") &&
      balloonSrc.includes("safariNightSkyGrad") &&
      balloonSrc.includes("safariCrescentMask") &&
      balloonSrc.includes("handleCycleAtmosphere") &&
      balloonSrc.includes("Otomatik"),
    "BalloonSafariGame 3 atmosferli (day/sunset/night) panoramik ufuk manzarasını ve HUD atmosfer değiştirici butonu içermelidir"
  );

  // 3) Aynı dalgadaki balonların birebir aynı hızı (uniformSpeedX) ve kademeli zikzak mesafeleri
  const {
    SAFARI_DESKTOP_STAGE,
    SAFARI_PORTRAIT_STAGE,
    computeSafariWavePlacements,
    resolveSafariAtmosphere,
  } = await import(
    pathToFileURL(
      path.join(ROOT_DIR, "src", "lib", "balloonSafariLayout.ts")
    ).href
  );

  assert.equal(SAFARI_DESKTOP_STAGE.minY, 165);
  assert.equal(SAFARI_DESKTOP_STAGE.maxY, 415);
  assert.equal(SAFARI_DESKTOP_STAGE.horizontalSpacing, 235);
  assert.equal(SAFARI_PORTRAIT_STAGE.minY, 185);
  assert.equal(SAFARI_PORTRAIT_STAGE.maxY, 610);
  assert.equal(SAFARI_PORTRAIT_STAGE.horizontalSpacing, 210);

  const mobileWave3 = computeSafariWavePlacements({
    isPortraitMobile: true,
    count: 3,
    baseSpeed: 90,
    roundNum: 5,
  });
  assert.equal(mobileWave3[0].speedX, mobileWave3[1].speedX);
  assert.equal(mobileWave3[1].speedX, mobileWave3[2].speedX);
  assert.equal(mobileWave3[1].x - mobileWave3[0].x, 210);
  assert.ok(Math.abs(mobileWave3[1].baseY - mobileWave3[0].baseY) >= 200);
  assert.ok(Math.abs(mobileWave3[2].baseY - mobileWave3[1].baseY) >= 200);

  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 2, isDarkTheme: false }),
    "day"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 3, isDarkTheme: false }),
    "sunset"
  );
  assert.equal(
    resolveSafariAtmosphere({ mode: "auto", level: 5, isDarkTheme: false }),
    "night"
  );
});

test("80. Görsel Oyunlar (BalloonSafariGame, MemoryFlipGame, VisualSwipeSprintGame) Mobil Başlatma Ekranı Üst/Alt Ezilme Onarımı (items-start + my-auto + safe-area)", () => {
  const balloonSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );
  const memorySrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "MemoryFlipGame.tsx"),
    "utf8"
  );
  const swipeSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "VisualSwipeSprintGame.tsx"),
    "utf8"
  );

  // 1) Hiçbir oyunun dikey kaydırılabilir (overflow-y-auto) ana gövdesinde üst kısmı kesen items-center kalmamalı; items-start justify-center + my-auto + safe-area alt boşluğu bulunmalı
  const safeScrollPattern =
    "flex-1 min-h-0 overflow-y-auto flex items-start justify-center p-2.5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]";
  assert.ok(
    balloonSrc.includes(safeScrollPattern) &&
      !balloonSrc.includes("overflow-y-auto flex items-center justify-center") &&
      balloonSrc.includes("my-auto w-full max-w-3xl") &&
      balloonSrc.includes("my-auto w-full max-w-4xl"),
    "BalloonSafariGame menu ve gameover ekranlarında items-start justify-center + my-auto + safe-area alt boşluğu kullanılmalıdır"
  );

  assert.ok(
    memorySrc.includes(safeScrollPattern) &&
      !memorySrc.includes("overflow-y-auto flex items-center justify-center") &&
      memorySrc.includes("my-auto w-full max-w-5xl") &&
      memorySrc.includes("my-auto w-full max-w-4xl"),
    "MemoryFlipGame menu ve finished ekranlarında items-start justify-center + my-auto + safe-area alt boşluğu kullanılmalıdır"
  );

  assert.ok(
    swipeSrc.includes(
      "flex-1 min-h-0 w-full overflow-y-auto flex items-start justify-center p-2.5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    ) &&
      swipeSrc.includes("my-auto w-full max-w-xl flex flex-col items-center"),
    "VisualSwipeSprintGame ready ekranında items-start justify-center + my-auto + safe-area alt boşluğu kullanılmalıdır"
  );

  // 2) BalloonSafariGame mobil üst başlık kompaktlığı ve başlatma kartı sıkı boşlukları
  assert.ok(
    balloonSrc.includes("pt-[max(0.5rem,env(safe-area-inset-top))] px-3 sm:px-6 py-2") &&
      balloonSrc.includes("Görsel Kelime") &&
      balloonSrc.includes('<span className="sm:hidden">✕ Çıkış</span>') &&
      balloonSrc.includes('<span className="hidden sm:inline">✕ Çıkış / Listeye Dön</span>') &&
      balloonSrc.includes("p-3 sm:p-6 shadow-xl space-y-3 sm:space-y-5") &&
      balloonSrc.includes("p-2.5 sm:p-3.5 rounded-2xl") &&
      balloonSrc.includes("mb-1 rounded-2xl bg-[#087F5B]"),
    "BalloonSafariGame mobil üst başlığı kısa '✕ Çıkış' / '🖼️ 998 Görsel Kelime' etiketlerini ve kompakt başlatma kartı aralıklarını içermelidir"
  );
});

test("81. Premium 2 Sütunlu Bento OpenGraph Kartı (v2.5 Satori Uyumluluğu) ve WhatsApp/Telegram Önbellek Kırıcı (/opengraph-image?v=2.5) Doğrulaması", () => {
  const ogSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "opengraph-image.tsx"),
    "utf8"
  );
  const layoutSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "layout.tsx"),
    "utf8"
  );

  // 1) Satori kuralları: CSS Grid kesinlikle bulunmamalı ve her <div ...> elemanında display: "flex" yer almalı
  assert.equal(
    /display\s*:\s*["']grid["']|gridTemplateColumns/u.test(ogSrc),
    false,
    "opengraph-image.tsx içinde Satori'nin desteklemediği CSS Grid kullanılmamalıdır"
  );
  const divBlocks = ogSrc.match(/<div[\s\S]*?>/gu) || [];
  assert.ok(divBlocks.length >= 12, "Bento OG kartı çoklu flex kapsayıcıları içermelidir");
  for (const tag of divBlocks) {
    assert.ok(
      /display\s*:\s*["']flex["']/u.test(tag),
      `Her <div> etiketi Satori kuralı gereği display: "flex" içermelidir: ${tag}`
    );
  }

  // 2) Bento Vitrin içeriği, renkleri, CONTENT_INVENTORY bağlantıları ve alt/üst şerit metinleri
  assert.ok(
    ogSrc.includes("linear-gradient(135deg, #042F2E 0%, #064E3B 48%, #1E1B4B 100%)") &&
      ogSrc.includes("linear-gradient(135deg, #FDFBF7 0%, #F7EFE1 65%, #ECFDF5 100%)") &&
      ogSrc.includes("MUALLİMUN ARAPÇA EĞİTİM PLATFORMU") &&
      ogSrc.includes("🌐 app.muallimun.net") &&
      ogSrc.includes("CEFR A1 • A2 • B1 • B2") &&
      ogSrc.includes("✨ v2.5 Tam Sürüm") &&
      ogSrc.includes("İnteraktif Dil, Telaffuz, Oyun &amp; Sınav Stüdyosu") &&
      ogSrc.includes("🎙️ Canlı Gölgeleme & STT Analizi") &&
      ogSrc.includes("İnteraktif Oyun & Alıştırma") &&
      ogSrc.includes("🖨️ 2 Sütunlu A4 PDF Sınav Stüdyosu") &&
      ogSrc.includes("Seçkin Video & İzleme Rehberi") &&
      ogSrc.includes("Sesli Diyalog") &&
      ogSrc.includes("Okuma Metni") &&
      ogSrc.includes("Kalıp Cümle") &&
      ogSrc.includes("Gramer Atlası") &&
      ogSrc.includes("Görsel Kelime") &&
      ogSrc.includes("Sınav Sorusu") &&
      ogSrc.includes("CONTENT_INVENTORY.dictionaryWordsCount") &&
      ogSrc.includes("Kelimelik Kök Sözlüğü") &&
      ogSrc.includes("Ücretsiz • Reklamsız • Akıllı Tahta &amp; Mobil Uyumlu"),
    "opengraph-image.tsx tüm v2.5 Bento Vitrin bölümlerini ve CONTENT_INVENTORY sabitlerini eksiksiz içermelidir"
  );

  // 3) layout.tsx içinde hem openGraph.images hem twitter.images için '/opengraph-image?v=2.5' önbellek kırıcı URL kontrolü
  const cacheBustMatches = layoutSrc.match(/\/opengraph-image\?v=2\.5/gu) || [];
  assert.equal(
    cacheBustMatches.length,
    2,
    "layout.tsx içinde openGraph.images ve twitter.images adresleri '/opengraph-image?v=2.5' olarak güncellenmiş olmalıdır"
  );
});

test("82. Spark-TTS Öncesi 26 İnce Şemsî Şedde, İsm-i Mevsûl (الَّتِي) ve Şemsî Lâm Sükûnu Fonetik Düzeltmeleri Doğrulaması", () => {
  const diyalogRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "tum_diyaloglar_120.json"),
    "utf8"
  );
  const metinRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "tum_metinler_60.json"),
    "utf8"
  );
  const ataRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "atasozleri.json"),
    "utf8"
  );
  const cumleRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "1111_cumle.json"),
    "utf8"
  );
  const gorselRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "gorselKelimeler_guncel.json"),
    "utf8"
  );

  // 1) tum_diyaloglar_120.json (5 kayıt)
  for (const oldForm of [
    "وَالر\u064Fوحِ",
    "الت\u064Fرْكِي\u0651\u0650",
    "الش\u064Fجَاعُ",
    "الش\u064Eرِكَةُ",
    "الز\u064Fبُونَ",
    "الش\u064Fرَكَاءُ",
    "الش\u064Eرِكَةِ",
  ]) {
    assert.equal(
      diyalogRaw.includes(oldForm),
      false,
      `tum_diyaloglar_120.json içinde şeddesiz '${oldForm}' kalmamalıdır`
    );
  }
  assert.ok(
    diyalogRaw.includes("وَالر\u0651\u064Fوحِ") &&
      diyalogRaw.includes("الت\u0651\u064Fرْكِي\u0651\u0650") &&
      diyalogRaw.includes("الش\u0651\u064Fجَاعُ") &&
      diyalogRaw.includes("الش\u0651\u064Eرِكَةُ") &&
      diyalogRaw.includes("الز\u0651\u064Fبُونَ") &&
      diyalogRaw.includes("الش\u0651\u064Fرَكَاءُ") &&
      diyalogRaw.includes("الش\u0651\u064Eرِكَةِ"),
    "tum_diyaloglar_120.json içindeki 5 diyalog kaydında şemsî şeddeler standart dizilimle yer almalıdır"
  );

  // 2) tum_metinler_60.json (15 kayıt)
  for (const oldForm of [
    "الت\u0650ذْكَارِي\u0651\u064Eةِ",
    "الص\u064Eدَاقَةَ",
    "الش\u064Eبَابِ",
    "بِال\u0652ت\u064Eلَفَرِيكِ",
    "الص\u064Eنَادِيقِ",
    "الش\u064Eرِكَةِ",
    "الص\u064Eحِيحُ",
    " الت\u0650ي ",
    "الت\u0650كْنُولُوجِيَا",
    "الت\u0650كْنُولُوجِي\u0651\u064Eةَ",
    "الت\u0650كْنُولُوجِي\u0651\u064Eةِ",
    "الص\u064Eغِيرَةِ",
  ]) {
    assert.equal(
      metinRaw.includes(oldForm),
      false,
      `tum_metinler_60.json içinde hatalı '${oldForm}' kalmamalıdır`
    );
  }
  assert.ok(
    metinRaw.includes("الت\u0651\u0650ذْكَارِي\u0651\u064Eةِ") &&
      metinRaw.includes("بِالت\u0651\u064Eلَفَرِيكِ") &&
      metinRaw.includes("الت\u0651\u0650كْنُولُوجِيَا") &&
      metinRaw.includes("الت\u0651\u0650كْنُولُوجِي\u0651\u064Eةَ") &&
      metinRaw.includes("الت\u0651\u0650كْنُولُوجِي\u0651\u064Eةِ") &&
      metinRaw.includes("الص\u0651\u064Eغِيرَةِ"),
    "tum_metinler_60.json içindeki şemsî şedde, بِالتَّلَفَرِيكِ ve الَّتِي düzeltmeleri eksiksiz uygulanmalıdır"
  );

  // 3) atasozleri.json, 1111_cumle.json ve gorselKelimeler_guncel.json (6 kayıt)
  assert.equal(ataRaw.includes("فَال\u0652س\u0651\u064Fكُوتُ"), false);
  assert.equal(ataRaw.includes("كَال\u0652س\u0651\u064Eيْفِ"), false);
  assert.ok(
    ataRaw.includes("فَالس\u0651\u064Fكُوتُ") &&
      ataRaw.includes("كَالس\u0651\u064Eيْفِ"),
    "ata_0051 ve ata_0475 kayıtlarında şemsî lâm sükûnu kaldırılmış olmalıdır"
  );

  assert.equal(cumleRaw.includes("(ال\u0652ن\u0651\u064Eاقِصُ"), false);
  assert.ok(
    cumleRaw.includes("(الن\u0651\u064Eاقِصُ"),
    "cumle_0870 odak_kalip alanında şemsî lâm sükûnu kaldırılmış olmalıdır"
  );

  for (const oldForm of [
    "الص\u064Eالُونِ",
    "الص\u064Eحَفِي\u0651\u064F",
    "الص\u064Eحِيحُ",
  ]) {
    assert.equal(
      gorselRaw.includes(oldForm),
      false,
      `gorselKelimeler_guncel.json içinde şeddesiz '${oldForm}' kalmamalıdır`
    );
  }
  assert.ok(
    gorselRaw.includes("الص\u0651\u064Eالُونِ") &&
      gorselRaw.includes("الص\u0651\u064Eحَفِي\u0651\u064F") &&
      gorselRaw.includes("الص\u0651\u064Eحِيحُ"),
    "gorselKelimeler_guncel.json içindeki 3 örnek cümlede şemsî şeddeler eklenmiş olmalıdır"
  );
});

test("83. 6 Seslendirme JSON Veri Tabanında Özel İsimler (Ankara, Bursa, Konya, İstanbul, Uludağ, Uzungöl, Londra, John, İskender, Teknoloji) ve İç Hareke Düzeltmeleri Doğrulaması", () => {
  const diyalogRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "tum_diyaloglar_120.json"),
    "utf8"
  );
  const metinRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "tum_metinler_60.json"),
    "utf8"
  );
  const cumleRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "1111_cumle.json"),
    "utf8"
  );
  const ataRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "atasozleri.json"),
    "utf8"
  );
  const gorselRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "gorselKelimeler_guncel.json"),
    "utf8"
  );
  const sozlukRaw = fs.readFileSync(
    path.join(ROOT_DIR, "src", "data", "yeni_tum_sozluk.json"),
    "utf8"
  );

  // 1) Özel isimler ve teknoloji yazımlarında hiçbir eski hatalı biçim kalmamalı
  for (const [name, raw] of [
    ["tum_diyaloglar_120.json", diyalogRaw],
    ["tum_metinler_60.json", metinRaw],
    ["1111_cumle.json", cumleRaw],
    ["atasozleri.json", ataRaw],
    ["gorselKelimeler_guncel.json", gorselRaw],
    ["yeni_tum_sozluk.json", sozlukRaw],
  ]) {
    for (const forbidden of [
      "أُنْقُرَة",
      "أَنْقَرِوِي",
      "بَوْرَصَة",
      "قُونِيَة",
      "اِسْطَنْبُول",
      "الت\u0651\u064Eكَنُولُوجِيَا",
      "الت\u0651\u064Eكْنُولُوجْيَا",
      "الت\u0651\u064Eكْنُولُوجِيَا",
      "بالت\u0651\u064Eأْكِيدِ",
      "شَتَرَيْتُن\u0651\u064E",
      "اِذْطِلَاء",
      "مَثَاحِفُ",
      "حَالِدٌ",
      "إِسْكَنْدَرْ كَبَابَ",
      "البيئِي\u0651\u064E",
      "الراغِبِينَ",
    ]) {
      assert.equal(
        raw.includes(forbidden),
        false,
        `${name} içinde '${forbidden}' kalmamalıdır`
      );
    }
  }

  // 2) Doğru özel isim ve iç hareke biçimlerinin varlık kontrolü
  assert.ok(
    diyalogRaw.includes("أَنْقَرَةُ مَدِينَةٌ") &&
      diyalogRaw.includes("إِلَى مَدِينَةِ بُورْصَةَ هَذَا") &&
      diyalogRaw.includes("جَبَلِ أُولُودَاغَ ") &&
      diyalogRaw.includes("زِيَارَةَ أُوزُونْغُولَ؟") &&
      diyalogRaw.includes("أَنَا جُونُ زَمِيلُكَ") &&
      diyalogRaw.includes("يَا جُونُ؟") &&
      diyalogRaw.includes("مِنْ لَنْدَنَ،") &&
      diyalogRaw.includes("بِالت\u0651\u064Eأْكِيدِ،") &&
      diyalogRaw.includes("الْبِيئِي\u0651\u064E") &&
      diyalogRaw.includes("الر\u0651\u064Eاغِبِينَ") &&
      diyalogRaw.includes("يَا لَيْلَى") &&
      diyalogRaw.includes("فَارِغَةٌ") &&
      diyalogRaw.includes("وَاحِدٍ") &&
      diyalogRaw.includes("وَاضِحَةٌ") &&
      diyalogRaw.includes("وَاسِعَةٍ") &&
      diyalogRaw.includes("الْحَقِيبَةِ") &&
      diyalogRaw.includes("ذَلِكَ،") &&
      diyalogRaw.includes("شَدِيدٍ") &&
      diyalogRaw.includes("هُنَاكَ؟") &&
      diyalogRaw.includes("وَلَكِنْ") &&
      diyalogRaw.includes("وَقَابَلْنَا") &&
      diyalogRaw.includes("فَعَلَا ") &&
      diyalogRaw.includes("خَلَا ") &&
      diyalogRaw.includes("إِنْ شَاءَ") &&
      diyalogRaw.includes("إِن\u0651\u064Eهَا") &&
      diyalogRaw.includes("الْإِنْتَرْنِتِ"),
    "tum_diyaloglar_120.json özel isim ve iç hareke düzeltmelerini eksiksiz içermelidir"
  );

  assert.ok(
    metinRaw.includes("إِسْكَنْدَرَ كَبَابَ") &&
      metinRaw.includes("إِلَى أَيْنَ سَافَرَ") &&
      metinRaw.includes("الْمَأْكُولَاتُ") &&
      metinRaw.includes("وَلَكِن\u0651\u064E") &&
      metinRaw.includes("طَوَاحِينُ") &&
      metinRaw.includes("الْإِنْشَاءِ") &&
      metinRaw.includes("الْعَوَاصِفِ") &&
      !metinRaw.includes("ذلِكَ"),
    "tum_metinler_60.json özel isim ve iç hareke düzeltmelerini eksiksiz içermelidir"
  );

  assert.ok(
    cumleRaw.includes("أَنْقَرَوِي") &&
      cumleRaw.includes("مِنْ قُونْيَةَ") &&
      cumleRaw.includes("مِنْ أَيْنَ اشْتَرَيْتُن\u0651\u064E") &&
      cumleRaw.includes("لَكِنْ فَاطِمَةُ.") &&
      cumleRaw.includes("أَيْنَ دَرَسْتَ") &&
      cumleRaw.includes("لَا يَنَامُ") &&
      cumleRaw.includes("إِنَاءٍ") &&
      cumleRaw.includes("تُمَاثِلُ") &&
      cumleRaw.includes("فِي أَثْنَاءِ") &&
      cumleRaw.includes("الْإِنْتَرْنِتِ "),
    "1111_cumle.json özel isim ve iç hareke düzeltmelerini eksiksiz içermelidir"
  );

  assert.ok(
    ataRaw.includes("الش\u0651\u064Eر\u0651\u064F قَدِيمٌ.") &&
      ataRaw.includes("إِنَاءٍ") &&
      ataRaw.includes("كَيْفَمَا") &&
      ataRaw.includes("بِدَايَةٍ") &&
      ataRaw.includes("بِلَا") &&
      ataRaw.includes("الْمَرَارَةِ.") &&
      ataRaw.includes("لَا يَنَامُ.") &&
      ataRaw.includes("وَلَا تَمُوتُ"),
    "atasozleri.json iç hareke düzeltmelerini eksiksiz içermelidir"
  );

  assert.ok(
    gorselRaw.includes("جَامِعَةِ إِسْطَنْبُولَ") &&
      gorselRaw.includes("إِسْطَنْبُولُ مَدِينَةٌ") &&
      gorselRaw.includes("الت\u0651\u0650كْنُولُوجِيَا"),
    "gorselKelimeler_guncel.json İstanbul ve Teknoloji düzeltmelerini içermelidir"
  );

  assert.ok(
    sozlukRaw.includes("أَنْقَرَوِي\u0651\u064C") &&
      sozlukRaw.includes('"أُوزُونْغُولُ"') &&
      sozlukRaw.includes("بُورْصَةُ") &&
      sozlukRaw.includes("قُونْيَةُ") &&
      sozlukRaw.includes("خَالِدٌ") &&
      sozlukRaw.includes('"مَتَاحِفُ"') &&
      sozlukRaw.includes("اِنْطِلَاءٌ (عَلَى)"),
    "yeni_tum_sozluk.json özel isim ve masdar/ çoğul düzeltmelerini içermelidir"
  );
});

test("84. 3 Gramer Dosyasında (diyaloglar, metinler, ek) Sıfır Ters Hareke+Şedde, 8 Nokta Atışı Hareke Düzeltmesi ve %100 Ana Metin Uyumu", () => {
  const reversedShaddaRegex = /[\u064B-\u0650]\u0651/;

  for (const fileName of [
    "diyaloglar_gramer_hap_bilgi.json",
    "metinler_gramer_hap_bilgi.json",
    "ek_gramer_hap_bilgi.json",
  ]) {
    const raw = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
    assert.equal(
      reversedShaddaRegex.test(raw),
      false,
      `${fileName} içinde (yanlis alanları dahil) hiçbir ters hareke+şedde dizilimi kalmamalıdır`
    );
  }

  const dlgGramer = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "diyaloglar_gramer_hap_bilgi.json"), "utf8")
  );
  const byDlgG = new Map(dlgGramer.map((x) => [x.bagli_id, x]));

  assert.equal(
    byDlgG.get("dlg_004")?.metinden_ornek?.arapca,
    "اَلس\u0651\u064Eل\u064Eام\u064F عَلَيْكُمْ، هَلْ تُوجَدُ غُرْفَةٌ فَارِغَةٌ؟"
  );
  assert.equal(
    byDlgG.get("dlg_062")?.metinden_ornek?.arapca,
    "أَنَا مِنْ لَنْدَنَ، أَنَا بَرِيطَانِي\u0651\u064C."
  );
  assert.equal(
    byDlgG.get("dlg_041")?.ayrintili_anlatim?.dikkat_sik_hata?.yanlis,
    "تَأَخ\u0651\u064Eرْتُ بِسَبَبِ الْاِزْدِحَامُ."
  );
  assert.equal(
    byDlgG.get("dlg_033")?.ek_ornekler?.[1]?.arapca,
    "قَرَأْتُ أَرْبَعَ صَفَحَاتٍ."
  );
  assert.equal(
    byDlgG.get("dlg_107")?.ek_ornekler?.[1]?.arapca,
    "اِسْتَيْقَظْتُ وَأَذَانَ الْفَجْرِ."
  );
  assert.equal(
    byDlgG.get("dlg_110")?.ek_ornekler?.[0]?.arapca,
    "اِشْتَرَيْتُ لِتْراً حَلِيباً."
  );

  const metinGramer = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "metinler_gramer_hap_bilgi.json"), "utf8")
  );
  const byMetG = new Map(metinGramer.map((x) => [x.bagli_id, x]));

  assert.ok(
    byMetG.get("metin_47")?.metinden_ornek?.arapca.includes("الْأَسَاسُ الص\u0651\u064Eحِيحُ") &&
      byMetG
        .get("metin_47")
        ?.ayrintili_anlatim?.irab_tahlili?.some(
          (i) => i.kelime === "الأَسَاسُ الص\u0651\u064Eحِيحُ"
        ),
    "metin_47 metinden_ornek ve irab_tahlili içinde الصَّحِيحُ şeddeli olmalıdır"
  );
  assert.ok(
    byMetG
      .get("metin_52")
      ?.metinden_ornek?.arapca.includes("الت\u0651\u0650كْنُولُوجِي\u0651\u064Eةَ"),
    "metin_52 metinden_ornek içinde التِّكْنُولُوجِيَّةَ şeddeli olmalıdır"
  );

  // 120 diyalog + 60 metin metinden_ornek %100 ana kaynak uyumu
  const dlgs = new Map(
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tum_diyaloglar_120.json"), "utf8")).map(
      (d) => [d.id, d]
    )
  );
  const metins = new Map(
    JSON.parse(fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8")).map(
      (m) => [m.id, m]
    )
  );
  for (const item of dlgGramer) {
    const src = dlgs.get(item.bagli_id);
    const ex = item.metinden_ornek?.arapca || "";
    assert.ok(
      src.satirlar.some((s) => s.arapca.includes(ex) || ex.includes(s.arapca)),
      `${item.bagli_id} metinden_ornek ana diyalog dosyasıyla %100 uyumlu olmalıdır`
    );
  }
  for (const item of metinGramer) {
    const src = metins.get(item.bagli_id);
    const ex = item.metinden_ornek?.arapca || "";
    assert.ok(
      src.satirlar.some((s) => s.arapca.includes(ex) || ex.includes(s.arapca)),
      `${item.bagli_id} metinden_ornek ana metin dosyasıyla %100 uyumlu olmalıdır`
    );
  }
});

test("85. BalloonSafariGame game.js Motoru Uyarlaması: Sağ Dışarıdan Akarak Giriş (STAGE_W+85 / PORTRAIT_STAGE_W+70), b.speed * timeScale, Zorluk Puanı (15/12), Kombo (>=3 & >=10) ve %15 Altın Balon (5x Hızlı Akış)", async () => {
  const { pathToFileURL } = await import("node:url");
  const {
    SAFARI_DESKTOP_STAGE,
    SAFARI_PORTRAIT_STAGE,
    SAFARI_GOLDEN_SPAWN_CHANCE,
    SAFARI_GOLDEN_SCORE_MULTIPLIER,
    SAFARI_GOLDEN_SPEED_MULTIPLIER,
    computeSafariWavePlacements,
    computeSafariWordPopScore,
    computeSafariGoldenBonusScore,
  } = await import(
    pathToFileURL(path.join(ROOT_DIR, "src", "lib", "balloonSafariLayout.ts")).href
  );

  const desktopWave = computeSafariWavePlacements({
    isPortraitMobile: false,
    count: 4,
    baseSpeed: 126,
    roundNum: 3,
  });
  desktopWave.forEach((slot, index) => {
    const expectedX =
      SAFARI_DESKTOP_STAGE.width +
      85 +
      index * SAFARI_DESKTOP_STAGE.horizontalSpacing +
      (index % 2) * 26;
    assert.equal(slot.x, expectedX);
    assert.ok(slot.x > SAFARI_DESKTOP_STAGE.width);
  });

  const portraitWave = computeSafariWavePlacements({
    isPortraitMobile: true,
    count: 3,
    baseSpeed: 126,
    roundNum: 3,
  });
  portraitWave.forEach((slot, index) => {
    const expectedX =
      SAFARI_PORTRAIT_STAGE.width +
      70 +
      index * SAFARI_PORTRAIT_STAGE.horizontalSpacing;
    assert.equal(slot.x, expectedX);
    assert.ok(slot.x > SAFARI_PORTRAIT_STAGE.width);
  });

  assert.equal(SAFARI_GOLDEN_SPAWN_CHANCE, 0.15);
  assert.equal(SAFARI_GOLDEN_SCORE_MULTIPLIER, 5);
  assert.ok(SAFARI_GOLDEN_SPEED_MULTIPLIER > 1.3);
  assert.equal(
    computeSafariWordPopScore({ difficultyMode: "medium", level: 1, combo: 1 })
      .gainedPoints,
    12
  );
  assert.equal(
    computeSafariWordPopScore({ difficultyMode: "hard", level: 1, combo: 1 })
      .gainedPoints,
    15
  );
  assert.equal(
    computeSafariWordPopScore({ difficultyMode: "medium", level: 1, combo: 3 })
      .gainedPoints,
    18
  );
  assert.equal(
    computeSafariWordPopScore({ difficultyMode: "hard", level: 1, combo: 10 })
      .gainedPoints,
    30
  );
  assert.equal(
    computeSafariGoldenBonusScore({ difficultyMode: "hard", level: 1 }),
    75
  );

  const balloonSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "exercises", "BalloonSafariGame.tsx"),
    "utf8"
  );
  assert.ok(
    balloonSrc.includes(
      "PORTRAIT_STAGE_W + 70 + index * horizontalSpacing"
    ) &&
      balloonSrc.includes(
        "STAGE_W + 85 + index * horizontalSpacing + (index % 2) * 26"
      ) &&
      balloonSrc.includes("b.x - b.speed * timeScale") &&
      balloonSrc.includes("SAFARI_GOLDEN_SPAWN_CHANCE") &&
      balloonSrc.includes("SAFARI_GOLDEN_SPEED_MULTIPLIER") &&
      balloonSrc.includes("computeSafariWordPopScore") &&
      balloonSrc.includes("computeSafariGoldenBonusScore"),
    "BalloonSafariGame sağ dışarıdan akış koordinatlarını, b.speed * timeScale fiziğini ve game.js puanlama/altın balon motorunu kullanmalıdır"
  );
});

test("86. Kapsamlı Kullanım Rehberi & 24 Haftalık Çalışma Programı Merkezi (/rehber), Çift Rol Modu, Canlı Kur Takibi, A4 Yazdırma Başlığı ve Uygulama İçi Giriş Noktaları", async () => {
  const {
    REHBER_ROLE_STORAGE_KEY,
    build24WeekCurriculum,
    computeCurriculumProgress,
    getDynamicKttTopicCount,
  } = await import("../src/lib/rehberCurriculum.ts");
  const { CONTENT_INVENTORY } = await import("../src/lib/contentInventory.ts");

  assert.equal(REHBER_ROLE_STORAGE_KEY, "muallimun_rehber_role_v1");
  assert.equal(getDynamicKttTopicCount(), 44);

  const weeks = build24WeekCurriculum();
  assert.equal(weeks.length, 24, "24 haftalık tam müfredat üretilmelidir");
  const allDialogueChips = weeks.flatMap((w) => w.dialogues);
  assert.equal(
    new Set(allDialogueChips.map((d) => d.id)).size,
    CONTENT_INVENTORY.dialoguesCount
  );
  allDialogueChips.forEach((d, i) => {
    assert.equal(
      d.codeLabel,
      `Diyalog ${i + 1}`,
      `24 haftalık çizelgede diyalog sırası kesintisiz Diyalog 1..120 olmalıdır (beklenen Diyalog ${i + 1}, gelen ${d.codeLabel})`
    );
    assert.equal(d.href, `/diyalog/${d.id}`);
  });
  assert.equal(
    new Set(weeks.flatMap((w) => w.readings.map((r) => r.id))).size,
    CONTENT_INVENTORY.readingsCount
  );

  const sampleProg = computeCurriculumProgress(
    weeks,
    weeks[0].dialogues.map((d) => d.id),
    weeks[0].readings.map((r) => r.id),
    ["A1"]
  );
  assert.equal(sampleProg.byWeek[1].isWeekCompleted, true);
  assert.equal(sampleProg.byWeek[1].percent, 100);

  // /rehber sayfa ve alt bileşen kaynak denetimi
  const rehberPageSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "rehber", "page.tsx"),
    "utf8"
  );
  const rehberMapSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "rehber", "RehberMapTab.tsx"),
    "utf8"
  );
  const rehberMethodSrc = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "rehber",
      "RehberMethodologyAndScheduleTabs.tsx"
    ),
    "utf8"
  );
  const rehberCurrSrc = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "rehber",
      "RehberCurriculumTab.tsx"
    ),
    "utf8"
  );
  const rehberPrintSrc = fs.readFileSync(
    path.join(
      ROOT_DIR,
      "src",
      "components",
      "rehber",
      "RehberPrintBooklet.tsx"
    ),
    "utf8"
  );

  assert.ok(
    rehberPageSrc.includes("CONTENT_INVENTORY") &&
      rehberPageSrc.includes("REHBER_ROLE_STORAGE_KEY") &&
      rehberPageSrc.includes("Bireysel Öğrenen Modu") &&
      rehberPageSrc.includes("Sınıf &amp; Kurs Öğretmeni Modu") &&
      rehberPageSrc.includes("window.print()") &&
      rehberPageSrc.includes("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 w-full") &&
      rehberPageSrc.includes("w-full lg:w-auto min-h-[44px]"),
    "/rehber sayfası CONTENT_INVENTORY, rol seçici, taşmayan 4 sütunlu sekme ızgarası ve mobil tam genişlik A4 yazdırma tetikleyicisini içermelidir"
  );

  assert.ok(
    rehberMapSrc.includes("exerciseModulesCount") &&
      rehberMapSrc.includes("/alistirmalar?mode=classroom-battle") &&
      rehberMapSrc.includes("/alistirmalar?mode=evidence-hunter") &&
      rehberMapSrc.includes("/kutuphane?tab=es-zit") &&
      rehberMapSrc.includes("/sozluk") &&
      rehberMapSrc.includes("/ayarlar"),
    "RehberMapTab tüm modüllere ve 18 alıştırma moduna derin bağlantı vermelidir"
  );

  assert.ok(
    rehberMethodSrc.includes("5 + 1 + 1 Sistemi") &&
      rehberMethodSrc.includes("40 Dakikalık Standart Akıllı Tahta") &&
      rehberMethodSrc.includes("Tablo 1 • Okul / MEB Sınıf Senaryosu") &&
      rehberMethodSrc.includes("Tablo 2 • Dil Kursu &amp; Yoğun Hazırlık Senaryosu") &&
      rehberMethodSrc.includes("Maarif Rubriği") &&
      rehberMethodSrc.includes("w-full max-w-full overflow-x-auto"),
    "RehberMethodologyAndScheduleTabs hem bireysel 5+1+1 planını, hem öğretmenin 2 ayrı kurum tablosunu hem de mobil w-full overflow-x-auto korumasını içermelidir"
  );

  assert.ok(
    rehberPrintSrc.includes("Muallimun Arapça • app.muallimun.net"),
    "Yazdırılabilir A4 kitapçık başlığı 'Muallimun Arapça • app.muallimun.net' ibaresini taşımalıdır"
  );

  for (const [label, src] of [
    ["rehber/page.tsx", rehberPageSrc],
    ["RehberMapTab.tsx", rehberMapSrc],
    ["RehberMethodologyAndScheduleTabs.tsx", rehberMethodSrc],
    ["RehberCurriculumTab.tsx", rehberCurrSrc],
    ["RehberPrintBooklet.tsx", rehberPrintSrc],
  ]) {
    assert.equal(
      src.includes("style={{"),
      false,
      `${label} içinde satır içi style={{ kullanılmamalıdır`
    );
  }

  // Uygulama içi 3 giriş noktası denetimi
  const headerSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "layout", "Header.tsx"),
    "utf8"
  );
  const guideModalSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "components", "ui", "GuideAndInfoModalBody.tsx"),
    "utf8"
  );
  const homeSrc = fs.readFileSync(
    path.join(ROOT_DIR, "src", "app", "page.tsx"),
    "utf8"
  );

  assert.ok(
    headerSrc.includes('href="/rehber"') &&
      headerSrc.includes("Tam Kapsamlı Çalışma Rehberi"),
    "Header.tsx ⋯ menüsünde /rehber bağlantısı bulunmalıdır"
  );
  assert.ok(
    guideModalSrc.includes('href="/rehber"') &&
      guideModalSrc.includes("(/rehber)"),
    "GuideAndInfoModalBody.tsx üst şeridinde /rehber bağlantısı bulunmalıdır"
  );
  assert.ok(
    homeSrc.includes('href="/rehber"') &&
      homeSrc.includes("Nasıl Çalışılır? (Rehber)"),
    "Ana sayfa 30 dakikalık çalışma rotası başlığında /rehber kısayolu bulunmalıdır"
  );
});

test("87. tum_diyaloglar_120.json Emir Fiil, Cinsiyet Uyumu, İltikâü's-Sâkineyn, Hareke ve İ'rab Nokta Atışı Düzeltmeleri (11 Kayıt)", () => {
  const dlgs = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "tum_diyaloglar_120.json"), "utf8")
  );
  assert.equal(dlgs.length, 120);
  const byId = new Map(dlgs.map((d) => [d.id, d]));
  const getLine = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // 1. Emir Fiil ve Cinsiyet Uyumu
  assert.equal(
    getLine("dlg_025", 4)?.arapca,
    "اِمْشِ لِلْأَمَامِ ثُم\u0651\u064E ات\u0651\u064Eجِهْ يَمِيناً."
  );
  assert.equal(
    getLine("dlg_044", 7)?.arapca,
    "اِغْسِلْ وَجْهَكَ وَتَعَالَ إِلَى الْفَطُورِ."
  );

  // 2. İmla, Hareke, İltikâü's-Sâkineyn ve İ'rab
  assert.ok(getLine("dlg_045", 11)?.arapca.includes("لِلِابْتِدَاءِ!"));
  assert.ok(
    getLine("dlg_088", 5)?.arapca.endsWith("وَمُرَاجَعَةٍ دَائِماً.") &&
      !getLine("dlg_088", 5)?.arapca.includes("دَائِمَةٍ دَائِماً.")
  );
  assert.ok(getLine("dlg_094", 3)?.arapca.includes("وَلَوِ اسْتَعْدَدْنَا"));
  assert.ok(getLine("dlg_102", 3)?.arapca.includes("الْوَقْفِي\u0651\u064Eةِ؟"));
  assert.ok(
    getLine("dlg_103", 11)?.odak_kalip.includes("الْمُسْتَقْبَلُ") &&
      getLine("dlg_103", 11)?.arapca.includes("الْمُسْتَقْبَلُ")
  );
  assert.ok(getLine("dlg_110", 3)?.arapca.includes("وَهَلِ اشْتَرَتِ"));
  assert.ok(
    getLine("dlg_111", 10)?.odak_kalip.includes("مُت\u0651\u064Eفِقِينَ حَالًا")
  );
  assert.ok(
    getLine("dlg_113", 5)?.arapca.includes(
      "عَلَى الْعَمَلِ الْعَمَلِ الص\u0651\u064Eالِحِ"
    )
  );
  assert.ok(
    getLine("dlg_113", 6)?.arapca.includes("عَلَى الْإِخْلَاصِ الْإِخْلَاصِ")
  );

  // 3. İfade ve Gramer Doğallığı Düzeltmeleri (dlg_051, dlg_105, dlg_112)
  assert.equal(
    getLine("dlg_051", 6)?.arapca,
    "نَعَمْ، قُمَاشُهَا صُوفِي\u0651\u064C خَالِصٌ مِئَةً فِي الْمِئَةِ."
  );
  assert.equal(
    getLine("dlg_105", 4)?.arapca,
    "نَعَمْ، وَنَسْتَخْدِمُ آلَةَ الت\u0651\u064Eصْوِيرِ الر\u0651\u064Eقَمِي\u0651\u064Eةَ لِتَصْوِيرِ الأَحْدَاثِ بِدِق\u0651\u064Eةٍ."
  );
  assert.equal(
    getLine("dlg_112", 2)?.arapca,
    "لَيْسَ هَذَا وَحَسْبُ بَلْ أُفَك\u0651\u0650رُ فِي الذ\u0651\u064Eكَاءِ الص\u0651\u0650نَاعِي\u0651\u0650 أَيْضاً."
  );
  assert.equal(
    getLine("dlg_112", 6)?.arapca,
    "لَا أَحْتَاجُ الش\u0651\u064Eهَادَةَ فَقَطْ بَلْ أَبْحَثُ عَنِ الخِبْرَةِ العَمَلِي\u0651\u064Eةِ."
  );

  // dlg_025 ve dlg_112 gramer örneği senkronizasyonu
  const gramer = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "diyaloglar_gramer_hap_bilgi.json"), "utf8")
  );
  assert.equal(
    gramer.find((x) => x.bagli_id === "dlg_025")?.metinden_ornek?.arapca,
    "اِمْشِ لِلْأَمَامِ ثُم\u0651\u064E ات\u0651\u064Eجِهْ يَمِيناً."
  );
  assert.equal(
    gramer.find((x) => x.bagli_id === "dlg_112")?.metinden_ornek?.arapca,
    "لَا أَحْتَاجُ الش\u0651\u064Eهَادَةَ فَقَطْ بَلْ أَبْحَثُ عَنِ الخِبْرَةِ العَمَلِي\u0651\u064Eةِ."
  );
});

test("88. tum_metinler_60.json Sarf, Hareke, İmla ve Türkçe Çoğul Uyumu Düzeltmeleri (14 Kayıt)", () => {
  const metins = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8")
  );
  assert.equal(metins.length, 60);
  const byId = new Map(metins.map((m) => [m.id, m]));
  const getLine = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // 1. Sarf, Hareke ve İmla
  assert.equal(
    getLine("metin_19", 5)?.arapca,
    "أَقْضِي وَقْتًا نَشِيطًا فِي كُل\u0651\u0650 أُسْبُوعٍ."
  );
  assert.ok(byId.get("metin_28")?.baslik_ar.includes("مَمَر\u0651\u064F الْمُشَاةِ"));
  assert.ok(getLine("metin_28", 3)?.arapca.includes("مَمَر\u0651\u0650 الْمُشَاةِ"));
  assert.ok(getLine("metin_46", 3)?.arapca.includes("إِذَا عَمِلَ الْمُوَظ\u0651\u064Eفُ"));
  assert.ok(getLine("metin_51", 2)?.arapca.includes("الْتِزَامَهَا"));
  assert.ok(getLine("metin_54", 6)?.arapca.includes("تُفْرَضُ الْعُقُوبَاتُ"));
  assert.ok(getLine("metin_54", 10)?.arapca.includes("الْتِزَامًا"));
  assert.ok(
    byId.get("metin_54")?.sorular?.[1]?.soru_ar.includes("لِمَاذَا تُفْرَضُ الْعُقُوبَاتُ")
  );
  assert.ok(getLine("metin_55", 6)?.arapca.includes("الط\u0651\u064Eاقَةِ الْمُوَل\u0651\u064Eدَةِ"));
  assert.ok(getLine("metin_57", 4)?.arapca.includes("تُنْفَقُ الْأَمْوَالُ"));
  assert.ok(getLine("metin_57", 5)?.arapca.includes("الْفُقَرَاءِ"));
  assert.ok(
    byId
      .get("metin_57")
      ?.sorular?.[1]?.cevap_ar.includes("بِتَوْفِيرِ الْمِنَحِ الد\u0651\u0650رَاسِي\u0651\u064Eةِ")
  );
  assert.ok(getLine("metin_60", 4)?.arapca.includes("الْتِزَامَ"));

  // 2. Türkçe Çeviri Çoğul Uyumu
  assert.ok(
    getLine("metin_25", 2)?.turkce.includes("arkadaşlarımla") &&
      !getLine("metin_25", 2)?.turkce.includes("arkadaşımla")
  );
  assert.ok(
    getLine("metin_35", 2)?.turkce.includes("arkadaşlarımla") &&
      !getLine("metin_35", 2)?.turkce.includes("arkadaşımla")
  );
});

test("89. 1111_cumle.json Arapça Yazım/Hareke ve Türkçe Çeviri Düzeltmeleri (8 Kayıt)", () => {
  const cumleler = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "1111_cumle.json"), "utf8")
  );
  assert.equal(cumleler.length, 1111);
  const byId = new Map(cumleler.map((c) => [c.id, c]));

  // 1. Arapça Yazım ve Hareke
  assert.equal(
    byId.get("cumle_0234")?.arapca,
    "اَلط\u0651\u064Eالِبَاتُ أَعْدَدْنَا الْغَدَاءَ."
  );
  assert.ok(byId.get("cumle_0743")?.arapca.includes("يَنْسَحِبُونَ"));
  assert.ok(byId.get("cumle_0813")?.arapca.includes("يُطْمِئِنُنِي"));
  assert.ok(byId.get("cumle_0939")?.arapca.includes("أَكْمَلَ الط\u0651\u064Eالِبُ"));
  assert.ok(byId.get("cumle_0994")?.arapca.includes("يُسَاعِدُ الش\u0651\u064Eبَابُ"));

  // 2. Türkçe Çeviri Yazım
  assert.ok(byId.get("cumle_0164")?.turkce.includes("antrenmandan"));
  assert.ok(byId.get("cumle_0268")?.turkce.includes("Dersten"));
  assert.ok(byId.get("cumle_0549")?.turkce.includes("kütürdedi"));
});

test("90. atasozleri.json Arapça Çekim ve Türkçe Yazım/Arap Harfi Sızıntısı Düzeltmeleri (11 Kayıt)", () => {
  const atasozleri = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "atasozleri.json"), "utf8")
  );
  assert.equal(atasozleri.length, 508);
  const byId = new Map(atasozleri.map((a) => [a.id, a]));

  // 1. Arapça Düzeltmesi
  assert.equal(
    byId.get("ata_0322")?.arapca,
    "كِلَابٌ تَعْوِي وَالْقَافِلَةُ تَسِيرُ."
  );

  // 2. Türkçe Alanlardaki Yazım ve Arap Harfi Sızıntısı Düzeltmeleri
  assert.ok(
    byId.get("ata_0010")?.lafzi_ceviri.includes("yılandan") &&
      !byId.get("ata_0010")?.lafzi_ceviri.includes("yılandان")
  );
  assert.ok(
    byId.get("ata_0063")?.lafzi_ceviri.includes("çıkaranıdır") &&
      !byId.get("ata_0063")?.lafzi_ceviri.includes("çıkاراتıdır")
  );
  assert.ok(
    byId.get("ata_0103")?.kullanim_baglami.includes("Firaset") &&
      !byId.get("ata_0103")?.kullanim_baglami.includes("Firasat")
  );
  assert.ok(
    byId.get("ata_0132")?.lafzi_ceviri.includes("Yırtıcı") &&
      !byId.get("ata_0132")?.lafzi_ceviri.includes("Yr tıcı")
  );
  assert.ok(
    byId.get("ata_0215")?.lafzi_ceviri.includes("belagatlıdır") &&
      !byId.get("ata_0215")?.lafzi_ceviri.includes("belatlidir")
  );
  assert.ok(
    byId.get("ata_0264")?.kullanim_baglami.includes("ve düşmanlığın") &&
      !byId.get("ata_0264")?.kullanim_baglami.includes("me düşmanlığın")
  );
  assert.ok(
    byId.get("ata_0300")?.kullanim_baglami.includes("itibarı zedeleyeceğini") &&
      !byId.get("ata_0300")?.kullanim_baglami.includes("itibar zedeleyeceğini")
  );
  assert.ok(
    byId.get("ata_0357")?.kullanim_baglami.includes("hükümsüz") &&
      !byId.get("ata_0357")?.kullanim_baglami.includes("hükmsüz")
  );
  assert.ok(
    byId.get("ata_0369")?.kullanim_baglami.includes("duygu") &&
      !byId.get("ata_0369")?.kullanim_baglami.includes("duygui")
  );
  assert.ok(
    byId.get("ata_0431")?.kullanim_baglami.includes("itibarı zedeleyeceğini") &&
      !byId.get("ata_0431")?.kullanim_baglami.includes("itibar zedeleyeceğini")
  );
});

test("91. es_zit_anlamlilar, gorselKelimeler_guncel ve diyaloglar_gramer_hap_bilgi Nokta Atışı Düzeltmeleri (8 Kayıt)", () => {
  // 1. es_zit_anlamlilar.json -> ez_179
  const esZit = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "es_zit_anlamlilar.json"), "utf8")
  );
  assert.equal(esZit.length, 400);
  const ez179 = esZit.find((x) => x.id === "ez_179");
  assert.ok(ez179);
  assert.ok(
    ez179.es_anlamlilar.some((x) => x.ar === "أَبَدًا"),
    "ez_179 es_anlamlilar içinde أَبَدًا korunmalıdır"
  );
  assert.ok(
    !ez179.zit_anlamlilar.some((x) => x.ar === "أَبَدًا"),
    "ez_179 zit_anlamlilar içinden أَبَدًا çıkarılmalıdır"
  );
  assert.ok(
    ez179.zit_anlamlilar.some((x) => x.ar === "نَادِرًا"),
    "ez_179 zit_anlamlilar içinde نَادِرًا yer almalıdır"
  );

  // 2. gorselKelimeler_guncel.json -> 0032_02_omur & 0088_03_kutuphane (998 korunur)
  const gorsel = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "gorselKelimeler_guncel.json"), "utf8")
  );
  assert.equal(gorsel.length, 998);
  const omur = gorsel.find((x) => x.id === "0032_02_omur");
  assert.ok(
    omur?.gorsel_betimleme_en.includes("and three lit glowing wax candles") &&
      !omur?.gorsel_betimleme_en.includes("andthree")
  );
  const kutuphane = gorsel.find((x) => x.id === "0088_03_kutuphane");
  assert.ok(
    kutuphane?.gorsel_betimleme_en.includes("miniature wooden bookcase") &&
      !kutuphane?.gorsel_betimleme_en.includes("miniaturewooden")
  );

  // 3. diyaloglar_gramer_hap_bilgi.json -> dlg_029, dlg_035, dlg_100, dlg_113, dlg_120
  const dlgGramer = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "diyaloglar_gramer_hap_bilgi.json"), "utf8")
  );
  assert.equal(dlgGramer.length, 120);
  const byBagliId = new Map(dlgGramer.map((x) => [x.bagli_id, x]));

  const d029 = byBagliId.get("dlg_029")?.ayrintili_anlatim?.dikkat_sik_hata;
  assert.ok(d029?.yanlis.includes("أَرْخَصٌ") && d029?.yanlis.includes("tenvin"));
  assert.ok(d029?.dogru.includes("أَرْخَصُ") && d029?.dogru.includes("tek ötre"));

  const d035 = byBagliId.get("dlg_035");
  assert.ok(
    d035?.ek_ornekler.some((o) => o.arapca === "الط\u0651\u064Eعَامُ مَأْكُولٌ.") &&
      !d035?.ek_ornekler.some((o) => o.arapca.includes("مَطْبُوعٌ"))
  );

  const d100 = byBagliId.get("dlg_100")?.ayrintili_anlatim?.dikkat_sik_hata;
  assert.ok(d100?.yanlis.includes("تَبَادِلُ") && d100?.yanlis.includes("esreli"));
  assert.ok(d100?.dogru.includes("تَبَادُلُ") && d100?.dogru.includes("ötreli"));

  const d113 = byBagliId.get("dlg_113")?.ayrintili_anlatim?.dikkat_sik_hata;
  assert.ok(
    d113?.neden.includes("pekiştirdiği öznenin") &&
      !d113?.neden.includes("pekiştirdiği özenin")
  );

  const d120 = byBagliId.get("dlg_120")?.ayrintili_anlatim?.dikkat_sik_hata;
  assert.ok(d120?.yanlis.includes("الط\u0651\u064Eقْسُ") && d120?.yanlis.includes("merfû"));
  assert.ok(d120?.dogru.includes("الط\u0651\u064Eقْسَ") && d120?.dogru.includes("mansûb"));
});

test("92. 6 Eğitim JSON Dosyası TTS Hijyen, Karakter Sızıntısı (ata_0093) ve Ses Yolu Tutarlılığı Doğrulaması", () => {
  const targetFiles = [
    "1111_cumle.json",
    "atasozleri.json",
    "diyaloglar_gramer_hap_bilgi.json",
    "ek_gramer_hap_bilgi.json",
    "es_zit_anlamlilar.json",
    "gorselKelimeler_guncel.json",
  ];

  for (const fname of targetFiles) {
    const raw = fs.readFileSync(path.join(DATA_DIR, fname), "utf8");
    const data = JSON.parse(raw);
    assert.ok(Array.isArray(data) && data.length > 0, `${fname} geçerli ve dolu dizi olmalıdır`);
    assert.ok(
      !/[\u064B-\u0650]\u0651/.test(raw),
      `${fname} içinde ters hareke+şedde bulunmamalıdır`
    );

    const walk = (node, recId) => {
      if (Array.isArray(node)) {
        node.forEach((v) => walk(v, recId));
      } else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string") {
            assert.equal(v, v.trim(), `${fname} ${recId}.${k} baş/son boşluk içermemelidir`);
            assert.ok(!/ {2,}/.test(v), `${fname} ${recId}.${k} çift boşluk içermemelidir`);
            assert.ok(
              !/[\x00-\x1F\x7F\u00A0\u200B-\u200F\u202A-\u202E\uFEFF]/.test(v),
              `${fname} ${recId}.${k} kontrol veya sıfır genişlikli karakter içermemelidir`
            );
            assert.ok(
              !/[A-Za-zÇĞİÖŞÜçğıöşü][\u0600-\u06FF]|[\u0600-\u06FF][A-Za-zÇĞİÖŞÜçğıöşü]/.test(v),
              `${fname} ${recId}.${k} içinde bitişik Latin-Arap harf sızıntısı olmamalıdır`
            );
          } else {
            walk(v, recId);
          }
        }
      }
    };

    data.forEach((rec, i) => walk(rec, rec.id || rec.bagli_id || `idx_${i}`));
  }

  // ata_0093 canان -> canan
  const atasozleri = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "atasozleri.json"), "utf8")
  );
  const ata0093 = atasozleri.find((x) => x.id === "ata_0093");
  assert.equal(
    ata0093?.turkce,
    "Önce can sonra canan (İyiliğe önce yakınlar layıktır)."
  );
});

test("93. tum_diyaloglar_120.json ve tum_metinler_60.json Latin Rakam (102/405) ve Kısa Elif (\\u0670) Normalizasyonu", () => {
  const dlgs = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "tum_diyaloglar_120.json"), "utf8")
  );
  const metins = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8")
  );

  for (const [label, list] of [
    ["tum_diyaloglar_120.json", dlgs],
    ["tum_metinler_60.json", metins],
  ]) {
    for (const item of list) {
      for (const row of item.satirlar || []) {
        assert.ok(
          !/[0-9\u0660-\u0669]/.test(row.arapca),
          `${label} ${item.id} satır ${row.sira} arapca alanında rakam kalmamalıdır`
        );
        assert.ok(
          !/\u0670/.test(row.arapca),
          `${label} ${item.id} satır ${row.sira} arapca alanında kısa elif (\\u0670) kalmamalıdır`
        );
      }
    }
  }

  const byDlg = new Map(dlgs.map((d) => [d.id, d]));
  assert.equal(
    byDlg.get("dlg_042")?.satirlar.find((s) => s.sira === 3)?.arapca,
    "اِسْمُهُ خَالِدٌ فِي الْغُرْفَةِ رَقْمِ مِئَةٍ وَاثْنَيْنِ."
  );
  assert.equal(
    byDlg.get("dlg_049")?.satirlar.find((s) => s.sira === 11)?.arapca,
    "هَذَا هُوَ مِفْتَاحُ الْغُرْفَةِ رَقْمِ أَرْبَعِمِئَةٍ وَخَمْسَةٍ."
  );
  assert.equal(
    byDlg.get("dlg_075")?.satirlar.find((s) => s.sira === 3)?.arapca,
    "أُرِيدُ شِرَاءَهَا، لَكِن\u0651\u064Eهَا غَالِيَةُ الث\u0651\u064Eمَنِ قَلِيلاً."
  );
  assert.ok(
    byDlg.get("dlg_103")?.satirlar.find((s) => s.sira === 6)?.arapca.startsWith("لِذَلِكَ ")
  );
});

test("94. tum_diyaloglar_120.json Emir Vasl Hemzesi (اُخْرُجْ/اُنْظُرْ), Hatalı Hareke/Şedde (الطُّيُورِ/بُنْدُقِيَّةَ/مِكْنَسَةُ/اللَّذِيذَ/اللَّيْلَةَ/تَنُّورَةٌ), Cinsiyet (dlg_093) ve Türkçe Sayı Uyumu", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "tum_diyaloglar_120.json"), "utf8");
  assert.ok(!/\u0670/.test(raw), "tum_diyaloglar_120.json genelinde (odak_kalip/odak_gramer dahil) kısa elif kalmamalıdır");

  const dlgs = JSON.parse(raw);
  const byId = new Map(dlgs.map((d) => [d.id, d]));
  const line = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // 1. Sülasi Emir مضموم العين (اُ) & cümle başı vasıl hemzesi
  assert.ok(line("dlg_071", 5)?.arapca.startsWith("اُخْرُجْ "));
  assert.ok(line("dlg_051", 4)?.arapca.startsWith("اُنْظُرِي "));
  assert.ok(line("dlg_057", 9)?.arapca.startsWith("اُنْظُرِي،"));
  assert.ok(line("dlg_059", 1)?.arapca.startsWith("اُنْظُرْ "));
  assert.ok(line("dlg_059", 3)?.arapca.startsWith("اُنْظُرْ "));

  // 2. Hatalı hareke, eksik hareke ve şedde
  assert.ok(line("dlg_043", 3)?.arapca.includes("الط\u0651\u064Fيُورِ."));
  assert.ok(line("dlg_043", 4)?.arapca.includes("بُنْدُقِي\u0651\u064Eةَ"));
  assert.ok(line("dlg_043", 5)?.arapca.includes("الْبُنْدُقِي\u0651\u064Eةَ"));
  assert.ok(line("dlg_057", 5)?.arapca.includes("مِكْنَسَةُ"));
  assert.ok(line("dlg_090", 7)?.arapca.includes("الل\u0651\u064Eذِيذَ"));
  assert.ok(line("dlg_105", 7)?.arapca.includes("الل\u0651\u064Eيْلَةَ؟"));
  assert.ok(line("dlg_066", 6)?.odak_kalip.includes("تَن\u0651\u064Fورَةٌ"));

  // 3. Konuşmacı cinsiyeti uyumu (dlg_093 Said [E] & Tarık [E])
  assert.equal(
    line("dlg_093", 8)?.arapca,
    "وَهَلْ أَنْتَ تَعْرِفُ كَيْفَ تُقَد\u0651\u0650مُ الإِسْعَافَاتِ الأَو\u0651\u064Eلِي\u0651\u064Eةَ لِلْمَجْرُوحِينَ؟"
  );
  assert.equal(
    line("dlg_093", 9)?.arapca,
    "نَعَمْ، وَلَنْ أَتَأَخ\u0651\u064Eرَ عَنْ مُسَاعَدَةِ المَجْرُوحِينَ فِي الش\u0651\u064Eارِعِ."
  );

  // 4. Türkçe-Arapça sayı/saat uyumu
  assert.equal(line("dlg_011", 10)?.turkce, "Hesap sadece yirmi liradır.");
  assert.equal(line("dlg_026", 4)?.turkce, "Sıcaklık yirmi derecedir.");
  assert.equal(line("dlg_042", 3)?.turkce, "Adı Halid, yüz iki numaralı odada.");
  assert.equal(line("dlg_043", 9)?.turkce, "Memnuniyetle, sabah saat beşte çıkacağız.");
  assert.equal(line("dlg_049", 11)?.turkce, "İşte dört yüz beş numaralı odanın anahtarı.");

  // 5. كَمْ / كَمِ kuralı (harekeli kelime önünde كَمْ, iltikâ-i sâkineyn'de كَمِ korunur)
  assert.equal(line("dlg_026", 3)?.arapca, "كَمْ دَرَجَةُ الحَرَارَةِ الْآنَ؟");
  assert.ok(line("dlg_011", 9)?.arapca.startsWith("كَمِ الْحِسَابُ"));
  assert.ok(line("dlg_039", 7)?.arapca.startsWith("كَمِ الإِيجَارُ"));
  assert.ok(line("dlg_046", 7)?.arapca.startsWith("كَمِ الت\u0651\u064Eكْلِفَةُ"));
});

test("95. atasozleri.json Aşama 1 (ata_0001–ata_0250) Sarf, Nahiv, Hareke ve Türkçe Çeviri Düzeltmeleri", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "atasozleri.json"), "utf8");
  assert.ok(!/[\u064B-\u0650]\u0651/.test(raw), "atasozleri.json içinde ters şedde+hareke sırası olmamalıdır");
  const atasozleri = JSON.parse(raw);
  assert.equal(atasozleri.length, 508, "atasozleri.json 508 kayıt içermelidir");
  const byId = new Map(atasozleri.map((a) => [a.id, a]));

  // Kritik kontroller (#1 ata_0052 ve #2 ata_0195)
  assert.equal(
    byId.get("ata_0052")?.arapca,
    "إِذَا كَانَتِ الْعَصَا مِنَ الْعُصَي\u0651\u064Eةِ فَالْحَي\u0651\u064Eةُ لَا تَلِدُ إِل\u0651\u064Eا حُيَي\u0651\u064Eةً."
  );
  assert.equal(
    byId.get("ata_0052")?.lafzi_ceviri,
    "Eğer sopa sopacıktan çıkıyorsa, yılan da ancak yavru yılan doğurur."
  );
  assert.equal(
    byId.get("ata_0195")?.arapca,
    "دَرْءُ الْمَفَاسِدِ مُقَد\u0651\u064Eمٌ عَلَى جَلْبِ الْمَصَالِحِ."
  );

  // Sarf, nahiv, imla, hareke ve çeviri düzeltmeleri (ata_0001–ata_0250)
  assert.ok(byId.get("ata_0002")?.arapca.endsWith("يَبِينُ."));
  assert.equal(byId.get("ata_0002")?.turkce, "İyi insan lafının üzerine gelir.");
  assert.ok(byId.get("ata_0007")?.arapca.includes("اَلْإِج\u0651\u064Eاصُ"));
  assert.ok(byId.get("ata_0056")?.arapca.endsWith("فَادْخُلْ فِيهِ."));
  assert.ok(byId.get("ata_0057")?.arapca.startsWith("اُذْكُرُوا"));
  assert.ok(byId.get("ata_0070")?.lafzi_ceviri.includes("gaybta olan"));
  assert.ok(byId.get("ata_0075")?.arapca.endsWith("تَسْتَحِ الْعَيْنُ."));
  assert.ok(byId.get("ata_0078")?.arapca.startsWith("اُطْلُبِ الْكَثِيرَ"));
  assert.ok(byId.get("ata_0080")?.arapca.startsWith("اِعْرِفْ"));
  assert.ok(byId.get("ata_0083")?.arapca.includes("الْقَوْسَ"));
  assert.ok(byId.get("ata_0084")?.arapca.includes("مَنِ انْتَصَرَ"));
  assert.equal(byId.get("ata_0119")?.turkce, "Burnu Kaf Dağı'nda, kibrinden yanına yaklaşılmıyor.");
  assert.ok(byId.get("ata_0150")?.arapca.includes("الْعَجَلَةِ"));
  assert.equal(byId.get("ata_0153")?.arapca, "جَاءَ بِخُف\u0651\u064Eيْ حُنَيْنٍ.");
  assert.equal(byId.get("ata_0153")?.lafzi_ceviri, "Huneyn'in iki çarığı ile geldi.");
  assert.ok(byId.get("ata_0154")?.arapca.includes("الد\u0651\u0650بْسَ"));
  assert.equal(byId.get("ata_0158")?.arapca, "لَا يَجْتَمِعُ سَيْفَانِ فِي غِمْدٍ وَاحِدٍ.");
  assert.equal(byId.get("ata_0158")?.lafzi_ceviri, "İki kılıç tek bir kında bir araya gelmez.");
  assert.ok(byId.get("ata_0174")?.arapca.endsWith("ضَيْغَمٍ."));
  assert.equal(byId.get("ata_0183")?.arapca, "خَب\u0651\u0650ئْ دِرْهَمَكَ الْأَبْيَضَ لِيَوْمِكَ الْأَسْوَدِ.");
  assert.equal(byId.get("ata_0183")?.lafzi_ceviri, "Beyaz dirhemini siyah günün için sakla.");
  assert.equal(byId.get("ata_0199")?.lafzi_ceviri, "Yarısını yese bile ekmeği pişirmesi için fırıncıya bırak.");
  assert.ok(byId.get("ata_0204")?.arapca.endsWith("دَاخِلِهَا."));
  assert.ok(byId.get("ata_0212")?.arapca.includes("يُلَاقِكَ"));
  assert.ok(byId.get("ata_0216")?.arapca.includes("صُدْفَةٍ"));
  assert.ok(byId.get("ata_0222")?.lafzi_ceviri.startsWith("Kendi başının dikine gitti"));
  assert.ok(byId.get("ata_0223")?.arapca.startsWith("زُرْ"));
  assert.ok(byId.get("ata_0230")?.arapca.endsWith("الْمُسَامَحَةِ."));
  assert.ok(byId.get("ata_0237")?.arapca.endsWith("تَحْتَرِقُ حَت\u0651\u064Eى الْعِشَاءِ."));
  assert.equal(byId.get("ata_0249")?.arapca, "صِيتُ غِنًى وَلَا صِيتُ فَقْرٍ.");
});

test("96. atasozleri.json Aşama 2 (ata_0251–ata_0508) Sarf, Nahiv, Hareke, Hemze ve Türkçe Çeviri Düzeltmeleri", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "atasozleri.json"), "utf8");
  assert.ok(!/[\u064B-\u0650]\u0651/.test(raw), "atasozleri.json içinde ters şedde+hareke sırası olmamalıdır");
  const atasozleri = JSON.parse(raw);
  assert.equal(atasozleri.length, 508, "atasozleri.json 508 kayıt içermelidir");
  const byId = new Map(atasozleri.map((a) => [a.id, a]));

  // Kritik kontroller (#3 ata_0260, #4 ata_0499, #5 ata_0506)
  assert.equal(byId.get("ata_0260")?.turkce, "İnatçı bir âlim, yardımsever bir cahilden hayırlıdır.");
  assert.equal(byId.get("ata_0499")?.arapca, "يَشْرَبُ مِنْ كَأْسِ الْمَرَارَةِ.");
  assert.equal(byId.get("ata_0499")?.turkce, "Acı kadehinden içmek / Büyük ıstırap çekmek.");
  assert.equal(
    byId.get("ata_0506")?.arapca,
    "يَمُوتُ الش\u0651\u064Eافِي وَيَفْنَى الط\u0651\u064Eبِيبُ وَيَبْقَى الل\u0651\u064Eهُ."
  );

  // Sarf, nahiv, imla, cinsiyet, geçiş kesrası ve çeviri düzeltmeleri (ata_0251–ata_0508)
  assert.equal(byId.get("ata_0262")?.arapca, "عَبْدُ غَيْرِكَ حُر\u0651\u064C مِثْلُكَ.");
  assert.equal(byId.get("ata_0266")?.arapca, "أَعِز\u0651\u064E نَفْسَكَ تَجِدْهَا.");
  assert.ok(byId.get("ata_0277")?.arapca.endsWith("وَحْدَكَ."));
  assert.equal(byId.get("ata_0277")?.turkce, "Gülerken herkes seninle güler, ağlarken yalnız kalırsın.");
  assert.equal(byId.get("ata_0288")?.arapca, "فَرْخُ الْبَط\u0651\u0650 عَو\u0651\u064Eامٌ.");
  assert.ok(byId.get("ata_0292")?.arapca.includes("فَك\u0651\u0650رْ فِي الْهَدَفِ."));
  assert.ok(byId.get("ata_0295")?.arapca.startsWith("قُد\u0651\u0650رَ"));
  assert.ok(byId.get("ata_0300")?.arapca.includes("الْكَثِيرَ"));
  assert.equal(byId.get("ata_0301")?.arapca, "الْقَنَاعَةُ كَنْزٌ لَا يَفْنَى.");
  assert.equal(byId.get("ata_0303")?.arapca, "قُولُوا خَيْرًا أَوِ اصْمُتُوا.");
  assert.ok(byId.get("ata_0306")?.arapca.includes("أَكْلَ الْحُر\u0651\u0650."));
  assert.equal(byId.get("ata_0314")?.turkce, "Her şeyin fazlası zarardır, haddini aşan şey zıddına döner.");
  assert.equal(byId.get("ata_0325")?.arapca, "كُنْ أَمِينًا تَعِشْ آمِنًا.");
  assert.equal(byId.get("ata_0330")?.lafzi_ceviri, "Allah ile ol ve aldırış etme.");
  assert.equal(byId.get("ata_0332")?.arapca, "كَيْفَمَا تَكُونُوا يُوَل\u0651\u064Eى عَلَيْكُمْ.");
  assert.ok(byId.get("ata_0350")?.arapca.startsWith("لَا يُلْدَغُ"));
  assert.equal(byId.get("ata_0357")?.arapca, "لَا يَنْفَعُ الْحَذَرُ مِنَ الْقَدَرِ.");
  assert.ok(byId.get("ata_0375")?.lafzi_ceviri.startsWith("İstihare"));
  assert.ok(byId.get("ata_0377")?.arapca.endsWith("مُضَي\u0651\u064Eعٌ."));
  assert.ok(byId.get("ata_0385")?.arapca.startsWith("مَا يَحُك\u0651\u064F"));
  assert.ok(byId.get("ata_0393")?.arapca.startsWith("مَنِ اسْتَرْعَى"));
  assert.ok(byId.get("ata_0394")?.arapca.startsWith("مَنِ اشْتَرَى"));
  assert.ok(byId.get("ata_0396")?.arapca.startsWith("مَنِ اعْتَمَدَ"));
  assert.ok(byId.get("ata_0399")?.arapca.startsWith("مَنْ أَمِنَ"));
  assert.ok(byId.get("ata_0400")?.arapca.startsWith("مَنْ أَرَادَ"));
  assert.ok(byId.get("ata_0402")?.arapca.includes("الص\u0651\u064Eحْرَاءِ"));
  assert.ok(byId.get("ata_0415")?.arapca.endsWith("الْكَثِيرُ."));
  assert.ok(byId.get("ata_0439")?.arapca.includes("لَمْ يَنَمْ"));
  assert.ok(byId.get("ata_0443")?.arapca.endsWith("يَغُصْ فِي الْبَحْرِ."));
  assert.equal(byId.get("ata_0445")?.arapca, "مَوْضِعُ الْهِنَاءِ مَوْضِعُ الن\u0651\u064Fقْبِ.");
  assert.equal(byId.get("ata_0453")?.arapca, "نِصْفُ الْعَقْلِ الْمُدَارَاةُ.");
  assert.equal(byId.get("ata_0457")?.turkce, "Şükredilmeyen nimet affolunmayan hata gibidir.");
  assert.equal(byId.get("ata_0465")?.arapca, "وَجَدَ لُقَطَةً فَلَمْ يَجِدْ صَاحِبَهَا.");
  assert.ok(byId.get("ata_0468")?.arapca.startsWith("وَرُب\u0651\u064E"));
  assert.equal(byId.get("ata_0480")?.arapca, "وَيْلٌ لِلْمُطَف\u0651\u0650فِينَ.");
  assert.equal(byId.get("ata_0481")?.lafzi_ceviri, "Akşamın bilmediği şeyi sabah getirir.");
  assert.equal(byId.get("ata_0483")?.turkce, "Haram helal ver Allah'ım, çoluk çocuk yer Allah'ım.");
  assert.equal(byId.get("ata_0492")?.turkce, "At izini it izine karıştırmak, sapla samanı karıştırmak.");
  assert.equal(byId.get("ata_0497")?.arapca, "يَزُولُ الْإِنْسَانُ وَتَبْقَى الْآثَارُ.");
  assert.equal(byId.get("ata_0498")?.arapca, "يَسْعَى الْمَرْءُ وَالْقَضَاءُ يَقْضِي.");
  assert.equal(byId.get("ata_0503")?.arapca, "يُعْرَفُ الص\u0651\u064Eدِيقُ عِنْدَ الض\u0651\u0650يقِ.");
  assert.equal(byId.get("ata_0504")?.arapca, "يَعْلَمُ مِنْ أَيْنَ تُؤْكَلُ الْكَتِفُ.");
  assert.equal(byId.get("ata_0505")?.arapca, "يَمُوتُ الْإِنْسَانُ وَلَا تَمُوتُ فِعَالُهُ.");
  assert.equal(byId.get("ata_0507")?.arapca, "الْيَوْمُ خَمْرٌ وَغَدًا أَمْرٌ.");

  // ata_0251–ata_0508 aralığında sükûnsuz kamerî ال kalmamış olmalıdır
  const stage2 = atasozleri.slice(250);
  for (const item of stage2) {
    assert.ok(
      !/(?:^|[\sووفبكل])ال[أإآءئؤابجحخعغفقكمهوي]/.test(item.arapca),
      `${item.id} kaydında sükûnsuz kamerî ال bulunmamalıdır: ${item.arapca}`
    );
  }
});

test("97. tum_metinler_60.json Aşama 1 (metin_01–metin_20) El-Takısı, İrap, Sarf, Tenvin, Türkçe Çeviri ve Soru-Cevap Uyumu", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8");
  assert.ok(!/[\u064B-\u0650]\u0651/.test(raw), "tum_metinler_60.json içinde ters şedde+hareke sırası olmamalıdır");
  const metins = JSON.parse(raw);
  assert.equal(metins.length, 60);
  const byId = new Map(metins.map((m) => [m.id, m]));
  const getLine = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // Soru-cevap metin uyumu (metin_01, metin_04, metin_14)
  assert.equal(byId.get("metin_01")?.sorular?.[1]?.soru_ar, "مَا مِهْنَةُ أُم\u0651\u0650 عَلِي\u0651\u064D؟");
  assert.equal(byId.get("metin_01")?.sorular?.[1]?.cevap_ar, "هِيَ مُعَل\u0651\u0650مَةٌ نَشِيطَةٌ.");
  assert.equal(byId.get("metin_04")?.sorular?.[0]?.cevap_ar, "هُوَ نَظِيفٌ وَمُؤَث\u0651\u064Eثٌ بِشَكْلٍ جَمِيلٍ.");
  assert.equal(byId.get("metin_14")?.sorular?.[0]?.cevap_ar, "تُف\u0651\u064Eاحًا وَمَوْزًا وَبُرْتُقَالًا وَعِنَبًا.");

  // Sarf, irap, hareke, tenvin ve çeviri düzeltmeleri
  assert.ok(getLine("metin_04", 3)?.arapca.includes("وَخِزَانَةٌ"));
  assert.ok(getLine("metin_12", 4)?.arapca.startsWith("أُشَاهِدُ "));
  assert.ok(getLine("metin_13", 1)?.arapca.includes("أَقَارِبُ كِثَارٌ."));
  assert.equal(getLine("metin_13", 1)?.turkce, "Büyük ailemde çok sayıda akraba var.");
  assert.equal(getLine("metin_15", 3)?.turkce, "Güneş parlıyor ve hava çok hoştur.");
  assert.ok(getLine("metin_18", 4)?.arapca.includes("فِي الْمَحَط\u0651\u064Eةِ"));
  assert.ok(getLine("metin_19", 4)?.arapca.endsWith("دَائِمًا."));
  assert.ok(getLine("metin_20", 5)?.arapca.includes("وَالْقَوَاعِدَ"));

  // metin_01–metin_20 aralığında sükûnsuz kamerî ال veya اً kalmamış olmalıdır
  for (const m of metins.slice(0, 20)) {
    const str = JSON.stringify(m);
    assert.ok(
      !/(?:^|[\s"\u064E-\u0650])ال[أإآءئؤابجحخعغفقكمهوي]/.test(str),
      `${m.id} içinde sükûnsuz kamerî ال kalmamalıdır`
    );
    assert.ok(!/\u0627\u064B/.test(str), `${m.id} içinde اً yerine ًا kullanılmalıdır`);
  }
});

test("98. tum_metinler_60.json Aşama 2 (metin_21–metin_40) El-Takısı, Şedde, Sarf, İrap, Tenvin, Türkçe Çeviri ve Soru-Cevap Uyumu", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8");
  assert.ok(!/[\u064B-\u0650]\u0651/.test(raw), "tum_metinler_60.json içinde ters şedde+hareke sırası olmamalıdır");
  assert.ok(!raw.includes("الِا"), "tum_metinler_60.json içinde TTS-uyumsuz الِا bulunmamalıdır");
  const metins = JSON.parse(raw);
  assert.equal(metins.length, 60);
  const byId = new Map(metins.map((m) => [m.id, m]));
  const getLine = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // Kritik şedde, hareke, sarf ve harf-i cer düzeltmeleri
  assert.ok(getLine("metin_25", 4)?.arapca.includes("الْخِلَافَةِ"));
  assert.ok(getLine("metin_25", 5)?.arapca.includes("هُدُوءٍ تَام\u0651\u064D"));
  assert.equal(byId.get("metin_28")?.sorular?.[0]?.cevap_ar, "مِنْ مَمَر\u0651\u0650 الْمُشَاةِ.");
  assert.equal(byId.get("metin_31")?.sorular?.[0]?.cevap_ar, "انْتَقَلُوا إِلَى بَيْتِهِمُ الْجَدِيدِ.");
  assert.ok(getLine("metin_34", 6)?.arapca.includes("الص\u0651\u064Fنْدُوقِ"));
  assert.equal(byId.get("metin_35")?.sorular?.[1]?.soru_ar, "عَلَى مَاذَا حَصَلَ فِي الن\u0651\u0650هَايَةِ؟");
  assert.equal(byId.get("metin_37")?.baslik_ar, "الْبَحْثُ عَنِ الص\u0651\u064Eيْدَلِي\u0651\u064Eةِ الْمُنَاوِبَةِ");
  assert.equal(byId.get("metin_37")?.sorular?.[1]?.soru_ar, "أَيْنَ تَقَعُ الص\u0651\u064Eيْدَلِي\u0651\u064Eةُ الْمُنَاوِبَةُ؟");

  // Türkçe imla ve doğallaştırma kontrolleri
  assert.ok(getLine("metin_21", 5)?.turkce.includes("mekânları"));
  assert.ok(getLine("metin_25", 7)?.turkce.includes("mekândır"));
  assert.ok(getLine("metin_26", 2)?.turkce.includes("usta bir pilot"));
  assert.ok(getLine("metin_27", 6)?.turkce.includes("mekânı"));
  assert.ok(getLine("metin_30", 4)?.turkce.includes("önemli değil"));
  assert.ok(getLine("metin_33", 6)?.turkce.includes("mekânları"));
  assert.ok(getLine("metin_35", 5)?.turkce.includes("kâğıda"));
  assert.ok(getLine("metin_35", 6)?.turkce.includes("kâğıdı"));
  assert.ok(getLine("metin_38", 6)?.turkce.includes("mekânda"));

  // metin_21–metin_40 aralığında sükûnsuz kamerî ال/لِل veya اً kalmamış olmalıdır
  for (const m of metins.slice(20, 40)) {
    const str = JSON.stringify(m);
    assert.ok(
      !/(?:^|[\s"(\/\u064E-\u0650])(?:ال|لِل)[أإآءئؤابجحخعغفقكمهوي]/.test(str),
      `${m.id} içinde sükûnsuz kamerî ال/لِل kalmamalıdır`
    );
    assert.ok(!/\u0627\u064B/.test(str), `${m.id} içinde اً yerine ًا kullanılmalıdır`);
  }
});

test("99. tum_metinler_60.json Aşama 3 (metin_41–metin_60) ve 60 Metin Tam Bütünlük (Med, Sarf, İrap, Şedde, Harf-i Cer, Türkçe İmla)", () => {
  const raw = fs.readFileSync(path.join(DATA_DIR, "tum_metinler_60.json"), "utf8");
  assert.ok(!/[\u064B-\u0650]\u0651/.test(raw), "tum_metinler_60.json içinde ters şedde+hareke sırası olmamalıdır");
  assert.ok(!raw.includes("الِا"), "tum_metinler_60.json içinde TTS-uyumsuz الِا bulunmamalıdır");
  assert.ok(!/\u0622\u064E/.test(raw), "tum_metinler_60.json içinde çift med (آَ) kalmamalıdır");
  const metins = JSON.parse(raw);
  assert.equal(metins.length, 60);
  const byId = new Map(metins.map((m) => [m.id, m]));
  const getLine = (id, sira) => byId.get(id)?.satirlar?.find((s) => s.sira === sira);

  // Kritik sarf, nahiv, şedde, med ve harf-i cer düzeltmeleri
  assert.equal(byId.get("metin_42")?.sorular?.[0]?.soru_ar, "إِلَى مَاذَا يُؤَد\u0651\u0650ي الْإِفْرَاطُ فِي مَوَاقِعِ الت\u0651\u064Eوَاصُلِ؟");
  assert.ok(getLine("metin_43", 4)?.arapca.startsWith("تُصَل\u0651\u064Eى الت\u0651\u064Eرَاوِيحُ"));
  assert.ok(getLine("metin_44", 3)?.turkce.includes("tükenmekten"));
  assert.ok(getLine("metin_44", 4)?.arapca.includes("الْمُعَادِ تَدْوِيرُهَا"));
  assert.ok(getLine("metin_44", 6)?.arapca.endsWith("وَآمِنٍ."));
  assert.ok(getLine("metin_44", 8)?.arapca.endsWith("بِلَا اسْتِثْنَاءٍ."));
  assert.equal(byId.get("metin_45")?.sorular?.[0]?.soru_ar, "إِلَى مَاذَا تَرْمُزُ مَلَابِسُ الْإِحْرَامِ الْبَيْضَاءُ؟");
  assert.ok(getLine("metin_46", 1)?.arapca.includes("فِي بِنَاءِ مُسْتَقْبَلِ"));
  assert.equal(byId.get("metin_46")?.sorular?.[1]?.soru_ar, "مَا هِيَ الر\u0651\u064Eكِيزَةُ الْأَسَاسِي\u0651\u064Eةُ لِلن\u0651\u064Eجَاحِ؟");
  assert.ok(getLine("metin_47", 5)?.arapca.includes("الْمُزْدَحِمَةِ"));
  assert.ok(getLine("metin_48", 7)?.arapca.includes("الْمُغَط\u0651\u064Eاةِ"));
  assert.ok(getLine("metin_48", 8)?.arapca.includes("تُعَد\u0651\u064F خِبْرَةً"));
  assert.ok(getLine("metin_49", 5)?.arapca.includes("الْهَز\u0651\u064Eاتِ"));
  assert.equal(byId.get("metin_49")?.sorular?.[0]?.soru_ar, "مَاذَا يُجَه\u0651\u064Eزُ فِي الْبَيْتِ لِلط\u0651\u064Eوَارِئِ؟");
  assert.ok(getLine("metin_51", 2)?.arapca.includes("الص\u0651\u0650نَاعِي\u0651\u064Eةَ"));
  assert.ok(getLine("metin_51", 5)?.arapca.includes("مِنْ سُمُومِ"));
  assert.ok(getLine("metin_51", 8)?.arapca.endsWith("صِح\u0651\u0650ي\u0651\u064Bا."));
  assert.ok(getLine("metin_51", 9)?.arapca.includes("الت\u0651\u064Eكَاتُفُ"));
  assert.ok(getLine("metin_52", 1)?.arapca.includes("مِحْوَرِي\u0651\u064Bا"));
  assert.ok(getLine("metin_52", 5)?.arapca.includes("تُحَاكِي"));
  assert.ok(getLine("metin_53", 3)?.arapca.includes("الْمُعْدِيَةُ"));
  assert.ok(getLine("metin_55", 4)?.arapca.includes("بِنَاءَ الس\u0651\u064Fدُودِ"));
  assert.ok(getLine("metin_55", 6)?.arapca.includes("الْمُظْلِمَةِ"));
  assert.ok(getLine("metin_55", 7)?.turkce.includes("ekonomik kârlar"));
  assert.ok(getLine("metin_55", 8)?.arapca.includes("الْعُلْيَا"));
  assert.ok(getLine("metin_55", 10)?.arapca.includes("آمِنٍ لِلْأَجْيَالِ"));
  assert.ok(getLine("metin_57", 8)?.arapca.includes("الر\u0651\u0650عَايَةِ الص\u0651\u0650ح\u0651\u0650ي\u0651\u064Eةِ"));
  assert.ok(getLine("metin_58", 4)?.arapca.includes("الت\u0651\u064Eأَك\u0651\u064Fدَ"));
  assert.ok(getLine("metin_58", 10)?.arapca.includes("وَآمَالِهِ"));
  assert.ok(getLine("metin_59", 9)?.arapca.includes("مَشَارِيعِهِمُ الص\u0651\u064Eغِيرَةِ"));
  assert.ok(getLine("metin_60", 10)?.arapca.includes("وَآمِنٍ"));

  // Tüm 60 metnin tamamında sükûnsuz kamerî ال/لِل ve اً kalmamış olmalıdır
  for (const m of metins) {
    const str = JSON.stringify(m);
    assert.ok(
      !/(?:^|[\s"(\/\u064E-\u0650])(?:ال|لِل)[أإآءئؤابجحخعغفقكمهوي]/.test(str),
      `${m.id} içinde sükûnsuz kamerî ال/لِل kalmamalıdır`
    );
    assert.ok(!/\u0627\u064B/.test(str), `${m.id} içinde اً yerine ًا kullanılmalıdır`);
  }
});





