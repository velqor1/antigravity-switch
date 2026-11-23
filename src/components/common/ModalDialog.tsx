import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export type ModalType = 'confirm' | 'success' | 'error' | 'info';

interface ModalDialogProps {
    isOpen: boolean;
    title: string;
    message?: string;
    children?: React.ReactNode;
    type?: ModalType;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export default function ModalDialog({
    isOpen,
    title,
    message,
    children,
    type = 'confirm',
    onConfirm,
    onCancel,
    confirmText,
    cancelText,
    isDestructive = false
}: ModalDialogProps) {
    const { t } = useTranslation();
    const finalConfirmText = confirmText || t('common.confirm');
    const finalCancelText = cancelText || t('common.cancel');

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="w-7 h-7 text-emerald-500" />;
            case 'error':
                return <XCircle className="w-7 h-7 text-rose-500" />;
            case 'info':
                return <Info className="w-7 h-7 text-zinc-700 dark:text-zinc-200" />;
            case 'confirm':
            default:
                return isDestructive
                    ? <AlertTriangle className="w-7 h-7 text-rose-500" />
                    : <AlertTriangle className="w-7 h-7 text-zinc-700 dark:text-zinc-200" />;
        }
    };

    const getIconBg = () => {
        switch (type) {
            case 'success': return 'bg-emerald-500/12';
            case 'error': return 'bg-rose-500/12';
            case 'info': return 'bg-zinc-200/80 dark:bg-white/[0.08]';
            case 'confirm': default: return isDestructive ? 'bg-rose-500/12' : 'bg-zinc-200/80 dark:bg-white/[0.08]';
        }
    };

    const showCancel = type === 'confirm' && onCancel;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={showCancel ? onCancel : undefined}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ type: 'spring', stiffness: 460, damping: 32, mass: 0.78 }}
                        className="relative z-10 w-full max-w-sm bg-white dark:bg-[#141417] border border-zinc-200/90 dark:border-white/[0.1] shadow-2xl rounded-2xl overflow-hidden"
                    >
                        <div className="flex flex-col items-center text-center p-6 pt-8">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${getIconBg()}`}>
                                {getIcon()}
                            </div>

                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>

                            {children ? (
                                <div className="w-full text-left mb-7 px-1">
                                    {children}
                                </div>
                            ) : (
                                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-7 leading-relaxed px-3 whitespace-pre-line">{message}</p>
                            )}

                            <div className="flex gap-2.5 w-full">
                                {showCancel && (
                                    <motion.button
                                        type="button"
                                        whileTap={{ scale: 0.97 }}
                                        className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-200 font-semibold text-sm rounded-xl hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-colors"
                                        onClick={onCancel}
                                    >
                                        {finalCancelText}
                                    </motion.button>
                                )}
                                <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.97 }}
                                    className={`flex-1 px-4 py-2.5 font-semibold text-sm rounded-xl shadow-sm transition-colors ${isDestructive && type === 'confirm'
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-950'
                                        }`}
                                    onClick={onConfirm}
                                >
                                    {finalConfirmText}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
