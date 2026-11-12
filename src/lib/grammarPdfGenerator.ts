import type { GramerHapBilgi, Level } from "@/types/data";
import {
  GRAMMAR_DOMAINS,
  buildGrammarCardDeepLink,
  classifyGrammarCardDomain,
  type GrammarDomainFilter,
} from "@/lib/grammarTaxonomy";
import { diyaloglar, metinler } from "@/lib/data";
import { fixArabicTypography } from "@/lib/arabicTextUtils";
import { generateQrSvg } from "@/lib/qrCode";

function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ARABIC_RUN_REGEX =
  /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/g;

/**
 * Türkçe metin içindeki Arapça kelime/ibare öbeklerini izole RTL Naskh span'lerine sarar.
 */
export function renderMixedPrintHtml(rawText?: string): string {
  if (!rawText) return "";
  const parts = rawText.split(ARABIC_RUN_REGEX);
  return parts
    .map((part) => {
      if (!part) return "";
      if (/[\u0600-\u06FF]/.test(part)) {
        return `<span class="ar-inline" dir="rtl" lang="ar">${escapeHtml(
          fixArabicTypography(part)
        )}</span>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function isPrimarilyArabicCell(text: string): boolean {
  const arChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latChars = (text.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length;
  return arChars > 0 && arChars >= latChars;
}

function resolveCardLevelAndLesson(card: GramerHapBilgi): {
  level: Level;
  lessonRef: string | null;
} {
  if (card.seviye) {
    return { level: card.seviye, lessonRef: null };
  }
  if (card.bagli_id.startsWith("dlg_")) {
    const dlg = diyaloglar.find((d) => d.id === card.bagli_id);
    const no = card.bagli_id.replace("dlg_", "");
    return {
      level: dlg?.seviye || "A1",
      lessonRef: dlg ? `Diyalog #${no}: ${dlg.baslik_tr}` : `Diyalog #${no}`,
    };
  }
  if (card.bagli_id.startsWith("metin_")) {
    const txt = metinler.find((m) => m.id === card.bagli_id);
    const no = card.bagli_id.replace("metin_", "");
    return {
      level: txt?.seviye || "A1",
      lessonRef: txt ? `Metin #${no}: ${txt.baslik_tr}` : `Metin #${no}`,
    };
  }
  return { level: "A1", lessonRef: null };
}

function renderFormulaBlocksHtml(formulSema?: string): string {
  if (!formulSema || !formulSema.trim()) return "";
  const groups = formulSema
    .split(/\s*\|\s*/)
    .map((g) => g.trim())
    .filter(Boolean);

  const rowsHtml = groups
    .map((group) => {
      const tokens = group
        .split(/\s*(->|➔|=>|\+|=)\s*/)
        .map((t) => t.trim())
        .filter(Boolean);

      const inner = tokens
        .map((tok) => {
          if (tok === "->" || tok === "➔" || tok === "=>") {
            return `<span class="formula-op formula-arrow">➔</span>`;
          }
          if (tok === "+" || tok === "=") {
            return `<span class="formula-op">${escapeHtml(tok)}</span>`;
          }
          const cleanTok = tok.replace(/^\[/, "").replace(/\]$/, "");
          return `<span class="formula-chip">${renderMixedPrintHtml(
            cleanTok
          )}</span>`;
        })
        .join("");

      return `<div class="formula-row">${inner}</div>`;
    })
    .join("");

  return `
    <div class="sec-box formula-box">
      <div class="sec-label indigo-label">📐 Görsel Formül Şeması</div>
      <div class="formula-rows">${rowsHtml}</div>
    </div>
  `;
}

export function renderSingleCardSheetHtml(
  card: GramerHapBilgi,
  opts?: {
    indexNumber?: number;
    totalCount?: number;
    forcePageBreakBefore?: boolean;
    includeQr?: boolean;
  }
): string {
  const { level, lessonRef } = resolveCardLevelAndLesson(card);
  const domainId = classifyGrammarCardDomain(card);
  const domainMeta = GRAMMAR_DOMAINS[domainId];
  const detail = card.ayrintili_anlatim;
  const deepLink = buildGrammarCardDeepLink(card.bagli_id);
  const showQr = opts?.includeQr ?? true;
  const qrSvg = showQr
    ? generateQrSvg(deepLink, 58, {
        borderColor: "#cbd5e1",
        borderRadiusPx: 8,
        quietZone: 2,
      })
    : "";

  const extraExamples = Array.isArray(card.ek_ornekler) ? card.ek_ornekler : [];
  const steps = Array.isArray(detail?.adim_adim_anlatim)
    ? detail!.adim_adim_anlatim
    : [];
  const ozetTablo = detail?.ozet_tablo;
  const irabList = Array.isArray(detail?.irab_tahlili)
    ? detail!.irab_tahlili
    : [];
  const sikHata = detail?.dikkat_sik_hata;

  const pageClass = opts?.forcePageBreakBefore
    ? "grammar-sheet page-break-before"
    : "grammar-sheet";

  const topicCounterBadge =
    opts?.indexNumber && opts?.totalCount
      ? `<span class="badge badge-neutral">Konu ${opts.indexNumber} / ${opts.totalCount}</span>`
      : "";

  return `
    <article class="${pageClass}">
      <!-- ÜST MARKA VE KONU BAŞLIĞI ŞERİDİ -->
      <header class="sheet-header" style="border-bottom-color: ${domainMeta.printAccentHex};">
        <div class="header-top-row">
          <div class="brand-cluster">
            <div class="brand-mark" style="background:${domainMeta.printAccentHex};">م</div>
            <div>
              <div class="brand-title">MUALLİMUN ARAPÇA • GRAMER ATLASI DERS FÖYÜ</div>
              <div class="brand-sub">İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu</div>
            </div>
          </div>
          <div class="header-right-cluster">
            <div class="badges-wrap">
              ${topicCounterBadge}
              <span class="badge badge-level level-${level.toLowerCase()}">Seviye ${escapeHtml(
                level
              )}</span>
              <span class="badge badge-domain" style="background:${
                domainMeta.printSoftBgHex
              };color:${domainMeta.printAccentHex};border-color:${
                domainMeta.printAccentHex
              }40;">
                ${escapeHtml(domainMeta.emoji)} ${escapeHtml(
                  domainMeta.shortTitle
                )}
              </span>
            </div>
            ${qrSvg ? `<div class="qr-box" title="Kartı Dijital Aç">${qrSvg}</div>` : ""}
          </div>
        </div>

        <h1 class="topic-title">${renderMixedPrintHtml(card.konu_basligi)}</h1>
        ${
          card.ktt_ust_konu || lessonRef
            ? `<div class="topic-meta-line">
                ${
                  card.ktt_ust_konu
                    ? `<span><strong>Üst Konu:</strong> ${escapeHtml(
                        card.ktt_ust_konu
                      )}</span>`
                    : ""
                }
                ${
                  card.ktt_ust_konu && lessonRef ? `<span class="sep">•</span>` : ""
                }
                ${
                  lessonRef
                    ? `<span><strong>İlgili İçerik:</strong> ${escapeHtml(
                        lessonRef
                      )}</span>`
                    : ""
                }
              </div>`
            : ""
        }
      </header>

      <!-- 1. TEMEL KURAL ÖZETİ & İPUCU -->
      <section class="sec-box rule-box">
        <div class="sec-label emerald-label">📌 Temel Kural Özeti (Hap Kural)</div>
        <p class="rule-text">${renderMixedPrintHtml(card.hap_kural)}</p>
        ${
          card.ipucu
            ? `<div class="tip-strip">
                <strong>💡 Pratik İpucu:</strong> ${renderMixedPrintHtml(
                  card.ipucu
                )}
              </div>`
            : ""
        }
      </section>

      <!-- 2. GÖRSEL FORMÜL ŞEMASI -->
      ${renderFormulaBlocksHtml(detail?.formul_sema)}

      <!-- 3. ÖRNEK CÜMLELER -->
      <section class="sec-box examples-box">
        <div class="sec-label purple-label">🎯 Örnek Cümleler ve Çözümleme</div>
        ${
          card.metinden_ornek
            ? `<div class="primary-example">
                <div class="ar-sentence" dir="rtl" lang="ar">${escapeHtml(
                  fixArabicTypography(card.metinden_ornek.arapca)
                )}</div>
                <div class="tr-translation">“${escapeHtml(
                  card.metinden_ornek.turkce
                )}”</div>
                ${
                  card.metinden_ornek.aciklama
                    ? `<div class="example-note"><strong>Çözümleme:</strong> ${renderMixedPrintHtml(
                        card.metinden_ornek.aciklama
                      )}</div>`
                    : ""
                }
              </div>`
            : ""
        }
        ${
          extraExamples.length > 0
            ? `<div class="extra-examples-grid">
                ${extraExamples
                  .map(
                    (ex) => `
                  <div class="extra-example-card">
                    <div class="ar-sentence-sm" dir="rtl" lang="ar">${escapeHtml(
                      fixArabicTypography(ex.arapca)
                    )}</div>
                    <div class="tr-translation-sm">“${escapeHtml(
                      ex.turkce
                    )}”</div>
                  </div>
                `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </section>

      <!-- 4. ADIM ADIM ANLATIM -->
      ${
        steps.length > 0
          ? `<section class="sec-box steps-box">
              <div class="sec-label slate-label">📚 Adım Adım Konu Anlatımı</div>
              <div class="steps-list">
                ${steps
                  .map(
                    (step) =>
                      `<div class="step-item">${renderMixedPrintHtml(
                        step
                      )}</div>`
                  )
                  .join("")}
              </div>
            </section>`
          : ""
      }

      <!-- 5. KARŞILAŞTIRMALI ÖZET TABLO -->
      ${
        ozetTablo &&
        Array.isArray(ozetTablo.sutunlar) &&
        ozetTablo.sutunlar.length > 0
          ? `<section class="sec-box table-box">
              <div class="sec-label emerald-label">📊 ${renderMixedPrintHtml(
                ozetTablo.tablo_basligi || "Karşılaştırmalı Özet Tablo"
              )}</div>
              <table class="summary-table">
                <thead>
                  <tr>
                    ${ozetTablo.sutunlar
                      .map((col) => `<th>${renderMixedPrintHtml(col)}</th>`)
                      .join("")}
                  </tr>
                </thead>
                <tbody>
                  ${(ozetTablo.satirlar || [])
                    .map(
                      (row) => `
                    <tr>
                      ${row
                        .map((cell) => {
                          const cellStr = String(cell ?? "");
                          if (isPrimarilyArabicCell(cellStr)) {
                            return `<td class="ar-cell" dir="rtl" lang="ar">${escapeHtml(
                              fixArabicTypography(cellStr)
                            )}</td>`;
                          }
                          return `<td>${renderMixedPrintHtml(cellStr)}</td>`;
                        })
                        .join("")}
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </section>`
          : ""
      }

      <!-- 6. İ'RAB TAHLİLİ -->
      ${
        irabList.length > 0
          ? `<section class="sec-box irab-box">
              <div class="sec-label indigo-label">🔍 Kelime Kelime İ'rab Tahlili</div>
              <table class="irab-table">
                <thead>
                  <tr>
                    <th style="width:26%;">Kelime / İbare</th>
                    <th style="width:24%;">Cümledeki Görevi</th>
                    <th style="width:50%;">Hareke ve İ'rab Nedeni</th>
                  </tr>
                </thead>
                <tbody>
                  ${irabList
                    .map(
                      (ir) => `
                    <tr>
                      <td class="ar-cell irab-word" dir="rtl" lang="ar">${escapeHtml(
                        fixArabicTypography(ir.kelime)
                      )}</td>
                      <td><span class="role-pill">${renderMixedPrintHtml(
                        ir.gorevi
                      )}</span></td>
                      <td>${renderMixedPrintHtml(ir.hareke_nedeni)}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </section>`
          : ""
      }

      <!-- 7. SIK YAPILAN HATALAR -->
      ${
        sikHata && (sikHata.yanlis || sikHata.dogru)
          ? `<section class="sec-box mistake-box">
              <div class="sec-label amber-label">⚠️ Dikkat &amp; Sık Yapılan Hatalar</div>
              <div class="mistake-grid">
                <div class="wrong-card">
                  <div class="mistake-tag wrong-tag">❌ Yanlış Kullanım</div>
                  <div class="mistake-content">${renderMixedPrintHtml(
                    sikHata.yanlis
                  )}</div>
                </div>
                <div class="right-card">
                  <div class="mistake-tag right-tag">✅ Doğru Kullanım</div>
                  <div class="mistake-content">${renderMixedPrintHtml(
                    sikHata.dogru
                  )}</div>
                </div>
              </div>
              ${
                sikHata.neden
                  ? `<div class="mistake-reason"><strong>Açıklama:</strong> ${renderMixedPrintHtml(
                      sikHata.neden
                    )}</div>`
                  : ""
              }
            </section>`
          : ""
      }

      <footer class="sheet-footer">
        <span>Muallimun Arapça Gramer Atlası • A4 Ders Föyü</span>
        <span class="footer-link">${escapeHtml(deepLink)}</span>
      </footer>
    </article>
  `;
}

function buildPrintStylesheet(): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return `
    @font-face {
      font-family: "ArakomPrint";
      src: url("${origin}/fonts/Arakom.ttf") format("truetype");
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }

    @page {
      size: A4 portrait;
      margin: 11mm 12mm;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      background: #ffffff;
      color: #1e293b;
      font-family: "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.48;
    }

    .ar-inline,
    .ar-sentence,
    .ar-sentence-sm,
    .ar-cell {
      font-family: "Amiri", "Scheherazade New", "ArakomPrint", "Traditional Arabic", "Noto Naskh Arabic", serif !important;
      font-feature-settings: "liga" 1, "calt" 1, "mark" 1, "mkmk" 1;
      letter-spacing: 0;
    }

    .ar-inline {
      display: inline-block;
      font-size: 1.24em;
      font-weight: 700;
      line-height: 1.65;
      color: #065f46;
      padding: 0 2px;
      vertical-align: baseline;
    }

    .page-break-before {
      page-break-before: always;
      break-before: page;
    }

    /* KAPAK SAYFASI */
    .booklet-cover {
      min-height: 262mm;
      border: 2.5px solid #087f5b;
      border-radius: 16px;
      padding: 18mm 16mm;
      background: linear-gradient(180deg, #fdfbf7 0%, #f0fdf4 100%);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .cover-badge {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 8px;
      background: #087f5b;
      color: #ffffff;
      font-weight: 800;
      font-size: 9.5pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .cover-ar-kicker {
      font-family: "Amiri", "Scheherazade New", "ArakomPrint", serif;
      font-size: 24pt;
      font-weight: 700;
      color: #065f46;
      margin-top: 12px;
      line-height: 1.8;
    }

    .cover-main-title {
      font-size: 23pt;
      font-weight: 800;
      color: #0f172a;
      margin: 8px 0 10px 0;
      line-height: 1.22;
    }

    .cover-subtitle {
      font-size: 11pt;
      color: #475569;
      font-weight: 600;
      max-width: 155mm;
      line-height: 1.55;
    }

    .cover-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin: 18px 0;
    }

    .cover-stat-box {
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-bottom: 3px solid #087f5b;
      border-radius: 10px;
      padding: 10px 12px;
      text-align: center;
    }

    .cover-stat-num {
      font-size: 16pt;
      font-weight: 800;
      color: #087f5b;
    }

    .cover-stat-lbl {
      font-size: 8pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .student-info-box {
      background: #ffffff;
      border: 1.5px dashed #94a3b8;
      border-radius: 12px;
      padding: 12px 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 20px;
      font-size: 9.5pt;
      font-weight: 700;
      color: #334155;
    }

    /* İÇİNDEKİLER TABLOSU */
    .toc-section {
      padding: 2mm 0;
    }

    .toc-title {
      font-size: 15pt;
      font-weight: 800;
      color: #065f46;
      border-bottom: 2.5px solid #087f5b;
      padding-bottom: 6px;
      margin: 0 0 10px 0;
    }

    .toc-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.6pt;
    }

    .toc-table th {
      background: #087f5b;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 800;
      border: 1px solid #065f46;
    }

    .toc-table td {
      padding: 4.5px 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    .toc-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .toc-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* DERS FÖYÜ ANA KAPSAYICI */
    .grammar-sheet {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
    }

    .sheet-header {
      border-bottom: 2.5px solid #087f5b;
      padding-bottom: 7px;
      margin-bottom: 8px;
    }

    .header-top-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 5px;
    }

    .brand-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-mark {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      color: #ffffff;
      font-family: "Amiri", "Scheherazade New", serif;
      font-size: 15pt;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .brand-title {
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #065f46;
    }

    .brand-sub {
      font-size: 7.5pt;
      color: #64748b;
      font-weight: 600;
    }

    .header-right-cluster {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .badges-wrap {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }

    .badge {
      display: inline-block;
      padding: 2.5px 7px;
      border-radius: 6px;
      font-size: 7.8pt;
      font-weight: 800;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .badge-neutral {
      background: #f1f5f9;
      color: #334155;
      border-color: #cbd5e1;
    }

    .badge-level {
      color: #ffffff;
    }
    .level-a1 { background: #087f5b; }
    .level-a2 { background: #2b8a3e; }
    .level-b1 { background: #d97706; }
    .level-b2 { background: #6741d9; }

    .qr-box {
      flex-shrink: 0;
    }

    .topic-title {
      font-size: 13.5pt;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 2px 0;
      line-height: 1.35;
    }

    .topic-meta-line {
      font-size: 8pt;
      color: #475569;
      margin-top: 2px;
    }

    .topic-meta-line .sep {
      margin: 0 6px;
      color: #94a3b8;
    }

    /* BÖLÜM KUTULARI */
    .sec-box {
      border-radius: 9px;
      padding: 7px 10px;
      margin-bottom: 7px;
      border: 1.2px solid #e2e8f0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .table-box, .steps-box, .irab-box {
      break-inside: auto;
      page-break-inside: auto;
    }

    .sec-label {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }

    .emerald-label { color: #065f46; }
    .indigo-label { color: #4338ca; }
    .purple-label { color: #5b21b6; }
    .slate-label { color: #1e293b; }
    .amber-label { color: #92400e; }

    .rule-box {
      background: #f0fdf4;
      border-color: #86efac;
    }

    .rule-text {
      margin: 0;
      font-size: 9.4pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.52;
    }

    .tip-strip {
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px dashed #86efac;
      font-size: 8.6pt;
      color: #14532d;
      line-height: 1.45;
    }

    /* FORMÜL ŞEMASI */
    .formula-box {
      background: #eef2ff;
      border-color: #c7d2fe;
    }

    .formula-rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .formula-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
    }

    .formula-chip {
      background: #ffffff;
      border: 1px solid #a5b4fc;
      border-radius: 6px;
      padding: 2px 7px;
      font-size: 8.5pt;
      font-weight: 700;
      color: #1e1b4b;
      word-break: break-word;
    }

    .formula-op {
      font-weight: 800;
      color: #4338ca;
      font-size: 9.5pt;
      padding: 0 2px;
    }

    /* ÖRNEK CÜMLELER */
    .examples-box {
      background: #fdfbf7;
      border-color: #e6d7be;
    }

    .primary-example {
      background: #ffffff;
      border: 1px solid #e6d7be;
      border-radius: 7px;
      padding: 6px 9px;
    }

    .ar-sentence {
      font-size: 15.5pt;
      font-weight: 700;
      color: #065f46;
      text-align: right;
      line-height: 1.85;
    }

    .tr-translation {
      font-size: 9pt;
      font-weight: 700;
      color: #1e293b;
      border-left: 3px solid #087f5b;
      padding-left: 7px;
      margin-top: 2px;
    }

    .example-note {
      font-size: 8.3pt;
      color: #475569;
      margin-top: 4px;
      line-height: 1.45;
    }

    .extra-examples-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }

    .extra-example-card {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 5px 8px;
    }

    .ar-sentence-sm {
      font-size: 13pt;
      font-weight: 700;
      color: #065f46;
      text-align: right;
      line-height: 1.8;
    }

    .tr-translation-sm {
      font-size: 8.2pt;
      font-weight: 600;
      color: #334155;
      margin-top: 1px;
    }

    /* ADIM ADIM ANLATIM */
    .steps-box {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .steps-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .step-item {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 8.6pt;
      color: #1e293b;
      line-height: 1.48;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* ÖZET TABLO VE İ'RAB TABLOSU */
    .summary-table,
    .irab-table {
      width: 100%;
      max-width: 100%;
      border-collapse: collapse;
      font-size: 8.3pt;
      table-layout: auto;
    }

    .summary-table th {
      background: #087f5b;
      color: #ffffff;
      padding: 4.5px 7px;
      font-weight: 800;
      text-align: left;
      border: 1px solid #065f46;
      word-break: break-word;
    }

    .irab-table th {
      background: #4338ca;
      color: #ffffff;
      padding: 4.5px 7px;
      font-weight: 800;
      text-align: left;
      border: 1px solid #3730a3;
    }

    .summary-table td,
    .irab-table td {
      padding: 4px 7px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .summary-table tr:nth-child(even) td,
    .irab-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .summary-table tr,
    .irab-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .ar-cell {
      font-size: 12.5pt;
      font-weight: 700;
      color: #065f46;
      text-align: right;
      line-height: 1.75;
    }

    .role-pill {
      display: inline-block;
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
      border-radius: 5px;
      padding: 1.5px 6px;
      font-weight: 800;
      font-size: 8pt;
    }

    /* SIK YAPILAN HATALAR */
    .mistake-box {
      background: #fffbeb;
      border-color: #fde68a;
    }

    .mistake-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .wrong-card {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 6px;
      padding: 5px 8px;
    }

    .right-card {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 5px 8px;
    }

    .mistake-tag {
      font-size: 7.8pt;
      font-weight: 800;
      margin-bottom: 2px;
      text-transform: uppercase;
    }

    .wrong-tag { color: #be123c; }
    .right-tag { color: #047857; }

    .mistake-content {
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.65;
      word-break: break-word;
    }

    .mistake-reason {
      margin-top: 5px;
      font-size: 8.3pt;
      color: #78350f;
      line-height: 1.45;
    }

    .sheet-footer {
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 7.4pt;
      color: #64748b;
      font-weight: 600;
    }

    .footer-link {
      color: #087f5b;
      font-weight: 700;
    }
  `;
}

function printHtmlViaHiddenIframe(documentTitle: string, bodyHtml: string): void {
  if (typeof document === "undefined") return;

  const fullHtml = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Noto+Sans:wght@400;600;700;800&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet" />
  <style>${buildPrintStylesheet()}</style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

  let iframe = document.getElementById(
    "muallimun-grammar-print-iframe"
  ) as HTMLIFrameElement | null;

  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "muallimun-grammar-print-iframe";
    iframe.title = "Muallimun A4 Gramer PDF Yazdırma Katmanı";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(fullHtml);
  doc.close();

  const fontsReady =
    doc.fonts && typeof doc.fonts.ready?.then === "function"
      ? doc.fonts.ready.then(() => undefined).catch(() => undefined)
      : Promise.resolve();

  let triggered = false;
  const runPrint = () => {
    if (triggered) return;
    triggered = true;
    setTimeout(() => {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    }, 120);
  };

  Promise.race([
    fontsReady,
    new Promise<void>((resolve) => setTimeout(resolve, 1400)),
  ]).then(runPrint);
}

/**
 * Tekil A4 Dikey (Portrait) Gramer Ders Föyü PDF yazdırma / kaydetme penceresini tetikler.
 */
export function printSingleGrammarSheetPdf(card: GramerHapBilgi): void {
  const { level } = resolveCardLevelAndLesson(card);
  const docTitle = `Muallimun_${level}_${card.bagli_id}_${card.konu_basligi.slice(
    0,
    40
  )}`;
  const sheetHtml = renderSingleCardSheetHtml(card, {
    forcePageBreakBefore: false,
    includeQr: true,
  });
  printHtmlViaHiddenIframe(docTitle, sheetHtml);
}

export interface BookletContextOptions {
  levelFilter?: Level | "all";
  domainFilter?: GrammarDomainFilter;
  searchQuery?: string;
}

/**
 * Seçili kur ve/veya dil bilimsel alandaki tüm gramer kartlarını Kapak + İçindekiler + Her Konu Yeni A4 Sayfası
 * olacak şekilde Toplu Kur Gramer Kitapçığı PDF'i olarak hazırlar ve indirir.
 */
export function printGrammarBookletPdf(
  cards: GramerHapBilgi[],
  context?: BookletContextOptions
): void {
  if (!cards || cards.length === 0) return;

  const lvl = context?.levelFilter || "all";
  const dom = context?.domainFilter || "all";
  const domMeta = dom !== "all" ? GRAMMAR_DOMAINS[dom] : null;

  const levelPrefix = lvl !== "all" ? `${lvl} Kuru` : "A1–B2 Tüm Kurlar";
  const domainPart = domMeta
    ? `${domMeta.shortTitle}`
    : "Arapça Gramer Atlası";
  const mainBookletTitle =
    lvl !== "all" && domMeta
      ? `${lvl} Kuru — ${domMeta.shortTitle} Ders Kitapçığı`
      : lvl !== "all"
      ? `${lvl} Kuru Arapça Gramer Ders Kitapçığı`
      : domMeta
      ? `${domMeta.shortTitle} — Arapça Gramer Kitapçığı`
      : `Arapça Gramer Atlası — Kapsamlı Kur Kitapçığı`;

  const countsByLevel: Record<Level, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
  for (const c of cards) {
    const cLvl = resolveCardLevelAndLesson(c).level;
    countsByLevel[cLvl] = (countsByLevel[cLvl] || 0) + 1;
  }

  const atlasQr = generateQrSvg(
    "https://arapcatellaffuzwebv2.vercel.app/kutuphane?tab=gramer",
    84,
    { borderColor: "#087f5b", borderRadiusPx: 10, quietZone: 2 }
  );

  const dateStr = new Date().toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const coverHtml = `
    <section class="booklet-cover">
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <span class="cover-badge">MUALLİMUN ARAPÇA EĞİTİM KÜLLİYATI</span>
          <span style="font-size:9pt;font-weight:800;color:#065f46;">${escapeHtml(
            levelPrefix
          )} • ${cards.length} Konu</span>
        </div>

        <div class="cover-ar-kicker" dir="rtl" lang="ar">أَطْلَسُ الْقَوَاعِدِ النَّحْوِيَّةِ وَالصَّرْفِيَّةِ</div>
        <h1 class="cover-main-title">${escapeHtml(mainBookletTitle)}</h1>
        <p class="cover-subtitle">
          Tam harekeli örnek cümleler, görsel formül şemaları, adım adım konu anlatımları,
          karşılaştırmalı özet tablolar, kelime kelime i'rab tahlilleri ve sık yapılan hatalar rehberiyle
          A4 dikey ders ve çalışma kitapçığı.
        </p>

        <div class="cover-stats-grid">
          <div class="cover-stat-box">
            <div class="cover-stat-num">${cards.length}</div>
            <div class="cover-stat-lbl">Toplam Ders Föyü</div>
          </div>
          <div class="cover-stat-box">
            <div class="cover-stat-num">${countsByLevel.A1 + countsByLevel.A2}</div>
            <div class="cover-stat-lbl">Temel (A1–A2)</div>
          </div>
          <div class="cover-stat-box">
            <div class="cover-stat-num">${countsByLevel.B1 + countsByLevel.B2}</div>
            <div class="cover-stat-lbl">Orta &amp; İleri (B1–B2)</div>
          </div>
          <div class="cover-stat-box">
            <div class="cover-stat-num">4 Alan</div>
            <div class="cover-stat-lbl">${escapeHtml(domainPart)}</div>
          </div>
        </div>
      </div>

      <div class="student-info-box">
        <div>Öğrenci / Öğretmen Adı: .........................................................</div>
        <div>Sınıf / Kur Grubu: ..............................................................</div>
        <div>Çalışma Başlangıç Tarihi: ....................................................</div>
        <div>Hazırlanma Tarihi: ${escapeHtml(dateStr)}</div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1.5px solid #cbd5e1;padding-top:12px;">
        <div>
          <div style="font-size:10pt;font-weight:800;color:#065f46;">Muallimun Arapça — İnteraktif Dijital Kütüphane</div>
          <div style="font-size:8.4pt;color:#475569;margin-top:2px;">
            Her ders föyündeki karekodu okutarak konunun sesli örneklerini dinleyebilir ve interaktif tarama testini çözebilirsiniz.
          </div>
        </div>
        <div>${atlasQr}</div>
      </div>
    </section>
  `;

  const tocRowsHtml = cards
    .map((card, idx) => {
      const { level } = resolveCardLevelAndLesson(card);
      const dMeta = GRAMMAR_DOMAINS[classifyGrammarCardDomain(card)];
      return `
        <tr>
          <td style="width:7%;font-weight:800;color:#087f5b;text-align:center;">${
            idx + 1
          }</td>
          <td style="width:9%;text-align:center;">
            <span class="badge badge-level level-${level.toLowerCase()}">${escapeHtml(
              level
            )}</span>
          </td>
          <td style="width:28%;font-weight:700;color:#334155;">${escapeHtml(
            dMeta.emoji
          )} ${escapeHtml(dMeta.shortTitle)}</td>
          <td style="width:56%;font-weight:700;color:#0f172a;">${renderMixedPrintHtml(
            card.konu_basligi
          )}</td>
        </tr>
      `;
    })
    .join("");

  const tocHtml = `
    <section class="toc-section page-break-before">
      <h2 class="toc-title">📑 İçindekiler — ${escapeHtml(
        mainBookletTitle
      )} (${cards.length} Konu)</h2>
      <table class="toc-table">
        <thead>
          <tr>
            <th style="text-align:center;">No</th>
            <th style="text-align:center;">Seviye</th>
            <th>Dil Bilimsel Alan</th>
            <th>Gramer Konu Başlığı</th>
          </tr>
        </thead>
        <tbody>
          ${tocRowsHtml}
        </tbody>
      </table>
    </section>
  `;

  // Çok büyük kitapçıklarda (ör. 195 kart) render hızını yüksek tutmak için QR kodları ilk 60 veya tekil kurda tam, 195'te de hızlı SVG olarak eklenir
  const pagesHtml = cards
    .map((card, idx) =>
      renderSingleCardSheetHtml(card, {
        indexNumber: idx + 1,
        totalCount: cards.length,
        forcePageBreakBefore: true,
        includeQr: true,
      })
    )
    .join("\n");

  const docTitle = `Muallimun_Gramer_Kitapcigi_${
    lvl !== "all" ? lvl : "Tum_Kurlar"
  }_${cards.length}_Konu`;

  printHtmlViaHiddenIframe(docTitle, `${coverHtml}\n${tocHtml}\n${pagesHtml}`);
}
