import type {
  AnalyticsBreakdownsResponse,
  AnalyticsOverview,
  CalendarDaySummary,
  EquityCurveResponse,
  Platform,
  SyncStatus,
  TradeDirection,
  TradeSource,
} from '@trackdailytrade/shared';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api';

export interface AccountDto {
  id: string;
  name: string;
  broker: string | null;
  platform: Platform;
  accountNumber: string;
  currency: string;
  initialBalance: string;
  brokerTimezone: string;
  displayTimezone: string;
  tradeCount: number;
  netPnl: string;
  currentEquity: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
  tradeCount?: number;
  createdAt?: string;
}

export interface TradeDto {
  id: string;
  accountId: string;
  accountName: string;
  accountCurrency: string;
  platform: Platform;
  externalId: string;
  symbol: string;
  direction: TradeDirection;
  volume: string;
  openTime: string;
  closeTime: string;
  holdingSeconds: number;
  openPrice: string;
  closePrice: string;
  stopLoss: string | null;
  takeProfit: string | null;
  initialStopLoss: string | null;
  initialRiskAmount: string | null;
  rMultiple: string | null;
  isManualRisk: boolean;
  grossPnl: string;
  commission: string;
  swap: string;
  netPnl: string;
  note: string | null;
  source: TradeSource;
  tags: TagDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TradesListResponse {
  items: TradeDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SyncLogDto {
  id: string;
  accountId: string;
  source: TradeSource;
  status: SyncStatus;
  fileName: string | null;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorMessage: string | null;
  createdAt: string;
  account?: {
    id: string;
    name: string;
    accountNumber: string;
    platform: Platform;
  };
}

export interface ImportResultDto {
  dryRun: boolean;
  accountId: string;
  source: TradeSource;
  status: SyncStatus;
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  warnings: string[];
  syncLogId?: string;
  preview?: Array<{
    externalId: string;
    symbol: string;
    direction: string;
    volume: string;
    openTime: string;
    closeTime: string;
    openPrice: string;
    closePrice: string;
    netPnl: string;
    action: 'INSERT' | 'UPDATE';
  }>;
}

export interface GlobalFilterParams {
  accountId?: string;
  from?: string;
  to?: string;
  symbol?: string;
  direction?: TradeDirection;
  tagIds?: string[];
  timezone?: string;
}

function buildQuery(params: Record<string, string | number | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length > 0) qs.set(k, v.join(','));
    } else {
      qs.set(k, String(v));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (typeof errBody?.message === 'string') {
        message = errBody.message;
      } else if (Array.isArray(errBody?.message)) {
        message = errBody.message.join(', ');
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export interface SoloPositionDto {
  id: string;
  side: TradeDirection;
  lots: string;
  entryPrice: string;
  stopLoss: string | null;
  takeProfit: string | null;
  openTime: string;
  exitPrice: string | null;
  closeTime: string | null;
  closeReason: string | null;
  netPnl: string;
}

export interface SoloParticipantDto {
  id: string;
  displayName: string;
  role: 'HOST' | 'GUEST';
  netPnl: string;
  roiPct: number;
  equity: string;
  floatingPnl: string;
  freeMargin: string;
  tradeCount: number;
  winRate: number;
  maxDrawdownPct: number;
  curve: Array<{ unixTime: number; roiPct: number }>;
  positions: SoloPositionDto[];
}

export interface SoloScoreboardDto {
  code: string;
  title: string | null;
  status: 'WAITING' | 'ACTIVE' | 'COMPLETED';
  durationMinutes: number;
  startTime: string | null;
  endTime: string | null;
  serverTime: string;
  price: string;
  startingCapital: string;
  stakeAmount: string;
  stakeUnit: string;
  winnerId: string | null;
  leaderId: string | null;
  youId: string | null;
  participants: SoloParticipantDto[];
}

export interface SoloListItemDto {
  code: string;
  title: string | null;
  status: SoloScoreboardDto['status'];
  startTime: string | null;
  endTime: string | null;
  startingCapital: string;
  stakeAmount: string;
  stakeUnit: string;
  winnerId: string | null;
  participants: Array<{ id: string; displayName: string; role: 'HOST' | 'GUEST'; finalRoiPct: string | null }>;
}

// Token người chơi lưu trong trình duyệt theo mã phòng (không có đăng nhập).
// ponytail: mất token (xoá dữ liệu trình duyệt) = mất quyền đặt lệnh phòng đó; thêm đăng nhập khi mở ra ngoài bạn bè.
export const soloToken = {
  get: (code: string) => {
    try {
      return localStorage.getItem(`solo:${code}`) ?? undefined;
    } catch {
      return undefined;
    }
  },
  set: (code: string, token: string) => {
    try {
      localStorage.setItem(`solo:${code}`, token);
    } catch {
      // bỏ qua: trình duyệt chặn storage
    }
  },
};

const soloPath = (code: string) => `/solo/${encodeURIComponent(code)}`;
const soloHeaders = (code: string): HeadersInit => {
  const t = soloToken.get(code);
  return t ? { 'x-solo-token': t } : {};
};

export const api = {
  // Solo 1v1 vàng
  getSoloList: () => apiFetch<SoloListItemDto[]>('/solo'),
  createSolo: (body: {
    title?: string;
    hostName: string;
    durationMinutes: number;
    startingCapital: string;
    stakeAmount: string;
    stakeUnit: string;
  }) => apiFetch<{ code: string; token: string }>('/solo', { method: 'POST', body: JSON.stringify(body) }),
  getSolo: (code: string) => apiFetch<SoloScoreboardDto>(soloPath(code), { headers: soloHeaders(code) }),
  joinSolo: (code: string, body: { displayName: string }) =>
    apiFetch<{ code: string; token: string }>(`${soloPath(code)}/join`, { method: 'POST', body: JSON.stringify(body) }),
  soloOrder: (code: string, body: { side: TradeDirection; lots: string; stopLoss?: string; takeProfit?: string }) =>
    apiFetch<SoloScoreboardDto>(`${soloPath(code)}/orders`, {
      method: 'POST',
      headers: soloHeaders(code),
      body: JSON.stringify(body),
    }),
  soloClose: (code: string, positionId: string) =>
    apiFetch<SoloScoreboardDto>(`${soloPath(code)}/positions/${encodeURIComponent(positionId)}/close`, {
      method: 'POST',
      headers: soloHeaders(code),
    }),
  cancelSolo: (code: string) =>
    apiFetch<{ deleted: boolean }>(soloPath(code), { method: 'DELETE', headers: soloHeaders(code) }),

  // Accounts
  getAccounts: () => apiFetch<AccountDto[]>('/accounts'),
  createAccount: (body: {
    name: string;
    broker?: string | null;
    platform?: Platform;
    accountNumber: string;
    currency?: string;
    initialBalance?: string;
    brokerTimezone?: string;
    displayTimezone?: string;
  }) => apiFetch<AccountDto>('/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAccount: (
    id: string,
    body: Partial<{
      name: string;
      broker: string | null;
      accountNumber: string;
      currency: string;
      initialBalance: string;
      brokerTimezone: string;
      displayTimezone: string;
    }>,
  ) => apiFetch<AccountDto>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAccount: (id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/accounts/${id}`, { method: 'DELETE' }),

  // Tags
  getTags: () => apiFetch<TagDto[]>('/tags'),
  createTag: (body: { name: string; color: string }) =>
    apiFetch<TagDto>('/tags', { method: 'POST', body: JSON.stringify(body) }),
  updateTag: (id: string, body: { name?: string; color?: string }) =>
    apiFetch<TagDto>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTag: (id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/tags/${id}`, { method: 'DELETE' }),

  // Trades
  getTrades: (params: GlobalFilterParams & { search?: string; page?: number; limit?: number }) =>
    apiFetch<TradesListResponse>(
      `/trades${buildQuery({
        accountId: params.accountId,
        from: params.from,
        to: params.to,
        symbol: params.symbol,
        direction: params.direction,
        tagIds: params.tagIds,
        search: params.search,
        page: params.page,
        limit: params.limit,
      })}`,
    ),
  getSymbols: (accountId?: string) =>
    apiFetch<string[]>(`/trades/symbols${buildQuery({ accountId })}`),
  getTrade: (id: string) => apiFetch<TradeDto>(`/trades/${id}`),
  updateTradeJournal: (
    id: string,
    body: {
      note?: string | null;
      tagIds?: string[];
      initialStopLoss?: string | null;
      initialRiskAmount?: string | null;
    },
  ) => apiFetch<TradeDto>(`/trades/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTrade: (id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/trades/${id}`, { method: 'DELETE' }),

  // Imports & Logs
  importMt5Statement: (params: {
    file: File;
    accountId: string;
    brokerTimezone?: string;
    dryRun?: boolean;
  }) => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('accountId', params.accountId);
    if (params.brokerTimezone) formData.append('brokerTimezone', params.brokerTimezone);
    if (params.dryRun !== undefined) formData.append('dryRun', String(params.dryRun));
    return apiFetch<ImportResultDto>('/imports/mt5', {
      method: 'POST',
      body: formData,
    });
  },
  getSyncLogs: (accountId?: string) =>
    apiFetch<SyncLogDto[]>(`/imports/logs${buildQuery({ accountId, limit: 30 })}`),

  // Analytics
  getAnalyticsOverview: (params: GlobalFilterParams) =>
    apiFetch<AnalyticsOverview>(
      `/analytics/overview${buildQuery({
        accountId: params.accountId,
        from: params.from,
        to: params.to,
        symbol: params.symbol,
        direction: params.direction,
        tagIds: params.tagIds,
        timezone: params.timezone ?? 'Asia/Ho_Chi_Minh',
      })}`,
    ),
  getEquityCurve: (params: GlobalFilterParams) =>
    apiFetch<EquityCurveResponse>(
      `/analytics/equity-curve${buildQuery({
        accountId: params.accountId,
        from: params.from,
        to: params.to,
        symbol: params.symbol,
        direction: params.direction,
        tagIds: params.tagIds,
        timezone: params.timezone ?? 'Asia/Ho_Chi_Minh',
      })}`,
    ),
  getCalendar: (params: GlobalFilterParams & { month?: string }) =>
    apiFetch<CalendarDaySummary[]>(
      `/analytics/calendar${buildQuery({
        accountId: params.accountId,
        symbol: params.symbol,
        direction: params.direction,
        tagIds: params.tagIds,
        timezone: params.timezone ?? 'Asia/Ho_Chi_Minh',
        month: params.month,
      })}`,
    ),
  getBreakdowns: (params: GlobalFilterParams) =>
    apiFetch<AnalyticsBreakdownsResponse>(
      `/analytics/breakdowns${buildQuery({
        accountId: params.accountId,
        from: params.from,
        to: params.to,
        symbol: params.symbol,
        direction: params.direction,
        tagIds: params.tagIds,
        timezone: params.timezone ?? 'Asia/Ho_Chi_Minh',
      })}`,
    ),
};
