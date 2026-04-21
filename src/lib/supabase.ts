import { createClient } from '@supabase/supabase-js';
import { readClientEnv } from './env';

const { env, error } = readClientEnv();

export const envError = error;

export const supabase = env
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
