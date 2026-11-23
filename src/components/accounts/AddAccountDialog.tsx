import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Database, Globe, FileSearch, Loader2, CheckCircle2, XCircle, Copy, Check, Info, Link2 } from 'lucide-react';
import { useAccountStore } from '../../stores/useAccountStore';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { request as invoke } from '../../utils/request';
import { isTauri } from '../../utils/env';
import { parseAccountTransfer } from '../../utils/accountTransfer';
import { importAccountTransfer, importLocalAccountsReport, type LocalImportSource } from '../../services/accountService';
import { copyToClipboard } from '../../utils/clipboard';

interface AddAccountDialogProps {
    onAdd: (email: string, refreshToken: string) => Promise<void>;
    showText?: boolean;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

function AddAccountDialog({ onAdd, showText = true }: AddAccountDialogProps) {
    const { t } = useTranslation();
    const fetchAccounts = useAccountStore(state => state.fetchAccounts);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'oauth' | 'token' | 'import'>(isTauri() ? 'oauth' : 'token');
    const [refreshToken, setRefreshToken] = useState('');
    const [oauthUrl, setOauthUrl] = useState('');
    const [oauthUrlCopied, setOauthUrlCopied] = useState(false);
    const [manualCode, setManualCode] = useState('');

    // UI State
    const [status, setStatus] = useState<Status>('idle');
    const [importSources, setImportSources] = useState<LocalImportSource[]>([]);
    const [message, setMessage] = useState('');

    const { startOAuthLogin, completeOAuthLogin, cancelOAuthLogin, importFromCustomDb } = useAccountStore();

    const oauthUrlRef = useRef(oauthUrl);
    const statusRef = useRef(status);
    const activeTabRef = useRef(activeTab);
    const isOpenRef = useRef(isOpen);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    }, []);

    useEffect(() => {
        oauthUrlRef.current = oauthUrl;
        statusRef.current = status;
        activeTabRef.current = activeTab;
        isOpenRef.current = isOpen;
    }, [oauthUrl, status, activeTab, isOpen]);

    // Reset state when dialog opens or tab changes
    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, activeTab]);

    // Listen for OAuth URL
    useEffect(() => {
        if (!isTauri()) return;
        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            unlisten = await listen('oauth-url-generated', (event) => {
                setOauthUrl(event.payload as string);
                // 自动复制到剪贴板? 可选，这里只设置状态让用户手动复制
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, []);

    // Listen for OAuth callback completion (user may open the URL manually without clicking Start)
    useEffect(() => {
        if (!isTauri()) return;
        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            unlisten = await listen('oauth-callback-received', async () => {
                if (!isOpenRef.current) return;
                if (activeTabRef.current !== 'oauth') return;
                if (statusRef.current === 'loading' || statusRef.current === 'success') return;
                if (!oauthUrlRef.current) return;

                // Auto-complete: exchange code and save account (no browser open)
                setStatus('loading');
                setMessage(`${t('accounts.add.tabs.oauth')}...`);

                try {
                    await completeOAuthLogin();
                    setStatus('success');
                    setMessage(`${t('accounts.add.tabs.oauth')} ${t('common.success')}!`);
                    closeTimerRef.current = setTimeout(() => {
                        setIsOpen(false);
                        resetState();
                    }, 1500);
                } catch (error) {
                    setStatus('error');
                    let errorMsg = String(error);
                    if (errorMsg.includes('Refresh Token') || errorMsg.includes('refresh_token')) {
                        setMessage(errorMsg);
                    } else if (errorMsg.includes('Tauri') || errorMsg.toLowerCase().includes('environment') || errorMsg.includes('环境')) {
                        setMessage(t('common.environment_error', { error: errorMsg }));
                    } else {
                        setMessage(`${t('accounts.add.tabs.oauth')} ${t('common.error')}: ${errorMsg}`);
                    }
                }
            });
        };

        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [completeOAuthLogin, t]);

    // Pre-generate OAuth URL when dialog opens on OAuth tab (so URL is shown BEFORE "Start OAuth")
    useEffect(() => {
        if (!isOpen) return;
        if (activeTab !== 'oauth') return;
        if (oauthUrl) return;

        let disposed = false;
        invoke<any>('prepare_oauth_url')
            .then((res) => {
                const url = typeof res === 'string' ? res : res?.url;
                if (!url || url.length === 0) return;
                if (disposed) {
                    cancelOAuthLogin().catch(() => { });
                    return;
                }
                setOauthUrl(url);
            })
            .catch((e) => {
                console.error('Failed to prepare OAuth URL:', e);
            });

        return () => {
            disposed = true;
        };
    }, [isOpen, activeTab, oauthUrl, cancelOAuthLogin]);

    // If user navigates away from OAuth tab, cancel prepared flow to release the port.
    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === 'oauth') return;
        if (!oauthUrl) return;

        cancelOAuthLogin().catch(() => { });
        setOauthUrl('');
        setOauthUrlCopied(false);
    }, [isOpen, activeTab]);

    const resetState = () => {
        if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
        setStatus('idle');
        setMessage('');
        setImportSources([]);
        setRefreshToken('');
        setOauthUrl('');
        setOauthUrlCopied(false);
        setManualCode('');
    };

    const closeDialog = async () => {
        if (activeTab === 'oauth') {
            await cancelOAuthLogin().catch(() => { });
        }
        setIsOpen(false);
        resetState();
    };

    const handleAction = async (
        actionName: string,
        actionFn: () => Promise<any>,
        options?: { clearOauthUrl?: boolean }
    ) => {
        setStatus('loading');
        setMessage(`${actionName}...`);
        if (options?.clearOauthUrl !== false) {
            setOauthUrl(''); // Clear previous URL
        }
        try {
            await actionFn();
            setStatus('success');
            setMessage(`${actionName} ${t('common.success')}!`);

            // 延迟关闭,让用户看到成功状态
            closeTimerRef.current = setTimeout(() => {
                setIsOpen(false);
                resetState();
            }, 1500);
        } catch (error) {
            setStatus('error');

            // 改进错误信息显示
            let errorMsg = String(error);

            // 如果是 refresh_token 缺失错误,显示完整信息(包含解决方案)
            if (errorMsg.includes('Refresh Token') || errorMsg.includes('refresh_token')) {
                setMessage(errorMsg);
            } else if (errorMsg.includes('Tauri') || errorMsg.toLowerCase().includes('environment') || errorMsg.includes('环境')) {
                // 环境错误
                setMessage(t('common.environment_error', { error: errorMsg }));
            } else {
                // 其他错误
                setMessage(`${actionName} ${t('common.error')}: ${errorMsg}`);
            }
        }
    };

    const handleSubmit = async () => {
        if (!refreshToken) {
            setStatus('error');
            setMessage(t('accounts.add.token.error_token'));
            return;
        }

        setStatus('loading');

        let items;
        try { items = parseAccountTransfer(refreshToken); }
        catch { setStatus('error'); setMessage(t('accounts.add.token.error_token')); return; }
        const structured = /^[\s]*[\[{]/.test(refreshToken);
        const tokens = items.map(item => item.refresh_token);

        // 3. 批量添加
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < tokens.length; i++) {
            const currentToken = tokens[i];
            setMessage(t('accounts.add.token.batch_progress', { current: i + 1, total: tokens.length }));

            try {
                if (structured) await importAccountTransfer(items[i]);
                else await onAdd("", currentToken);
                successCount++;
            } catch (error) {
                console.error(`Failed to add token ${i + 1}:`, error);
                failCount++;
            }
            // 稍微延迟一下,避免太快
            await new Promise(r => setTimeout(r, 100));
        }

        await fetchAccounts();
        // 4. 结果反馈
        if (successCount === tokens.length) {
            setStatus('success');
            setMessage(t('accounts.add.token.batch_success', { count: successCount }));
            closeTimerRef.current = setTimeout(() => {
                setIsOpen(false);
                resetState();
            }, 1500);
        } else if (successCount > 0) {
            // 部分成功
            setStatus('success'); // 还是用绿色,但提示部分失败
            setMessage(t('accounts.add.token.batch_partial', { success: successCount, fail: failCount }));
            // 不自动关闭,让用户看到结果
        } else {
            // 全部失败
            setStatus('error');
            setMessage(t('accounts.add.token.batch_fail'));
        }
    };

    const handleOAuthWeb = async () => {
        try {
            setStatus('loading');
            setMessage(t('accounts.add.oauth.btn_start') + '...');

            // 1. 获取 URL (指向 /auth/callback)
            const res = await invoke<any>('prepare_oauth_url');
            const url = typeof res === 'string' ? res : res.url;

            if (!url) {
                throw new Error(t('accounts.add.oauth.error_no_url'));
            }

            setOauthUrl(url); // 确保链接在 UI 中可见，方便用户手动复制

            // 2. 打开新标签页 (响应用户反馈：Web 端直接使用新标签体验更好)
            const popup = window.open(url, '_blank');

            if (!popup) {
                setStatus('error');
                setMessage(t('accounts.add.oauth.popup_blocked'));
                return;
            }

            // 3. 监听消息
            const handleMessage = async (event: MessageEvent) => {
                // 安全检查: 如果定义了 ORIGIN 校验更好，这里暂时检查 data type
                if (event.data?.type === 'oauth-success') {
                    popup.close();
                    window.removeEventListener('message', handleMessage);

                    // 4. 成功后刷新列表
                    await fetchAccounts();

                    setStatus('success');
                    setMessage(t('accounts.add.oauth_success') || t('common.success'));

                    closeTimerRef.current = setTimeout(() => {
                        setIsOpen(false);
                        resetState();
                    }, 1500);
                }
            };

            window.addEventListener('message', handleMessage);

            // 5. 检测窗口关闭 (用户手动关闭)
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    window.removeEventListener('message', handleMessage);
                    if (statusRef.current === 'loading') { // 如果还在 loading 状态就关闭了，说明取消了
                        setStatus('idle');
                        setMessage('');
                    }
                }
            }, 1000);

        } catch (error) {
            console.error('OAuth Web Error:', error);
            setStatus('error');
            setMessage(`${t('common.error')}: ${error}`);
        }
    };

    const handleOAuth = () => {
        if (!isTauri()) {
            handleOAuthWeb();
            return;
        }
        // Default flow: opens the default browser and completes automatically.
        // (If user opened the URL manually, completion is also triggered by oauth-callback-received.)
        handleAction(t('accounts.add.tabs.oauth'), startOAuthLogin, { clearOauthUrl: false });
    };

    const handleCompleteOAuth = () => {
        // Manual flow: user already authorized in their preferred browser, just finish the flow.
        handleAction(t('accounts.add.tabs.oauth'), completeOAuthLogin, { clearOauthUrl: false });
    };

    const handleCopyUrl = async () => {
        if (oauthUrl) {
            const success = await copyToClipboard(oauthUrl);
            if (success) {
                setOauthUrlCopied(true);
                window.setTimeout(() => setOauthUrlCopied(false), 1500);
            }
        }
    };

    const handleManualSubmit = async () => {
        if (!manualCode.trim()) return;

        setStatus('loading');
        setMessage(t('accounts.add.oauth.manual_submitting'));

        try {
            await invoke('submit_oauth_code', { code: manualCode.trim(), state: null });

            // 提交成功反馈
            setStatus('success');
            setMessage(t('accounts.add.oauth.manual_submitted'));

            setManualCode('');

            // 对齐 Web 模式下的刷新逻辑
            if (!isTauri()) {
                closeTimerRef.current = setTimeout(async () => {
                    await fetchAccounts();
                    setIsOpen(false);
                    resetState();
                }, 2000);
            }
        } catch (error) {
            let errStr = String(error);
            if (errStr.includes("No active OAuth flow")) {
                setMessage(t('accounts.add.oauth.error_no_flow'));
                setStatus('error');
            } else {
                setMessage(`${t('common.error')}: ${errStr}`);
                setStatus('error');
            }
        }
    };

    const handleImportDb = async () => {
        setStatus('loading'); setMessage(t('accounts.add.import.scan_btn') + '…'); setImportSources([]);
        try {
            const report = await importLocalAccountsReport();
            await fetchAccounts();
            setImportSources(report.sources);
            const failed = report.sources.filter(source => !['imported', 'duplicate'].includes(source.status)).length;
            setStatus(report.accounts.length ? 'success' : 'error');
            setMessage(t('accounts.add.import.summary', { success: report.accounts.length, failed }));
        } catch (error) { setStatus('error'); setMessage(String(error)); }
    };

    const handleImportCustomDb = async () => {
        try {
            if (!isTauri()) {
                alert(t('common.tauri_api_not_loaded') || 'Storage import only works in desktop app.');
                return;
            }
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Account Export / VSCode DB',
                    extensions: ['json', 'vscdb']
                }, {
                    name: 'JSON Export',
                    extensions: ['json']
                }, {
                    name: 'VSCode DB',
                    extensions: ['vscdb']
                }, {
                    name: 'All Files',
                    extensions: ['*']
                }]
            });

            if (selected && typeof selected === 'string') {
                setStatus('loading');
                setMessage(t('accounts.add.import.file_btn') + '…');
                const report = await importFromCustomDb(selected);
                if (report.failed > 0) {
                    setStatus(report.imported > 0 ? 'success' : 'error');
                    setMessage(report.imported > 0
                        ? t('accounts.add.token.batch_partial', { success: report.imported, fail: report.failed })
                        : t('accounts.add.token.batch_fail'));
                } else {
                    setStatus('success');
                    setMessage(t('accounts.add.token.batch_success', { count: report.imported }));
                    closeTimerRef.current = setTimeout(() => { setIsOpen(false); resetState(); }, 1500);
                }
            }
        } catch (err) {
            setStatus('error');
            setMessage(String(err));
        }
    };

    // 状态提示组件
    const StatusAlert = () => {
        if (status === 'idle' || !message) return null;

        const styles = {
            loading: 'alert-info',
            success: 'alert-success',
            error: 'alert-error'
        };

        const icons = {
            loading: <Loader2 className="w-5 h-5 animate-spin" />,
            success: <CheckCircle2 className="w-5 h-5" />,
            error: <XCircle className="w-5 h-5" />
        };

        return (
            <div className={`alert ${styles[status]} mb-4 text-sm py-2 shadow-sm`}>
                {icons[status]}
                <div><span>{message}</span>{importSources.length > 0 && <><p className="mt-2">{t('accounts.add.import.failure_hint')}</p><ul className="mt-2 max-h-36 overflow-y-auto space-y-1 text-xs">{importSources.map((source, index) => <li key={index} className="break-all">{source.source}: {t('accounts.add.import.status_' + source.status)}</li>)}</ul></>}</div>
            </div>
        );
    };

    return (
        <>
            <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="px-2.5 lg:px-3 py-2 bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-xl hover:bg-zinc-100 dark:hover:bg-[#1d1d22] transition-colors flex items-center gap-1.5 shadow-xs border border-zinc-200/80 dark:border-white/[0.09]"
                onClick={() => {
                    setIsOpen(true);
                }}
                title={!showText ? t('accounts.add_account') : undefined}
            >
                <Plus className="w-4 h-4" />
                {showText && <span className="hidden lg:inline">{t('accounts.add_account')}</span>}
            </motion.button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => void closeDialog()}
                            />

                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                                transition={{ type: 'spring', stiffness: 460, damping: 32, mass: 0.78 }}
                                className="bg-white dark:bg-[#141417] border border-zinc-200/90 dark:border-white/[0.1] text-zinc-900 dark:text-zinc-100 rounded-2xl shadow-2xl w-full max-w-lg p-6 relative z-[10] max-h-[90vh] overflow-y-auto"
                            >
                                <h3 className="font-bold text-lg mb-4">{t('accounts.add.title')}</h3>

                                {/* Animated Tab Capsule */}
                                <div className="bg-zinc-200/70 dark:bg-[#1c1c21] border border-zinc-300/50 dark:border-white/[0.06] p-1 rounded-xl mb-6 grid grid-cols-3 gap-1">
                                    {([
                                        { id: 'oauth' as const, label: t('accounts.add.tabs.oauth') },
                                        { id: 'token' as const, label: t('accounts.add.tabs.token') },
                                        { id: 'import' as const, label: t('accounts.add.tabs.import') },
                                    ]).map((tab) => {
                                        const active = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                className={`relative py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                                                    active
                                                        ? 'text-white dark:text-zinc-950'
                                                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                                }`}
                                                onClick={() => setActiveTab(tab.id)}
                                            >
                                                {active && (
                                                    <motion.span
                                                        layoutId="add-account-tab-pill"
                                                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                                        className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                                                    />
                                                )}
                                                <span className="relative z-10">{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {!isTauri() && (
                                    <div className="mb-4 rounded-xl text-xs py-2.5 px-3 flex items-center gap-2 bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08]">
                                        <Info className="w-4 h-4 shrink-0" />
                                        <span>{t('accounts.add.oauth.web_hint', 'Откроется страница входа Google')}</span>
                                    </div>
                                )}

                                <StatusAlert />

                                <div className="min-h-[200px]">
                                    {activeTab === 'oauth' && (
                                        <div className="space-y-6 py-4">
                                            <div className="text-center space-y-3">
                                                <div className="bg-zinc-100 dark:bg-white/[0.07] p-6 rounded-2xl w-20 h-20 mx-auto flex items-center justify-center border border-zinc-200/80 dark:border-white/[0.08]">
                                                    <Globe className="w-9 h-9 text-zinc-700 dark:text-zinc-200" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{t('accounts.add.oauth.recommend')}</h4>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                                                        {t('accounts.add.oauth.desc')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <motion.button
                                                    type="button"
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full px-4 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    onClick={handleOAuth}
                                                    disabled={status === 'loading' || status === 'success'}
                                                >
                                                    {status === 'loading' ? t('accounts.add.oauth.btn_waiting') : t('accounts.add.oauth.btn_start')}
                                                </motion.button>

                                                {oauthUrl && (
                                                    <div className="space-y-2">
                                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-left">
                                                            {t('accounts.add.oauth.link_label')}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-[#18181b] text-zinc-600 dark:text-zinc-300 text-sm font-medium rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.15] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-all flex items-center gap-2"
                                                            onClick={handleCopyUrl}
                                                            title={t('accounts.add.oauth.link_click_to_copy')}
                                                        >
                                                            {oauthUrlCopied ? (
                                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                            ) : (
                                                                <Copy className="w-3.5 h-3.5" />
                                                            )}
                                                            <code className="text-[11px] font-mono truncate flex-1 text-left">
                                                                {oauthUrl}
                                                            </code>
                                                            <span className="text-[11px] whitespace-nowrap">
                                                                {oauthUrlCopied ? t('accounts.add.oauth.copied') : t('accounts.add.oauth.copy_link')}
                                                            </span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="w-full px-4 py-2 bg-white dark:bg-[#18181b] text-zinc-700 dark:text-zinc-200 text-sm font-medium rounded-xl border border-zinc-200 dark:border-white/[0.1] hover:bg-zinc-50 dark:hover:bg-white/[0.08] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                                            onClick={handleCompleteOAuth}
                                                            disabled={status === 'loading' || status === 'success'}
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                            {t('accounts.add.oauth.btn_finish')}
                                                        </button>
                                                    </div>
                                                )}

                                                <div className="pt-4 mt-2 border-t border-zinc-200/70 dark:border-white/[0.07]">
                                                    <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-wider">
                                                        {t('accounts.add.oauth.manual_hint')}
                                                    </div>
                                                    <div className="relative group/manual flex gap-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="text"
                                                                className="w-full text-xs py-2 px-3 bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-white/[0.1] rounded-xl focus:ring-2 focus:ring-zinc-400/40 dark:focus:ring-white/20 outline-none transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                                                                placeholder={t('accounts.add.oauth.manual_placeholder')}
                                                                value={manualCode}
                                                                onChange={(e) => setManualCode(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                                                            onClick={handleManualSubmit}
                                                            disabled={!manualCode.trim()}
                                                        >
                                                            <Link2 className="w-3.5 h-3.5" />
                                                            {t('common.submit')}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'token' && (
                                        <div className="space-y-4 py-2">
                                            <div className="bg-zinc-50 dark:bg-[#18181b] p-4 rounded-xl border border-zinc-200/80 dark:border-white/[0.08]">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t('accounts.add.token.label')}</span>
                                                </div>
                                                <textarea
                                                    className="textarea textarea-bordered w-full h-32 font-mono text-xs leading-relaxed focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition-colors bg-white dark:bg-[#111113] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-white/[0.1] placeholder:text-zinc-400"
                                                    placeholder={t('accounts.add.token.placeholder')}
                                                    value={refreshToken}
                                                    onChange={(e) => setRefreshToken(e.target.value)}
                                                    disabled={status === 'loading' || status === 'success'}
                                                />
                                                <p className="text-[10px] text-zinc-400 mt-2">
                                                    {t('accounts.add.token.hint')}
                                                    <input type="file" accept=".json,application/json" aria-label={t('accounts.add.token.choose_file')} disabled={status === 'loading'} className="block mt-2 file-input file-input-bordered file-input-sm w-full" onChange={async event => { const file = event.target.files?.[0]; if (file) { setRefreshToken(await file.text()); setStatus('idle'); } }} />
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'import' && (
                                        <div className="space-y-4 py-2">
                                            <section className="space-y-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-white/[0.08] dark:bg-[#18181b]">
                                                <div className="space-y-1">
                                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                                        <Database className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                                                        {t('accounts.add.import.scan_title')}
                                                    </h4>
                                                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                        {t('accounts.add.import.scan_desc')}
                                                    </p>
                                                </div>
                                                <motion.button
                                                    type="button"
                                                    whileTap={{ scale: 0.98 }}
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-3 text-sm font-semibold text-white dark:text-zinc-950 shadow-sm transition-colors hover:bg-zinc-800 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                                    onClick={handleImportDb}
                                                    disabled={status === 'loading'}
                                                >
                                                    {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                                                    {t('accounts.add.import.scan_btn')}
                                                </motion.button>
                                            </section>

                                            <section className="space-y-3 rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.12] p-4">
                                                <div className="space-y-1">
                                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                                                        <FileSearch className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                                        {t('accounts.add.import.file_title')}
                                                    </h4>
                                                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                        {t('accounts.add.import.file_desc')}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-all hover:border-zinc-400 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.1] dark:bg-[#18181b] dark:text-zinc-200 dark:hover:border-white/[0.2]"
                                                    onClick={handleImportCustomDb}
                                                    disabled={status === 'loading' || (status === 'success' && importSources.length === 0)}
                                                >
                                                    <FileSearch className="w-4 h-4" />
                                                    {t('accounts.add.import.file_btn')}
                                                </button>
                                            </section>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 w-full mt-6">
                                    <button
                                        type="button"
                                        className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 font-semibold text-sm rounded-xl hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
                                        onClick={() => void closeDialog()}
                                    >
                                        {t('accounts.add.btn_cancel')}
                                    </button>
                                    {activeTab === 'token' && (
                                        <button
                                            type="button"
                                            className="flex-1 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-semibold text-sm rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2"
                                            onClick={status === 'success' ? () => void closeDialog() : handleSubmit}
                                            disabled={status === 'loading'}
                                        >
                                            {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                            {t('accounts.add.btn_confirm')}
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

export default AddAccountDialog;
