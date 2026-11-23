import { type ReactElement, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, BarChart3, CalendarDays, Cpu, Database, DollarSign, Gauge, Layers3, LayoutDashboard, MessageSquare, PieChart, RefreshCw, Timer, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { request as invoke } from '../utils/request';
import { showToast } from '../components/common/ToastContainer';
import { estimateApiCost, findModelPricing } from '../utils/modelPricing';
import { useConfigStore } from '../stores/useConfigStore';
import { dashboardCards, dashboardGridClass, DEFAULT_MENU_BAR_PREFERENCES, type DashboardCardId } from '../types/config';
import { dashboardOverview } from '../utils/dashboardOverview';
import { averageRequestInput } from '../utils/dashboardUsage';
import { quotaDisplay, quotaTone } from '../utils/menuBarOverview';
import { useDashboardOverview } from '../hooks/useDashboardOverview';
import { formatUsdWithRate, CurrencyMode } from '../utils/currency';

interface LocalTokenTotals {
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    total_tokens: number;
    request_count: number;
}

interface LocalTokenDaily extends LocalTokenTotals {
    date: string;
}

interface LocalTokenHourly extends LocalTokenTotals {
    hour: string;
}

interface LocalTokenModel extends LocalTokenTotals {
    model: string;
}

interface LocalTokenUsageSummary {
    recent_performance?: {
        model_count: number;
        source_count: number;
        sample_count: number;
        first_text_seconds: number;
        body_tokens_per_second: number;
        last_activity: number;
    } | null;
    today: LocalTokenTotals;
    yesterday: LocalTokenTotals;
    last_3_days: LocalTokenTotals;
    last_7_days: LocalTokenTotals;
    last_30_days: LocalTokenTotals;
    daily: LocalTokenDaily[];
    hourly: LocalTokenHourly[];
    by_model_today: LocalTokenModel[];
    by_model_yesterday: LocalTokenModel[];
    by_model_3_days: LocalTokenModel[];
    by_model_7_days: LocalTokenModel[];
    by_model: LocalTokenModel[];
    databases_scanned: number;
    generations_scanned: number;
    skipped_large_records: number;
    unreadable_databases: number;
    last_activity?: number;
    generated_at: number;
}

interface ModelPricing {
    input: number;
    output: number;
    cached: number;
}

interface ApiPricingEntry extends ModelPricing {
    model: string;
}

interface ApiPricingSnapshot {
    prices: ApiPricingEntry[];
    fetched_at: number;
    stale: boolean;
    source: string;
    warning?: string;
}

type RangeKey = 'today' | 'yesterday' | '3d' | '7d' | '30d';

const formatTokens = (value: number, locale: string) => value.toLocaleString(locale);

const formatUsd = (value: number, mode: CurrencyMode = 'usd', rate = 7.25, compact = false) => {
    if (mode === 'usd') {
        if (value === 0) return '$0.00';
        return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
    }
    return formatUsdWithRate(value, mode, rate, compact);
};

const compactTokens = (value: number, locale: string) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}M`;
    if (value >= 1_000) return `${(value / 1_000).toLocaleString(locale, { maximumFractionDigits: 1 })}K`;
    return value.toLocaleString(locale);
};

const dateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const shortDate = (key: string, locale: string) => new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
    month: 'numeric',
    day: 'numeric',
});

const formatTime = (timestamp: number | null | undefined, locale: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const rangeDays: Record<RangeKey, number> = {
    today: 1,
    yesterday: 1,
    '3d': 3,
    '7d': 7,
    '30d': 30,
};

const chartBarMaxWidth: Record<RangeKey, number> = {
    today: 12,
    yesterday: 12,
    '3d': 32,
    '7d': 32,
    '30d': 8,
};

export interface ModelCostBreakdown extends LocalTokenModel {
    costUsd: number;
    costPercent: number;
    isPriced: boolean;
    color: string;
}

const MODEL_COLORS = [
    '#e4e4e7', // platinum
    '#34d399', // emerald
    '#fbbf24', // amber
    '#a1a1aa', // silver
    '#fb7185', // rose
    '#d6c3a5', // warm sand
    '#a3e635', // sage
    '#71717a', // graphite
    '#f4a261', // terracotta
    '#cbd5e1', // pewter
];

type TokenChartPoint = LocalTokenTotals & {
    key: string;
    label: string;
};

const emptyTokenTotals = (): LocalTokenTotals => ({
    input_tokens: 0,
    output_tokens: 0,
    cached_tokens: 0,
    total_tokens: 0,
    request_count: 0,
});

function ModelCostDonut({
    data,
    totalCost,
    unpricedModels,
    hoveredModel,
    onHover,
}: {
    data: ModelCostBreakdown[];
    totalCost: number;
    unpricedModels: number;
    hoveredModel: string | null;
    onHover: (model: string | null) => void;
}) {
    const { t } = useTranslation();
    const radius = 38;
    const circumference = 2 * Math.PI * radius; // ~238.761

    const activeItem = data.find((d) => d.model === hoveredModel);

    if (totalCost === 0 || data.length === 0) {
        return (
            <div className="relative flex h-[100px] w-[100px] shrink-0 items-center justify-center">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="10"
                        className="text-gray-100 dark:text-base-200"
                    />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-xs font-bold text-gray-400">{unpricedModels ? t('local_dashboard.unpriced') : '$0.00'}</span>
                    <span className="text-[9px] text-gray-400">{unpricedModels ? t('local_dashboard.pricing_pending') : t('local_dashboard.no_cost_in_range')}</span>
                </div>
            </div>
        );
    }

    let accumulatedPercent = 0;

    return (
        <div className="relative flex h-[100px] w-[100px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="11"
                    className="text-gray-100 dark:text-base-200"
                />
                {data.map((slice) => {
                    const percent = slice.costPercent / 100;
                    const strokeDasharray = `${percent * circumference} ${circumference * (1 - percent)}`;
                    const strokeDashoffset = -accumulatedPercent * circumference;
                    accumulatedPercent += percent;
                    const isHovered = hoveredModel === slice.model;

                    return (
                        <circle
                            key={slice.model}
                            cx="50"
                            cy="50"
                            r={radius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={isHovered ? 13 : 11}
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={strokeDashoffset}
                            className="cursor-pointer transition-all duration-150 hover:opacity-90"
                            onMouseEnter={() => onHover(slice.model)}
                            onMouseLeave={() => onHover(null)}
                        />
                    );
                })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-1">
                <span className="max-w-[70px] truncate font-mono text-xs font-bold tracking-tight text-gray-900 dark:text-base-content">
                    {formatUsd(activeItem ? activeItem.costUsd : totalCost)}
                </span>
                <span className="max-w-[65px] truncate text-[9px] font-medium text-gray-400 dark:text-gray-500">
                    {activeItem ? `${activeItem.costPercent.toFixed(1)}%` : t(unpricedModels ? 'local_dashboard.priced_subtotal' : 'local_dashboard.total_cost')}
                </span>
            </div>
        </div>
    );
}

function TokenCard({
    cardId,
    label,
    value,
    color,
    icon: Icon,
    displayValue,
    unit,
    detail,
    hint,
    locale,
    children,
}: {
    cardId: DashboardCardId;
    label: string;
    value: number;
    color: string;
    icon: typeof Cpu;
    displayValue?: string;
    unit?: string;
    detail?: ReactNode;
    hint?: string;
    locale: string;
    children?: ReactNode;
}) {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            data-dashboard-card={cardId}
            title={detail === null ? hint : undefined}
            className="surface-card surface-card-interactive relative min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-3.5 transition-colors dark:border-white/[0.08] dark:bg-[#111113]"
        >
            <div className="mb-2 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium leading-4 text-zinc-600 dark:text-zinc-300">
                    <span className={`shrink-0 rounded-lg p-1.5 ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                    </span>
                    {label}
                </div>
            </div>
            {children ?? <div className="break-words text-xl font-bold font-mono tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50" title={`${displayValue || formatTokens(value, locale)}${unit ? ` ${unit}` : ''}`}>
                {displayValue || compactTokens(value, locale)}
                {unit && <> <span className="inline-block text-sm font-sans font-medium text-zinc-500 dark:text-zinc-400">{unit}</span></>}
            </div>}
            {detail !== null && <div
                data-card-detail
                className="mt-1 break-words text-xs leading-5 text-zinc-500 dark:text-zinc-400"
                title={hint || (typeof detail === 'string' ? detail : undefined) || `${formatTokens(value, locale)} Token`}
            >
                {detail || `${formatTokens(value, locale)} Token`}
            </div>}
        </motion.div>
    );
}

function Dashboard() {
    const config = useConfigStore(state => state.config);
    const visibleCards = dashboardCards(config?.dashboard?.cards);
    const accountData = useDashboardOverview(Boolean(config) && visibleCards.some(id => ['account_status', 'aggregate_quota'].includes(id)));
    const { t, i18n } = useTranslation();
    const locale = i18n.resolvedLanguage === 'zh' ? 'zh-CN' : i18n.resolvedLanguage === 'ru' ? 'ru-RU' : 'en-US';
    const quotaPreferences = useMemo(() => ({ ...DEFAULT_MENU_BAR_PREFERENCES, ...config?.menu_bar }), [config?.menu_bar]);
    const overview = useMemo(() => accountData.snapshot ? dashboardOverview(accountData.snapshot, quotaPreferences, accountData.now,
        config?.refresh_interval, accountData.reserve ?? config?.quota_protection.threshold_percentage ?? 10) : null,
    [accountData.snapshot, accountData.now, accountData.reserve, quotaPreferences, config?.refresh_interval, config?.quota_protection.threshold_percentage]);
    const quotaScope = t(`local_dashboard.quota_scope_${quotaPreferences.quota_scope}`);
    const overviewUnavailable = t(accountData.failed ? 'local_dashboard.overview_failed' : accountData.loading ? 'local_dashboard.overview_loading' : 'local_dashboard.overview_unknown');
    const currencyMode = config?.quota_valuation?.currency ?? 'usd';
    const usdToCnyRate = config?.quota_valuation?.usd_to_cny_rate ?? 7.25;
    const rangeLabels: Record<RangeKey, string> = {
        today: t('local_dashboard.today'),
        yesterday: t('local_dashboard.yesterday'),
        '3d': t('local_dashboard.last_3_days'),
        '7d': t('local_dashboard.last_7_days'),
        '30d': t('local_dashboard.last_30_days'),
    };
    const [usage, setUsage] = useState<LocalTokenUsageSummary | null>(null);
    const [pricing, setPricing] = useState<ApiPricingSnapshot | null>(null);
    const [range, setRange] = useState<RangeKey>('today');
    const [modelViewMode, setModelViewMode] = useState<'tokens' | 'cost'>('cost');
    const [hoveredDonutModel, setHoveredDonutModel] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<TokenChartPoint | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
    const fetchInFlight = useRef(false);

    const fetchUsage = useCallback(async (notify = false) => {
        if (fetchInFlight.current) return;
        fetchInFlight.current = true;
        setLoading(true);
        setError(null);
        try {
            const result = await invoke<LocalTokenUsageSummary>('get_local_token_usage');
            setUsage(result);
            setLastUpdatedAt(Date.now());
            if (notify) {
                const dataTime = result.last_activity
                    ? t('local_dashboard.toast_data_time', { time: formatTime(result.last_activity * 1000, locale) })
                    : '';
                showToast(t('local_dashboard.toast_updated', { dataTime }), 'success');
            }
        } catch (fetchError) {
            const message = String(fetchError);
            setError(message);
            showToast(t('local_dashboard.toast_scan_failed', { message }), 'error');
        } finally {
            fetchInFlight.current = false;
            setLoading(false);
        }
    }, [locale, t]);

    const fetchPricing = useCallback(async () => {
        try {
            const result = await invoke<ApiPricingSnapshot>('get_api_pricing');
            setPricing(result);
        } catch (fetchError) {
            console.warn('API pricing unavailable:', fetchError);
            setPricing(null);
        }
    }, []);

    useEffect(() => {
        fetchUsage();
        fetchPricing();
        const refreshVisibleUsage = () => {
            if (document.visibilityState !== 'hidden') void fetchUsage();
        };
        const usageInterval = window.setInterval(refreshVisibleUsage, 60_000);
        const pricingInterval = window.setInterval(fetchPricing, 24 * 60 * 60 * 1000);
        window.addEventListener('focus', refreshVisibleUsage);
        document.addEventListener('visibilitychange', refreshVisibleUsage);
        return () => {
            window.clearInterval(usageInterval);
            window.clearInterval(pricingInterval);
            window.removeEventListener('focus', refreshVisibleUsage);
            document.removeEventListener('visibilitychange', refreshVisibleUsage);
        };
    }, [fetchPricing, fetchUsage]);

    const totals = useMemo<LocalTokenTotals>(() => {
        if (!usage) {
            return { input_tokens: 0, output_tokens: 0, cached_tokens: 0, total_tokens: 0, request_count: 0 };
        }
        if (range === 'yesterday') return usage.yesterday;
        if (range === '3d') return usage.last_3_days;
        if (range === '7d') return usage.last_7_days;
        if (range === '30d') return usage.last_30_days;
        return usage.today;
    }, [range, usage]);

    useEffect(() => {
        setHoveredPoint(null);
    }, [range]);

    const chartPoints = useMemo<TokenChartPoint[]>(() => {
        const now = new Date();
        if (range === 'today' || range === 'yesterday') {
            const chartDate = new Date(now);
            if (range === 'yesterday') chartDate.setDate(chartDate.getDate() - 1);
            const dayKey = dateKey(chartDate);
            const byHour = new Map((usage?.hourly || []).map((item) => [item.hour, item]));
            return Array.from({ length: 24 }, (_, hour) => {
                const label = `${String(hour).padStart(2, '0')}:00`;
                const key = `${dayKey} ${label}`;
                const item = byHour.get(key);
                return {
                    ...(item || emptyTokenTotals()),
                    key,
                    label,
                };
            });
        }

        const byDate = new Map((usage?.daily || []).map((item) => [item.date, item]));
        const days: TokenChartPoint[] = [];
        for (let offset = rangeDays[range] - 1; offset >= 0; offset -= 1) {
            const date = new Date(now);
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - offset);
            const key = dateKey(date);
            const item = byDate.get(key);
            days.push({
                ...(item || emptyTokenTotals()),
                key,
                label: shortDate(key, locale),
            });
        }
        return days;
    }, [locale, range, usage]);

    const maxChartTokens = Math.max(...chartPoints.map((point) => point.total_tokens), 1);

    const modelsForRange = useMemo(() => {
        if (!usage) return [];
        if (range === 'today') return usage.by_model_today;
        if (range === 'yesterday') return usage.by_model_yesterday;
        if (range === '3d') return usage.by_model_3_days;
        if (range === '7d') return usage.by_model_7_days;
        return usage.by_model;
    }, [range, usage]);

    const cacheHitRate = useMemo(() => {
        const denominator = totals.input_tokens + totals.cached_tokens;
        return denominator > 0 ? (totals.cached_tokens / denominator) * 100 : 0;
    }, [totals]);
    const averageInput = averageRequestInput(totals);

    const apiCost = useMemo(() => estimateApiCost(modelsForRange, pricing), [modelsForRange, pricing]);

    const modelCostList = useMemo<ModelCostBreakdown[]>(() => {
        const list = modelsForRange.map((m) => {
            const p = findModelPricing(m.model, pricing);
            const costUsd = p
                ? (m.input_tokens * p.input + m.output_tokens * p.output + m.cached_tokens * p.cached) / 1_000_000
                : 0;
            return {
                ...m,
                costUsd,
                costPercent: 0,
                isPriced: !!p,
                color: '#64748b',
            };
        });

        list.sort((a, b) => {
            if (b.costUsd !== a.costUsd) return b.costUsd - a.costUsd;
            return b.total_tokens - a.total_tokens;
        });

        const totalCost = list.reduce((acc, cur) => acc + cur.costUsd, 0);

        return list.map((item, idx) => ({
            ...item,
            costPercent: totalCost > 0 ? (item.costUsd / totalCost) * 100 : 0,
            color: MODEL_COLORS[idx % MODEL_COLORS.length],
        }));
    }, [modelsForRange, pricing]);

    // Blended price per token type for the current range, so the chart can show the cost of a
    // single bar. Models without a known price contribute nothing (same caveat as the KPI card).
    const costPerPoint = useMemo(() => {
        const rates = modelsForRange.reduce(
            (acc, model) => {
                const price = findModelPricing(model.model, pricing);
                if (!price) return acc;
                acc.input += model.input_tokens * price.input;
                acc.output += model.output_tokens * price.output;
                acc.cached += model.cached_tokens * price.cached;
                return acc;
            },
            { input: 0, output: 0, cached: 0 },
        );
        return {
            input: totals.input_tokens ? rates.input / totals.input_tokens / 1_000_000 : 0,
            output: totals.output_tokens ? rates.output / totals.output_tokens / 1_000_000 : 0,
            cached: totals.cached_tokens ? rates.cached / totals.cached_tokens / 1_000_000 : 0,
        };
    }, [modelsForRange, pricing, totals]);

    const costForPoint = useCallback(
        (point: TokenChartPoint) =>
            point.input_tokens * costPerPoint.input
            + point.output_tokens * costPerPoint.output
            + point.cached_tokens * costPerPoint.cached,
        [costPerPoint],
    );
    const pricingLabel = pricing
        ? pricing.stale
            ? t('local_dashboard.pricing_local_cache')
            : t('local_dashboard.pricing_google')
        : t('local_dashboard.pricing_fallback');

    const performance = usage?.recent_performance;
    const performanceDetail = performance
        ? t('local_dashboard.recent_performance', {
            count: performance.sample_count,
        })
        : t('local_dashboard.performance_empty');
    const performanceScope = performance ? t('local_dashboard.performance_scope', {
        models: performance.model_count, sources: performance.source_count,
    }) : '';

    // Keep scan freshness below the toolbar so it does not squeeze its controls.
    const scanStatus = loading
        ? t('local_dashboard.scanning')
        : lastUpdatedAt
            ? `${t('local_dashboard.scanned_at', { time: formatTime(lastUpdatedAt, locale) })}${usage?.last_activity ? t('local_dashboard.data_through', { time: formatTime(usage.last_activity * 1000, locale) }) : ''}`
            : t('local_dashboard.waiting_scan');

    const cards: Record<DashboardCardId, ReactElement> = {
        total_tokens: (<TokenCard cardId="total_tokens" label={t('local_dashboard.total_tokens', { range: rangeLabels[range] })} value={totals.total_tokens} hint={t('local_dashboard.total_tokens_hint')} color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200" icon={BarChart3} locale={locale} />),
        input_tokens: (<TokenCard cardId="input_tokens" label={t('local_dashboard.input_tokens')} value={totals.input_tokens} hint={t('local_dashboard.input_tokens_hint')} color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200" icon={MessageSquare} locale={locale} />),
        output_tokens: (<TokenCard cardId="output_tokens" label={t('local_dashboard.output_tokens')} value={totals.output_tokens} hint={t('local_dashboard.output_tokens_hint')} color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200" icon={Cpu} locale={locale} />),
        cache_hit_rate: (<TokenCard cardId="cache_hit_rate"
            label={t('local_dashboard.cache_hit_rate')}
            value={cacheHitRate}
            displayValue={`${cacheHitRate.toFixed(1)}%`}
            detail={t('local_dashboard.cache_hit_rate_detail')}
            hint={t('local_dashboard.cache_hit_rate_hint')}
            color="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
            icon={Database}
            locale={locale}
        />),
        api_cost: (<TokenCard cardId="api_cost"
            label={t('local_dashboard.api_cost')}
            value={apiCost.usd}
            displayValue={apiCost.unpricedModels && !apiCost.pricedModels ? t('local_dashboard.unpriced') : formatUsd(apiCost.usd, currencyMode, usdToCnyRate, true)}
            detail={<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{t('local_dashboard.api_requests', { requestCount: formatTokens(totals.request_count, locale) })}</span>
                {apiCost.unpricedModels > 0 && <span className="text-amber-700 dark:text-amber-400">{t('local_dashboard.unpriced_count', { count: apiCost.unpricedModels })}</span>}
            </div>}
            hint={`${pricingLabel}\n${t('local_dashboard.api_cost_hint')}`}
            color="bg-amber-500/12 text-amber-600 dark:text-amber-400"
            icon={DollarSign}
            locale={locale}
        />),
        first_text_latency: (<TokenCard cardId="first_text_latency"
            label={t('local_dashboard.first_text_latency')}
            value={performance?.first_text_seconds ?? 0}
            displayValue={performance ? t('local_dashboard.seconds_value', { value: performance.first_text_seconds.toLocaleString(locale, { maximumFractionDigits: 2 }) }) : '—'}
            detail={performanceDetail}
            hint={`${performanceDetail}\n${performanceScope}\n${t('local_dashboard.first_text_hint')}`}
            color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200"
            icon={Timer}
            locale={locale}
        />),
        body_speed: (<TokenCard cardId="body_speed"
            label={t('local_dashboard.body_speed')}
            value={performance?.body_tokens_per_second ?? 0}
            displayValue={performance ? performance.body_tokens_per_second.toLocaleString(locale, { maximumFractionDigits: 1 }) : '—'}
            unit={performance ? 'token/s' : undefined}
            detail={performanceDetail}
            hint={`${performanceDetail}\n${performanceScope}\n${t('local_dashboard.body_speed_hint')}`}
            color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200"
            icon={Gauge}
            locale={locale}
        />),
        account_status: (<TokenCard cardId="account_status"
            label={t('local_dashboard.account_status')}
            value={overview?.accounts.total ?? 0}
            displayValue={overview ? formatTokens(overview.accounts.total, locale) : '—'}
            unit={overview ? t('local_dashboard.accounts_unit') : undefined}
            detail={overview ? t('local_dashboard.account_status_detail', overview.accounts) : overviewUnavailable}
            hint={t('local_dashboard.account_status_hint', { scope: quotaScope, threshold: overview?.threshold ?? 10 })}
            color="bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
            icon={Users}
            locale={locale}
        />),
        aggregate_quota: (<TokenCard cardId="aggregate_quota"
            label={t('local_dashboard.aggregate_quota')}
            value={0}
            detail={null}
            hint={`${t('local_dashboard.quota_scope_hint', { scope: quotaScope })}\n${t('local_dashboard.quota_used_hint')}\n${overview ? t('local_dashboard.quota_coverage', {
                session: overview.windows['5h'].covered, weekly: overview.windows.weekly.covered, total: overview.windows['5h'].total,
            }) : overviewUnavailable}`}
            color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200"
            icon={PieChart}
            locale={locale}
        >
            <div className="space-y-1">
                {(['5h', 'weekly', ...(overview?.argonWeekly.total ? ['argon' as const] : []), ...(overview?.carbonWeekly.total ? ['carbon' as const] : [])] as const).map(window => {
                    const used = (window === 'argon' ? overview?.argonWeekly.used : window === 'carbon' ? overview?.carbonWeekly.used : overview?.windows[window].used) ?? null;
                    const label = t(`local_dashboard.quota_used_${window}`);
                    const tone = quotaTone(used === null ? null : 100 - used, quotaPreferences);
                    const fill = { healthy: 'bg-emerald-500', warning: 'bg-amber-500', critical: 'bg-rose-500', unknown: '' }[tone];
                    return <div key={window} data-quota-window={window}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                            <span className="text-xs leading-4 text-zinc-600 dark:text-zinc-300">{label}</span>
                            <span className="text-sm font-semibold leading-4 tabular-nums text-zinc-900 dark:text-zinc-100">{quotaDisplay(used)}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200/80 text-zinc-400 dark:bg-white/[0.08] dark:text-zinc-500"
                            role={used === null ? 'img' : 'meter'} aria-label={used === null ? `${label}: ${overviewUnavailable}` : label}
                            aria-valuemin={used === null ? undefined : 0} aria-valuemax={used === null ? undefined : 100}
                            aria-valuenow={used ?? undefined} aria-valuetext={used === null ? undefined : quotaDisplay(used)}>
                            {used === null ? <span className="block h-full opacity-30" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0px, transparent 3px, currentColor 3px, currentColor 4px)' }} />
                                : <motion.span initial={{ width: 0 }} animate={{ width: `${used}%` }} transition={{ type: 'spring', stiffness: 180, damping: 26 }} className={`block h-full rounded-full ${fill}`} />}
                        </div>
                    </div>;
                })}
            </div>
        </TokenCard>),
        average_input: (<TokenCard cardId="average_input"
            label={t('local_dashboard.average_input')}
            value={averageInput ?? 0}
            displayValue={averageInput === null ? '—' : undefined}
            unit={averageInput === null ? undefined : 'Token'}
            detail={averageInput === null ? t('local_dashboard.average_input_empty') : t('local_dashboard.average_input_detail', { requestCount: formatTokens(totals.request_count, locale) })}
            hint={t('local_dashboard.average_input_hint')}
            color="bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200"
            icon={Layers3}
            locale={locale}
        />),
    };

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-2.5 p-3 lg:h-full lg:min-h-0 lg:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                            <LayoutDashboard className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
                            {t('local_dashboard.title')}
                        </h1>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {t('local_dashboard.subtitle')}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <div className="flex items-center gap-0.5 rounded-xl border border-zinc-200/80 bg-zinc-200/60 p-1 dark:border-white/[0.08] dark:bg-[#141417]">
                            <div className="flex items-center gap-1 px-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                                <CalendarDays className="h-3.5 w-3.5" />
                                <span>{t('local_dashboard.range_label')}</span>
                            </div>
                            {(Object.keys(rangeLabels) as RangeKey[]).map((key) => {
                                const active = range === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setRange(key)}
                                        className={`relative rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                            active
                                                ? 'text-white dark:text-zinc-950'
                                                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                                        }`}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId="dashboard-range-pill"
                                                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                                className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                                            />
                                        )}
                                        <span className="relative z-10">{rangeLabels[key]}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            onClick={() => { void fetchUsage(true); void accountData.refresh(); }}
                            disabled={loading}
                            title={scanStatus}
                            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? t('local_dashboard.refreshing') : t('local_dashboard.refresh')}
                        </motion.button>
                    </div>
                </div>

                <p data-usage-freshness className="text-[11px] leading-5 text-zinc-400 dark:text-zinc-500" title={t('local_dashboard.scan_hint')}>
                    {scanStatus}
                </p>

                {error && (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
                        {error}
                    </div>
                )}

                {!!usage?.unreadable_databases && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        {t('local_dashboard.unreadable_databases', { count: usage.unreadable_databases })}
                    </div>
                )}

                {visibleCards.length > 0 && <div className={`grid auto-rows-fr shrink-0 gap-2 ${dashboardGridClass(visibleCards.length)}`} data-dashboard-cards>
                    {visibleCards.map((id, idx) => (
                        <motion.div
                            key={id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.24, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
                            className="min-w-0 h-full"
                        >
                            {cards[id]}
                        </motion.div>
                    ))}
                </div>}

                <div className="grid shrink-0 gap-2.5 lg:h-[178px] lg:grid-cols-[1.35fr_1fr]">
                    <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#111113] lg:flex lg:min-h-0 lg:flex-col">
                        <div className="mb-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    <Activity className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                    {rangeLabels[range]}
                                </h2>
                                <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{t('local_dashboard.chart_subtitle')}</p>
                            </div>
                            <div className="pointer-events-none h-[60px] w-full shrink-0 text-right sm:w-[236px]" aria-live="polite">
                                {hoveredPoint ? (
                                    <div className="flex h-full flex-col justify-center gap-1">
                                        <div className="flex items-baseline justify-end gap-1.5">
                                            <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">{hoveredPoint.label}</span>
                                            <span className="whitespace-nowrap text-sm font-bold leading-4 text-zinc-900 dark:text-white">
                                                {formatTokens(hoveredPoint.total_tokens, locale)} {t('local_dashboard.token')}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] leading-3">
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-zinc-400 dark:text-zinc-500">{t('local_dashboard.input_short')}</span>
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">{compactTokens(hoveredPoint.input_tokens, locale)}</span>
                                            </div>
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-zinc-400 dark:text-zinc-500">{t('local_dashboard.output_short')}</span>
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">{compactTokens(hoveredPoint.output_tokens, locale)}</span>
                                            </div>
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-zinc-400 dark:text-zinc-500">{t('local_dashboard.cached_tokens')}</span>
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">{compactTokens(hoveredPoint.cached_tokens, locale)}</span>
                                            </div>
                                            <div className="flex items-baseline justify-end gap-1">
                                                <span className="text-zinc-400 dark:text-zinc-500">{t('local_dashboard.request_count')}</span>
                                                <span className="font-mono text-zinc-700 dark:text-zinc-300">{formatTokens(hoveredPoint.request_count, locale)}</span>
                                            </div>
                                            <div className="col-span-2 flex items-baseline justify-end gap-1">
                                                <span className="text-zinc-400 dark:text-zinc-500">{t('local_dashboard.estimated_cost')}</span>
                                                <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{apiCost.unpricedModels && !apiCost.pricedModels ? t('local_dashboard.unpriced') : formatUsd(costForPoint(hoveredPoint))}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full items-center justify-end text-[11px] text-zinc-400 dark:text-zinc-500">
                                        {t('local_dashboard.hover_for_usage')}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div
                            className="flex h-24 items-end gap-1 border-b border-zinc-200/70 pb-1 dark:border-white/[0.07] lg:min-h-0 lg:flex-1"
                            onMouseLeave={() => setHoveredPoint(null)}
                        >
                            {chartPoints.map((point, index) => {
                                const isEmpty = point.total_tokens === 0;
                                const height = Math.max((point.total_tokens / maxChartTokens) * 100, 6);
                                const isHourlyRange = range === 'today' || range === 'yesterday';
                                const showPointLabel = isHourlyRange
                                    ? index % 3 === 0 || index === chartPoints.length - 1
                                    : range !== '30d' || index % 5 === 0 || index === chartPoints.length - 1;
                                const isHovered = hoveredPoint?.key === point.key;
                                return (
                                    <div
                                        key={point.key}
                                        className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                                        onMouseEnter={() => setHoveredPoint(point)}
                                    >
                                        <div className="relative flex w-full min-w-0 flex-1 items-end justify-center">
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: isEmpty ? '2px' : `${height}%` }}
                                                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                                                className={`shrink-0 transition-colors duration-150 ${
                                                    isEmpty
                                                        ? 'rounded-none bg-zinc-300/40 dark:bg-white/[0.1]'
                                                        : isHovered
                                                        ? 'rounded-t-[3px] bg-emerald-500 dark:bg-emerald-400'
                                                        : 'rounded-t-[3px] bg-gradient-to-t from-zinc-700 to-zinc-400 dark:from-zinc-500 dark:to-zinc-200 group-hover:from-emerald-500 group-hover:to-emerald-400'
                                                }`}
                                                style={{
                                                    width: '70%',
                                                    maxWidth: `${chartBarMaxWidth[range]}px`,
                                                }}
                                            />
                                        </div>
                                        <span className="w-full whitespace-nowrap text-center text-[10px] text-zinc-400 dark:text-zinc-500">{showPointLabel ? point.label : '\u00a0'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-3.5 dark:border-white/[0.08] dark:bg-[#111113] lg:flex lg:min-h-0 lg:flex-col">
                        <div className="mb-1.5 flex items-center justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    <PieChart className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                    {t('local_dashboard.model_breakdown')}
                                </h2>
                                <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                                    {modelViewMode === 'cost' && apiCost.unpricedModels ? t('local_dashboard.unpriced_models_hint', { count: apiCost.unpricedModels }) : t('local_dashboard.local_records', { range: rangeLabels[range] })}
                                </p>
                            </div>
                            <div className="flex items-center gap-0.5 rounded-lg bg-zinc-200/70 p-0.5 dark:bg-[#18181b] border border-zinc-300/60 dark:border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setModelViewMode('tokens')}
                                    className={`relative px-2.5 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                                        modelViewMode === 'tokens'
                                            ? 'text-white dark:text-zinc-950'
                                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    {modelViewMode === 'tokens' && (
                                        <motion.span
                                            layoutId="dashboard-model-view-pill"
                                            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                            className="absolute inset-0 rounded-md bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                                        />
                                    )}
                                    <span className="relative z-10">{t('local_dashboard.view_tokens')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModelViewMode('cost')}
                                    className={`relative flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-semibold rounded-md transition-colors ${
                                        modelViewMode === 'cost'
                                            ? 'text-white dark:text-zinc-950'
                                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    {modelViewMode === 'cost' && (
                                        <motion.span
                                            layoutId="dashboard-model-view-pill"
                                            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                            className="absolute inset-0 rounded-md bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                                        />
                                    )}
                                    <PieChart className="relative z-10 h-3 w-3" />
                                    <span className="relative z-10">{t('local_dashboard.view_estimated_cost')}</span>
                                </button>
                            </div>
                        </div>

                        {modelViewMode === 'tokens' ? (
                            <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1 lg:min-h-0 lg:flex-1 lg:max-h-none">
                                {modelsForRange.slice(0, 8).map((model) => {
                                    const width = totals.total_tokens
                                        ? Math.max((model.total_tokens / totals.total_tokens) * 100, 2)
                                        : 0;
                                    return (
                                        <div key={model.model}>
                                            <div className="mb-0.5 flex items-center justify-between gap-3 text-[11px]">
                                                <span className="truncate text-zinc-700 dark:text-zinc-300" title={model.model}>{model.model}</span>
                                                <span className="shrink-0 font-mono text-zinc-500 dark:text-zinc-400">{compactTokens(model.total_tokens, locale)}</span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/[0.08]">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${width}%` }}
                                                    transition={{ type: 'spring', stiffness: 200, damping: 26 }}
                                                    className="h-full rounded-full bg-zinc-700 dark:bg-zinc-300"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                {!loading && !modelsForRange.length && (
                                    <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">{t('local_dashboard.no_model_usage')}</div>
                                )}
                            </div>
                        ) : (
                            <div className="flex h-full items-center gap-3 overflow-hidden py-1 lg:min-h-0 lg:flex-1">
                                <ModelCostDonut
                                    data={modelCostList.filter((m) => m.costUsd > 0)}
                                    totalCost={apiCost.usd}
                                    unpricedModels={apiCost.unpricedModels}
                                    hoveredModel={hoveredDonutModel}
                                    onHover={setHoveredDonutModel}
                                />
                                <div className="flex-1 min-w-0 max-h-32 overflow-y-auto pr-1 space-y-1 lg:max-h-none">
                                    {modelCostList.filter((m) => m.costUsd > 0).map((item) => (
                                        <div
                                            key={item.model}
                                            onMouseEnter={() => setHoveredDonutModel(item.model)}
                                            onMouseLeave={() => setHoveredDonutModel(null)}
                                            className={`flex items-center justify-between text-[11px] p-1 rounded-lg transition-colors cursor-pointer ${
                                                hoveredDonutModel === item.model
                                                    ? 'bg-zinc-200/70 dark:bg-white/[0.08]'
                                                    : 'hover:bg-zinc-100 dark:hover:bg-white/[0.04]'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 min-w-0 mr-2">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                <span className="truncate font-medium text-zinc-700 dark:text-zinc-300" title={item.model}>
                                                    {item.model}
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0 font-mono">
                                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatUsd(item.costUsd, currencyMode, usdToCnyRate, true)}</span>
                                                <span className="text-[10px] text-zinc-400 ml-1">({item.costPercent.toFixed(1)}%)</span>
                                            </div>
                                        </div>
                                    ))}
                                    {!loading && !modelCostList.filter((m) => m.costUsd > 0).length && (
                                        <div className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
                                            {t(apiCost.unpricedModels ? 'local_dashboard.pricing_pending' : 'local_dashboard.no_cost_in_range')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <section className="surface-card overflow-hidden rounded-2xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111113] lg:flex lg:min-h-[160px] lg:flex-1 lg:flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/70 px-4 py-2 dark:border-white/[0.07]">
                        <div>
                            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                <Cpu className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                {t('local_dashboard.model_details')}
                            </h2>
                            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">{t('local_dashboard.model_details_desc', { range: rangeLabels[range] })}</p>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">{t('local_dashboard.model_count', { count: modelsForRange.length })}</span>
                    </div>
                    <div className="max-h-[142px] overflow-y-auto lg:min-h-0 lg:flex-1 lg:max-h-none">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[560px] text-left text-xs">
                                <thead className="bg-zinc-100/80 text-[10px] uppercase text-zinc-500 dark:bg-[#16161a] dark:text-zinc-400">
                                    <tr>
                                        <th className="px-4 py-1.5 font-medium">{t('local_dashboard.model')}</th>
                                        <th className="px-4 py-1.5 text-right font-medium">{t('local_dashboard.estimated_cost')}</th>
                                        <th className="px-4 py-1.5 text-right font-medium">{t('local_dashboard.total_tokens_column')}</th>
                                        <th className="px-4 py-1.5 text-right font-medium">{t('local_dashboard.input_short')}</th>
                                        <th className="px-4 py-1.5 text-right font-medium">{t('local_dashboard.output_short')}</th>
                                        <th className="px-4 py-1.5 text-right font-medium">{t('local_dashboard.request_count')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                                    {modelCostList.map((model) => (
                                        <tr key={model.model} className="text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.025] transition-colors">
                                            <td className="max-w-[300px] truncate px-4 py-1.5 font-medium" title={model.model}>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: model.color }} />
                                                    <span className="truncate">{model.model}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-1.5 text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                                                {model.isPriced ? (
                                                    formatUsd(model.costUsd)
                                                ) : (
                                                    <span className="text-zinc-400 dark:text-zinc-500" title={t('local_dashboard.pricing_unavailable')}>
                                                        {t('local_dashboard.unpriced')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-1.5 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">{formatTokens(model.total_tokens, locale)}</td>
                                            <td className="px-4 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatTokens(model.input_tokens, locale)}</td>
                                            <td className="px-4 py-1.5 text-right font-mono text-zinc-500 dark:text-zinc-400">{formatTokens(model.output_tokens, locale)}</td>
                                            <td className="px-4 py-1.5 text-right font-mono text-zinc-600 dark:text-zinc-400">{formatTokens(model.request_count, locale)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!loading && !modelsForRange.length && (
                                <div className="px-4 py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
                                    {t('local_dashboard.no_token_records')}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

export default Dashboard;
