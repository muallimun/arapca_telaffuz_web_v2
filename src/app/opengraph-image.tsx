import { ImageResponse } from "next/og";

export const alt =
  "Muallimun Arapça — İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background:
            "linear-gradient(135deg, #FDFBF7 0%, #F7EFE1 55%, #E6FCF5 100%)",
          border: "14px solid #087F5B",
          fontFamily: "sans-serif",
          color: "#1E1B18",
        }}
      >
        {/* ÜST ROZET */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 26px",
              borderRadius: "999px",
              backgroundColor: "#087F5B",
              color: "#FFFFFF",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.04em",
              boxShadow: "0 6px 18px rgba(8, 127, 91, 0.22)",
            }}
          >
            MUALLİMUN EĞİTİM PLATFORMU • app.muallimun.net
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 22px",
              borderRadius: "18px",
              backgroundColor: "#F3F0FF",
              border: "3px solid #6741D9",
              color: "#4C28B5",
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            CEFR A1 – B2 • PWA v2.0
          </div>
        </div>

        {/* ORTA ANA BAŞLIK VE ALT AÇIKLAMA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            marginTop: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 900,
              lineHeight: 1.12,
              color: "#087F5B",
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            Muallimun Arapça
          </div>

          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              lineHeight: 1.4,
              color: "#3D372E",
              display: "flex",
            }}
          >
            İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu —
            Sesli Diyaloglar, Mahreç Analizi, Kök Sözlüğü ve Çalışma Stüdyosu
          </div>
        </div>

        {/* ALT ÖZELLİK ŞERİDİ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 28px",
            borderRadius: "24px",
            backgroundColor: "#087F5B",
            borderBottom: "6px solid #087F5B",
            color: "#FFFFFF",
            fontSize: 23,
            fontWeight: 800,
            textAlign: "center",
            width: "100%",
          }}
        >
          120 Diyalog • 60 Okuma Metni • 180 Soruluk Sınav • 1111 Cümle • 14
          Modüllü Oyun &amp; Alıştırma
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
