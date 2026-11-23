import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Account } from '../../types/account';
import type { BucketValuation } from '../../utils/quotaValuation';
import AccountCard from './AccountCard';

interface AccountGridProps {
    accounts: Account[];
    selectedIds: Set<string>;
    refreshingIds: Set<string>;
    onToggleSelect: (id: string) => void;
    currentAccountId: string | null;
    switchingAccountId: string | null;
    onSwitch: (accountId: string, targetIde?: string) => void;
    onRefresh: (accountId: string) => void;
    onEditLabel: (accountId: string) => void;
    onDelete: (accountId: string) => void;
    onExport?: (accountId: string) => void;
    onViewCycleHistory?: (accountId: string) => void;
    onReorder?: (accountIds: string[]) => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuationsMap?: Record<string, BucketValuation[]>;
}

interface SortableAccountCardProps {
    account: Account;
    index: number;
    selected: boolean;
    isRefreshing: boolean;
    isCurrent: boolean;
    isSwitching: boolean;
    onSelect: () => void;
    onSwitch: (targetIde?: string) => void;
    onRefresh: () => void;
    onEditLabel: () => void;
    onDelete: () => void;
    onExport?: () => void;
    onViewCycleHistory?: () => void;
    quotaWindow?: '5h' | 'weekly';
    quotaDisplayMode?: 'modern' | 'live';
    valuations?: BucketValuation[];
}

function SortableAccountCard({
    account,
    index,
    selected,
    isRefreshing,
    isCurrent,
    isSwitching,
    onSelect,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    quotaWindow,
    quotaDisplayMode,
    valuations,
}: SortableAccountCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: account.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style as React.CSSProperties} className="h-full flex flex-col">
            <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.26, delay: Math.min(index * 0.035, 0.24), ease: [0.22, 1, 0.36, 1] }}
                className="h-full flex flex-col"
            >
                <AccountCard
                    account={account}
                    selected={selected}
                    isRefreshing={isRefreshing}
                    isCurrent={isCurrent}
                    isSwitching={isSwitching}
                    onSelect={onSelect}
                    onSwitch={onSwitch}
                    onRefresh={onRefresh}
                    onEditLabel={onEditLabel}
                    onDelete={onDelete}
                    onExport={onExport}
                    onViewCycleHistory={onViewCycleHistory}
                    quotaWindow={quotaWindow}
                    quotaDisplayMode={quotaDisplayMode}
                    valuations={valuations}
                    dragHandleProps={{ attributes, listeners }}
                    isDragging={isDragging}
                />
            </motion.div>
        </div>
    );
}

function AccountGrid({
    accounts,
    selectedIds,
    refreshingIds,
    onToggleSelect,
    currentAccountId,
    switchingAccountId,
    onSwitch,
    onRefresh,
    onEditLabel,
    onDelete,
    onExport,
    onViewCycleHistory,
    onReorder,
    quotaWindow,
    quotaDisplayMode,
    valuationsMap,
}: AccountGridProps) {
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const accountIds = useMemo(() => accounts.map(a => a.id), [accounts]);
    const activeAccount = useMemo(() => accounts.find(a => a.id === activeId), [accounts, activeId]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = accountIds.indexOf(active.id as string);
            const newIndex = accountIds.indexOf(over.id as string);

            if (oldIndex !== -1 && newIndex !== -1 && onReorder) {
                onReorder(arrayMove(accountIds, oldIndex, newIndex));
            }
        }
    };

    if (accounts.length === 0) {
        return (
            <div className="bg-white dark:bg-[#111113] rounded-2xl p-12 surface-card border border-zinc-200/80 dark:border-white/[0.07] text-center">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1">{t('accounts.empty.title')}</p>
                <p className="text-sm text-zinc-400 dark:text-zinc-500">{t('accounts.empty.desc')}</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={accountIds} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr items-stretch">
                    {accounts.map((account, index) => (
                        <SortableAccountCard
                            key={account.id}
                            account={account}
                            index={index}
                            selected={selectedIds.has(account.id)}
                            isRefreshing={refreshingIds.has(account.id)}
                            isCurrent={account.id === currentAccountId}
                            isSwitching={account.id === switchingAccountId}
                            onSelect={() => onToggleSelect(account.id)}
                            onSwitch={(targetIde?: string) => onSwitch(account.id, targetIde)}
                            onRefresh={() => onRefresh(account.id)}
                            onEditLabel={() => onEditLabel(account.id)}
                            onDelete={() => onDelete(account.id)}
                            onExport={() => onExport?.(account.id)}
                            onViewCycleHistory={() => onViewCycleHistory?.(account.id)}
                            quotaWindow={quotaWindow}
                            quotaDisplayMode={quotaDisplayMode}
                            valuations={valuationsMap?.[account.id]}
                        />
                    ))}
                </div>
            </SortableContext>

            {/* 拖拽悬浮预览 */}
            <DragOverlay>
                {activeAccount ? (
                    <div className="w-[320px] shadow-2xl rounded-xl opacity-90 rotate-1 pointer-events-none">
                        <AccountCard
                            account={activeAccount}
                            selected={selectedIds.has(activeAccount.id)}
                            isRefreshing={refreshingIds.has(activeAccount.id)}
                            isCurrent={activeAccount.id === currentAccountId}
                            isSwitching={activeAccount.id === switchingAccountId}
                            onSelect={() => {}}
                            onSwitch={() => {}}
                            onRefresh={() => {}}
                            onEditLabel={() => {}}
                            onDelete={() => {}}
                            quotaWindow={quotaWindow}
                            quotaDisplayMode={quotaDisplayMode}
                            valuations={valuationsMap?.[activeAccount.id]}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

export default AccountGrid;
