import { LayoutDashboard, Users, Settings } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { isTauri, isLinux } from '../../utils/env';
import { NavLogo } from './NavLogo';
import { NavMenu } from './NavMenu';
import { NavSettings } from './NavSettings';
import { WindowControls } from './WindowControls';
import { normalizeLanguage, type NavItem } from './constants';

/**
 * Unified custom frameless titlebar + main navigation header
 */
function Navbar() {
    const { t } = useTranslation();
    const { config, saveConfig } = useConfigStore();

    const navItems: NavItem[] = [
        { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard, priority: 'high' },
        { path: '/accounts', label: t('nav.accounts'), icon: Users, priority: 'high' },
        { path: '/settings', label: t('nav.settings'), icon: Settings, priority: 'high' },
    ];

    const resolveEffectiveTheme = (): 'light' | 'dark' => {
        if (config?.theme === 'light' || config?.theme === 'dark') {
            return config.theme;
        }
        if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
            return 'dark';
        }
        if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'dark';
    };

    const effectiveTheme = resolveEffectiveTheme();

    const toggleTheme = async (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!config) return;

        const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';

        if ('startViewTransition' in document && !isLinux()) {
            const x = event.clientX;
            const y = event.clientY;
            const endRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );

            // @ts-ignore
            const transition = document.startViewTransition(async () => {
                saveConfig({
                    ...config,
                    theme: newTheme,
                    language: config.language
                }, true);
            });

            transition.ready.then(() => {
                const isDarkMode = newTheme === 'dark';
                const clipPath = isDarkMode
                    ? [`circle(${endRadius}px at ${x}px ${y}px)`, `circle(0px at ${x}px ${y}px)`]
                    : [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`];

                document.documentElement.animate(
                    { clipPath },
                    {
                        duration: 460,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        fill: 'forwards',
                        pseudoElement: isDarkMode ? '::view-transition-old(root)' : '::view-transition-new(root)'
                    }
                );
            });
        } else {
            await saveConfig({
                ...config,
                theme: newTheme,
                language: config.language
            }, true);
        }
    };

    const handleLanguageChange = async (langCode: string) => {
        if (!config) return;

        await saveConfig({
            ...config,
            language: langCode,
            theme: config.theme
        }, true);
    };

    const isInteractiveTarget = (target: EventTarget | null) => {
        if (!(target instanceof HTMLElement)) return false;
        return Boolean(target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]'));
    };

    const handleHeaderMouseDown = (event: React.MouseEvent<HTMLElement>) => {
        if (!isTauri() || event.button !== 0 || isInteractiveTarget(event.target)) return;
        if (event.detail === 2) {
            void getCurrentWindow().toggleMaximize().catch(() => {});
            return;
        }
        void getCurrentWindow().startDragging().catch(() => {});
    };

    return (
        <header
            onMouseDown={handleHeaderMouseDown}
            style={{ position: 'sticky', top: 0, zIndex: 150 }}
            className="shrink-0 select-none transition-colors duration-200 bg-[#f5f5f7]/90 dark:bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/[0.07]"
        >
            <div
                className="w-full px-4 sm:px-5 h-[56px] flex items-center justify-between relative"
            >
                {/* Left: Brand logo */}
                <div className="flex items-center shrink-0">
                    <NavLogo />
                </div>

                {/* Center: Animated navigation capsule */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <NavMenu navItems={navItems} />
                </div>

                {/* Right: Theme + Language + Custom Window Controls */}
                <div className="ml-auto flex items-center shrink-0">
                    <NavSettings
                        theme={effectiveTheme}
                        currentLanguage={normalizeLanguage(config?.language)}
                        onThemeToggle={toggleTheme}
                        onLanguageChange={handleLanguageChange}
                    />
                    <WindowControls />
                </div>
            </div>
        </header>
    );
}

export default Navbar;
