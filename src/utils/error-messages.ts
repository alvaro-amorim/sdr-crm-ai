export type ErrorMessageScope = 'auth' | 'workspace' | 'lead' | 'campaign' | 'ai' | 'simulator' | 'automation' | 'general';

const fallbackByScope: Record<ErrorMessageScope, string> = {
  auth: 'Falha na autenticação. Tente novamente.',
  workspace: 'Não foi possível concluir a ação do workspace. Tente novamente.',
  lead: 'Não foi possível salvar ou atualizar o lead. Tente novamente.',
  campaign: 'Não foi possível concluir a ação da campanha. Tente novamente.',
  ai: 'Não foi possível concluir a geração com IA. Tente novamente.',
  simulator: 'Não foi possível concluir a simulação. Tente novamente.',
  automation: 'A ação principal foi concluída, mas a automação complementar falhou.',
  general: 'Falha inesperada. Tente novamente.',
};

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  return '';
}

function isAlreadyFriendlyPortuguese(message: string): boolean {
  if (!message) return false;

  const normalized = message.toLowerCase();
  return (
    /[áàãâéêíóôõúç]/i.test(message) ||
    normalized.startsWith('falha ') ||
    normalized.startsWith('não ') ||
    normalized.startsWith('nao ') ||
    normalized.startsWith('selecione ') ||
    normalized.startsWith('nome ') ||
    normalized.startsWith('lead ') ||
    normalized.startsWith('campanha ') ||
    normalized.startsWith('sessão ') ||
    normalized.startsWith('sessao ') ||
    normalized.startsWith('muitas tentativas') ||
    normalized.startsWith('e-mail ')
  );
}

export function getErrorMessage(error: unknown, scope: ErrorMessageScope = 'general'): string {
  const rawMessage = getRawMessage(error);
  const normalized = rawMessage.toLowerCase();

  if (!rawMessage) return fallbackByScope[scope];

  if (normalized.includes('email rate limit') || normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
  }

  if (scope === 'auth') {
    if (normalized.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
    if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    if (normalized.includes('user already registered') || normalized.includes('already registered')) {
      return 'Este e-mail já está cadastrado. Entre com sua senha ou use a recuperação de senha.';
    }
    if (normalized.includes('signup') && normalized.includes('disabled')) return 'Cadastro por e-mail está indisponível neste momento.';
    if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('at least'))) {
      return 'Use uma senha mais forte, com pelo menos 6 caracteres.';
    }
    if (normalized.includes('invalid email') || normalized.includes('unable to validate email')) return 'Informe um e-mail válido.';
    if (normalized.includes('oauth') || normalized.includes('provider') || normalized.includes('exchange')) {
      return 'Não foi possível concluir o login com Google. Tente novamente.';
    }
  }

  if (normalized.includes('jwt') || normalized.includes('session') || normalized.includes('not authenticated')) {
    return 'Sessão expirada. Entre novamente.';
  }

  if (
    normalized.includes('permission denied') ||
    normalized.includes('row-level security') ||
    normalized.includes('violates row-level security') ||
    normalized.includes('not authorized') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'Você não tem permissão para concluir esta ação.';
  }

  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('fetch failed')) {
    return 'Falha de conexão. Verifique a internet e tente novamente.';
  }

  if (normalized.includes('edge function returned a non-2xx status code')) {
    return scope === 'simulator'
      ? 'A simulação não conseguiu gerar a resposta da IA nesta tentativa. Tente novamente.'
      : 'Serviço de IA indisponível nesta tentativa. Tente novamente.';
  }

  if (normalized.includes('openai') || normalized.includes('model') || normalized.includes('api key')) {
    return 'A IA não conseguiu concluir a geração nesta tentativa. Tente novamente.';
  }

  if (normalized.includes('timeout') || normalized.includes('aborted')) {
    return 'A operação demorou mais que o esperado. Tente novamente.';
  }

  if (normalized.includes('duplicate key') || normalized.includes('already exists')) {
    return 'Já existe um registro com essas informações.';
  }

  if (normalized.includes('invalid input syntax') || normalized.includes('violates check constraint')) {
    return 'Revise os campos informados e tente novamente.';
  }

  if (normalized.includes('link de simulacao invalido') || normalized.includes('simulation') || normalized.includes('token')) {
    return 'Link de simulação inválido ou expirado.';
  }

  if (normalized.includes('falha http') || /\bhttp\s?\d{3}\b/i.test(rawMessage)) {
    if (scope === 'ai' || scope === 'campaign' || scope === 'automation') return 'Serviço de IA indisponível nesta tentativa. Tente novamente.';
    if (scope === 'simulator') return 'A simulação não conseguiu responder nesta tentativa. Tente novamente.';
    return fallbackByScope[scope];
  }

  if (isAlreadyFriendlyPortuguese(rawMessage)) return rawMessage;

  return fallbackByScope[scope];
}

export function getAuthErrorMessage(error: unknown): string {
  return getErrorMessage(error, 'auth');
}
