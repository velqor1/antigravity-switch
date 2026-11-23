import { useEffect, useRef, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LayoutDashboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { request } from '../../utils/request';
import { dashboardCardOrder, dashboardCards, type DashboardCardId, type DashboardPreferences } from '../../types/config';

function CardRow({ id, order, selected, disabled, onToggle }: { id: DashboardCardId; order: number; selected: boolean; disabled: boolean; onToggle: () => void }) {
    const { t } = useTranslation();
    const label = t(`dashboard_settings.cards.${id}`);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
    return <div ref={setNodeRef} data-card-option={id} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm transition-colors ${selected ? 'border-zinc-900/25 bg-zinc-100/80 dark:border-white/[0.18] dark:bg-white/[0.06]' : 'border-zinc-200/80 dark:border-white/[0.07] dark:bg-[#18181b]'} ${isDragging ? 'relative z-10 shadow-md' : ''}`}>
        <button type="button" {...attributes} {...listeners} disabled={disabled} aria-label={t('dashboard_settings.reorder', { card: label })} className="shrink-0 touch-none rounded p-1 text-zinc-500 hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-20 dark:hover:bg-white/[0.08]"><GripVertical size={16} /></button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
            <input type="checkbox" disabled={disabled} checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{label}</span>
        </label>
        <span aria-hidden="true" className="w-5 shrink-0 text-right text-xs font-mono tabular-nums text-zinc-400">{selected ? String(order + 1).padStart(2, '0') : '—'}</span>
    </div>;
}

export default function DashboardSettings() {
    const { t } = useTranslation();
    const config = useConfigStore(state => state.config);
    const [pending, setPending] = useState<DashboardPreferences | null>(null);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const returnFocus = useRef<HTMLElement | null>(null);
    const preferences = pending ?? config?.dashboard;
    const selected = dashboardCards(preferences?.cards);
    const ordered = dashboardCardOrder(preferences?.cards, preferences?.order);
    const disabled = pending !== null || !config;
    useEffect(() => {
        if (pending || !returnFocus.current) return;
        const target = returnFocus.current; returnFocus.current = null;
        if (document.activeElement === document.body && target.isConnected) target.focus({ preventScroll: true });
    }, [pending]);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const update = async (cards: DashboardCardId[], order: DashboardCardId[]) => {
        if (lock.current || !config) return;
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        lock.current = true; setPending({ cards, order }); setError('');
        try {
            const next = await request<DashboardPreferences>('set_dashboard_cards', { cards, order });
            useConfigStore.setState(state => ({ config: state.config ? { ...state.config, dashboard: next } : null }));
        } catch (error) {
            setError(t('dashboard_settings.save_failed', { error: String(error) }));
        } finally {
            lock.current = false; setPending(null);
        }
    };
    const label = (id: string | number) => t(`dashboard_settings.cards.${id}`);
    return <section aria-labelledby="dashboard-settings-title" className="surface-card rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-[#111113]">
        <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-white/[0.07] dark:text-zinc-200"><LayoutDashboard className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
                <h3 id="dashboard-settings-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('dashboard_settings.title')}</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{t('dashboard_settings.description')}</p>
            </div>
        </div>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400" role="status">{t(pending !== null ? 'dashboard_settings.saving' : 'dashboard_settings.selected_count', { count: selected.length })}</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ screenReaderInstructions: { draggable: t('dashboard_settings.drag_instructions') }, announcements: {
            onDragStart: ({ active }) => t('dashboard_settings.drag_start', { card: label(active.id) }),
            onDragOver: ({ over }) => over ? t('dashboard_settings.drag_over', { card: label(over.id) }) : '',
            onDragEnd: () => t('dashboard_settings.drag_end'),
            onDragCancel: () => t('dashboard_settings.drag_cancel'),
        } }} onDragEnd={({ active, over }) => {
            if (disabled || !over || active.id === over.id) return;
            const from = ordered.indexOf(active.id as DashboardCardId), to = ordered.indexOf(over.id as DashboardCardId);
            if (from >= 0 && to >= 0) {
                const order = arrayMove(ordered, from, to);
                void update(order.filter(id => selected.includes(id)), order);
            }
        }}>
            <SortableContext items={ordered} strategy={rectSortingStrategy}>
                <div className="grid gap-2 sm:grid-cols-2">{ordered.map(id => <CardRow key={id} id={id} order={selected.indexOf(id)} selected={selected.includes(id)} disabled={disabled} onToggle={() => void update(ordered.filter(card => card === id ? !selected.includes(id) : selected.includes(card)), ordered)} />)}</div>
            </SortableContext>
        </DndContext>
        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
    </section>;
}
