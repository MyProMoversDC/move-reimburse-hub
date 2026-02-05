

# HTML Template Consent Document System

## Overview

This plan implements an HTML template-based consent document system where:
1. **Admin uploads an HTML document** with `{{SIGNATURE}}` and `{{DATE}}` placeholders
2. **Mover views the document** with the signature pad positioned exactly where the placeholder is
3. **Upon signing**, the system replaces placeholders with actual signature image and date
4. **Final signed HTML is stored** in the database
5. **Admin can view and download** the complete signed document as a PDF

---

## How Placeholder Detection Works

When a mover opens the consent popup:

1. **Fetch the HTML template** from the uploaded file URL
2. **Parse the HTML** and scan for placeholder markers:
   - `{{SIGNATURE}}` - Where the signature image will appear
   - `{{DATE}}` - Where the signing date will appear
   - `{{MOVER_NAME}}` - (optional) Where the mover's name will appear
3. **Replace `{{SIGNATURE}}` with a clickable signature area** that triggers the signature pad
4. **Mover signs**, and the signature image replaces the placeholder
5. **Store the final HTML** with embedded signature (as data URL) in the database

---

## Implementation Steps

### 1. Update HTML Upload & Validation

Modify the upload process to:
- Accept `.html` files
- Validate that uploaded HTML contains required placeholders
- Show a warning if placeholders are missing

### 2. Enhance ConsentDocumentPopup Component

Transform the popup to:
- Render HTML with interactive placeholder zones
- Position the signature pad inline where `{{SIGNATURE}}` appears
- Auto-fill `{{DATE}}` and `{{MOVER_NAME}}` upon submission

**Flow:**
```text
┌──────────────────────────────────────────────────┐
│  Terms & Conditions                              │
├──────────────────────────────────────────────────┤
│                                                  │
│  [Rendered HTML Document Content]                │
│                                                  │
│  ...document text...                             │
│                                                  │
│  Signature: ┌──────────────────────────────┐     │
│             │  [Click to Sign]             │     │
│             │  or [Signature Image Here]   │     │
│             └──────────────────────────────┘     │
│                                                  │
│  Date: February 5, 2026                          │
│                                                  │
└──────────────────────────────────────────────────┤
│             [Submit Signature]                   │
└──────────────────────────────────────────────────┘
```

### 3. Store Complete Signed HTML

Update the `signed_consent_documents` table to include:
- `signed_html_content` - The complete HTML with embedded signature

### 4. Admin: View & Download as PDF

Update `SignedConsentDocuments` component to:
- Render the stored signed HTML directly (with embedded signature)
- Use `html2pdf.js` library to convert HTML to downloadable PDF
- Single download button produces a complete signed PDF

---

## Technical Details

### HTML Template Format

Admin creates an HTML file like this:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .signature-box { border-bottom: 2px solid #000; min-height: 80px; }
  </style>
</head>
<body>
  <h1>Employment Agreement</h1>
  
  <p>I, {{MOVER_NAME}}, agree to the terms and conditions...</p>
  
  <p>...contract text...</p>
  
  <div class="signature-section">
    <p>Employee Signature:</p>
    <div class="signature-box">{{SIGNATURE}}</div>
    <p>Date: {{DATE}}</p>
  </div>
</body>
</html>
```

### Placeholder Replacement Logic

```typescript
// When mover signs:
const finalHtml = templateHtml
  .replace('{{SIGNATURE}}', `<img src="${signatureDataUrl}" style="max-height:80px"/>`)
  .replace('{{DATE}}', new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }))
  .replace('{{MOVER_NAME}}', moverFullName);
```

### PDF Generation (Admin Cabinet)

Using `html2pdf.js`:

```typescript
import html2pdf from 'html2pdf.js';

const downloadAsPdf = (htmlContent: string, fileName: string) => {
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  
  html2pdf()
    .set({
      margin: 10,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(container)
    .save();
};
```

---

## Database Changes

Add a new column to `signed_consent_documents`:

```sql
ALTER TABLE signed_consent_documents 
ADD COLUMN signed_html_content TEXT;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/dashboard/ConsentDocumentPopup.tsx` | Modify | Add inline signature rendering at placeholder location |
| `src/components/dashboard/SignedConsentDocuments.tsx` | Modify | Add PDF download using html2pdf.js |
| `src/components/dashboard/ConsentDocumentManager.tsx` | Modify | Add placeholder validation on upload |
| Database migration | Create | Add `signed_html_content` column |
| `package.json` | Modify | Add `html2pdf.js` dependency |

---

## User Experience

### For Movers:
1. Login → Consent popup appears
2. Document displays with signature area clearly marked
3. Tap/click signature area to open signature pad
4. Draw signature → appears in document
5. Click "Submit Signature" → Done

### For Admins:
1. Upload HTML template with placeholders
2. View signed documents library
3. Preview shows complete document with signature embedded
4. "Download PDF" produces a single PDF file with signature in correct position

---

## Benefits of This Approach

| Feature | Benefit |
|---------|---------|
| Inline signature | Signature appears exactly where it belongs in the document |
| HTML templates | Easy for admin to create/edit documents |
| PDF export | Professional output for records |
| Single file download | No more separate document + signature files |
| Mobile friendly | Works on all devices |

