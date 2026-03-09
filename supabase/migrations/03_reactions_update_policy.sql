-- Migration: allow users to update their own reactions (needed for switching reaction type)
CREATE POLICY "User can update own reaction"
  ON public.reactions FOR UPDATE
  USING (auth.uid() = user_id);
