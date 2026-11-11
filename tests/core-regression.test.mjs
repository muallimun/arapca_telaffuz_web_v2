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
