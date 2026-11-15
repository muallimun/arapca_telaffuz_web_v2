import type { Metadata, Viewport } from "next";
import Header from "@/components/layout/Header";
import SettingsEffects from "@/components/layout/SettingsEffects";
import MobileNav from "@/components/layout/MobileNav";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import AudioStopper from "@/components/AudioStopper";
import OnboardingTourModal from "@/components/ui/OnboardingTourModal";
import GuideAndInfoModal from "@/components/ui/GuideAndInfoModal";
import ScrollToTopButton from "@/components/ui/ScrollToTopButton";
import AppIntroSplash from "@/components/ui/AppIntroSplash";
import ShareAppModal from "@/components/ui/ShareAppModal";
import FeedbackModal from "@/components/ui/FeedbackModal";
import InAppBrowserBanner from "@/components/ui/InAppBrowserBanner";
import SmartboardMount from "@/components/classroom/SmartboardMount";
import ConditionalFooter from "@/components/layout/ConditionalFooter";
import { CONTENT_INVENTORY } from "@/lib/contentInventory";
import "./globals.css";

const APP_SUBTITLE =
  "İnteraktif Arapça Kütüphane, Sözlük, Oyun ve Sınav Platformu";

const APP_FULL_DESCRIPTION = `${APP_SUBTITLE} — ${CONTENT_INVENTORY.dialoguesCount} CEFR Arapça diyalog, ${CONTENT_INVENTORY.readingsCount} okuma metni, ${CONTENT_INVENTORY.assessmentQuestionsCount} soruluk Seviye Tespit ve Konu Tarama Merkezi, ${CONTENT_INVENTORY.sentencesCount} kalıp cümle, ${CONTENT_INVENTORY.visualWordsCount} görsel kelime, 38 çiftlik Mahreç Koçu, morfolojik kök sözlüğü, ${CONTENT_INVENTORY.exerciseModulesCount} modüllü interaktif alıştırma merkezi ve A4 PDF çalışma kağıdı üreticisi.`;

export const metadata: Metadata = {
  metadataBase: new URL("https://app.muallimun.net"),
  title: {
    default: `Muallimun Arapça — ${APP_SUBTITLE}`,
    template: "%s | Muallimun Arapça",
  },
  description: APP_FULL_DESCRIPTION,
  applicationName: "Muallimun Arapça",
  keywords: [
    "Muallimun Arapça",
    "Arapça diyaloglar",
    "Arapça okuma metinleri",
    "Arapça seviye tespit sınavı",
    "Arapça konu tarama testleri",
    "Arapça telaffuz koçu",
    "Arapça mahreç eğitimi",
    "morfolojik Arapça sözlük",
    "Arapça interaktif oyunlar",
    "Arapça çalışma kağıdı PDF",
    "CEFR Arapça A1 A2 B1 B2",
  ],
  authors: [{ name: "Muallimun", url: "https://muallimun.net" }],
  creator: "Muallimun",
  publisher: "Muallimun",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Muallimun Arapça",
  },
  openGraph: {
    title: `Muallimun Arapça — ${APP_SUBTITLE}`,
    description: APP_FULL_DESCRIPTION,
    url: "https://app.muallimun.net",
    siteName: "Muallimun Arapça",
    locale: "tr_TR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `Muallimun Arapça — ${APP_SUBTITLE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Muallimun Arapça — ${APP_SUBTITLE}`,
    description: APP_FULL_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    shortcut: ["/icons/favicon.ico"],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Lateef:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased flex flex-col min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-x-clip selection:bg-[#087F5B]/20">
        <SettingsEffects />
        <AppIntroSplash />
        <ServiceWorkerRegister />
        <AudioStopper />
        <OnboardingTourModal />
        <GuideAndInfoModal />
        <ShareAppModal />
        <FeedbackModal />
        <InAppBrowserBanner />
        <SmartboardMount />
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-2.5 sm:px-6 pt-3 md:pt-6 pb-6 lg:pb-8">
          {children}
        </main>
        <ScrollToTopButton />
        <MobileNav />
        <ConditionalFooter appSubtitle={APP_SUBTITLE} />
      </body>
    </html>
  );
}