import { ImageResponse } from "next/og";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";

export const alt =
  "Muallimun Arapça — İnteraktif Dil, Telaffuz, Oyun & Sınav Stüdyosu";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function formatTrCount(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

interface BentoStatItem {
  count: string;
  accentColor: string;
  title: string;
  subtitle: string;
}

export default function OpenGraphImage() {
  const featureBadges: string[] = [
    "🎙️ Canlı Gölgeleme & STT Analizi",
    `🎮 ${CONTENT_INVENTORY.exerciseModulesCount} İnteraktif Oyun & Alıştırma`,
    "🖨️ 2 Sütunlu A4 PDF Sınav Stüdyosu",
    `🎬 ${CONTENT_INVENTORY.youtubeVideosCount} Seçkin Video & İzleme Rehberi`,
  ];

  const bentoStats: BentoStatItem[] = [
    {
      count: formatTrCount(CONTENT_INVENTORY.dialoguesCount),
      accentColor: "#087F5B",
      title: "Sesli Diyalog",
      subtitle: "A1–B2 Günlük Senaryo",
    },
    {
      count: formatTrCount(CONTENT_INVENTORY.readingsCount),
      accentColor: "#087F5B",
      title: "Okuma Metni",
      subtitle: "Anlama & Kanıt Sorulu",
    },
    {
      count: formatTrCount(CONTENT_INVENTORY.sentencesCount),
      accentColor: "#6741D9",
      title: "Kalıp Cümle",
      subtitle: "Çift Sesli & Odak Kalıplı",
    },
    {
      count: formatTrCount(CONTENT_INVENTORY.grammarNotesCount),
      accentColor: "#D97706",
      title: "Gramer Atlası",
      subtitle: "Şemalı & İ'rab Tahlilli",
    },
    {
      count: formatTrCount(CONTENT_INVENTORY.visualWordsCount),
      accentColor: "#0284C7",
      title: "Görsel Kelime",
      subtitle: "Resimli & Oyun Havuzlu",
    },
    {
      count: formatTrCount(CONTENT_INVENTORY.assessmentQuestionsCount),
      accentColor: "#E11D48",
      title: "Sınav Sorusu",
      subtitle: "CAT • 44 KTT • Kur Sınavı",
    },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "linear-gradient(135deg, #042F2E 0%, #064E3B 48%, #1E1B4B 100%)",
          padding: "28px",
          fontFamily: "sans-serif",
          color: "#1C1917",
        }}
      >
        {/* Ana Sıcak Fildişi / Krem Tuval */}
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background:
              "linear-gradient(135deg, #FDFBF7 0%, #F7EFE1 65%, #ECFDF5 100%)",
            borderRadius: "32px",
            border: "3px solid #D9C7A8",
            padding: "40px 46px",
          }}
        >
          {/* 1. ÜST BAR: Kurumsal Kimlik & Domain Şeridi */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {/* Sol: Zümrüt Yeşili İkon Kutusu + Koyu Zümrüt Kurumsal Rozet + Domain */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  backgroundColor: "#087F5B",
                  color: "#FFFFFF",
                  fontSize: 20,
                  fontWeight: 900,
                  boxShadow: "0 4px 12px rgba(8, 127, 91, 0.25)",
                }}
              >
                📖
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "7px 14px",
                  borderRadius: "14px",
                  backgroundColor: "#064E3B",
                  color: "#ECFDF5",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                }}
              >
                <div style={{ display: "flex" }}>
                  MUALLİMUN ARAPÇA EĞİTİM PLATFORMU
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: "8px",
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.01em",
                  }}
                >
                  🌐 app.muallimun.net
                </div>
              </div>
            </div>

            {/* Sağ: Mor (#6741D9) ve Kehribar (#D97706) İki Rozet */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#F3F0FF",
                  border: "2px solid #6741D9",
                  color: "#6741D9",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                CEFR A1 • A2 • B1 • B2
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFBEB",
                  border: "2px solid #D97706",
                  color: "#D97706",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                ✨ v2.5 Tam Sürüm
              </div>
            </div>
          </div>

          {/* 2. ORTA GÖVDE: Sol Marka & Özellikler | Sağ 6'lı Bento İstatistik Vitrin */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            {/* Sol Sütun */}
            <div
              style={{
                display: "flex",
                width: "54%",
                flexDirection: "column",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 54,
                    fontWeight: 900,
                    color: "#064E3B",
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Muallimun Arapça
                </div>

                <div
                  style={{
                    display: "flex",
                    fontSize: 28,
                    fontWeight: 800,
                    color: "#4C28B5",
                    lineHeight: 1.18,
                  }}
                >
                  İnteraktif Dil, Telaffuz, Oyun &amp; Sınav Stüdyosu
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 600,
                  color: "#44403C",
                  lineHeight: 1.38,
                }}
              >
                Doğal Çift Cinsiyetli Seslendirme • 38 Çiftlik Yapay Zeka Mahreç
                Koçu • Morfolojik Kök Sözlüğü • A/B Kitapçıklı A4 Sınav
                Üreticisi
              </div>

              {/* 2x2 Özellik Rozetleri */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  width: "100%",
                }}
              >
                {featureBadges.map((badge) => (
                  <div
                    key={badge}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "48.5%",
                      padding: "9px 12px",
                      borderRadius: "14px",
                      backgroundColor: "#FFFFFF",
                      border: "2px solid #D9C7A8",
                      color: "#1C1917",
                      fontSize: 14,
                      fontWeight: 800,
                      boxShadow: "0 4px 10px rgba(6, 78, 59, 0.05)",
                    }}
                  >
                    {badge}
                  </div>
                ))}
              </div>
            </div>

            {/* Sağ Sütun: 2x3 (6 Adet) Bento İstatistik Kartı */}
            <div
              style={{
                width: "43%",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignContent: "center",
                justifyContent: "space-between",
              }}
            >
              {bentoStats.map((item) => (
                <div
                  key={item.title}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    width: "48%",
                    padding: "14px 16px",
                    borderRadius: "20px",
                    backgroundColor: "#FFFFFF",
                    border: "2px solid #E6D7BE",
                    boxShadow: "0 8px 20px rgba(8,127,91,0.08)",
                    gap: "2px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      fontSize: 30,
                      fontWeight: 900,
                      lineHeight: 1.05,
                      color: item.accentColor,
                    }}
                  >
                    {item.count}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 16,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: "#1C1917",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: 1.2,
                      color: "#57534E",
                    }}
                  >
                    {item.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. ALT ŞERİT: Tam Genişlik Güvence & Sözlük Barı */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background:
                "linear-gradient(90deg, #065F46 0%, #087F5B 50%, #4C28B5 100%)",
              color: "#FFFFFF",
              borderRadius: "18px",
              padding: "14px 24px",
              fontSize: 19,
              fontWeight: 800,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              {`📚 ${formatTrCount(CONTENT_INVENTORY.dictionaryWordsCount)} Kelimelik Kök Sözlüğü • ${formatTrCount(CONTENT_INVENTORY.proverbsCount)} Atasözü • ${formatTrCount(CONTENT_INVENTORY.synonymsAntonymsCount)} Eş & Zıt Anlamlılar Atlası`}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 15,
                fontWeight: 800,
                color: "#FEF3C7",
              }}
            >
              Ücretsiz • Reklamsız • Akıllı Tahta &amp; Mobil Uyumlu
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
