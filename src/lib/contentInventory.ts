export interface ContentInventory {
  dialoguesCount: number;
  readingsCount: number;
  sentencesCount: number;
  proverbsCount: number;
  visualWordsCount: number;
  grammarNotesCount: number;
  standaloneGrammarNotesCount: number;
  /** Ana sözlük havuzu kayıt sayısı: 1.895 */
  coreDictionaryWordsCount: number;
  /** Birleşik Sözlük (1.895 ana sözlük + 998 görsel kelime + ek sözlük) toplam kayıt sayısı: 3.225 */
  dictionaryWordsCount: number;
  youtubeVideosCount: number;
  youtubeSingleVideosCount: number;
  youtubePlaylistsCount: number;
  synonymsAntonymsCount: number;
  assessmentQuestionsCount: number;
  exerciseModulesCount: number;
}

export const CONTENT_INVENTORY: ContentInventory = {
  dialoguesCount: 120,
  readingsCount: 60,
  sentencesCount: 1111,
  proverbsCount: 508,
  visualWordsCount: 998,
  grammarNotesCount: 195,
  standaloneGrammarNotesCount: 15,
  coreDictionaryWordsCount: 1895,
  dictionaryWordsCount: 3225,
  youtubeVideosCount: 60,
  youtubeSingleVideosCount: 20,
  youtubePlaylistsCount: 40,
  synonymsAntonymsCount: 400,
  assessmentQuestionsCount: 550,
  exerciseModulesCount: 18,
};
