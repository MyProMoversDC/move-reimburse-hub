## Problem

The 3 failed documents all error with:
`Chunk insert failed: invalid input syntax for type json`

All three are PDFs. The PDF text extractor (`unpdf`) returns strings that contain NUL bytes (`\u0000`) and other control characters from the PDF stream. Postgres' `jsonb`/`text` columns reject `\u0000`, so the insert of `content` + `embedding` (stored as `JSON.stringify(...)`) blows up.

This is why the refresh button doesn't help — re-running ingestion hits the same sanitization gap every time.

## Fix

Edit `supabase/functions/ingest-office-ai-document/index.ts`:

1. After extracting text from a PDF/DOCX/TXT, **sanitize**:
   - Strip `\u0000`
   - Strip other C0 control chars except `\n`, `\r`, `\t`
   - Collapse lone surrogate halves that break JSON encoding
2. Apply the same sanitizer to each chunk before insert (defense in depth).
3. Re-deploy the function.

After deploy, the admin can hit the per-row refresh button on the 3 failed docs and they'll re-ingest cleanly. No DB migration needed.

## Technical detail

```ts
const sanitize = (s: string) =>
  s
    .replace(/\u0000/g, "")
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "")
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1");
```

Applied to `text` returned from `extractFromBuffer` and to each `content` value before building the insert row.
