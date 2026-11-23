import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateStore } from '../../stores/useUpdateStore';
import { downloadAndInstallUpdate, UpdateProgress } from '../../services/updaterService';
export default function UpdateDialog() {
    const { t } = useTranslation();
    const { updateInfo, isDialogOpen, setDialogOpen } = useUpdateStore();
    const close = useRef<HTMLButtonElement>(null), view = useRef<HTMLButtonElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<UpdateProgress | null>(null);
    const installing = useRef(false);
    const panel = useRef<HTMLElement>(null);
    const dismiss = () => { if (!installing.current) setDialogOpen(false); };
    const install = async () => {
        if (installing.current) return;
        installing.current = true; setBusy(true); setError(null); setProgress(null);
        try { await downloadAndInstallUpdate(updateInfo!.latest_version, setProgress); }
        catch (failure) { setProgress(null); setError(String(failure).includes('update_open_failed') ? 'updater.open_failed' : String(failure).includes('update_mac_manual_required') ? 'updater.mac_manual_required' : String(failure).includes('update_mac_trust_required') ? 'updater.mac_trust_required' : String(failure).includes('update_restore_failed') ? 'updater.restore_failed' : 'updater.install_failed'); }
        finally { installing.current = false; setBusy(false); }
    };
    useEffect(() => { if (!isDialogOpen) return; const previous = document.activeElement as HTMLElement; setError(null); close.current?.focus(); return () => previous?.focus(); }, [isDialogOpen]);
    useEffect(() => { if (isDialogOpen) (busy ? panel.current : close.current)?.focus(); }, [busy, isDialogOpen]);
    if (!isDialogOpen || !updateInfo) return null;
    return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={dismiss}>
        <section ref={panel} tabIndex={-1} aria-busy={busy} role="dialog" aria-modal="true" aria-labelledby="update-dialog-title" className="w-full max-w-md rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-2xl dark:border-white/[0.1] dark:bg-[#141417]" onClick={e => e.stopPropagation()} onKeyDown={e => {
            if (e.key === 'Escape') dismiss();
            if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === close.current ? view.current : close.current)?.focus(); }
        }}>
            <h2 id="update-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('updater.dialog_title')}</h2>
            <p className="my-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{t('updater.dialog_desc', { version: updateInfo.latest_version })}</p>
            {error && <p role="alert" className="mb-3 text-xs text-rose-500">{t(error)}</p>}
            {progress && <p role="status" className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">{t(progress.stage === 'installing' ? 'updater.installing' : 'updater.downloading')} {progress.stage === 'downloading' && progress.total ? `${Math.min(100, Math.round(progress.downloaded / progress.total * 100))}%` : ''}</p>}
            <div className="flex justify-end gap-3"><button ref={close} disabled={busy} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-white/[0.1] dark:text-zinc-200 dark:hover:bg-white/[0.08]" onClick={dismiss}>{t('updater.dismiss')}</button><button ref={view} disabled={busy} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white" onClick={() => void install()}>{t(busy ? 'updater.updating' : 'updater.install_now')}</button></div>
        </section>
    </div>;
}
