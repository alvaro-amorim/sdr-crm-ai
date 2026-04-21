import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  Bot,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Megaphone,
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

function AuthScreen({ authError }: { authError?: string | null }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(authError ?? null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setError(authError ?? null);
  }, [authError]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
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
          <label htmlFor="password">
            Senha
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
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
        <label htmlFor="newPassword">
          Nova senha
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
        <label htmlFor="confirmNewPassword">
          Confirmar senha
          <input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>
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
  return (
    <div className={error ? 'status error-box' : 'status success-box'}>
      <span>{error ?? notice}</span>
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
      <Kanban data={data} onEdit={setEditingLead} onMove={handleMove} />
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
    <form className="panel form-grid" onSubmit={submit}>
      <div className="form-heading">
        <h2>{lead ? 'Editar lead' : 'Novo lead'}</h2>
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
  onEdit,
  onMove,
}: {
  data: CrmData;
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
              <h3>{stage.name}</h3>
              <span>{leads.length}</span>
            </header>
            {leads.length === 0 && <p className="empty">Sem leads nesta etapa.</p>}
            {leads.map((lead) => (
              <article className="lead-card" key={lead.id}>
                <strong>{lead.name}</strong>
                <span>{lead.company || 'Empresa não informada'}</span>
                <small>{lead.email || lead.phone || 'Contato pendente'}</small>
                <div className="card-actions">
                  <button type="button" className="ghost compact" onClick={() => onEdit(lead)}>
                    Editar
                  </button>
                  <select
                    name={`lead-stage-${lead.id}`}
                    value={lead.current_stage_id}
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
            ))}
          </div>
        );
      })}
    </section>
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
      <form className="panel inline-form" onSubmit={createCustomField}>
        <label>
          Nome do campo
          <input name="customFieldName" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Tipo
          <select name="customFieldType" value={type} onChange={(event) => setType(event.target.value as 'text' | 'number')}>
            <option value="text">Texto</option>
            <option value="number">Número</option>
          </select>
        </label>
        <button type="submit">Criar campo</button>
      </form>
      <section className="panel">
        <h2>Campos personalizados</h2>
        {data.customFields.length === 0 ? (
          <p className="empty">Nenhum campo personalizado criado.</p>
        ) : (
          <div className="table-list">
            {data.customFields.map((field) => (
              <div key={field.id}>
                <strong>{field.name}</strong>
                <span>{field.field_key}</span>
                <span>{field.field_type}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <RequiredFieldsPanel data={data} onReload={onReload} setError={setError} setNotice={setNotice} />
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
    <form className="panel" onSubmit={submit}>
      <h2>Campos obrigatórios por etapa</h2>
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
