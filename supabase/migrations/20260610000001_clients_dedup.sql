-- Cleanup after the clients seed: merge duplicate rows the name-matching missed.

-- Atlantic Roofing: "& Exteriors LLC" (SEO seed) vs "and Exteriors" (SEM account row)
UPDATE public.clients SET sem_account_id = '4338698549' WHERE id = 'atlantic-roofing-exteriors';
DELETE FROM public.clients WHERE id = 'atlantic-roofing-and-exteriors';

-- Holt's: keep the original holts-garage id, linked to the main Ads account
-- (not the LSA account the fuzzy match picked first).
DELETE FROM public.clients WHERE id = 'holt-s-reliable-garage-door-repair';
UPDATE public.clients SET sem_account_id = '5028132994' WHERE id = 'holts-garage';
