import { formatCurrencyCompact, formatCurrencyAmount, CurrencyMode } from './currency';

export interface BucketValuation {
    bucket_id: string;
    window: string;
    pool: 'gemini' | 'third_party' | 'argon' | 'carbon' | 'unknown';
    remaining_fraction: number;
    reset_time: string;
    provenance: 'observed' | 'exhausted' | 'used_only' | 'manual_reference' | 'calibrated' | 'estimated_reference' | 'none';
    used_usd: number;
    used_tokens: number;
    estimated_total_usd?: number;
    estimated_remaining_usd?: number;
    estimated_total_tokens?: number;
    estimated_remaining_tokens?: number;
    used_cny: number;
    estimated_total_cny?: number;
    estimated_remaining_cny?: number;
    last_delta_fraction?: number;
    consumed_fraction?: number;
    delta_total_usd?: number;
    delta_total_pct?: number;
    warning?: string;
}

export interface AccountQuotaValuation {
    account_id: string;
    email: string;
    subscription_tier?: string;
    is_active: boolean;
    buckets: BucketValuation[];
    unpriced_events_count: number;
}

export interface QuotaValuationResponse {
    accounts: AccountQuotaValuation[];
    currency: 'usd' | 'cny' | 'both';
    display_mode: 'remaining' | 'used_and_total';
    usd_to_cny_rate: number;
    rate_stale: boolean;
    calculated_at: number;
}

/**
 * 紧凑格式化 Token 数值 (如 0, 850, 34.0K, 1.77M, 1.2B)
 */
export function formatCompactTokens(tokens: number | undefined | null): string {
    if (tokens == null || !Number.isFinite(tokens) || tokens <= 0) {
        return '0';
    }
    if (tokens < 1000) {
        return tokens.toString();
    }
    if (tokens < 1_000_000) {
        const k = tokens / 1000;
        return `${k.toFixed(k < 10 ? 1 : 0)}K`;
    }
    if (tokens < 1_000_000_000) {
        const m = tokens / 1_000_000;
        return `${m.toFixed(2).replace(/\.?0+$/, '')}M`;
    }
    const b = tokens / 1_000_000_000;
    return `${b.toFixed(2).replace(/\.?0+$/, '')}B`;
}

/**
 * 周视图匹配桶：精确按 bucket_id
 */
export function findBucketForWeekly(
    buckets: BucketValuation[] | undefined,
    bucketId: string
): BucketValuation | undefined {
    if (!buckets || !bucketId) return undefined;
    const lowerId = bucketId.toLowerCase();
    return buckets.find(b => b.bucket_id.toLowerCase() === lowerId);
}

/**
 * 5h 视图匹配桶：按 pool 与 5h 窗口 (Argon 可回退 weekly)
 */
export function findBucketFor5h(
    buckets: BucketValuation[] | undefined,
    pool: 'gemini' | 'third_party' | 'argon' | 'carbon',
    windowHint?: '5h' | 'weekly'
): BucketValuation | undefined {
    if (!buckets) return undefined;
    if (windowHint === 'weekly') {
        const weekly = buckets.find(
            b => b.pool === pool && (b.window.toLowerCase().includes('week') || b.bucket_id.toLowerCase().includes('week'))
        );
        if (weekly) return weekly;
        return buckets.find(b => b.pool === pool);
    }
    // 优先匹配 5h 窗口，绝不把 weekly 错配到 Gemini / 3P 的 5h 行
    const exact = buckets.find(
        b => b.pool === pool && (b.window.toLowerCase().includes('5h') || (!b.window.toLowerCase().includes('week') && !b.bucket_id.toLowerCase().includes('week')))
    );
    if (exact) return exact;
    // 仅 Argon / Carbon 等纯周窗口池在 5h 视图回退其池桶
    if (pool === 'argon' || pool === 'carbon') {
        return buckets.find(b => b.pool === pool);
    }
    return undefined;
}

export interface ValuationDisplayResult {
    line: string;
    title: string;
}

function resolveValuationLang(langOrIsZh: boolean | string = true): 'ru' | 'zh' | 'en' {
    if (typeof langOrIsZh === 'boolean') return langOrIsZh ? 'zh' : 'en';
    const lower = langOrIsZh.toLowerCase();
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('zh')) return 'zh';
    return 'en';
}

/**
 * 生成紧凑折算展示文案与提示
 */
export function formatValuationDisplay(
    valuation: BucketValuation | undefined,
    currencyMode: CurrencyMode = 'usd',
    displayMode: 'remaining' | 'used_and_total' = 'remaining',
    langOrIsZh: boolean | string = true
): ValuationDisplayResult | null {
    if (!valuation || valuation.provenance === 'none') {
        return null;
    }

    const lang = resolveValuationLang(langOrIsZh);
    const isZh = lang === 'zh';
    const isRu = lang === 'ru';

    const {
        provenance,
        used_usd,
        used_cny,
        used_tokens,
        estimated_total_usd,
        estimated_total_cny,
        estimated_total_tokens,
        estimated_remaining_usd,
        estimated_remaining_cny,
        estimated_remaining_tokens,
        warning,
    } = valuation;

    const usedCost = formatCurrencyCompact(used_usd, used_cny, currencyMode);
    const usedTok = formatCompactTokens(used_tokens);

    if (displayMode === 'remaining') {
        if (provenance === 'observed') {
            const remTok = formatCompactTokens(estimated_remaining_tokens ?? 0);
            const totalTok = formatCompactTokens(estimated_total_tokens ?? 0);

            if (estimated_remaining_usd != null) {
                const remCost = formatCurrencyCompact(estimated_remaining_usd, estimated_remaining_cny ?? 0, currencyMode);
                const totalCost = formatCurrencyCompact(estimated_total_usd ?? 0, estimated_total_cny ?? 0, currencyMode);
                const title = `${isZh ? '本周期预估总额' : isRu ? 'Оценка лимита' : 'Est. Total'}: ${totalCost} (${totalTok})\n${isZh ? '已消耗' : isRu ? 'Израсходовано' : 'Used'}: ${usedCost} (${usedTok})\n${isZh ? '剩余' : isRu ? 'Осталось' : 'Remaining'}: ${remCost} (${remTok})${warning ? `\n⚠️ ${warning}` : ''}`;
                return {
                    line: `≈ ${remCost} · ${remTok}`,
                    title,
                };
            } else {
                const title = `${isZh ? '本周期预估总额' : isRu ? 'Оценка лимита' : 'Est. Total'}: ${totalTok}\n${isZh ? '已消耗' : isRu ? 'Израсходовано' : 'Used'}: ${usedTok}\n${isZh ? '剩余' : isRu ? 'Осталось' : 'Remaining'}: ${remTok}${warning ? `\n⚠️ ${warning}` : ''}`;
                return {
                    line: `≈ ${remTok} tokens`,
                    title,
                };
            }
        }

        if (provenance === 'calibrated' || provenance === 'manual_reference' || provenance === 'estimated_reference') {
            const remTok = formatCompactTokens(estimated_remaining_tokens ?? 0);
            const totalTok = formatCompactTokens(estimated_total_tokens ?? 0);
            const prefix = provenance === 'estimated_reference'
                ? (isZh ? '预估' : isRu ? 'Оц.' : 'Est')
                : (isZh ? '参考' : isRu ? 'Ориент.' : 'Ref');
            const sourceLabel = provenance === 'manual_reference'
                ? (isZh ? '自定义参考基准' : isRu ? 'Пользовательский ориентир' : 'Manual Reference')
                : provenance === 'calibrated'
                ? (isZh ? '同档位历史样本校准' : isRu ? 'Откалибровано по истории' : 'Calibrated Benchmark')
                : (isZh ? '档位经验基准（随本地实测自动校准）' : isRu ? 'Ориентир тарифа (автокалибровка)' : 'Tier Benchmark (auto-calibrated locally)');

            if (estimated_remaining_usd != null) {
                const remCost = formatCurrencyCompact(estimated_remaining_usd, estimated_remaining_cny ?? 0, currencyMode);
                const totalCost = formatCurrencyCompact(estimated_total_usd ?? 0, estimated_total_cny ?? 0, currencyMode);
                const title = `[${sourceLabel}]\n${isZh ? '预估基准总额' : isRu ? 'Базовый лимит' : 'Benchmark Total'}: ${totalCost} (${totalTok})\n${isZh ? '等效剩余' : isRu ? 'Эквив. остаток' : 'Equiv. Remaining'}: ${remCost} (${remTok})${warning ? `\n⚠️ ${warning}` : ''}`;
                return {
                    line: `${prefix} ≈ ${remCost} · ${remTok}`,
                    title,
                };
            } else {
                const title = `[${sourceLabel}]\n${isZh ? '预估基准总额' : isRu ? 'Базовый лимит' : 'Benchmark Total'}: ${totalTok}\n${isZh ? '等效剩余' : isRu ? 'Эквив. остаток' : 'Equiv. Remaining'}: ${remTok}${warning ? `\n⚠️ ${warning}` : ''}`;
                return {
                    line: `${prefix} ≈ ${remTok} tokens`,
                    title,
                };
            }
        }

        if (provenance === 'exhausted') {
            const zeroCost = formatCurrencyCompact(0, 0, currencyMode);
            const usedLabel = isZh ? '已用' : isRu ? 'Расход' : 'Used';
            const title = `${isZh ? '本周期额度已耗尽' : isRu ? 'Квота за цикл исчерпана' : 'Quota exhausted'}\n${isZh ? '实际消耗' : isRu ? 'Фактический расход' : 'Actual consumption'}: ${usedCost} (${usedTok})`;
            return {
                line: `${zeroCost} · 0 (${usedLabel} ${usedCost} · ${usedTok})`,
                title,
            };
        }

        if (provenance === 'used_only') {
            const usedLabel = isZh ? '已用' : isRu ? 'Расход' : 'Used';
            const title = `${isZh ? '实际消耗' : isRu ? 'Фактический расход' : 'Actual consumption'}: ${usedCost} (${usedTok})\n${isZh ? '消耗量极小（<3%），为防误差未做总额推算' : isRu ? 'Расход <3%, экстраполяция пропущена' : 'Extrapolation skipped (<3% usage)'}`;
            return {
                line: `${usedLabel} ${usedCost} · ${usedTok}`,
                title,
            };
        }
    } else {
        // used_and_total 模式
        if (provenance === 'observed' || provenance === 'exhausted') {
            const totalTok = formatCompactTokens(estimated_total_tokens ?? 0);
            if (estimated_total_usd != null) {
                const totalCost = formatCurrencyAmount(estimated_total_usd, estimated_total_cny ?? 0, currencyMode);
                const title = `${isZh ? '本周期消耗' : isRu ? 'Расход' : 'Used'}: ${usedCost} (${usedTok})\n${isZh ? '预估总额' : isRu ? 'Оценка лимита' : 'Est. Total'}: ${totalCost} (${totalTok})`;
                return {
                    line: `↓ ${usedCost} / ${usedTok} · ↑ ${totalCost} / ${totalTok}`,
                    title,
                };
            } else {
                const title = `${isZh ? '本周期消耗' : isRu ? 'Расход' : 'Used'}: ${usedTok}\n${isZh ? '预估总额' : isRu ? 'Оценка лимита' : 'Est. Total'}: ${totalTok}`;
                return {
                    line: `↓ ${usedTok} · ↑ ${totalTok}`,
                    title,
                };
            }
        }

        if (provenance === 'calibrated' || provenance === 'manual_reference' || provenance === 'estimated_reference') {
            const totalTok = formatCompactTokens(estimated_total_tokens ?? 0);
            const sourceLabel = provenance === 'manual_reference'
                ? (isZh ? '自定义参考基准' : isRu ? 'Пользовательский ориентир' : 'Manual Reference')
                : provenance === 'calibrated'
                ? (isZh ? '同档位历史样本校准' : isRu ? 'Откалибровано по истории' : 'Calibrated Benchmark')
                : (isZh ? '档位经验基准（随本地实测自动校准）' : isRu ? 'Ориентир тарифа (автокалибровка)' : 'Tier Benchmark (auto-calibrated locally)');
            if (estimated_total_usd != null) {
                const totalCost = formatCurrencyAmount(estimated_total_usd, estimated_total_cny ?? 0, currencyMode);
                const title = `[${sourceLabel}]\n${isZh ? '已用' : isRu ? 'Расход' : 'Used'}: ${usedCost} (${usedTok})\n${isZh ? '基准总额' : isRu ? 'Базовый лимит' : 'Benchmark Total'}: ${totalCost} (${totalTok})`;
                return {
                    line: `↓ ${usedCost} / ${usedTok} · ≈ ${totalCost} / ${totalTok}`,
                    title,
                };
            } else {
                const title = `[${sourceLabel}]\n${isZh ? '已用' : isRu ? 'Расход' : 'Used'}: ${usedTok}\n${isZh ? '基准总额' : isRu ? 'Базовый лимит' : 'Benchmark Total'}: ${totalTok}`;
                return {
                    line: `↓ ${usedTok} · ≈ ${totalTok}`,
                    title,
                };
            }
        }

        if (provenance === 'used_only') {
            const title = `${isZh ? '实际消耗' : isRu ? 'Фактический расход' : 'Actual consumption'}: ${usedCost} (${usedTok})\n${isZh ? '消耗量极小（<3%），为防误差未做总额推算' : isRu ? 'Расход <3%, экстраполяция пропущена' : 'Extrapolation skipped (<3% usage)'}`;
            return {
                line: `↓ ${usedCost} / ${usedTok}`,
                title,
            };
        }
    }

    return null;
}

export interface ValuationStructuredResult {
    usedText: string;
    quotaText?: string;
    badge?: string;
    lastDeltaText?: string;
    cycleCompareText?: string;
    cycleCompareTone?: 'increase' | 'decrease' | 'flat';
    title: string;
}

/**
 * 结构化格式化折算数据，供图 1 同款三段式 UI 高清渲染
 */
export function formatValuationStructured(
    valuation: BucketValuation | undefined,
    currencyMode: CurrencyMode = 'usd',
    displayMode: 'remaining' | 'used_and_total' = 'remaining',
    langOrIsZh: boolean | string = true
): ValuationStructuredResult | null {
    if (!valuation || valuation.provenance === 'none') {
        return null;
    }

    const lang = resolveValuationLang(langOrIsZh);
    const isZh = lang === 'zh';
    const isRu = lang === 'ru';

    const {
        provenance,
        used_usd,
        used_cny,
        used_tokens,
        estimated_total_usd,
        estimated_total_cny,
        estimated_total_tokens,
        estimated_remaining_usd,
        estimated_remaining_cny,
        estimated_remaining_tokens,
        last_delta_fraction,
        delta_total_pct,
        warning,
    } = valuation;

    const usedCost = formatCurrencyCompact(used_usd, used_cny, currencyMode);
    const usedTok = formatCompactTokens(used_tokens);
    const usedText = `${usedCost} / ${usedTok}`;

    let quotaText: string | undefined;
    let badge: string | undefined;

    const isRemaining = displayMode === 'remaining';
    const targetUsd = isRemaining ? estimated_remaining_usd : estimated_total_usd;
    const targetCny = isRemaining ? estimated_remaining_cny : estimated_total_cny;
    const targetTok = formatCompactTokens(isRemaining ? estimated_remaining_tokens : estimated_total_tokens);
    const labelPrefix = isZh
        ? (isRemaining ? '剩余' : '总额')
        : isRu
        ? (isRemaining ? 'Ост.' : 'Лимит')
        : (isRemaining ? 'Left' : 'Cap');

    if (targetUsd != null) {
        const costStr = formatCurrencyCompact(targetUsd, targetCny ?? 0, currencyMode);
        quotaText = `${labelPrefix} ${costStr} / ${targetTok}`;
    } else if (targetTok !== '0') {
        quotaText = `${labelPrefix} ${targetTok}`;
    }

    if (provenance === 'calibrated') {
        badge = isZh ? '校准' : isRu ? 'Калибр.' : 'Cal';
    } else if (provenance === 'manual_reference') {
        badge = isZh ? '自定义' : isRu ? 'Ручн.' : 'Ref';
    } else if (provenance === 'estimated_reference') {
        badge = isZh ? '预估' : isRu ? 'Оц.' : 'Est';
    }

    let lastDeltaText: string | undefined;
    if (last_delta_fraction != null && Math.abs(last_delta_fraction) >= 0.005) {
        const pct = Math.round(Math.abs(last_delta_fraction) * 100);
        lastDeltaText = last_delta_fraction < 0 ? `↓${pct}%` : `↑${pct}%`;
    }

    let cycleCompareText: string | undefined;
    let cycleCompareTone: 'increase' | 'decrease' | 'flat' | undefined;
    if ((provenance === 'observed' || provenance === 'exhausted') && delta_total_pct != null && Math.abs(delta_total_pct) <= 100) {
        const pct = Math.round(delta_total_pct);
        if (pct > 0) {
            cycleCompareText = isZh ? `环比 +${pct}%` : isRu ? `+${pct}% к прошл.` : `+${pct}% vs last`;
            cycleCompareTone = 'increase';
        } else if (pct < 0) {
            cycleCompareText = isZh ? `环比 ${pct}%` : isRu ? `${pct}% к прошл.` : `${pct}% vs last`;
            cycleCompareTone = 'decrease';
        }
    }

    const totalTok = formatCompactTokens(estimated_total_tokens ?? 0);
    const remTok = formatCompactTokens(estimated_remaining_tokens ?? 0);
    const totalCost = estimated_total_usd != null ? formatCurrencyCompact(estimated_total_usd, estimated_total_cny ?? 0, currencyMode) : undefined;
    const remCost = estimated_remaining_usd != null ? formatCurrencyCompact(estimated_remaining_usd, estimated_remaining_cny ?? 0, currencyMode) : undefined;

    const title = [
        totalCost ? `${isZh ? '预估总额' : isRu ? 'Оценка лимита' : 'Est. Total'}: ${totalCost} (${totalTok})` : undefined,
        `${isZh ? '已消耗' : isRu ? 'Израсходовано' : 'Used'}: ${usedCost} (${usedTok})`,
        remCost ? `${isZh ? '剩余' : isRu ? 'Осталось' : 'Remaining'}: ${remCost} (${remTok})` : undefined,
        lastDeltaText ? `${isZh ? '最近单次变化' : isRu ? 'Последнее изм.' : 'Last delta'}: ${lastDeltaText}` : undefined,
        cycleCompareText ? `${isZh ? '周期环比变化' : isRu ? 'К прошлому циклу' : 'Cycle delta'}: ${cycleCompareText}` : undefined,
        warning ? `⚠️ ${warning}` : undefined,
    ].filter(Boolean).join('\n');

    return {
        usedText,
        quotaText,
        badge,
        lastDeltaText,
        cycleCompareText,
        cycleCompareTone,
        title,
    };
}

export function resolveDisplayModelValuation(
    modelId: string,
    poolKindRaw: 'gemini' | 'other' | 'argon' | 'carbon' | null,
    resolvedWindow: '5h' | 'weekly',
    valuations: BucketValuation[] | undefined,
    valuationConfig: { enabled?: boolean; currency?: CurrencyMode; display_mode?: 'remaining' | 'used_and_total' } | undefined,
    language: string
): { valStructured: ValuationStructuredResult | null; valDisplay: ValuationDisplayResult | null } {
    if (valuationConfig?.enabled === false) {
        return { valStructured: null, valDisplay: null };
    }
    const lowerId = modelId.toLowerCase();
    const effectivePool = poolKindRaw
        ?? (lowerId.includes('claude') || lowerId.includes('gpt')
            ? 'other'
            : (lowerId.includes('carbon') || lowerId.includes('orchestrator')) && !lowerId.includes('argon')
            ? 'carbon'
            : lowerId.includes('argon')
            ? 'argon'
            : 'gemini');
    const poolKey = effectivePool === 'argon'
        ? 'argon'
        : effectivePool === 'carbon'
        ? 'carbon'
        : effectivePool === 'other'
        ? 'third_party'
        : 'gemini';
    const valuation = findBucketFor5h(valuations, poolKey, resolvedWindow === 'weekly' ? 'weekly' : '5h');
    const currency = valuationConfig?.currency ?? 'usd';
    const displayMode = valuationConfig?.display_mode ?? 'remaining';
    return {
        valStructured: formatValuationStructured(valuation, currency, displayMode, language),
        valDisplay: formatValuationDisplay(valuation, currency, displayMode, language),
    };
}
