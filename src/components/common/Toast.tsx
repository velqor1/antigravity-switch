import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { motion } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
    onClose: (id: string) => void;
}

const Toast = ({ id, message, type, duration = 3000, onClose }: ToastProps) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => onClose(id), 220);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, id, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />;
            case 'error': return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
            case 'info': default: return <Info className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0" />;
        }
    };

    const getStyles = () => {
        switch (type) {
            case 'success': return 'border-emerald-500/25 bg-white/95 dark:bg-[#141417]/95';
            case 'error': return 'border-rose-500/25 bg-white/95 dark:bg-[#141417]/95';
            case 'warning': return 'border-amber-500/25 bg-white/95 dark:bg-[#141417]/95';
            case 'info': default: return 'border-zinc-200/90 dark:border-white/[0.1] bg-white/95 dark:bg-[#141417]/95';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 32 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl ${getStyles()}`}
            style={{ minWidth: '280px' }}
        >
            {getIcon()}
            <p className="flex-1 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{message}</p>
            <button
                type="button"
                onClick={() => { setIsVisible(false); setTimeout(() => onClose(id), 220); }}
                className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </motion.div>
    );
};

export default Toast;
