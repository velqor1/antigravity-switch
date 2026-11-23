import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, MoreVertical, Sun, Moon, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { NavItem, Language } from './constants';

const DROPDOWN_SPRING = {
    type: 'spring' as const,
    stiffness: 540,
    damping: 34,
    mass: 0.7,
};

export function useClickOutside(
    ref: React.RefObject<HTMLElement | null>,
    handler: () => void
) {
    useEffect(() => {
        const listener = (event: MouseEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler();
        };

        document.addEventListener('mousedown', listener);
        return () => document.removeEventListener('mousedown', listener);
    }, [ref, handler]);
}

interface LanguageDropdownProps {
    currentLanguage: string;
    languages: Language[];
    onLanguageChange: (langCode: string) => void;
    className?: string;
}

export function LanguageDropdown({
    currentLanguage,
    languages,
    onLanguageChange,
    className = ''
}: LanguageDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useClickOutside(menuRef, () => setIsOpen(false));

    const handleLanguageChange = (langCode: string) => {
        onLanguageChange(langCode);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={menuRef}>
            <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1e23] hover:border-zinc-400/60 dark:hover:border-white/[0.15] flex items-center justify-center transition-colors"
                title={t('settings.general.language')}
            >
                <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-200">
                    {languages.find(l => l.code === currentLanguage)?.short || 'EN'}
                </span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -6 }}
                        transition={DROPDOWN_SPRING}
                        className="absolute ltr:right-0 rtl:left-0 mt-2 w-40 bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-zinc-200/90 dark:border-white/[0.1] p-1 overflow-hidden ltr:origin-top-right rtl:origin-top-left z-[200]"
                    >
                        {languages.map((lang) => {
                            const selected = currentLanguage === lang.code;
                            return (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`w-full px-3 py-2 rounded-lg text-left text-sm flex items-center justify-between transition-colors ${
                                        selected
                                            ? 'text-zinc-950 dark:text-white font-semibold bg-zinc-100 dark:bg-white/[0.09]'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-zinc-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="font-mono font-bold text-[11px] w-5">{lang.short}</span>
                                        <span className="text-xs">{lang.label}</span>
                                    </div>
                                    {selected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface NavigationDropdownProps {
    navItems: NavItem[];
    isActive: (path: string) => boolean;
    getCurrentNavItem: () => NavItem | undefined;
    onNavigate: () => void;
    showLabel?: boolean;
}

export function NavigationDropdown({
    navItems,
    isActive,
    getCurrentNavItem,
    onNavigate,
    showLabel = true
}: NavigationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useClickOutside(menuRef, () => setIsOpen(false));

    const handleNavItemClick = () => {
        setIsOpen(false);
        onNavigate();
    };

    const currentItem = getCurrentNavItem();
    const CurrentIcon = currentItem?.icon;

    if (!currentItem || !CurrentIcon) return null;

    return (
        <div className="relative" ref={menuRef}>
            <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1e23] transition-colors"
            >
                <CurrentIcon className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-200" />
                {showLabel && (
                    <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {currentItem.label}
                    </span>
                )}
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -6 }}
                        transition={DROPDOWN_SPRING}
                        className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-zinc-200/90 dark:border-white/[0.1] p-1 overflow-hidden origin-top z-[200]"
                    >
                        {navItems.map((item) => {
                            const active = isActive(item.path);
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    draggable="false"
                                    onClick={handleNavItemClick}
                                    className={`w-full px-3.5 py-2.5 rounded-lg text-left text-sm flex items-center gap-3 transition-colors ${
                                        active
                                            ? 'text-zinc-950 dark:text-white font-semibold bg-zinc-100 dark:bg-white/[0.09]'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.05] hover:text-zinc-900 dark:hover:text-zinc-100'
                                    }`}
                                >
                                    <item.icon className="w-4 h-4" />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface MoreDropdownProps {
    theme: 'light' | 'dark';
    currentLanguage: string;
    languages: Language[];
    onThemeToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onLanguageChange: (langCode: string) => void;
}

export function MoreDropdown({
    theme,
    currentLanguage,
    languages,
    onThemeToggle,
    onLanguageChange
}: MoreDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useClickOutside(menuRef, () => setIsOpen(false));

    const handleThemeToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
        onThemeToggle(event);
        setIsOpen(false);
    };

    const handleLanguageChange = (langCode: string) => {
        onLanguageChange(langCode);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1e23] flex items-center justify-center transition-colors"
                title={t('nav.more', 'Ещё')}
            >
                <MoreVertical className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.94, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -6 }}
                        transition={DROPDOWN_SPRING}
                        className="absolute ltr:right-0 rtl:left-0 mt-2 w-44 bg-white/95 dark:bg-[#141417]/95 backdrop-blur-xl rounded-xl shadow-2xl border border-zinc-200/90 dark:border-white/[0.1] p-1 overflow-hidden ltr:origin-top-right rtl:origin-top-left z-[200]"
                    >
                        <button
                            type="button"
                            onClick={handleThemeToggle}
                            className="w-full px-3 py-2 rounded-lg text-left text-xs font-medium flex items-center gap-2.5 hover:bg-zinc-100/70 dark:hover:bg-white/[0.06] transition-colors text-zinc-700 dark:text-zinc-200"
                        >
                            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                            <span>{theme === 'light' ? t('nav.theme_to_dark') : t('nav.theme_to_light')}</span>
                        </button>

                        <div className="my-1 border-t border-zinc-200/80 dark:border-white/[0.07]" />

                        {languages.map((lang) => {
                            const selected = currentLanguage === lang.code;
                            return (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => handleLanguageChange(lang.code)}
                                    className={`w-full px-3 py-2 rounded-lg text-left text-xs flex items-center justify-between transition-colors ${
                                        selected
                                            ? 'text-zinc-950 dark:text-white font-semibold bg-zinc-100 dark:bg-white/[0.09]'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-[11px]">{lang.short}</span>
                                        <span>{lang.label}</span>
                                    </div>
                                    {selected && <Check className="w-3.5 h-3.5" />}
                                </button>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
