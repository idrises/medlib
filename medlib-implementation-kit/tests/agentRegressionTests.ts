import assert from "node:assert/strict";
import { expandMedicalQuery } from "../src/lib/medicalQueryExpand.js";
import { detectJournalIssueIntent } from "../src/lib/journalIssueIntent.js";
import { classifyVoiceTranscript } from "../src/lib/voiceInputGate.js";
import { enforceVerbDiscipline } from "../src/lib/verbDiscipline.js";

function testQueryExpansion() {
  const q = expandMedicalQuery("derin plan yüz germe");
  assert(q.allVariants.includes("deep plane facelift"));
  assert(q.allVariants.some((x) => x.includes("rhytidectomy")));
}

function testJournalIssueIntent() {
  const i = detectJournalIssueIntent("Clinics in Plastic Surgery Volume 40 Issue 4 makalelerini listele");
  assert.equal(i.isJournalIssueIntent, true);
  assert.equal(i.volume, "40");
  assert.equal(i.issue, "4");
}

function testVoiceNoise() {
  assert.equal(classifyVoiceTranscript("Thank you for watching. Bye.").action, "no_response");
  assert.equal(classifyVoiceTranscript("Ortam sesini dinleme").action, "listen_only");
  assert.equal(classifyVoiceTranscript("Burun estetiğiyle ilgili kütüphaneye bak").action, "respond");
}

function testVerbDiscipline() {
  const r = enforceVerbDiscipline("PDF içeriğine ulaştım ve okudum.", false);
  assert.equal(r.flagged, true);
  assert.match(r.text, /doğrulayan başarılı bir araç çıktısı olmadığı/i);
}

testQueryExpansion();
testJournalIssueIntent();
testVoiceNoise();
testVerbDiscipline();
console.log("All MedLib agent regression tests passed.");
