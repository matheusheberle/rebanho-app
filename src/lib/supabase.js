import { createClient } from '@supabase/supabase-js';

// As duas variáveis vêm do arquivo .env (veja .env.example).
// Nunca coloque a "service role key" aqui — só a "anon public key".
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export const supabaseConfigurado = Boolean(supabase);
