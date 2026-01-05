-- Allow NULL values for optional crew members (3-8)
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_3 DROP NOT NULL;
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_4 DROP NOT NULL;
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_5 DROP NOT NULL;
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_6 DROP NOT NULL;
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_7 DROP NOT NULL;
ALTER TABLE public.review_bonuses ALTER COLUMN crew_member_8 DROP NOT NULL;