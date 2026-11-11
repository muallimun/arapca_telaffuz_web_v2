import { MetadataRoute } from "next";
import { CONTENT_INVENTORY } from "@/lib/data";

export default function manifest(): MetadataRoute.Manifest {
  const {
    dialoguesCount,
    readingsCount,
    sentencesCount,
    visualWordsCount,
    dictionaryWordsCount,
    exerciseModulesCount,
  } = CONTENT_INVENTORY;

  return {
    id: "/",
    name: "Muallimun Arapça — İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu",
    short_name: "Muallimun Arapça",
    description: `İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu — ${dialoguesCount} CEFR diyalog, ${readingsCount} okuma metni, 180 soruluk Seviye Tespit & Konu Tarama Merkezi, ${sentencesCount} kalıp cümle, ${visualWordsCount} görsel kelime, morfolojik sözlük ve ${exerciseModulesCount} modüllü interaktif alıştırma merkezi.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FAF6EE",
    theme_color: "#059669",
    categories: ["education", "books", "productivity"],
    lang: "tr",
    dir: "ltr",
    icons: [
      {
        src: "/icons/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Diyalog ve Metin Kütüphanesi",
        short_name: "Kütüphane",
        description: `${dialoguesCount} sesli diyalog, ${readingsCount} okuma metni ve ${sentencesCount} kalıp cümleyi incele`,
        url: "/kutuphane",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Alıştırma Merkezi",
        short_name: "Alıştırmalar",
        description: `${exerciseModulesCount} modüllü kelime, cümle, gramer ve telaffuz alıştırmaları`,
        url: "/alistirmalar",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "İnteraktif Sözlük",
        short_name: "Sözlük",
        description: `${dictionaryWordsCount} sözlük kaydı, ${visualWordsCount} görsel kelime ve kök analizi`,
        url: "/sozluk",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Uygulama Ayarları",
        short_name: "Ayarlar",
        description: "Yazı tipi, ses hızı ve gölgeleme ayarları",
        url: "/ayarlar",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
  };
}