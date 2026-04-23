import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL deve ser uma URL válida.'),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, 'VITE_SUPABASE_ANON_KEY está ausente ou curta demais.'),
  VITE_ENABLE_EVALUATION_PANEL: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export type ClientEnv = z.infer<typeof envSchema>;

export function readClientEnv(source: Record<string, unknown> = import.meta.env): {
  env: ClientEnv | null;
  error: string | null;
} {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    return {
      env: null,
      error: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' '),
    };
  }

  return { env: parsed.data, error: null };
}
