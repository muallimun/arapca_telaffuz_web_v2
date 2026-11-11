// src/lib/classicalBridgeData.ts
// Fasih Arapça ↔ Kur'ân-ı Kerîm / Klasik İslami İlimler Kök Köprüsü
// ve Türkçeyle Ortak Kelimeler (Eşkökenliler & Yalancı Eşdeğerler) Veri Tabanı

import type { DictionaryItem } from "@/types/data";

export interface ClassicalRootBridgeEntry {
  root: string;
  rootSpaced: string;
  modernUsageAr: string;
  modernUsageTr: string;
  classicalTermAr: string;
  classicalTermTr: string;
  quranicExampleAr: string;
  quranicExampleTr: string;
  surahRef: string;
}

export interface TurkishArabicCognateEntry {
  arabicKey: string;
  arabicVocalized: string;
  turkishCognate: string;
  meaningTr: string;
  isFalseFriend?: boolean;
  nuanceNoteTr?: string;
}

export const CLASSICAL_ROOT_BRIDGE: Record<string, ClassicalRootBridgeEntry> = {
  علم: {
    root: "علم",
    rootSpaced: "ع ل م",
    modernUsageAr: "عِلْمٌ • مُعَلِّمٌ • تَعْلِيمٌ",
    modernUsageTr: "Bilim, bilgi, öğretmen ve eğitim",
    classicalTermAr: "الْعِلْمُ النَّافِعُ • عَالِمٌ",
    classicalTermTr: "Faydalı ilim, hakikati deliliyle bilme ve âlim",
    quranicExampleAr: "وَقُلْ رَبِّ زِدْنِي عِلْمًا",
    quranicExampleTr: "De ki: Rabbim, ilmimi artır!",
    surahRef: "Tâhâ, 20:114",
  },
  كتب: {
    root: "كتب",
    rootSpaced: "ك ت ب",
    modernUsageAr: "كِتَابٌ • مَكْتَبٌ • مَكْتَبَةٌ",
    modernUsageTr: "Kitap, ofis/çalışma masası ve kütüphane",
    classicalTermAr: "الْكِتَابُ • مَكْتُوبٌ",
    classicalTermTr: "İlahî vahiy kitabı; farz kılınmış, takdir edilmiş hüküm",
    quranicExampleAr: "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا",
    quranicExampleTr: "Şüphesiz namaz, müminlere vakitleri belirlenmiş bir farzdır.",
    surahRef: "Nisâ, 4:103",
  },
  قرأ: {
    root: "قرأ",
    rootSpaced: "ق ر أ",
    modernUsageAr: "قَرَأَ • قِرَاءَةٌ • قَارِئٌ",
    modernUsageTr: "Okumak, okuma metni ve okuyucu",
    classicalTermAr: "الْقُرْآنُ • عِلْمُ الْقِرَاءَاتِ",
    classicalTermTr: "Çokça okunan ilahî kelâm (Kur'ân) ve kıraat ilmi",
    quranicExampleAr: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ",
    quranicExampleTr: "Yaratan Rabbinin adıyla oku!",
    surahRef: "Alak, 96:1",
  },
  عمل: {
    root: "عمل",
    rootSpaced: "ع م ل",
    modernUsageAr: "عَمَلٌ • عَامِلٌ • مَعْمَلٌ",
    modernUsageTr: "İş, meslek, çalışan ve laboratuvar/atölye",
    classicalTermAr: "الْعَمَلُ الصَّالِحُ",
    classicalTermTr: "İmanla bütünleşen salih amel ve iradî davranış",
    quranicExampleAr: "فَمَنْ يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ",
    quranicExampleTr: "Kim zerre ağırlığınca bir hayır işlerse onu görür.",
    surahRef: "Zilzâl, 99:7",
  },
  صبر: {
    root: "صبر",
    rootSpaced: "ص ب ر",
    modernUsageAr: "صَبْرٌ • صَبُورٌ",
    modernUsageTr: "Dayanıklılık, sabırlı olma ve sebat",
    classicalTermAr: "الصَّبْرُ الْجَمِيلُ",
    classicalTermTr: "Şikâyetsiz gönül direnci, zorluk karşısında metanet",
    quranicExampleAr: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ",
    quranicExampleTr: "Şüphesiz Allah sabredenlerle beraberdir.",
    surahRef: "Bakara, 2:153",
  },
  شكر: {
    root: "شكر",
    rootSpaced: "ش ك ر",
    modernUsageAr: "شُكْرًا • تَشَكَّرَ",
    modernUsageTr: "Teşekkür ederim, minnettar olmak",
    classicalTermAr: "الشُّكْرُ • الشَّكُورُ",
    classicalTermTr: "Nimeti vereni bilip nimeti yerli yerinde kullanma (şükür)",
    quranicExampleAr: "لَئِنْ شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
    quranicExampleTr: "Andolsun, eğer şükrederseniz elbette size nimetimi artırırım.",
    surahRef: "İbrâhîm, 14:7",
  },
  رحم: {
    root: "رحم",
    rootSpaced: "ر ح م",
    modernUsageAr: "رَحْمَةٌ • مَرْحُومٌ",
    modernUsageTr: "Şefkat, acıma duygusu ve merhum",
    classicalTermAr: "الرَّحْمَنُ الرَّحِيمُ • صِلَةُ الرَّحِمِ",
    classicalTermTr: "Engin ilahî merhamet ve akrabalık bağını gözetme (sıla-i rahim)",
    quranicExampleAr: "وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ",
    quranicExampleTr: "Rahmetim ise her şeyi kuşatmıştır.",
    surahRef: "A'râf, 7:156",
  },
  عدل: {
    root: "عدل",
    rootSpaced: "ع د ل",
    modernUsageAr: "عَدَالَةٌ • مُعْتَدِلٌ",
    modernUsageTr: "Hukuk/adalet sistemi, ılımlı ve dengeli",
    classicalTermAr: "الْعَدْلُ وَالْقِسْطُ",
    classicalTermTr: "Her hak sahibine hakkını eksiksiz verme, zulmün zıddı",
    quranicExampleAr: "إِنَّ اللَّهَ يَأْمُرُ بِالْعَدْلِ وَالْإِحْسَانِ",
    quranicExampleTr: "Şüphesiz Allah adaleti ve iyiliği emreder.",
    surahRef: "Nahl, 16:90",
  },
  حكم: {
    root: "حكم",
    rootSpaced: "ح ك م",
    modernUsageAr: "حُكُومَةٌ • مَحْكَمَةٌ • حَكَمٌ",
    modernUsageTr: "Hükûmet, mahkeme ve maç hakemi",
    classicalTermAr: "الْحُكْمُ الشَّرْعِيُّ • الْحِكْمَةُ",
    classicalTermTr: "Fıkhî/ilahî hüküm, derin kavrayış ve hikmet",
    quranicExampleAr: "وَمَنْ يُؤْتَ الْحِكْمَةَ فَقَدْ أُوتِيَ خَيْرًا كَثِيرًا",
    quranicExampleTr: "Kime hikmet verilmişse ona pek büyük bir hayır verilmiştir.",
    surahRef: "Bakara, 2:269",
  },
  سلم: {
    root: "سلم",
    rootSpaced: "س ل م",
    modernUsageAr: "سَلَامٌ • سَلَامَةٌ • سِلْمٌ",
    modernUsageTr: "Selamlaşma, güvenlik ve barış",
    classicalTermAr: "الْإِسْلَامُ • دَارُ السَّلَامِ",
    classicalTermTr: "Esenlik, Allah'a tam teslimiyet ve cennet yurdu",
    quranicExampleAr: "سَلَامٌ قَوْلًا مِنْ رَبٍّ رَحِيمٍ",
    quranicExampleTr: "Çok merhametli Rab'den bir söz olarak 'Selâm!' vardır.",
    surahRef: "Yâsîn, 36:58",
  },
  فكر: {
    root: "فكر",
    rootSpaced: "ف ك ر",
    modernUsageAr: "فِكْرَةٌ • مُفَكِّرٌ",
    modernUsageTr: "Fikir, görüş, proje ve düşünür",
    classicalTermAr: "التَّفَكُّرُ فِي الْآفَاقِ",
    classicalTermTr: "Varlık ve âyetler üzerinde ibretle derin düşünme (tefekkür)",
    quranicExampleAr: "لَعَلَّكُمْ تَتَفَكَّرُونَ",
    quranicExampleTr: "Umulur ki derinlemesine düşünürsünüz.",
    surahRef: "Bakara, 2:219",
  },
  خلق: {
    root: "خلق",
    rootSpaced: "خ ل ق",
    modernUsageAr: "أَخْلَاقٌ • مَخْلُوقٌ",
    modernUsageTr: "Görgü/etik kuralları ve canlı varlık",
    classicalTermAr: "الْخَلْقُ • الْخُلُقُ الْحَسَنُ",
    classicalTermTr: "Yoktan yaratma kudreti ve yerleşik güzel huy (ahlâk)",
    quranicExampleAr: "وَإِنَّكَ لَعَلَى خُلُقٍ عَظِيمٍ",
    quranicExampleTr: "Şüphesiz sen yüce bir ahlâk üzeresin.",
    surahRef: "Kalem, 68:4",
  },
  نصر: {
    root: "نصر",
    rootSpaced: "ن ص ر",
    modernUsageAr: "نَصْرٌ • اِنْتِصَارٌ",
    modernUsageTr: "Başarı, galibiyet ve destekleme",
    classicalTermAr: "النَّصْرُ الْإِلَهِيُّ • الْأَنْصَارُ",
    classicalTermTr: "İlahî nusret/yardım ve Medineli yardımcı müminler (Ensâr)",
    quranicExampleAr: "إِنْ تَنْصُرُوا اللَّهَ يَنْصُرْكُمْ",
    quranicExampleTr: "Eğer Allah'ın dinine yardım ederseniz O da size yardım eder.",
    surahRef: "Muhammed, 47:7",
  },
  ذكر: {
    root: "ذكر",
    rootSpaced: "ذ ك ر",
    modernUsageAr: "تَذَكَّرَ • تَذْكِرَةٌ • مُذَكِّرَةٌ",
    modernUsageTr: "Hatırlamak, bilet ve ders notu/ajanda",
    classicalTermAr: "الذِّكْرُ • التَّذْكِيرُ",
    classicalTermTr: "Kalp ve dille Allah'ı anma (zikir); Kur'ân-ı Kerîm",
    quranicExampleAr: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
    quranicExampleTr: "Biliniz ki kalpler ancak Allah'ı anmakla huzur bulur.",
    surahRef: "Ra'd, 13:28",
  },
  هدي: {
    root: "هدي",
    rootSpaced: "ه د ي",
    modernUsageAr: "هَدِيَّةٌ • هَادٍ",
    modernUsageTr: "Hediye/armağan ve rehber",
    classicalTermAr: "الْهُدَى • الْهِدَايَةُ",
    classicalTermTr: "Hak yolu gösterme ve doğru yola ulaştırma (hidayet)",
    quranicExampleAr: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    quranicExampleTr: "Bizi dosdoğru yola ilet.",
    surahRef: "Fâtiha, 1:6",
  },
  فتح: {
    root: "فتح",
    rootSpaced: "ف ت ح",
    modernUsageAr: "فَتَحَ • مِفْتَاحٌ",
    modernUsageTr: "Kapıyı/pencereyi açmak ve anahtar",
    classicalTermAr: "الْفَتْحُ • الْفَاتِحَةُ",
    classicalTermTr: "Hayır kapılarının açılması, zafer ve Kur'ân'ın açılış sûresi",
    quranicExampleAr: "إِنَّا فَتَحْنَا لَكَ فَتْحًا مُبِينًا",
    quranicExampleTr: "Şüphesiz biz sana apaçık bir fetih verdik.",
    surahRef: "Fetih, 48:1",
  },
  جمع: {
    root: "جمع",
    rootSpaced: "ج م ع",
    modernUsageAr: "جَامِعَةٌ • اِجْتِمَاعٌ • جَمِيعًا",
    modernUsageTr: "Üniversite, toplantı ve hep birlikte",
    classicalTermAr: "الْجَمَاعَةُ • يَوْمُ الْجُمُعَةِ",
    classicalTermTr: "Birlik şuurundaki mümin topluluğu (cemaat) ve Cuma günü",
    quranicExampleAr: "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا",
    quranicExampleTr: "Hep birlikte Allah'ın ipine sımsıkı sarılın, parçalanıp bölünmeyin.",
    surahRef: "Âl-i İmrân, 3:103",
  },
  حفظ: {
    root: "حفظ",
    rootSpaced: "ح ف ظ",
    modernUsageAr: "حَفِظَ • مَحْفَظَةٌ • مُحَافَظَةٌ",
    modernUsageTr: "Ezberlemek/korumak, cüzdan ve vilayet",
    classicalTermAr: "الْحِفْظُ • الْحَافِظُ",
    classicalTermTr: "İlahî muhafaza ve Kur'ân'ı baştan sona ezberleyen (hâfız)",
    quranicExampleAr: "فَاللَّهُ خَيْرٌ حَافِظًا",
    quranicExampleTr: "Allah en hayırlı koruyucudur.",
    surahRef: "Yûsuf, 12:64",
  },
  صدق: {
    root: "صدق",
    rootSpaced: "ص د ق",
    modernUsageAr: "صَدِيقٌ • صَادِقٌ",
    modernUsageTr: "Arkadaş/dost ve dürüst kimse",
    classicalTermAr: "الصِّدْقُ • الصَّدَقَةُ",
    classicalTermTr: "Özü sözü bir olma (sıdk) ve sadakatin nişanesi infak (sadaka)",
    quranicExampleAr: "يَا أَيُّهَا الَّذِينَ آمَنُوا اتَّقُوا اللَّهَ وَكُونُوا مَعَ الصَّادِقِينَ",
    quranicExampleTr: "Ey iman edenler! Allah'a karşı gelmekten sakının ve doğrularla beraber olun.",
    surahRef: "Tevbe, 9:119",
  },
  حقق: {
    root: "حقق",
    rootSpaced: "ح ق ق",
    modernUsageAr: "حَقِيقَةٌ • حُقُوقٌ • تَحْقِيقٌ",
    modernUsageTr: "Gerçek, yasal haklar ve inceleme/soruşturma",
    classicalTermAr: "الْحَقُّ • حُقُوقُ الْعِبَادِ",
    classicalTermTr: "Sabit ve değişmez hakikat (el-Hakk) ile kul hakları",
    quranicExampleAr: "وَقُلْ جَاءَ الْحَقُّ وَزَهَقَ الْبَاطِلُ",
    quranicExampleTr: "De ki: Hak geldi, bâtıl yok oldu.",
    surahRef: "İsrâ, 17:81",
  },
  شهد: {
    root: "شهد",
    rootSpaced: "ش ه د",
    modernUsageAr: "شَاهَدَ • شَهَادَةٌ • مَشْهَدٌ",
    modernUsageTr: "İzlemek, diploma/sertifika ve sahne",
    classicalTermAr: "الشَّهَادَةُ • عَالَمُ الشَّهَادَةِ",
    classicalTermTr: "Tevhid şehadeti, hakikate tanıklık ve görünen âlem",
    quranicExampleAr: "شَهِدَ اللَّهُ أَنَّهُ لَا إِلَهَ إِلَّا هُوَ",
    quranicExampleTr: "Allah, kendisinden başka ilâh olmadığına şahitlik etti.",
    surahRef: "Âl-i İmrân, 3:18",
  },
  عبد: {
    root: "عبد",
    rootSpaced: "ع ب د",
    modernUsageAr: "مَعْبَدٌ • عَبْدُ اللَّهِ",
    modernUsageTr: "İbadethane ve Abdullah ismi",
    classicalTermAr: "الْعِبَادَةُ • الْعُبُودِيَّةُ",
    classicalTermTr: "Gönülden boyun eğerek yalnız Allah'a kulluk (ubûdiyet)",
    quranicExampleAr: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    quranicExampleTr: "Yalnız sana kulluk eder ve yalnız senden yardım dileriz.",
    surahRef: "Fâtiha, 1:5",
  },
  رزق: {
    root: "رزق",
    rootSpaced: "ر ز ق",
    modernUsageAr: "رِزْقٌ • مَرْزُوقٌ",
    modernUsageTr: "Geçim kaynağı, kazanç ve nasip",
    classicalTermAr: "الرَّزَّاقُ • الرِّزْقُ الْحَلَالُ",
    classicalTermTr: "Tüm canlıların maddi-manevi azığını veren (er-Rezzâk) ve helal rızık",
    quranicExampleAr: "إِنَّ اللَّهَ هُوَ الرَّزَّاقُ ذُو الْقُوَّةِ الْمَتِينُ",
    quranicExampleTr: "Şüphesiz Allah, rızık veren, mutlak güç ve kuvvet sahibi olandır.",
    surahRef: "Zâriyât, 51:58",
  },
  غفر: {
    root: "غفر",
    rootSpaced: "غ ف ر",
    modernUsageAr: "مَغْفِرَةٌ • غُفْرَانٌ",
    modernUsageTr: "Affetme ve hoşgörüyle bağışlama",
    classicalTermAr: "الِاسْتِغْفَارُ • الْغَفَّارُ",
    classicalTermTr: "Günahı örtüp bağışlama talebi (istiğfar) ve çok bağışlayan Rab",
    quranicExampleAr: "وَإِنِّي لَغَفَّارٌ لِمَنْ تَابَ وَآمَنَ",
    quranicExampleTr: "Şüphesiz ben, tövbe edip iman edeni çok bağışlayıcıyım.",
    surahRef: "Tâhâ, 20:82",
  },
  أمن: {
    root: "أمن",
    rootSpaced: "أ م ن",
    modernUsageAr: "أَمْنٌ • أَمَانٌ • تَأْمِينٌ",
    modernUsageTr: "Güvenlik, emniyet ve sigorta",
    classicalTermAr: "الْإِيمَانُ • الْأَمَانَةُ",
    classicalTermTr: "Kalbe güven veren tasdik (îmân) ve korunması gereken emanet",
    quranicExampleAr: "الَّذِينَ آمَنُوا وَلَمْ يَلْبِسُوا إِيمَانَهُمْ بِظُلْمٍ أُولَئِكَ لَهُمُ الْأَمْنُ",
    quranicExampleTr: "İman edip imanlarına zulüm bulaştırmayanlar var ya, işte güven onlarındır.",
    surahRef: "En'âm, 6:82",
  },
  حسن: {
    root: "حسن",
    rootSpaced: "ح س ن",
    modernUsageAr: "حَسَنٌ • أَحْسَنُ • تَحْسِينٌ",
    modernUsageTr: "Güzel, en iyi ve iyileştirme/geliştirme",
    classicalTermAr: "الْإِحْسَانُ • الْحَسَنَةُ",
    classicalTermTr: "Allah'ı görüyormuşçasına en güzel kıvamda kulluk ve iyilik (ihsân)",
    quranicExampleAr: "هَلْ جَزَاءُ الْإِحْسَانِ إِلَّا الْإِحْسَانُ",
    quranicExampleTr: "İyiliğin karşılığı iyilikten başka mıdır?",
    surahRef: "Rahmân, 55:60",
  },
  قول: {
    root: "قول",
    rootSpaced: "ق و ل",
    modernUsageAr: "قَالَ • مَقَالٌ • مَقُولَةٌ",
    modernUsageTr: "Söylemek, köşe yazısı/makale ve özdeyiş",
    classicalTermAr: "الْقَوْلُ السَّدِيدُ • الْقَوْلُ الْمَعْرُوفُ",
    classicalTermTr: "Doğru, isabetli ve gönül alıcı güzel söz",
    quranicExampleAr: "وَقُولُوا لِلنَّاسِ حُسْنًا",
    quranicExampleTr: "İnsanlara güzel söz söyleyin.",
    surahRef: "Bakara, 2:83",
  },
  سمع: {
    root: "سمع",
    rootSpaced: "س م ع",
    modernUsageAr: "سَمِعَ • سَمَّاعَةٌ • مُسْتَمِعٌ",
    modernUsageTr: "Duymak/dinlemek, kulaklık ve dinleyici",
    classicalTermAr: "السَّمِيعُ • السَّمْعُ وَالطَّاعَةُ",
    classicalTermTr: "Her sesi işiten (es-Semî') ve hakikate kulak verip uyma",
    quranicExampleAr: "إِنَّهُ هُوَ السَّمِيعُ الْبَصِيرُ",
    quranicExampleTr: "Şüphesiz O, hakkıyla işiten ve hakkıyla görendir.",
    surahRef: "İsrâ, 17:1",
  },
  بصر: {
    root: "بصر",
    rootSpaced: "ب ص ر",
    modernUsageAr: "بَصَرٌ • نَظَّارَةٌ طِبِّيَّةٌ",
    modernUsageTr: "Görme duyusu ve göz sağlığı",
    classicalTermAr: "الْبَصِيرَةُ • الْبَصِيرُ",
    classicalTermTr: "Kalp gözü, feraset/içgörü (basîret) ve her şeyi gören Rab",
    quranicExampleAr: "قَدْ جَاءَكُمْ بَصَائِرُ مِنْ رَبِّكُمْ",
    quranicExampleTr: "Muhakkak size Rabbinizden basiretler (apaçık deliller) gelmiştir.",
    surahRef: "En'âm, 6:104",
  },
  قلب: {
    root: "قلب",
    rootSpaced: "ق ل ب",
    modernUsageAr: "قَلْبٌ • تَقَلُّبٌ",
    modernUsageTr: "Kalp/yürek ve hava/durum değişimi",
    classicalTermAr: "الْقَلْبُ السَّلِيمُ",
    classicalTermTr: "Şüphe ve manevi hastalıklardan arınmış duru gönül (kalb-i selîm)",
    quranicExampleAr: "إِلَّا مَنْ أَتَى اللَّهَ بِقَلْبٍ سَلِيمٍ",
    quranicExampleTr: "Ancak Allah'a selîm (temiz) bir kalple gelenler kurtuluşa erer.",
    surahRef: "Şuarâ, 26:89",
  },
  نفس: {
    root: "نفس",
    rootSpaced: "ن ف س",
    modernUsageAr: "نَفْسٌ • تَنَفُّسٌ • عِلْمُ النَّفْسِ",
    modernUsageTr: "Kendisi, nefes alma ve psikoloji bilimi",
    classicalTermAr: "النَّفْسُ الْمُطْمَئِنَّةُ • تَزْكِيَةُ النَّفْسِ",
    classicalTermTr: "İnsan benliği, huzura ermiş nefis ve nefis terbiyesi",
    quranicExampleAr: "كُلُّ نَفْسٍ ذَائِقَةُ الْمَوْتِ",
    quranicExampleTr: "Her nefis (can) ölümü tadacaktır.",
    surahRef: "Âl-i İmrân, 3:185",
  },
  وقت: {
    root: "وقت",
    rootSpaced: "و ق ت",
    modernUsageAr: "وَقْتٌ • مُؤَقَّتٌ • تَوْقِيتٌ",
    modernUsageTr: "Zaman, geçici süreli ve saat dilimi",
    classicalTermAr: "الْمَوَاقِيتُ الشَّرْعِيَّةُ",
    classicalTermTr: "İbadetlerin belirlenmiş zaman ve mekân sınırları (mîkât)",
    quranicExampleAr: "قُلْ هِيَ مَوَاقِيتُ لِلنَّاسِ وَالْحَجِّ",
    quranicExampleTr: "De ki: Onlar insanlar ve hac için vakit ölçüleridir.",
    surahRef: "Bakara, 2:189",
  },
  خير: {
    root: "خير",
    rootSpaced: "خ ي ر",
    modernUsageAr: "بِخَيْرٍ • اِخْتِيَارٌ • خَيْرِيٌّ",
    modernUsageTr: "İyilik/afiyet, tercih hakkı ve hayırseverlik",
    classicalTermAr: "الْخَيْرَاتُ • الْخِيَرَةُ",
    classicalTermTr: "Dünya ve âhirette fayda sağlayan erdemli işler (hayrât)",
    quranicExampleAr: "فَاسْتَبِقُوا الْخَيْرَاتِ",
    quranicExampleTr: "Öyleyse hayırlarda yarışın!",
    surahRef: "Bakara, 2:148",
  },
  سبل: {
    root: "سبل",
    rootSpaced: "س ب ل",
    modernUsageAr: "سَبِيلٌ • وَسَائِلُ",
    modernUsageTr: "Yol, güzergâh ve yöntem/çözüm yolu",
    classicalTermAr: "فِي سَبِيلِ اللَّهِ • ابْنُ السَّبِيلِ",
    classicalTermTr: "Allah rızası yolu ve yolda kalmış yolcu (ibnü's-sebîl)",
    quranicExampleAr: "قُلْ هَذِهِ سَبِيلِي أَدْعُو إِلَى اللَّهِ عَلَى بَصِيرَةٍ",
    quranicExampleTr: "De ki: İşte bu benim yolumdur; basiret üzere Allah'a davet ediyorum.",
    surahRef: "Yûsuf, 12:108",
  },
  نور: {
    root: "نور",
    rootSpaced: "ن و ر",
    modernUsageAr: "نُورٌ • إِنَارَةٌ • مَنَارَةٌ",
    modernUsageTr: "Işık, aydınlatma ve deniz feneri/minare",
    classicalTermAr: "النُّورُ الْمُبِينُ",
    classicalTermTr: "Hakikati aydınlatan ilahî hidayet ışığı (nûr)",
    quranicExampleAr: "اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ",
    quranicExampleTr: "Allah, göklerin ve yerin nûrudur.",
    surahRef: "Nûr, 24:35",
  },
  أمر: {
    root: "أمر",
    rootSpaced: "أ م ر",
    modernUsageAr: "أَمْرٌ • مُؤْتَمَرٌ • اسْتِمَارَةٌ",
    modernUsageTr: "Konu/talimat, kongre/konferans ve başvuru formu",
    classicalTermAr: "أُولُو الْأَمْرِ • الْأَمْرُ بِالْمَعْرُوفِ",
    classicalTermTr: "Yetki ve sorumluluk sahipleri; iyiliği teşvik etme",
    quranicExampleAr: "وَأَمْرُهُمْ شُورَى بَيْنَهُمْ",
    quranicExampleTr: "Onların işleri, aralarında istişare (danışma) iledir.",
    surahRef: "Şûrâ, 42:38",
  },
  فهم: {
    root: "فهم",
    rootSpaced: "ف ه م",
    modernUsageAr: "فَهِمَ • تَفَاهُمٌ • مَفْهُومٌ",
    modernUsageTr: "Anlamak, karşılıklı uzlaşı ve kavram",
    classicalTermAr: "الْفَهْمُ الصَّحِيحُ • الْفِقْهُ",
    classicalTermTr: "Nasların inceliğini ve maksadını doğru kavrayış (fehm)",
    quranicExampleAr: "فَفَهَّمْنَاهَا سُلَيْمَانَ",
    quranicExampleTr: "Biz o hükmün kavranışını Süleyman'a bellettik.",
    surahRef: "Enbiyâ, 21:79",
  },
  يسر: {
    root: "يسر",
    rootSpaced: "ي س ر",
    modernUsageAr: "يَسِيرٌ • تَيْسِيرٌ • مَيْسُورٌ",
    modernUsageTr: "Kolay, kolaylaştırma ve elverişli durum",
    classicalTermAr: "التَّيْسِيرُ وَرَفْعُ الْحَرَجِ",
    classicalTermTr: "Dinde zorluğu kaldırma ve kolaylaştırma ilkesi (teysîr)",
    quranicExampleAr: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    quranicExampleTr: "Muhakkak zorlukla beraber bir kolaylık vardır.",
    surahRef: "İnşirâh, 94:5",
  },
  دعو: {
    root: "دعو",
    rootSpaced: "د ع و",
    modernUsageAr: "دَعْوَةٌ • اسْتِدْعَاءٌ",
    modernUsageTr: "Davetiye, çağrı ve mahkeme/kurum celbi",
    classicalTermAr: "الدُّعَاءُ • الدَّعْوَةُ بِالْحِكْمَةِ",
    classicalTermTr: "Kulun Rabbine yakarışı (duâ) ve hikmetle hakka çağrı",
    quranicExampleAr: "ادْعُ إِلَى سَبِيلِ رَبِّكَ بِالْحِكْمَةِ وَالْمَوْعِظَةِ الْحَسَنَةِ",
    quranicExampleTr: "Rabbinin yoluna hikmetle ve güzel öğütle davet et.",
    surahRef: "Nahl, 16:125",
  },
  صلح: {
    root: "صلح",
    rootSpaced: "ص ل ح",
    modernUsageAr: "إِصْلَاحٌ • مَصْلَحَةٌ • صَالِحٌ",
    modernUsageTr: "Onarım/reform, kamu yararı ve kullanıma uygun",
    classicalTermAr: "الصُّلْحُ • الصَّلَاحُ وَالْمَصْلَحَةُ",
    classicalTermTr: "İnsanlar arasını barıştırma (sulh), dirlik ve maslahat",
    quranicExampleAr: "إِنْ أُرِيدُ إِلَّا الْإِصْلَاحَ مَا اسْتَطَعْتُ",
    quranicExampleTr: "Ben gücüm yettiğince ancak ıslah etmek (düzeltmek) istiyorum.",
    surahRef: "Hûd, 11:88",
  },
  توب: {
    root: "توب",
    rootSpaced: "ت و ب",
    modernUsageAr: "تَابَ • تَائِبٌ",
    modernUsageTr: "Hatadan vazgeçmek, pişman olup dönmek",
    classicalTermAr: "التَّوْبَةُ النَّصُوحُ • التَّوَّابُ",
    classicalTermTr: "Samimi dönüş (tevbe-i nasûh) ve tövbeleri çokça kabul eden Rab",
    quranicExampleAr: "إِنَّ اللَّهَ يُحِبُّ التَّوَّابِينَ وَيُحِبُّ الْمُتَطَهِّرِينَ",
    quranicExampleTr: "Şüphesiz Allah çok tövbe edenleri ve çok temizlenenleri sever.",
    surahRef: "Bakara, 2:222",
  },
  كرم: {
    root: "كرم",
    rootSpaced: "ك ر م",
    modernUsageAr: "كَرِيمٌ • إِكْرَامٌ • تَكْرِيمٌ",
    modernUsageTr: "Cömert, konuk ağırlama ve onur ödülü",
    classicalTermAr: "كَرَامَةُ الْإِنْسَانِ • الْكَرِيمُ",
    classicalTermTr: "İnsanın doğuştan saygınlığı (kerâmet) ve cömertliği sonsuz Rab",
    quranicExampleAr: "وَلَقَدْ كَرَّمْنَا بَنِي آدَمَ",
    quranicExampleTr: "Andolsun biz Âdemoğullarını mükerrem (saygın) kıldık.",
    surahRef: "İsrâ, 17:70",
  },
  نفع: {
    root: "نفع",
    rootSpaced: "ن ف ع",
    modernUsageAr: "نَافِعٌ • مَنْفَعَةٌ",
    modernUsageTr: "Yararlı, fayda ve kazanım",
    classicalTermAr: "النَّفْعُ الْمُتَعَدِّي",
    classicalTermTr: "Başkalarına ve topluma ulaşan kalıcı fayda",
    quranicExampleAr: "وَأَمَّا مَا يَنْفَعُ النَّاسَ فَيَمْكُثُ فِي الْأَرْضِ",
    quranicExampleTr: "İnsanlara fayda veren şey ise yeryüzünde kalır.",
    surahRef: "Ra'd, 13:17",
  },
  وعد: {
    root: "وعد",
    rootSpaced: "و ع د",
    modernUsageAr: "مَوْعِدٌ • وَعْدٌ",
    modernUsageTr: "Randevu saati ve verilen söz",
    classicalTermAr: "الْوَعْدُ الصَّادِقُ • الْمِيعَادُ",
    classicalTermTr: "Ahde vefa, şaşmaz ilahî söz ve buluşma vakti (mîâd)",
    quranicExampleAr: "إِنَّ اللَّهَ لَا يُخْلِفُ الْمِيعَادَ",
    quranicExampleTr: "Şüphesiz Allah vaadinden dönmez.",
    surahRef: "Âl-i İmrân, 3:9",
  },
  طهر: {
    root: "طهر",
    rootSpaced: "ط ه ر",
    modernUsageAr: "طَاهِرٌ • مُطَهِّرٌ",
    modernUsageTr: "Temiz, hijyenik ve dezenfektan",
    classicalTermAr: "الطَّهَارَةُ • الطَّهُورُ",
    classicalTermTr: "Maddi ve manevi arınma (tahâret), abdest ve nezafet",
    quranicExampleAr: "وَثِيَابَكَ فَطَهِّرْ",
    quranicExampleTr: "Elbiseni tertemiz tut!",
    surahRef: "Müddessir, 74:4",
  },
  وزن: {
    root: "وزن",
    rootSpaced: "و ز ن",
    modernUsageAr: "وَزْنٌ • مِيزَانٌ • مِيزَانِيَّةٌ",
    modernUsageTr: "Kilo/ağırlık, terazi ve bütçe",
    classicalTermAr: "الْمِيزَانُ وَالْقِسْطُ",
    classicalTermTr: "Ölçü ve tartıda dürüstlük; âhiret adalet terazisi (mîzân)",
    quranicExampleAr: "وَأَقِيمُوا الْوَزْنَ بِالْقِسْطِ وَلَا تُخْسِرُوا الْمِيزَانَ",
    quranicExampleTr: "Tartıyı adaletle tutun, teraziyi eksik tartmayın.",
    surahRef: "Rahmân, 55:9",
  },
  شفع: {
    root: "شفع",
    rootSpaced: "ش ف ع",
    modernUsageAr: "شَفْعٌ • مَشْفُوعٌ",
    modernUsageTr: "Çift sayı ve ekli belge",
    classicalTermAr: "الشَّفَاعَةُ الْحَسَنَةُ",
    classicalTermTr: "Hayırlı bir işe vesile ve aracı olma; âhiret şefaati",
    quranicExampleAr: "مَنْ يَشْفَعْ شَفَاعَةً حَسَنَةً يَكُنْ لَهُ نَصِيبٌ مِنْهَا",
    quranicExampleTr: "Kim güzel bir işe aracılık ederse ondan kendisine bir pay vardır.",
    surahRef: "Nisâ, 4:85",
  },
  فوز: {
    root: "فوز",
    rootSpaced: "ف و ز",
    modernUsageAr: "فَازَ • فَوْزٌ • فَائِزٌ",
    modernUsageTr: "Yarışmayı/maçı kazanmak, galibiyet ve kazanan",
    classicalTermAr: "الْفَوْزُ الْعَظِيمُ",
    classicalTermTr: "Ebedî rıza ve âhiret kurtuluşuna erişme (fevz-i azîm)",
    quranicExampleAr: "وَذَلِكَ الْفَوْزُ الْعَظِيمُ",
    quranicExampleTr: "İşte en büyük kurtuluş ve başarı budur.",
    surahRef: "Tevbe, 9:72",
  },
  درس: {
    root: "درس",
    rootSpaced: "د ر س",
    modernUsageAr: "دَرْسٌ • مَدْرَسَةٌ • دِرَاسَةٌ",
    modernUsageTr: "Ders, okul ve akademik çalışma",
    classicalTermAr: "الْمُدَارَسَةُ • دَرْسُ الْعِلْمِ",
    classicalTermTr: "Metni karşılıklı okuyup müzakere etme (müdârese)",
    quranicExampleAr: "وَلِيَقُولُوا دَرَسْتَ",
    quranicExampleTr: "Ve 'Sen bunları okuyup ders almışsın' desinler diye...",
    surahRef: "En'âm, 6:105",
  },
  سفر: {
    root: "سفر",
    rootSpaced: "س ف ر",
    modernUsageAr: "سَفَرٌ • مُسَافِرٌ • جَوَازُ السَّفَرِ",
    modernUsageTr: "Yolculuk, yolcu ve pasaport",
    classicalTermAr: "رُخَصُ السَّفَرِ • الْأَسْفَارُ",
    classicalTermTr: "Yolculuk kolaylıkları (seferîlik hükümleri) ve yazılı ciltler",
    quranicExampleAr: "فَمَنْ كَانَ مِنْكُمْ مَرِيضًا أَوْ عَلَى سَفَرٍ فَعِدَّةٌ مِنْ أَيَّامٍ أُخَرَ",
    quranicExampleTr: "Sizden kim hasta olur veya yolculukta bulunursa, tutamadığı günler sayısınca başka günlerde tutar.",
    surahRef: "Bakara, 2:184",
  },
};

export const TURKISH_ARABIC_COGNATES: TurkishArabicCognateEntry[] = [
  {
    arabicKey: "كتاب",
    arabicVocalized: "كِتَابٌ",
    turkishCognate: "kitap",
    meaningTr: "Kitap",
  },
  {
    arabicKey: "قلم",
    arabicVocalized: "قَلَمٌ",
    turkishCognate: "kalem",
    meaningTr: "Kalem",
  },
  {
    arabicKey: "دفتر",
    arabicVocalized: "دَفْتَرٌ",
    turkishCognate: "defter",
    meaningTr: "Defter",
  },
  {
    arabicKey: "مكتب",
    arabicVocalized: "مَكْتَبٌ",
    turkishCognate: "mektep",
    meaningTr: "Çalışma masası, ofis, büro",
    isFalseFriend: true,
    nuanceNoteTr:
      "Türkçede 'mektep' okul anlamında kullanılır; modern Fasih Arapçada ise مَكْتَبٌ 'ofis / çalışma masası' demektir, okul için مَدْرَسَةٌ kullanılır.",
  },
  {
    arabicKey: "مدرسة",
    arabicVocalized: "مَدْرَسَةٌ",
    turkishCognate: "medrese",
    meaningTr: "Okul",
    nuanceNoteTr:
      "Tarihî Türkçede yükseköğretim kurumu olan 'medrese', modern Fasih Arapçada ilkokuldan liseye tüm 'okul' türlerinin genel adıdır.",
  },
  {
    arabicKey: "معلم",
    arabicVocalized: "مُعَلِّمٌ",
    turkishCognate: "muallim",
    meaningTr: "Öğretmen",
  },
  {
    arabicKey: "طالب",
    arabicVocalized: "طَالِبٌ",
    turkishCognate: "talebe",
    meaningTr: "Öğrenci (çoğulu طَلَبَةٌ -> Türkçeye 'talebe' olarak geçmiştir)",
  },
  {
    arabicKey: "صف",
    arabicVocalized: "صَفٌّ",
    turkishCognate: "saf / sınıf",
    meaningTr: "Sınıf, sıra, saf",
  },
  {
    arabicKey: "درس",
    arabicVocalized: "دَرْسٌ",
    turkishCognate: "ders",
    meaningTr: "Ders",
  },
  {
    arabicKey: "علم",
    arabicVocalized: "عِلْمٌ",
    turkishCognate: "ilim",
    meaningTr: "Bilim, ilim, bilgi",
  },
  {
    arabicKey: "عالم",
    arabicVocalized: "عَالِمٌ",
    turkishCognate: "âlim",
    meaningTr: "Bilgin, bilim insanı (عَالَمٌ fethalı okunursa 'âlem/dünya' olur)",
  },
  {
    arabicKey: "خبر",
    arabicVocalized: "خَبَرٌ",
    turkishCognate: "haber",
    meaningTr: "Haber, bilgi",
  },
  {
    arabicKey: "وقت",
    arabicVocalized: "وَقْتٌ",
    turkishCognate: "vakit",
    meaningTr: "Vakit, zaman",
  },
  {
    arabicKey: "ساعة",
    arabicVocalized: "سَاعَةٌ",
    turkishCognate: "saat",
    meaningTr: "Saat",
  },
  {
    arabicKey: "صباح",
    arabicVocalized: "صَبَاحٌ",
    turkishCognate: "sabah",
    meaningTr: "Sabah",
  },
  {
    arabicKey: "مساء",
    arabicVocalized: "مَسَاءٌ",
    turkishCognate: "mesâ",
    meaningTr: "Akşam",
  },
  {
    arabicKey: "سلام",
    arabicVocalized: "سَلَامٌ",
    turkishCognate: "selam",
    meaningTr: "Selam, barış, esenlik",
  },
  {
    arabicKey: "صبر",
    arabicVocalized: "صَبْرٌ",
    turkishCognate: "sabır",
    meaningTr: "Sabır, dayanma",
  },
  {
    arabicKey: "شكر",
    arabicVocalized: "شُكْرٌ",
    turkishCognate: "şükür",
    meaningTr: "Şükür, teşekkür",
  },
  {
    arabicKey: "رحمة",
    arabicVocalized: "رَحْمَةٌ",
    turkishCognate: "rahmet / merhamet",
    meaningTr: "Merhamet, şefkat, rahmet",
  },
  {
    arabicKey: "عدالة",
    arabicVocalized: "عَدَالَةٌ",
    turkishCognate: "adalet",
    meaningTr: "Adalet",
  },
  {
    arabicKey: "حقيقة",
    arabicVocalized: "حَقِيقَةٌ",
    turkishCognate: "hakikat",
    meaningTr: "Gerçek, hakikat",
  },
  {
    arabicKey: "حق",
    arabicVocalized: "حَقٌّ",
    turkishCognate: "hak",
    meaningTr: "Hak, doğru, gerçek (çoğulu حُقُوقٌ -> hukuk)",
  },
  {
    arabicKey: "حقوق",
    arabicVocalized: "حُقُوقٌ",
    turkishCognate: "hukuk",
    meaningTr: "Haklar, hukuk bilimi",
  },
  {
    arabicKey: "أخلاق",
    arabicVocalized: "أَخْلَاقٌ",
    turkishCognate: "ahlak",
    meaningTr: "Ahlak, huylar (خُلُقٌ kelimesinin çoğulu)",
  },
  {
    arabicKey: "أدب",
    arabicVocalized: "أَدَبٌ",
    turkishCognate: "edep / edebiyat",
    meaningTr: "Edep, görgü ve edebiyat",
  },
  {
    arabicKey: "فكرة",
    arabicVocalized: "فِكْرَةٌ",
    turkishCognate: "fikir",
    meaningTr: "Fikir, düşünce",
  },
  {
    arabicKey: "عقل",
    arabicVocalized: "عَقْلٌ",
    turkishCognate: "akıl",
    meaningTr: "Akıl, zekâ",
  },
  {
    arabicKey: "قلب",
    arabicVocalized: "قَلْبٌ",
    turkishCognate: "kalp",
    meaningTr: "Kalp, gönül",
  },
  {
    arabicKey: "روح",
    arabicVocalized: "رُوحٌ",
    turkishCognate: "ruh",
    meaningTr: "Ruh, can",
  },
  {
    arabicKey: "نفس",
    arabicVocalized: "نَفْسٌ",
    turkishCognate: "nefis / nefes",
    meaningTr: "Kendi, can, nefis (نَفَسٌ fethalı okunursa 'nefes/soluk')",
  },
  {
    arabicKey: "حياة",
    arabicVocalized: "حَيَاةٌ",
    turkishCognate: "hayat",
    meaningTr: "Hayat, yaşam",
  },
  {
    arabicKey: "دنيا",
    arabicVocalized: "دُنْيَا",
    turkishCognate: "dünya",
    meaningTr: "Dünya",
  },
  {
    arabicKey: "دولة",
    arabicVocalized: "دَوْلَةٌ",
    turkishCognate: "devlet",
    meaningTr: "Devlet, ülke",
  },
  {
    arabicKey: "وطن",
    arabicVocalized: "وَطَنٌ",
    turkishCognate: "vatan",
    meaningTr: "Vatan, yurt",
  },
  {
    arabicKey: "سفر",
    arabicVocalized: "سَفَرٌ",
    turkishCognate: "sefer",
    meaningTr: "Yolculuk, seyahat",
    isFalseFriend: true,
    nuanceNoteTr:
      "Türkçede 'bu sefer / üç sefer' şeklinde 'kez/defa' anlamında da kullanılır; Arapçada سَفَرٌ yalnızca 'yolculuk' demektir ('defa' için مَرَّةٌ denir).",
  },
  {
    arabicKey: "مسافر",
    arabicVocalized: "مُسَافِرٌ",
    turkishCognate: "misafir",
    meaningTr: "Yolcu, seyahat eden kimse",
    isFalseFriend: true,
    nuanceNoteTr:
      "Yalancı Eşdeğer (False Friend)! Arapçada مُسَافِرٌ 'yolcu' demektir. Türkçedeki ev konuğu 'misafir' için Arapçada ضَيْفٌ (çoğulu ضُيُوفٌ) kullanılır.",
  },
  {
    arabicKey: "ضيف",
    arabicVocalized: "ضَيْفٌ",
    turkishCognate: "zıyâfet (kökteş)",
    meaningTr: "Konuk, misafir (Türkçedeki 'ziyafet' bu kökten gelir)",
  },
  {
    arabicKey: "تجارة",
    arabicVocalized: "تِجَارَةٌ",
    turkishCognate: "ticaret",
    meaningTr: "Ticaret, alışveriş",
  },
  {
    arabicKey: "حساب",
    arabicVocalized: "حِسَابٌ",
    turkishCognate: "hesap",
    meaningTr: "Hesap, fatura, banka hesabı",
  },
  {
    arabicKey: "بناء",
    arabicVocalized: "بِنَاءٌ",
    turkishCognate: "bina",
    meaningTr: "Bina, yapı, inşa",
  },
  {
    arabicKey: "مسجد",
    arabicVocalized: "مَسْجِدٌ",
    turkishCognate: "mescit",
    meaningTr: "Cami, mescit",
  },
  {
    arabicKey: "جامع",
    arabicVocalized: "جَامِعٌ",
    turkishCognate: "cami",
    meaningTr: "Büyük cami, toplayan",
  },
  {
    arabicKey: "منارة",
    arabicVocalized: "مَنَارَةٌ",
    turkishCognate: "minare",
    meaningTr: "Minare, deniz feneri",
  },
  {
    arabicKey: "شفاء",
    arabicVocalized: "شِفَاءٌ",
    turkishCognate: "şifa",
    meaningTr: "Şifa, iyileşme",
  },
  {
    arabicKey: "دواء",
    arabicVocalized: "دَوَاءٌ",
    turkishCognate: "deva",
    meaningTr: "İlaç, deva, çare",
  },
  {
    arabicKey: "طبيب",
    arabicVocalized: "طَبِيبٌ",
    turkishCognate: "tabip",
    meaningTr: "Doktor, hekim, tabip",
  },
  {
    arabicKey: "أثر",
    arabicVocalized: "أَثَرٌ",
    turkishCognate: "eser",
    meaningTr: "İz, etki, tarihî eser",
  },
  {
    arabicKey: "قيمة",
    arabicVocalized: "قِيمَةٌ",
    turkishCognate: "kıymet",
    meaningTr: "Değer, kıymet",
  },
  {
    arabicKey: "بركة",
    arabicVocalized: "بَرَكَةٌ",
    turkishCognate: "bereket",
    meaningTr: "Bereket, bolluk",
  },
  {
    arabicKey: "نعمة",
    arabicVocalized: "نِعْمَةٌ",
    turkishCognate: "nimet",
    meaningTr: "Nimet, iyilik, lütuf",
  },
  {
    arabicKey: "أمانة",
    arabicVocalized: "أَمَانَةٌ",
    turkishCognate: "emanet",
    meaningTr: "Emanet, güvenilirlik",
  },
  {
    arabicKey: "خدمة",
    arabicVocalized: "خِدْمَةٌ",
    turkishCognate: "hizmet",
    meaningTr: "Hizmet, servis",
  },
  {
    arabicKey: "دقة",
    arabicVocalized: "دِقَّةٌ",
    turkishCognate: "dikkat",
    meaningTr: "Titizlik, hassasiyet, dakiklik",
    nuanceNoteTr:
      "Arapçada دِقَّةٌ 'incelik/hassasiyet/dakiklik' demektir; 'dikkat et!' uyarısı için genellikle اِنْتَبِهْ! veya حَذَارِ! kullanılır.",
  },
  {
    arabicKey: "محبة",
    arabicVocalized: "مَحَبَّةٌ",
    turkishCognate: "muhabbet",
    meaningTr: "Sevgi, dostluk",
    nuanceNoteTr:
      "Türkçede 'sohbet etmek' anlamında da kullanılan 'muhabbet', Arapçada doğrudan 'sevgi' demektir.",
  },
  {
    arabicKey: "هدية",
    arabicVocalized: "هَدِيَّةٌ",
    turkishCognate: "hediye",
    meaningTr: "Hediye, armağan",
  },
  {
    arabicKey: "مجبور",
    arabicVocalized: "مَجْبُورٌ",
    turkishCognate: "mecbur",
    meaningTr: "Zorunda kalan, mecbur",
  },
  {
    arabicKey: "ممكن",
    arabicVocalized: "مُمْكِنٌ",
    turkishCognate: "mümkün",
    meaningTr: "Mümkün, olabilir",
  },
  {
    arabicKey: "مشهور",
    arabicVocalized: "مَشْهُورٌ",
    turkishCognate: "meşhur",
    meaningTr: "Ünlü, tanınmış, meşhur",
  },
  {
    arabicKey: "حاجة",
    arabicVocalized: "حَاجَةٌ",
    turkishCognate: "hacet / ihtiyaç",
    meaningTr: "İhtiyaç, gereksinim",
  },
  {
    arabicKey: "قرار",
    arabicVocalized: "قَرَارٌ",
    turkishCognate: "karar",
    meaningTr: "Karar",
  },
  {
    arabicKey: "جواب",
    arabicVocalized: "جَوَابٌ",
    turkishCognate: "cevap",
    meaningTr: "Cevap, yanıt",
  },
  {
    arabicKey: "سؤال",
    arabicVocalized: "سُؤَالٌ",
    turkishCognate: "sual",
    meaningTr: "Soru, sual",
  },
  {
    arabicKey: "امتحان",
    arabicVocalized: "اِمْتِحَانٌ",
    turkishCognate: "imtihan",
    meaningTr: "Sınav, imtihan",
  },
  {
    arabicKey: "تاريخ",
    arabicVocalized: "تَارِيخٌ",
    turkishCognate: "tarih",
    meaningTr: "Tarih (hem takvim günü hem tarih bilimi)",
  },
  {
    arabicKey: "رسالة",
    arabicVocalized: "رِسَالَةٌ",
    turkishCognate: "risale",
    meaningTr: "Mektup, kısa mesaj (SMS), tez",
    nuanceNoteTr:
      "Klasik Türkçede küçük kitapçık demek olan 'risale', modern Arapçada günlük 'mektup, e-posta veya telefon mesajı' anlamında çok yaygındır.",
  },
  {
    arabicKey: "شعر",
    arabicVocalized: "شِعْرٌ",
    turkishCognate: "şiir",
    meaningTr: "Şiir (شَعْرٌ fethalı okunursa 'saç' anlamına gelir!)",
  },
  {
    arabicKey: "صورة",
    arabicVocalized: "صُورَةٌ",
    turkishCognate: "suret",
    meaningTr: "Fotoğraf, resim, görünüm",
  },
  {
    arabicKey: "طبيعة",
    arabicVocalized: "طَبِيعَةٌ",
    turkishCognate: "tabiat",
    meaningTr: "Doğa, tabiat, mizaç",
  },
  {
    arabicKey: "عائلة",
    arabicVocalized: "عَائِلَةٌ",
    turkishCognate: "aile",
    meaningTr: "Aile",
  },
  {
    arabicKey: "قانون",
    arabicVocalized: "قَانُونٌ",
    turkishCognate: "kanun",
    meaningTr: "Yasa, kanun",
  },
  {
    arabicKey: "قصة",
    arabicVocalized: "قِصَّةٌ",
    turkishCognate: "kıssa",
    meaningTr: "Hikâye, öykü, kıssa",
  },
  {
    arabicKey: "كلمة",
    arabicVocalized: "كَلِمَةٌ",
    turkishCognate: "kelime",
    meaningTr: "Kelime, söz, konuşma",
  },
  {
    arabicKey: "مثال",
    arabicVocalized: "مِثَالٌ",
    turkishCognate: "misal",
    meaningTr: "Örnek, misal",
  },
  {
    arabicKey: "مركز",
    arabicVocalized: "مَرْكَزٌ",
    turkishCognate: "merkez",
    meaningTr: "Merkez",
  },
  {
    arabicKey: "مشكلة",
    arabicVocalized: "مُشْكِلَةٌ",
    turkishCognate: "müşkül",
    meaningTr: "Sorun, problem",
  },
  {
    arabicKey: "موضوع",
    arabicVocalized: "مَوْضُوعٌ",
    turkishCognate: "mevzu",
    meaningTr: "Konu, mevzu",
  },
  {
    arabicKey: "نتيجة",
    arabicVocalized: "نَتِيجَةٌ",
    turkishCognate: "netice",
    meaningTr: "Sonuç, netice",
  },
  {
    arabicKey: "نظام",
    arabicVocalized: "نِظَامٌ",
    turkishCognate: "nizam",
    meaningTr: "Düzen, sistem, yönetmelik",
  },
  {
    arabicKey: "عجلة",
    arabicVocalized: "عَجَلَةٌ",
    turkishCognate: "acele",
    meaningTr: "Tekerlek; acele/telaş",
    isFalseFriend: true,
    nuanceNoteTr:
      "Arapçada عَجَلَةٌ hem 'acele/çabukluk' hem de günlük dilde çok yaygın olarak 'tekerlek' anlamına gelir!",
  },
  {
    arabicKey: "تذكرة",
    arabicVocalized: "تَذْكِرَةٌ",
    turkishCognate: "tezkere",
    meaningTr: "Bilet (uçak, otobüs, sinema bileti)",
    isFalseFriend: true,
    nuanceNoteTr:
      "Türkçede askerlik belgesi veya biyografi eseri olan 'tezkere', modern Arapçada doğrudan 'yolculuk/giriş bileti' demektir.",
  },
  {
    arabicKey: "سوق",
    arabicVocalized: "سُوقٌ",
    turkishCognate: "sokak (kökteş)",
    meaningTr: "Çarşı, pazar, piyasa (زُقَاقٌ -> sokak)",
  },
  {
    arabicKey: "فندق",
    arabicVocalized: "فُنْدُقٌ",
    turkishCognate: "fındık (ses benzeri!)",
    meaningTr: "Otel, konaklama hanı",
    isFalseFriend: true,
    nuanceNoteTr:
      "Ses benzerliğine dikkat! Arapçada فُنْدُقٌ 'otel' demektir (kuruyemiş olan fındık ise بُنْدُقٌ olarak b ile yazılır).",
  },
];

function stripArabicToSkeleton(raw?: string): string {
  if (!raw) return "";
  return raw
    .normalize("NFC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/^ال/, "")
    .trim();
}

export function normalizeRootLookupKey(rawRoot?: string): string {
  if (!rawRoot) return "";
  const cleaned = rawRoot
    .normalize("NFC")
    .replace(/[\s\-./\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱء]/g, "أ")
    .replace(/ى/g, "ي")
    .trim();
  if (!cleaned || cleaned === "-") return "";
  return cleaned;
}

const NORMALIZED_ROOT_BRIDGE_MAP: Map<string, ClassicalRootBridgeEntry> = (() => {
  const m = new Map<string, ClassicalRootBridgeEntry>();
  for (const [k, entry] of Object.entries(CLASSICAL_ROOT_BRIDGE)) {
    m.set(normalizeRootLookupKey(k), entry);
    m.set(k.normalize("NFC"), entry);
  }
  return m;
})();

const COGNATE_BY_SKELETON_MAP: Map<string, TurkishArabicCognateEntry> = (() => {
  const m = new Map<string, TurkishArabicCognateEntry>();
  for (const item of TURKISH_ARABIC_COGNATES) {
    const sk = stripArabicToSkeleton(item.arabicKey);
    if (sk) m.set(sk, item);
  }
  return m;
})();

export function getClassicalBridgeForRoot(
  rawRoot?: string | null
): ClassicalRootBridgeEntry | null {
  if (!rawRoot) return null;
  const key = normalizeRootLookupKey(rawRoot);
  if (!key) return null;
  return NORMALIZED_ROOT_BRIDGE_MAP.get(key) || null;
}

export function getCognateInfoForArabicWord(
  rawArabic?: string | null
): TurkishArabicCognateEntry | null {
  if (!rawArabic) return null;
  const parts = rawArabic.split("/");
  for (const part of parts) {
    const sk = stripArabicToSkeleton(part);
    if (!sk) continue;
    const direct = COGNATE_BY_SKELETON_MAP.get(sk);
    if (direct) return direct;
  }
  return null;
}

export function getCognateInfoForDictionaryItem(
  word?: DictionaryItem | null
): TurkishArabicCognateEntry | null {
  if (!word) return null;
  const candidates = [word.mufret, word.mazi, word.masdar, word.cemi];
  for (const c of candidates) {
    const hit = getCognateInfoForArabicWord(c);
    if (hit) return hit;
  }
  return null;
}
