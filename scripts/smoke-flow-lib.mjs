export const SMOKE_SCENARIOS = [
  {
    key: 'opening_no_response',
    label: 'Abertura sem resposta',
    weight: 20,
    campaignSlug: 'outbound-icp-operacoes',
    resultStageName: 'Tentando Contato',
    threadStatus: 'open',
    threadSentiment: 'neutral',
    description:
      'Lead recebeu a primeira abordagem consultiva e ainda nao respondeu. O objetivo e deixar o dashboard com volume real de contatos aguardando retorno.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Abrir contato de forma objetiva, conectando a dor comercial do lead com previsibilidade, cadencia e visibilidade do pipeline.',
      },
    ],
  },
  {
    key: 'secondary_follow_up_no_response',
    label: 'Abertura e abordagem secundaria sem resposta',
    weight: 20,
    campaignSlug: 'reativacao-pipeline-parado',
    resultStageName: 'Tentando Contato',
    threadStatus: 'open',
    threadSentiment: 'neutral',
    description:
      'Lead ja recebeu a abertura e depois um follow-up secundario amigavel, ainda sem resposta. Serve para provar cadencia sem duplicar abordagens frias.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Primeira mensagem curta e consultiva para iniciar a conversa sem excesso de contexto.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'secondary_follow_up',
        intentTag: 'secondary_follow_up',
        guidance:
          'Retomar a mensagem anterior de modo leve, amigavel e profissional. Nao pode soar como nova abordagem fria.',
      },
    ],
  },
  {
    key: 'negative_closed',
    label: 'Recusa com encerramento',
    weight: 18,
    campaignSlug: 'reativacao-pipeline-parado',
    resultStageName: 'Desqualificado',
    threadStatus: 'closed',
    threadSentiment: 'negative',
    description:
      'Lead respondeu que agora nao faz sentido seguir e a IA encerrou com educacao. O thread deve terminar fechado e o lead deve estar desqualificado.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Abrir a conversa com contexto enxuto e proposta de valor objetiva.',
      },
      {
        direction: 'inbound',
        intentTag: 'objection_no_priority',
        expectedSentiment: 'negative',
        guidance:
          'Responder como cliente recusando com clareza, citando falta de prioridade, timing ou foco em outras demandas.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'closing_note',
        intentTag: 'closing_note',
        guidance:
          'Encerrar com elegancia, reconhecer o momento do cliente e deixar a porta aberta sem insistencia.',
      },
    ],
  },
  {
    key: 'interested_follow_up',
    label: 'Interesse com qualificacao em andamento',
    weight: 18,
    campaignSlug: 'qualificacao-diagnostico',
    resultStageName: 'Conexao Iniciada',
    threadStatus: 'positive',
    threadSentiment: 'positive',
    description:
      'Lead respondeu com interesse inicial e a IA conduziu a conversa para qualificacao sem parecer interrogatorio.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Iniciar contato relacionando a dor operacional com o beneficio comercial.',
      },
      {
        direction: 'inbound',
        intentTag: 'interested_needs_context',
        expectedSentiment: 'positive',
        guidance:
          'Responder como cliente interessado, pedindo mais contexto, exemplo pratico ou detalhamento do impacto.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'qualification_follow_up',
        intentTag: 'qualification_follow_up',
        guidance:
          'Avancar a qualificacao com uma pergunta objetiva, conectada ao que o cliente acabou de dizer.',
      },
    ],
  },
  {
    key: 'qualified_multi_touch',
    label: 'Qualificacao com proximo passo aberto',
    weight: 14,
    campaignSlug: 'qualificacao-diagnostico',
    resultStageName: 'Qualificado',
    threadStatus: 'positive',
    threadSentiment: 'positive',
    description:
      'Lead trocou duas mensagens relevantes, deu contexto adicional e ficou qualificado para o proximo passo comercial.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Abrir a conversa de forma consultiva, com foco em diagnostico comercial.',
      },
      {
        direction: 'inbound',
        intentTag: 'context_sharing',
        expectedSentiment: 'neutral',
        guidance:
          'Responder como cliente compartilhando contexto real da operacao, gargalo ou meta, sem ainda aceitar reuniao.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'qualification_follow_up',
        intentTag: 'qualification_follow_up',
        guidance:
          'Aprofundar a qualificacao com pergunta curta e valor pratico.',
      },
      {
        direction: 'inbound',
        intentTag: 'qualified_signal',
        expectedSentiment: 'positive',
        guidance:
          'Responder como cliente sinalizando que faz sentido continuar, mas sem confirmar agenda ainda.',
      },
    ],
  },
  {
    key: 'meeting_confirmed',
    label: 'Reuniao encaminhada',
    weight: 10,
    campaignSlug: 'avanco-reuniao',
    resultStageName: 'Reuniao Agendada',
    threadStatus: 'meeting_scheduled',
    threadSentiment: 'positive',
    description:
      'Lead respondeu positivamente, a IA conduziu o avanco e terminou com confirmacao de reuniao.',
    sequence: [
      {
        direction: 'outbound',
        promptPurpose: 'opening',
        intentTag: 'opening_outreach',
        guidance:
          'Iniciar o contato com contexto forte e CTA leve para conversa.',
      },
      {
        direction: 'inbound',
        intentTag: 'positive_reply',
        expectedSentiment: 'positive',
        guidance:
          'Responder como cliente aberto a conversar e entender o diagnostico.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'qualification_follow_up',
        intentTag: 'qualification_follow_up',
        guidance:
          'Conduzir a conversa para o proximo passo, mostrando o que sera tratado.',
      },
      {
        direction: 'inbound',
        intentTag: 'meeting_acceptance',
        expectedSentiment: 'positive',
        guidance:
          'Responder como cliente aceitando seguir com reuniao, horario ou proximo passo.',
      },
      {
        direction: 'outbound',
        promptPurpose: 'meeting_confirmation',
        intentTag: 'meeting_confirmation',
        guidance:
          'Confirmar a reuniao com objetividade, resumindo o que sera avaliado.',
      },
    ],
  },
];

export function getSmokeScenarios(mode = 'all') {
  if (mode === '1') {
    return SMOKE_SCENARIOS.filter((scenario) =>
      ['opening_no_response', 'secondary_follow_up_no_response'].includes(scenario.key),
    );
  }

  if (mode === '2') {
    return SMOKE_SCENARIOS.filter((scenario) =>
      ['negative_closed', 'interested_follow_up', 'qualified_multi_touch', 'meeting_confirmed'].includes(scenario.key),
    );
  }

  return SMOKE_SCENARIOS;
}

export function getSmokeScenarioByKey(key) {
  const scenario = SMOKE_SCENARIOS.find((item) => item.key === key);
  if (!scenario) {
    throw new Error(`Cenario de smoke desconhecido: ${key}`);
  }

  return scenario;
}

function distributeScenarioCounts(limit, scenarios) {
  if (limit <= 0) return [];

  const totalWeight = scenarios.reduce((sum, scenario) => sum + scenario.weight, 0);
  const base = scenarios.map((scenario) => {
    const exact = (limit * scenario.weight) / totalWeight;
    const count = Math.floor(exact);
    return {
      key: scenario.key,
      count,
      remainder: exact - count,
    };
  });

  let assigned = base.reduce((sum, item) => sum + item.count, 0);
  const byRemainder = [...base].sort((left, right) => right.remainder - left.remainder);
  let pointer = 0;

  while (assigned < limit && byRemainder.length > 0) {
    byRemainder[pointer % byRemainder.length].count += 1;
    assigned += 1;
    pointer += 1;
  }

  return base;
}

export function buildSmokeAssignments(limit, mode = 'all') {
  const scenarios = getSmokeScenarios(mode);
  const counts = distributeScenarioCounts(limit, scenarios);
  const queue = counts.map((entry) => ({ ...entry }));
  const assignments = [];

  while (assignments.length < limit) {
    let pushedInRound = false;

    for (const entry of queue) {
      if (entry.count <= 0) continue;
      assignments.push(entry.key);
      entry.count -= 1;
      pushedInRound = true;
      if (assignments.length === limit) break;
    }

    if (!pushedInRound) break;
  }

  return assignments;
}

export function getSmokeExpectedMetrics(assignments) {
  return assignments.reduce(
    (summary, key) => {
      const scenario = getSmokeScenarioByKey(key);
      const outboundCount = scenario.sequence.filter((step) => step.direction === 'outbound').length;
      const inboundCount = scenario.sequence.filter((step) => step.direction === 'inbound').length;

      summary.threads += 1;
      summary.outboundMessages += outboundCount;
      summary.inboundMessages += inboundCount;
      summary.conversationMessages += outboundCount + inboundCount;
      summary.generatedMessages += outboundCount;
      summary.sentMessageEvents += outboundCount + inboundCount;
      summary.byScenario[scenario.key] = (summary.byScenario[scenario.key] ?? 0) + 1;
      return summary;
    },
    {
      threads: 0,
      outboundMessages: 0,
      inboundMessages: 0,
      generatedMessages: 0,
      sentMessageEvents: 0,
      conversationMessages: 0,
      byScenario: {},
    },
  );
}

export function validateScenarioConversation(messages, scenarioKey) {
  const scenario = getSmokeScenarioByKey(scenarioKey);

  if (messages.length !== scenario.sequence.length) {
    throw new Error(
      `Cenario ${scenario.key} retornou ${messages.length} mensagens, mas o esperado era ${scenario.sequence.length}.`,
    );
  }

  scenario.sequence.forEach((step, index) => {
    const message = messages[index];
    if (!message) {
      throw new Error(`Mensagem ${index + 1} ausente no cenario ${scenario.key}.`);
    }
    if (message.direction !== step.direction) {
      throw new Error(
        `Cenario ${scenario.key} retornou direcao invalida na mensagem ${index + 1}: ${message.direction} em vez de ${step.direction}.`,
      );
    }
    if (!message.message_text?.trim()) {
      throw new Error(`Cenario ${scenario.key} retornou texto vazio na mensagem ${index + 1}.`);
    }
    if (
      step.direction === 'outbound' &&
      step.promptPurpose &&
      message.prompt_purpose != null &&
      message.prompt_purpose !== step.promptPurpose
    ) {
      throw new Error(
        `Cenario ${scenario.key} retornou prompt_purpose invalido na mensagem ${index + 1}: ${message.prompt_purpose} em vez de ${step.promptPurpose}.`,
      );
    }
  });
}

export function validateScenarioThreadSummary(threadSummary, scenarioKey) {
  const scenario = getSmokeScenarioByKey(scenarioKey);

  if (threadSummary.threadStatus !== scenario.threadStatus) {
    throw new Error(
      `Thread ${threadSummary.threadId} recebeu status ${threadSummary.threadStatus}, esperado ${scenario.threadStatus}.`,
    );
  }

  if (threadSummary.threadSentiment !== scenario.threadSentiment) {
    throw new Error(
      `Thread ${threadSummary.threadId} recebeu sentimento ${threadSummary.threadSentiment}, esperado ${scenario.threadSentiment}.`,
    );
  }

  if (threadSummary.leadStageName !== scenario.resultStageName) {
    throw new Error(
      `Lead ${threadSummary.leadName} terminou em ${threadSummary.leadStageName}, esperado ${scenario.resultStageName}.`,
    );
  }
}
