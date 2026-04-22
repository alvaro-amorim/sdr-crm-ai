import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  Bot,
  Building2,
  CircleAlert,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MailCheck,
  Megaphone,
  Phone,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Users,
  Workflow,
} from 'lucide-react';
import { DashboardScreen } from './components/dashboard-screen';
import { MessagesScreen } from './components/messages-screen';
import { envError, supabase } from './lib/supabase';
import {
  createWorkspaceWithDefaults,
  getFirstWorkspace,
  loadCrmData,
  moveLead,
  saveRequiredFields,
  upsertCampaign,
  upsertLead,
  type CampaignInput,
  type LeadInput,
} from './services/crm';
import type {
  Campaign,
  CrmData,
  Lead,
  PipelineStage,
} from './types/domain';
import { getLeadMetaLine } from './utils/crm-ui';
import { createFieldKey, findMissingRequiredFields, STANDARD_LEAD_FIELDS } from './utils/pipeline';

type Tab = 'dashboard' | 'leads' | 'fields' | 'campaigns' | 'messages';

const emptyLeadInput: LeadInput = {
  name: '',
  email: '',
  phone: '',
  company: '',
  job_title: '',
  lead_source: '',
  notes: '',
  assigned_user_id: null,
  current_stage_id: '',
  customValues: {},
};

const emptyCampaignInput: CampaignInput = {
  name: '',
  context_text: '',
  generation_prompt: '',
  trigger_stage_id: null,
  is_active: true,
};

function getSafeMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha inesperada. Tente novamente.';
}

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
        setError(`Falha no login OAuth: ${callbackError}`);
        clearAuthCallbackUrl();
      }

      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        const { data: exchangedData, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
        clearAuthCallbackUrl();
        if (exchangeError) {
          setError(`Falha ao concluir login OAuth: ${exchangeError.message}`);
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
        setError(getSafeMessage(sessionError));
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
      setError(getSafeMessage(loadError));
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
      setError(getSafeMessage(workspaceError));
    } finally {
      setBusy(false);
    }
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
  minLength = 6,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete: string;
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
    </label>
  );
}

function AuthScreen({ authError }: { authError?: string | null }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [success, setSuccess] = useState<string | null>(null);

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

    setBusy(true);
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
      setError(getSafeMessage(authError));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true);
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
      setError(getSafeMessage(googleError));
      setBusy(false);
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
              placeholder="Nome do avaliador"
            />
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
            required
          />
        </label>
        {mode !== 'forgot' && (
          <PasswordField
            id="password"
            name="password"
            label="Senha"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          />
        )}
        {error && <p className="error">{error}</p>}
        {success && <p className="success-text">{success}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Processando...' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Cadastrar' : 'Enviar link'}
        </button>
        {mode !== 'forgot' && (
          <button type="button" className="google-button" onClick={signInWithGoogle} disabled={busy}>
            Entrar com Google
          </button>
        )}
        <div className="auth-links">
          <button type="button" className="ghost" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </button>
          {mode !== 'signup' && (
            <button type="button" className="ghost" onClick={() => setMode(mode === 'forgot' ? 'login' : 'forgot')}>
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
      setError(getSafeMessage(updateError));
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
        />
        <PasswordField
          id="confirmNewPassword"
          name="confirmNewPassword"
          label="Confirmar senha"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
  const nav = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads' as const, label: 'Leads', icon: Users },
    { id: 'fields' as const, label: 'Campos', icon: CheckCircle2 },
    { id: 'campaigns' as const, label: 'Campanhas', icon: Megaphone },
    { id: 'messages' as const, label: 'Mensagens IA', icon: Bot },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <Bot aria-hidden />
            <div>
              <strong>SDR Expert</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <div className="workspace-badge">
            <small>Workspace ativo</small>
            <strong>{workspaceName ?? 'Configuração inicial'}</strong>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => onTabChange(item.id)}>
                <Icon aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-actions">
          <button type="button" className="ghost" onClick={onRefresh} disabled={busy}>
            <RefreshCcw aria-hidden />
            Atualizar
          </button>
          <button type="button" className="ghost" onClick={() => void supabase?.auth.signOut()}>
            <LogOut aria-hidden />
            Sair
          </button>
        </div>
      </aside>
      <main className="content">
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
        <input name="workspaceName" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="button" onClick={() => onCreate(name)} disabled={busy || name.trim().length < 2}>
        <Plus aria-hidden />
        Criar workspace e funil padrão
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
  const stageById = useMemo(() => new Map(data.stages.map((stage) => [stage.id, stage])), [data.stages]);
  const selectedLead = data.leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const selectedLeadStage = selectedLead ? stageById.get(selectedLead.current_stage_id) ?? null : null;
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

    try {
      await moveLead(supabase, data.workspace.id, lead.id, targetStage.id);
      setNotice(`Lead movido para ${targetStage.name}.`);
      await onReload();
    } catch (moveError) {
      setError(getSafeMessage(moveError));
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
          onSaved={() => {
            setEditingLead(null);
            setNotice('Lead salvo.');
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
  onSaved: () => void;
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
      assigned_user_id: lead.assigned_user_id,
      current_stage_id: lead.current_stage_id,
      customValues,
    };
  }, [data.customValues, data.stages, lead]);

  const [form, setForm] = useState<LeadInput>(initial);

  useEffect(() => setForm(initial), [initial]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setError(null);

    if (!form.name.trim() || !form.current_stage_id) {
      setError('Nome e etapa são obrigatórios.');
      return;
    }

    try {
      await upsertLead(supabase, data.workspace, user, form);
      onSaved();
    } catch (saveError) {
      setError(getSafeMessage(saveError));
    }
  }

  return (
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
        <input name="leadName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        E-mail
        <input name="leadEmail" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </label>
      <label>
        Telefone
        <input name="leadPhone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      </label>
      <label>
        Empresa
        <input name="leadCompany" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
      </label>
      <label>
        Cargo
        <input name="leadJobTitle" value={form.job_title} onChange={(event) => setForm({ ...form, job_title: event.target.value })} />
      </label>
      <label>
        Origem
        <input name="leadSource" value={form.lead_source} onChange={(event) => setForm({ ...form, lead_source: event.target.value })} />
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
        Responsável
        <select
          name="leadAssignee"
          value={form.assigned_user_id ?? ''}
          onChange={(event) => setForm({ ...form, assigned_user_id: event.target.value || null })}
        >
          <option value="">Sem responsável</option>
          <option value={user.id}>Eu</option>
        </select>
      </label>
      <label className="wide">
        Observações
        <textarea name="leadNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </label>
      {data.customFields.map((field) => (
        <label key={field.id}>
          {field.name}
          <input
            name={`customField-${field.id}`}
            type={field.field_type === 'number' ? 'number' : 'text'}
            value={form.customValues[field.id] ?? ''}
            onChange={(event) =>
              setForm({
                ...form,
                customValues: { ...form.customValues, [field.id]: event.target.value },
              })
            }
          />
        </label>
      ))}
      <div className="wide">
        <button type="submit">{lead ? 'Salvar lead' : 'Cadastrar lead'}</button>
      </div>
    </form>
  );
}

function Kanban({
  data,
  selectedLeadId,
  onSelect,
  onEdit,
  onMove,
}: {
  data: CrmData;
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  onEdit: (lead: Lead) => void;
  onMove: (lead: Lead, stage: PipelineStage) => void;
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
  onSelect,
  onEdit,
  onMove,
}: {
  lead: Lead;
  data: CrmData;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMove: (lead: Lead, stage: PipelineStage) => void;
}) {
  const currentStage = data.stages.find((stage) => stage.id === lead.current_stage_id) ?? null;
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
        <span className="lead-tag">{lead.lead_source || 'Origem não informada'}</span>
        {lead.assigned_user_id ? <span className="lead-tag">Responsável definido</span> : <span className="lead-tag">Sem responsável</span>}
      </div>

      {missing.length > 0 && <p className="lead-card-warning">Campos faltando: {missing.join(', ')}.</p>}

      <div className="card-actions lead-card-actions">
        <button
          type="button"
          className="ghost compact"
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
  const stagesWithRules = new Set(data.requiredFields.map((rule) => rule.stage_id)).size;
  const standardRules = data.requiredFields.filter((rule) => rule.field_key).length;
  const customRules = data.requiredFields.filter((rule) => rule.custom_field_id).length;

  async function createCustomField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const fieldKey = createFieldKey(name);
    if (!fieldKey) {
      setError('Nome de campo inválido.');
      return;
    }
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
      setError(getSafeMessage(fieldError));
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
              <input name="customFieldName" value={name} onChange={(event) => setName(event.target.value)} required />
              <span className="field-hint">Exemplo: segmento, ICP, ticket médio, número de vendedores.</span>
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
              <button type="submit">
                <Plus aria-hidden />
                Criar campo
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
    try {
      await saveRequiredFields(supabase, data.workspace.id, stageId, standardKeys, customIds);
      setNotice('Regras de etapa salvas.');
      await onReload();
    } catch (ruleError) {
      setError(getSafeMessage(ruleError));
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

      <button type="submit">Salvar regras</button>
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
        is_active: campaign.is_active,
      }
    : emptyCampaignInput;
  const [form, setForm] = useState<CampaignInput>(initial);

  useEffect(() => setForm(initial), [campaign]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (!form.name.trim() || !form.context_text.trim() || !form.generation_prompt.trim()) {
      setError('Nome, contexto e prompt são obrigatórios.');
      return;
    }
    try {
      await upsertCampaign(supabase, data.workspace, user, form);
      onSaved();
    } catch (campaignError) {
      setError(getSafeMessage(campaignError));
    }
  }

  return (
    <form className="panel form-grid campaign-form" onSubmit={submit}>
      <div className="form-heading">
        <div className="campaign-form-heading">
          <span className="section-kicker">{campaign ? 'Refinando playbook' : 'Novo playbook'}</span>
          <h2>{campaign ? 'Editar campanha' : 'Nova campanha'}</h2>
          <p>Configure o contexto comercial que alimenta a Edge Function e deixa a demonstração da IA mais convincente.</p>
        </div>
        {campaign && (
          <button type="button" className="ghost compact" onClick={onCancel}>
            Cancelar edição
          </button>
        )}
      </div>
      <label>
        Nome
        <input name="campaignName" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <span className="field-hint">Use um nome que deixe claro o objetivo da abordagem.</span>
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
      <label className="wide">
        Contexto
        <textarea name="campaignContext" value={form.context_text} onChange={(event) => setForm({ ...form, context_text: event.target.value })} required />
        <span className="field-hint">Descreva rapidamente o cenário, produto e dor comercial que a IA deve considerar.</span>
      </label>
      <label className="wide">
        Prompt de geração
        <textarea
          name="campaignPrompt"
          value={form.generation_prompt}
          onChange={(event) => setForm({ ...form, generation_prompt: event.target.value })}
          required
        />
        <span className="field-hint">Explique o tom, a intenção e o tipo de CTA que a mensagem deve produzir.</span>
      </label>
      <div className="wide">
        <button type="submit">Salvar campanha</button>
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
