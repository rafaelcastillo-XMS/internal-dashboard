-- Make Initial Analysis evidence private. Files are opened through short-lived signed URLs
-- (createSignedUrl), which require a logged-in session via the existing
-- "Authenticated users can view audit evidence" policy. Apply AFTER the frontend that
-- uses signed URLs is deployed, or old clients will show broken links.
update storage.buckets set public = false where id = 'audit-evidence';
