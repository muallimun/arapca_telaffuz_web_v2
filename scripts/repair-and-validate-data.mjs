#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "src", "data");

const JSON_FILES = [
  "1111_cumle.json",
  "atasozleri.json",
  "gorselKelimeler_guncel.json",
  "yeni_tum_sozluk.json",
  "tum_diyaloglar_120.json",
  "tum_metinler_60.json",
  "diyaloglar_gramer_hap_bilgi.json",
  "metinler_gramer_hap_bilgi.json",
  "ek_gramer_hap_bilgi.json",
  "seviye_tespit_sorulari.json",
];

// ============================================================================
// EKSİK DETAYLI ANLATIM BLOKLARI (dlg_007 & dlg_014)
// ============================================================================

const DLG_007_AYRINTILI_ANLATIM = {
  formul_sema:
    "[Sülâsî Emir Fiil (اِفْتَحْ / اِفْتَحِي)] + [Mef'ûlün Bih + Zamir (كِتَابَكَ / كِتَابَكِ)] + [Câr-Mecrûr + Sıra Sayısı (عَلَى الصَّفْحَةِ الْعَاشِرَةِ)]",
  adim_adim_anlatim: [
    "1. Sülâsî Emir Fiil ve Hemze-i Vasıl: Üç harfli (sülâsî) fiillerin emir kipinin başındaki elif 'hemze-i vasıl'dır (اِفْتَحْ، اُكْتُبْ، اِقْرَأْ); üzerine veya altına kat' hemzesi (أ / إ) konulmaz.",
    "2. Muhatap Cinsiyet Uyumu: Tekil erkeğe emrederken son harf sükûnlu (اِفْتَحْ), tekil kadına emrederken ise muhataba yâ'sı eklenerek (اِفْتَحِي) söylenir; geçiş halinde iki sâkin çakışırsa kesra verilir (اُكْتُبِ الدَّرْسَ).",
    "3. Sayfa ve Sıra Sayısı Uyumu: 'Onuncu sayfa' gibi sıra bildiren tamlamalarda asıl sayı (العَشَرَة) değil, 'فَاعِلَة' veznindeki müennes sıra sayısı sıfatı (الصَّفْحَةِ الْعَاشِرَةِ) kullanılır.",
  ],
  ozet_tablo: {
    tablo_basligi: "Sülâsî Emir Fiillerde Hemze-i Vasıl ve Cinsiyet Uyumu",
    sutunlar: [
      "Mâzî / Muzâri",
      "Eril Emir (أَنْتَ)",
      "Dişil Emir (أَنْتِ)",
      "Örnek Sınıf İfadesi",
    ],
    satirlar: [
      [
        "فَتَحَ / يَفْتَحُ",
        "اِفْتَحْ",
        "اِفْتَحِي",
        "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ.",
      ],
      [
        "كَتَبَ / يَكْتُبُ",
        "اُكْتُبْ",
        "اُكْتُبِي",
        "اُكْتُبِ الدَّرْسَ فِي الدَّفْتَرِ.",
      ],
      [
        "قَرَأَ / يَقْرَأُ",
        "اِقْرَأْ",
        "اِقْرَئِي",
        "اِقْرَأِ الدَّرْسَ بِصَوْتٍ عَالٍ.",
      ],
    ],
  },
  irab_tahlili: [
    {
      kelime: "اِفْتَحْ",
      gorevi: "Emir Fiil + Gizli Fâil (أَنْتَ)",
      hareke_nedeni:
        "Sülâsî mücerred emir fiilidir; başındaki elif hemze-i vasıldır ve sükûn üzere mebnidir.",
    },
    {
      kelime: "كِتَابَكَ",
      gorevi: "Mef'ûlün Bih (Muzâf) + Muzâfun İleyh",
      hareke_nedeni:
        "'كِتَابَ' doğrudan etkilenen nesne olduğu için fetha ile mansûb, 'كَ' ise bitişik zamirdir.",
    },
    {
      kelime: "عَلَى الصَّفْحَةِ",
      gorevi: "Câr-Mecrûr",
      hareke_nedeni:
        "'عَلَى' harf-i cerinden dolayı 'الصَّفْحَةِ' kesra (esre) ile mecrûrdur.",
    },
    {
      kelime: "الْعَاشِرَةِ",
      gorevi: "Sıra Sayısı Sıfatı (Na't)",
      hareke_nedeni:
        "Nitelediği müennes marife mecrûr isme ('الصَّفْحَةِ') uyarak 'فَاعِلَة' vezninde kesra almıştır.",
    },
  ],
  dikkat_sik_hata: {
    yanlis: "إِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَشَرَةِ.",
    dogru: "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ.",
    neden:
      "Sülâsî emir fiilin başına kat' hemzeli 'إِ' yazılmaz ('اِفْتَحْ' olmalıdır) ve sayfa numarası sıra bildirdiği için 'الْعَشَرَةِ' değil 'الْعَاشِرَةِ' (onuncu) kalıbında gelir.",
  },
};

const DLG_014_AYRINTILI_ANLATIM = {
  formul_sema:
    "[Çoğul/İkil Zamir Mübteda (نَحْنُ / هُمَا / أَنْتُمَا)] + [Tesniye Haber (ذَاهِبَتَانِ - Merfû ◌َانِ)] + [Câr-Mecrûr + Zaman Zarfı (إِلَى الْمَكْتَبَةِ الْآنَ)]",
  adim_adim_anlatim: [
    "1. Tesniye (İkil) Yapısı: Arapçada tam iki kişiyi veya iki nesneyi ifade etmek için tekil ve çoğuldan ayrı olarak 'tesniye' (ikil) kalıbı kullanılır.",
    "2. Merfû İkil Eki (-âni): İsim cümlesinde haber veya özne konumundaki ikil kelimeler ötre yerine sonlarına '-âni' (◌َانِ) eki alarak merfû olurlar; müennes kelimelerde yuvarlak tâ açık tâ'ya dönüşür (ذَاهِبَةٌ -> ذَاهِبَتَانِ).",
    "3. İkil Zamir Uyumu: İki kişiden bahsederken 'نَحْنُ' (biz ikimiz), 'أَنْتُمَا' (siz ikiniz) ve 'هُمَا' (o ikisi) zamirleri kullanılır; bitişik zamir olarak 'لَكُمَا' (ikiniz için) şeklini alır.",
  ],
  ozet_tablo: {
    tablo_basligi: "Müzekker ve Müennes Tesniye (İkil) İsim Cümlesi Uyumu",
    sutunlar: [
      "Zamir",
      "Tekil (Müfred)",
      "İkil (Tesniye - Merfû)",
      "Örnek Cümle",
    ],
    satirlar: [
      [
        "نَحْنُ (İki Kız)",
        "ذَاهِبَةٌ",
        "ذَاهِبَتَانِ",
        "نَحْنُ ذَاهِبَتَانِ إِلَى الْمَكْتَبَةِ الْآنَ.",
      ],
      [
        "هُمَا (İki Erkek)",
        "طَالِبٌ",
        "طَالِبَانِ",
        "هُمَا طَالِبَانِ مُجْتَهِدَانِ.",
      ],
      [
        "أَنْتُمَا (İki Kadın)",
        "مُعَلِّمَةٌ",
        "مُعَلِّمَتَانِ",
        "أَنْتُمَا مُعَلِّمَتَانِ مَاهِرَتَانِ.",
      ],
    ],
  },
  irab_tahlili: [
    {
      kelime: "نَحْنُ",
      gorevi: "Mübteda (Özne)",
      hareke_nedeni:
        "1. çoğul/ikil ayrık şahıs zamiri olup damma üzere mebnidir, mahallen merfûdur.",
    },
    {
      kelime: "ذَاهِبَتَانِ",
      gorevi: "Haber (Yüklem)",
      hareke_nedeni:
        "Müennes tesniye (ikil) isim-fiil olduğu için damma yerine 'elif' (انِ) ile merfûdur.",
    },
    {
      kelime: "إِلَى الْمَكْتَبَةِ",
      gorevi: "Câr-Mecrûr",
      hareke_nedeni:
        "'إِلَى' yönelme harf-i ceri, 'الْمَكْتَبَةِ' ise kesra ile mecrûr isimdir.",
    },
    {
      kelime: "الْآنَ",
      gorevi: "Zarf-ı Zaman (Mef'ûlün Fîh)",
      hareke_nedeni:
        "'Şimdi' anlamında zaman zarfı olup fetha üzere mebnidir, mahallen mansûbdur.",
    },
  ],
  dikkat_sik_hata: {
    yanlis: "نَحْنُ ذَاهِبَتَيْنِ إِلَى الْمَكْتَبَةِ.",
    dogru: "نَحْنُ ذَاهِبَتَانِ إِلَى الْمَكْتَبَةِ.",
    neden:
      "İsim cümlesinin yüklemi (haber) merfû konumda olduğu için ikil kelimede '-eyni' (يْنِ) değil, elifli '-âni' (انِ) eki kullanılmalıdır.",
  },
};

// ============================================================================
// EKSİK 5 YENİ DİYALOG GRAMER KAYDI (dlg_016 – dlg_020)
// ============================================================================

const NEW_DIALOGUE_GRAMMAR_RECORDS = [
  {
    bagli_id: "dlg_016",
    konu_basligi:
      "Mekân Zarfları (خَلْفَ) ve Uzaklık/Yakınlık Harf-i Cerleri (بَعِيدٌ عَنْ / قَرِيبٌ مِنْ)",
    hap_kural:
      "Arapçada yön ve konum bildiren mekân zarfları (خَلْفَ، أَمَامَ) mansûb okunur ve kendisinden sonra gelen ismi muzâfun ileyh olarak esreli (mecrûr) yapar. Mesafe sıfatlarında ise 'بَعِيدٌ' dâima 'عَنْ' ile, 'قَرِيبٌ' ise 'مِنْ' harf-i ceri ile kullanılır.",
    metinden_ornek: {
      arapca: "يَقَعُ مَرْكَزُ الصِّحَّةِ خَلْفَ المَدْرَسَةِ.",
      turkce: "Sağlık merkezi okulun arkasında yer alıyor.",
      aciklama:
        "'خَلْفَ' mekân zarfı fetha ile mansûb gelmiş, devamındaki 'المَدْرَسَةِ' ismini muzâfun ileyh olarak esrelemiştir.",
    },
    ek_ornekler: [
      {
        arapca: "هَلْ هُوَ بَعِيدٌ عَنْ هَذِهِ النُّقْطَةِ؟",
        turkce: "O, bu noktadan uzak mı?",
      },
      {
        arapca: "لَا، هُوَ قَرِيبٌ جِدًّا مِنْ هُنَا.",
        turkce: "Hayır, o buraya çok yakındır.",
      },
    ],
    ipucu:
      "Türkçede 'buraya yakın' (-e/-a) denirken Arapçada 'قَرِيبٌ مِنْ' (-den yakın), uzaklık için ise 'بَعِيدٌ عَنْ' (-den uzak) kalıbı kullanılır.",
    ayrintili_anlatim: {
      formul_sema:
        "[Konum Fiili (يَقَعُ)] + [Fâil Tamlaması (مَرْكَزُ الصِّحَّةِ)] + [Zarf-ı Mekân (خَلْفَ)] + [Muzâfun İleyh (المَدْرَسَةِ - Mecrûr ◌ِ)]",
      adim_adim_anlatim: [
        "1. Mekân Zarflarının İzâfeti: 'خَلْفَ' (arkasında), 'أَمَامَ' (önünde), 'بِجَانِبِ' (yanında) gibi konum sözcüklerinden sonra gelen yer ismi dâima muzâfun ileyh olur ve kesra (esre) alır.",
        "2. Uzaklık Kalıbı (بَعِيدٌ عَنْ): Bir yerin başka bir noktaya uzak olduğunu belirtirken 'بَعِيدٌ' sıfatı mutlaka uzaklaşma bildiren 'عَنْ' harf-i ceri ile bağlanır.",
        "3. Yakınlık Kalıbı (قَرِيبٌ مِنْ): Bir yerin yakın olduğunu ifade ederken Türkçedeki '-e yakın' yapısının aksine 'إِلَى' değil, 'قَرِيبٌ مِنْ' kalıbı tercih edilir.",
      ],
      ozet_tablo: {
        tablo_basligi: "Konum Zarfları ve Mesafe Sıfatlarının Kullanımı",
        sutunlar: [
          "Kalıp / Zarf",
          "Bağlandığı Öge",
          "Örnek Cümle",
          "Türkçe Anlamı",
        ],
        satirlar: [
          [
            "خَلْفَ (Arkasında)",
            "Muzâfun İleyh (◌ِ)",
            "يَقَعُ مَرْكَزُ الصِّحَّةِ خَلْفَ المَدْرَسَةِ.",
            "Sağlık merkezi okulun arkasındadır.",
          ],
          [
            "بَعِيدٌ عَنْ (...-den uzak)",
            "عَنْ + Mecrûr İsim",
            "المَرْكَزُ بَعِيدٌ عَنِ البَيْتِ.",
            "Merkez evden uzaktır.",
          ],
          [
            "قَرِيبٌ مِنْ (...-e yakın)",
            "مِنْ + Mecrûr İsim",
            "هُوَ قَرِيبٌ جِدًّا مِنْ هُنَا.",
            "O, buraya çok yakındır.",
          ],
        ],
      },
      irab_tahlili: [
        {
          kelime: "يَقَعُ",
          gorevi: "Muzâri Fiil",
          hareke_nedeni:
            "Başında nasb veya cezm edatı bulunmadığı için damma (ötre) ile merfûdur.",
        },
        {
          kelime: "مَرْكَزُ الصِّحَّةِ",
          gorevi: "Fâil (Muzâf) + Muzâfun İleyh",
          hareke_nedeni:
            "'مَرْكَزُ' özne olduğu için damma ile merfû, 'الصِّحَّةِ' tamlayan olduğu için kesra ile mecrûrdur.",
        },
        {
          kelime: "خَلْفَ",
          gorevi: "Zarf-ı Mekân (Mef'ûlün Fîh - Muzâf)",
          hareke_nedeni:
            "Eylemin gerçekleştiği yönü bildiren mekân zarfı olduğu için fetha ile mansûbdur.",
        },
        {
          kelime: "المَدْرَسَةِ",
          gorevi: "Muzâfun İleyh",
          hareke_nedeni:
            "Mekân zarfını tamamlayan isim olduğu için kesra (esre) ile mecrûrdur.",
        },
      ],
      dikkat_sik_hata: {
        yanlis: "المَرْكَزُ قَرِيبٌ إِلَى هُنَا.",
        dogru: "المَرْكَزُ قَرِيبٌ مِنْ هُنَا.",
        neden:
          "Türkçe düşünerek 'قَرِيبٌ' kelimesini 'إِلَى' ile kullanmak yanlıştır; fasih Arapçada yakınlık dâima 'قَرِيبٌ مِنْ' ile ifade edilir.",
      },
    },
  },
  {
    bagli_id: "dlg_017",
    konu_basligi:
      "Konum Bildiren (يَقَعُ / تَقَعُ) Fiili, (أَمَامَ) Zarfı ve (يُمْكِنُنِي + Masdar) Kalıbı",
    hap_kural:
      "Bir binanın veya kurumun konumunu anlatırken özne müzekker ise 'يَقَعُ', müennes ise 'تَقَعُ' (yer alır/bulunur) fiili kullanılır. Bir eylemi yapabilme imkânı sorulurken ise 'يُمْكِنُنِي + Merfû Masdar' (-ebilirim / mümkün mü?) yapısı kurulur.",
    metinden_ornek: {
      arapca: "هَلْ يُمْكِنُنِي المَشْيُ إِلَى هُنَاكَ؟",
      turkce: "Oraya yürüyebilir miyim?",
      aciklama:
        "'يُمْكِنُنِي' fiiline kaynaştırma nûnu (نِ) ile mütekellim yâ'sı bitişmiş, 'المَشْيُ' masdarı ise fâil olarak ötreli gelmiştir.",
    },
    ek_ornekler: [
      {
        arapca: "تَقَعُ المَحَطَّةُ أَمَامَ المَرْكَزِ التِّجَارِيِّ الكَبِيرِ.",
        turkce: "İstasyon büyük alışveriş merkezinin önünde yer alıyor.",
      },
      {
        arapca: "يُمْكِنُكَ الذَّهَابُ بِالحَافِلَةِ السَّرِيعَةِ.",
        turkce: "Hızlı otobüsle gidebilirsin.",
      },
    ],
    ipucu:
      "'يُمْكِنُنِي' (benim için mümkündür) fiilinden sonra gelen masdar nesne değil, fiilin öznesi (fâil) olduğu için ötreli (merfû) okunur: يُمْكِنُنِي المَشْيُ.",
    ayrintili_anlatim: {
      formul_sema:
        "[Soru Edatı (هَلْ)] + [İmkân Fiili + Zamir (يُمْكِنُنِي)] + [Fâil Masdar (المَشْيُ - Merfû ◌ُ)] + [Câr-Mecrûr (إِلَى هُنَاكَ)]",
      adim_adim_anlatim: [
        "1. Konum Fiilinde Cinsiyet Uyumu: Konumu sorulan yer 'مَحَطَّةُ المِتْرُو' (metro istasyonu) gibi müennes olduğunda fiil 'تَقَعُ' şeklinde müennes çekimlenir.",
        "2. Mekân Zarfı أَمَامَ: 'Önünde' anlamına gelen 'أَمَامَ' zarfı mansûb okunur ve sonrasındaki ismi (المَرْكَزِ) muzâfun ileyh olarak mecrûr yapar.",
        "3. يُمْكِنُنِي + Masdar Kalıbı: '-ebilir miyim?' anlamı için 'يُمْكِنُنِي' kalıbından sonra ya merfû bir masdar (المَشْيُ) ya da 'أَنْ + mansûb muzâri fiil' (أَنْ أَمْشِيَ) getirilir.",
      ],
      ozet_tablo: {
        tablo_basligi: "يُمْكِنُ İmkân Kalıbı ve Masdar/Muzâri Kullanımı",
        sutunlar: [
          "Şahıs",
          "يُمْكِنُ + Zamir",
          "Masdarlı Kullanım",
          "Türkçe Anlamı",
        ],
        satirlar: [
          [
            "أَنَا (Ben)",
            "يُمْكِنُنِي",
            "يُمْكِنُنِي المَشْيُ إِلَى هُنَاكَ.",
            "Oraya yürüyebilirim.",
          ],
          [
            "أَنْتَ (Sen - Eril)",
            "يُمْكِنُكَ",
            "يُمْكِنُكَ الدُّخُولُ الآنَ.",
            "Şimdi girebilirsin.",
          ],
          [
            "أَنْتِ (Sen - Dişil)",
            "يُمْكِنُكِ",
            "يُمْكِنُكِ الجُلُوسُ هُنَا.",
            "Buraya oturabilirsin.",
          ],
        ],
      },
      irab_tahlili: [
        {
          kelime: "هَلْ",
          gorevi: "İstifhâm (Soru) Harfi",
          hareke_nedeni: "Sükûn üzere mebnidir, cümlenin irabını değiştirmez.",
        },
        {
          kelime: "يُمْكِنُنِي",
          gorevi: "Muzâri Fiil + Nûn-u Vikâye + Mef'ûl Zamiri",
          hareke_nedeni:
            "'يُمْكِنُ' damma ile merfû muzâri fiil, 'نِ' koruma nûnu, 'ي' ise mahallen mansûb nesne zamiridir.",
        },
        {
          kelime: "المَشْيُ",
          gorevi: "Fâil (Özne)",
          hareke_nedeni:
            "'Mümkün olan şey' yürümek eylemi olduğu için 'يُمْكِنُ' fiilinin fâilidir ve damma ile merfûdur.",
        },
        {
          kelime: "إِلَى هُنَاكَ",
          gorevi: "Câr-Mecrûr",
          hareke_nedeni:
            "'إِلَى' harf-i cer, 'هُنَاكَ' fetha üzere mebni işaret zarfı olup mahallen mecrûrdur.",
        },
      ],
      dikkat_sik_hata: {
        yanlis: "هَلْ يُمْكِنُنِي المَشْيَ إِلَى هُنَاكَ؟",
        dogru: "هَلْ يُمْكِنُنِي المَشْيُ إِلَى هُنَاكَ؟",
        neden:
          "'يُمْكِنُنِي' kalıbından sonra gelen masdar nesne sanılarak fethalı (المَشْيَ) okunmamalıdır; cümlenin fâili olduğu için ötreli (المَشْيُ) olmalıdır.",
      },
    },
  },
  {
    bagli_id: "dlg_018",
    konu_basligi:
      "Mâzî Fiilde Muhataba Çekimi (زُرْتِ) ve Bitişik Nesne Zamiri (زُرْتُهُ)",
    hap_kural:
      "Orta harfi illetli (ecvef) mâzî fiillere (زَارَ) hareketli şahıs zamiri bitiştiğinde ortadaki elif düşer: kadın muhatap için 'زُرْتِ' (ziyaret ettin), ben için 'زُرْتُ' (ziyaret ettim) olur. Fiilin sonuna eklenen 'ـهُ / ـهَا' zamirleri ise doğrudan nesne (mef'ûlün bih) görevindedir.",
    metinden_ornek: {
      arapca: "نَعَمْ، زُرْتُهُ مَعَ عَائِلَتِي أَمْسِ.",
      turkce: "Evet, dün ailemle birlikte onu ziyaret ettim.",
      aciklama:
        "'زُرْتُ' mâzî fiil ve fâil zamiri ('ben'), sonundaki 'ـهُ' ise 'المَسْجِدَ الكَبِيرَ' (Ulu Cami) ismine dönen eril tekil nesne zamiridir.",
    },
    ek_ornekler: [
      {
        arapca: "هَلْ زُرْتِ المَسْجِدَ الكَبِيرَ فِي المَدِينَةِ؟",
        turkce: "Şehirdeki Ulu Cami'yi ziyaret ettin mi?",
      },
      {
        arapca: "زُرْتُ المَكْتَبَةَ وَالْتَقَطْتُ صُوَرًا جَمِيلَةً.",
        turkce: "Kütüphaneyi ziyaret ettim ve güzel fotoğraflar çektim.",
      },
    ],
    ipucu:
      "Mâzî fiilde 'تُ' (ötreli) 'ben yaptım', 'تَ' (üstünlü) 'sen erkek yaptın', 'تِ' (esreli) ise 'sen kadın yaptın' demektir; sonlarına doğrudan nesne zamiri (زُرْتُهُ) birleşebilir.",
    ayrintili_anlatim: {
      formul_sema:
        "[Mâzî Fiil Kökü (زُرْ)] + [Fâil Zamiri (تُ - Ben)] + [Bitişik Mef'ûl Zamiri (هُ - Onu)] + [Birliktelik + Zaman Zarfı (مَعَ عَائِلَتِي أَمْسِ)]",
      adim_adim_anlatim: [
        "1. Ecvef Fiilde İllet Harfinin Düşmesi: 'زَارَ' (ziyaret etti) fiiline 'تُ / تَ / تِ' zamirleri eklendiğinde son harf ('ر') sükûn alır ve iki sâkin yan yana gelemeyeceği için ortadaki elif düşerek ilk harf ötreli okunur (زُرْتُ، زُرْتِ).",
        "2. Fâil ve Mef'ûlün Tek Kelimede Birleşmesi: 'زُرْتُهُ' kelimesi tek başına tam bir fiil cümlesidir: 'زُرْ' (fiil) + 'تُ' (özne: ben) + 'هُ' (nesne: onu).",
        "3. Geçmiş Zaman Zarfı (أَمْسِ): 'Dün' anlamına gelen 'أَمْسِ' kelimesi kesra üzere mebnidir ve eylemin geçmiş zamanda tamamlandığını pekiştirir.",
      ],
      ozet_tablo: {
        tablo_basligi: "زَارَ (Ziyaret Etti) Fiilinin Şahıs ve Nesne Zamirli Çekimi",
        sutunlar: [
          "Şahıs Zamiri",
          "Mâzî Çekim",
          "Nesne Zamirli (Onu)",
          "Türkçe Anlamı",
        ],
        satirlar: [
          [
            "أَنَا (Ben)",
            "زُرْتُ",
            "زُرْتُهُ / زُرْتُهَا",
            "Onu (eril/dişil) ziyaret ettim.",
          ],
          [
            "أَنْتَ (Sen - Eril)",
            "زُرْتَ",
            "هَلْ زُرْتَهُ؟",
            "Onu ziyaret ettin mi? (Erkeğe)",
          ],
          [
            "أَنْتِ (Sen - Dişil)",
            "زُرْتِ",
            "هَلْ زُرْتِهِ؟",
            "Onu ziyaret ettin mi? (Kadına)",
          ],
        ],
      },
      irab_tahlili: [
        {
          kelime: "زُرْتُهُ",
          gorevi: "Mâzî Fiil + Fâil (تُ) + Mef'ûlün Bih (هُ)",
          hareke_nedeni:
            "Sükûn üzere mebni mâzî fiil; 'تُ' mahallen merfû fâil, 'هُ' ise mahallen mansûb bitişik nesne zamiridir.",
        },
        {
          kelime: "مَعَ عَائِلَتِي",
          gorevi: "Zarf (Muzâf) + Muzâfun İleyh",
          hareke_nedeni:
            "'مَعَ' birliktelik zarfı olup fetha ile mansûb, 'عَائِلَتِي' ise mütekellim yâ'sına izâfe edildiği için takdirî kesra ile mecrûrdur.",
        },
        {
          kelime: "أَمْسِ",
          gorevi: "Zarf-ı Zaman (Mef'ûlün Fîh)",
          hareke_nedeni:
            "Kesra üzere mebni zaman zarfıdır, mahallen mansûbdur.",
        },
      ],
      dikkat_sik_hata: {
        yanlis: "هَلْ زَارْتِ المَسْجِدَ الكَبِيرَ؟",
        dogru: "هَلْ زُرْتِ المَسْجِدَ الكَبِيرَ؟",
        neden:
          "Ecvef fiillere ('زَارَ، قَالَ، كَانَ') hareketli fâil zamirleri bitiştiğinde ortadaki med elifi mutlaka düşer ('زَارْتِ' değil 'زُرْتِ' olur).",
      },
    },
  },
  {
    bagli_id: "dlg_019",
    konu_basligi:
      "Soru Edatı (مَاذَا), Gelecek Zaman (سَنَأْكُلُ) ve (يُوجَدُ / تُوجَدُ) Cinsiyet Uyumu",
    hap_kural:
      "Fiil cümlelerinde nesneyi sormak için 'مَاذَا' (ne / neler) edatı kullanılır. Muzâri fiilin başına eklenen 'سَـ' harfi yakın gelecek zaman (-eceğiz) bildirir. Varlık bildiren 'يُوجَدُ / تُوجَدُ' yapısında ise ilk sıradaki ismin cinsiyeti fiili belirler.",
    metinden_ornek: {
      arapca: "مَاذَا سَنَأْكُلُ فِي الغَدَاءِ الْيَوْمَ؟",
      turkce: "Bugün öğle yemeğinde ne yiyeceğiz?",
      aciklama:
        "'مَاذَا' sorulan nesneyi (öne geçmiş mef'ûlün bih), 'سَنَأْكُلُ' ise 'نَحْنُ' öznesiyle çekimlenmiş gelecek zaman fiilini gösterir.",
    },
    ek_ornekler: [
      {
        arapca: "يُوجَدُ أَرُزٌّ وَدَجَاجٌ مَشْوِيٌّ وَسَلَطَةٌ.",
        turkce: "Pilav, ızgara tavuk ve salata var.",
      },
      {
        arapca: "تُوجَدُ بَقْلَاوَةٌ طَازَجَةٌ بِالْفُسْتُقِ.",
        turkce: "Fıstıklı taze baklava var.",
      },
    ],
    ipucu:
      "Fiilden önce 'ne?' diye sorarken 'مَا' yerine dâima 'مَاذَا' tercih edilir (مَاذَا سَنَأْكُلُ؟); sayılan yemeklerin ilki erilse 'يُوجَدُ', dişilse 'تُوجَدُ' kullanılır.",
    ayrintili_anlatim: {
      formul_sema:
        "[Soru İsmi (مَاذَا)] + [Gelecek Zaman + Muzâri Fiil (سَنَأْكُلُ)] + [Câr-Mecrûr (فِي الغَدَاءِ)] + [Zaman Zarfı (الْيَوْمَ)]",
      adim_adim_anlatim: [
        "1. Fiillerle مَاذَا Kullanımı: Eylemin nesnesini sormak için fiilin önüne 'مَاذَا' getirilir ve cümlede öne geçmiş mef'ûlün bih görevini üstlenir.",
        "2. Yakın Gelecek Eki (سَـ): Muzâri fiilin başına bitişik yazılan 'سَـ' (İstikbâl Sîn'i) fiilin son harekesini değiştirmez, anlamı şimdiki zamandan yakın geleceğe taşır (نَأْكُلُ -> سَنَأْكُلُ).",
        "3. Sıralı İsimlerde يُوجَدُ / تُوجَدُ Uyumu: Birden fazla yiyecek sayılırken fiilin hemen yanındaki ilk kelime eril ise ('أَرُزٌّ') 'يُوجَدُ', müennes ise ('شُورَبَةٌ / بَقْلَاوَةٌ') 'تُوجَدُ' kullanılır.",
      ],
      ozet_tablo: {
        tablo_basligi: "Gelecek Zaman ve Varlık Fiilinde Cinsiyet Uyumu",
        sutunlar: [
          "Yapı / Kalıp",
          "Arapça Örnek",
          "Dilbilgisel Özellik",
          "Türkçe Anlamı",
        ],
        satirlar: [
          [
            "مَاذَا + سَـ",
            "مَاذَا سَنَأْكُلُ الْيَوْمَ؟",
            "Öne geçmiş nesne sorusu + yakın gelecek",
            "Bugün ne yiyeceğiz?",
          ],
          [
            "يُوجَدُ + Müzekker",
            "يُوجَدُ أَرُزٌّ وَدَجَاجٌ.",
            "İlk isim eril olduğu için يُوجَدُ",
            "Pilav ve tavuk var.",
          ],
          [
            "تُوجَدُ + Müennes",
            "تُوجَدُ شُورَبَةٌ سَاخِنَةٌ.",
            "İlk isim dişil (ة) olduğu için تُوجَدُ",
            "Sıcak çorba var.",
          ],
        ],
      },
      irab_tahlili: [
        {
          kelime: "مَاذَا",
          gorevi: "Öne Geçmiş Mef'ûlün Bih (Soru İsmi)",
          hareke_nedeni:
            "Sükûn üzere mebni soru ismidir; 'سَنَأْكُلُ' fiilinin nesnesi olduğu için mahallen mansûbdur.",
        },
        {
          kelime: "سَنَأْكُلُ",
          gorevi: "İstikbâl Harfi + Muzâri Fiil + Gizli Fâil (نَحْنُ)",
          hareke_nedeni:
            "'سَـ' gelecek zaman harfi, 'نَأْكُلُ' ise damma ile merfû muzâri fiildir.",
        },
        {
          kelime: "فِي الغَدَاءِ",
          gorevi: "Câr-Mecrûr",
          hareke_nedeni:
            "'فِي' harf-i cer, 'الغَدَاءِ' kesra ile mecrûr isimdir.",
        },
        {
          kelime: "الْيَوْمَ",
          gorevi: "Zarf-ı Zaman (Mef'ûlün Fîh)",
          hareke_nedeni:
            "Eylemin zamanını bildirdiği için fetha ile mansûbdur.",
        },
      ],
      dikkat_sik_hata: {
        yanlis: "مَاذَا سَنَأْكُلْ فِي الغَدَاءِ؟",
        dogru: "مَاذَا سَنَأْكُلُ فِي الغَدَاءِ؟",
        neden:
          "Gelecek zaman bildiren 'سَـ' harfi cezm edatı değildir; muzâri fiilin son harekesini sükûn yapmaz, fiil damma (ötre) ile merfû kalır.",
      },
    },
  },
  {
    bagli_id: "dlg_020",
    konu_basligi:
      "Soru İsmi (أَيُّ / أَيَّ) İzâfeti ve (كَانَ) Nakıs Fiilinin Müennes Emri (كُونِي طَبِيبَةً)",
    hap_kural:
      "'Hangi' anlamındaki 'أَيُّ' soru ismi mu'rabdır (harekesi değişir) ve kendisinden sonra gelen ismi dâima muzâfun ileyh olarak esreli (mecrûr) yapar. 'كَانَ' nakıs fiilinin emir kipinde (كُنْ / كُونِي) yüklem (haber) dâima mansûb (üstünlü) okunur.",
    metinden_ornek: {
      arapca: "يَا ابْنَتِي، كُونِي طَبِيبَةً نَاجِحَةً.",
      turkce: "Kızım, başarılı bir doktor ol.",
      aciklama:
        "'كُونِي' nakıs emir fiili muhataba yâ'sını isim olarak almış, 'طَبِيبَةً' haberini ise fetha tenvini ile mansûb yapmıştır.",
    },
    ek_ornekler: [
      {
        arapca: "أَيَّ مِهْنَةٍ أَخْتَارُ لِمُسْتَقْبَلِي؟",
        turkce: "Geleceğim için hangi mesleği seçeyim?",
      },
      {
        arapca: "أَبُوكِ يُرِيدُ أَنْ تَكُونِي مُعَلِّمَةً.",
        turkce: "Baban senin öğretmen olmanı istiyor.",
      },
    ],
    ipucu:
      "Diğer tüm soru edatları mebni (sabit harekeli) iken 'أَيُّ' cümledeki görevine göre hareke alır; nesne olduğunda 'أَيَّ مِهْنَةٍ' şeklinde fethalı okunur.",
    ayrintili_anlatim: {
      formul_sema:
        "[Nidâ + Münâdâ (يَا ابْنَتِي)] + [Nakıs Emir Fiil + İsim (كُونِي)] + [كَانَ'nin Haberi (طَبِيبَةً - Mansûb ◌ً)] + [Sıfat (نَاجِحَةً)]",
      adim_adim_anlatim: [
        "1. Mu'rab Soru İsmi (أَيُّ / أَيَّ): 'أَيَّ مِهْنَةٍ أَخْتَارُ؟' cümlesinde 'أَخْتَارُ' fiilinin öne geçmiş nesnesi olduğu için 'أَيَّ' fetha ile mansûb olmuş, 'مِهْنَةٍ' kelimesini ise muzâfun ileyh olarak esrelemiştir.",
        "2. كَانَ Fiilinin Müennes Emri (كُونِي): Erkeğe 'ol!' derken 'كُنْ', kadına 'ol!' derken 'كُونِي' denir; bitişen 'ي' zamiri 'كَانَ'nin ismidir.",
        "3. كَانَ'nin Mansûb Haberi: 'كَانَ / يَكُونُ / كُنْ' hangi kipte çekimlenirse çekimlensin haberini mansûb yapar: 'كُونِي طَبِيبَةً' ve 'أَنْ تَكُونِي مُعَلِّمَةً'.",
      ],
      ozet_tablo: {
        tablo_basligi: "كَانَ Nakıs Fiilinin Emir ve Muzâri Çekimlerinde Haber İrabı",
        sutunlar: [
          "Muhatap",
          "Emir / Muzâri Kalıbı",
          "كَانَ'nin Haberi (Mansûb)",
          "Türkçe Anlamı",
        ],
        satirlar: [
          [
            "أَنْتِ (Kızım)",
            "كُونِي",
            "طَبِيبَةً نَاجِحَةً",
            "Başarılı bir doktor ol.",
          ],
          [
            "أَنْتَ (Oğlum)",
            "كُنْ",
            "طَبِيبًا نَاجِحًا",
            "Başarılı bir doktor ol.",
          ],
          [
            "أَنْتِ (أَنْ + Muzâri)",
            "أَنْ تَكُونِي",
            "مُعَلِّمَةً مَاهِرَةً",
            "Becerikli bir öğretmen olman",
          ],
        ],
      },
      irab_tahlili: [
        {
          kelime: "يَا ابْنَتِي",
          gorevi: "Nidâ Harfi + Münâdâ (Muzâf)",
          hareke_nedeni:
            "Mütekellim yâ'sına izâfe edilen münâdâ olduğu için takdirî fetha ile mansûbdur.",
        },
        {
          kelime: "كُونِي",
          gorevi: "Nakıs Emir Fiil + كَانَ'nin İsmi (ي)",
          hareke_nedeni:
            "Muhataba yâ'sı bitiştiği için nûnun hazfi (düşmesi) üzere mebnidir; 'ي' zamiri mahallen merfûdur.",
        },
        {
          kelime: "طَبِيبَةً",
          gorevi: "كَانَ'nin Haberi",
          hareke_nedeni:
            "Nakıs emir fiilin haberi olduğu için fetha tenvini (üstün) ile mansûbdur.",
        },
        {
          kelime: "نَاجِحَةً",
          gorevi: "Sıfat (Na't)",
          hareke_nedeni:
            "Nitelediği mansûb müennes habere ('طَبِيبَةً') uyarak fetha tenvini almıştır.",
        },
      ],
      dikkat_sik_hata: {
        yanlis: "يَا ابْنَتِي، كُونِي طَبِيبَةٌ نَاجِحَةٌ.",
        dogru: "يَا ابْنَتِي، كُونِي طَبِيبَةً نَاجِحَةً.",
        neden:
          "'كُونِي' (ol!) nakıs fiil olduğu için sonrasında gelen meslek/sıfat ötreli değil, 'كَانَ'nin haberi olarak fetha tenvinli (طَبِيبَةً) okunmalıdır.",
      },
    },
  },
];

// ============================================================================
// YARDIMCI TEMİZLİK VE DÖNÜŞÜM FONKSİYONLARI
// ============================================================================

/**
 * Tatweel (\u0640) temizliği ve NFC kanonik normalizasyonu:
 * - Başında Arapça harf bulunmayan ve doğrudan hareke taşıyan tatweel dizilerini (örn. ــٌ / ــِ / ـِي)
 *   Unicode Dotted Circle (\u25CC -> ◌) ile değiştirir ki harekeler havada sahipsiz kalmasın.
 * - Geriye kalan tüm tatweel (\u0640) karakterlerini tamamen siler.
 * - "kok" alanında "-" yer tutucusunu korur, çoklu boşlukları tek boşluğa indirir.
 */
function cleanStringValue(rawStr, keyName = "") {
  let str = String(rawStr).normalize("NFC");

  // 1. Bilinen özel tatweel kelimelerinde düşmüş sükûnları onar
  str = str
    .replace(/ال\u0640+قَلْبُ/g, "الْقَلْبُ")
    .replace(/ال\u0640+رَّكِيزَةَ/g, "الرَّكِيزَةَ")
    .replace(/ال\u0640+كَرْبُونِيَّةُ/g, "الْكَرْبُونِيَّةُ");

  // 2. Bağımsız hareke taşıyıcısı olarak kullanılan tatweel'leri (örn. ــٌ, ــِ, ـِي, ــَيْنِ) ◌ (\u25CC) yap
  str = str.replace(
    /(?<![\u0621-\u063A\u0641-\u064A\u0671\u25CC][\u064B-\u065F\u0670]*)\u0640+(?=[\u064B-\u065F\u0670])/g,
    "\u25CC"
  );

  // 3. Geriye kalan tüm tatweel (\u0640) karakterlerini sil
  str = str.replace(/\u0640+/g, "");

  // 4. Türkçe alanlarda kalmış Azerbaycan/ters e ('ə') karakterlerini onar
  if (str.includes("ə") || str.includes("Ə")) {
    str = str
      .replace(/İbahə/g, "İbâha")
      .replace(/sevən/g, "seven")
      .replace(/ə/g, "e")
      .replace(/Ə/g, "E");
  }

  // 5. Kök (kok) alanında boşluk düzeni ("-" yer tutucusunu koru)
  if (keyName === "kok") {
    const trimmed = str.trim();
    if (trimmed === "-") return "-";
    str = trimmed.replace(/\s+/g, " ");
  }

  return str.normalize("NFC");
}

function deepCleanNode(node, keyName = "") {
  if (typeof node === "string") {
    return cleanStringValue(node, keyName);
  }
  if (Array.isArray(node)) {
    return node.map((item) => deepCleanNode(item, keyName));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = deepCleanNode(v, k);
    }
    return out;
  }
  return node;
}

/**
 * Sülâsî emir fiillerde hemze-i vasıl ve dlg_007 sıra sayısı düzeltmelerini uygular
 */
function applyArabicOrthographyFixes(str) {
  let s = str.normalize("NFC");
  const pairs = [
    [
      "مَنَحَ اللَّهُ الإINSَانَ عَقْلاً.",
      "مَنَحَ اللَّهُ الْإِنْسَانَ عَقْلًا.",
    ],
    ["الإINSَانَ", "الْإِنْسَانَ"],
    [
      "إِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ العَشَرَةِ.",
      "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ.",
    ],
    [
      "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ العَشَرَةِ.",
      "اِفْتَحْ كِتَابَكَ عَلَى الصَّفْحَةِ الْعَاشِرَةِ.",
    ],
    ["الصَّفْحَةِ العَشَرَةِ", "الصَّفْحَةِ الْعَاشِرَةِ"],
    ["الصَّفْحَةِ الْعَشَرَةِ", "الصَّفْحَةِ الْعَاشِرَةِ"],
    ["إِقْرَأْ الصَّفْحَةَ", "اِقْرَأِ الصَّفْحَةَ"],
    ["إِقْرَأِ", "اِقْرَأِ"],
    ["إِفْتَحِي", "اِفْتَحِي"],
    ["إِفْتَحْ", "اِفْتَحْ"],
    ["أُكْتُبِ الدَّرْسَ", "اُكْتُبِ الدَّرْسَ"],
    ["تَنَصَحِينَنِي", "تَنْصَحِينَنِي"],
  ];

  for (const [from, to] of pairs) {
    s = s.split(from.normalize("NFC")).join(to.normalize("NFC"));
  }
  return s.normalize("NFC");
}

function deepApplyOrthographyFixes(node, keyName = "") {
  if (keyName === "yanlis" || keyName === "neden") {
    return node;
  }
  if (typeof node === "string") {
    return applyArabicOrthographyFixes(node);
  }
  if (Array.isArray(node)) {
    return node.map((item) => deepApplyOrthographyFixes(item, keyName));
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = deepApplyOrthographyFixes(v, k);
    }
    return out;
  }
  return node;
}

function readJson(fileName) {
  const fullPath = path.join(DATA_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function writeJson(fileName, data) {
  const fullPath = path.join(DATA_DIR, fileName);
  const serialized = JSON.stringify(data, null, 2) + "\n";
  const tmpPath = `${fullPath}.tmp`;
  fs.writeFileSync(tmpPath, serialized, "utf8");
  fs.renameSync(tmpPath, fullPath);
}

// ============================================================================
// ANA ONARIM VE DOĞRULAMA AKIŞI
// ============================================================================

function main() {
  console.log("🔧 [FAZ 1] Veri ve Filoloji Onarım Betiği Başlatılıyor...\n");

  // 1. yeni_tum_sozluk.json tekilleştirme
  let sozluk = readJson("yeni_tum_sozluk.json");
  const beforeSozlukCount = sozluk.length;
  const seenSozlukById = new Map();
  let exactDupCount = 0;
  let differingDupCount = 0;

  for (const rawEntry of sozluk) {
    const entry = deepCleanNode(deepApplyOrthographyFixes(rawEntry));
    const id = entry.id;
    if (!seenSozlukById.has(id)) {
      seenSozlukById.set(id, entry);
    } else {
      const existing = seenSozlukById.get(id);
      if (JSON.stringify(existing) === JSON.stringify(entry)) {
        exactDupCount++;
      } else {
        differingDupCount++;
        console.warn(
          `⚠️ [UYARI] yeni_tum_sozluk.json içinde farklı içerikli mükerrer ID tespit edildi: ${id} (eksik alanlar birleştiriliyor, veri silinmedi)`
        );
        const merged = { ...existing };
        for (const [k, v] of Object.entries(entry)) {
          if (
            (merged[k] === undefined || merged[k] === "" || merged[k] === "-") &&
            v !== undefined &&
            v !== "" &&
            v !== "-"
          ) {
            merged[k] = v;
          }
        }
        seenSozlukById.set(id, merged);
      }
    }
  }
  sozluk = Array.from(seenSozlukById.values());
  writeJson("yeni_tum_sozluk.json", sozluk);
  console.log(
    `✅ yeni_tum_sozluk.json: ${beforeSozlukCount} -> ${sozluk.length} benzersiz kayıt (${exactDupCount} birebir mükerrer silindi, ${differingDupCount} farklı mükerrer).`
  );

  // 2. tum_diyaloglar_120.json onarımı
  let diyaloglar = readJson("tum_diyaloglar_120.json");
  diyaloglar = deepCleanNode(deepApplyOrthographyFixes(diyaloglar));
  writeJson("tum_diyaloglar_120.json", diyaloglar);
  console.log(`✅ tum_diyaloglar_120.json: ${diyaloglar.length} diyalog onarıldı.`);

  // 3. tum_metinler_60.json onarımı
  let metinler = readJson("tum_metinler_60.json");
  metinler = deepCleanNode(deepApplyOrthographyFixes(metinler));
  writeJson("tum_metinler_60.json", metinler);
  console.log(`✅ tum_metinler_60.json: ${metinler.length} okuma metni onarıldı.`);

  // 4. 1111_cumle.json onarımı
  let cumleler = readJson("1111_cumle.json");
  cumleler = deepCleanNode(deepApplyOrthographyFixes(cumleler));
  writeJson("1111_cumle.json", cumleler);
  console.log(`✅ 1111_cumle.json: ${cumleler.length} kalıp cümle onarıldı.`);

  // 5. atasozleri.json onarımı
  let atasozleri = readJson("atasozleri.json");
  atasozleri = deepCleanNode(deepApplyOrthographyFixes(atasozleri));
  writeJson("atasozleri.json", atasozleri);
  console.log(`✅ atasozleri.json: ${atasozleri.length} atasözü onarıldı.`);

  // 6. gorselKelimeler_guncel.json onarımı
  let gorselKelimeler = readJson("gorselKelimeler_guncel.json");
  gorselKelimeler = deepCleanNode(deepApplyOrthographyFixes(gorselKelimeler));
  writeJson("gorselKelimeler_guncel.json", gorselKelimeler);
  console.log(
    `✅ gorselKelimeler_guncel.json: ${gorselKelimeler.length} görsel kelime onarıldı.`
  );

  // 7. metinler_gramer_hap_bilgi.json onarımı (metin_27 sütun başlığı düzeltmesi dahil)
  let metinGramer = readJson("metinler_gramer_hap_bilgi.json");
  for (const item of metinGramer) {
    if (
      item.bagli_id === "metin_27" &&
      item.ayrintili_anlatim?.ozet_tablo?.sutunlar?.[2] === "Bağlı Harf-i Cer"
    ) {
      item.ayrintili_anlatim.ozet_tablo.sutunlar[2] =
        "Tamamlayıcı Öge (Muzâfun İleyh / Câr-Mecrûr)";
    }
  }
  metinGramer = deepCleanNode(deepApplyOrthographyFixes(metinGramer));
  writeJson("metinler_gramer_hap_bilgi.json", metinGramer);
  console.log(
    `✅ metinler_gramer_hap_bilgi.json: ${metinGramer.length}/60 tam şema gramer notu onarıldı.`
  );

  // 8. diyaloglar_gramer_hap_bilgi.json onarımı + eksik 7 kaydın (dlg_007, dlg_014 + dlg_016..dlg_020) tamamlanması
  let diyalogGramer = readJson("diyaloglar_gramer_hap_bilgi.json");
  const dlgGrammarMap = new Map();
  for (const item of diyalogGramer) {
    dlgGrammarMap.set(item.bagli_id, item);
  }

  // dlg_007 ve dlg_014 ayrintili_anlatim ekleme
  if (dlgGrammarMap.has("dlg_007")) {
    const g007 = dlgGrammarMap.get("dlg_007");
    g007.konu_basligi =
      "Sülâsî Emir Fiillerde Hemze-i Vasıl ve Sıra Sayıları (الصَّفْحَةُ الْعَاشِرَةُ)";
    g007.ayrintili_anlatim = DLG_007_AYRINTILI_ANLATIM;
  }
  if (dlgGrammarMap.has("dlg_014")) {
    const g014 = dlgGrammarMap.get("dlg_014");
    g014.ayrintili_anlatim = DLG_014_AYRINTILI_ANLATIM;
  }

  // dlg_016 – dlg_020 yeni kayıtları ekleme/güncelleme
  for (const newRec of NEW_DIALOGUE_GRAMMAR_RECORDS) {
    dlgGrammarMap.set(newRec.bagli_id, newRec);
  }

  // dlg_001 .. dlg_120 sırasına diz
  const sortedDlgGramer = Array.from(dlgGrammarMap.values()).sort((a, b) => {
    const na = parseInt(String(a.bagli_id).replace(/\D+/g, ""), 10) || 0;
    const nb = parseInt(String(b.bagli_id).replace(/\D+/g, ""), 10) || 0;
    return na - nb;
  });

  diyalogGramer = deepCleanNode(deepApplyOrthographyFixes(sortedDlgGramer));
  writeJson("diyaloglar_gramer_hap_bilgi.json", diyalogGramer);
  console.log(
    `✅ diyaloglar_gramer_hap_bilgi.json: ${diyalogGramer.length}/120 tam şema gramer notu tamamlandı.`
  );

  // 9. ek_gramer_hap_bilgi.json onarımı
  let ekGramer = readJson("ek_gramer_hap_bilgi.json");
  ekGramer = deepCleanNode(deepApplyOrthographyFixes(ekGramer));
  writeJson("ek_gramer_hap_bilgi.json", ekGramer);
  console.log(
    `✅ ek_gramer_hap_bilgi.json: ${ekGramer.length}/15 müstakil gramer notu onarıldı.`
  );

  // 10. seviye_tespit_sorulari.json onarımı
  let seviyeSorulari = readJson("seviye_tespit_sorulari.json");
  for (const q of seviyeSorulari) {
    if (![1, 2, 3].includes(q.zorluk_basamagi)) {
      q.zorluk_basamagi = Math.min(3, Math.max(1, Number(q.zorluk_basamagi) || 1));
    }
  }
  seviyeSorulari = deepCleanNode(deepApplyOrthographyFixes(seviyeSorulari));
  writeJson("seviye_tespit_sorulari.json", seviyeSorulari);
  console.log(
    `✅ seviye_tespit_sorulari.json: ${seviyeSorulari.length} seviye tespit ve konu tarama sorusu onarıldı.`
  );

  // ==========================================================================
  // DOĞRULAMA KONTROLLERİ (VALIDATION)
  // ==========================================================================
  let errors = 0;

  for (const fileName of JSON_FILES) {
    const rawContent = fs.readFileSync(path.join(DATA_DIR, fileName), "utf8");
    const parsed = JSON.parse(rawContent);

    if (rawContent.includes("\u0640")) {
      console.error(`❌ HATA: ${fileName} içinde hâlâ tatweel (\\u0640) var!`);
      errors++;
    }

    const checkStrings = (node) => {
      if (typeof node === "string") {
        if (node !== node.normalize("NFC")) {
          console.error(`❌ HATA: ${fileName} içinde NFC olmayan metin bulundu!`);
          errors++;
        }
      } else if (Array.isArray(node)) {
        node.forEach(checkStrings);
      } else if (node && typeof node === "object") {
        Object.values(node).forEach(checkStrings);
      }
    };
    checkStrings(parsed);
  }

  const allGrammar = [...diyalogGramer, ...metinGramer, ...ekGramer];
  if (allGrammar.length !== 195) {
    console.error(
      `❌ HATA: Toplam gramer notu 195 olmalıydı, bulunan: ${allGrammar.length}`
    );
    errors++;
  }

  for (const g of allGrammar) {
    const aa = g.ayrintili_anlatim;
    if (
      !aa ||
      !aa.formul_sema ||
      !Array.isArray(aa.adim_adim_anlatim) ||
      !aa.ozet_tablo ||
      !Array.isArray(aa.irab_tahlili) ||
      !aa.dikkat_sik_hata
    ) {
      console.error(`❌ HATA: ${g.bagli_id} ayrintili_anlatim şeması eksik!`);
      errors++;
      continue;
    }
    if (
      String(aa.dikkat_sik_hata.yanlis).trim() ===
      String(aa.dikkat_sik_hata.dogru).trim()
    ) {
      console.error(
        `❌ HATA: ${g.bagli_id} dikkat_sik_hata.yanlis === dogru!`
      );
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\n❌ Doğrulama ${errors} hata ile başarısız oldu.`);
    process.exit(1);
  }

  console.log(
    `\n🎉 Tüm ${JSON_FILES.length} JSON veri dosyası başarıyla onarıldı ve %100 doğrulandı (0 tatweel, %100 NFC, ${sozluk.length} sözlük, 195/195 tam şema gramer)!`
  );
}

main();
