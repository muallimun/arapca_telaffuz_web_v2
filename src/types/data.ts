export type Level = "A1" | "A2" | "B1" | "B2";
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type VoiceGender = "erkek" | "kadin";

export interface PedagogicalMeta {
  cefr?: CEFRLevel;
  zorluk?: 1 | 2 | 3 | 4 | 5;
  etiketler?: string[];
  kaynak_unite?: string;
}

export interface DialogueSpeaker {
  ad_ar: string;
  ad_tr: string;
  cinsiyet: "E" | "K";
}

export interface DialogueLine {
  sira: number;
  konusmaci: string;
  konusmaci_ar: string;
  cinsiyet: "E" | "K";
  odak_kalip?: string;
  arapca: string;
  turkce: string;
  ses_dosyasi?: string;
  audio?: string;
}

export interface Dialogue extends PedagogicalMeta {
  id: string;
  sira?: number;
  seviye: Level;
  tema?: string;
  odak_gramer?: string;
  baslik_ar: string;
  baslik_tr: string;
  konusmacilar?: DialogueSpeaker[];
  satirlar: DialogueLine[];
}

export interface GramerOrnek {
  arapca: string;
  turkce: string;
  aciklama?: string;
}

export interface GramerHapBilgi {
  bagli_id: string;
  konu_basligi: string;
  hap_kural: string;
  metinden_ornek: {
    arapca: string;
    turkce: string;
    aciklama: string;
  };
  ek_ornekler: {
    arapca: string;
    turkce: string;
  }[];
  ipucu: string;
}

export interface ReadingTextLine {
  sira: number;
  arapca: string;
  turkce: string;
  ses_dosyasi: string;
}

export interface ReadingTextQuestion {
  soru_ar: string;
  soru_tr: string;
  cevap_ar: string;
  cevap_tr: string;
}

export interface ReadingText extends PedagogicalMeta {
  id: string;
  sira?: number;
  seviye: Level;
  tema: string;
  odak_gramer?: string;
  baslik_ar: string;
  baslik_tr: string;
  satirlar: ReadingTextLine[];
  sorular: ReadingTextQuestion[];
}

export interface DictionaryItem extends PedagogicalMeta {
  id: string;
  tur: string; // "isim", "fiil", "sifat", "edat", "ozel-isim" vb.
  kok: string;
  anlam_tr: string;
  mufret?: string;
  cemi?: string;
  mazi?: string;
  muzari?: string;
  masdar?: string;
  gorsel?: string;
  ornek_ar?: string;
  soru_kalibi?: string;
  kategori_tr?: string;
  ses_erkek?: string;
  ses_kadin?: string;
}

export interface ResimliKelime extends PedagogicalMeta {
  id: string;
  gridId?: string;
  grupNo?: number;
  cellIndex?: number;
  cefr: Level;
  kategori: string;
  kategori_tr: string;
  tur: string;
  kok: string;
  arapca: string;
  ikincil_form: string;
  ucuncul_form: string;
  turkce: string;
  soru_kalibi: string;
  gorsel_tipi?: string;
  gorsel_betimleme_en?: string;
  gorsel: string;
  ornek_ar: string;
  ornek_tr?: string;
  ses_erkek: string;
  ses_kadin: string;
}

export interface AnahtarCumle extends PedagogicalMeta {
  id: string;
  sira: number;
  seviye: Level;
  tema: string;
  odak_kalip: string;
  arapca: string;
  turkce: string;
  ses_erkek: string;
  ses_kadin: string;
  kategori?: string;
  baglam?: string;
  not_tr?: string;
}

export interface AtasozuDeyim extends PedagogicalMeta {
  id: string;
  sira: number;
  cefr: Level;
  tur: string;
  tema: string;
  arapca: string;
  turkce: string;
  lafzi_ceviri: string;
  kullanim_baglami: string;
  ses_erkek: string;
  ses_kadin: string;
  gorsel?: string;
  gercek_anlam?: string;
  mecaz_anlam?: string;
}

export interface GramerKonu extends PedagogicalMeta {
  id: string;
  baslik_tr: string;
  baslik_ar?: string;
  kategori: "sarf" | "nahiv" | "belagat";
  ozet_tr: string;
  kurallar: string[];
  ornekler: { arapca: string; turkce: string; irab_notu?: string }[];
}