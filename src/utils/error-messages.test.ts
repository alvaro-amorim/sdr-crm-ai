import { describe, expect, it } from 'vitest';
import { getAuthErrorMessage, getErrorMessage } from './error-messages';

describe('error message mapping', () => {
  it('traduz erros comuns de autenticacao', () => {
    expect(getAuthErrorMessage(new Error('Invalid login credentials'))).toBe('E-mail ou senha inválidos.');
    expect(getAuthErrorMessage(new Error('Email rate limit exceeded'))).toBe(
      'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.',
    );
    expect(getAuthErrorMessage(new Error('User already registered'))).toBe(
      'Este e-mail já está cadastrado. Entre com sua senha ou use a recuperação de senha.',
    );
  });

  it('oculta erros tecnicos de edge function e banco', () => {
    expect(getErrorMessage(new Error('Edge Function returned a non-2xx status code'), 'ai')).toBe(
      'Serviço de IA indisponível nesta tentativa. Tente novamente.',
    );
    expect(getErrorMessage(new Error('duplicate key value violates unique constraint'), 'lead')).toBe(
      'Já existe um registro com essas informações.',
    );
  });

  it('preserva mensagens amigaveis ja escritas em portugues', () => {
    expect(getErrorMessage(new Error('Nome e etapa são obrigatórios.'), 'lead')).toBe('Nome e etapa são obrigatórios.');
  });
});
