# Quarterly Report GBP Image — Security and Code Quality Review

## Executive summary

The new Quarterly Report configuration flow was reviewed for TypeScript/React security, local file handling, PDF generation, code quality, regression risk, and dependency exposure. All findings introduced by this feature were corrected. The selected GBP image remains browser-local, is validated and normalized before PDF generation, and is not uploaded as a standalone asset. Production and development dependencies report zero known vulnerabilities after compatible upgrades.

## Scope

- `src/pages/seo/SEOClientReports.tsx`
- `src/features/seo/components/QuarterlyReportConfigModal.tsx`
- `src/features/seo/lib/quarterlyReportConfig.ts`
- `src/features/seo/lib/exportClientQuarterlyReport.ts`
- Supporting date and narrative helpers and their unit tests
- Existing PDF upload path, reviewed only where the new image passes through it

## Corrected findings

### QR-SEC-001 — File content was trusted from its declared MIME type

- Severity: Medium
- Location: `src/features/seo/lib/quarterlyReportConfig.ts:21-51`
- Evidence: The initial implementation accepted a file when `file.type` matched PNG, JPEG, or WEBP.
- Impact: A renamed or spoofed file could reach the preview/PDF parser, producing errors or excessive parser work.
- Fix: The code now allowlists MIME types and validates PNG, JPEG, and WEBP binary signatures before decoding.
- Mitigation: The image is decoded by the browser and re-encoded through canvas, so the original byte stream is not passed directly into jsPDF.
- Status: Fixed and unit tested.

### QR-SEC-002 — Image processing had no resource limit

- Severity: Medium
- Location: `src/features/seo/lib/quarterlyReportConfig.ts:22-85`
- Evidence: The initial flow accepted raster files of any size and embedded the original image.
- Impact: Very large images could consume excessive browser memory or create unnecessarily large PDFs.
- Fix: Files are limited to 10 MB, decoded, resized to a maximum side of 2,000 pixels, and normalized to PNG or JPEG.
- Mitigation: The Generate action remains disabled while image preparation is in progress.
- Status: Fixed and unit tested.

### QR-SEC-003 — New-tab download did not explicitly isolate the opener

- Severity: Low
- Location: `src/pages/seo/SEOClientReports.tsx:162-165`
- Evidence: The report download used `window.open(url, '_blank')`.
- Impact: A newly opened page could retain an opener relationship in browsers that do not apply implicit isolation.
- Fix: The call now uses `noopener,noreferrer`.
- Status: Fixed.

### QR-REL-004 — Failed metadata insertion could leave an orphan PDF

- Severity: Low
- Location: `src/pages/seo/SEOClientReports.tsx:137-153`
- Evidence: The PDF upload completed before the report metadata insert, with no compensation if the insert failed.
- Impact: A failed generation could leave an unlisted PDF in the existing report bucket.
- Fix: If metadata insertion fails, the just-uploaded PDF is removed before the error is shown.
- Status: Fixed.

### QR-DATE-005 — Calendar dates shifted by one day in America/Bogota

- Severity: Low
- Location: `src/features/seo/hooks/useSEODashboardState.ts:19-23`
- Evidence: Date-only strings were parsed as UTC and formatted in the browser's local time zone.
- Impact: A range such as July 29–October 27 could display as July 28–October 26.
- Fix: Date-only values are formatted explicitly in UTC without changing the underlying 90-day calculation.
- Status: Fixed and unit tested.

## Code-quality results

- The modal was extracted from the page into a focused component.
- Period calculation, image validation/preparation, and client-facing narrative are isolated in reusable helpers.
- Concurrent image selections are guarded so a slower previous selection cannot overwrite the latest one.
- Report title input is capped at 120 characters.
- The PDF preserves image aspect ratio and retains the original GBP placeholder when no image is selected.
- Client-facing copy remains factual but uses constructive terms such as “opportunity to strengthen” instead of alarming labels.

## Existing infrastructure note

The historical `seo_client_reports` migration contains broad anonymous table policies and declares the existing `seo-reports` bucket public. This predates the new local-image feature and was not changed because the requested image experiment explicitly excludes Supabase schema, bucket, and persistence changes. A separate access-control task should make the bucket private, replace public URLs with signed URLs, and scope table/storage policies to authorized internal users.

## Verification

- Full Vitest suite
- Production TypeScript/Vite build
- ESLint
- `git diff --check`
- Full `npm audit`
- Real jsPDF generation test with and without the optional GBP image
