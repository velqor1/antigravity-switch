import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/account';

function CandidateRow({ account, checked, current, disabled, onToggle }: { account: Account; checked: boolean; current: boolean; disabled: boolean; onToggle: () => void }) {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id, disabled: disabled || !checked });
    return <div ref={setNodeRef} data-candidate-id={account.id} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-3 rounded-xl border border-zinc-200/80 p-3 text-sm dark:border-white/[0.08] dark:bg-[#18181b] ${isDragging ? 'relative z-10 bg-zinc-100 shadow-lg dark:bg-[#222228]' : ''}`}>
        <button type="button" {...attributes} {...listeners} disabled={disabled || !checked} aria-label={t('auto_switch.reorder', { email: account.email })} className="touch-none rounded p-1 text-zinc-500 hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-20 dark:hover:bg-white/[0.08]"><GripVertical size={16} /></button>
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input type="checkbox" disabled={disabled} checked={checked} onChange={onToggle} className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100" />
            <span className="min-w-0 break-all text-xs font-medium text-zinc-700 dark:text-zinc-200">{account.email}</span>
        </label>
        {current && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('auto_switch.current')}</span>}
    </div>;
}

export function CandidateAccounts({ accounts, selected, currentId, disabled, onChange }: { accounts: Account[]; selected: string[]; currentId: string | null; disabled: boolean; onChange: (ids: string[]) => void }) {
    const { t } = useTranslation();
    const email = (id: string | number) => accounts.find(account => account.id === String(id))?.email || '';
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const selectedAccounts = selected.flatMap(id => accounts.find(account => account.id === id) || []);
    const ordered = [...selectedAccounts, ...accounts.filter(account => !selected.includes(account.id))];
    return <DndContext accessibility={{ screenReaderInstructions: { draggable: t('auto_switch.drag_instructions') }, announcements: {
        onDragStart: ({ active }) => t('auto_switch.drag_start', { email: email(active.id) }),
        onDragOver: ({ over }) => over ? t('auto_switch.drag_over', { email: email(over.id) }) : '',
        onDragEnd: () => t('auto_switch.drag_end'),
        onDragCancel: () => t('auto_switch.drag_cancel'),
    } }} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
        if (disabled || !over || active.id === over.id) return;
        const from = selected.indexOf(String(active.id)), to = selected.indexOf(String(over.id));
        if (from >= 0 && to >= 0) onChange(arrayMove(selected, from, to));
    }}>
        <SortableContext items={selectedAccounts.map(account => account.id)} strategy={verticalListSortingStrategy}>
            <div className="grid max-h-72 gap-2 overflow-y-auto">{ordered.map(account => <CandidateRow key={account.id} account={account} checked={selected.includes(account.id)} current={currentId === account.id} disabled={disabled} onToggle={() => onChange(selected.includes(account.id) ? selected.filter(id => id !== account.id) : [...selected, account.id])} />)}</div>
        </SortableContext>
    </DndContext>;
}
