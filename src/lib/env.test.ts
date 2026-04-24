import { describe, expect, it } from 'vitest';
import { readClientEnv } from './env';

describe('client env validation', () => {
  it('retorna erro seguro quando env critica esta ausente', () => {
    const result = readClientEnv({});

    expect(result.env).toBeNull();
    expect(result.error).toContain('VITE_SUPABASE_URL');
    expect(result.error).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('aceita env publica valida', () => {
    const result = readClientEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-with-safe-placeholder',
    });

    expect(result.error).toBeNull();
    expect(result.env?.VITE_SUPABASE_URL).toBe('https://example.supabase.co');
  });

  it('mantem o painel auxiliar desabilitado por padrao', () => {
    const result = readClientEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-with-safe-placeholder',
    });

    expect(result.env?.VITE_ENABLE_EVALUATION_PANEL).toBe(false);
  });

  it('aceita habilitacao explicita do painel auxiliar', () => {
    const result = readClientEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-with-safe-placeholder',
      VITE_ENABLE_EVALUATION_PANEL: 'true',
    });

    expect(result.env?.VITE_ENABLE_EVALUATION_PANEL).toBe(true);
  });
});
