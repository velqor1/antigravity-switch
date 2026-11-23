import { useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, Check, ChevronDown, DollarSign, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { useAccountStore } from '../../stores/useAccountStore';
import { request } from '../../utils/request';
import { DEFAULT_QUOTA_VALUATION_CONFIG, QuotaValuationConfig } from '../../types/config';
import {
    DEFAULT_PINNED_MODELS,
    isModernModel,
    getModelSortWeight,
    getCanonicalModelKey,
    getCanonicalModelDisplayName,
    getCanonicalModelSublabel,
    getCanonicalModelTag,
} from '../../config/modelConfig';
import { showToast } from '../common/ToastContainer';

interface ModelOption {
    id: string;
    label: string;
    group: 'gemini' | 'claude' | 'other';
    iconType: 'gemini' | 'claude' | 'bot';
    tag?: string;
}

// 兜底基准主模型（已预先归并多档位）
const BASELINE_CANONICAL_MODELS: ModelOption[] = [
    { id: 'gemini-4-neon', label: 'Gemini 4 Neon', group: 'gemini', iconType: 'gemini', tag: 'G4 PRO' },
    { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen', group: 'gemini', iconType: 'gemini', tag: 'G4' },
    { id: 'gemini-4-argon', label: 'Gemini 4 Argon', group: 'gemini', iconType: 'gemini', tag: 'G4 PRO' },
    { id: 'gemini-4-carbon', label: 'Gemini 4 Carbon', group: 'gemini', iconType: 'gemini', tag: 'G4 PRO' },
    { id: 'gemini-pro-orchestrator', label: 'Orchestrator (Carbon)', group: 'gemini', iconType: 'gemini', tag: 'ORCH' },
    { id: 'gemini-pro-orchestrator-argon', label: 'Orchestrator (Argon)', group: 'gemini', iconType: 'gemini', tag: 'ORCH' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', group: 'claude', iconType: 'claude', tag: 'OPUS' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', group: 'claude', iconType: 'claude', tag: 'SONNET' },
    { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', group: 'other', iconType: 'bot', tag: 'OPENAI' },
    { id: 'gemini-3.1-flash-image', label: 'Gemini 3.1 Flash Image', group: 'gemini', iconType: 'gemini', tag: 'IMAGE' },
    { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', group: 'gemini', iconType: 'gemini', tag: 'PRO' },
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', group: 'gemini', iconType: 'gemini', tag: 'FLASH' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', group: 'gemini', iconType: 'gemini', tag: 'FLASH' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', group: 'gemini', iconType: 'gemini', tag: 'LITE' },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', group: 'gemini', iconType: 'gemini', tag: 'FLASH' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', group: 'gemini', iconType: 'gemini', tag: 'LITE' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'gemini', iconType: 'gemini', tag: 'PRO' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'gemini', iconType: 'gemini', tag: 'FLASH' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', group: 'claude', iconType: 'claude', tag: 'SONNET' },
    { id: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6', group: 'claude', iconType: 'claude', tag: 'OPUS' },
];

function detectModelGroup(id: string): 'gemini' | 'claude' | 'other' {
    const lower = id.toLowerCase();
    if (lower.includes('claude') || lower.includes('opus') || lower.includes('sonnet')) return 'claude';
    if (lower.includes('gemini') || lower.includes('imagen')) return 'gemini';
    return 'other';
}

interface ModelDisplaySettingsProps {
    onClose?: () => void;
    embedded?: boolean;
}

export default function ModelDisplaySettings({ onClose, embedded = false }: ModelDisplaySettingsProps) {
    const { t } = useTranslation();
    const { config, saveConfig } = useConfigStore();
    const accounts = useAccountStore(state => state.accounts);
    const refreshAllQuotas = useAccountStore(state => state.refreshAllQuotas);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRefreshingRate, setIsRefreshingRate] = useState(false);
    const [liveRate, setLiveRate] = useState<number | null>(null);
    const [showLegacy, setShowLegacy] = useState(false);

    useEffect(() => {
        let mounted = true;
        request<{ rate: number; fetched_at: number; stale: boolean }>('get_exchange_rate')
            .then(snapshot => {
                if (mounted && snapshot?.rate) {
                    setLiveRate(snapshot.rate);
                }
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, []);

    const valuationConfig = config?.quota_valuation ?? DEFAULT_QUOTA_VALUATION_CONFIG;

    const updateValuationConfig = async (patch: Partial<QuotaValuationConfig>) => {
        if (!config) return;
        const nextValuation: QuotaValuationConfig = {
            ...DEFAULT_QUOTA_VALUATION_CONFIG,
            ...config.quota_valuation,
            ...patch,
        };
        try {
            await saveConfig({
                ...config,
                quota_valuation: nextValuation,
            }, true);
        } catch (err) {
            showToast(String(err), 'error');
        }
    };

    const handleRefreshExchangeRate = async () => {
        setIsRefreshingRate(true);
        try {
            const snapshot = await request<{ rate: number; fetched_at: number; stale: boolean }>('get_exchange_rate');
            if (snapshot?.rate) {
                setLiveRate(snapshot.rate);
                await updateValuationConfig({ usd_to_cny_rate: snapshot.rate });
                showToast(t('quota_valuation.rate_updated', { rate: snapshot.rate.toFixed(4) }), 'success');
            }
        } catch (err) {
            showToast(String(err), 'error');
        } finally {
            setIsRefreshingRate(false);
        }
    };

    // 当前用户勾选的主模型列表（标准化去重）
    const currentPinned = useMemo(() => {
        const configured = config?.pinned_quota_models?.models;
        const source = (configured && configured.length > 0) ? configured : DEFAULT_PINNED_MODELS;
        return Array.from(new Set(source.map(getCanonicalModelKey)));
    }, [config?.pinned_quota_models?.models]);

    // 实时从所有账号中提取真实活跃的主模型（自动去重归并同系列 High/Medium/Low 档位）
    const allModels = useMemo(() => {
        const map = new Map<string, ModelOption>();

        // 1. 优先提取当前所有账号真实返回的活跃主模型
        for (const account of accounts) {
            for (const m of account.quota?.models || []) {
                if (!m.name) continue;
                const canonKey = getCanonicalModelKey(m.name);
                if (!map.has(canonKey)) {
                    const label = getCanonicalModelDisplayName(canonKey);
                    const group = detectModelGroup(canonKey);
                    const iconType: ModelOption['iconType'] = group === 'claude' ? 'claude' : group === 'gemini' ? 'gemini' : 'bot';
                    map.set(canonKey, {
                        id: canonKey,
                        label,
                        group,
                        iconType,
                        tag: getCanonicalModelTag(canonKey),
                    });
                }
            }
        }

        // 2. 兜底补齐常用基准主模型
        for (const bm of BASELINE_CANONICAL_MODELS) {
            if (!map.has(bm.id)) {
                map.set(bm.id, bm);
            }
        }

        // 3. 动态排序
        return Array.from(map.values()).sort((a, b) => {
            const weightA = getModelSortWeight(a.id);
            const weightB = getModelSortWeight(b.id);
            if (weightA !== weightB) return weightA - weightB;
            return a.label.localeCompare(b.label);
        });
    }, [accounts]);

    const handleToggleModel = async (canonKey: string) => {
        if (!config) return;
        const exists = currentPinned.includes(canonKey);
        let next: string[];
        if (exists) {
            next = currentPinned.filter(id => id !== canonKey);
            if (next.length === 0) {
                showToast(t('model_display.empty_tip', '请至少保留一个模型'), 'warning');
                return;
            }
        } else {
            next = [...currentPinned, canonKey];
        }

        try {
            await saveConfig({
                ...config,
                pinned_quota_models: { models: next }
            }, true);
            showToast(t('model_display.saved', '已更新卡片展示模型'), 'success');
        } catch (err) {
            showToast(String(err), 'error');
        }
    };

    const handleResetDefault = async () => {
        if (!config) return;
        try {
            await saveConfig({
                ...config,
                pinned_quota_models: { models: DEFAULT_PINNED_MODELS }
            }, true);
            showToast(t('model_display.reset_success', '已恢复默认推荐模型'), 'success');
        } catch (err) {
            showToast(String(err), 'error');
        }
    };

    const handleRefreshLiveModels = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            await refreshAllQuotas();
            showToast(t('model_display.models_refreshed', '模型列表已更新'), 'success');
        } catch (err) {
            showToast(String(err), 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    const renderIcon = (type: ModelOption['iconType']) => {
        switch (type) {
            case 'claude':
                return <BrainCircuit className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />;
            case 'gemini':
                return <Sparkles className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
            case 'bot':
            default:
                return <Bot className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />;
        }
    };

    const groups: { key: ModelOption['group']; title: string }[] = [
        { key: 'gemini', title: t('model_display.group_gemini', 'Gemini (Google)') },
        { key: 'claude', title: t('model_display.group_claude', 'Claude (Anthropic)') },
        { key: 'other', title: t('model_display.group_other', 'Другие модели') },
    ];

    const modernModels = useMemo(() => allModels.filter(m => isModernModel(m.id)), [allModels]);
    const legacyModels = useMemo(() => allModels.filter(m => !isModernModel(m.id)), [allModels]);

    const isAllSelected = modernModels.length > 0 && modernModels.every(m => currentPinned.includes(m.id));

    const handleSelectAllModern = async () => {
        if (!config) return;
        const modernIds = modernModels.map(m => m.id);
        const next = isAllSelected ? [...DEFAULT_PINNED_MODELS] : modernIds;
        try {
            await saveConfig({
                ...config,
                pinned_quota_models: { models: next }
            }, true);
            showToast(t('model_display.saved', 'Список моделей обновлён'), 'success');
        } catch (err) {
            showToast(String(err), 'error');
        }
    };

    const renderModelOption = (model: ModelOption) => {
        const isChecked = currentPinned.includes(model.id);
        const sublabel = getCanonicalModelSublabel(model.id, tiers => t('model_display.shared_pool', { tiers }));
        return (
            <motion.div
                key={model.id}
                whileTap={{ scale: 0.985 }}
                onClick={() => handleToggleModel(model.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-colors ${isChecked
                    ? 'border-zinc-900/35 bg-zinc-100/90 dark:bg-white/[0.08] dark:border-white/[0.22] shadow-xs'
                    : 'border-zinc-200/80 dark:border-white/[0.07] bg-zinc-50/60 dark:bg-[#17171b] hover:bg-zinc-100/80 dark:hover:bg-[#1d1d23]'
                    }`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{renderIcon(model.iconType)}</span>
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate" title={model.label}>
                            {model.label}
                        </div>
                        {sublabel ? (
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate" title={sublabel}>
                                {sublabel}
                            </div>
                        ) : (
                            <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate" title={model.id}>
                                {model.id}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-2">
                    {model.tag && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-zinc-200/70 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-300">
                            {model.tag}
                        </span>
                    )}
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isChecked
                        ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950'
                        : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-[#09090b]'
                        }`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    </span>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="space-y-4">
            <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-[#111113]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-200/70 dark:border-white/[0.07]">
                    <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {t('model_display.selected_models', 'Отображаемые модели')}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-zinc-200/80 text-zinc-800 dark:bg-white/[0.08] dark:text-zinc-200">
                            {t('model_display.selected_count', { count: currentPinned.length })}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleResetDefault}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-1 active:scale-95"
                            title={t('model_display.reset_default_title', 'Reset to recommended modern models')}
                        >
                            <RotateCcw className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                            <span>{t('model_display.reset_default', 'По умолчанию')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleSelectAllModern}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors active:scale-95"
                        >
                            {isAllSelected ? t('model_display.deselect_all', 'Сбросить') : t('model_display.select_all', 'Выбрать все')}
                        </button>
                        <button
                            type="button"
                            disabled={isRefreshing}
                            onClick={handleRefreshLiveModels}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors flex items-center gap-1.5 active:scale-95"
                            title={t('model_display.refresh_models', 'Обновить список моделей')}
                        >
                            <RefreshCw className={`w-3 h-3 text-zinc-500 dark:text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span>{isRefreshing ? t('model_display.refreshing_models', 'Обновление...') : t('model_display.refresh_models', 'Обновить модели')}</span>
                        </button>
                    </div>
                </div>

                <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">{t('model_display.availability_hint')}</p>

                <div className="space-y-4">
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                            <span>{t('model_display.group_modern', 'Modern Models (Antigravity 2.0)')}</span>
                            <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">{modernModels.length}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {modernModels.map(renderModelOption)}
                        </div>
                    </div>

                    {legacyModels.length > 0 && (
                        <div className="pt-2 border-t border-zinc-200/70 dark:border-white/[0.07]">
                            <button
                                type="button"
                                onClick={() => setShowLegacy(v => !v)}
                                className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-zinc-100/70 dark:bg-white/[0.03] hover:bg-zinc-200/70 dark:hover:bg-white/[0.06] text-xs font-medium text-zinc-600 dark:text-zinc-400 transition-colors"
                            >
                                <span className="flex items-center gap-2">
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showLegacy ? 'rotate-180' : ''}`} />
                                    <span>{showLegacy ? t('model_display.hide_legacy', 'Hide legacy models (2.5 / 3.x)') : t('model_display.show_legacy', 'Show legacy models (2.5 / 3.x)')}</span>
                                </span>
                                <span className="font-mono text-[11px] opacity-75">
                                    {t('model_display.legacy_count', { count: legacyModels.length })}
                                </span>
                            </button>

                            <AnimatePresence initial={false}>
                                {showLegacy && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-3 space-y-4">
                                            {groups.map(group => {
                                                const groupModels = legacyModels.filter(m => m.group === group.key);
                                                if (groupModels.length === 0) return null;
                                                return (
                                                    <div key={group.key} className="space-y-2">
                                                        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                                            {group.title}
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {groupModels.map(renderModelOption)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200/70 dark:border-white/[0.07] text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t('model_display.hint', 'Изменения применяются сразу.')}
                </div>
            </section>

            {/* 配额价值与多币种换算配置区 */}
            <section className="surface-card bg-white dark:bg-[#111113] border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl p-5 transition-all">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/70 dark:border-white/[0.07]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                {t('quota_valuation.section_title', 'Оценка стоимости квот')}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {t('quota_valuation.section_desc', 'Расчёт эквивалентной стоимости по реальным данным использования')}
                            </p>
                        </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={valuationConfig.enabled}
                            onChange={(e) => updateValuationConfig({ enabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {valuationConfig.enabled && (
                    <div className="mt-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    {t('quota_valuation.currency_label', 'Валюта')}
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-zinc-200/70 dark:bg-[#18181b] p-1 rounded-xl border border-zinc-300/50 dark:border-white/[0.06]">
                                    {(['usd', 'cny', 'both'] as const).map((curr) => (
                                        <button
                                            key={curr}
                                            type="button"
                                            onClick={() => updateValuationConfig({ currency: curr })}
                                            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                valuationConfig.currency === curr
                                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            }`}
                                        >
                                            {curr === 'usd' ? '$ USD' : curr === 'cny' ? '¥ CNY' : t('quota_valuation.both', 'Обе')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                                    {t('quota_valuation.mode_label', 'Режим')}
                                </label>
                                <div className="grid grid-cols-2 gap-1 bg-zinc-200/70 dark:bg-[#18181b] p-1 rounded-xl border border-zinc-300/50 dark:border-white/[0.06]">
                                    {(['remaining', 'used_and_total'] as const).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => updateValuationConfig({ display_mode: mode })}
                                            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                                valuationConfig.display_mode === mode
                                                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-xs'
                                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            }`}
                                        >
                                            {mode === 'remaining' ? t('quota_valuation.mode_remaining', 'Остаток') : t('quota_valuation.mode_used_and_total', 'Расход / Всего')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 bg-zinc-50/70 dark:bg-[#18181b] rounded-xl border border-zinc-200/70 dark:border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                    <span>{t('quota_valuation.rate_title', 'Курс USD → CNY')}</span>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        1 USD = {(liveRate ?? valuationConfig.usd_to_cny_rate).toFixed(4)} CNY
                                    </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {t('quota_valuation.rate_desc', 'Автоматическое обновление раз в 24ч или вручную')}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <label className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={valuationConfig.auto_exchange_rate}
                                        onChange={(e) => updateValuationConfig({ auto_exchange_rate: e.target.checked })}
                                        className="checkbox checkbox-xs rounded"
                                    />
                                    <span>{t('quota_valuation.auto_rate', 'Авто')}</span>
                                </label>

                                <button
                                    type="button"
                                    onClick={handleRefreshExchangeRate}
                                    disabled={isRefreshingRate}
                                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                                    title={t('common.refresh', 'Обновить')}
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingRate ? 'animate-spin' : ''}`} />
                                </button>

                                {!valuationConfig.auto_exchange_rate && (
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="3.0"
                                        max="20.0"
                                        defaultValue={valuationConfig.usd_to_cny_rate}
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val >= 3.0 && val <= 20.0) {
                                                updateValuationConfig({ usd_to_cny_rate: val });
                                            }
                                        }}
                                        className="w-20 px-2 py-1 text-xs font-mono bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.1] rounded-lg text-right"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-200/70 dark:border-white/[0.07]">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                                        {t('quota_valuation.reference_caps_title', 'Базовые лимиты (100%)')}
                                    </span>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {t('quota_valuation.reference_caps_desc', 'Ориентировочные верхние границы для полных квот')}
                                    </p>
                                </div>
                                <label className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 cursor-pointer shrink-0 ml-2">
                                    <input
                                        type="checkbox"
                                        checked={valuationConfig.use_reference_cap}
                                        onChange={(e) => updateValuationConfig({ use_reference_cap: e.target.checked })}
                                        className="checkbox checkbox-xs rounded"
                                    />
                                    <span>{t('quota_valuation.enable_ref_cap', 'Включить')}</span>
                                </label>
                            </div>

                            {valuationConfig.use_reference_cap && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                                    {[
                                        { key: 'gemini:5h', label: 'Gemini 5h ($)' },
                                        { key: 'gemini:weekly', label: 'Gemini Weekly ($)' },
                                        { key: '3p:5h', label: 'Claude / GPT 5h ($)' },
                                        { key: '3p:weekly', label: 'Claude / GPT Weekly ($)' },
                                        { key: 'argon:weekly', label: 'Argon Weekly ($)' },
                                        { key: 'carbon:5h', label: 'Carbon 5h ($)' },
                                        { key: 'carbon:weekly', label: 'Carbon Weekly ($)' },
                                    ].map((cap) => (
                                        <div key={cap.key} className="p-2.5 bg-zinc-50/70 dark:bg-[#18181b] rounded-xl border border-zinc-200/70 dark:border-white/[0.07]">
                                            <div className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1 truncate" title={cap.label}>
                                                {cap.label}
                                            </div>
                                            <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                placeholder={t('quota_valuation.auto_calc', 'Авто')}
                                                defaultValue={valuationConfig.reference_caps_usd?.[cap.key] ?? ''}
                                                onBlur={(e) => {
                                                    const raw = e.target.value.trim();
                                                    const nextMap = { ...(valuationConfig.reference_caps_usd ?? {}) };
                                                    if (!raw) {
                                                        delete nextMap[cap.key];
                                                    } else {
                                                        const val = parseFloat(raw);
                                                        if (!isNaN(val) && val > 0) {
                                                            nextMap[cap.key] = val;
                                                        } else {
                                                            delete nextMap[cap.key];
                                                        }
                                                    }
                                                    updateValuationConfig({ reference_caps_usd: nextMap });
                                                }}
                                                className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-[#111113] border border-zinc-200 dark:border-white/[0.1] rounded-lg text-right"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {!embedded && onClose && (
                <div className="flex justify-end pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold text-xs hover:bg-zinc-800 dark:hover:bg-white active:scale-95 transition-all shadow-sm"
                    >
                        {t('common.confirm', 'Готово')}
                    </button>
                </div>
            )}
        </div>
    );
}
