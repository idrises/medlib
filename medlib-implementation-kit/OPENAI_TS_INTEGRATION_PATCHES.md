# `openai.ts` entegrasyon patch notları

Gönderdiğin `medlib-backend-changes.tar.gz` içinde bu patchlerin bir kısmı zaten uygulanmış görünüyor. Aşağıdaki parçalar eksikse aynı mantıkla ekle.

## 1) Importlar

```ts
import { buildPresentation } from "../lib/presentationBuilder.js";
import { stripTrailingMenu } from "../lib/responsePostProcess.js";
import { enforceVerbDiscipline } from "../lib/verbDiscipline.js";
import { enforceRecallDiscipline } from "../lib/recallTriggerDetect.js";
import { isVoiceNoiseInput, capVoiceResponseLength } from "../lib/voiceResponseShape.js";
import { expandMedicalQuery } from "../lib/medicalQueryExpand.js";
import { wrapToolResult, wrapToolError, type ToolResultMeta } from "../lib/toolResultWrapper.js";
import { detectJournalIssueIntent } from "../lib/journalIssueIntent.js";
```

## 2) `search_library` içinde journal issue guard

```ts
const issueIntent = detectJournalIssueIntent(q);
if (issueIntent.isJournalIssueIntent) {
  return r(wrapToolError("search_library", "Yanlış araç. Dergi adı + Vol/Issue sorgusunda search_library kullanma.", {
    wrong_tool: "search_library",
    correct_chain: ["list_journals", "get_journal({id})", "get_issue({id})"],
    detected: issueIntent,
  }));
}
```

## 3) `search_library` içinde query expansion

```ts
const expansion = expandMedicalQuery(q);
const searchTerms = expansion.allVariants.length > 0 ? expansion.allVariants : [q];
const partialResults = await Promise.all(
  searchTerms.map((term) => runUnifiedSearch(term, queryFn, { type: "all" })),
);
const hitMap = new Map<string, Hit>();
for (const partial of partialResults) {
  for (const h of partial) {
    const key = `${h.type}:${h.id}`;
    if (!hitMap.has(key)) hitMap.set(key, h);
  }
}
const hits = Array.from(hitMap.values());
```

Tool sonucuna mutlaka ekle:

```ts
expanded_queries: expansion.allVariants,
source_scope: "catalog_metadata",
result_type: "library_search",
```

## 4) Realtime session config

Şunu değiştir:

```ts
create_response: true,
```

şuna:

```ts
create_response: false,
```

Sonra mobile tarafta `mobile-snippets/realtimeNoResponseGate.ts` mantığıyla sadece gerçek kullanıcı komutunda:

```ts
dc.send(JSON.stringify({ type: "response.create" }));
```

## 5) Chat/voice final response post-process

Model cevabı tamamlandıktan sonra:

```ts
let cleaned = stripTrailingMenu(fullResponse);
if (isVoice) cleaned = capVoiceResponseLength(cleaned);
const v = enforceVerbDiscipline(cleaned, toolSuccessThisTurn);
const r = enforceRecallDiscipline(v.text, userText, recallCalledThisTurn);
cleaned = r.text;
```

Kaydedilen assistant mesajı olarak `cleaned` kullan.

## 6) Tool success flag

Tool call tamamlandığında sadece `_meta.source_scope !== "error"` ise success say:

```ts
const parsed = JSON.parse(toolOutput);
if (parsed?._meta?.source_scope !== "error" && !parsed?.error) {
  toolSuccessThisTurn = true;
}
```

## 7) `show_presentation_slides`

`create_presentation` sonucu `ready` olduktan sonra kullanıcı “slaytları resim olarak göster” derse `show_presentation_slides({presentation_id})` çağrılmalı. Bu tool `slideRenderer` ile aynı slayt spec’inden PNG üretir.
