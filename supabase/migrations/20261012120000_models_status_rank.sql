-- ============================================================
-- models.status_rank (BattleBench)
--
-- Lets the Models column sort by painting progress. `status` is text, and its
-- alphabetical order (Assembled, None, Painted, Partially Painted, Primed) is
-- meaningless — this generated column gives the real one:
--   Unpainted (None) 0 → Assembled 1 → Primed 2 → Partially Painted 3 → Painted 4
-- Anything unexpected sorts first (0), alongside unpainted.
--
-- Purely additive: a stored generated column the deployed build never reads.
-- ============================================================

ALTER TABLE public.models
    ADD COLUMN IF NOT EXISTS status_rank smallint GENERATED ALWAYS AS (
        CASE status
            WHEN 'Assembled'         THEN 1
            WHEN 'Primed'            THEN 2
            WHEN 'Partially Painted' THEN 3
            WHEN 'Painted'           THEN 4
            ELSE 0
        END
    ) STORED;
