export const APP_TABS = ['dashboard', 'leads', 'fields', 'campaigns', 'messages'] as const;

export type AppTab = (typeof APP_TABS)[number];

export function isEvaluationPanelEnabled(flag: boolean, hostname: string): boolean {
  return flag || hostname === 'localhost' || hostname === '127.0.0.1';
}

export function parseAppNavigation(search: string): { tab: AppTab; workspaceId: string | null } {
  const params = new URLSearchParams(search);
  const tabParam = params.get('tab');
  const workspaceId = params.get('workspace');
  const tab = APP_TABS.includes(tabParam as AppTab) ? (tabParam as AppTab) : 'dashboard';

  return {
    tab,
    workspaceId: workspaceId?.trim() || null,
  };
}

export function buildEvaluationAppUrl(origin: string, workspaceId: string | null, tab: AppTab): string {
  const url = new URL('/', origin);
  url.searchParams.set('tab', tab);
  if (workspaceId) {
    url.searchParams.set('workspace', workspaceId);
  }
  return url.toString();
}
