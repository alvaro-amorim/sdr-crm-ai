import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  Bot,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MailCheck,
  Menu,
  Megaphone,
  Phone,
  Plus,
  RefreshCcw,
  Route,
  ShieldAlert,
  X,
  Users,
  Workflow,
} from 'lucide-react';
import { DashboardScreen } from './components/dashboard-screen';
import { ClientSimulatorScreen } from './components/client-simulator-screen';
import { MessagesScreen } from './components/messages-screen';
import { envError, supabase } from './lib/supabase';
import {
  createWorkspaceWithDefaults,
  getFirstWorkspace,
  invokeAuthenticatedFunction as invokeEdgeFunction,
  loadCrmData,
  moveLead,
  runStageTriggerAutomation,
  saveRequiredFields,
  upsertCampaign,
  upsertLead,
  type CampaignInput,
  type LeadInput,
  type StageTriggerAutomationResult,
} from './services/crm';
import type {
  Campaign,
  CrmData,
  Lead,
  PipelineStage,
} from './types/domain';
import { getLeadMetaLine } from './utils/crm-ui';
import { getAuthErrorMessage, getErrorMessage, type ErrorMessageScope } from './utils/error-messages';
import { createFieldKey, findMissingRequiredFields, STANDARD_LEAD_FIELDS } from './utils/pipeline';
import { buildStageAutomationErrorWarning, buildStageAutomationFeedback } from './utils/stage-automation-feedback';

type Tab = 'dashboard' | 'leads' | 'fields' | 'campaigns' | 'messages';

const emptyLeadInput: LeadInput = {
  name: '',
  email: '',
  phone: '',
  company: '',
  job_title: '',
  lead_source: '',
  notes: '',
  technical_owner_name: '',
  assigned_user_id: null,
  current_stage_id: '',
  customValues: {},
};

const emptyCampaignInput: CampaignInput = {
  name: '',
  context_text: '',
  generation_prompt: '',
  trigger_stage_id: null,
  ai_response_mode: 'always',
  ai_response_window_start: '09:00',
  ai_response_window_end: '18:00',
  is_active: true,
};

type CampaignStrategyPlan = {
  objective_summary: string;
  icp_summary: string;
  pain_summary: string;
  tone_guidelines: string;
  cta_strategy: string;
  objection_handling: string;
  sequence_strategy: string;
  final_prompt: string;
};

const emptyCampaignStrategyPlan: CampaignStrategyPlan = {
  objective_summary: '',
  icp_summary: '',
  pain_summary: '',
  tone_guidelines: '',
  cta_strategy: '',
  objection_handling: '',
  sequence_strategy: '',
  final_prompt: '',
};

function derivePlanFromCampaign(campaign: Campaign | null): CampaignStrategyPlan {
  if (!campaign) return emptyCampaignStrategyPlan;

  return {
    objective_summary: `Campanha ${campaign.name} pronta para geração contextual.`,
    icp_summary: campaign.trigger_stage_id ? 'Campanha conectada a uma etapa específica do funil.' : 'Campanha sem gatilho automático definido.',
    pain_summary: campaign.context_text,
    tone_guidelines: 'Tom consultivo, objetivo e alinhado ao contexto comercial salvo.',
    cta_strategy: 'CTA compatível com o contexto e o estágio de maturidade do lead.',
    objection_handling: 'Responder objeções sem insistência excessiva e sem inventar informações.',
    sequence_strategy: 'Usar abertura, retomada amigável e avanço de qualificação conforme a resposta do lead.',
    final_prompt: campaign.generation_prompt,
  };
}

function getSafeMessage(error: unknown, scope: ErrorMessageScope = 'general'): string {
  return getErrorMessage(error, scope);
}

function getWorkspaceMemberDisplayName(member: CrmData['workspaceMembers'][number], user?: User): string {
  const profileName = member.profile_full_name?.trim();
  if (profileName) return profileName;

  const metadataName = typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '';
  if (user && member.user_id === user.id) {
    return metadataName || user.email || 'Você';
  }

  return member.role === 'owner' ? 'Owner do workspace' : 'Membro do workspace';
}

function getAssignedWorkspaceOwnerLabel(lead: Lead, data: CrmData, user?: User): string | null {
  if (!lead.assigned_user_id) return null;
  const member = data.workspaceMembers.find((item) => item.user_id === lead.assigned_user_id);
  if (!member) return 'Usuário do workspace';
  return getWorkspaceMemberDisplayName(member, user);
}

/*
async function invokeAuthenticatedFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase || !supabaseEnv) {
    throw new Error('Supabase não configurado.');
  }

  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) {
    throw new Error('Sessão expirada. Entre novamente.');
  }

  const response = await fetch(`${supabaseEnv.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseEnv.VITE_SUPABASE_ANON_KEY,
      'content-type': 'application/json',
      'x-sdr-auth-token': token,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? payload?.message ?? `Falha HTTP ${response.status}.`);
  }

  return payload as T;
}
*/

function getAuthRedirectTo(): string {
  return window.location.origin;
}

function readAuthCallbackError(): string | null {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    search.get('error_description') ??
    search.get('error') ??
    hash.get('error_description') ??
    hash.get('error')
  );
}

function clearAuthCallbackUrl() {
  const hasAuthParams =
    window.location.search.includes('code=') ||
    window.location.search.includes('error=') ||
    window.location.hash.includes('access_token=') ||
    window.location.hash.includes('error=');

  if (hasAuthParams) {
    window.history.replaceState({}, document.title, window.location.pathname || '/');
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<CrmData | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const supabaseClient = supabase;
    let cancelled = false;

    async function initializeSession() {
      const callbackError = readAuthCallbackError();
      if (callbackError) {
        setError(getAuthErrorMessage(new Error(callbackError)));
        clearAuthCallbackUrl();
      }

      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { data: exchangedData, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
        clearAuthCallbackUrl();
        if (exchangeError) {
          setError(getAuthErrorMessage(exchangeError));
        } else if (!cancelled) {
          setSession(exchangedData.session);
        }
      }

      const { data: authData } = await supabaseClient.auth.getSession();
      if (!cancelled) {
        setSession(authData.session);
        setLoading(false);
      }
    }

    void initializeSession().catch((sessionError: unknown) => {
      if (!cancelled) {
        setError(getAuthErrorMessage(sessionError));
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      setSession(newSession);
      setData(null);
      setNotice(null);
      if (event === 'SIGNED_IN') {
        setError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const reloadData = useCallback(async () => {
    if (!supabase || !session?.user) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = await getFirstWorkspace(supabase);
      if (!workspace) {
        setData(null);
        return;
      }
      setData(await loadCrmData(supabase, workspace));
    } catch (loadError) {
      setError(getSafeMessage(loadError, 'workspace'));
    } finally {
      setBusy(false);
    }
  }, [session?.user]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  async function handleCreateWorkspace(name: string) {
    if (!supabase || !session?.user) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = await createWorkspaceWithDefaults(supabase, session.user, name);
      setData(await loadCrmData(supabase, workspace));
      setNotice('Workspace criado com funil padrão.');
    } catch (workspaceError) {
      setError(getSafeMessage(workspaceError, 'workspace'));
    } finally {
      setBusy(false);
    }
  }

  if (window.location.pathname === '/client-simulator') {
    return <ClientSimulatorScreen />;
  }

  if (envError || !supabase) {
    return <SetupError message={envError ?? 'Supabase não configurado.'} />;
  }

  if (loading) {
    return <FullPageState title="Carregando sessão" />;
  }

  if (!session) {
    return <AuthScreen authError={error} />;
  }

  if (passwordRecovery) {
    return <PasswordRecoveryScreen onDone={() => setPasswordRecovery(false)} />;
  }

  if (!data) {
    return (
      <Shell user={session.user} workspaceName={null} tab={tab} onTabChange={setTab} onRefresh={reloadData} busy={busy}>
        <WorkspaceOnboarding user={session.user} busy={busy} onCreate={handleCreateWorkspace} error={error} />
      </Shell>
    );
  }

  return (
    <Shell
      user={session.user}
      workspaceName={data.workspace.name}
      tab={tab}
      onTabChange={setTab}
      onRefresh={reloadData}
      busy={busy}
    >
      <StatusBar notice={notice} error={error} onClear={() => {
        setNotice(null);
        setError(null);
      }} />
      <OperationGuide tab={tab} />

      {tab === 'dashboard' && <Dashboard data={data} />}
      {tab === 'leads' && (
        <LeadsView
          data={data}
          user={session.user}
          onReload={reloadData}
          setError={setError}
          setNotice={setNotice}
        />
      )}
      {tab === 'fields' && (
        <FieldsView data={data} onReload={reloadData} setError={setError} setNotice={setNotice} />
      )}
      {tab === 'campaigns' && (
        <CampaignsView
          data={data}
          user={session.user}
          onReload={reloadData}
          setError={setError}
          setNotice={setNotice}
        />
      )}
      {tab === 'messages' && (
        <MessagesView
          data={data}
          user={session.user}
          onReload={reloadData}
          setError={setError}
          setNotice={setNotice}
        />
      )}
    </Shell>
  );
}

function SetupError({ message }: { message: string }) {
  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <ShieldAlert aria-hidden />
        <h1>Ambiente não configurado</h1>
        <p>{message}</p>
        <p>Crie um arquivo .env.local com as variáveis de .env.example e reinicie o servidor.</p>
      </section>
    </main>
  );
}

function FullPageState({ title }: { title: string }) {
  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <RefreshCcw className="spin" aria-hidden />
        <h1>{title}</h1>
      </section>
    </main>
  );
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  hint,
  minLength = 6,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
  placeholder?: string;
  hint?: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <label htmlFor={id}>
      {label}
      <div className="password-field">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minLength={minLength}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          <ToggleIcon aria-hidden />
          <span>{visible ? 'Ocultar' : 'Mostrar'}</span>
        </button>
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function AuthScreen({ authError }: { authError?: string | null }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busyAction, setBusyAction] = useState<'form' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const busy = busyAction !== null;

  useEffect(() => {
    setError(authError ?? null);
  }, [authError]);

  useEffect(() => {
    setError(authError ?? null);
    setSuccess(null);
    if (mode !== 'signup') {
      setConfirmPassword('');
    }
  }, [authError, mode]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas precisam ser iguais para criar a conta.');
      return;
    }

    setBusyAction('form');
    setError(null);
    setSuccess(null);
    try {
      if (mode === 'forgot') {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectTo(),
        });
        if (result.error) throw result.error;
        setSuccess('Se o e-mail existir, enviaremos um link seguro para redefinir a senha.');
      } else if (mode === 'signup') {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() || email },
            emailRedirectTo: getAuthRedirectTo(),
          },
        });
        if (result.error) throw result.error;
        setSuccess(
          result.data.session
            ? 'Cadastro criado. Você já está autenticado.'
            : 'Cadastro criado. Verifique seu e-mail para confirmar a conta antes de entrar.',
        );
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusyAction(null);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusyAction('google');
    setError(null);
    setSuccess(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAuthRedirectTo(),
        },
      });
      if (oauthError) throw oauthError;
    } catch (googleError) {
      setError(getAuthErrorMessage(googleError));
      setBusyAction(null);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <span className="eyebrow">SDR Expert</span>
        <h1>Mini CRM para SDR com mensagens geradas por IA.</h1>
        <p>Gerencie leads, funil, campanhas e simule abordagens personalizadas com isolamento por workspace.</p>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <div>
          <h2>{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Recuperar senha'}</h2>
          <p>
            {mode === 'login'
              ? 'Acesse seu workspace.'
              : mode === 'signup'
                ? 'Crie uma conta para iniciar o CRM.'
                : 'Informe seu e-mail para receber o link de redefinição.'}
          </p>
        </div>
        {mode === 'signup' && (
          <label htmlFor="fullName">
            Nome
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Ex.: Responsável comercial"
            />
            <span className="field-hint">Use o nome que deve aparecer no perfil. Ex.: Responsável comercial.</span>
          </label>
        )}
        <label htmlFor="email">
          E-mail
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Ex.: contato@empresa.com.br"
            required
          />
          <span className="field-hint">Informe um e-mail válido. Ex.: contato@empresa.com.br.</span>
        </label>
        {mode !== 'forgot' && (
          <PasswordField
            id="password"
            name="password"
            label="Senha"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Ex.: AcessoSeguro2026!"
            hint="Crie uma senha forte. Ex.: AcessoSeguro2026!."
          />
        )}
        {mode === 'signup' && (
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar senha"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Ex.: AcessoSeguro2026!"
            hint="Repita exatamente a senha criada acima. Ex.: AcessoSeguro2026!."
          />
        )}
        {error && <p className="error">{error}</p>}
        {success && <p className="success-text">{success}</p>}
        <button type="submit" disabled={busy}>
          {busyAction === 'form' ? 'Processando...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Cadastrar' : 'Enviar link'}
        </button>
        {mode !== 'forgot' && (
          <button type="button" className="google-button" onClick={signInWithGoogle} disabled={busy}>
            {busyAction === 'google' ? 'Abrindo Google...' : 'Entrar com Google'}
          </button>
        )}
        <div className="auth-links">
          <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} disabled={busy}>
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </button>
          {mode !== 'signup' && (
            <button type="button" className="ghost" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')} disabled={busy}>
              {mode === 'forgot' ? 'Voltar ao login' : 'Esqueci a senha'}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

function PasswordRecoveryScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess('Senha atualizada com sucesso.');
      window.setTimeout(onDone, 900);
    } catch (updateError) {
      setError(getAuthErrorMessage(updateError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="setup-screen">
      <form className="setup-panel" onSubmit={submit}>
        <KeyRound aria-hidden />
        <h1>Definir nova senha</h1>
        <p>Crie uma nova senha para continuar acessando o SDR Expert.</p>
        <PasswordField
          id="newPassword"
          name="newPassword"
          label="Nova senha"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ex.: NovaSenhaSegura2026!"
          hint="Escolha uma senha nova e forte. Ex.: NovaSenhaSegura2026!."
        />
        <PasswordField
          id="confirmNewPassword"
          name="confirmNewPassword"
          label="Confirmar senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Ex.: NovaSenhaSegura2026!"
          hint="Repita a mesma senha digitada acima. Ex.: NovaSenhaSegura2026!."
        />
        {error && <p className="error">{error}</p>}
        {success && <p className="success-text">{success}</p>}
        <button type="submit" disabled={busy}>
          <MailCheck aria-hidden />
          {busy ? 'Salvando...' : 'Atualizar senha'}
        </button>
      </form>
    </main>
  );
}

function Shell({
  children,
  user,
  workspaceName,
  tab,
  onTabChange,
  onRefresh,
  busy,
}: {
  children: React.ReactNode;
  user: User;
  workspaceName: string | null;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const nav = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads' as const, label: 'Leads', icon: Users },
    { id: 'fields' as const, label: 'Campos', icon: CheckCircle2 },
    { id: 'campaigns' as const, label: 'Campanhas', icon: Megaphone },
    { id: 'messages' as const, label: 'Mensagens IA', icon: Bot },
  ];

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 900) {
        setMobileNavOpen(false);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleTabSelect(nextTab: Tab) {
    onTabChange(nextTab);
    setMobileNavOpen(false);
  }

  function handleRefreshClick() {
    onRefresh();
    setMobileNavOpen(false);
  }

  async function handleSignOut() {
    setMobileNavOpen(false);
    await supabase?.auth.signOut();
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`sidebar-overlay ${mobileNavOpen ? 'sidebar-overlay-open' : ''}`}
        aria-hidden={!mobileNavOpen}
        tabIndex={mobileNavOpen ? 0 : -1}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`} id="app-sidebar-nav">
        <div className="sidebar-top">
          <div className="sidebar-topline">
            <div className="brand">
              <Bot aria-hidden />
              <div>
                <strong>SDR Expert</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              className="sidebar-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Fechar menu"
            >
              <X aria-hidden />
            </button>
          </div>
          <div className="workspace-badge">
            <small>Workspace ativo</small>
            <strong>{workspaceName ?? 'Configuração inicial'}</strong>
          </div>
          <div className="sidebar-actions">
            <button type="button" className="ghost" onClick={handleRefreshClick} disabled={busy}>
              <RefreshCcw className={busy ? 'spin' : undefined} aria-hidden />
              {busy ? 'Atualizando...' : 'Atualizar'}
            </button>
            <button type="button" className="ghost" onClick={() => void handleSignOut()}>
              <LogOut aria-hidden />
              Sair
            </button>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => handleTabSelect(item.id)}>
                <Icon aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="content">
        <div className="mobile-shell-bar">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar-nav"
          >
            <Menu aria-hidden />
            Menu
          </button>
          <div className="mobile-shell-copy">
            <strong>SDR Expert</strong>
            <span>{workspaceName ?? 'Configuração inicial'}</span>
          </div>
        </div>
        <div className="content-shell">{children}</div>
      </main>
    </div>
  );
}

function WorkspaceOnboarding({
  user,
  busy,
  onCreate,
  error,
}: {
  user: User;
  busy: boolean;
  onCreate: (name: string) => void;
  error: string | null;
}) {
  const [name, setName] = useState(`Workspace ${user.email?.split('@')[0] ?? 'SDR'}`);

  return (
    <section className="panel narrow">
      <h1>Criar workspace</h1>
      <p>O workspace isola funil, leads, campos, campanhas e mensagens.</p>
      <label>
        Nome do workspace
        <input
          name="workspaceName"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Operação SDR Brasil"
        />
        <span className="field-hint">Dê um nome operacional ao ambiente. Ex.: Operação SDR Brasil.</span>
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" onClick={() => onCreate(name)} disabled={busy || name.trim().length < 2}>
        <Plus aria-hidden />
        {busy ? 'Criando workspace...' : 'Criar workspace e funil padrão'}
      </button>
    </section>
  );
}

function StatusBar({ notice, error, onClear }: { notice: string | null; error: string | null; onClear: () => void }) {
  if (!notice && !error) return null;
  const isError = Boolean(error);
  return (
    <div className={isError ? 'status error-box' : 'status success-box'}>
      <div className="status-copy">
        {isError ? <ShieldAlert aria-hidden /> : <CheckCircle2 aria-hidden />}
        <div>
          <strong className="status-title">{isError ? 'Atenção na operação' : 'Ação concluída'}</strong>
          <span>{error ?? notice}</span>
        </div>
      </div>
      <button type="button" className="ghost compact" onClick={onClear}>
        Fechar
      </button>
    </div>
  );
}

function OperationGuide({ tab }: { tab: Tab }) {
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const steps: Array<{ id: Tab; title: string; description: string }> = [
    {
      id: 'dashboard',
      title: 'Ler a operação',
      description: 'Veja volume, gargalos, respostas e próximos movimentos antes de operar.',
    },
    {
      id: 'leads',
      title: 'Qualificar leads',
      description: 'Cadastre contexto, selecione o lead em foco e mova pelo funil com validação.',
    },
    {
      id: 'fields',
      title: 'Controlar qualidade',
      description: 'Defina campos obrigatórios por etapa para impedir avanço com dados frágeis.',
    },
    {
      id: 'campaigns',
      title: 'Preparar playbooks',
      description: 'Crie campanhas com contexto e prompt para orientar a IA por objetivo comercial.',
    },
    {
      id: 'messages',
      title: 'Simular abordagem',
      description: 'Gere mensagens, registre envio e abra o simulador do cliente para testar respostas.',
    },
  ];
  const activeStep = steps.find((step) => step.id === tab) ?? steps[0];

  return (
    <>
      <section className={`operation-guide ${collapsed ? 'operation-guide-collapsed' : ''}`}>
        <div className="operation-guide-main">
          <span className="operation-guide-icon" aria-hidden>
            <Route />
          </span>
          <div>
            <span className="section-kicker">Guia rápido do fluxo</span>
            <strong>{activeStep.title}</strong>
            {!collapsed && <p>{activeStep.description}</p>}
          </div>
        </div>
        {!collapsed && (
          <div className="operation-guide-steps" aria-label="Fluxo recomendado do CRM">
            {steps.map((step, index) => (
              <span key={step.id} className={step.id === tab ? 'operation-step operation-step-active' : 'operation-step'}>
                {index + 1}. {step.title}
              </span>
            ))}
          </div>
        )}
        <div className="operation-guide-actions">
          <button type="button" className="ghost compact" onClick={() => setModalOpen(true)}>
            <BookOpen aria-hidden />
            Ver lógica
          </button>
          <button
            type="button"
            className="ghost compact icon-only"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expandir guia do fluxo' : 'Minimizar guia do fluxo'}
          >
            {collapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          </button>
        </div>
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="flow-guide-title">
          <section className="chat-modal flow-guide-modal">
            <div className="chat-modal-header">
              <div>
                <span className="section-kicker">Lógica operacional</span>
                <h2 id="flow-guide-title">Como o SDR Expert deve ser avaliado</h2>
                <p>O app simula uma operação de pré-vendas com dados isolados por workspace, funil, playbooks e IA.</p>
              </div>
              <button type="button" className="ghost compact icon-only" onClick={() => setModalOpen(false)} aria-label="Fechar guia">
                <X aria-hidden />
              </button>
            </div>
            <div className="flow-guide-grid">
              {steps.map((step, index) => (
                <article key={step.id} className={step.id === tab ? 'flow-guide-card flow-guide-card-active' : 'flow-guide-card'}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="flow-guide-note">
              <strong>Fluxo principal:</strong>
              <span>
                dashboard identifica prioridade, leads guardam contexto, campos protegem a qualidade, campanhas definem a estratégia e
                mensagens IA demonstram a abordagem com simulador de cliente.
              </span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Dashboard({ data }: { data: CrmData }) {
  return <DashboardScreen data={data} />;
}

function LeadsView({
  data,
  user,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  user: User;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState(data.leads[0]?.id ?? '');
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const stageById = useMemo(() => new Map(data.stages.map((stage) => [stage.id, stage])), [data.stages]);
  const selectedLead = data.leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedLeadStage = selectedLead ? stageById.get(selectedLead.current_stage_id) ?? null : null;
  const selectedLeadWorkspaceOwner = selectedLead ? getAssignedWorkspaceOwnerLabel(selectedLead, data, user) : null;
  const selectedLeadMissing = selectedLead && selectedLeadStage
    ? findMissingRequiredFields({
        lead: selectedLead,
        targetStage: selectedLeadStage,
        requiredFields: data.requiredFields,
        customFields: data.customFields,
        customValues: data.customValues,
      })
    : [];
  const leadsWithContact = data.leads.filter((lead) => Boolean(lead.email || lead.phone)).length;
  const leadsWithPendingFields = data.leads.filter((lead) => {
    const currentStage = stageById.get(lead.current_stage_id);
    if (!currentStage) return false;
    return (
      findMissingRequiredFields({
        lead,
        targetStage: currentStage,
        requiredFields: data.requiredFields,
        customFields: data.customFields,
        customValues: data.customValues,
      }).length > 0
    );
  }).length;
  const leadsInContact = data.leads.filter((lead) => stageById.get(lead.current_stage_id)?.name === 'Tentando Contato').length;

  useEffect(() => {
    if (!data.leads.length) {
      setSelectedLeadId('');
      setEditingLead(null);
      return;
    }

    if (selectedLeadId && data.leads.some((lead) => lead.id === selectedLeadId)) {
      return;
    }

    setSelectedLeadId(data.leads[0]?.id ?? '');
  }, [data.leads, selectedLeadId]);

  async function handleMove(lead: Lead, targetStage: PipelineStage) {
    if (!supabase) return;
    if (movingLeadId === lead.id) return;
    const missing = findMissingRequiredFields({
      lead,
      targetStage,
      requiredFields: data.requiredFields,
      customFields: data.customFields,
      customValues: data.customValues,
    });

    if (missing.length > 0) {
      setError(`Movimento bloqueado. Campos obrigatórios ausentes: ${missing.join(', ')}.`);
      return;
    }

    setError(null);
    setMovingLeadId(lead.id);

    try {
      await moveLead(supabase, data.workspace.id, lead.id, targetStage.id);
      const successMessage = `Lead movido para ${targetStage.name}`;
      let automation: StageTriggerAutomationResult = {
        generatedCampaignNames: [],
        skippedCampaignNames: [],
        failedCampaigns: [],
      };
      let feedback = {
        notice: `${successMessage}.`,
        warning: null as string | null,
      };

      try {
        automation = await runStageTriggerAutomation(supabase, {
          workspaceId: data.workspace.id,
          leadId: lead.id,
          stageId: targetStage.id,
        });

        feedback = buildStageAutomationFeedback({
          successMessage,
          failurePrefix: 'Lead movido, mas o gatilho automatico falhou em',
          automation,
        });
      } catch (automationError) {
        feedback = {
          notice: `${successMessage}.`,
          warning: buildStageAutomationErrorWarning(
            'Lead movido, mas o gatilho automatico nao pode ser concluido',
            automationError,
          ),
        };
      }

      setNotice(feedback.notice);

      if (feedback.warning && automation.failedCampaigns.length > 0) {
        setError(
          `Lead movido, mas o gatilho automático falhou em: ${automation.failedCampaigns.map((item) => item.name).join(', ')}.`,
        );
      }

      if (feedback.warning && automation.failedCampaigns.length === 0) {
        setError(feedback.warning);
      }

      await onReload();
    } catch (moveError) {
      setError(getSafeMessage(moveError, 'lead'));
    } finally {
      setMovingLeadId(null);
    }
  }

  return (
    <section className="stack">
      <Header title="Leads e funil" subtitle="Cadastro, edição e movimentação por etapa." />

      <div className="leads-summary-grid">
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Leads no funil</span>
            <Users aria-hidden />
          </div>
          <strong>{data.leads.length}</strong>
          <p>Volume total de oportunidades acompanhadas neste workspace.</p>
        </article>
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Com contato válido</span>
            <Mail aria-hidden />
          </div>
          <strong>{leadsWithContact}</strong>
          <p>Leads com e-mail ou telefone já prontos para abordagem.</p>
        </article>
        <article className="overview-card overview-card-accent">
          <div className="overview-card-topline">
            <span className="section-kicker">Precisam de revisão</span>
            <CircleAlert aria-hidden />
          </div>
          <strong>{leadsWithPendingFields}</strong>
          <p>Leads com campos obrigatórios faltando na etapa atual.</p>
        </article>
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Em contato</span>
            <CheckCircle2 aria-hidden />
          </div>
          <strong>{leadsInContact}</strong>
          <p>Leads já movidos para a etapa Tentando Contato.</p>
        </article>
      </div>

      <div className="leads-grid">
        <LeadForm
          data={data}
          user={user}
          lead={editingLead}
          onCancel={() => setEditingLead(null)}
          onSaved={(noticeMessage) => {
            setEditingLead(null);
            setNotice(noticeMessage ?? 'Lead salvo.');
            void onReload();
          }}
          setError={setError}
        />

        <div className="stack">
          <section className="panel lead-spotlight">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Lead em foco</span>
                <h2>{selectedLead ? selectedLead.name : 'Nenhum lead selecionado'}</h2>
              </div>
              {selectedLead && (
                <span className={`lead-pill ${selectedLeadMissing.length > 0 ? 'lead-pill-warning' : 'lead-pill-ready'}`}>
                  {selectedLeadMissing.length > 0 ? `${selectedLeadMissing.length} pendência(s)` : 'Pronto para avançar'}
                </span>
              )}
            </div>

            {!selectedLead ? (
              <p className="empty">Crie o primeiro lead para começar a operar o funil.</p>
            ) : (
              <div className="lead-spotlight-grid">
                <article className="chat-summary-card">
                  <strong>Contexto comercial</strong>
                  <p>{getLeadMetaLine(selectedLead)}</p>
                  <span>Etapa atual: {selectedLeadStage?.name ?? 'Sem etapa'}</span>
                </article>
                <article className="chat-summary-card">
                  <strong>Contato principal</strong>
                  <p>{selectedLead.email ?? selectedLead.phone ?? 'Contato não informado'}</p>
                  <span>Origem: {selectedLead.lead_source || 'Não informada'}</span>
                </article>
                <article className="chat-summary-card">
                  <strong>Responsáveis</strong>
                  <p>{selectedLead.technical_owner_name || 'Sem responsável técnico'}</p>
                  <span>{selectedLeadWorkspaceOwner ? `Workspace: ${selectedLeadWorkspaceOwner}` : 'Sem responsável do workspace'}</span>
                </article>
                <article className="chat-summary-card">
                  <strong>Checklist da etapa</strong>
                  <p>
                    {selectedLeadMissing.length > 0
                      ? `Faltam ${selectedLeadMissing.length} campo(s) obrigatório(s) para movimentar com segurança.`
                      : 'O lead já atende os requisitos da etapa atual.'}
                  </p>
                  <span>{selectedLeadMissing.length > 0 ? selectedLeadMissing.join(', ') : 'Sem bloqueios ativos'}</span>
                </article>
              </div>
            )}
          </section>

          <section className="panel lead-board-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Funil operacional</span>
                <h2>Leads por etapa</h2>
              </div>
              <span className="panel-meta">Clique em um card para destacar o lead e use o seletor para mover de etapa.</span>
            </div>
            <Kanban
              data={data}
              selectedLeadId={selectedLeadId}
              onSelect={setSelectedLeadId}
              onEdit={(lead) => {
                setSelectedLeadId(lead.id);
                setEditingLead(lead);
              }}
              onMove={handleMove}
              movingLeadId={movingLeadId}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

function LeadForm({
  data,
  user,
  lead,
  onCancel,
  onSaved,
  setError,
}: {
  data: CrmData;
  user: User;
  lead: Lead | null;
  onCancel: () => void;
  onSaved: (noticeMessage?: string) => void;
  setError: (message: string | null) => void;
}) {
  const initial = useMemo(() => {
    if (!lead) {
      return { ...emptyLeadInput, current_stage_id: data.stages[0]?.id ?? '' };
    }

    const customValues = Object.fromEntries(
      data.customValues.filter((value) => value.lead_id === lead.id).map((value) => [value.custom_field_id, value.value_text ?? '']),
    );

    return {
      id: lead.id,
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      job_title: lead.job_title ?? '',
      lead_source: lead.lead_source ?? '',
      notes: lead.notes ?? '',
      technical_owner_name: lead.technical_owner_name ?? '',
      assigned_user_id: lead.assigned_user_id,
      current_stage_id: lead.current_stage_id,
      customValues,
    };
  }, [data.customValues, data.stages, lead]);

  const [form, setForm] = useState<LeadInput>(initial);
  const [confirmUnassignedOpen, setConfirmUnassignedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const workspaceMemberOptions = useMemo(
    () =>
      [...data.workspaceMembers]
        .sort((left, right) =>
          getWorkspaceMemberDisplayName(left, user).localeCompare(getWorkspaceMemberDisplayName(right, user), 'pt-BR', {
            sensitivity: 'base',
          }),
        )
        .map((member) => ({
          value: member.user_id,
          label: getWorkspaceMemberDisplayName(member, user),
          role: member.role,
        })),
    [data.workspaceMembers, user],
  );

  useEffect(() => setForm(initial), [initial]);

  async function saveLead() {
    if (!supabase) return;

    try {
      setSaving(true);
      setError(null);
      const savedLead = await upsertLead(supabase, data.workspace, user, form);
      setConfirmUnassignedOpen(false);
      const successMessage = lead ? 'Lead atualizado' : 'Lead cadastrado';
      let automation: StageTriggerAutomationResult = {
        generatedCampaignNames: [],
        skippedCampaignNames: [],
        failedCampaigns: [],
      };
      let feedback = {
        notice: `${successMessage}.`,
        warning: null as string | null,
      };

      try {
        automation = await runStageTriggerAutomation(supabase, {
          workspaceId: data.workspace.id,
          leadId: savedLead.id,
          stageId: savedLead.current_stage_id,
        });

        feedback = buildStageAutomationFeedback({
          successMessage,
          failurePrefix: 'Lead salvo, mas o gatilho automatico falhou em',
          automation,
        });
      } catch (automationError) {
        feedback = {
          notice: `${successMessage}.`,
          warning: buildStageAutomationErrorWarning(
            'Lead salvo, mas o gatilho automatico nao pode ser concluido',
            automationError,
          ),
        };
      }

      if (feedback.warning && automation.failedCampaigns.length > 0) {
        setError(
          `Lead salvo, mas o gatilho automático falhou em: ${automation.failedCampaigns.map((item) => item.name).join(', ')}.`,
        );
      }

      if (feedback.warning && automation.failedCampaigns.length === 0) {
        setError(feedback.warning);
      }

      onSaved(feedback.notice);
    } catch (saveError) {
      setError(getSafeMessage(saveError, 'lead'));
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError(null);

    if (!form.name.trim() || !form.current_stage_id) {
      setError('Nome e etapa são obrigatórios.');
      return;
    }

    if (!form.technical_owner_name.trim()) {
      setConfirmUnassignedOpen(true);
      return;
    }

    await saveLead();
  }

  return (
    <>
    <form className="panel form-grid lead-form" onSubmit={submit}>
      <div className="form-heading">
        <div className="lead-form-heading">
          <span className="section-kicker">{lead ? 'Atualizando oportunidade' : 'Novo lead'}</span>
          <h2>{lead ? 'Editar lead' : 'Novo lead'}</h2>
          <p>Cadastre contexto suficiente para mover o lead pelo funil sem travas de campos obrigatórios.</p>
        </div>
        {lead && (
          <button type="button" className="ghost compact" onClick={onCancel}>
            Cancelar edição
          </button>
        )}
      </div>
      <label>
        Nome
        <input
          name="leadName"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Ex.: Contato comercial"
          required
        />
        <span className="field-hint">Digite o nome do contato. Ex.: Contato comercial.</span>
      </label>
      <label>
        E-mail
        <input
          name="leadEmail"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          placeholder="Ex.: contato@empresa.com.br"
        />
        <span className="field-hint">Use um e-mail profissional do lead. Ex.: contato@empresa.com.br.</span>
      </label>
      <label>
        Telefone
        <input
          name="leadPhone"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          placeholder="Ex.: 11987654321"
        />
        <span className="field-hint">Informe telefone com DDD. Ex.: 11987654321.</span>
      </label>
      <label>
        Empresa
        <input
          name="leadCompany"
          value={form.company}
          onChange={(event) => setForm({ ...form, company: event.target.value })}
          placeholder="Ex.: Empresa alvo"
        />
        <span className="field-hint">Use o nome comercial da conta. Ex.: Empresa alvo.</span>
      </label>
      <label>
        Cargo
        <input
          name="leadJobTitle"
          value={form.job_title}
          onChange={(event) => setForm({ ...form, job_title: event.target.value })}
          placeholder="Ex.: Head de Receita"
        />
        <span className="field-hint">Registre o papel do lead no processo. Ex.: Head de Receita.</span>
      </label>
      <label>
        Origem
        <input
          name="leadSource"
          value={form.lead_source}
          onChange={(event) => setForm({ ...form, lead_source: event.target.value })}
          placeholder="Ex.: Lista ICP 2026"
        />
        <span className="field-hint">Explique de onde esse lead veio. Ex.: Lista ICP 2026.</span>
      </label>
      <label>
        Etapa
        <select name="leadStage" value={form.current_stage_id} onChange={(event) => setForm({ ...form, current_stage_id: event.target.value })}>
          {data.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Responsável técnico
        <input
          name="leadTechnicalOwner"
          value={form.technical_owner_name}
          onChange={(event) => setForm({ ...form, technical_owner_name: event.target.value })}
          placeholder="Ex.: Especialista técnico"
        />
        <span className="field-hint">
          Informe quem acompanha tecnicamente este lead. Ex.: Especialista técnico. Se ficar em branco, o lead será salvo sem responsável técnico.
        </span>
      </label>
      <label>
        Responsável do workspace
        <select
          name="leadAssignedWorkspaceUser"
          value={form.assigned_user_id ?? ''}
          onChange={(event) => setForm({ ...form, assigned_user_id: event.target.value || null })}
        >
          <option value="">Sem responsável do workspace</option>
          {workspaceMemberOptions.map((member) => (
            <option key={member.value} value={member.value}>
              {member.label}
              {member.role === 'owner' ? ' (owner)' : ''}
            </option>
          ))}
        </select>
        <span className="field-hint">
          Atribua o lead a um usuário do workspace quando fizer sentido operacional. Ex.: Owner do workspace.
        </span>
      </label>
      <label className="wide">
        Observações
        <textarea
          name="leadNotes"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Ex.: Quer reduzir tempo de resposta do time."
        />
        <span className="field-hint">Anote contexto útil para a próxima abordagem. Ex.: quer reduzir tempo de resposta do time.</span>
      </label>
      {data.customFields.map((field) => (
        <label key={field.id}>
          {field.name}
          <input
            name={`customField-${field.id}`}
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={form.customValues[field.id] ?? ''}
            placeholder={field.field_type === 'number' ? 'Ex.: 12' : 'Ex.: Operação outbound'}
            onChange={(event) =>
              setForm({
                ...form,
                customValues: { ...form.customValues, [field.id]: event.target.value },
              })
            }
          />
          <span className="field-hint">
            {field.field_type === 'number'
              ? 'Preencha com valor quantitativo. Ex.: 12.'
              : 'Preencha com um contexto objetivo. Ex.: Operação outbound.'}
          </span>
        </label>
      ))}
      <div className="wide">
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : lead ? 'Salvar lead' : 'Cadastrar lead'}</button>
      </div>
    </form>
    {confirmUnassignedOpen && (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="lead-unassigned-title">
        <section className="chat-modal lead-confirm-modal">
          <div className="chat-modal-header">
            <div>
              <span className="section-kicker">Confirmação</span>
              <h2 id="lead-unassigned-title">Salvar sem responsável técnico?</h2>
              <p>Este lead ficará sem responsável técnico definido. Você poderá preencher esse campo depois ao editar o lead.</p>
            </div>
            <button
              type="button"
              className="ghost icon-button"
              aria-label="Fechar confirmação"
              onClick={() => setConfirmUnassignedOpen(false)}
              disabled={saving}
            >
              <X aria-hidden />
            </button>
          </div>
          <div className="chat-modal-footer">
            <p>Você quer mesmo cadastrar esse lead sem um responsável técnico?</p>
            <div className="chat-modal-actions">
              <button type="button" className="secondary" onClick={() => setConfirmUnassignedOpen(false)} disabled={saving}>
                Voltar e preencher
              </button>
              <button type="button" onClick={saveLead} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar sem responsável'}
              </button>
            </div>
          </div>
        </section>
      </div>
    )}
    </>
  );
}

function Kanban({
  data,
  selectedLeadId,
  onSelect,
  onEdit,
  onMove,
  movingLeadId,
}: {
  data: CrmData;
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  onEdit: (lead: Lead) => void;
  onMove: (lead: Lead, stage: PipelineStage) => Promise<void>;
  movingLeadId: string | null;
}) {
  return (
    <section className="kanban" aria-label="Funil de leads">
      {data.stages.map((stage) => {
        const leads = data.leads.filter((lead) => lead.current_stage_id === stage.id);
        return (
          <div className="kanban-column" key={stage.id}>
            <header>
              <div className="kanban-column-heading">
                <h3>{stage.name}</h3>
                <small>{leads.length > 0 ? `${leads.length} lead(s) nesta etapa` : 'Sem leads nesta etapa'}</small>
              </div>
              <span>{leads.length}</span>
            </header>
            {leads.length === 0 && <p className="empty">Sem leads nesta etapa.</p>}
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                data={data}
                selected={selectedLeadId === lead.id}
                moving={movingLeadId === lead.id}
                onSelect={() => onSelect(lead.id)}
                onEdit={() => onEdit(lead)}
                onMove={onMove}
              />
            ))}
          </div>
        );
      })}
    </section>
  );
}

function LeadCard({
  lead,
  data,
  selected,
  moving,
  onSelect,
  onEdit,
  onMove,
}: {
  lead: Lead;
  data: CrmData;
  selected: boolean;
  moving: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMove: (lead: Lead, stage: PipelineStage) => Promise<void>;
}) {
  const currentStage = data.stages.find((stage) => stage.id === lead.current_stage_id) ?? null;
  const assignedWorkspaceOwner = getAssignedWorkspaceOwnerLabel(lead, data);
  const missing = currentStage
    ? findMissingRequiredFields({
        lead,
        targetStage: currentStage,
        requiredFields: data.requiredFields,
        customFields: data.customFields,
        customValues: data.customValues,
      })
    : [];

  return (
    <article
      className={`lead-card lead-card-rich ${selected ? 'lead-card-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="lead-card-topline">
        <strong>{lead.name}</strong>
        <span className={`lead-pill ${missing.length > 0 ? 'lead-pill-warning' : 'lead-pill-ready'}`}>
          {missing.length > 0 ? `${missing.length} pendência(s)` : 'Pronto'}
        </span>
      </div>

      <p className="lead-card-subtitle">{getLeadMetaLine(lead)}</p>

      <div className="lead-detail-list">
        <div>
          <Building2 aria-hidden />
          <span>{lead.company || 'Empresa não informada'}</span>
        </div>
        <div>
          <Mail aria-hidden />
          <span>{lead.email || 'Sem e-mail'}</span>
        </div>
        <div>
          <Phone aria-hidden />
          <span>{lead.phone || 'Sem telefone'}</span>
        </div>
      </div>

      <div className="lead-tag-row">
        {moving && <span className="lead-tag lead-tag-busy">Movendo etapa...</span>}
        <span className="lead-tag">{lead.lead_source || 'Origem não informada'}</span>
        <span className="lead-tag">
          {lead.technical_owner_name ? `Resp. técnico: ${lead.technical_owner_name}` : 'Sem responsável técnico'}
        </span>
        <span className="lead-tag">
          {assignedWorkspaceOwner ? `Resp. workspace: ${assignedWorkspaceOwner}` : 'Sem responsável do workspace'}
        </span>
      </div>

      {missing.length > 0 && <p className="lead-card-warning">Campos faltando: {missing.join(', ')}.</p>}

      <div className="card-actions lead-card-actions">
        <button
          type="button"
          className="ghost compact"
          disabled={moving}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          Editar
        </button>
        <select
          className="lead-stage-select"
          name={`lead-stage-${lead.id}`}
          value={lead.current_stage_id}
          disabled={moving}
          aria-busy={moving}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const target = data.stages.find((item) => item.id === event.target.value);
            if (target) void onMove(lead, target);
          }}
        >
          {data.stages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}

function FieldsView({
  data,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'text' | 'number'>('text');
  const [creatingField, setCreatingField] = useState(false);
  const stagesWithRules = new Set(data.requiredFields.map((rule) => rule.stage_id)).size;
  const standardRules = data.requiredFields.filter((rule) => rule.field_key).length;
  const customRules = data.requiredFields.filter((rule) => rule.custom_field_id).length;

  async function createCustomField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (creatingField) return;
    const fieldKey = createFieldKey(name);
    if (!fieldKey) {
      setError('Nome de campo inválido.');
      return;
    }
    setCreatingField(true);
    try {
      const { error } = await supabase.from('workspace_custom_fields').insert({
        workspace_id: data.workspace.id,
        name: name.trim(),
        field_key: fieldKey,
        field_type: type,
      });
      if (error) throw error;
      setName('');
      setType('text');
      setNotice('Campo personalizado criado.');
      await onReload();
    } catch (fieldError) {
      setError(getSafeMessage(fieldError, 'workspace'));
    } finally {
      setCreatingField(false);
    }
  }

  return (
    <section className="stack">
      <Header title="Campos e regras" subtitle="Campos personalizados e obrigatoriedade por etapa." />

      <div className="fields-summary-grid">
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Campos personalizados</span>
            <Plus aria-hidden />
          </div>
          <strong>{data.customFields.length}</strong>
          <p>Campos extras que enriquecem o contexto do lead sem mudar a estrutura base do CRM.</p>
        </article>
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Etapas com regra</span>
            <Workflow aria-hidden />
          </div>
          <strong>{stagesWithRules}</strong>
          <p>Etapas do funil que já têm bloqueios explícitos para manter integridade operacional.</p>
        </article>
        <article className="overview-card overview-card-accent">
          <div className="overview-card-topline">
            <span className="section-kicker">Cobertura de validação</span>
            <CircleAlert aria-hidden />
          </div>
          <strong>{data.requiredFields.length}</strong>
          <p>{standardRules} regra(s) padrão e {customRules} regra(s) baseadas em campos personalizados.</p>
        </article>
      </div>

      <div className="fields-grid">
        <div className="stack">
          <form className="panel form-grid field-create-form" onSubmit={createCustomField}>
            <div className="form-heading">
              <div className="lead-form-heading">
                <span className="section-kicker">Novo campo</span>
                <h2>Criar campo personalizado</h2>
                <p>Use campos extras para registrar sinais comerciais do lead sem perder a leitura do funil.</p>
              </div>
            </div>
            <label>
              Nome do campo
              <input
                name="customFieldName"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Segmento"
                required
              />
              <span className="field-hint">Exemplo: segmento.</span>
            </label>
            <label>
              Tipo
              <select name="customFieldType" value={type} onChange={(event) => setType(event.target.value as 'text' | 'number')}>
                <option value="text">Texto</option>
                <option value="number">Número</option>
              </select>
              <span className="field-hint">Escolha número apenas quando o valor precisar ser estritamente quantitativo.</span>
            </label>
            <div className="wide field-form-actions">
              <button type="submit" disabled={creatingField}>
                <Plus aria-hidden />
                {creatingField ? 'Criando campo...' : 'Criar campo'}
              </button>
            </div>
          </form>

          <section className="panel field-library">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Biblioteca de campos</span>
                <h2>Campos personalizados</h2>
              </div>
              <span className="panel-meta">Use esta área para revisar rapidamente a estrutura adicional do workspace.</span>
            </div>
            {data.customFields.length === 0 ? (
              <div className="empty-panel">
                <CircleAlert aria-hidden />
                <div>
                  <h2>Nenhum campo extra criado</h2>
                  <p className="empty">Comece pelos dados que fazem diferença na qualificação, não por cadastro excessivo.</p>
                </div>
              </div>
            ) : (
              <div className="field-card-list">
                {data.customFields.map((field) => (
                  <article key={field.id} className="field-card">
                    <div className="field-card-header">
                      <strong>{field.name}</strong>
                      <span className={`campaign-chip ${field.field_type === 'number' ? 'campaign-chip-trigger' : 'campaign-chip-idle'}`}>
                        {field.field_type === 'number' ? 'Número' : 'Texto'}
                      </span>
                    </div>
                    <p>{field.field_key}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <RequiredFieldsPanel data={data} onReload={onReload} setError={setError} setNotice={setNotice} />
      </div>
    </section>
  );
}

function RequiredFieldsPanel({
  data,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  const [stageId, setStageId] = useState(data.stages[0]?.id ?? '');
  const currentRules = data.requiredFields.filter((rule) => rule.stage_id === stageId);
  const [standardKeys, setStandardKeys] = useState<string[]>([]);
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    setStandardKeys(currentRules.flatMap((rule) => (rule.field_key ? [rule.field_key] : [])));
    setCustomIds(currentRules.flatMap((rule) => (rule.custom_field_id ? [rule.custom_field_id] : [])));
  }, [data.requiredFields, stageId]);

  function toggle(list: string[], setList: (value: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !stageId) return;
    if (savingRules) return;
    setSavingRules(true);
    try {
      await saveRequiredFields(supabase, data.workspace.id, stageId, standardKeys, customIds);
      setNotice('Regras de etapa salvas.');
      await onReload();
    } catch (ruleError) {
      setError(getSafeMessage(ruleError, 'workspace'));
    } finally {
      setSavingRules(false);
    }
  }

  return (
    <form className="panel required-fields-panel" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <span className="section-kicker">Regras do funil</span>
          <h2>Campos obrigatórios por etapa</h2>
        </div>
        <span className="panel-meta">{currentRules.length} regra(s) ativa(s) nesta etapa</span>
      </div>
      <label>
        Etapa
        <select name="requiredFieldStage" value={stageId} onChange={(event) => setStageId(event.target.value)}>
          {data.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>

      <div className="required-stage-summary">
        <article className="chat-summary-card">
          <strong>Leitura da etapa</strong>
          <p>Defina só o que é realmente bloqueante para manter o lead avançando com dados consistentes.</p>
          <span>{standardKeys.length + customIds.length} item(ns) marcados</span>
        </article>
        <article className="chat-summary-card">
          <strong>Campos padrão</strong>
          <p>Nome, contato, origem, cargo e demais dados base do lead.</p>
          <span>{standardKeys.length} regra(s) padrão ativas</span>
        </article>
        <article className="chat-summary-card">
          <strong>Campos extras</strong>
          <p>Campos personalizados do workspace que reforçam segmentação e qualificação.</p>
          <span>{customIds.length} regra(s) personalizada(s)</span>
        </article>
      </div>

      <div className="required-fields-sections">
        <section className="required-fields-section">
          <div className="required-fields-section-heading">
            <h3>Campos padrão</h3>
            <p>Regras universais do lead antes de mover a etapa.</p>
          </div>
          <div className="checkbox-grid">
            {STANDARD_LEAD_FIELDS.map((field) => (
              <label key={field.key} className="check">
                <input
                  name={`required-standard-${field.key}`}
                  type="checkbox"
                  checked={standardKeys.includes(field.key)}
                  onChange={() => toggle(standardKeys, setStandardKeys, field.key)}
                />
                {field.label}
              </label>
            ))}
          </div>
        </section>

        <section className="required-fields-section">
          <div className="required-fields-section-heading">
            <h3>Campos personalizados</h3>
            <p>Complementos do workspace para tornar a abordagem e a qualificação mais precisas.</p>
          </div>
          {data.customFields.length === 0 ? (
            <p className="empty">Nenhum campo personalizado disponível nesta etapa.</p>
          ) : (
            <div className="checkbox-grid">
              {data.customFields.map((field) => (
                <label key={field.id} className="check">
                  <input
                    name={`required-custom-${field.id}`}
                    type="checkbox"
                    checked={customIds.includes(field.id)}
                    onChange={() => toggle(customIds, setCustomIds, field.id)}
                  />
                  {field.name}
                </label>
              ))}
            </div>
          )}
        </section>
      </div>

      <button type="submit" disabled={savingRules}>{savingRules ? 'Salvando regras...' : 'Salvar regras'}</button>
    </form>
  );
}

function CampaignsView({
  data,
  user,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  user: User;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState<Campaign | null>(null);
  const activeCampaigns = data.campaigns.filter((campaign) => campaign.is_active).length;
  const campaignsWithTrigger = data.campaigns.filter((campaign) => campaign.trigger_stage_id).length;
  const stageNameById = new Map(data.stages.map((stage) => [stage.id, stage.name]));
  const summarize = (text: string, limit = 150) => (text.length > limit ? `${text.slice(0, limit).trim()}...` : text);

  return (
    <section className="stack">
      <Header title="Campanhas" subtitle="Playbooks de abordagem, contexto e gatilhos usados pela Edge Function de IA." />

      <div className="campaign-summary-grid">
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Playbooks cadastrados</span>
            <Megaphone aria-hidden />
          </div>
          <strong>{data.campaigns.length}</strong>
          <p>Campanhas disponíveis para orientar a abordagem comercial do avaliador.</p>
        </article>
        <article className="overview-card">
          <div className="overview-card-topline">
            <span className="section-kicker">Campanhas ativas</span>
            <CheckCircle2 aria-hidden />
          </div>
          <strong>{activeCampaigns}</strong>
          <p>Playbooks já prontos para geração imediata de mensagens pela IA.</p>
        </article>
        <article className="overview-card overview-card-accent">
          <div className="overview-card-topline">
            <span className="section-kicker">Gatilhos automáticos</span>
            <Workflow aria-hidden />
          </div>
          <strong>{campaignsWithTrigger}</strong>
          <p>Campanhas ligadas a etapas do funil, úteis para demonstrar automação orientada a processo.</p>
        </article>
      </div>

      <div className="campaign-grid">
        <CampaignForm
          data={data}
          user={user}
          campaign={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice('Campanha salva.');
            void onReload();
          }}
          setError={setError}
        />

        <section className="panel campaign-library">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Biblioteca de playbooks</span>
              <h2>Campanhas cadastradas</h2>
            </div>
            <span className="panel-meta">Selecione uma campanha para editar contexto, prompt e etapa gatilho.</span>
          </div>

          {data.campaigns.length === 0 ? (
            <p className="empty">Nenhuma campanha criada.</p>
          ) : (
            <div className="campaign-card-list">
              {data.campaigns.map((campaign) => {
                const triggerStageName = campaign.trigger_stage_id ? stageNameById.get(campaign.trigger_stage_id) ?? 'Etapa removida' : null;
                return (
                  <article
                    key={campaign.id}
                    className={`campaign-card-playbook ${editing?.id === campaign.id ? 'campaign-card-selected' : ''}`}
                  >
                    <div className="campaign-card-header">
                      <div>
                        <strong>{campaign.name}</strong>
                        <p>{triggerStageName ? `Gatilho em ${triggerStageName}` : 'Sem gatilho automático configurado.'}</p>
                      </div>
                      <div className="campaign-chip-row">
                        <span className={`campaign-chip ${campaign.is_active ? 'campaign-chip-active' : 'campaign-chip-inactive'}`}>
                          {campaign.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                        <span className={`campaign-chip ${triggerStageName ? 'campaign-chip-trigger' : 'campaign-chip-idle'}`}>
                          {triggerStageName ? 'Com gatilho' : 'Sem gatilho'}
                        </span>
                      </div>
                    </div>

                    <div className="campaign-card-section">
                      <span className="section-kicker">Contexto</span>
                      <p>{summarize(campaign.context_text)}</p>
                    </div>

                    <div className="campaign-card-section">
                      <span className="section-kicker">Prompt de geração</span>
                      <p>{summarize(campaign.generation_prompt)}</p>
                    </div>

                    <div className="campaign-card-section">
                      <span className="section-kicker">Atendimento IA</span>
                      <p>
                        {campaign.ai_response_mode === 'business_hours'
                          ? `Responde das ${campaign.ai_response_window_start.slice(0, 5)} às ${campaign.ai_response_window_end.slice(0, 5)} no horário de São Paulo.`
                          : 'Responde automaticamente 24h no simulador.'}
                      </p>
                    </div>

                    <div className="campaign-card-actions">
                      <button type="button" className="ghost compact" onClick={() => setEditing(campaign)}>
                        Editar playbook
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function CampaignForm({
  data,
  user,
  campaign,
  onCancel,
  onSaved,
  setError,
}: {
  data: CrmData;
  user: User;
  campaign: Campaign | null;
  onCancel: () => void;
  onSaved: () => void;
  setError: (message: string | null) => void;
}) {
  const initial = campaign
    ? {
        id: campaign.id,
        name: campaign.name,
        context_text: campaign.context_text,
        generation_prompt: campaign.generation_prompt,
        trigger_stage_id: campaign.trigger_stage_id,
        ai_response_mode: campaign.ai_response_mode ?? 'always',
        ai_response_window_start: campaign.ai_response_window_start?.slice(0, 5) ?? '09:00',
        ai_response_window_end: campaign.ai_response_window_end?.slice(0, 5) ?? '18:00',
        is_active: campaign.is_active,
      }
    : emptyCampaignInput;
  const [form, setForm] = useState<CampaignInput>(initial);
  const [plan, setPlan] = useState<CampaignStrategyPlan>(derivePlanFromCampaign(campaign));
  const [planningBusy, setPlanningBusy] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [planMeta, setPlanMeta] = useState<{ model: string } | null>(null);

  useEffect(() => {
    setForm(initial);
    setPlan(derivePlanFromCampaign(campaign));
    setPlanMeta(null);
  }, [campaign]);

  async function generatePlan() {
    if (!supabase) return;
    if (planningBusy || savingCampaign) return;
    if (!form.name.trim() || !form.context_text.trim()) {
      setError('Nome e contexto são obrigatórios para montar o plano da campanha.');
      return;
    }

    const supabaseClient = supabase;
    setPlanningBusy(true);
    setError(null);

    try {
      const result = await invokeEdgeFunction<{
        success: boolean;
        error?: string;
        data?: CampaignStrategyPlan & { model: string };
      }>(supabaseClient, 'plan-campaign-strategy', {
        workspace_id: data.workspace.id,
        name: form.name,
        context_text: form.context_text,
        trigger_stage_id: form.trigger_stage_id,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Falha ao montar o plano da campanha.');
      }

      setPlan({
        objective_summary: result.data.objective_summary,
        icp_summary: result.data.icp_summary,
        pain_summary: result.data.pain_summary,
        tone_guidelines: result.data.tone_guidelines,
        cta_strategy: result.data.cta_strategy,
        objection_handling: result.data.objection_handling,
        sequence_strategy: result.data.sequence_strategy,
        final_prompt: result.data.final_prompt,
      });
      setPlanMeta({ model: result.data.model });
    } catch (planError) {
      setError(getSafeMessage(planError, 'ai'));
    } finally {
      setPlanningBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (savingCampaign) return;
    if (!form.name.trim() || !form.context_text.trim()) {
      setError('Nome e contexto são obrigatórios.');
      return;
    }
    if (!plan.final_prompt.trim()) {
      setError('Gere ou revise o plano da campanha antes de salvar.');
      return;
    }
    if (form.ai_response_mode === 'business_hours' && form.ai_response_window_start === form.ai_response_window_end) {
      setError('Defina horários diferentes para início e fim do atendimento da IA.');
      return;
    }
    setSavingCampaign(true);
    try {
      await upsertCampaign(supabase, data.workspace, user, {
        ...form,
        generation_prompt: plan.final_prompt,
      });
      onSaved();
    } catch (campaignError) {
      setError(getSafeMessage(campaignError, 'campaign'));
    } finally {
      setSavingCampaign(false);
    }
  }

  return (
    <form className="panel form-grid campaign-form" onSubmit={submit}>
      <div className="form-heading">
        <div className="campaign-form-heading">
          <span className="section-kicker">{campaign ? 'Refinando playbook' : 'Novo playbook'}</span>
          <h2>{campaign ? 'Editar campanha' : 'Nova campanha'}</h2>
          <p>Defina o briefing comercial e deixe a IA montar o plano da campanha antes de salvar o playbook.</p>
        </div>
        {campaign && (
          <button type="button" className="ghost compact" onClick={onCancel} disabled={savingCampaign}>
            Cancelar edição
          </button>
        )}
      </div>
      <label>
        Nome
        <input
          name="campaignName"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="Ex.: Outbound ICP Operações"
          required
        />
        <span className="field-hint">Use um nome claro. Ex.: Outbound ICP Operações.</span>
      </label>
      <label>
        Etapa gatilho
        <select
          name="campaignTriggerStage"
          value={form.trigger_stage_id ?? ''}
          onChange={(event) => setForm({ ...form, trigger_stage_id: event.target.value || null })}
        >
          <option value="">Sem gatilho</option>
          {data.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <span className="field-hint">Opcional. Quando definido, a campanha passa a representar um gatilho do funil.</span>
      </label>
      <label className="check inline-check">
        <input
          name="campaignIsActive"
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
        />
        Campanha ativa
      </label>
      <label>
        Resposta da IA
        <select
          name="campaignAiResponseMode"
          value={form.ai_response_mode}
          onChange={(event) =>
            setForm({
              ...form,
              ai_response_mode: event.target.value === 'business_hours' ? 'business_hours' : 'always',
            })
          }
        >
          <option value="always">Responder 24h</option>
          <option value="business_hours">Responder apenas em horário de atendimento</option>
        </select>
        <span className="field-hint">O fuso usado no simulador é sempre São Paulo.</span>
      </label>
      <div className="campaign-hours-row">
        <label>
          Início do atendimento
          <input
            name="campaignAiResponseWindowStart"
            type="time"
            value={form.ai_response_window_start}
            onChange={(event) => setForm({ ...form, ai_response_window_start: event.target.value })}
            disabled={form.ai_response_mode === 'always'}
          />
        </label>
        <label>
          Fim do atendimento
          <input
            name="campaignAiResponseWindowEnd"
            type="time"
            value={form.ai_response_window_end}
            onChange={(event) => setForm({ ...form, ai_response_window_end: event.target.value })}
            disabled={form.ai_response_mode === 'always'}
          />
        </label>
      </div>
      <label className="wide">
	        Contexto do briefing
        <textarea
          name="campaignContext"
          value={form.context_text}
          onChange={(event) => setForm({ ...form, context_text: event.target.value })}
          placeholder="Ex.: SaaS B2B com time SDR travado por baixa cadência."
          required
        />
        <span className="field-hint">Ex.: SaaS B2B com time SDR travado por baixa cadência.</span>
        <span className="field-hint">Descreva rapidamente o cenário, produto e dor comercial que a IA deve considerar.</span>
      </label>
      <div className="wide campaign-plan-actions">
        <button type="button" className="secondary" onClick={generatePlan} disabled={planningBusy || savingCampaign}>
          {planningBusy ? 'Montando plano com IA...' : plan.final_prompt.trim() ? 'Gerar novo plano com IA' : 'Gerar plano com IA'}
        </button>
        <span className="field-hint">A IA monta o plano da campanha e o prompt final. Você pode aprovar, editar ou gerar novamente antes de salvar.</span>
      </div>
      <section className="wide campaign-plan-panel" aria-label="Plano de ação da campanha">
        <div className="campaign-card-header">
          <div>
            <span className="section-kicker">Revisão antes do salvamento</span>
            <h3>Plano de ação da campanha</h3>
            <p>Revise o racional sugerido pela IA, ajuste o que precisar e só então salve a campanha.</p>
          </div>
          <div className="campaign-chip-row">
            <span className="campaign-chip campaign-chip-stage">{planMeta ? `Gerado por ${planMeta.model}` : 'Ainda não gerado'}</span>
          </div>
        </div>
        <div className="campaign-plan-grid">
          <label>
            Objetivo
            <textarea
              name="campaignPlanObjective"
              value={plan.objective_summary}
              onChange={(event) => setPlan((current) => ({ ...current, objective_summary: event.target.value }))}
              placeholder="Ex.: Abrir diagnóstico com líderes comerciais que ainda operam o pipeline manualmente."
            />
          </label>
          <label>
            ICP
            <textarea
              name="campaignPlanIcp"
              value={plan.icp_summary}
              onChange={(event) => setPlan((current) => ({ ...current, icp_summary: event.target.value }))}
              placeholder="Ex.: Heads de vendas, operações e revenue em empresas B2B com time SDR ativo."
            />
          </label>
          <label>
            Dor principal
            <textarea
              name="campaignPlanPain"
              value={plan.pain_summary}
              onChange={(event) => setPlan((current) => ({ ...current, pain_summary: event.target.value }))}
              placeholder="Ex.: Baixa cadência, dificuldade de qualificação e pouca visibilidade do funil."
            />
          </label>
          <label>
            Tom recomendado
            <textarea
              name="campaignPlanTone"
              value={plan.tone_guidelines}
              onChange={(event) => setPlan((current) => ({ ...current, tone_guidelines: event.target.value }))}
              placeholder="Ex.: Consultivo, objetivo, respeitoso e sem promessas exageradas."
            />
          </label>
          <label>
            CTA recomendado
            <textarea
              name="campaignPlanCta"
              value={plan.cta_strategy}
              onChange={(event) => setPlan((current) => ({ ...current, cta_strategy: event.target.value }))}
              placeholder="Ex.: Convidar para uma conversa curta de diagnóstico ou pedir contexto do processo atual."
            />
          </label>
          <label>
            Tratamento de objeções
            <textarea
              name="campaignPlanObjections"
              value={plan.objection_handling}
              onChange={(event) => setPlan((current) => ({ ...current, objection_handling: event.target.value }))}
              placeholder="Ex.: Responder timing, prioridade, ferramenta atual e falta de tempo sem insistência agressiva."
            />
          </label>
          <label className="wide">
            Sequência sugerida
            <textarea
              name="campaignPlanSequence"
              value={plan.sequence_strategy}
              onChange={(event) => setPlan((current) => ({ ...current, sequence_strategy: event.target.value }))}
              placeholder="Ex.: Abertura consultiva, retomada amigável sem resposta e avanço para qualificação quando houver interesse."
            />
          </label>
          <label className="wide">
            Prompt final aprovado
            <textarea
              name="campaignPlanPrompt"
              value={plan.final_prompt}
              onChange={(event) => setPlan((current) => ({ ...current, final_prompt: event.target.value }))}
              placeholder="Ex.: Gere 3 mensagens curtas, consultivas, personalizadas e sem inventar dados, usando o contexto do lead e CTA leve."
            />
            <span className="field-hint">Esse é o prompt que será salvo e usado pela Edge Function de geração.</span>
          </label>
        </div>
      </section>
      <div className="wide">
        <button type="submit" disabled={savingCampaign || planningBusy}>
          {savingCampaign ? 'Salvando campanha...' : 'Salvar campanha'}
        </button>
      </div>
    </form>
  );
}

function MessagesView({
  data,
  user,
  onReload,
  setError,
  setNotice,
}: {
  data: CrmData;
  user: User;
  onReload: () => void;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
}) {
  return (
    <MessagesScreen
      data={data}
      user={user}
      onReload={onReload}
      setError={setError}
      setNotice={setNotice}
    />
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}
