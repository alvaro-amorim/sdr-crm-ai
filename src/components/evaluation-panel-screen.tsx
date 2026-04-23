import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, Beaker, Bot, LayoutDashboard, Mail, Megaphone, RefreshCcw, RotateCcw, Rows3, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  loadEvaluationStatus,
  prepareEvaluationScenario,
  resetEvaluationScenario,
  seedEvaluationCampaign,
  seedEvaluationLeads,
  type EvaluationStatus,
} from '../services/evaluation';
import { buildEvaluationAppUrl } from '../utils/evaluation-panel';
import { getErrorMessage } from '../utils/error-messages';

type EvaluationAction = 'leads' | 'campaign' | 'scenario' | 'reset' | null;

const emptyStatus: EvaluationStatus = {
  workspace: null,
  leads: 0,
  campaigns: 0,
  threads: 0,
  messages: 0,
  simulationTokens: 0,
  simulatorUrl: null,
};

export function EvaluationPanelScreen({ user }: { user: User }) {
  const simulatorStorageKey = `sdr-evaluation-simulator-link:${user.id}`;
  const [status, setStatus] = useState<EvaluationStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<EvaluationAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shortcuts = useMemo(() => {
    const workspaceId = status.workspace?.id ?? null;
    const origin = window.location.origin;

    return {
      dashboard: buildEvaluationAppUrl(origin, workspaceId, 'dashboard'),
      leads: buildEvaluationAppUrl(origin, workspaceId, 'leads'),
      campaigns: buildEvaluationAppUrl(origin, workspaceId, 'campaigns'),
      messages: buildEvaluationAppUrl(origin, workspaceId, 'messages'),
    };
  }, [status.workspace?.id]);

  const refreshStatus = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      const nextStatus = await loadEvaluationStatus(supabase);
      const storedSimulatorUrl = window.localStorage.getItem(simulatorStorageKey);
      setStatus({
        ...nextStatus,
        simulatorUrl: nextStatus.simulationTokens > 0 ? storedSimulatorUrl ?? null : null,
      });

      if (nextStatus.simulationTokens === 0 && storedSimulatorUrl) {
        window.localStorage.removeItem(simulatorStorageKey);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'workspace'));
    } finally {
      setLoading(false);
    }
  }, [simulatorStorageKey]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function runAction(action: EvaluationAction, successMessage: string, executor: () => Promise<EvaluationStatus>) {
    if (!supabase || !action) return;
    setBusyAction(action);
    setNotice(null);
    setError(null);

    try {
      const result = await executor();
      if (result.simulatorUrl) {
        window.localStorage.setItem(simulatorStorageKey, result.simulatorUrl);
      } else if (result.simulationTokens === 0 || action === 'reset') {
        window.localStorage.removeItem(simulatorStorageKey);
      }
      setStatus(result);
      setNotice(successMessage);
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'workspace'));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReset() {
    if (!window.confirm('Isso limpará apenas o workspace auxiliar de avaliação técnica. Deseja continuar?')) {
      return;
    }

    await runAction('reset', 'Dados auxiliares de avaliação resetados com sucesso.', () => resetEvaluationScenario(supabase!));
  }

  return (
    <main className="evaluation-screen">
      <section className="evaluation-shell">
        <header className="evaluation-hero">
          <div className="evaluation-hero-copy">
            <span className="section-kicker">Painel auxiliar de avaliação técnica</span>
            <h1>Ferramenta isolada para preparar a demonstração com dados determinísticos</h1>
            <p>
              Esta interface existe apenas para acelerar a validação funcional do sistema e não compõe o fluxo normal do produto.
            </p>
            <div className="evaluation-chip-row">
              <span className="evaluation-chip">Sem IA</span>
              <span className="evaluation-chip">Dados reproduzíveis</span>
              <span className="evaluation-chip">Workspace isolado</span>
            </div>
          </div>

          <aside className="evaluation-hero-card">
            <span className="section-kicker">Uso do avaliador</span>
            <strong>1 clique para preparar o ambiente</strong>
            <p>Gere leads, campanha, conversa seeded e atalhos diretos para Dashboard, Leads, Campanhas e Mensagens IA.</p>
            <a className="evaluation-link" href={shortcuts.dashboard} target="_blank" rel="noreferrer">
              Abrir app principal
              <ArrowUpRight aria-hidden />
            </a>
          </aside>
        </header>

        {(notice || error) && (
          <section className={error ? 'evaluation-banner evaluation-banner-error' : 'evaluation-banner'}>
            <strong>{error ? 'Ação não concluída' : 'Ação concluída'}</strong>
            <p>{error ?? notice}</p>
          </section>
        )}

        <section className="evaluation-grid">
          <article className="evaluation-status-card evaluation-status-card-wide">
            <div className="evaluation-card-topline">
              <span className="section-kicker">Workspace auxiliar</span>
              <Beaker aria-hidden />
            </div>
            <strong>{status.workspace?.name ?? 'Workspace de avaliação ainda não criado'}</strong>
            <p>
              {status.workspace
                ? `ID interno: ${status.workspace.id}`
                : 'As ações abaixo criam o workspace técnico dedicado automaticamente, sem tocar no workspace principal.'}
            </p>
          </article>

          <article className="evaluation-status-card">
            <div className="evaluation-card-topline">
              <span className="section-kicker">Leads seeded</span>
              <Rows3 aria-hidden />
            </div>
            <strong>{loading ? '...' : status.leads}</strong>
            <p>Volume fixo para demonstrar cadastro, funil e leitura operacional.</p>
          </article>

          <article className="evaluation-status-card">
            <div className="evaluation-card-topline">
              <span className="section-kicker">Campanhas</span>
              <Megaphone aria-hidden />
            </div>
            <strong>{loading ? '...' : status.campaigns}</strong>
            <p>Campanha determinística pronta para leitura e navegação da estratégia.</p>
          </article>

          <article className="evaluation-status-card">
            <div className="evaluation-card-topline">
              <span className="section-kicker">Conversa seeded</span>
              <Mail aria-hidden />
            </div>
            <strong>{loading ? '...' : status.messages}</strong>
            <p>Mensagens e thread prontas para o avaliador abrir o simulador e validar o fluxo.</p>
          </article>
        </section>

        <section className="panel evaluation-actions-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Ações determinísticas</span>
              <h2>Prepare o cenário de avaliação sem cadastro manual</h2>
            </div>
            <button type="button" className="ghost compact" onClick={() => void refreshStatus()} disabled={loading || busyAction !== null}>
              <RefreshCcw aria-hidden className={loading ? 'spin' : undefined} />
              Atualizar status
            </button>
          </div>

          <div className="evaluation-action-grid">
            <button
              type="button"
              onClick={() =>
                void runAction('leads', 'Leads de exemplo gerados no workspace auxiliar.', () => seedEvaluationLeads(supabase!, user))
              }
              disabled={busyAction !== null}
            >
              <Rows3 aria-hidden />
              {busyAction === 'leads' ? 'Gerando leads...' : 'Gerar leads de exemplo'}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                void runAction('campaign', 'Campanha fixa criada no workspace auxiliar.', () => seedEvaluationCampaign(supabase!, user))
              }
              disabled={busyAction !== null}
            >
              <Megaphone aria-hidden />
              {busyAction === 'campaign' ? 'Criando campanha...' : 'Criar campanha de exemplo'}
            </button>

            <button
              type="button"
              onClick={() =>
                void runAction('scenario', 'Cenário básico de avaliação preparado com sucesso.', () =>
                  prepareEvaluationScenario(supabase!, user, window.location.origin),
                )
              }
              disabled={busyAction !== null}
            >
              <Sparkles aria-hidden />
              {busyAction === 'scenario' ? 'Preparando cenário...' : 'Popular cenário básico de avaliação'}
            </button>

            <button type="button" className="ghost" onClick={() => void handleReset()} disabled={busyAction !== null}>
              <RotateCcw aria-hidden />
              {busyAction === 'reset' ? 'Resetando...' : 'Resetar dados de avaliação'}
            </button>
          </div>
        </section>

        <section className="evaluation-shortcuts-grid">
          <article className="panel evaluation-shortcut-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Atalhos limpos</span>
                <h2>Abrir rapidamente as áreas principais do app</h2>
              </div>
              <LayoutDashboard aria-hidden />
            </div>

            <div className="evaluation-shortcut-links">
              <a href={shortcuts.dashboard} target="_blank" rel="noreferrer">
                Dashboard
                <ArrowUpRight aria-hidden />
              </a>
              <a href={shortcuts.leads} target="_blank" rel="noreferrer">
                Leads
                <ArrowUpRight aria-hidden />
              </a>
              <a href={shortcuts.campaigns} target="_blank" rel="noreferrer">
                Campanhas
                <ArrowUpRight aria-hidden />
              </a>
              <a href={shortcuts.messages} target="_blank" rel="noreferrer">
                Mensagens IA
                <ArrowUpRight aria-hidden />
              </a>
            </div>
          </article>

          <article className="panel evaluation-shortcut-panel evaluation-shortcut-panel-emphasis">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">Fluxo crítico</span>
                <h2>Simulador do cliente</h2>
              </div>
              <Bot aria-hidden />
            </div>

            <p>
              O cenário básico deixa uma conversa seeded pronta para o avaliador validar envio, histórico e simulador sem depender de IA.
            </p>

            {status.simulatorUrl ? (
              <a className="evaluation-link evaluation-link-primary" href={status.simulatorUrl} target="_blank" rel="noreferrer">
                Abrir simulador seeded
                <ArrowUpRight aria-hidden />
              </a>
            ) : (
              <p className="evaluation-inline-note">
                Primeiro use <strong>Popular cenário básico de avaliação</strong> para gerar o link direto do simulador.
              </p>
            )}
          </article>
        </section>
      </section>
    </main>
  );
}
