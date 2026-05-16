export interface RecallDisciplineResult {
  text: string;
  flagged: boolean;
}

const RECALL_TRIGGERS = [
  /geçen\s+sefer/iu,
  /daha\s+önce/iu,
  /önceki\s+(?:sohbet|konuşma|mesaj)/iu,
  /hatırlıyor\s+musun/iu,
  /ne\s+demiştik/iu,
  /kaldığımız\s+yer/iu,
  /bunu\s+konuşmuştuk/iu,
  /son\s+mesajlara\s+baksana/iu,
];

export function isRecallQuestion(userText: string): boolean {
  const q = String(userText || "");
  return RECALL_TRIGGERS.some((r) => r.test(q));
}

export function enforceRecallDiscipline(responseText: string, userText: string, recallToolCalledThisTurn: boolean): RecallDisciplineResult {
  if (!isRecallQuestion(userText) || recallToolCalledThisTurn) {
    return { text: responseText, flagged: false };
  }
  return {
    flagged: true,
    text:
      "Bu önceki konuşmaya ait bir hatırlama sorusu. Bu turda geçmiş kayıt aracı çalışmadığı için tahmin etmek istemem. Net kayıtla kontrol edip sonra yanıtlamalıyım.",
  };
}
