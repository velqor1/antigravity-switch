import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, FlaskConical, Gauge, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export const SETTINGS_SECTIONS = [
    { id: 'general', title: 'settings_sections.general', description: 'settings_sections.general_description', icon: Settings },
    { id: 'quota', title: 'settings_sections.quota', description: 'settings_sections.quota_description', icon: Gauge },
    { id: 'autoSwitch', title: 'settings_sections.auto_switch', description: 'settings_sections.auto_switch_description', icon: ArrowLeftRight },
    { id: 'experimental', title: 'settings_sections.experimental', description: 'settings_sections.experimental_description', icon: FlaskConical },
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number]['id'];

export default function SettingsNavigation({ selected, onSelect }: { selected: SettingsSection; onSelect: (section: SettingsSection) => void }) {
    const { t } = useTranslation();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const query = window.matchMedia('(max-width: 639px)');
        const update = () => setNarrow(query.matches);
        update(); query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);

    return (
        <div role="tablist" aria-label={t('settings_sections.navigation')} aria-orientation={narrow ? 'horizontal' : 'vertical'} className="settings-tabs">
            {SETTINGS_SECTIONS.map(({ id, title, icon: Icon }, index) => {
                const isSelected = selected === id;
                return (
                    <button
                        key={id}
                        ref={node => { buttons.current[index] = node; }}
                        type="button"
                        role="tab"
                        id={`settings-tab-${id}`}
                        aria-controls={`settings-panel-${id}`}
                        aria-selected={isSelected}
                        tabIndex={isSelected ? 0 : -1}
                        onClick={() => onSelect(id)}
                        onKeyDown={event => {
                            const next = event.key === 'Home' ? 0 : event.key === 'End' ? SETTINGS_SECTIONS.length - 1
                                : (narrow ? event.key === 'ArrowRight' : event.key === 'ArrowDown') ? (index + 1) % SETTINGS_SECTIONS.length
                                : (narrow ? event.key === 'ArrowLeft' : event.key === 'ArrowUp') ? (index + SETTINGS_SECTIONS.length - 1) % SETTINGS_SECTIONS.length : null;
                            if (next === null) return;
                            event.preventDefault(); onSelect(SETTINGS_SECTIONS[next].id); buttons.current[next]?.focus();
                        }}
                        className={`settings-tab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-white/30 ${
                            isSelected
                                ? 'text-white dark:text-zinc-950 font-semibold'
                                : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-white/[0.05] hover:text-zinc-950 dark:hover:text-zinc-100'
                        }`}
                    >
                        {isSelected && (
                            <motion.span
                                layoutId="settings-tab-pill"
                                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                                className="absolute inset-0 rounded-[10px] bg-zinc-900 dark:bg-zinc-100 shadow-sm"
                            />
                        )}
                        <Icon className={`relative z-10 h-4 w-4 shrink-0 ${isSelected ? 'text-white dark:text-zinc-950' : 'text-zinc-400 dark:text-zinc-500'}`} aria-hidden="true" />
                        <span className="relative z-10">{t(title)}</span>
                    </button>
                );
            })}
        </div>
    );
}
