

import {
  Activity,
  Download,
  Calendar,
  Clock,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Sparkles,
  Layers,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { listen } from "@tauri-apps/api/event";
import { request } from "../utils/request";
import { useConfigStore } from "../stores/useConfigStore";
import type { BucketValuation, QuotaValuationResponse } from "../utils/quotaValuation";
import AccountGrid from "../components/accounts/AccountGrid";
import AccountTable from "../components/accounts/AccountTable";
import AddAccountDialog from "../components/accounts/AddAccountDialog";
import QuotaCycleModal from "../components/accounts/QuotaCycleModal";
import ModalDialog from "../components/common/ModalDialog";
import Pagination from "../components/common/Pagination";
import { showToast } from "../components/common/ToastContainer";
import { useAccountStore } from "../stores/useAccountStore";
import { cn } from "../utils/cn";
import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { format } from "date-fns";
import { saveAccountExport, fetchAccountQuota } from "../services/accountService";
import type { Account } from "../types/account";
import { getAccountTier, type AccountTier } from "../utils/accountTier";

type FilterType = "all" | AccountTier;
type ViewMode = "list" | "grid";
export type QuotaWindow = "5h" | "weekly";
export type QuotaDisplayMode = "modern" | "live";


function Accounts() {
  const { t } = useTranslation();
  const { config } = useConfigStore();
  const {
    accounts,
    currentAccount,
    fetchAccounts,
    fetchCurrentAccount,
    addAccount,
    deleteAccounts,
    switchAccount,
    loading,
    refreshQuota,
    reorderAccounts,
    updateAccountLabel,
  } = useAccountStore();
  const [valuationsMap, setValuationsMap] = useState<Record<string, BucketValuation[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('accounts_view_mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'list';
  });

  const [quotaWindow, setQuotaWindow] = useState<QuotaWindow>(() => {
    const saved = localStorage.getItem('accounts_quota_window');
    return (saved === '5h' || saved === 'weekly') ? saved : '5h';
  });

  const [quotaDisplayMode, setQuotaDisplayMode] = useState<QuotaDisplayMode>(() => {
    const saved = localStorage.getItem('accounts_quota_display_mode');
    return (saved === 'modern' || saved === 'live') ? saved : 'modern';
  });

  // Save view mode preference
  useEffect(() => {
    localStorage.setItem('accounts_view_mode', viewMode);
  }, [viewMode]);

  // Save quota window preference
  useEffect(() => {
    localStorage.setItem('accounts_quota_window', quotaWindow);
  }, [quotaWindow]);

  // Save quota display mode preference
  useEffect(() => {
    localStorage.setItem('accounts_quota_display_mode', quotaDisplayMode);
  }, [quotaDisplayMode]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchDelete, setIsBatchDelete] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [accountToEditLabel, setAccountToEditLabel] = useState<Account | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [isSavingLabel, setIsSavingLabel] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [cycleModalAccountId, setCycleModalAccountId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState<number | null>(() => {
    const saved = localStorage.getItem("accounts_page_size");
    return saved ? parseInt(saved) : null;
  }); // 本地分页大小状态

  // Save page size preference
  useEffect(() => {
    if (localPageSize !== null) {
      localStorage.setItem("accounts_page_size", localPageSize.toString());
    }
  }, [localPageSize]);

  // 动态计算分页条数
  const ITEMS_PER_PAGE = useMemo(() => {
    // 优先使用本地设置的分页大小
    if (localPageSize && localPageSize > 0) {
      return localPageSize;
    }

    // 回退到原有的动态计算逻辑
    if (!containerSize.height) return viewMode === "grid" ? 6 : 8;

    const valuationEnabled = config?.quota_valuation?.enabled !== false;

    if (viewMode === "list") {
      const headerHeight = 36; // 缩深后的表头高度
      const rowHeight = valuationEnabled ? 96 : 72; // 包含多行模型与折算信息后的实际行高
      // 计算能容纳多少行, 默认最低 10 行
      const autoFitCount = Math.floor(
        (containerSize.height - headerHeight) / rowHeight,
      );
      return Math.max(10, autoFitCount);
    } else {
      const cardHeight = valuationEnabled ? 220 : 180; // AccountCard 实际高度 (含折算与间距)
      const gap = 16; // gap-4

      // 匹配 Tailwind 断点逻辑
      let cols = 1;
      if (containerSize.width >= 1200)
        cols = 4; // xl (约为 1280 左右)
      else if (containerSize.width >= 900)
        cols = 3; // lg (约为 1024 左右)
      else if (containerSize.width >= 600) cols = 2; // md (约为 768 左右)

      const rows = Math.max(
        1,
        Math.floor((containerSize.height + gap) / (cardHeight + gap)),
      );
      return cols * rows;
    }
  }, [localPageSize, containerSize, viewMode, config?.quota_valuation?.enabled]);

  const fetchValuations = useCallback(async () => {
    try {
      const res = await request<QuotaValuationResponse>('get_account_quota_valuations');
      if (res?.accounts) {
        const map: Record<string, BucketValuation[]> = {};
        for (const item of res.accounts) {
          map[item.account_id] = item.buckets;
        }
        setValuationsMap(map);
      }
    } catch {
      // 容错降级
    }
  }, []);

  useEffect(() => {
    void fetchValuations();
  }, [fetchValuations, accounts, config?.quota_valuation]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('accounts://refreshed', () => {
      void fetchValuations();
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {});
    return () => {
      unlisten?.();
    };
  }, [fetchValuations]);

  useEffect(() => {
    fetchAccounts();
    fetchCurrentAccount();
  }, [fetchAccounts, fetchCurrentAccount]);

  // Reset pagination when view mode changes to avoid empty pages or confusion
  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  // 搜索过滤逻辑
  const searchedAccounts = useMemo(() => {
    if (!searchQuery) return accounts;
    const lowQuery = searchQuery.toLowerCase();
    return accounts.filter((a) => a.email.toLowerCase().includes(lowQuery));
  }, [accounts, searchQuery]);

  // 计算各筛选状态下的数量 (基于搜索结果)
  const filterCounts = useMemo(() => {
    const counts = { all: searchedAccounts.length, pro: 0, ultra: 0, free: 0, unknown: 0 };
    searchedAccounts.forEach(account => { counts[getAccountTier(account)]++; });
    return counts;
  }, [searchedAccounts]);

  // 过滤和搜索最终结果
  const filteredAccounts = useMemo(() => {
    return filter === "all" ? searchedAccounts
      : searchedAccounts.filter(account => getAccountTier(account) === filter);
  }, [searchedAccounts, filter]);

  // Pagination Logic
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAccounts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAccounts, currentPage, ITEMS_PER_PAGE]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 清空选择当过滤改变 并重置分页
  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(1);
  }, [filter, searchQuery]);

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleToggleAll = () => {
    // 全选当前页的所有项
    const currentIds = paginatedAccounts.map((a) => a.id);
    const allSelected = currentIds.every((id) => selectedIds.has(id));

    const newSet = new Set(selectedIds);
    if (allSelected) {
      currentIds.forEach((id) => newSet.delete(id));
    } else {
      currentIds.forEach((id) => newSet.add(id));
    }
    setSelectedIds(newSet);
  };

  const handleAddAccount = async (email: string, refreshToken: string) => {
    await addAccount(email, refreshToken);
  };

  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(
    null,
  );

  const handleSwitch = async (accountId: string) => {
    if (loading || switchingAccountId) return;

    setSwitchingAccountId(accountId);
    try {
      await switchAccount(accountId, 'app');
      showToast(t("common.success"), "success");
    } catch (error) {
      console.error("[Accounts] Switch failed:", error);
      showToast(`${t("common.error")}: ${error}`, "error");
    } finally {
      // Add a small delay for smoother UX
      setTimeout(() => {
        setSwitchingAccountId(null);
      }, 500);
    }
  };

  const handleExport = async (ids: string[]) => {
    try {
      const path = await save({ defaultPath: `antigravity-accounts-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`, filters: [{ name: 'JSON', extensions: ['json'] }], title: t('accounts.export_account') });
      if (!path) return;
      const count = await saveAccountExport(ids, path);
      showToast(t('accounts.export_success', { count }), 'success');
    } catch (error) { showToast(t('accounts.export_failed', { error: String(error) }), 'error'); }
  };

  const handleRefresh = async (accountId: string) => {
    setRefreshingIds((prev) => {
      const next = new Set(prev);
      next.add(accountId);
      return next;
    });
    try {
      await refreshQuota(accountId);
      showToast(t("common.success"), "success");
    } catch (error) {
      showToast(`${t("common.error")}: ${error}`, "error");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setIsBatchDelete(true);
  };

  const handleDelete = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (account) setAccountToDelete(account);
  };

  const handleEditLabel = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    if (!account) return;
    setAccountToEditLabel(account);
    setLabelDraft(account.custom_label || '');
  };

  const cancelEditLabel = () => {
    if (isSavingLabel) return;
    setAccountToEditLabel(null);
    setLabelDraft('');
  };

  const executeUpdateLabel = async () => {
    if (!accountToEditLabel || isSavingLabel) return;
    setIsSavingLabel(true);
    try {
      await updateAccountLabel(accountToEditLabel.id, labelDraft.trim());
      showToast(t('accounts.remark_updated', '备注已更新'), 'success');
      setAccountToEditLabel(null);
      setLabelDraft('');
    } catch (error) {
      console.error('[Accounts] Update remark failed:', error);
      showToast(`${t('common.error')}: ${error}`, 'error');
    } finally {
      setIsSavingLabel(false);
    }
  };

  const executeDelete = async () => {
    if (!accountToDelete) return;
    const accountId = accountToDelete.id;
    setAccountToDelete(null);
    try {
      await deleteAccounts([accountId]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
      showToast(t("common.success"), "success");
    } catch (error) {
      console.error("[Accounts] Delete failed:", error);
      showToast(`${t("common.error")}: ${error}`, "error");
    }
  };

  const executeBatchDelete = async () => {
    setIsBatchDelete(false);
    try {
      const ids = Array.from(selectedIds);
      console.log("[Accounts] Batch deleting:", ids);
      await deleteAccounts(ids);
      setSelectedIds(new Set());
      console.log("[Accounts] Batch delete success");
      showToast(t("common.success"), "success");
    } catch (error) {
      console.error("[Accounts] Batch delete failed:", error);
      showToast(`${t("common.error")}: ${error}`, "error");
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshConfirmOpen, setIsRefreshConfirmOpen] = useState(false);

  const handleRefreshClick = () => {
    setIsRefreshConfirmOpen(true);
  };

  const executeRefresh = async () => {
    setIsRefreshConfirmOpen(false);
    setIsRefreshing(true);
    try {
      const isBatch = selectedIds.size > 0;
      let successCount = 0;
      let failedCount = 0;
      const details: string[] = [];

      if (isBatch) {
        // 批量刷新选中
        const ids = Array.from(selectedIds);
        setRefreshingIds(new Set(ids));

        // 直接调用服务层逐个刷新，整批完成后一次性同步账号列表；
        // 避免每个账号完成都触发一次全量 fetchAccounts。
        const results = await Promise.allSettled(
          ids.map((id) => fetchAccountQuota(id)),
        );
        await fetchAccounts();

        results.forEach((result, index) => {
          const id = ids[index];
          const email = accounts.find((a) => a.id === id)?.email || id;
          if (result.status === "fulfilled") {
            successCount++;
          } else {
            failedCount++;
            details.push(`${email}: ${result.reason}`);
          }
        });
      } else {
        // 刷新所有
        setRefreshingIds(new Set(accounts.map((a) => a.id)));
        const stats = await useAccountStore.getState().refreshAllQuotas();
        if (stats) {
          successCount = stats.success;
          failedCount = stats.failed;
          details.push(...stats.details);
        }
      }

      if (failedCount === 0) {
        showToast(
          t("accounts.refresh_selected", { count: successCount }),
          "success",
        );
      } else {
        showToast(
          `${t("common.success")}: ${successCount}, ${t("common.error")}: ${failedCount}`,
          "warning",
        );
        // You might want to show details in a different way, but for toast, keep it simple or use a "view details" action if supported.
        // For now, simpler toast is better than a huge alert.
        if (details.length > 0) {
          console.warn("Refresh failures:", details);
        }
      }
    } catch (error) {
      showToast(`${t("common.error")}: ${error}`, "error");
    } finally {
      setIsRefreshing(false);
      setRefreshingIds(new Set());
    }
  };

  const readyAccountsCount = useMemo(
    () => accounts.filter(a => !a.disabled && !a.validation_blocked && !a.quota?.is_forbidden).length,
    [accounts],
  );

  return (
    <div className="h-full flex flex-col p-4 lg:p-5 gap-3 max-w-7xl mx-auto w-full">
      {/* Compact Account Telemetry Strip */}
      <div className="flex-none flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-[#111113] border border-zinc-200/80 dark:border-white/[0.08] surface-card">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 dark:text-zinc-400">{t('accounts.summary_total', 'Accounts')}</span>
            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{accounts.length}</span>
          </div>
          <span className="h-3.5 w-px bg-zinc-200 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-500 dark:text-zinc-400">{t('accounts.summary_ready', 'Ready')}</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{readyAccountsCount}</span>
          </div>
          <span className="h-3.5 w-px bg-zinc-200 dark:bg-white/10" />
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-zinc-500 dark:text-zinc-400">{t('accounts.summary_active', 'Current')}:</span>
            <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[260px]">
              {currentAccount?.email || t('accounts.summary_none', 'None selected')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 bg-zinc-200/70 dark:bg-[#18181b] p-0.5 rounded-xl border border-zinc-300/60 dark:border-white/[0.07]">
          {([
            { id: 'modern' as const, icon: Sparkles, label: t('accounts.mode_modern', 'Modern (G4 / C5.5)'), title: t('accounts.mode_modern_hint', 'Show pinned modern Antigravity 2.0 models') },
            { id: 'live' as const, icon: Layers, label: t('accounts.mode_live', 'All Live'), title: t('accounts.mode_live_hint', 'Show all active models reported on each account') },
          ]).map((mode) => {
            const active = quotaDisplayMode === mode.id;
            const ModeIcon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setQuotaDisplayMode(mode.id)}
                title={mode.title}
                className={cn(
                  "relative px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1.5",
                  active
                    ? "text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="accounts-mode-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                  />
                )}
                <ModeIcon className="relative z-10 w-3 h-3" />
                <span className="relative z-10">{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 顶部工具栏:搜索、过滤和操作按钮 */}
      <div className="flex-none flex flex-wrap items-center gap-2">
        {/* 搜索框 */}
        <div className="hidden lg:block flex-none w-48 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder={t('accounts.search_placeholder')}
            className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-[#111113] text-sm text-zinc-900 dark:text-zinc-100 border border-zinc-200/80 dark:border-white/[0.08] rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-white/20 focus:border-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500 transition-shadow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 搜索按钮 - 小屏显示 */}
        <div className="lg:hidden relative">
          {!isSearchExpanded ? (
            <button
              type="button"
              onClick={() => {
                setIsSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              className="p-2 bg-zinc-200/70 dark:bg-[#141417] border border-zinc-300/60 dark:border-white/[0.08] hover:bg-white dark:hover:bg-[#1e1e23] rounded-xl transition-colors"
              title={t('accounts.search_placeholder')}
            >
              <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </button>
          ) : (
            <div className="absolute left-0 top-0 z-10 w-64 flex items-center gap-1">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t('accounts.search_placeholder')}
                  className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-[#141417] text-sm text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-white/[0.12] rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-white/20 placeholder:text-zinc-400 shadow-xl"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => setIsSearchExpanded(false)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 配额周期切换 (5H / 7天周配额) */}
        <div className="flex gap-0.5 bg-zinc-200/70 dark:bg-[#141417] border border-zinc-300/60 dark:border-white/[0.07] p-1 rounded-xl shrink-0 items-center">
          {([
            { id: '5h' as const, icon: Clock, label: '5H', title: t('accounts.quota_window_5h', '5ч скользящее окно') },
            { id: 'weekly' as const, icon: Calendar, label: t('accounts.quota_window_weekly_short', 'Неделя'), title: t('accounts.quota_window_weekly', '7-дневная квота') },
          ]).map((w) => {
            const active = quotaWindow === w.id;
            const WIcon = w.icon;
            return (
              <button
                key={w.id}
                type="button"
                className={cn(
                  "relative px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1",
                  active
                    ? "text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
                )}
                onClick={() => setQuotaWindow(w.id)}
                title={w.title}
              >
                {active && (
                  <motion.span
                    layoutId="accounts-window-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                  />
                )}
                <WIcon className="relative z-10 w-3.5 h-3.5" />
                <span className="relative z-10">{w.label}</span>
              </button>
            );
          })}
        </div>

        {/* 视图切换按钮组 */}
        <div className="flex gap-0.5 bg-zinc-200/70 dark:bg-[#141417] border border-zinc-300/60 dark:border-white/[0.07] p-1 rounded-xl shrink-0">
          {([
            { id: 'list' as const, icon: List, title: t('accounts.views.list') },
            { id: 'grid' as const, icon: LayoutGrid, title: t('accounts.views.grid') },
          ]).map((v) => {
            const active = viewMode === v.id;
            const VIcon = v.icon;
            return (
              <button
                key={v.id}
                type="button"
                className={cn(
                  "relative p-1.5 rounded-lg transition-colors",
                  active
                    ? "text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
                )}
                onClick={() => setViewMode(v.id)}
                title={v.title}
              >
                {active && (
                  <motion.span
                    layoutId="accounts-view-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                  />
                )}
                <VIcon className="relative z-10 w-4 h-4" />
              </button>
            );
          })}
        </div>

        {/* 过滤按钮组 */}
        <div className="flex gap-0.5 bg-zinc-200/70 dark:bg-[#141417] p-1 rounded-xl border border-zinc-300/60 dark:border-white/[0.07] shrink-0">
          {([
            { id: 'all' as const, label: t('accounts.all'), count: filterCounts.all, visible: true },
            { id: 'pro' as const, label: t('accounts.pro'), count: filterCounts.pro, visible: true },
            { id: 'ultra' as const, label: t('accounts.ultra'), count: filterCounts.ultra, visible: true },
            { id: 'free' as const, label: t('accounts.free'), count: filterCounts.free, visible: true },
            { id: 'unknown' as const, label: t('accounts.unknown'), count: filterCounts.unknown, visible: filterCounts.unknown > 0 || filter === 'unknown' },
          ]).filter(f => f.visible).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "relative px-2 md:px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 md:gap-1.5 whitespace-nowrap shrink-0",
                  active
                    ? "text-white dark:text-zinc-950"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                )}
                onClick={() => setFilter(item.id)}
                title={`${item.label} (${item.count})`}
              >
                {active && (
                  <motion.span
                    layoutId="accounts-filter-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                    className="absolute inset-0 rounded-lg bg-zinc-900 dark:bg-zinc-100 shadow-xs"
                  />
                )}
                <span className="relative z-10 hidden md:inline">{item.label}</span>
                <span className={cn(
                  "relative z-10 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors",
                  active
                    ? "bg-white/15 dark:bg-black/15 text-white dark:text-zinc-950"
                    : "bg-zinc-300/60 dark:bg-white/[0.08] text-zinc-600 dark:text-zinc-400"
                )}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-w-[8px]"></div>

        {/* 操作按钮组 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <AddAccountDialog onAdd={handleAddAccount} showText={false} />

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="px-2.5 py-2 bg-white dark:bg-[#141417] text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/[0.09] text-xs font-semibold rounded-xl hover:bg-zinc-100 dark:hover:bg-[#1d1d22] transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0"
            onClick={() => {
              setCycleModalAccountId(undefined);
              setIsCycleModalOpen(true);
            }}
            title={t("accounts.cycle_history_title", "История циклов квот")}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {t("accounts.cycle_history_btn", "Циклы")}
            </span>
          </motion.button>

          {selectedIds.size > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              className="px-2.5 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
              onClick={handleBatchDelete}
              title={t("accounts.delete_selected", {
                count: selectedIds.size,
              })}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">
                {t("accounts.delete_selected", { count: selectedIds.size })}
              </span>
            </motion.button>
          )}

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl hover:bg-zinc-800 dark:hover:bg-white transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 ${isRefreshing ? "opacity-70 cursor-not-allowed" : ""}`}
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            title={
              selectedIds.size > 0
                ? t("accounts.refresh_selected", { count: selectedIds.size })
                : t("accounts.refresh_all")
            }
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden xl:inline">
              {isRefreshing
                ? t("common.loading")
                : selectedIds.size > 0
                  ? t("accounts.refresh_selected", { count: selectedIds.size })
                  : t("accounts.refresh_all")}
            </span>
          </motion.button>

          {selectedIds.size > 0 && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
              className="px-2.5 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
              onClick={() => handleExport([...selectedIds])}
              aria-label={t('accounts.export_selected', { count: selectedIds.size })}
              title={t('accounts.export_selected', { count: selectedIds.size })}
            >
              <Download className="w-3.5 h-3.5" />
            </motion.button>
          )}

        </div>
      </div>

      {/* 账号列表内容区域 */}
      <div className="flex-1 min-h-0 relative" ref={containerRef}>
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === "list" ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="surface-card h-full bg-white dark:bg-[#111113] rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] flex flex-col overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto">
                <AccountTable
                  accounts={paginatedAccounts}
                  selectedIds={selectedIds}
                  refreshingIds={refreshingIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleAll={handleToggleAll}
                  currentAccountId={currentAccount?.id || null}
                  switchingAccountId={switchingAccountId}
                  onSwitch={handleSwitch}
                  onRefresh={handleRefresh}
                  onEditLabel={handleEditLabel}
                  onDelete={handleDelete}
                  onExport={id => handleExport([id])}
                  onViewCycleHistory={id => {
                    setCycleModalAccountId(id);
                    setIsCycleModalOpen(true);
                  }}
                  onReorder={reorderAccounts}
                  quotaWindow={quotaWindow}
                  quotaDisplayMode={quotaDisplayMode}
                  valuationsMap={valuationsMap}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="grid-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="h-full overflow-y-auto"
            >
              <AccountGrid
                accounts={paginatedAccounts}
                selectedIds={selectedIds}
                refreshingIds={refreshingIds}
                onToggleSelect={handleToggleSelect}
                currentAccountId={currentAccount?.id || null}
                switchingAccountId={switchingAccountId}
                onSwitch={handleSwitch}
                onRefresh={handleRefresh}
                onEditLabel={handleEditLabel}
                onDelete={handleDelete}
                onExport={id => handleExport([id])}
                onViewCycleHistory={id => {
                  setCycleModalAccountId(id);
                  setIsCycleModalOpen(true);
                }}
                onReorder={reorderAccounts}
                quotaWindow={quotaWindow}
                quotaDisplayMode={quotaDisplayMode}
                valuationsMap={valuationsMap}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 极简分页 - 无边框浮动样式 */}
      {filteredAccounts.length > 0 && (
        <div className="flex-none">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE)}
            onPageChange={handlePageChange}
            totalItems={filteredAccounts.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageSizeChange={(newSize) => {
              setLocalPageSize(newSize);
              setCurrentPage(1); // 重置到第一页
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      )}

      <ModalDialog
        isOpen={isBatchDelete}
        title={t("accounts.dialog.batch_delete_title")}
        message={t("accounts.dialog.batch_delete_msg", { count: selectedIds.size })}
        type="confirm"
        confirmText={t("common.delete")}
        isDestructive={true}
        onConfirm={executeBatchDelete}
        onCancel={() => setIsBatchDelete(false)}
      />

      <ModalDialog
        isOpen={accountToDelete !== null}
        title={t("accounts.dialog.delete_title")}
        message={accountToDelete
          ? `${t("accounts.dialog.delete_msg")}\n\n${accountToDelete.email}`
          : undefined}
        type="confirm"
        confirmText={t("common.delete")}
        isDestructive={true}
        onConfirm={executeDelete}
        onCancel={() => setAccountToDelete(null)}
      />

      <ModalDialog
        isOpen={isRefreshConfirmOpen}
        title={
          selectedIds.size > 0
            ? t("accounts.dialog.batch_refresh_title")
            : t("accounts.dialog.refresh_title")
        }
        message={
          selectedIds.size > 0
            ? t("accounts.dialog.batch_refresh_msg", {
              count: selectedIds.size,
            })
            : t("accounts.dialog.refresh_msg")
        }
        type="confirm"
        confirmText={t("common.refresh")}
        isDestructive={false}
        onConfirm={executeRefresh}
        onCancel={() => setIsRefreshConfirmOpen(false)}
      />

      <ModalDialog
        isOpen={accountToEditLabel !== null}
        title={t('accounts.edit_remark', 'Изменить заметку')}
        type="confirm"
        confirmText={isSavingLabel ? t('common.loading') : t('common.save')}
        onConfirm={executeUpdateLabel}
        onCancel={cancelEditLabel}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('accounts.remark', 'Заметка')}
          </label>
          <input
            autoFocus
            type="text"
            maxLength={15}
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void executeUpdateLabel();
              }
            }}
            placeholder={t('accounts.remark_placeholder', 'Введите заметку (до 15 символов)')}
            className="w-full px-3 py-2.5 bg-white dark:bg-[#18181b] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-white/[0.1] rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-400/50 dark:focus:ring-white/20"
          />
          <div className="text-right text-xs text-zinc-400 dark:text-zinc-500">
            {Array.from(labelDraft).length}/15
          </div>
        </div>
      </ModalDialog>

      <QuotaCycleModal
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        initialAccountId={cycleModalAccountId}
      />

    </div>
  );
}

export default Accounts;
