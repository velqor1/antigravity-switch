import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, Database, FolderOpen, Globe2, HardDrive, Monitor, Moon, RefreshCw, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../stores/useConfigStore';
import { AppConfig } from '../types/config';
import { request as invoke } from '../utils/request';
import { showToast } from '../components/common/ToastContainer';
import { open } from '@tauri-apps/plugin-dialog';
import UpdateSettings from '../components/settings/UpdateSettings';
import DesktopSettings from '../components/settings/DesktopSettings';
import DashboardSettings from '../components/settings/DashboardSettings';
import ModelDisplaySettings from '../components/settings/ModelDisplaySettings';
import ExperimentalSettings from '../components/settings/ExperimentalSettings';
import NetworkSettings from '../components/settings/NetworkSettings';
import { AutoSwitchSettings } from '../components/autoSwitch/AutoSwitch';
import SettingsNavigation, { SETTINGS_SECTIONS, SettingsSection } from '../components/settings/SettingsNavigation';
import { LANGUAGES, normalizeLanguage } from '../components/navbar/constants';
import '../components/settings/SettingsLayout.css';

const REFRESH_INTERVALS = [5, 15, 30, 60];
const SYNC_INTERVALS = [1, 5, 15, 30];

function Settings() {
    const { t } = useTranslation();
    const { config, loading, error, loadConfig, saveConfig } = useConfigStore();
    const [dataDirPath, setDataDirPath] = useState('~/.antigravity_tools');
    const [section, setSection] = useState<SettingsSection>('general');
    const layout = useRef<HTMLDivElement>(null);
    const contentScroller = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (layout.current) layout.current.scrollTop = 0;
        if (contentScroller.current) contentScroller.current.scrollTop = 0;
    }, [section]);

    useEffect(() => {
        loadConfig();
        invoke<string>('get_data_dir_path')
            .then(setDataDirPath)
            .catch(() => {});
    }, [loadConfig]);

    const updateConfig = async (patch: Partial<AppConfig>) => {
        if (!config) return;
        try {
            await saveConfig({ ...config, ...patch }, true);
            showToast(t('local_settings.saved', { lng: patch.language || config.language }), 'success');
        } catch (error) {
            showToast(t('local_settings.save_failed', { error: String(error) }), 'error');
        }
    };

    const openDataFolder = async () => {
        try {
            await invoke('open_data_folder');
        } catch (error) {
            showToast(t('local_settings.open_failed', { error: String(error) }), 'error');
        }
    };

    const chooseExecutable = async (field: 'antigravity_executable' | 'antigravity_ide_executable') => {
        try {
            const selected = await open({ multiple: false, directory: false, title: t('local_settings.choose_executable') });
            if (typeof selected === 'string') await updateConfig({ [field]: selected });
        } catch (error) {
            showToast(t('local_settings.save_failed', { error: String(error) }), 'error');
        }
    };

    const themeOptions = [
        { value: 'system', label: t('local_settings.system'), icon: Monitor },
        { value: 'light', label: t('local_settings.light'), icon: Sun },
        { value: 'dark', label: t('local_settings.dark'), icon: Moon },
    ];
    const selectedLanguage = normalizeLanguage(config?.language);
    const refreshInterval = config?.refresh_interval ?? 15;
    const syncInterval = config?.sync_interval ?? 5;
    const refreshOptions = [...new Set([...REFRESH_INTERVALS, refreshInterval])].sort((a, b) => a - b);
    const syncOptions = [...new Set([...SYNC_INTERVALS, syncInterval])].sort((a, b) => a - b);

    const renderSwitch = (enabled: boolean, label: string, onClick: () => void) => (
        <button
            type="button"
            role="switch"
            aria-label={label}
            aria-checked={enabled}
            disabled={!config}
            onClick={onClick}
            className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </span>
        </button>
    );

    const content: Record<SettingsSection, React.ReactNode> = {
        general: (
            <div className="space-y-5">
                <NetworkSettings />
                {/* 1. 界面外观与语言 */}
                <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-[#111113]">
                    <div className="mb-5 flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200">
                            <Sun className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                {t('settings_sections.appearance_and_language', 'Внешний вид и язык')}
                            </h3>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {t('settings_sections.appearance_and_language_desc', 'Настройка темы оформления и языка интерфейса.')}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <div className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <span>{t('local_settings.theme')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                                {themeOptions.map(({ value, label, icon: Icon }) => {
                                    const selected = (config?.theme || 'system') === value;
                                    return (
                                        <motion.button
                                            key={value}
                                            type="button"
                                            whileHover={{ scale: 1.015 }}
                                            whileTap={{ scale: 0.97 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                                            onClick={() => updateConfig({ theme: value })}
                                            disabled={!config}
                                            aria-pressed={selected}
                                            className={`flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                selected
                                                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-white/30 dark:bg-zinc-100 dark:text-zinc-950'
                                                    : 'border-zinc-200/80 bg-zinc-50/70 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100 dark:border-white/[0.07] dark:bg-[#18181b] dark:text-zinc-300 dark:hover:border-white/[0.15]'
                                            }`}
                                        >
                                            <Icon className={`h-4 w-4 ${selected ? 'text-white dark:text-zinc-950' : 'text-zinc-400 dark:text-zinc-500'}`} />
                                            <span>{label}</span>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Globe2 className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                <span>{t('local_settings.language')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-zinc-200/70 p-1 dark:bg-[#18181b] border border-zinc-300/50 dark:border-white/[0.06]">
                                {LANGUAGES.map((language) => {
                                    const selected = selectedLanguage === language.code;
                                    return (
                                        <button
                                            key={language.code}
                                            type="button"
                                            onClick={() => updateConfig({ language: language.code })}
                                            disabled={!config}
                                            aria-pressed={selected}
                                            className={`relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                selected
                                                    ? 'text-white dark:text-zinc-950'
                                                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                                            }`}
                                        >
                                            {selected && (
                                                <motion.span
                                                    layoutId="settings-lang-pill"
                                                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                                                />
                                            )}
                                            {selected && <Check className="relative z-10 h-3.5 w-3.5" />}
                                            <span className="relative z-10">{language.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. 桌面与系统窗口 */}
                <DashboardSettings />
                <UpdateSettings />
                <DesktopSettings />

                {/* 3. 数据存储与关联应用 */}
                <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-[#111113] space-y-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                            <HardDrive className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                {t('settings_sections.storage_and_executables', 'Приложения и хранение данных')}
                            </h3>
                            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {t('settings_sections.storage_and_executables_desc', 'Локальное хранилище аккаунтов и пути к клиентам.')}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200/75 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-[#18181b]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                    <Database className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                    {t('local_settings.data_directory', 'Локальные данные')}
                                </div>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                    {t('local_settings.data_directory_desc', 'Конфигурация, аккаунты и кэш хранятся только локально.')}
                                </p>
                                <div className="mt-2.5 inline-block rounded-lg bg-white px-2.5 py-1 font-mono text-xs text-zinc-600 dark:bg-[#111113] dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] break-all">
                                    {dataDirPath}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={openDataFolder}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-white/[0.1] dark:bg-[#141417] dark:text-zinc-200 dark:hover:border-white/[0.2] dark:hover:text-white active:scale-95"
                            >
                                <FolderOpen className="h-3.5 w-3.5" />
                                {t('local_settings.open_directory', 'Открыть папку')}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200/75 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-[#18181b] space-y-3">
                        <div>
                            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                                {t('local_settings.application_paths', 'Пути к приложениям')}
                            </div>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                {t('local_settings.application_paths_desc', 'По умолчанию определяются автоматически.')}
                            </p>
                        </div>

                        <div className="space-y-2.5 pt-1">
                            {([
                                { field: 'antigravity_executable', nameKey: 'app_label', defaultName: 'AntiGravity App', descKey: 'app_desc', defaultDesc: 'Десктопное приложение' },
                                { field: 'antigravity_ide_executable', nameKey: 'ide_label', defaultName: 'AntiGravity IDE / VS Code', descKey: 'ide_desc', defaultDesc: 'Синхронизация сессии IDE' },
                            ] as const).map(({ field, nameKey, defaultName, descKey, defaultDesc }) => {
                                const isCustom = Boolean(config?.[field]);
                                return (
                                    <div key={field} className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#111113] border border-zinc-200/80 dark:border-white/[0.07]">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t(`local_settings.${nameKey}`, defaultName)}</span>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${isCustom ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isCustom ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                    {isCustom ? t('local_settings.custom_path', 'Свой путь') : t('local_settings.automatic_detection', 'Авто')}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                {t(`local_settings.${descKey}`, defaultDesc)}
                                            </p>
                                            <div className="mt-1.5 font-mono text-xs text-zinc-600 dark:text-zinc-300 break-all">
                                                {config?.[field] || t('local_settings.auto_detect_note', 'Определяется автоматически')}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                disabled={!config}
                                                onClick={() => chooseExecutable(field)}
                                                className="rounded-lg border border-zinc-200 dark:border-white/[0.1] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                                            >
                                                {t('local_settings.choose_executable', 'Выбрать…')}
                                            </button>
                                            {isCustom && (
                                                <button
                                                    type="button"
                                                    onClick={() => updateConfig({ [field]: undefined })}
                                                    className="rounded-lg px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                                >
                                                    {t('local_settings.reset_detection', 'Сбросить')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>
            </div>
        ),
        quota: (
            <div className="space-y-5">
                <ModelDisplaySettings embedded />

                <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white dark:border-white/[0.08] dark:bg-[#111113] divide-y divide-zinc-200/70 dark:divide-white/[0.07]">
                    <div className="p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                    <RefreshCw className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                                    <span>{t('local_settings.auto_refresh')}</span>
                                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
                                        {t('local_settings.auto_refresh_badge', 'Рекомендуется')}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                    {t('local_settings.auto_refresh_desc')}
                                </p>
                            </div>
                            {renderSwitch(Boolean(config?.auto_refresh), t('local_settings.auto_refresh'), () => updateConfig({ auto_refresh: !config?.auto_refresh }))}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200/70 pt-3 dark:border-white/[0.07]">
                            <label htmlFor="refresh-interval" className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                <Clock3 className="h-3.5 w-3.5 text-zinc-400" />
                                {t('local_settings.refresh_interval')}
                            </label>
                            <select
                                id="refresh-interval"
                                value={refreshInterval}
                                disabled={!config || !config.auto_refresh}
                                onChange={(event) => updateConfig({ refresh_interval: Number(event.target.value) })}
                                className="select select-sm select-bordered w-32 border-zinc-200 bg-white text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#18181b] dark:text-zinc-200 text-xs rounded-lg"
                            >
                                {refreshOptions.map((minutes) => <option key={minutes} value={minutes}>{t('local_settings.minutes', { count: minutes })}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                    <Database className="h-4 w-4 text-emerald-500" />
                                    <span>{t('local_settings.auto_sync')}</span>
                                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                                        {t('local_settings.auto_sync_badge', 'Опционально')}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                    {t('local_settings.auto_sync_desc')}
                                </p>
                            </div>
                            {renderSwitch(Boolean(config?.auto_sync), t('local_settings.auto_sync'), () => updateConfig({ auto_sync: !config?.auto_sync }))}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-200/70 pt-3 dark:border-white/[0.07]">
                            <label htmlFor="sync-interval" className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                <Clock3 className="h-3.5 w-3.5 text-zinc-400" />
                                {t('local_settings.sync_interval')}
                            </label>
                            <select
                                id="sync-interval"
                                value={syncInterval}
                                disabled={!config || !config.auto_sync}
                                onChange={(event) => updateConfig({ sync_interval: Number(event.target.value) })}
                                className="select select-sm select-bordered w-32 border-zinc-200 bg-white text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#18181b] dark:text-zinc-200 text-xs rounded-lg"
                            >
                                {syncOptions.map((minutes) => <option key={minutes} value={minutes}>{t('local_settings.minutes', { count: minutes })}</option>)}
                            </select>
                        </div>
                    </div>
                </section>
            </div>
        ),
        autoSwitch: <AutoSwitchSettings />,
        experimental: <ExperimentalSettings active={section === 'experimental'} />,
    };

    return (
        <div ref={layout} className="settings-layout">
            <aside className="settings-sidebar">
                <h1 className="settings-sidebar-title text-zinc-900 dark:text-zinc-100">{t('local_settings.title')}</h1>
                <SettingsNavigation selected={section} onSelect={setSection} />
            </aside>
            <div ref={contentScroller} className="settings-content">
                {error && <div role="alert" className="settings-panel mb-5 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                    <p>{t('settings_sections.config_failed', { error })}</p>
                    <button type="button" disabled={loading} onClick={() => void loadConfig()} className="mt-3 rounded-lg border border-current px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-50">{t(loading ? 'auto_switch.loading' : 'auto_switch.retry')}</button>
                </div>}
                {SETTINGS_SECTIONS.map(({ id, title, description }) => (
                    <section key={id} id={`settings-panel-${id}`} role="tabpanel" aria-labelledby={`settings-tab-${id}`} tabIndex={0} hidden={section !== id} className={section === id ? 'settings-panel' : 'settings-panel hidden'}>
                        <motion.div
                            key={`${id}-${section === id ? 'open' : 'closed'}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <header className="settings-section-header">
                                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{t(title)}</h2>
                                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t(description)}</p>
                            </header>
                            {content[id]}
                        </motion.div>
                    </section>
                ))}
            </div>
        </div>
    );
}

export default Settings;
