-- Migration to create the youtube_channels table with RLS policies
-- Execute this script in the Supabase SQL Editor

-- 1. Create the youtube_channels table
CREATE TABLE IF NOT EXISTS public.youtube_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_youtube_id text NOT NULL UNIQUE,
    title text NOT NULL,
    avatar_url text,
    encrypted_refresh_token text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies
-- Policy: Users can only see their own channels
CREATE POLICY "Users can select own youtube channels" 
    ON public.youtube_channels 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can only insert their own channels
CREATE POLICY "Users can insert own youtube channels" 
    ON public.youtube_channels 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own channels
CREATE POLICY "Users can update own youtube channels" 
    ON public.youtube_channels 
    FOR UPDATE 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own channels
CREATE POLICY "Users can delete own youtube channels" 
    ON public.youtube_channels 
    FOR DELETE 
    USING (auth.uid() = user_id);
