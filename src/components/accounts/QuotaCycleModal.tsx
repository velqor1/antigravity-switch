import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    Activity,
    AlertCircle,
    BarChart3,
    Calendar,
    ChevronDown,
    ChevronRight,
    Clock,
    DollarSign,
    Filter,
    Layers,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { request } from '../../utils/request';
import { cn } from '../../utils/cn';
import { formatCurrencyCompact } from '../../utils/currency';
import { useConfigStore } from '../../stores/useConfigStore';

export interface RawCycleCheckpoint {
    ts?: number;
    timestamp?: number;
    remaining_fraction: number;
    delta_fraction?: number;
}

export interface CycleCheckpoint {
    timestamp: number;
    remaining_fraction: number;
    delta_fraction: number;
}

export interface RawQuotaCycleRecord {
    cycle_id: string;
    account_id: string;
    pool: string;
    window: string;
    cycle_start_ts?: number;
    start_time?: string;
    reset_ts?: number;
    reset_time: string;
    first_observed_remaining: number;
    latest_remaining: number;
    min_remaining: number;
    consumed_fraction: number;
    last_delta_fraction: number;
    sample_count: number;
    status: string;
    provenance?: string;
    used_usd?: number;
    estimated_total_usd?: number | null;
    prev_cycle_total_usd?: number | null;
    delta_total_usd?: number | null;
    delta_total_pct?: number | null;
    checkpoints?: RawCycleCheckpoint[];
    email?: string;
    subscription_tier?: string;
}

export interface QuotaCycleRecord {
    row_key: string;
    cycle_id: string;
    account_id: string;
    pool: 'gemini' | 'third_party' | 'argon' | 'carbon' | 'unknown';
    window: string;
    start_time: string;
    reset_time: string;
    reset_ts: number;
    first_observed_remaining: number;
    latest_remaining: number;
    min_remaining: number;
    consumed_fraction: number;
    last_delta_fraction: number;
    sample_count: number;
    status: 'active' | 'completed';
    provenance?: string;
    used_usd?: number;
    estimated_total_usd?: number;
    prev_cycle_total_usd?: number;
    delta_total_usd?: number;
    delta_total_pct?: number;
    checkpoints: CycleCheckpoint[];
    email?: string;
    subscription_tier?: string;
}

export interface RawQuotaCycleAccountGroup {
    account_id: string;
    email: string;
    subscription_tier?: string | null;
    records: RawQuotaCycleRecord[];
}

export interface QuotaCycleAccountSummary {
    account_id: string;
    email: string;
    total_cycles: number;
    active_cycles: number;
    total_consumed_usd: number;
    latest_reset_time?: string;
}

export interface QuotaCycleHistoryResponse {
    accounts?: RawQuotaCycleAccountGroup[];
    cycles?: RawQuotaCycleRecord[];
    accounts_summary?: QuotaCycleAccountSummary[];
    currency: 'usd' | 'cny' | 'both' | string;
    usd_to_cny_rate: number;
    fetched_at?: number;
    queried_at?: number;
}

function normalizePool(pool: string): 'gemini' | 'third_party' | 'argon' | 'carbon' | 'unknown' {
    const lower = (pool || '').toLowerCase();
    if (lower === 'gemini') return 'gemini';
    if (lower === 'third_party' || lower === '3p') return 'third_party';
    if (lower === 'argon') return 'argon';
    if (lower === 'carbon') return 'carbon';
    return 'unknown';
}

function formatPoolLabel(pool: QuotaCycleRecord['pool']): string {
    switch (pool) {
        case 'gemini':
            return 'Gemini';
        case 'third_party':
            return 'Claude / GPT';
        case 'argon':
            return 'Gemini 4 Argon';
        case 'carbon':
            return 'Gemini 4 Carbon';
        default:
            return pool;
    }
}

function formatPoolShort(pool: QuotaCycleRecord['pool']): string {
    switch (pool) {
        case 'gemini':
            return 'Gem';
        case 'third_party':
            return '3P';
        case 'argon':
            return 'Arg';
        case 'carbon':
            return 'Cbn';
        default:
            return pool.slice(0, 3);
    }
}

function normalizeRecord(
    rec: RawQuotaCycleRecord,
    accountId: string,
    email?: string,
    subscriptionTier?: string | null
): QuotaCycleRecord {
    const pool = normalizePool(rec.pool);
    const windowNorm = (rec.window || '').toLowerCase().includes('week') ? 'weekly' : '5h';
    const startTime =
        rec.start_time ||
        (rec.cycle_start_ts && rec.cycle_start_ts > 0
            ? new Date(rec.cycle_start_ts * 1000).toISOString()
            : '');
    const resetTs =
        rec.reset_ts ??
        (rec.reset_time ? Math.floor(new Date(rec.reset_time).getTime() / 1000) || 0 : 0);

    const rawCheckpoints = Array.isArray(rec.checkpoints) ? rec.checkpoints : [];
    const checkpoints: CycleCheckpoint[] = rawCheckpoints
        .map((cp, idx) => {
            const prev =
                idx > 0 ? rawCheckpoints[idx - 1].remaining_fraction : rec.first_observed_remaining;
            const delta =
                cp.delta_fraction ?? (idx === 0 ? 0 : cp.remaining_fraction - prev);
            return {
                timestamp: cp.timestamp ?? cp.ts ?? 0,
                remaining_fraction: cp.remaining_fraction,
                delta_fraction: delta,
            };
        })
        .reverse();

    const trustworthyDeltaPct =
        (rec.provenance === 'observed' || rec.provenance === 'exhausted') &&
        rec.delta_total_pct != null &&
        Math.abs(rec.delta_total_pct) <= 100
            ? rec.delta_total_pct
            : undefined;

    return {
        row_key: `${accountId}:${pool}:${rec.cycle_id}`,
        cycle_id: rec.cycle_id,
        account_id: accountId,
        pool,
        window: windowNorm,
        start_time: startTime,
        reset_time: rec.reset_time,
        reset_ts: resetTs,
        first_observed_remaining: rec.first_observed_remaining,
        latest_remaining: rec.latest_remaining,
        min_remaining: rec.min_remaining,
        consumed_fraction: rec.consumed_fraction,
        last_delta_fraction: rec.last_delta_fraction,
        sample_count: rec.sample_count,
        status: rec.status === 'completed' ? 'completed' : 'active',
        provenance: rec.provenance,
        used_usd: rec.used_usd ?? 0,
        estimated_total_usd: rec.estimated_total_usd ?? undefined,
        prev_cycle_total_usd: rec.prev_cycle_total_usd ?? undefined,
        delta_total_usd:
            trustworthyDeltaPct != null ? (rec.delta_total_usd ?? undefined) : undefined,
        delta_total_pct: trustworthyDeltaPct,
        checkpoints,
        email: email || rec.email,
        subscription_tier: (subscriptionTier ?? rec.subscription_tier) || undefined,
    };
}

interface QuotaCycleModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialAccountId?: string;
}

export default function QuotaCycleModal({
    isOpen,
    onClose,
    initialAccountId,
}: QuotaCycleModalProps) {
    const { i18n } = useTranslation();
    const lang = i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ru') ? 'ru' : 'en';
    const pickLang = <T,>(zh: T, ru: T, en: T): T => lang === 'zh' ? zh : lang === 'ru' ? ru : en;
    const { config } = useConfigStore();
    const currencyMode = (config?.quota_valuation?.currency ?? 'usd') as 'usd' | 'cny' | 'both';

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<QuotaCycleHistoryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // 过滤条件
    const [selectedAccount, setSelectedAccount] = useState<string>(initialAccountId || 'all');
    const [selectedPool, setSelectedPool] = useState<string>('all');
    const [selectedWindow, setSelectedWindow] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');

    // 展开检查点详情的行 (使用跨账号唯一 row_key)
    const [expandedCycleKey, setExpandedCycleKey] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await request<QuotaCycleHistoryResponse>('get_quota_cycle_history', {});
            setData(resp);
        } catch (err: any) {
            setError(err?.toString() || 'Failed to fetch cycle history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSelectedAccount(initialAccountId || 'all');
            setExpandedCycleKey(null);
            loadData();
        }
    }, [isOpen, initialAccountId, loadData]);

    // 将后端按账号分组的 records 或兼容 cycles 扁平化
    const { allCycles, accountsSummary } = useMemo(() => {
        if (!data) {
            return { allCycles: [] as QuotaCycleRecord[], accountsSummary: [] as QuotaCycleAccountSummary[] };
        }

        const cycles: QuotaCycleRecord[] = [];
        const summaries: QuotaCycleAccountSummary[] = [];

        if (Array.isArray(data.accounts)) {
            for (const acc of data.accounts) {
                const tierLower = (acc.subscription_tier || '').toLowerCase();
                const isFreeTier = tierLower === 'free' || tierLower.includes('starter');
                const accCycles: QuotaCycleRecord[] = [];

                for (const rec of acc.records || []) {
                    const norm = normalizeRecord(rec, acc.account_id, acc.email, acc.subscription_tier);
                    if (isFreeTier && norm.window === '5h') {
                        continue;
                    }
                    accCycles.push(norm);
                    cycles.push(norm);
                }

                if (accCycles.length > 0) {
                    summaries.push({
                        account_id: acc.account_id,
                        email: acc.email,
                        total_cycles: accCycles.length,
                        active_cycles: accCycles.filter(c => c.status === 'active').length,
                        total_consumed_usd: accCycles.reduce((s, c) => s + (c.used_usd ?? 0), 0),
                        latest_reset_time: accCycles[0]?.reset_time,
                    });
                }
            }
        } else if (Array.isArray(data.cycles)) {
            const accMap = new Map<string, QuotaCycleAccountSummary>();
            for (const rec of data.cycles) {
                const norm = normalizeRecord(rec, rec.account_id, rec.email, rec.subscription_tier);
                cycles.push(norm);
                const existing = accMap.get(norm.account_id) || {
                    account_id: norm.account_id,
                    email: norm.email || norm.account_id.slice(0, 8),
                    total_cycles: 0,
                    active_cycles: 0,
                    total_consumed_usd: 0,
                };
                existing.total_cycles += 1;
                if (norm.status === 'active') existing.active_cycles += 1;
                existing.total_consumed_usd += norm.used_usd ?? 0;
                accMap.set(norm.account_id, existing);
            }
            summaries.push(...(data.accounts_summary || Array.from(accMap.values())));
        }

        cycles.sort((a, b) => b.reset_ts - a.reset_ts);
        return { allCycles: cycles, accountsSummary: summaries };
    }, [data]);

    // 过滤后的周期列表
    const filteredCycles = useMemo(() => {
        return allCycles.filter(c => {
            if (selectedAccount !== 'all' && c.account_id !== selectedAccount) return false;
            if (selectedPool !== 'all' && c.pool !== selectedPool) return false;
            if (selectedWindow !== 'all') {
                const isWeekly = c.window.toLowerCase().includes('week');
                if (selectedWindow === 'weekly' && !isWeekly) return false;
                if (selectedWindow === '5h' && isWeekly) return false;
            }
            if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
            return true;
        });
    }, [allCycles, selectedAccount, selectedPool, selectedWindow, selectedStatus]);

    // 汇总指标计算
    const metrics = useMemo(() => {
        if (allCycles.length === 0) {
            return {
                totalCycles: 0,
                activeCycles: 0,
                totalConsumedUsd: 0,
                totalConsumedCny: 0,
                totalCheckpoints: 0,
                avgDeltaPct: 0,
            };
        }
        const active = filteredCycles.filter(c => c.status === 'active').length;
        const totalUsedUsd = filteredCycles.reduce((sum, c) => sum + (c.used_usd ?? 0), 0);
        const rate = data?.usd_to_cny_rate || 7.2;
        const totalCheckpoints = filteredCycles.reduce((sum, c) => sum + (c.checkpoints?.length || 0), 0);

        const cyclesWithDelta = filteredCycles.filter(c => c.delta_total_pct != null);
        const avgDelta = cyclesWithDelta.length > 0
            ? cyclesWithDelta.reduce((sum, c) => sum + (c.delta_total_pct ?? 0), 0) / cyclesWithDelta.length
            : 0;

        return {
            totalCycles: filteredCycles.length,
            activeCycles: active,
            totalConsumedUsd: totalUsedUsd,
            totalConsumedCny: totalUsedUsd * rate,
            totalCheckpoints,
            avgDeltaPct: avgDelta,
        };
    }, [allCycles.length, filteredCycles, data?.usd_to_cny_rate]);

    // 趋势图展示的最近 10 个周期
    const chartCycles = useMemo(() => {
        return [...filteredCycles].slice(0, 10).reverse();
    }, [filteredCycles]);

    // 格式化时间辅助函数
    const formatTime = (isoString?: string) => {
        if (!isoString) return '—';
        try {
            const d = new Date(isoString);
            return d.toLocaleString(pickLang('zh-CN', 'ru-RU', 'en-US'), {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return isoString;
        }
    };

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="modal modal-open z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                    {/* Draggable Top Region */}
                    <div data-tauri-drag-region className="fixed top-0 left-0 right-0 h-8 z-[1]" />

                    {/* Click outside to close */}
                    <div className="absolute inset-0 z-[0]" onClick={onClose} />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 8 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }}
                        className="bg-white dark:bg-[#141417] text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl shadow-black/40 w-full max-w-5xl p-6 relative z-[10] m-4 max-h-[94vh] flex flex-col border border-zinc-200 dark:border-white/[0.1]"
                    >
                        {/* 1. Header */}
                        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200/80 dark:border-white/[0.08] shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                                        {pickLang('周期额度变化与消耗统计', 'История циклов квот и аналитика', 'Quota Cycle History & Analytics')}
                                    </h3>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-300 font-mono font-medium border border-zinc-200/80 dark:border-white/[0.1]">
                                        5h / Weekly
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    {pickLang(
                                        '自动记录账号在各重置周期内的起始余量、实际消耗幅度、检查点采样与环比变化',
                                        'Автоматически фиксирует стартовую квоту, расход, контрольные точки и изменение от цикла к циклу',
                                        'Tracks initial quota, real usage deltas, checkpoints, and cycle-over-cycle changes'
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadData}
                                    disabled={loading}
                                    className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                                    title={pickLang('刷新历史数据', 'Обновить историю', 'Refresh')}
                                >
                                    <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* 2. 4 张统计汇总卡 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-3.5 shrink-0">
                            {/* 卡 1：监控周期数 */}
                            <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-[#19191d] border border-zinc-200/70 dark:border-white/[0.08]">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                    <span>{pickLang('监控周期数', 'Отслеживаемые циклы', 'Monitored Cycles')}</span>
                                    <Calendar className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-1.5">
                                    <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                                        {metrics.totalCycles}
                                    </span>
                                    <span className="text-xs text-zinc-400">
                                        ({pickLang(`活跃 ${metrics.activeCycles}`, `Актив. ${metrics.activeCycles}`, `Active ${metrics.activeCycles}`)})
                                    </span>
                                </div>
                            </div>

                            {/* 卡 2：累计消耗费用 */}
                            <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-[#19191d] border border-zinc-200/70 dark:border-white/[0.08]">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                    <span>{pickLang('累计周期消耗', 'Суммарный расход', 'Total Consumed')}</span>
                                    <DollarSign className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-1.5">
                                    <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                                        {formatCurrencyCompact(metrics.totalConsumedUsd, metrics.totalConsumedCny, currencyMode)}
                                    </span>
                                </div>
                            </div>

                            {/* 卡 3：平均环比变化 */}
                            <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-[#19191d] border border-zinc-200/70 dark:border-white/[0.08]">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                    <span>{pickLang('平均环比变动', 'Среднее изм. (CoC)', 'Avg. CoC Delta')}</span>
                                    {metrics.avgDeltaPct >= 0 ? (
                                        <TrendingUp className="w-4 h-4 text-amber-500" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                                    )}
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-1.5">
                                    <span
                                        className={cn(
                                            'text-xl font-bold font-mono',
                                            metrics.avgDeltaPct > 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : metrics.avgDeltaPct < 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-zinc-600 dark:text-zinc-300'
                                        )}
                                    >
                                        {metrics.avgDeltaPct > 0 ? `+${metrics.avgDeltaPct.toFixed(1)}%` : `${metrics.avgDeltaPct.toFixed(1)}%`}
                                    </span>
                                    <span className="text-xs text-zinc-400">
                                        {pickLang('跨周期基准', 'к пред.', 'vs prev')}
                                    </span>
                                </div>
                            </div>

                            {/* 卡 4：采样检查点 */}
                            <div className="p-3 rounded-xl bg-zinc-50/80 dark:bg-[#19191d] border border-zinc-200/70 dark:border-white/[0.08]">
                                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                                    <span>{pickLang('有效检查点', 'Контр. точки', 'Checkpoints')}</span>
                                    <Layers className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                </div>
                                <div className="mt-1.5 flex items-baseline gap-1.5">
                                    <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                                        {metrics.totalCheckpoints}
                                    </span>
                                    <span className="text-xs text-zinc-400">
                                        {pickLang('防刷屏去重', 'Без дублей', 'Filtered')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. 周期额度变化与消耗趋势可视化柱状图 */}
                        {chartCycles.length > 0 && (
                            <div className="p-3 mb-3 rounded-xl bg-zinc-50/70 dark:bg-[#17171b] border border-zinc-200/70 dark:border-white/[0.07] shrink-0">
                                <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                                    <span className="flex items-center gap-1.5">
                                        <BarChart3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                        {pickLang('近期周期消耗深度对比图', 'График расхода по недавним циклам', 'Recent Cycle Consumption Trend')}
                                    </span>
                                    <span className="text-[10px] text-zinc-400 font-normal">
                                        {pickLang('柱高代表周期内已消耗额度占比 (%)', 'Высота столбца показывает долю расхода (%)', 'Bar height shows consumed fraction (%)')}
                                    </span>
                                </div>
                                <div className="h-20 flex items-end gap-2 pt-2 px-1">
                                    {chartCycles.map((cycle, index) => {
                                        const consumedPct = Math.round(cycle.consumed_fraction * 100);
                                        const barHeight = Math.max(8, Math.min(100, consumedPct));
                                        const rate = data?.usd_to_cny_rate || 7.2;
                                        const costStr = cycle.used_usd != null && cycle.used_usd > 0
                                            ? formatCurrencyCompact(cycle.used_usd, cycle.used_usd * rate, currencyMode)
                                            : '0';

                                        return (
                                            <div
                                                key={cycle.row_key}
                                                className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end"
                                                title={`${cycle.email ? `${cycle.email}\n` : ''}${formatPoolLabel(cycle.pool)} (${cycle.window === 'weekly' ? pickLang('周配额', 'Неделя', 'Weekly') : '5H'})\n${pickLang('已消耗', 'Израсходовано', 'Consumed')}: ${consumedPct}% (${costStr})\n${formatTime(cycle.reset_time)}`}
                                            >
                                                <div className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 opacity-80 group-hover:opacity-100 font-semibold">
                                                    {consumedPct}%
                                                </div>
                                                <div className="w-full bg-zinc-200 dark:bg-white/[0.08] rounded-t-md overflow-hidden flex flex-col justify-end" style={{ height: '52px' }}>
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: `${barHeight}%` }}
                                                        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: Math.min(index * 0.025, 0.25) }}
                                                        className={cn(
                                                            'w-full rounded-t-md',
                                                            consumedPct > 60
                                                                ? 'bg-rose-500 dark:bg-rose-500/90'
                                                                : consumedPct > 20
                                                                ? 'bg-amber-500 dark:bg-amber-500/90'
                                                                : 'bg-emerald-500 dark:bg-emerald-500/90'
                                                        )}
                                                    />
                                                </div>
                                                <div className="text-[8px] font-mono text-zinc-400 truncate w-full text-center">
                                                    {formatPoolShort(cycle.pool)}·{cycle.window === 'weekly' ? pickLang('周', 'Н', 'W') : '5H'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4. 过滤器工具栏（包含窗口过滤：全部 / 5H / 周配额） */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 shrink-0">
                            <div className="flex flex-wrap items-center gap-2">
                                {/* 账号下拉 */}
                                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                    <Filter className="w-3.5 h-3.5" />
                                    <select
                                        value={selectedAccount}
                                        onChange={e => setSelectedAccount(e.target.value)}
                                        className="px-2.5 py-1 rounded-lg text-xs bg-zinc-100 dark:bg-[#1c1c20] border border-zinc-200/80 dark:border-white/[0.08] font-medium text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-white/30"
                                    >
                                        <option value="all">{pickLang('全部账号', 'Все аккаунты', 'All Accounts')}</option>
                                        {accountsSummary.map(a => (
                                            <option key={a.account_id} value={a.account_id}>
                                                {a.email} ({a.total_cycles})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* 窗口类型过滤（5H / 周配额） */}
                                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-[#1b1b1f] p-0.5 rounded-lg text-xs border border-zinc-200/60 dark:border-white/[0.06]">
                                    {[
                                        { id: 'all', label: pickLang('全部窗口', 'Все окна', 'All Windows') },
                                        { id: '5h', label: '5H' },
                                        { id: 'weekly', label: pickLang('周配额', 'Неделя', 'Weekly') },
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedWindow(item.id)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-md transition-colors font-medium',
                                                selectedWindow === item.id
                                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {/* 配额池类型过滤 */}
                                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-[#1b1b1f] p-0.5 rounded-lg text-xs border border-zinc-200/60 dark:border-white/[0.06]">
                                    {[
                                        { id: 'all', label: pickLang('全部池', 'Все пулы', 'All Pools') },
                                        { id: 'gemini', label: 'Gemini' },
                                        { id: 'third_party', label: pickLang('第三方', 'Сторонние', '3rd Party') },
                                        { id: 'argon', label: 'Argon' },
                                        { id: 'carbon', label: 'Carbon' },
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedPool(item.id)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-md transition-colors font-medium',
                                                selectedPool === item.id
                                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>

                                {/* 状态过滤 */}
                                <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-[#1b1b1f] p-0.5 rounded-lg text-xs border border-zinc-200/60 dark:border-white/[0.06]">
                                    {[
                                        { id: 'all', label: pickLang('全部状态', 'Все', 'All') },
                                        { id: 'active', label: pickLang('进行中', 'Активные', 'Active') },
                                        { id: 'completed', label: pickLang('已归档', 'Архив', 'Archived') },
                                    ].map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedStatus(item.id)}
                                            className={cn(
                                                'px-2.5 py-1 rounded-md transition-colors font-medium',
                                                selectedStatus === item.id
                                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 5. 周期流水表格 */}
                        <div className="flex-1 overflow-y-auto min-h-0 border border-zinc-200 dark:border-white/[0.08] rounded-xl bg-white dark:bg-[#111113]">
                            {loading && filteredCycles.length === 0 ? (
                                <div className="flex items-center justify-center p-10 text-sm text-zinc-500 dark:text-zinc-400">
                                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-zinc-500 dark:text-zinc-300" />
                                    {pickLang('正在载入周期流水…', 'Загрузка истории циклов…', 'Loading cycle ledger…')}
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center p-10 text-sm text-rose-500 gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>{error}</span>
                                </div>
                            ) : filteredCycles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-10 text-center text-zinc-400">
                                    <Activity className="w-10 h-10 stroke-1 mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                        {pickLang('暂无周期历史记录', 'Истории циклов пока нет', 'No cycle history yet')}
                                    </p>
                                    <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                                        {pickLang(
                                            '系统已自动建立周期账本，刷新配额或产生模型调用后即可看到完整变动。',
                                            'Журнал автоматически фиксирует изменения после обновления или расхода квот.',
                                            'The ledger will automatically capture quota changes after refreshing or consuming quota.'
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-zinc-50/95 dark:bg-[#17171b]/95 text-zinc-500 dark:text-zinc-400 sticky top-0 backdrop-blur-sm z-10 border-b border-zinc-200 dark:border-white/[0.08] font-semibold">
                                        <tr>
                                            <th className="py-2.5 px-3 w-8"></th>
                                            <th className="py-2.5 px-3">{pickLang('账号', 'Аккаунт', 'Account')}</th>
                                            <th className="py-2.5 px-3">{pickLang('配额池 / 窗口', 'Пул / Окно', 'Pool / Window')}</th>
                                            <th className="py-2.5 px-3">{pickLang('周期时段', 'Период цикла', 'Cycle Time')}</th>
                                            <th className="py-2.5 px-3">{pickLang('余量起始 → 最新', 'Диапазон квоты', 'Quota Range')}</th>
                                            <th className="py-2.5 px-3">{pickLang('累计消耗', 'Расход', 'Consumed')}</th>
                                            <th className="py-2.5 px-3">{pickLang('估值费用', 'Оценка', 'Valuation')}</th>
                                            <th className="py-2.5 px-3">{pickLang('环比上期', 'К пред.', 'vs Previous')}</th>
                                            <th className="py-2.5 px-3">{pickLang('状态', 'Статус', 'Status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05] font-mono text-[11px]">
                                        {filteredCycles.map(cycle => {
                                            const isExpanded = expandedCycleKey === cycle.row_key;
                                            const startPct = Math.round(cycle.first_observed_remaining * 100);
                                            const latestPct = Math.round(cycle.latest_remaining * 100);
                                            const consumedPct = Math.round(cycle.consumed_fraction * 100);
                                            const deltaPct = cycle.delta_total_pct != null ? Math.round(cycle.delta_total_pct) : null;
                                            const rate = data?.usd_to_cny_rate || 7.2;
                                            const usedCny = (cycle.used_usd ?? 0) * rate;
                                            const isWeekly = cycle.window === 'weekly';

                                            return (
                                                <React.Fragment key={cycle.row_key}>
                                                    <tr
                                                        onClick={() => setExpandedCycleKey(isExpanded ? null : cycle.row_key)}
                                                        className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                                                    >
                                                        <td className="py-2 px-3 text-zinc-400">
                                                            {cycle.checkpoints?.length > 0 ? (
                                                                isExpanded ? (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                                )
                                                            ) : null}
                                                        </td>
                                                        <td className="py-2 px-3 truncate max-w-[140px] font-sans font-medium text-zinc-800 dark:text-zinc-200">
                                                            <span title={cycle.email || cycle.account_id}>
                                                                {cycle.email || cycle.account_id.slice(0, 8)}
                                                            </span>
                                                            {cycle.subscription_tier && (
                                                                <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-zinc-200/70 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300 uppercase">
                                                                    {cycle.subscription_tier}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                                                                {formatPoolLabel(cycle.pool)}
                                                            </span>
                                                            <span
                                                                className={cn(
                                                                    'ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-medium border',
                                                                    isWeekly
                                                                        ? 'bg-zinc-200/70 dark:bg-white/[0.08] text-zinc-800 dark:text-zinc-200 border-zinc-300/60 dark:border-white/[0.12]'
                                                                        : 'bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 border-zinc-200/70 dark:border-white/[0.08]'
                                                                )}
                                                            >
                                                                {isWeekly ? pickLang('周配额', 'Неделя', 'Weekly') : '5H'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">
                                                            <span>{formatTime(cycle.start_time)}</span>
                                                            <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>
                                                            <span>{formatTime(cycle.reset_time)}</span>
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            <span className="text-zinc-500">{startPct}%</span>
                                                            <span className="mx-1 text-zinc-300 dark:text-zinc-600">→</span>
                                                            <span className="font-bold text-zinc-900 dark:text-white">
                                                                {latestPct}%
                                                            </span>
                                                        </td>
                                                        <td className="py-2 px-3 font-semibold text-rose-600 dark:text-rose-400">
                                                            {consumedPct > 0 ? `-${consumedPct}%` : '0%'}
                                                            {cycle.last_delta_fraction !== 0 && (
                                                                <span className="text-[10px] font-normal opacity-75 ml-1">
                                                                    ({cycle.last_delta_fraction < 0 ? `↓${Math.round(Math.abs(cycle.last_delta_fraction) * 100)}%` : `↑${Math.round(cycle.last_delta_fraction * 100)}%`})
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-zinc-800 dark:text-zinc-200">
                                                            {cycle.used_usd != null && cycle.used_usd > 0
                                                                ? formatCurrencyCompact(cycle.used_usd, usedCny, currencyMode)
                                                                : '—'}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {deltaPct != null ? (
                                                                <span
                                                                    className={cn(
                                                                        'px-1.5 py-0.5 rounded text-[10px] font-semibold border',
                                                                        deltaPct > 0
                                                                            ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                                                                            : deltaPct < 0
                                                                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                                                            : 'text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20'
                                                                    )}
                                                                >
                                                                    {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                                                                </span>
                                                            ) : (
                                                                <span className="text-zinc-400">—</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3">
                                                            {cycle.status === 'active' ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                                    {pickLang('进行中', 'Активен', 'Active')}
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-white/[0.07] text-zinc-500 dark:text-zinc-400">
                                                                    {pickLang('已归档', 'В архиве', 'Archived')}
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>

                                                    {/* 展开的检查点详细轨迹 */}
                                                    {isExpanded && cycle.checkpoints?.length > 0 && (
                                                        <tr className="bg-zinc-50/60 dark:bg-white/[0.02]">
                                                            <td colSpan={9} className="p-3 pl-8">
                                                                <div className="text-[11px] font-sans font-medium text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                                                                    <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" />
                                                                    <span>{pickLang('本周期采样检查点轨迹 (最新在前)', 'Лента контрольных точек цикла', 'Cycle Checkpoint Timeline')}</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {cycle.checkpoints.map((cp, idx) => {
                                                                        const timeStr = new Date(cp.timestamp * 1000).toLocaleTimeString(pickLang('zh-CN', 'ru-RU', 'en-US'), {
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                            second: '2-digit',
                                                                        });
                                                                        const remPct = Math.round(cp.remaining_fraction * 100);
                                                                        const deltaStr = cp.delta_fraction < 0
                                                                            ? `↓${Math.round(Math.abs(cp.delta_fraction) * 100)}%`
                                                                            : `↑${Math.round(cp.delta_fraction * 100)}%`;
                                                                        return (
                                                                            <div
                                                                                key={idx}
                                                                                className="px-2 py-1 rounded bg-white dark:bg-[#19191d] border border-zinc-200/70 dark:border-white/[0.08] text-[10px] font-mono flex items-center gap-1.5 shadow-2xs"
                                                                            >
                                                                                <span className="text-zinc-400">{timeStr}</span>
                                                                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{remPct}%</span>
                                                                                {cp.delta_fraction !== 0 && (
                                                                                    <span
                                                                                        className={cn(
                                                                                            'font-semibold',
                                                                                            cp.delta_fraction < 0
                                                                                                ? 'text-rose-500'
                                                                                                : 'text-emerald-500'
                                                                                        )}
                                                                                    >
                                                                                        {deltaStr}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* 6. Footer */}
                        <div className="flex items-center justify-between pt-3 mt-2 border-t border-zinc-200/80 dark:border-white/[0.08] shrink-0 text-xs text-zinc-400">
                            <div>
                                {pickLang(
                                    `共计 ${filteredCycles.length} 条周期记录 · 纯本地私密存储`,
                                    `Записей: ${filteredCycles.length} · Локальное хранение`,
                                    `${filteredCycles.length} records · Private local storage`
                                )}
                            </div>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-zinc-100 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-200 font-medium rounded-xl hover:bg-zinc-200 dark:hover:bg-white/[0.12] transition-colors"
                            >
                                {pickLang('关闭', 'Закрыть', 'Close')}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
