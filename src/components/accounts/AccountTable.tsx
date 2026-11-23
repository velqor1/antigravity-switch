import { weeklyQuotaItems, modelQuotaForWindow, modelQuotaPoolKind } from '../../utils/menuBarQuota';
import type { BucketValuation } from '../../utils/quotaValuation';
import {
    findBucketForWeekly,
    formatValuationDisplay,
    formatValuationStructured,
    resolveDisplayModelValuation,
} from '../../utils/quotaValuation';
/**
 * 账号表格组件
 * 支持拖拽排序功能，用户可以通过拖拽行来调整账号顺序
 */
import { useMemo, useState } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GripVertical,
    Download, ArrowRightLeft,
    RefreshCw,
    Trash2,
    Lock,
    Ban,
    Diamond,
    Gem,
    Circle,
    Sparkles,
    Tag,
    Clock,
    Activity,
    Bot,
    BrainCircuit,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    CheckCircle2,
} from 'lucide-react';
import type { Account } from '../../types/account';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

import { useConfigStore } from '../../stores/useConfigStore';
import { QuotaItem } from './QuotaItem';
import { getSmartAccountDisplayModels } from '../../config/modelConfig';
import { categorizeModel, getModelProtectionKey } from '../../utils/modelCategory';
import { getValidationBlockedStatusLabel } from './accountValidationStatus';
import AccountSelection from './AccountSelection';
import { getAccountTier } from '../../utils/accountTier';

// ============================================================================
// 类型定义
// ============================================================================

interface AccountTableProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onToggleAll: () => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onEditLabel: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onExport?: (accountId: string) => void;
    onViewCycleHistory?: (accountId: string) => void;
    /** 拖拽排序回调，当用户完成拖拽时触发 */
    onReorder?: (accountIds: string[]) => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuationsMap?: Record<string, BucketValuation[]>;
}

interface SortableRowProps {
    account: Account;
    selected: boolean;
    isRefreshing: boolean;
    isCurrent: boolean;
    isSwitching: boolean;
    isDragging?: boolean;
    onSelect: () => void;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onEditLabel: () => void;
    onDelete: () => void;
    onExport?: () => void;
    onViewCycleHistory?: () => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuations?: BucketValuation[];
    isDragDisabled?: boolean;
}

interface AccountRowContentProps {
    account: Account;
    isCurrent: boolean;
    isRefreshing: boolean;
    isSwitching: boolean;
    isDisabled: boolean;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onEditLabel: () => void;
    onDelete: () => void;
    onExport?: () => void;
    onViewCycleHistory?: () => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuations?: BucketValuation[];
}

// ============================================================================
// 辅助函数
// ============================================================================



function isModelProtected(protectedModels: string[] | undefined, modelName: string): boolean {
    if (!protectedModels || protectedModels.length === 0) return false;
    const lowerName = modelName.toLowerCase();

    if (lowerName === 'gemini-pro') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-pro' && getModelProtectionKey(model) === 'gemini-3-pro-high',
        );
    }
    if (lowerName === 'gemini-flash') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'gemini-flash' && getModelProtectionKey(model) === 'gemini-3-flash',
        );
    }
    if (lowerName === 'claude-sonnet') {
        return protectedModels.some((model) =>
            categorizeModel(model) === 'claude' && getModelProtectionKey(model) === 'claude',
        );
    }

    const protectionKey = getModelProtectionKey(lowerName);
    return protectionKey ? protectedModels.includes(protectionKey) : false;
}

/**
 * 提取账号的最快配额重置时间（毫秒时间戳）
 * 用于表格排序
 */
function extractAccountResetTime(account: Account, quotaWindow?: '5h' | 'weekly'): number | null {
    let earliestTime: number | null = null;

    if (quotaWindow === 'weekly') {
        const groups = account.quota?.quota_groups || [];
        for (const group of groups) {
            for (const bucket of group.buckets || []) {
                const isWeekly = bucket.window.toLowerCase().includes('week') || bucket.bucket_id.toLowerCase().includes('week');
                if (isWeekly && bucket.reset_time) {
                    const t = new Date(bucket.reset_time).getTime();
                    if (!isNaN(t) && (earliestTime === null || t < earliestTime)) {
                        earliestTime = t;
                    }
                }
            }
        }
    } else {
        // Sort by the displayed window, never by a fused weekly limit in the 5h view.
        const models = account.quota?.models || [];
        for (const model of models) {
            const { resetTime } = modelQuotaForWindow(model, account.quota, quotaWindow);
            if (resetTime) {
                const t = new Date(resetTime).getTime();
                if (!isNaN(t) && (earliestTime === null || t < earliestTime)) {
                    earliestTime = t;
                }
            }
        }
    }

    return earliestTime;
}

// ============================================================================
// 子组件
// ============================================================================

/**
 * 可拖拽的表格行组件
 * 使用 @dnd-kit/sortable 实现拖拽功能
 */
function SortableAccountRow({
    account,
    selected,
    isRefreshing,
    isCurrent,
    isSwitching,
    isDragging,
    onSelect,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    quotaWindow,
    quotaDisplayMode,
    valuations,
    isDragDisabled = false,
}: SortableRowProps) {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging: isSortableDragging,
    } = useSortable({ id: account.id, disabled: isDragDisabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isSortableDragging ? 0.5 : 1,
        zIndex: isSortableDragging ? 1000 : 'auto',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style as React.CSSProperties}
            className={cn(
                "group transition-colors border-b",
                isCurrent
                    ? "bg-zinc-100/90 dark:bg-[#17171c] border-t border-t-emerald-500/40 border-b-emerald-500/40 dark:border-t-emerald-500/35 dark:border-b-emerald-500/35"
                    : "border-zinc-100 dark:border-white/[0.06]",
                isDragging && "bg-zinc-200/80 dark:bg-white/[0.08] shadow-lg",
                !isDragging && (isCurrent ? "hover:bg-zinc-200/60 dark:hover:bg-[#1d1d24]" : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]")
            )}
        >
            {/* 拖拽手柄 */}
            <td className={cn(
                "pl-2 py-1 w-8 align-middle transition-colors",
                isCurrent && "border-l-2 border-l-emerald-500"
            )}>
                <div
                    {...(!isDragDisabled ? attributes : {})}
                    {...(!isDragDisabled ? listeners : {})}
                    className={cn(
                        "flex items-center justify-center w-6 h-6 rounded transition-colors",
                        isDragDisabled
                            ? "text-zinc-200 dark:text-zinc-700 cursor-not-allowed opacity-40"
                            : (isCurrent
                                ? "cursor-grab active:cursor-grabbing text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                : "cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06]")
                    )}
                    title={isDragDisabled ? t('accounts.drag_disabled_during_sort', '已激活列排序，拖拽排序已暂停') : t('accounts.drag_to_reorder')}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>
            {/* 复选框 */}
            <td className="px-2 py-1 w-10 align-middle">
                <AccountSelection
                    checked={selected}
                    onChange={onSelect}
                    disabled={isRefreshing}
                    label={t('accounts.select_account', { email: account.email })}
                />
            </td>
            <AccountRowContent
                account={account}
                isCurrent={isCurrent}
                isRefreshing={isRefreshing}
                isSwitching={isSwitching}
                isDisabled={Boolean(account.disabled)}
                onSwitch={onSwitch}
                onRefresh={onRefresh}
                onEditLabel={onEditLabel}
                onDelete={onDelete}
                onExport={onExport}
                onViewCycleHistory={onViewCycleHistory}
                quotaWindow={quotaWindow}
                quotaDisplayMode={quotaDisplayMode}
                valuations={valuations}
            />
        </tr>
    );
}

/**
 * 账号行内容组件
 * 渲染邮箱、配额、最后使用时间和操作按钮等列
 */
function AccountRowContent({
    account,
    isCurrent,
    isRefreshing,
    isSwitching,
    isDisabled,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    quotaWindow,
    quotaDisplayMode = 'modern',
    valuations,
}: AccountRowContentProps) {
    const { t, i18n } = useTranslation();
    const { config } = useConfigStore();
    const validationBlockedLabel = getValidationBlockedStatusLabel(account.validation_blocked_reason, t);

    // 解析周配额项 (当处于 weekly 视图时)
    const weeklyItems = useMemo(() => {
        if (quotaWindow !== 'weekly') return [];
        return weeklyQuotaItems(account.quota).map(item => ({ ...item,
            poolBadge: item.shared ? t('accounts.shared_pool') : t('accounts.dedicated_pool'),
            Icon: item.isClaude ? BrainCircuit : Sparkles,
        }));
    }, [quotaWindow, account.quota?.quota_groups, t]);

    // 获取统一解析后的展示模型列表 (现代模型 / 全部活跃)
    const displayModels = useMemo(() => {
        return getSmartAccountDisplayModels(
            account.quota?.models,
            config?.pinned_quota_models?.models,
            quotaDisplayMode
        );
    }, [config?.pinned_quota_models?.models, account.quota?.models, quotaDisplayMode]);

    return (
        <>
            {/* 邮箱列 */}
            <td className="px-2 py-1 align-middle">
                <div className="flex flex-col justify-center gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                            "text-sm break-all transition-colors leading-tight",
                            isCurrent ? "font-bold text-zinc-950 dark:text-white" : "font-medium text-zinc-800 dark:text-zinc-100"
                        )} title={account.email}>
                            {account.email}
                        </span>
                        {isCurrent && (
                            <span className="relative flex h-2 w-2 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {/* 1. 订阅类型徽章 (始终置前，上下对齐) */}
                        {(() => {
                            const tier = getAccountTier(account);
                            if (tier === 'ultra') {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-amber-300 text-zinc-950 text-[10px] font-bold shadow-sm hover:scale-105 transition-transform cursor-default">
                                        <Gem className="w-2.5 h-2.5 fill-current" />
                                        {t('accounts.ultra')}
                                    </span>
                                );
                            } else if (tier === 'pro') {
                                return (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-[10px] font-bold shadow-sm hover:scale-105 transition-transform cursor-default">
                                        <Diamond className="w-2.5 h-2.5 fill-current" />
                                        {t('accounts.pro')}
                                    </span>
                                );
                            } else {
                                return (
                                    <span title={tier === 'unknown' ? t('accounts.unknown_hint') : undefined} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/[0.07] text-zinc-600 dark:text-zinc-400 text-[10px] font-bold border border-zinc-200 dark:border-white/10 transition-colors cursor-default">
                                        <Circle className="w-2.5 h-2.5" />
                                        {t(`accounts.${tier}`)}
                                    </span>
                                );
                            }
                        })()}

                        {/* 2. 自定义标签 */}
                        {account.custom_label && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-500/20">
                                <Tag className="w-2.5 h-2.5" />
                                {account.custom_label}
                            </span>
                        )}

                        {/* 3. 额外状态标签 (全部后置，不挤占 Pro 对齐位置) */}
                        {isCurrent && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/25">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('accounts.current_active', 'Активен')}
                            </span>
                        )}
                        {isDisabled && (
                            <span
                                className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-rose-200/50"
                            >
                                <Ban className="w-2.5 h-2.5" />
                                <span>{t('accounts.disabled')}</span>
                            </span>
                        )}

                        {account.quota?.is_forbidden && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-red-200/50">
                                <Lock className="w-2.5 h-2.5" />
                                <span>{t('accounts.forbidden')}</span>
                            </span>
                        )}
                        {account.validation_blocked && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 shadow-sm border border-amber-200/50">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{validationBlockedLabel}</span>
                            </span>
                        )}
                    </div>

                </div>
            </td>

            {/* 模型配额列 */}
            <td className="px-2 py-1 align-middle">
                {isDisabled || account.quota?.is_forbidden || account.validation_blocked ? (
                    <div className={cn(
                        "flex items-center justify-center gap-3 py-1.5 px-4 rounded-xl border group/error",
                        account.validation_blocked ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-100/50 dark:border-amber-900/20" : "bg-red-50/50 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20"
                    )}>
                        <div className={cn(
                            "flex items-center gap-1.5",
                            account.validation_blocked ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>
                            {account.validation_blocked ? <Clock className="w-3.5 h-3.5" /> : (account.quota?.is_forbidden ? <Lock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />)}
                            <span className={cn(
                                "text-[11px] font-bold",
                                account.validation_blocked ? "text-amber-700/80 dark:text-amber-400" : "text-red-700/80 dark:text-red-400"
                            )}>
                                {account.validation_blocked ? validationBlockedLabel : (isDisabled ? t('accounts.status.disabled') : t('accounts.forbidden_msg'))}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 py-0.5 w-full">
                        {quotaWindow === 'weekly' && weeklyItems.length > 0 ? (
                            weeklyItems.map((item) => {
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
                                                <span className="shrink-0">
                                                    {item.poolBadge}
                                                </span>
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
                            })
                        ) : (
                            displayModels.map((model) => {
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
                                        isProtected={Boolean(config?.quota_protection?.enabled && isModelProtected(account.protected_models, model.protectedKey))}
                                        Icon={model.Icon || Bot}
                                        valuationStructured={valStructured}
                                        valuationLine={valDisplay?.line}
                                        valuationTitle={valDisplay?.title}
                                    />
                                );
                            })
                        )}
                    </div>
                )}
            </td>

            {/* 最后使用时间列 */}
            <td className="px-2 py-1 align-middle">
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap">
                        {new Date(account.last_used * 1000).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono whitespace-nowrap leading-tight">
                        {new Date(account.last_used * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </td>

            {/* 操作列 */}
            <td className={cn(
                "px-2 py-1.5 sticky right-0 z-10 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.6)] text-center align-middle transition-colors",
                isCurrent
                    ? "bg-zinc-100 dark:bg-[#17171c] group-hover:bg-zinc-200/80 dark:group-hover:bg-[#1d1d24]"
                    : "bg-white dark:bg-[#111113] group-hover:bg-zinc-50 dark:group-hover:bg-[#16161a]"
            )}>
                <div className="flex items-center justify-center gap-1 transition-opacity max-w-[216px] mx-auto">
                    <button
                        className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 shrink-0 active:scale-[0.96]",
                            isCurrent
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 cursor-default"
                                : isSwitching
                                ? "bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-950 cursor-not-allowed"
                                : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950 shadow-xs disabled:cursor-not-allowed disabled:opacity-40"
                        )}
                        onClick={(e) => { e.stopPropagation(); if (!isCurrent) onSwitch(); }}
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isCurrent ? t('accounts.current_active') : t('accounts.switch_account'))}
                        disabled={isCurrent || isSwitching || isDisabled}
                    >
                        {isCurrent ? <CheckCircle2 className="w-3 h-3" /> : <ArrowRightLeft className={cn("w-3 h-3", isSwitching && "animate-spin")} />}
                        <span className="hidden sm:inline">{isCurrent ? t('accounts.active_btn', 'Active') : t('accounts.switch_btn', 'Switch')}</span>
                    </button>
                    <button
                        className={cn(
                            "p-1.5 rounded-lg transition-all text-zinc-500 dark:text-zinc-400 active:scale-90",
                            isRefreshing
                                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 cursor-not-allowed"
                                : "hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        )}
                        onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                        title={isDisabled ? t('accounts.disabled_tooltip') : (isRefreshing ? t('common.refreshing') : t('accounts.refresh_quota'))}
                        disabled={isRefreshing || isDisabled}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
                    </button>
                    <button
                        className="p-1.5 text-zinc-500 dark:text-zinc-400 rounded-lg transition-all active:scale-90 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        onClick={(e) => { e.stopPropagation(); onEditLabel(); }}
                        title={t('accounts.edit_remark', 'Изменить заметку')}
                        aria-label={`${t('accounts.edit_remark', 'Изменить заметку')} ${account.email}`}
                        disabled={isRefreshing || isSwitching}
                    >
                        <Tag className="w-3.5 h-3.5" />
                    </button>
                    <button
                        className="p-1.5 text-zinc-500 dark:text-zinc-400 rounded-lg transition-all active:scale-90 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        title={t('accounts.delete_account')}
                        aria-label={`${t('accounts.delete_account')} ${account.email}`}
                        disabled={isRefreshing || isSwitching}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {onViewCycleHistory && (
                        <button
                            className="p-1.5 rounded-lg transition-all active:scale-90 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08]"
                            title={t('accounts.cycle_history_title', 'История циклов квот')}
                            aria-label={t('accounts.cycle_history_title', 'История циклов квот')}
                            onClick={event => { event.stopPropagation(); onViewCycleHistory(); }}
                        >
                            <Activity className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onExport && (
                        <button
                            className="p-1.5 rounded-lg transition-all active:scale-90 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08]"
                            title={t('accounts.export_account')}
                            aria-label={t('accounts.export_account')}
                            onClick={event => { event.stopPropagation(); onExport(); }}
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </td>
        </>
    );
}

// ============================================================================
// 主组件
// ============================================================================

/**
 * 账号表格组件
 * 支持拖拽排序、多选、批量操作等功能
 */
function AccountTable({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    onToggleAll,
    currentAccountId,
    switchingAccountId,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    onReorder,
    quotaWindow,
    quotaDisplayMode,
    valuationsMap,
}: AccountTableProps) {
    const { t } = useTranslation();

    const [activeId, setActiveId] = useState<string | null>(null);
    // 排序状态配置: 支持按配额重置时间 (reset_time) 或最后使用时间 (last_used) 排序
    const [sortConfig, setSortConfig] = useState<{
        key: 'reset_time' | 'last_used' | null;
        direction: 'asc' | 'desc' | null;
    }>({
        key: null,
        direction: null,
    });

    const isSortingActive = sortConfig.key !== null && sortConfig.direction !== null;

    const handleSortToggle = (key: 'reset_time' | 'last_used') => {
        setSortConfig(prev => {
            if (prev.key !== key) {
                return { key, direction: 'asc' };
            }
            if (prev.direction === 'asc') {
                return { key, direction: 'desc' };
            }
            return { key: null, direction: null };
        });
    };

    // 根据排序状态对 accounts 进行拦截排序
    const sortedAccounts = useMemo(() => {
        if (!isSortingActive) return accounts;

        return [...accounts].sort((a, b) => {
            if (sortConfig.key === 'reset_time') {
                const timeA = extractAccountResetTime(a, quotaWindow);
                const timeB = extractAccountResetTime(b, quotaWindow);

                // 没有 reset_time 的排到后面
                if (timeA === null && timeB === null) return 0;
                if (timeA === null) return 1;
                if (timeB === null) return -1;

                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            }

            if (sortConfig.key === 'last_used') {
                const timeA = a.last_used || 0;
                const timeB = b.last_used || 0;

                return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
            }

            return 0;
        });
    }, [accounts, sortConfig, quotaWindow, isSortingActive]);

    // 配置拖拽传感器
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }, // 需要移动 8px 才触发拖拽
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const accountIds = useMemo(() => sortedAccounts.map(a => a.id), [sortedAccounts]);
    const activeAccount = useMemo(() => sortedAccounts.find(a => a.id === activeId), [sortedAccounts, activeId]);

    const handleDragStart = (event: DragStartEvent) => {
        if (isSortingActive) return;
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (isSortingActive) return;

        if (over && active.id !== over.id) {
            const oldIndex = accountIds.indexOf(active.id as string);
            const newIndex = accountIds.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(accountIds, oldIndex, newIndex));
            }
        }
    };

    if (accounts.length === 0) {
        return (
            <div className="bg-white dark:bg-base-100 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-base-200 text-center">
                <p className="text-gray-400 mb-2">{t('accounts.empty.title')}</p>
                <p className="text-sm text-gray-400">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-zinc-200/80 dark:border-white/[0.07] bg-zinc-100/80 dark:bg-[#16161a]">
                            <th className="pl-2 py-2 text-left w-8">
                                <span className="sr-only">{t('accounts.drag_to_reorder')}</span>
                            </th>
                            <th className="px-2 py-2 text-left w-10">
                                <AccountSelection
                                    checked={accounts.every(account => selectedIds.has(account.id))}
                                    indeterminate={accounts.some(account => selectedIds.has(account.id)) && !accounts.every(account => selectedIds.has(account.id))}
                                    onChange={onToggleAll}
                                    label={t('accounts.select_page')}
                                />
                            </th>
                            <th className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[300px] whitespace-nowrap">{t('accounts.table.email')}</th>
                            <th className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider min-w-[340px] whitespace-nowrap">
                                <button
                                    type="button"
                                    onClick={() => handleSortToggle('reset_time')}
                                    className={cn(
                                        "inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors uppercase font-medium",
                                        sortConfig.key === 'reset_time' && "text-zinc-900 dark:text-white font-semibold"
                                    )}
                                    title={t('accounts.table.sort_by_reset_time', 'Сортировать по времени сброса')}
                                >
                                    <span>{quotaWindow === 'weekly' ? t('accounts.table.weekly_quota', 'Недельная квота') : t('accounts.table.quota')}</span>
                                    {sortConfig.key === 'reset_time' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-zinc-900 dark:text-white" /> : <ArrowDown className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-60 hover:opacity-100" />
                                    )}
                                </button>
                            </th>
                            <th className="px-2 py-1 text-left rtl:text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider w-[90px] whitespace-nowrap">
                                <button
                                    type="button"
                                    onClick={() => handleSortToggle('last_used')}
                                    className={cn(
                                        "inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors uppercase font-medium",
                                        sortConfig.key === 'last_used' && "text-zinc-900 dark:text-white font-semibold"
                                    )}
                                    title={t('accounts.table.sort_by_last_used', 'Сортировать по последнему использованию')}
                                >
                                    <span>{t('accounts.table.last_used')}</span>
                                    {sortConfig.key === 'last_used' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-zinc-900 dark:text-white" /> : <ArrowDown className="w-3.5 h-3.5 text-zinc-900 dark:text-white" />
                                    ) : (
                                        <ArrowUpDown className="w-3 h-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-60 hover:opacity-100" />
                                    )}
                                </button>
                            </th>
                            <th className="px-2 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap sticky right-0 w-[216px] bg-zinc-100 dark:bg-[#16161a] z-20 shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.1)] dark:shadow-[-12px_0_12px_-12px_rgba(0,0,0,0.6)] text-center">{t('accounts.table.actions')}</th>
                        </tr >
                    </thead >
                    <SortableContext items={accountIds} strategy={verticalListSortingStrategy}>
                        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                            {sortedAccounts.map((account) => (
                                <SortableAccountRow
                                    key={account.id}
                                    account={account}
                                    selected={selectedIds.has(account.id)}
                                    isRefreshing={refreshingIds.has(account.id)}
                                    isCurrent={account.id === currentAccountId}
                                    isSwitching={account.id === switchingAccountId}
                                    isDragging={account.id === activeId}
                                    onSelect={() => onToggleSelect(account.id)}
                                    onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                                    onRefresh={() => onRefresh(account.id)}
                                    onEditLabel={() => onEditLabel(account.id)}
                                    onDelete={() => onDelete(account.id)}
                                    onExport={() => onExport?.(account.id)}
                                    onViewCycleHistory={() => onViewCycleHistory?.(account.id)}
                                    quotaWindow={quotaWindow}
                                    quotaDisplayMode={quotaDisplayMode}
                                    valuations={valuationsMap?.[account.id]}
                                    isDragDisabled={isSortingActive}
                                />
                            ))}
                        </tbody>
                    </SortableContext>
                </table >
            </div >

            {/* 拖拽悬浮预览层 */}
            <DragOverlay>
                {
                    activeAccount ? (
                        <table className="w-full bg-white dark:bg-[#141417] shadow-2xl rounded-lg border border-zinc-300 dark:border-white/[0.14]">
                            <tbody>
                                <tr className={cn(
                                    "border-b border-zinc-200 dark:border-white/[0.08]",
                                    activeAccount.id === currentAccountId ? "bg-zinc-100 dark:bg-[#1a1a20]" : "bg-zinc-50 dark:bg-[#141417]"
                                )}>
                                    <td className={cn(
                                        "pl-2 py-1 w-8",
                                        activeAccount.id === currentAccountId && "border-l-2 border-l-emerald-500"
                                    )}>
                                        <div className="flex items-center justify-center w-6 h-6 text-zinc-500 dark:text-zinc-300">
                                            <GripVertical className="w-4 h-4" />
                                        </div>
                                    </td>
                                    <td className="px-2 py-1 w-10">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-xs rounded border-2"
                                            checked={selectedIds.has(activeAccount.id)}
                                            readOnly
                                        />
                                    </td>
                                    <AccountRowContent
                                        account={activeAccount}
                                        isCurrent={activeAccount.id === currentAccountId}
                                        isRefreshing={refreshingIds.has(activeAccount.id)}
                                        isSwitching={activeAccount.id === switchingAccountId}
                                        onSwitch={() => { }}
                                        onRefresh={() => { }}
                                        onEditLabel={() => { }}
                                        onDelete={() => { }}
                                        isDisabled={Boolean(activeAccount.disabled)}
                                        quotaWindow={quotaWindow}
                                        quotaDisplayMode={quotaDisplayMode}
                                        valuations={valuationsMap?.[activeAccount.id]}
                                    />
                                </tr>
                            </tbody>
                        </table>
                    ) : null
                }
            </DragOverlay>
        </DndContext>
    );
}

export default AccountTable;
