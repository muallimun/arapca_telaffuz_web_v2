"use client";

import { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  Mic,
  Headphones,
  BookOpen,
  Columns2,
  Sparkles,
  QrCode,
  Printer,
  School,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { getDynamicKttTopicCount, type RehberRole } from "@/lib/rehberCurriculum";
import { playClick } from "@/lib/sfxManager";

interface MethodProps {
  role: RehberRole;
}

export function RehberMethodologyTab({ role }: MethodProps) {
  if (role === "learner") {
    return (
      <div className="space-y-6">
        {/* 0. Gün: Kurulum & Tanı */}
        <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#087F5B] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
                Başlangıç Protokolü • 0. Gün (10 Dakika)
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                Öğretmensiz Çalışmaya Başlamadan Önce 3 Hazırlık Adımı
              </h2>
            </div>
            <Link
              href="/seviye-tespit?mode=cat&autostart=1"
              onClick={() => playClick()}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              <span>15 Soruluk CAT Testini Başlat</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1.5">
              <div className="text-xs font-extrabold text-[#6741D9] dark:text-purple-300 tabular-nums">
                1. Adım • Tanı Testi (3–5 dk)
              </div>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                Adaptif CAT Seviye Tespit (A1–B2)
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Sıfırdan başlıyorsanız doğrudan{" "}
                <strong className="text-[var(--foreground)]">A1 1. Hafta</strong>{" "}
                ile başlayın; temeliniz varsa 15 soruluk CAT testini çözerek tam
                kurunuzu belirleyin.
              </p>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1.5">
              <div className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums">
                2. Adım • Ergonomi Ayarı (2 dk)
              </div>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                Ses Cinsiyeti, Hız ve Arapça Font
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Üst çubuktaki <strong className="text-[var(--foreground)]">T</strong>{" "}
                menüsünden gözünüze en rahat gelen Arapça fontu/puntoyu, başlangıç için{" "}
                <strong className="text-[var(--foreground)]">0.75x veya 1x</strong>{" "}
                ses hızını ve{" "}
                <strong className="text-[var(--foreground)]">Tam Harekeli</strong>{" "}
                modu seçin.
              </p>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/70 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 space-y-1.5">
              <div className="text-xs font-extrabold text-[#D97706] dark:text-amber-300 tabular-nums">
                3. Adım • Uygulama Kurulumu (3 dk)
              </div>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                PWA Ana Ekrana Ekle &amp; Çevrimdışı Paket
              </h3>
              <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                Sağ üst <strong className="text-[var(--foreground)]">⋯</strong>{" "}
                menüsünden uygulamayı telefon/tablet ana ekranına kurun ve{" "}
                <strong className="text-[var(--foreground)]">/ayarlar</strong>{" "}
                sayfasından kurunuzun ses paketini indirin.
              </p>
            </div>
          </div>
        </section>

        {/* Bir Diyaloğu Tek Başına 5 Adımda Özümseme Yöntemi */}
        <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
                Çekirdek Metodoloji • 15 Dakikada Kalıcı Öğrenme
              </span>
              <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                Bir Diyaloğu Kendi Başına 5 Adımda Özümseme Yöntemi
              </h2>
            </div>
            <Link
              href="/diyalog/dlg_001"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              <span>Diyalog 1 Üzerinde Uygula</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              {
                step: "1. Adım",
                duration: "3 dk",
                icon: Headphones,
                title: "Canlı Ok Takipli Dinleme",
                desc: "Önce 0.75x, ardından 1x hızda erkek ve kadın spikerden diyaloğu baştan sona dinleyin; gözünüzle satır takibini kaçırmayın.",
              },
              {
                step: "2. Adım",
                duration: "4 dk",
                icon: BookOpen,
                title: "Tıkla-Gör & Kök Analizi",
                desc: "Üstteki T menüsünden 'Tıkla-Gör (Çeviri Gizli)' moduna geçip anlamı tahmin edin. Bilmediğiniz kelimelere tıklayıp kök/sarf kartını inceleyin ve ❤️ Defterim'e ekleyin.",
              },
              {
                step: "3. Adım",
                duration: "3 dk",
                icon: Columns2,
                title: "📐 Yan Yana Gramer İncelemesi",
                desc: "Üst araç çubuğundan 'Yan Yana Gramer' panelini açın; kuralın diyalog cümlesi içinde nasıl uygulandığını (A1'de sade, ileri kurda i'rablı) görün.",
              },
              {
                step: "4. Adım",
                duration: "3 dk",
                icon: Mic,
                title: "🎤 Gölgeleme & 38 Mahreç Koçu",
                desc: "Her cümleyi spikerden hemen sonra yüksek sesle tekrar edip kaydedin; yapay zekâ mahreç koçundan harf bazlı telaffuz puanınızı alın.",
              },
              {
                step: "5. Adım",
                duration: "2 dk",
                icon: Sparkles,
                title: "🎭 Rol Yapma & Tamamlama",
                desc: "'Rol Yapma' sekmesine geçip karakterlerden birini üstlenin, diyaloğu eksiksiz tamamlayıp 'Tamamlandı (✓)' rozetini yakın!",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3.5 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#087F5B] text-white text-[11px] font-extrabold tabular-nums">
                        {item.step}
                      </span>
                      <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-purple-300 tabular-nums">
                        {item.duration}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Icon size={15} className="text-[#087F5B] shrink-0" />
                      <h3 className="text-xs sm:text-sm font-extrabold text-[var(--foreground)] leading-snug">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Okuma Metni + Hata Telafisi İpuçları */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-2.5">
            <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] flex items-center gap-2">
              <BookOpen size={17} className="text-[#087F5B]" />
              <span>Okuma Metinleri Nasıl Çalışılmalı?</span>
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              Okuma metinlerinde önce{" "}
              <strong className="text-[var(--foreground)]">👁️ Kör Dinleme</strong>{" "}
              ile metne bakmadan genel konuyu yakalamaya çalışın. Ardından metni açıp
              sesli okuyun, metin sonundaki kavrama sorularını çözün ve{" "}
              <strong className="text-[var(--foreground)]">
                Metin Kanıt Dedektifi
              </strong>{" "}
              modülünde cevabın geçtiği kanıt cümlesini bularak analitik okuma becerinizi
              keskinleştirin.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-2.5">
            <h3 className="text-sm sm:text-base font-black text-[var(--foreground)] flex items-center gap-2">
              <ShieldCheck size={17} className="text-[#6741D9]" />
              <span>Unutmayı Engelleyen SRS + Hata Defteri Döngüsü</span>
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              Yeni ders geçmek kadar eskiyi korumak da kritiktir. Her çalışmanın ilk
              5 dakikasını mutlaka{" "}
              <strong className="text-[var(--foreground)]">
                ⏰ SRS Günlük Tekrar
              </strong>{" "}
              ve{" "}
              <strong className="text-[var(--foreground)]">
                ⚡ Hata Defterim
              </strong>{" "}
              havuzuna ayırın; 5 kademeyi tamamlayan kelimeler kalıcı hafızaya
              aktarılır.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // TEACHER ROLE METHODOLOGY
  return (
    <div className="space-y-6">
      {/* 40 Dakikalık Standart Akıllı Tahta Ders Akışı */}
      <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#6741D9] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
              Sınıf Yönetimi • Akıllı Tahta &amp; Projeksiyon Protokolü
            </span>
            <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
              40 Dakikalık Standart Akıllı Tahta Ders İşleniş Akışı
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/diyalog/dlg_001"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Tahta Modunda Diyalog Aç</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              href="/alistirmalar?mode=classroom-battle"
              onClick={() => playClick()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>🏆 Sınıf Yarışmasını Aç</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#087F5B] text-white text-xs font-extrabold tabular-nums">
                0–5. Dakika
              </span>
              <span className="text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-300">
                1. Isınma
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
              👁️ Kör Dinleme ile Konu Tahmini
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              Diyaloğu akıllı tahtada{" "}
              <strong className="text-[var(--foreground)]">Kör Dinleme</strong>{" "}
              modunda (metin gizli) açın. Sesi bir kez dinletip sınıfa{" "}
              <em>&ldquo;Konuşanlar neredeler, ne hakkında konuşuyorlar, hangi kelimeleri yakaladınız?&rdquo;</em>{" "}
              sorularıyla kulak kesilmelerini sağlayın.
            </p>
          </div>

          <div className="rounded-xl bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#6741D9] text-white text-xs font-extrabold tabular-nums">
                5–20. Dakika
              </span>
              <span className="text-[11px] font-extrabold text-[#6741D9] dark:text-purple-300">
                2. Sunum &amp; Tahlil
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
              📐 Yan Yana Gramer + Tahta Perdesi
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              <strong className="text-[var(--foreground)]">
                Sınıf / Tahta Sunum Modu
              </strong>{" "}
              ve{" "}
              <strong className="text-[var(--foreground)]">Yan Yana Gramer</strong>{" "}
              ekranını açın.{" "}
              <strong className="text-[var(--foreground)]">🖊️ Akıllı Tahta</strong>{" "}
              kalemi, fosforlu kalem, ok/şekil ve{" "}
              <strong className="text-[var(--foreground)]">Sahne Perdesi</strong>{" "}
              ile alt satırları gizleyerek cümle cümle kök ve i&apos;rab odaklaması yapın.
            </p>
          </div>

          <div className="rounded-xl bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#D97706] text-white text-xs font-extrabold tabular-nums">
                20–30. Dakika
              </span>
              <span className="text-[11px] font-extrabold text-[#B45309] dark:text-amber-300">
                3. Etkileşim &amp; Konuşma
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
              🎲 Kura Çarkı + 👥 İkili (A/B) Kartlar
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              <strong className="text-[var(--foreground)]">
                🎲 Sınıf Kura Çarkı
              </strong>{" "}
              (tekrarsız seçim açık) ile iki öğrenci kaldırıp tahtada{" "}
              <strong className="text-[var(--foreground)]">🎭 Rol Yapma</strong>{" "}
              uygulatın. Ardından tüm sıralarda{" "}
              <strong className="text-[var(--foreground)]">
                👥 İkili Bilgi Boşluğu (A/B) Kartları
              </strong>{" "}
              açıp <strong className="text-[var(--foreground)]">⏱️ Ders Sayacı</strong>{" "}
              ile 5 dakikalık eşli konuşma yaptırın.
            </p>
          </div>

          <div className="rounded-xl bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-[#065F46] text-white text-xs font-extrabold tabular-nums">
                30–40. Dakika
              </span>
              <span className="text-[11px] font-extrabold text-[#087F5B] dark:text-emerald-300">
                4. Yarışma &amp; Ödev
              </span>
            </div>
            <h3 className="text-sm font-extrabold text-[var(--foreground)]">
              🏆 Tahta Yarışması + 🎯 Karekod Ödev
            </h3>
            <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
              Sınıfı 2–4 gruba ayırıp{" "}
              <strong className="text-[var(--foreground)]">
                🏆 Sınıf Takım Yarışması
              </strong>{" "}
              veya <strong className="text-[var(--foreground)]">Hata Avcısı</strong>{" "}
              oynatın. Zil çalmadan{" "}
              <strong className="text-[var(--foreground)]">🎯 Ödev &amp; Paylaş</strong>{" "}
              ile tahtada dev QR kod açın ve{" "}
              <strong className="text-[var(--foreground)]">📄 A4 PDF</strong>{" "}
              menüsünden <em>Temiz Ders Föyü</em> veya{" "}
              <em>Kes-Katla Kelime Kartları</em> dağıtın.
            </p>
          </div>
        </div>
      </section>

      {/* Öğretmen Araç Kutusu Kısa İpuçları */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--foreground)]">
            <QrCode size={17} className="text-[#6741D9]" />
            <span>Sıfır Kayıtla Karekodlu Ev Ödevi</span>
          </div>
          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            Öğrencilerin üye olmasına gerek yoktur. Tahtadaki karekodu okutan veya
            WhatsApp ödev linkine tıklayan öğrenci doğrudan o dersin telaffuz ve
            alıştırma stüdyosuna iner.
          </p>
        </div>

        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--foreground)]">
            <Printer size={17} className="text-[#087F5B]" />
            <span>A4 Sınav &amp; Çalışma Kağıdı Stüdyosu</span>
          </div>
          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            Diyalog/metin içinden tek sayfa ders föyü;{" "}
            <strong className="text-[var(--foreground)]">/seviye-tespit</strong>{" "}
            içinden ise A/B kitapçıklı, 6 bölümlü yazılı yoklama kağıdı ve çözümlü
            öğretmen cevap anahtarı basabilirsiniz.
          </p>
        </div>

        <div className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--foreground)]">
            <Users size={17} className="text-[#D97706]" />
            <span>İnternetsiz Akıllı Tahta Güvencesi</span>
          </div>
          <p className="text-xs font-medium text-[var(--muted)] leading-relaxed">
            Okul interneti kesintiliyse{" "}
            <strong className="text-[var(--foreground)]">/ayarlar</strong>{" "}
            sayfasından işleyeceğiniz kurun ses paketlerini öğretmen bilgisayarına veya
            akıllı tahtaya önceden indirerek sıfır gecikmeyle ders işleyin.
          </p>
        </div>
      </section>
    </div>
  );
}

export function RehberScheduleTab({ role }: MethodProps) {
  const [teacherScenarioView, setTeacherScenarioView] = useState<
    "both" | "meb" | "intensive"
  >("both");
  const kttTopicCount = getDynamicKttTopicCount();

  if (role === "learner") {
    return (
      <div className="space-y-6">
        {/* Günlük 30 Dakikalık İdeal Çalışma Rutini Tablosu */}
        <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#087F5B] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#087F5B] text-white flex items-center justify-center shrink-0">
                <Clock size={18} />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#087F5B] dark:text-emerald-300">
                  Günlük Plan • Her Gün 30 Dakika
                </span>
                <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                  Bireysel Öğrenen İçin Günlük 30 Dakikalık İdeal Rutin
                </h2>
              </div>
            </div>
            <Link
              href="/"
              onClick={() => playClick()}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#087F5B] hover:bg-[#065F46] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              <span>Bugünkü Rotamı Aç</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7EFE1] dark:bg-[var(--background)] text-[var(--foreground)] border-b border-[#E6D7BE] dark:border-[var(--border)]">
                  <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">
                    Zaman Dilimi
                  </th>
                  <th className="py-2.5 px-3 font-extrabold whitespace-nowrap">
                    Hedef Modül
                  </th>
                  <th className="py-2.5 px-3 font-extrabold">
                    Uygulanacak Çalışma Adımı
                  </th>
                  <th className="py-2.5 px-3 font-extrabold text-right whitespace-nowrap">
                    Hızlı Geçiş
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6D7BE]/70 dark:divide-[var(--border)]">
                <tr>
                  <td className="py-3 px-3 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                    0–5. dk (5 dk)
                  </td>
                  <td className="py-3 px-3 font-bold text-[var(--foreground)]">
                    /alistirmalar
                  </td>
                  <td className="py-3 px-3 text-[var(--muted)] font-medium">
                    <strong className="text-[var(--foreground)]">
                      ⏰ SRS Günlük Tekrar
                    </strong>{" "}
                    ve{" "}
                    <strong className="text-[var(--foreground)]">
                      ⚡ Hata Defterim
                    </strong>{" "}
                    havuzundaki vadesi gelen kelimeleri eriterek zihni ısıtın.
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href="/alistirmalar?plan=daily"
                      onClick={() => playClick()}
                      className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 underline"
                    >
                      Başlat →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-extrabold text-[#6741D9] dark:text-purple-300 tabular-nums whitespace-nowrap">
                    5–20. dk (15 dk)
                  </td>
                  <td className="py-3 px-3 font-bold text-[var(--foreground)]">
                    /diyalog/[id]
                  </td>
                  <td className="py-3 px-3 text-[var(--muted)] font-medium">
                    Günün <strong className="text-[var(--foreground)]">1 Yeni Diyaloğunu</strong>{" "}
                    5 adımla (Dinle → Tıkla-Gör &amp; Kök → Odak Gramer → Gölgeleme/Mahreç → Rol Yapma) bitirin.
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href="/kutuphane?tab=diyaloglar"
                      onClick={() => playClick()}
                      className="text-xs font-extrabold text-[#6741D9] dark:text-purple-300 underline"
                    >
                      Diyaloglar →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-extrabold text-[#B45309] dark:text-amber-300 tabular-nums whitespace-nowrap">
                    20–25. dk (5 dk)
                  </td>
                  <td className="py-3 px-3 font-bold text-[var(--foreground)]">
                    /kutuphane
                  </td>
                  <td className="py-3 px-3 text-[var(--muted)] font-medium">
                    Hazine takviyesi:{" "}
                    <strong className="text-[var(--foreground)]">5 Görsel Kelime</strong>{" "}
                    +{" "}
                    <strong className="text-[var(--foreground)]">5 Günlük Kalıp Cümle</strong>{" "}
                    +{" "}
                    <strong className="text-[var(--foreground)]">2 Atasözü</strong>{" "}
                    dinleyip yüksek sesle tekrar edin.
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href="/kutuphane?tab=gorsel-kelimeler"
                      onClick={() => playClick()}
                      className="text-xs font-extrabold text-[#B45309] dark:text-amber-300 underline"
                    >
                      Kütüphane →
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                    25–30. dk (5 dk)
                  </td>
                  <td className="py-3 px-3 font-bold text-[var(--foreground)]">
                    Oyun / Üretim
                  </td>
                  <td className="py-3 px-3 text-[var(--muted)] font-medium">
                    Aktif üretim kapanışı: Gün aşırı dönüşümlü olarak{" "}
                    <strong className="text-[var(--foreground)]">Balon Safari</strong>,{" "}
                    <strong className="text-[var(--foreground)]">Kör Dikte</strong>{" "}
                    veya{" "}
                    <strong className="text-[var(--foreground)]">
                      İ&apos;rab Renkleriyle Boya
                    </strong>{" "}
                    oynayın.
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <Link
                      href="/alistirmalar?mode=balloon-safari"
                      onClick={() => playClick()}
                      className="text-xs font-extrabold text-[#087F5B] dark:text-emerald-300 underline"
                    >
                      Oyna →
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Haftalık Döngü (5 + 1 + 1 Sistemi) */}
        <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
          <div className="border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
              Haftalık Ritim • 5 + 1 + 1 Sistemi
            </span>
            <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
              Yorulmadan İstikrar Sağlayan Haftalık Çalışma Döngüsü
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#087F5B] text-white text-xs font-extrabold">
                Pazartesi – Cuma (5 Gün)
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                İletişim &amp; Kelime İnşası
              </h3>
              <ul className="space-y-1 text-xs font-medium text-[var(--muted)] leading-relaxed">
                <li>• Günde 1 yeni diyalog → Haftada <strong>5 Diyalog</strong></li>
                <li>• Toplam <strong>25 Görsel Kelime</strong> + <strong>25 Kalıp Cümle</strong></li>
                <li>• Toplam <strong>10 Atasözü</strong> + günlük 5 dk SRS tekrar</li>
                <li>• Her diyaloğun bağlı <strong>Odak Gramer</strong> kartı</li>
              </ul>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#6741D9] text-white text-xs font-extrabold">
                Cumartesi (1 Gün)
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                Bağlam, Okuma &amp; Dinleme Günü
              </h3>
              <ul className="space-y-1 text-xs font-medium text-[var(--muted)] leading-relaxed">
                <li>
                  • Kur planına göre <strong>2–4 Okuma Metni</strong> + metin altı soruları
                </li>
                <li>
                  • <strong>Metin Kanıt Dedektifi</strong> ile kanıt cümlesi avı
                </li>
                <li>
                  • <strong>Video Rehberi</strong> sekmesinden 2 bölüm doğal dinleme
                </li>
                <li>
                  • <strong>15 Eş &amp; Zıt Anlamlı</strong> kelime kartı incelemesi
                </li>
              </ul>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#D97706] text-white text-xs font-extrabold">
                Pazar (1 Gün)
              </span>
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">
                Ölçme &amp; Mahreç Check-up Günü
              </h3>
              <ul className="space-y-1 text-xs font-medium text-[var(--muted)] leading-relaxed">
                <li>
                  • Haftanın gramer başlıklarından{" "}
                  <strong>Konu Tarama Testi (KTT)</strong> çözümü
                </li>
                <li>
                  • <strong>28 Harf Kişisel Mahreç Isı Haritası</strong> üzerindeki
                  sarı/kırmızı harflerin telafisi
                </li>
                <li>
                  • Haftanın diyaloglarından birinin{" "}
                  <strong>📄 A4 Çalışma Kağıdını</strong> yazdırıp kağıt-kalemle çözme
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Aylık & 6 Haftalık Kur Geçiş Protokolü */}
        <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#D97706] text-white flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </span>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B45309] dark:text-amber-300">
                  Aylık Denetim &amp; 6 Haftada Bir Kur Atlayışı
                </span>
                <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
                  Aylık Check-up &amp; 6 Haftalık Kur Geçiş Protokolü
                </h2>
              </div>
            </div>
            <Link
              href="/seviye-tespit?mode=exam&level=A1"
              onClick={() => playClick()}
              className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#6741D9] hover:bg-[#5432B8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap"
            >
              <span>Kur Bitirme Sınavlarını Gör</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#087F5B]" />
                <span>Her Ay Sonu (4 Haftada Bir) Yapılacak 3 İşlem</span>
              </h3>
              <ol className="space-y-1.5 text-xs font-medium text-[var(--muted)] leading-relaxed list-decimal list-inside">
                <li>
                  Ana sayfadaki{" "}
                  <strong className="text-[var(--foreground)]">
                    🧭 CEFR &amp; Beceri Haritası
                  </strong>{" "}
                  penceresini açıp 5 temel beceri çubuğunuzdaki en düşük alanı tespit
                  edin.
                </li>
                <li>
                  Bitirdiğiniz diyalogları tekrar okurken{" "}
                  <strong className="text-[var(--foreground)]">✨ Hareke Modunu</strong>{" "}
                  1. Kademeden (Tam){" "}
                  <strong className="text-[var(--foreground)]">
                    2. Kademeye (Hareke Solması — Sadece İ&apos;rab &amp; Şedde)
                  </strong>{" "}
                  alarak harekesiz okumaya göz alıştırın.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">/ayarlar</strong>{" "}
                  sayfasından{" "}
                  <strong className="text-[var(--foreground)]">
                    JSON İlerleme Yedeğinizi
                  </strong>{" "}
                  indirip güvenli bir klasöre kaydedin.
                </li>
              </ol>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/75 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-4 space-y-2">
              <h3 className="text-sm font-extrabold text-[var(--foreground)] flex items-center gap-2">
                <GraduationCap size={16} className="text-[#6741D9]" />
                <span>Her 6 Haftada Bir (30 Diyalog + Kur Metinleri Sonrası)</span>
              </h3>
              <ol className="space-y-1.5 text-xs font-medium text-[var(--muted)] leading-relaxed list-decimal list-inside">
                <li>
                  Kurun tüm 30 diyaloğunu ve okuma metinlerini tamamladığınızdan emin
                  olun (6., 12., 18. ve 24. haftalar).
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">/seviye-tespit</strong>{" "}
                  sayfasından ilgili kurun{" "}
                  <strong className="text-[var(--foreground)]">
                    Kur Bitirme Sınavına
                  </strong>{" "}
                  girin.
                </li>
                <li>
                  <strong className="text-[var(--foreground)]">
                    %75 ve üzeri başarı
                  </strong>{" "}
                  elde ettiğinizde kur sertifika rozetiniz açılır ve bir üst CEFR kuruna
                  resmen geçersiniz! (%75 altındaysa yanlışlar otomatik Hata Defteri&apos;ne
                  düşer; 3 gün telafi sonrası sınavı yenileyin.)
                </li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // TEACHER SCHEDULE MATRIX (DUAL-TABLE: MEB 36 WEEKS vs INTENSIVE LANGUAGE COURSE)
  return (
    <div className="space-y-6">
      {/* Üst Senaryo Görünüm Seçici */}
      <div className="rounded-2xl bg-[#F7EFE1] dark:bg-[var(--surface)] border-2 border-[#E6D7BE] dark:border-[var(--border)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6741D9] dark:text-purple-300">
            Kurumsal Müfredat Matrisi • İki Ayrı Kurum Senaryosu
          </span>
          <h2 className="text-base sm:text-lg font-black text-[var(--foreground)]">
            Haftalık &amp; Aylık Ders Planlama Tabloları (MEB Okul vs Yoğun Kurs)
          </h2>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: "both" as const, label: "Yan Yana Karşılaştır" },
            { id: "meb" as const, label: "1. Okul / MEB (2–4 Saat)" },
            { id: "intensive" as const, label: "2. Dil Kursu / Hazırlık (8–16 Saat)" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                playClick();
                setTeacherScenarioView(opt.id);
              }}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                teacherScenarioView === opt.id
                  ? "bg-[#6741D9] text-white"
                  : "bg-white dark:bg-[var(--background)] text-[var(--foreground)] border border-[#E6D7BE] dark:border-[var(--border)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-5 ${
          teacherScenarioView === "both" ? "xl:grid-cols-2" : ""
        }`}
      >
        {/* TABLO 1: OKUL / MEB SINIF SENARYOSU */}
        {(teacherScenarioView === "both" || teacherScenarioView === "meb") && (
          <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#087F5B] p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#087F5B] text-white text-[11px] font-extrabold">
                  <School size={13} />
                  <span>Tablo 1 • Okul / MEB Sınıf Senaryosu</span>
                </div>
                <h3 className="text-base font-black text-[var(--foreground)]">
                  Haftada 2 veya 4 Ders Saati (İHO / Anadolu İHL — 36 Hafta)
                </h3>
                <p className="text-xs font-medium text-[var(--muted)]">
                  18+18 = 36 haftalık akademik takvime uyumlu ünite-diyalog-metin
                  eşleştirmesi, karekodlu ödev ve 1. / 2. Dönem yazılı sınav planı.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7EFE1] dark:bg-[var(--background)] text-[var(--foreground)] border-b border-[#E6D7BE] dark:border-[var(--border)]">
                    <th className="py-2.5 px-2.5 font-extrabold whitespace-nowrap">
                      Akademik Dönem
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      2 Saat/Hf Kapsamı
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      4 Saat/Hf Kapsamı
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      Tahta, Ödev &amp; Yazılı Yoklama
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7BE]/70 dark:divide-[var(--border)]">
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      1–8. Hafta
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        1. Dönem I. Dilim
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      8 Diyalog (A1: 1–8) + 4 Okuma Metni + 80 Görsel Kelime
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      16 Diyalog (A1: 1–16) + 8 Okuma Metni + 160 Görsel Kelime
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Her hafta <strong>🎯 Karekodlu Ödev</strong> + A/B İkili Konuşma Kartı
                    </td>
                  </tr>
                  <tr className="bg-[#FFFBEB]/60 dark:bg-amber-950/20">
                    <td className="py-2.5 px-2.5 font-extrabold text-[#B45309] dark:text-amber-300 tabular-nums whitespace-nowrap">
                      9. Hafta
                      <span className="block text-[10px] font-semibold">
                        1. Dönem 1. Yazılı
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2.5 text-[var(--foreground)] font-bold">
                      İşlenen diyalog/metin aralığından genel tekrar + KTT taraması
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>A4 Sınav Stüdyosu → Karma Aralık Seçimi:</strong>{" "}
                      6 Bölümlü Yazılı Sınav (A/B Kitapçıklı) + Maarif Rubriği
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      10–17. Hafta
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        1. Dönem II. Dilim
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      7 Diyalog (A1: 9–15) + 6 Okuma Metni + Temel İsim/Fiil Kalıpları
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      14 Diyalog (A1: 17–30 Tamamlanır) + 12 Okuma Metni
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Tahtada <strong>İ&apos;rab Boyama</strong> + <strong>Sınıf Yarışması</strong>
                    </td>
                  </tr>
                  <tr className="bg-[#FFFBEB]/60 dark:bg-amber-950/20">
                    <td className="py-2.5 px-2.5 font-extrabold text-[#B45309] dark:text-amber-300 tabular-nums whitespace-nowrap">
                      18. Hafta
                      <span className="block text-[10px] font-semibold">
                        1. Dönem 2. Yazılı
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2.5 text-[var(--foreground)] font-bold">
                      1. Dönem Kapanış Yoklaması + Dinleme/Konuşma Uygulama Puanı
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>A4 Sınav Stüdyosu:</strong> A/B Kitapçık + Harekesiz Yoklama + Maarif Rubriği
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      19–26. Hafta
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        2. Dönem I. Dilim
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      8 Diyalog (A1: 16–23) + 5 Okuma Metni + Günlük Kalıp Cümleler
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      15 Diyalog (A2: 1–15) + 10 Okuma Metni + Tesniye/Cemî Uyumu
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>Metin Kanıt Dedektifi</strong> + Haftalık QR Telaffuz Ödevi
                    </td>
                  </tr>
                  <tr className="bg-[#FFFBEB]/60 dark:bg-amber-950/20">
                    <td className="py-2.5 px-2.5 font-extrabold text-[#B45309] dark:text-amber-300 tabular-nums whitespace-nowrap">
                      27. Hafta
                      <span className="block text-[10px] font-semibold">
                        2. Dönem 1. Yazılı
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2.5 text-[var(--foreground)] font-bold">
                      2. Dönem Ara Yazılı + Telaffuz/Rol Yapma Performans Değerlendirmesi
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>Karma Aralık Seçimi</strong> ile sadece işlenen ünitelerden A/B sınav baskısı
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      28–35. Hafta
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        2. Dönem II. Dilim
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      7 Diyalog (A1: 24–30 Tamamlanır) + 5 Okuma Metni
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      15 Diyalog (A2: 16–30 Tamamlanır) + 10 Okuma Metni
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      2. Kademe <strong>Hareke Solması</strong> okuma alıştırmaları
                    </td>
                  </tr>
                  <tr className="bg-[#ECFDF5] dark:bg-emerald-950/30">
                    <td className="py-2.5 px-2.5 font-extrabold text-[#065F46] dark:text-emerald-300 tabular-nums whitespace-nowrap">
                      36. Hafta
                      <span className="block text-[10px] font-semibold">
                        Yıl Sonu Yazılısı
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2.5 text-[var(--foreground)] font-bold">
                      Yıl Sonu 2. Yazılı + Kur Bitirme Sertifika Turnuvası
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      6 Bölümlü A/B Kitapçıklı Yazılı + <strong>🏆 Sınıf Takım Yarışması</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-[#F7EFE1]/80 dark:bg-[var(--background)] border border-[#E6D7BE] dark:border-[var(--border)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                🖨️ <strong>Yazılı Sınav İpucu:</strong> Diyalog/Metin içindeki{" "}
                <em>📄 A4 PDF → Sınav Stüdyosu → Karma Aralık Seçimi</em> ile{" "}
                <strong>6 Bölümlü Yazılı Sınav (A/B Kitapçıklı)</strong> ve{" "}
                <strong>Harekesiz Yoklama + Maarif Rubriği</strong> çıktısını tek tıkla alabilirsiniz.
              </p>
              <Link
                href="/seviye-tespit"
                onClick={() => playClick()}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#087F5B] text-white text-xs font-extrabold inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span>Sınav Merkezine Git</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </section>
        )}

        {/* TABLO 2: GENEL DİL KURSU & YOĞUN HAZIRLIK SENARYOSU */}
        {(teacherScenarioView === "both" ||
          teacherScenarioView === "intensive") && (
          <section className="rounded-2xl bg-[#FDFBF7] dark:bg-[var(--surface)] border-2 border-[#6741D9] p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-dashed border-[#E6D7BE] dark:border-[var(--border)] pb-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#6741D9] text-white text-[11px] font-extrabold">
                  <Flame size={13} />
                  <span>Tablo 2 • Dil Kursu &amp; Yoğun Hazırlık Senaryosu</span>
                </div>
                <h3 className="text-base font-black text-[var(--foreground)]">
                  Haftada 8–16 Saat (İlahiyat Hazırlık &amp; Yoğun Dil Kursu)
                </h3>
                <p className="text-xs font-medium text-[var(--muted)]">
                  Her CEFR kurunun <strong>4–6 haftada</strong> tamamlandığı yoğun
                  program (Toplam 16–24 haftada A1&apos;den B2 mezuniyetine tam akış).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E6D7BE] dark:border-[var(--border)]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F7EFE1] dark:bg-[var(--background)] text-[var(--foreground)] border-b border-[#E6D7BE] dark:border-[var(--border)]">
                    <th className="py-2.5 px-2.5 font-extrabold whitespace-nowrap">
                      Ders Bloğu
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      8 Saat/Hf (6 Hf/Kur)
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      16 Saat/Hf (4 Hf/Kur)
                    </th>
                    <th className="py-2.5 px-2.5 font-extrabold">
                      Uygulamalı Atölye &amp; Ölçme
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6D7BE]/70 dark:divide-[var(--border)]">
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#6741D9] dark:text-purple-300 whitespace-nowrap">
                      1. Blok: المحادثة
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        Diyalog &amp; İletişim
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Haftada <strong>5 Diyalog</strong> (3 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Haftada <strong>7–8 Diyalog</strong> (5 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Kör Dinleme + <strong>👥 A/B Eşli Konuşma</strong> + 38 Mahreç Koçu
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 whitespace-nowrap">
                      2. Blok: القراءة
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        Okuma &amp; Kelime
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Haftada <strong>2–4 Metin</strong> + 45 Görsel Kelime (2 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Haftada <strong>3–5 Metin</strong> + Eş/Zıt Atlası (4 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>Metin Kanıt Dedektifi</strong> + Kademe 2/3 Harekesiz Okuma
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#B45309] dark:text-amber-300 whitespace-nowrap">
                      3. Blok: الصرف والنحو
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        Sarf &amp; Nahiv Atölyesi
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      5 Odak Gramer Kartı (2 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      8 Gramer Kartı + Klasik Köprü (4 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>Sarf-Kök Atölyesi</strong> + <strong>İ&apos;rab Boyama</strong> + Hata Avcısı
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2.5 font-extrabold text-[#087F5B] dark:text-emerald-300 whitespace-nowrap">
                      4. Blok: الإملاء والتقييم
                      <span className="block text-[10px] text-[var(--muted)] font-semibold">
                        Dikte &amp; Haftalık KTT
                      </span>
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Cuma Kapanış Saati (1 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Cuma Uygulama &amp; Tarama Bloğu (3 saat)
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      <strong>Kör Dikte</strong> + Haftalık{" "}
                      <strong>{kttTopicCount} KTT Taraması</strong>
                    </td>
                  </tr>
                  <tr className="bg-[#F3F0FF] dark:bg-purple-950/30">
                    <td className="py-2.5 px-2.5 font-extrabold text-[#4C28B5] dark:text-purple-300 whitespace-nowrap">
                      Kur Sonu (4. veya 6. Hf)
                      <span className="block text-[10px] font-semibold">
                        Kur Geçiş Barajı
                      </span>
                    </td>
                    <td colSpan={2} className="py-2.5 px-2.5 text-[var(--foreground)] font-bold">
                      30 Diyalog + Kur Okuma Metinleri Tamamlandığında Kur Bitirme Sınavı
                    </td>
                    <td className="py-2.5 px-2.5 text-[var(--muted)] font-medium">
                      Dijital <strong>Kur Bitirme (%75+)</strong> + A/B Kitapçıklı Basılı Kur Sınavı + CAT Kontrolü
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl bg-[#F3F0FF]/80 dark:bg-purple-950/30 border border-[#6741D9]/40 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                🎓 <strong>Hazırlık Sınıfları İçin Öneri:</strong> Kurun ilk 3 haftasında{" "}
                <em>Tam Harekeli</em>, 4–5. haftasında <em>Hareke Solması</em>, son
                haftasında ise <em>Harekesiz Okuma</em> modunu açarak öğrencileri doğrudan
                harekesiz metin sınavlarına hazırlayın.
              </p>
              <Link
                href="/seviye-tespit?mode=topic"
                onClick={() => playClick()}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#6741D9] text-white text-xs font-extrabold inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <span>KTT Havuzunu Aç</span>
                <ArrowUpRight size={13} />
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
