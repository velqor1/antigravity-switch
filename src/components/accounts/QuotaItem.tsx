import { Clock, Lock, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { getQuotaColor, formatTimeRemaining } from '../../utils/format';
import type { ValuationStructuredResult } from '../../utils/quotaValuation';

interface QuotaItemProps {
    label: React.ReactNode;
    title?: string;
    percentage: number | null;
    resetTime?: string;
    windowLabel?: string;
    tierBadge?: string;
    isNew?: boolean;
    isDisabled?: boolean;
    isProtected?: boolean;
    className?: string;
    Icon?: React.ComponentType<{ size?: number; className?: string }>;
    valuationStructured?: ValuationStructuredResult | null;
    valuationLine?: React.ReactNode;
    valuationTitle?: string;
}

export function QuotaItem({
    label,
    title,
    percentage,
    resetTime,
    windowLabel,
    tierBadge,
    isNew,
    isDisabled,
    isProtected,
    className,
    Icon,
    valuationStructured,
    valuationLine,
    valuationTitle,
}: QuotaItemProps) {
    const { t, i18n } = useTranslation();

    const getBgColorClass = (p: number) => {
        const color = getQuotaColor(p);
        switch (color) {
            case 'success': return 'bg-emerald-500';
            case 'warning': return 'bg-amber-500';
            case 'error': return 'bg-rose-500';
            default: return 'bg-zinc-500';
        }
    };

    const getTextColorClass = (p: number) => {
        const color = getQuotaColor(p);
        switch (color) {
            case 'success': return 'text-emerald-600 dark:text-emerald-400';
            case 'warning': return 'text-amber-600 dark:text-amber-400';
            case 'error': return 'text-rose-600 dark:text-rose-400';
            default: return 'text-zinc-500';
        }
    };

    if (percentage === null || isDisabled) {
        return (
            <div
                className={cn(
                    "h-[26px] px-2.5 rounded-xl flex items-center justify-between text-zinc-400 dark:text-zinc-500 text-[11px] border border-zinc-200/75 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.025]",
                    className
                )}
                title={title || (typeof label === 'string' ? label : undefined)}
            >
                <span className="flex items-center gap-1.5 truncate font-medium">
                    {Icon && <Icon size={12} className="shrink-0 opacity-65" />}
                    <span className="truncate">{label}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                    {windowLabel && <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-white/[0.06]">{windowLabel}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-white/[0.05] text-zinc-500 dark:text-zinc-400">
                        {isDisabled ? t('accounts.model_unavailable', 'Unavailable') : '—'}
                    </span>
                </div>
            </div>
        );
    }

    const lang = i18n.language.toLowerCase();
    const leftLabel = lang.startsWith('zh') ? '剩余' : lang.startsWith('ru') ? 'Ост.' : 'Left';
    const roundedPercent = Math.round(percentage);
    const clampedPercent = Math.max(0, Math.min(100, percentage));

    return (
        <div
            className={cn(
                "relative w-full rounded-xl px-2.5 py-2 flex flex-col gap-1.5 transition-colors duration-150",
                "bg-zinc-50/90 dark:bg-[#17171b] border border-zinc-200/80 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.15] group/quota",
                className
            )}
            title={valuationStructured?.title || valuationTitle || title || (typeof label === 'string' ? label : undefined)}
        >
            {/* Row 1: Model label + percentage */}
            <div className="w-full flex items-center justify-between text-[11px] leading-tight">
                <div className="flex items-center gap-1.5 min-w-0 truncate font-semibold text-zinc-800 dark:text-zinc-100">
                    {Icon && <Icon size={13} className="shrink-0 text-zinc-500 dark:text-zinc-400" />}
                    <span className="truncate min-w-0">{label}</span>
                    {tierBadge && (
                        <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-zinc-200/80 dark:bg-white/[0.08] text-zinc-700 dark:text-zinc-200 border border-zinc-300/70 dark:border-white/[0.1] shrink-0">
                            {tierBadge}
                        </span>
                    )}
                    {isNew && !tierBadge && (
                        <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 shrink-0">
                            NEW
                        </span>
                    )}
                    {windowLabel && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-white/[0.08] text-zinc-500 dark:text-zinc-400 font-normal shrink-0">
                            {windowLabel}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-1.5 font-bold font-mono tabular-nums">
                    {isProtected && (
                        <span title={t('accounts.quota_protected')}><Lock className="w-2.5 h-2.5 text-amber-500" /></span>
                    )}
                    <span className={cn(getTextColorClass(percentage), "inline-flex items-center gap-1")}>
                        <span className="text-[10px] font-normal opacity-75">{leftLabel}</span>
                        <span>{roundedPercent}%</span>
                    </span>
                    {valuationStructured?.lastDeltaText && (
                        <span
                            className={cn(
                                "text-[10px] font-mono px-1 py-0.2 rounded font-semibold",
                                valuationStructured.lastDeltaText.startsWith('↓')
                                    ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                                    : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                            )}
                            title={valuationStructured.lastDeltaText}
                        >
                            {valuationStructured.lastDeltaText}
                        </span>
                    )}
                </div>
            </div>

            {/* Row 2: Smooth animated progress track */}
            <div className="w-full h-1.5 rounded-full bg-zinc-200/90 dark:bg-white/[0.08] overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${clampedPercent}%` }}
                    transition={{ type: 'spring', stiffness: 180, damping: 26, mass: 0.7 }}
                    className={cn("h-full rounded-full", getBgColorClass(percentage))}
                />
            </div>

            {/* Row 3: Valuation metrics + reset countdown */}
            <div className="w-full flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] font-mono tabular-nums leading-none pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                    {valuationStructured ? (
                        <>
                            <span className="flex items-center gap-0.5 text-zinc-600 dark:text-zinc-300 font-medium shrink-0">
                                <TrendingDown className="w-3 h-3 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                <span>{valuationStructured.usedText}</span>
                            </span>
                            {valuationStructured.quotaText && (
                                <span className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-bold shrink-0">
                                    <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span>{valuationStructured.quotaText}</span>
                                    {valuationStructured.badge && (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-200/80 dark:bg-white/10 text-zinc-500 dark:text-zinc-300 font-normal">
                                            {valuationStructured.badge}
                                        </span>
                                    )}
                                </span>
                            )}
                            {valuationStructured.cycleCompareText && (
                                <span
                                    className={cn(
                                        "text-[9px] px-1 py-0.2 rounded font-normal shrink-0 border",
                                        valuationStructured.cycleCompareTone === 'increase'
                                            ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                                            : valuationStructured.cycleCompareTone === 'decrease'
                                            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                            : "text-zinc-500 dark:text-zinc-400 bg-zinc-500/10 border-zinc-500/20"
                                    )}
                                >
                                    {valuationStructured.cycleCompareText}
                                </span>
                            )}
                        </>
                    ) : valuationLine ? (
                        <span className="truncate text-zinc-600 dark:text-zinc-300 font-medium">
                            {valuationLine}
                        </span>
                    ) : null}
                </div>

                <div className="shrink-0 ml-auto whitespace-nowrap">
                    {resetTime ? (
                        <span className="flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>{formatTimeRemaining(resetTime)}</span>
                        </span>
                    ) : (
                        <span className="text-zinc-300 dark:text-zinc-600 italic scale-90">N/A</span>
                    )}
                </div>
            </div>
        </div>
    );
}
