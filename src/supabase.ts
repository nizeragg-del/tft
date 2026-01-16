import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Multiplayer features will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Database Types (will be auto-generated later)
export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    username: string;
                    email: string;
                    elo: number;
                    wins: number;
                    losses: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    username: string;
                    email: string;
                    elo?: number;
                    wins?: number;
                    losses?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    username?: string;
                    email?: string;
                    elo?: number;
                    wins?: number;
                    losses?: number;
                    created_at?: string;
                };
            };
            matches: {
                Row: {
                    id: string;
                    player1_id: string;
                    player2_id: string | null;
                    winner_id: string | null;
                    status: 'waiting' | 'in_progress' | 'completed';
                    created_at: string;
                    ended_at: string | null;
                };
                Insert: {
                    id?: string;
                    player1_id: string;
                    player2_id?: string | null;
                    winner_id?: string | null;
                    status?: 'waiting' | 'in_progress' | 'completed';
                    created_at?: string;
                    ended_at?: string | null;
                };
                Update: {
                    id?: string;
                    player1_id?: string;
                    player2_id?: string | null;
                    winner_id?: string | null;
                    status?: 'waiting' | 'in_progress' | 'completed';
                    created_at?: string;
                    ended_at?: string | null;
                };
            };
        };
    };
}
