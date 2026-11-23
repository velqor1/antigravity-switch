import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, Copy, X } from 'lucide-react';
import { motion } from 'motion/react';
import { isTauri } from '../../utils/env';

export function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!isTauri()) return;
        const win = getCurrentWindow();
        let active = true;

        const syncState = async () => {
            try {
                const max = await win.isMaximized();
                if (active) setIsMaximized(max);
            } catch {
                // Ignore if window handle is transitioning
            }
        };

        void syncState();
        const unlistenPromise = win.onResized(() => {
            void syncState();
        });

        return () => {
            active = false;
            void unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
        };
    }, []);

    if (!isTauri()) return null;

    const handleMinimize = async () => {
        try {
            await getCurrentWindow().minimize();
        } catch (error) {
            console.error('Failed to minimize window:', error);
        }
    };

    const handleToggleMaximize = async () => {
        try {
            const win = getCurrentWindow();
            await win.toggleMaximize();
            setIsMaximized(await win.isMaximized());
        } catch (error) {
            console.error('Failed to toggle maximize:', error);
        }
    };

    const handleClose = async () => {
        try {
            await getCurrentWindow().close();
        } catch (error) {
            console.error('Failed to close window:', error);
        }
    };

    return (
        <div
            className="flex items-center gap-1 pl-2 ml-1.5 border-l border-zinc-200/80 dark:border-white/[0.08]"
            onMouseDown={(e) => e.stopPropagation()}
        >
            <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                onClick={handleMinimize}
                aria-label="Minimize"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/75 dark:hover:bg-white/[0.08] transition-colors"
            >
                <Minus className="w-3.5 h-3.5" strokeWidth={2.2} />
            </motion.button>

            <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                onClick={handleToggleMaximize}
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/75 dark:hover:bg-white/[0.08] transition-colors"
            >
                {isMaximized ? (
                    <Copy className="w-3.5 h-3.5 -scale-x-100" strokeWidth={2} />
                ) : (
                    <Square className="w-3 h-3" strokeWidth={2.2} />
                )}
            </motion.button>

            <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                onClick={handleClose}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-white hover:bg-rose-500 dark:hover:bg-rose-600 transition-colors"
            >
                <X className="w-3.5 h-3.5" strokeWidth={2.2} />
            </motion.button>
        </div>
    );
}
