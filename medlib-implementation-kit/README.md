# MedLib Agent Guardrails — Uygulama Kod Paketi

Bu paket, MedLib AI için konuştuğumuz kritik iyileştirmelerin uygulanabilir TypeScript/SQL kodlarını içerir.

## İçerik

- `src/lib/toolResultWrapper.ts` — tüm tool sonuçları için `_meta/source_scope` standardı.
- `src/lib/medicalQueryExpand.ts` — Türkçe tıbbi sorguyu İngilizce varyantlara, exact phrase, AND term, synonym setlerine genişletme.
- `src/lib/journalIssueIntent.ts` — `Journal + Volume + Issue` intent yakalama ve `search_library` yerine doğru routing zorlaması.
- `src/lib/responsePostProcess.ts` — cevap sonundaki gereksiz “istersen…” menülerini kesme.
- `src/lib/verbDiscipline.ts` — tool success olmadan “buldum/açtım/okudum/hazırladım” dedirtmeme.
- `src/lib/recallTriggerDetect.ts` — geçmişe referans veren sorularda recall kullanılmadıysa güvenli düzeltme.
- `src/lib/voiceInputGate.ts` — STT/ortam sesi/medya altyazısı no-response filtresi.
- `src/lib/voiceResponseShape.ts` — sesli mod cevap uzunluğu ve noise helper.
- `src/lib/slideRenderer.ts` — slayt spec’ini PNG/JPEG’e render eder.
- `src/lib/presentationBuilder.ts` — PPTX’i her slaytı aynı render edilmiş PNG olarak gömerek üretir; önizleme ile indirilen PPTX birebir aynı görünür.
- `mobile-snippets/realtimeNoResponseGate.ts` — Realtime API’de `create_response=false` kullanımı ve client-side transcript gate.
- `migrations/2026_05_agent_guardrails.sql` — hafıza metadata alanları, presentation preview alanları, file state alanları.
- `tests/agentRegressionTests.ts` — regresyon test senaryoları.

## Kurulum

Gerekli paketler:

```bash
pnpm add pptxgenjs sharp zod
pnpm add -D tsx
```

`openai.ts` içinde zaten şu importlar varsa bu dosyaları `src/lib/` altına koyman yeterli olur:

```ts
import { buildPresentation } from "../lib/presentationBuilder.js";
import { stripTrailingMenu } from "../lib/responsePostProcess.js";
import { enforceVerbDiscipline } from "../lib/verbDiscipline.js";
import { enforceRecallDiscipline } from "../lib/recallTriggerDetect.js";
import { isVoiceNoiseInput, capVoiceResponseLength } from "../lib/voiceResponseShape.js";
import { expandMedicalQuery } from "../lib/medicalQueryExpand.js";
import { wrapToolResult, wrapToolError } from "../lib/toolResultWrapper.js";
```

## En önemli Realtime değişikliği

Backend session config’te şunu değiştir:

```ts
turn_detection: {
  type: "server_vad",
  threshold: 0.85,
  prefix_padding_ms: 250,
  silence_duration_ms: 1200,
  create_response: false,
  interrupt_response: true,
}
```

Sonra client data channel tarafında `mobile-snippets/realtimeNoResponseGate.ts` içindeki mantıkla sadece gerçekten kullanıcı komutu olduğunda `response.create` gönder.

## Sunum pipeline mantığı

Bu paket PPTX uyumsuzluğunu şöyle çözer:

1. Önce tek bir `Outline` JSON oluşur.
2. Her slayt aynı `slideRenderer` ile PNG’ye çevrilir.
3. PPTX içine bu PNG tam slayt olarak gömülür.
4. Sohbette gösterilen slayt önizlemeleri yine aynı renderer’dan gelir.

Böylece “ekrandaki slayt başka, indirilen PPTX başka” problemi biter.
