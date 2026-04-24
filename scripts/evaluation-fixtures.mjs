export const EVALUATION_MARKER = 'evaluation-seed-v1';

export const EVALUATION_CUSTOM_FIELDS = [
  { name: 'Segmento', field_key: 'segmento', field_type: 'text' },
  { name: 'Porte da empresa', field_key: 'porte_empresa', field_type: 'text' },
  { name: 'Stack comercial', field_key: 'stack_comercial', field_type: 'text' },
  { name: 'Maturidade SDR', field_key: 'maturidade_sdr', field_type: 'text' },
  { name: 'Canal preferencial', field_key: 'canal_preferencial', field_type: 'text' },
  { name: 'Temperatura inicial', field_key: 'temperatura_inicial', field_type: 'text' },
  { name: 'Responsavel interno', field_key: 'responsavel_interno', field_type: 'text' },
];

export const EVALUATION_STAGE_REQUIRED_RULES = [
  ['Lead Mapeado', 'company', null],
  ['Lead Mapeado', 'job_title', null],
  ['Lead Mapeado', 'lead_source', null],
  ['Lead Mapeado', null, 'segmento'],
  ['Conexao Iniciada', 'email', null],
  ['Conexao Iniciada', null, 'canal_preferencial'],
  ['Qualificado', 'phone', null],
  ['Qualificado', 'assigned_user_id', null],
  ['Qualificado', null, 'maturidade_sdr'],
  ['Reuniao Agendada', 'notes', null],
  ['Reuniao Agendada', null, 'stack_comercial'],
];

export const EVALUATION_CAMPAIGN_TEMPLATES = [
  {
    slug: 'outbound-icp-operacoes',
    name: 'Outbound ICP Operacoes e Revenue',
    triggerStage: 'Base',
    channel: 'email',
    context_text:
      'Abordagem consultiva para lideres de operacao comercial e revenue que precisam ganhar previsibilidade, reduzir improviso dos SDRs e organizar cadencias por segmento.',
    generation_prompt:
      'Criar mensagens curtas, humanas e profissionais. Conectar dor operacional com ganho de previsibilidade e terminar com CTA leve para diagnostico.',
    goal: 'Abrir conversa consultiva com leads frios de ICP claro.',
  },
  {
    slug: 'reativacao-pipeline-parado',
    name: 'Reativacao de pipeline parado',
    triggerStage: 'Tentando Contato',
    channel: 'email',
    context_text:
      'Reativacao de leads que ja receberam uma abordagem, mas esfriaram por prioridade interna, timing ruim ou falta de clareza sobre impacto comercial.',
    generation_prompt:
      'Retomar contexto sem insistencia. Usar uma pergunta curta sobre prioridade, gargalo ou proximo passo possivel.',
    goal: 'Reabrir resposta em leads mornos e recuperar timing.',
  },
  {
    slug: 'qualificacao-diagnostico',
    name: 'Qualificacao para diagnostico comercial',
    triggerStage: 'Conexao Iniciada',
    channel: 'whatsapp',
    context_text:
      'Conversa com leads que responderam ou demonstraram interesse e precisam ser qualificados em dor, maturidade do processo, stack e urgencia.',
    generation_prompt:
      'Conduzir qualificacao com tom direto, sem interrogatorio. Fazer uma pergunta por vez e apontar valor pratico.',
    goal: 'Transformar interesse em diagnostico com dados comerciais minimos.',
  },
  {
    slug: 'avanco-reuniao',
    name: 'Avanco para reuniao',
    triggerStage: 'Qualificado',
    channel: 'whatsapp',
    context_text:
      'Convite para reuniao com leads qualificados que ja entendem a dor e precisam de um proximo passo objetivo para avaliar solucao e impacto.',
    generation_prompt:
      'Avancar para reuniao com clareza, confianca e baixa friccao. Sugerir agenda e resumir o que sera analisado.',
    goal: 'Converter lead qualificado em reuniao agendada.',
  },
];

export const EVALUATION_LEAD_IDENTITIES = [
  ['Mariana Costa', 'AtlasLog'],
  ['Rafael Azevedo', 'NexoCargo'],
  ['Bianca Nogueira', 'Clara Saude'],
  ['Thiago Leme', 'Pulsar ERP'],
  ['Paula Martins', 'Aurora Ensino'],
  ['Felipe Barros', 'Nova Farma'],
  ['Camila Duarte', 'Vertice Energia'],
  ['Gustavo Prado', 'MobiFleet'],
  ['Juliana Serra', 'OmniBank'],
  ['Rodrigo Telles', 'Lince Logistica'],
  ['Larissa Mendonca', 'Senda Transportes'],
  ['Bruno Farias', 'Axis Supply'],
  ['Isabela Pires', 'Delta Chain'],
  ['Marcelo Nunes', 'CargoLink'],
  ['Renata Queiroz', 'Prime Route'],
  ['Diego Vasconcelos', 'TrackFlow'],
  ['Natalia Campos', 'Orbita Freight'],
  ['Vinicius Moura', 'Fortex Log'],
  ['Aline Teixeira', 'ViaPorto'],
  ['Eduardo Mattos', 'Vector Cargo'],
  ['Fernanda Rocha', 'GridMove'],
  ['Caio Bernardes', 'FastHaul'],
  ['Tatiane Reis', 'Kargo360'],
  ['Leonardo Afonso', 'Rota Prime'],
  ['Priscila Amaral', 'LogHub'],
  ['Daniel Freitas', 'CoreStack'],
  ['Beatriz Sampaio', 'Synapse CRM'],
  ['Henrique Loureiro', 'Orbit SaaS'],
  ['Luiza Antunes', 'DataFuse'],
  ['Pedro Mello', 'NovaDesk'],
  ['Alice Ribeiro', 'ByteFlow'],
  ['Ricardo Pacheco', 'HiveERP'],
  ['Sofia Goulart', 'OmniTech'],
  ['Matheus Rezende', 'CloudBridge'],
  ['Debora Falcao', 'LeadPilot'],
  ['Gabriel Rios', 'Atlas SaaS'],
  ['Marina Valenca', 'SigmaSoft'],
  ['Andre Silveira', 'Focus ERP'],
  ['Laura Neves', 'Pulse CRM'],
  ['Joao Pimenta', 'LogicDesk'],
  ['Helena Borges', 'StreamCore'],
  ['Renato Cabral', 'DockData'],
  ['Bruna Tavares', 'FlowSuite'],
  ['Cesar Guimaraes', 'SmartLayer'],
  ['Elisa Monteiro', 'BaseCloud'],
  ['Fabio Guedes', 'BeamOps'],
  ['Talita Coelho', 'Nimbi Tech'],
  ['Otavio Brandao', 'K2 Software'],
  ['Vanessa Motta', 'LoopDesk'],
  ['Igor Pacheco', 'Quanta SaaS'],
  ['Patricia Linhares', 'Aurora Ensino'],
  ['Mauro Cezar', 'VidaPlena Saude'],
  ['Carol Furtado', 'Colegio Horizonte'],
  ['Felipe Aragao', 'Clinica Soma'],
  ['Silvia Nascimento', 'EduPrime'],
  ['Andrea Viana', 'MedFocus'],
  ['Danilo Peixoto', 'Instituto Prisma'],
  ['Julia Bastos', 'Cuidar+'],
  ['Marcelo Furtado', 'LearnBridge'],
  ['Roberta Sa', 'Essentia Care'],
  ['Pedro Ottoni', 'UniNorte Digital'],
  ['Isadora Lobo', 'Vitta Saude'],
  ['Alan Menezes', 'Escola Integra'],
  ['Cintia Mota', 'HealthFirst'],
  ['Renan Lisboa', 'Campus Now'],
  ['Mirela Pacheco', 'OdontoPrime'],
  ['Sergio Arruda', 'Alfa Educacao'],
  ['Evelin Torres', 'Nexo Clinicas'],
  ['Rafael Motta', 'Saber+'],
  ['Luciana Prado', 'BemCare'],
  ['Guilherme Neri', 'EduLab'],
  ['Monique Barreto', 'Vida Integral'],
  ['Tiago Carvalho', 'MedSignal'],
  ['Daniela Porto', 'Colegio Vertex'],
  ['Bruno Accioly', 'CarePath'],
  ['Ana Clara Ramos', 'UrbanFit Franquias'],
  ['Thiago Bittencourt', 'Rede Mais Varejo'],
  ['Larissa Figueiredo', 'CredNova'],
  ['Eduardo Siqueira', 'FortePay'],
  ['Flavia Moraes', 'IndusPrime'],
  ['Marcelo Tavares', 'FranqConnect'],
  ['Juliana Paes', 'OmniRetail'],
  ['Roberto Simoes', 'Capital Axis'],
  ['Debora Lins', 'Varejo Sul'],
  ['Vinicius Braga', 'Nexa Finance'],
  ['Amanda Queiroz', 'StoreGrid'],
  ['Leandro Amaral', 'Prisma Capital'],
  ['Aline Barroso', 'Retail One'],
  ['Cesar Tavares', 'Master Franquias'],
  ['Mariana Pacheco', 'CredPoint'],
  ['Rodrigo Leal', 'IndusMax'],
  ['Nathalia Cunha', 'UrbanBox'],
  ['Diego Rocha', 'FinCore'],
  ['Paula Teodoro', 'Fabrica Alpha'],
  ['Gustavo Noronha', 'Retail Hub'],
  ['Elisa Correia', 'Selo Finance'],
  ['Bruno Salgado', 'OmniFranquias'],
  ['Camila Manso', 'Vitta Credito'],
  ['Fernando Reis', 'Industria Sigma'],
  ['Raquel Telles', 'Loja Forte'],
];

export function normalizeStageName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function safeSlug(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function segmentForIndex(index) {
  if (index < 25) return 'Logistica e Supply Chain';
  if (index < 50) return 'SaaS B2B e Tecnologia';
  if (index < 75) return 'Saude e Educacao';
  return 'Varejo, Franquias, Financas e Industria';
}

function defaultStageForIndex(index) {
  if (index < 25) return 'Base';
  if (index < 40) return 'Lead Mapeado';
  if (index < 60) return 'Tentando Contato';
  if (index < 75) return 'Conexao Iniciada';
  if (index < 85) return 'Qualificado';
  if (index < 90) return 'Reuniao Agendada';
  return 'Desqualificado';
}

function leadSourceForIndex(index) {
  const sources = [
    'Lista ICP 2026',
    'LinkedIn Sales Navigator',
    'Webinar de geracao de pipeline',
    'Indicacao de cliente',
    'Evento comercial B2B',
    'Inbound organico',
  ];
  return sources[index % sources.length];
}

function jobTitleForIndex(index) {
  const titles = [
    'Head de Revenue Operations',
    'Gerente de SDR',
    'Diretora Comercial',
    'Coordenador de Pre-vendas',
    'Sales Ops Manager',
    'Gerente de Crescimento',
    'Head de Vendas',
    'Lider de Desenvolvimento de Negocios',
  ];
  return titles[index % titles.length];
}

export function buildEvaluationLeadProfile(index, name, company, overrides = {}) {
  const segmento = segmentForIndex(index);
  const maturidades = ['Estruturando SDR', 'Time em expansao', 'Operacao madura', 'Playbook em revisao', 'Sem cadencia formal'];
  const stacks = ['HubSpot + Apollo', 'Pipedrive + WhatsApp', 'Salesforce + Outreach', 'CRM proprio + planilhas', 'RD Station + Ramper'];
  const portes = ['51-100 colaboradores', '101-200 colaboradores', '201-500 colaboradores', '501-1000 colaboradores', '1001+ colaboradores'];
  const temperaturas = ['frio', 'morno', 'interessado', 'positivo', 'objecao ativa'];
  const canais = ['email', 'whatsapp', 'linkedin'];
  const technicalOwners = ['Alvaro Martins', 'Marina Costa', 'Lucas Prado', 'Fernanda Lima', 'Caio Torres'];
  const emailDomain = `${safeSlug(company)}.com.br`;
  const phoneSuffix = String(11000000 + index * 7391).slice(-8);

  const profile = {
    slug: safeSlug(`${name}-${company}`),
    name,
    company,
    email: `${safeSlug(name).replace(/-/g, '.')}@${emailDomain}`,
    phone: index % 7 === 0 ? null : `11${phoneSuffix}`,
    job_title: jobTitleForIndex(index),
    lead_source: leadSourceForIndex(index),
    notes: `${EVALUATION_MARKER} ${company} tem sinais de dor em cadencia, visibilidade de pipeline e padronizacao da abordagem SDR.`,
    technical_owner_name: index % 6 === 0 ? null : technicalOwners[index % technicalOwners.length],
    segmento,
    porte_empresa: portes[index % portes.length],
    stack_comercial: stacks[index % stacks.length],
    maturidade_sdr: maturidades[index % maturidades.length],
    canal_preferencial: canais[index % canais.length],
    temperatura_inicial: temperaturas[index % temperaturas.length],
    responsavel_interno: ['Alvaro Martins', 'SDR Expert IA', 'Operacao Comercial'][index % 3],
    stageName: defaultStageForIndex(index),
    createdAt: isoHoursAgo(220 - index),
  };

  return { ...profile, ...overrides };
}

export function getEvaluationLeadProfiles() {
  return EVALUATION_LEAD_IDENTITIES.map(([name, company], index) => buildEvaluationLeadProfile(index, name, company));
}

export function getSmokeLeadProfiles() {
  return [
    buildEvaluationLeadProfile(0, 'Mariana Costa', 'AtlasLog', {
      stageName: 'Base',
      notes: `${EVALUATION_MARKER} Lead de exemplo para validar abertura do funil e navegacao inicial.`,
    }),
    buildEvaluationLeadProfile(1, 'Rafael Azevedo', 'NexoCargo', {
      stageName: 'Tentando Contato',
      notes: `${EVALUATION_MARKER} Lead de exemplo com primeira abordagem ja enviada.`,
    }),
    buildEvaluationLeadProfile(2, 'Bianca Nogueira', 'Clara Saude', {
      stageName: 'Conexao Iniciada',
      notes: `${EVALUATION_MARKER} Lead de exemplo com resposta inicial do cliente para demonstracao.`,
    }),
  ];
}

export function getSmokeCampaignTemplate() {
  return {
    slug: 'campanha-avaliacao-basica',
    name: 'Campanha de exemplo para avaliacao',
    triggerStage: 'Base',
    channel: 'whatsapp',
    context_text:
      'Campanha fixa e deterministica para permitir que o avaliador navegue pelo fluxo principal sem depender de IA ou criacao manual de dados.',
    generation_prompt:
      'Nao usar IA. Este texto existe apenas para deixar a campanha consistente na interface de avaliacao.',
    goal: 'Deixar o workspace pronto para uma demonstracao funcional minima.',
  };
}
