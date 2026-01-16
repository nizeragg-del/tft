-- ========================================
-- CARDTACTICS: NEXUS - DATABASE SCHEMA
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    elo INTEGER DEFAULT 1000,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_elo ON public.users(elo DESC);

-- ========================================
-- MATCHES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON public.matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON public.matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);

-- ========================================
-- MATCH STATES TABLE (Optional - for replays)
-- ========================================
CREATE TABLE IF NOT EXISTS public.match_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,
    player1_board JSONB,
    player2_board JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_states_match_id ON public.match_states(match_id);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_states ENABLE ROW LEVEL SECURITY;

-- Users: Can read all, but only update their own
CREATE POLICY "Users can view all profiles"
    ON public.users FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Matches: Players can only access their own matches
CREATE POLICY "Players can view their matches"
    ON public.matches FOR SELECT
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);

CREATE POLICY "Players can create matches"
    ON public.matches FOR INSERT
    WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update their matches"
    ON public.matches FOR UPDATE
    USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Match States: Only players in the match can access
CREATE POLICY "Players can view match states"
    ON public.match_states FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = match_states.match_id
            AND (matches.player1_id = auth.uid() OR matches.player2_id = auth.uid())
        )
    );

CREATE POLICY "Players can insert match states"
    ON public.match_states FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.matches
            WHERE matches.id = match_states.match_id
            AND (matches.player1_id = auth.uid() OR matches.player2_id = auth.uid())
        )
    );

-- ========================================
-- FUNCTIONS & TRIGGERS
-- ========================================

-- Function to update ELO after match
CREATE OR REPLACE FUNCTION update_player_elo()
RETURNS TRIGGER AS $$
DECLARE
    winner_elo INTEGER;
    loser_elo INTEGER;
    winner_new_elo INTEGER;
    loser_new_elo INTEGER;
    k_factor INTEGER := 32;
    expected_winner FLOAT;
    expected_loser FLOAT;
BEGIN
    -- Only run when match is completed
    IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL THEN
        -- Get current ELOs
        SELECT elo INTO winner_elo FROM public.users WHERE id = NEW.winner_id;
        SELECT elo INTO loser_elo FROM public.users WHERE id = (
            CASE 
                WHEN NEW.player1_id = NEW.winner_id THEN NEW.player2_id
                ELSE NEW.player1_id
            END
        );

        -- Calculate expected scores
        expected_winner := 1.0 / (1.0 + POWER(10, (loser_elo - winner_elo) / 400.0));
        expected_loser := 1.0 / (1.0 + POWER(10, (winner_elo - loser_elo) / 400.0));

        -- Calculate new ELOs
        winner_new_elo := winner_elo + ROUND(k_factor * (1 - expected_winner));
        loser_new_elo := loser_elo + ROUND(k_factor * (0 - expected_loser));

        -- Update winner
        UPDATE public.users
        SET elo = winner_new_elo, wins = wins + 1
        WHERE id = NEW.winner_id;

        -- Update loser
        UPDATE public.users
        SET elo = loser_new_elo, losses = losses + 1
        WHERE id = (
            CASE 
                WHEN NEW.player1_id = NEW.winner_id THEN NEW.player2_id
                ELSE NEW.player1_id
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update ELO
CREATE TRIGGER on_match_completed
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
    EXECUTE FUNCTION update_player_elo();

-- ========================================
-- REALTIME PUBLICATION
-- ========================================

-- Enable realtime for matches table
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
