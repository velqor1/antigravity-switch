import { weeklyQuotaItems, modelQuotaForWindow, modelQuotaPoolKind } from '../../utils/menuBarQuota';
import { useMemo } from 'react';
import { Download, ArrowRightLeft, RefreshCw, Trash2, Lock, Ban, Diamond, Gem, Circle, Sparkles, Tag, Clock, GripVertical, BrainCircuit, CheckCircle2, Activity } from 'lucide-react';
import { motion } from 'motion/react';
import { Account } from '../../types/account';
import { cn } from '../../utils/cn';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { QuotaItem } from './QuotaItem';
import { getSmartAccountDisplayModels } from '../../config/modelConfig';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import AccountSelection from './AccountSelection';
import { getAccountTier } from '../../utils/accountTier';
import type { BucketValuation } from '../../utils/quotaValuation';
import {
    findBucketForWeekly,
    formatValuationDisplay,
    formatValuationStructured,
    resolveDisplayModelValuation,
} from '../../utils/quotaValuation';

interface AccountCardProps {
    account: Account;
    selected: boolean;
    onSelect: () => void;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching?: boolean;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onEditLabel: () => void;
    onDelete: () => void;
    onExport?: () => void;
    onViewCycleHistory?: () => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuations?: BucketValuation[];
    dragHandleProps?: {
        attributes?: any;
        listeners?: any;
    };
    isDragging?: boolean;
}

function AccountCard({
    account,
    selected,
    onSelect,
    isCurrent: propIsCurrent,
    isRefreshing,
    isSwitching = false,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    quotaWindow,
    quotaDisplayMode = 'modern',
    valuations,
    dragHandleProps,
    isDragging = false,
}: AccountCardProps) {
    const { t, i18n } = useTranslation();
    const { config } = useConfigStore();
    const isDisabled = Boolean(account.disabled);
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);
    const isCurrent = propIsCurrent;

    const displayModels = useMemo(() => {
        return getSmartAccountDisplayModels(
            account.quota?.models,
            config?.pinned_quota_models?.models,
            quotaDisplayMode
        );
    }, [config?.pinned_quota_models?.models, account.quota?.models, quotaDisplayMode]);

    const weeklyItems = useMemo(() => {
        if (quotaWindow !== 'weekly') return [];
        return weeklyQuotaItems(account.quota).map(item => ({ ...item,
            poolBadge: item.shared ? t('accounts.shared_pool') : t('accounts.dedicated_pool'),
            Icon: item.isClaude ? BrainCircuit : Sparkles,
        }));
    }, [quotaWindow, account.quota?.quota_groups, t]);

    const isModelProtected = (key?: string) => {
        if (!config?.quota_protection?.enabled) return false;
        if (!key) return false;
        return account.protected_models?.includes(key);
    };

    return (
        <div className={cn(
            "surface-card surface-card-interactive h-full w-full flex flex-col p-3.5 rounded-2xl border transition-all duration-200 relative overflow-hidden",
            isCurrent
                ? "bg-white dark:bg-[#151519] border-zinc-900/30 dark:border-white/25 ring-1 ring-black/[0.06] dark:ring-white/[0.12]"
                : "bg-white dark:bg-[#111113] border-zinc-200/80 dark:border-white/[0.07]",
            (isRefreshing || isDisabled) && "opacity-75",
            isDragging && "shadow-2xl ring-2 ring-zinc-400/40 dark:ring-white/25"
        )}>
            {/* Subtle top emerald specular line on active account */}
            {isCurrent && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent" />
            )}

            {/* Header */}
            <div className="flex-none flex items-start gap-1.5 mb-2.5">
                {dragHandleProps && (
                    <div
                        {...dragHandleProps.attributes}
                        {...dragHandleProps.listeners}
                        className="flex items-center justify-center w-5 h-5 rounded cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
                        title={t('accounts.drag_to_reorder', 'Перетащите для сортировки')}
                    >
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                )}
                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 w-full">
                        <AccountSelection
                            checked={selected}
                            onChange={onSelect}
                            disabled={isRefreshing}
                            label={t('accounts.select_account', { email: account.email })}
                        />
                        <h3 className={cn(
                            "text-sm truncate flex-1 min-w-0",
                            isCurrent ? "font-bold text-zinc-950 dark:text-white" : "font-semibold text-zinc-800 dark:text-zinc-100"
                        )} title={account.email}>
                            {account.email}
                        </h3>
                        {isCurrent && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                            </span>
                        )}
                    </div>

                    <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                                const tier = getAccountTier(account);
                                if (tier === 'ultra') {
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-amber-300 text-zinc-950 text-[9px] font-bold shadow-sm">
                                            <Gem className="w-2.5 h-2.5 fill-current" />
                                            ULTRA
                                        </span>
                                    );
                                } else if (tier === 'pro') {
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[9px] font-bold shadow-sm">
                                            <Diamond className="w-2.5 h-2.5 fill-current" />
                                            PRO
                                        </span>
                                    );
                                } else {
                                    return (
                                        <span title={tier === 'unknown' ? t('accounts.unknown_hint') : undefined} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.07] text-zinc-500 dark:text-zinc-400 text-[9px] font-bold border border-zinc-200 dark:border-white/10">
                                            <Circle className="w-2.5 h-2.5" />
                                            {t(`accounts.${tier}`)}
                                        </span>
                                    );
                                }
                            })()}

                            {account.custom_label && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-[9px] font-bold border border-amber-500/20">
                                    <Tag className="w-2.5 h-2.5" />
                                    {account.custom_label}
                                </span>
                            )}

                            {isCurrent && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold border border-emerald-500/25">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    {t('accounts.current_active', 'Активен')}
                                </span>
                            )}
                            {isDisabled && (
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/12 text-rose-700 dark:text-rose-300 text-[9px] font-bold flex items-center gap-1 border border-rose-500/25">
                                    <Ban className="w-2.5 h-2.5" />
                                    {t('accounts.disabled').toUpperCase()}
                                </span>
                            )}
                            {account.quota?.is_forbidden && (
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/12 text-rose-600 dark:text-rose-400 text-[9px] font-bold flex items-center gap-1 border border-rose-500/25">
                                    <Lock className="w-2.5 h-2.5" />
                                    {t('accounts.forbidden').toUpperCase()}
                                </span>
                            )}
                            {account.validation_blocked && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-400 text-[9px] font-bold flex items-center gap-1 border border-amber-500/25">
                                    <Clock className="w-2.5 h-2.5" />
                                    {validationBlockedLabel.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0 whitespace-nowrap">
                            {new Date(account.last_used * 1000).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quotas */}
            <div className="flex-1 px-1 mb-2 flex flex-col justify-center overflow-y-auto scrollbar-none">
                {isDisabled || account.quota?.is_forbidden || account.validation_blocked ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 h-full py-6 text-center my-auto">
                        <div className={cn(
                            "flex items-center gap-1.5",
                            account.validation_blocked ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"
                        )}>
                            {account.validation_blocked ? <Clock className="w-4 h-4" /> : (isDisabled ? <Ban className="w-4 h-4" /> : <Lock className="w-4 h-4" />)}
                            <span className="text-[11px] font-bold">
                                {account.validation_blocked ? validationBlockedLabel : (isDisabled ? t('accounts.status.disabled') : t('accounts.forbidden_msg'))}
                            </span>
                        </div>
                    </div>
                ) : quotaWindow === 'weekly' && weeklyItems.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 content-start my-auto">
                        {weeklyItems.map((item) => {
                            const bucketId = item.bucketId || item.id;
                            const valuation = findBucketForWeekly(valuations, bucketId);
                            const valStructured = config?.quota_valuation?.enabled !== false
                                ? formatValuationStructured(
                                    valuation,
                                    config?.quota_valuation?.currency ?? 'usd',
                                    config?.quota_valuation?.display_mode ?? 'remaining',
                                    i18n.language
                                )
                                : null;
                            const valDisplay = config?.quota_valuation?.enabled !== false
                                ? formatValuationDisplay(
                                    valuation,
                                    config?.quota_valuation?.currency ?? 'usd',
                                    config?.quota_valuation?.display_mode ?? 'remaining',
                                    i18n.language
                                )
                                : null;
                            return (
                                <QuotaItem
                                    key={item.id}
                                    label={
                                        <span className="flex items-center gap-1.5 truncate">
                                            <span>{item.title}</span>
                                            <span className="shrink-0">{item.poolBadge}</span>
                                        </span>
                                    }
                                    title={`${item.title} (${item.poolBadge})`}
                                    percentage={item.percentage}
                                    resetTime={item.resetTime}
                                    Icon={item.Icon}
                                    valuationStructured={valStructured}
                                    valuationLine={valDisplay?.line}
                                    valuationTitle={valDisplay?.title}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 content-start my-auto">
                        {displayModels.map((model) => {
                            const resolved = modelQuotaForWindow(model.data, account.quota, quotaWindow);
                            const pool = model.data ? modelQuotaPoolKind(model.data.name, model.data.display_name) : null;
                            const { valStructured, valDisplay } = resolveDisplayModelValuation(
                                model.id,
                                pool,
                                resolved.window,
                                valuations,
                                config?.quota_valuation,
                                i18n.language
                            );
                            return (
                                <QuotaItem
                                    key={model.id}
                                    label={model.label}
                                    tierBadge={model.tierBadge}
                                    isNew={model.isNew}
                                    isDisabled={model.isDisabled}
                                    percentage={resolved.percentage}
                                    resetTime={resolved.resetTime}
                                    windowLabel={resolved.window === 'weekly' ? t('accounts.quota_window_weekly_short') : undefined}
                                    isProtected={isModelProtected(model.protectedKey)}
                                    Icon={model.Icon}
                                    valuationStructured={valStructured}
                                    valuationLine={valDisplay?.line}
                                    valuationTitle={valDisplay?.title}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-none flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-200/70 dark:border-white/[0.07] mt-auto">
                <motion.button
                    type="button"
                    whileHover={isCurrent || isSwitching || isDisabled ? undefined : { scale: 1.02 }}
                    whileTap={isCurrent || isSwitching || isDisabled ? undefined : { scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0",
                        isCurrent
                            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 cursor-default"
                            : isSwitching
                            ? "bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-950 cursor-not-allowed"
                            : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                    onClick={(e) => { e.stopPropagation(); if (!isCurrent) onSwitch(); }}
                    title={isDisabled ? t('accounts.disabled_tooltip') : (isCurrent ? t('accounts.current_active') : t('accounts.switch_account'))}
                    disabled={isCurrent || isSwitching || isDisabled}
                >
                    {isCurrent ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ArrowRightLeft className={cn("w-3.5 h-3.5", isSwitching && "animate-spin")} />}
                    <span>{isCurrent ? t('accounts.active_btn', 'Active') : t('accounts.switch_btn', 'Switch')}</span>
                </motion.button>
                <div className="flex items-center justify-end gap-0.5">
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500",
                            isRefreshing
                                ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 cursor-not-allowed"
                                : "hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        )}
                        onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                        disabled={isRefreshing || isDisabled}
                        title={isDisabled ? t('accounts.disabled_tooltip') : t('accounts.refresh_quota')}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                    </motion.button>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        className="p-1.5 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        onClick={(e) => { e.stopPropagation(); onEditLabel(); }}
                        disabled={isRefreshing || isSwitching}
                        title={t('accounts.edit_remark', 'Изменить заметку')}
                        aria-label={`${t('accounts.edit_remark', 'Изменить заметку')} ${account.email}`}
                    >
                        <Tag className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        className="p-1.5 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        disabled={isRefreshing || isSwitching}
                        title={t('accounts.delete_account')}
                        aria-label={`${t('accounts.delete_account')} ${account.email}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                    {onViewCycleHistory && (
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            className="p-1.5 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08]"
                            title={t('accounts.cycle_history_title', 'История циклов квот')}
                            aria-label={t('accounts.cycle_history_title', 'История циклов квот')}
                            onClick={e => { e.stopPropagation(); onViewCycleHistory(); }}
                        >
                            <Activity className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                    {onExport && (
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.9 }}
                            className="p-1.5 rounded-lg transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08]"
                            title={t('accounts.export_account')}
                            aria-label={t('accounts.export_account')}
                            onClick={event => { event.stopPropagation(); onExport(); }}
                        >
                            <Download className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AccountCard;
