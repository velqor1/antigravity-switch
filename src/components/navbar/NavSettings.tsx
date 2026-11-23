import { Sun, Moon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LanguageDropdown, MoreDropdown } from './NavDropdowns';
import { LANGUAGES } from './constants';

interface NavSettingsProps {
    theme: 'light' | 'dark';
    currentLanguage: string;
    onThemeToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onLanguageChange: (langCode: string) => void;
}

export function NavSettings({
    theme,
    currentLanguage,
    onThemeToggle,
    onLanguageChange
}: NavSettingsProps) {
    const { t } = useTranslation();

    return (
        <>
            {/* 独立按钮 (≥ 480px) */}
            <div className="hidden min-[480px]:flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
                {/* 主题切换按钮 */}
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    onClick={onThemeToggle}
                    className="w-8 h-8 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1e23] hover:border-zinc-400/60 dark:hover:border-white/[0.15] flex items-center justify-center transition-colors overflow-hidden"
                    title={theme === 'light' ? t('nav.theme_to_dark') : t('nav.theme_to_light')}
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {theme === 'light' ? (
                            <motion.span
                                key="moon"
                                initial={{ rotate: -45, scale: 0.6, opacity: 0 }}
                                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                                exit={{ rotate: 45, scale: 0.6, opacity: 0 }}
                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="flex items-center justify-center"
                            >
                                <Moon className="w-3.5 h-3.5 text-zinc-700" />
                            </motion.span>
                        ) : (
                            <motion.span
                                key="sun"
                                initial={{ rotate: 45, scale: 0.6, opacity: 0 }}
                                animate={{ rotate: 0, scale: 1, opacity: 1 }}
                                exit={{ rotate: -45, scale: 0.6, opacity: 0 }}
                                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                className="flex items-center justify-center"
                            >
                                <Sun className="w-3.5 h-3.5 text-zinc-200" />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>

                {/* 语言切换下拉菜单 */}
                <LanguageDropdown
                    currentLanguage={currentLanguage}
                    languages={LANGUAGES}
                    onLanguageChange={onLanguageChange}
                />
            </div>

            {/* 更多菜单 (< 480px) */}
            <div className="min-[480px]:hidden" onMouseDown={(e) => e.stopPropagation()}>
                <MoreDropdown
                    theme={theme}
                    currentLanguage={currentLanguage}
                    languages={LANGUAGES}
                    onThemeToggle={onThemeToggle}
                    onLanguageChange={onLanguageChange}
                />
            </div>
        </>
    );
}
