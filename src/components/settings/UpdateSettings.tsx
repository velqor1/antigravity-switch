import { useEffect, useState } from 'react';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '../../stores/useUpdateStore';
import { useConfigStore } from '../../stores/useConfigStore';
import { isTauri } from '../../utils/env';
import { getRunningVersion } from '../../services/updaterService';
import { version } from '../../../package.json';
export default function UpdateSettings() {
    const { t } = useTranslation();
    const [runningVersion, setRunningVersion] = useState(version);
    useEffect(() => { if (isTauri()) void getRunningVersion().then(setRunningVersion).catch(() => {}); }, []);
    const { config, saveConfig, error: configError } = useConfigStore();
    const [startup, setStartup] = useState(config?.check_updates_on_startup !== false);
    useEffect(() => setStartup(config?.check_updates_on_startup !== false), [config?.check_updates_on_startup]);
    const { isChecking, updateInfo, error, checkForUpdates, setDialogOpen } = useUpdateStore();
    return <section className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-white/[0.08] dark:bg-[#111113]">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3"><ArrowUpCircle className="mt-1 h-5 w-5 text-zinc-600 dark:text-zinc-300" /><div><h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('updater.title')}</h3><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('updater.desc')}</p></div></div>
            <button type="button" disabled={isChecking || !isTauri()} onClick={() => void checkForUpdates()} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-200 disabled:opacity-50 dark:border-white/[0.1] dark:bg-[#18181b] dark:text-zinc-200 dark:hover:bg-white/[0.1] active:scale-95"><RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />{t(isChecking ? 'updater.checking' : 'updater.check_now')}</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-zinc-500 dark:text-zinc-400 font-mono">{t('updater.current_version')} {updateInfo?.current_version || runningVersion}</span>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300"><input type="checkbox" disabled={!config} checked={startup} onChange={event => { if (!config) return; const next = event.target.checked; setStartup(next); void saveConfig({ ...config, check_updates_on_startup: next }, true).catch(() => setStartup(config.check_updates_on_startup !== false)); }} className="accent-zinc-900 dark:accent-zinc-100" />{t('updater.startup')}</label>
        </div>
        {(error || configError) && <p role="alert" className="mt-3 text-xs text-rose-500">{t('updater.failed')}</p>}
        {updateInfo && <p role="status" className="mt-3 text-xs text-zinc-600 dark:text-zinc-300">{updateInfo.has_update ? <button onClick={() => setDialogOpen(true)} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">{t('updater.available', { version: updateInfo.latest_version })}</button> : t('updater.latest')}</p>}
    </section>;
}
