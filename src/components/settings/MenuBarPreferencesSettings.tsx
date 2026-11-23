import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores/useConfigStore';
import { request } from '../../utils/request';
import { isTauri } from '../../utils/env';
import { DEFAULT_MENU_BAR_PREFERENCES, menuBarResetTimeDisplay, type MenuBarPreferences, type MenuBarQuotaScope, type MenuBarResetTimeDisplay } from '../../types/config';
export default function MenuBarPreferencesSettings() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ru') ? 'ru' : 'en';
  const pick = <T,>(zh: T, ru: T, en: T): T => lang === 'zh' ? zh : lang === 'ru' ? ru : en;
  const { config, loadConfig } = useConfigStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Partial<MenuBarPreferences>>({});
  const lock = useRef(false);
  const preferences = { ...DEFAULT_MENU_BAR_PREFERENCES, ...config?.menu_bar, ...pending };
  const disabled = busy || !config || !isTauri();
  const update = async (patch: Partial<MenuBarPreferences>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setPending(patch); setError('');
    try {
      const next = await request<MenuBarPreferences>('set_menu_bar_preferences', { patch });
      useConfigStore.setState(state => ({ config: state.config ? { ...state.config, menu_bar: next } : null }));
      await loadConfig();
    } catch { setError(pick('保存失败，请检查选项后重试', 'Не удалось сохранить. Проверьте параметры.', 'Could not save. Check these options and retry.')); }
    finally { lock.current = false; setPending({}); setBusy(false); }
  };
  const selectStyle = 'min-h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/[0.1] dark:bg-[#18181b] dark:text-zinc-100';
  const toggle = (key: 'hide_unavailable' | 'show_aggregate' | 'show_session' | 'show_weekly' | 'show_icons', text: string) => <label className="flex min-h-11 items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-sm leading-5 text-zinc-700 border border-zinc-200/70 dark:border-white/[0.06] dark:bg-[#18181b] dark:text-zinc-300"><input type="checkbox" className="h-4 w-4 shrink-0 accent-zinc-900 dark:accent-zinc-100" checked={preferences[key]} disabled={disabled || (key === 'show_session' && !preferences.show_weekly) || (key === 'show_weekly' && !preferences.show_session)} onChange={event => void update({ [key]: event.target.checked })} />{text}</label>;
  return <div className="mt-5 space-y-5 border-t border-zinc-200/70 pt-5 dark:border-white/[0.07]" role="region" aria-labelledby="menu-bar-settings-title">
    <h3 id="menu-bar-settings-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{pick('菜单栏显示', 'Панель в системном трее', 'Menu bar display')}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <label htmlFor="menu-bar-scope" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{pick('菜单栏聚合额度', 'Сводная квота в трее', 'Menu bar aggregate quotas')}</label>
        <select id="menu-bar-scope" value={preferences.quota_scope} disabled={disabled} onChange={event => void update({ quota_scope: event.target.value as MenuBarQuotaScope })} className={selectStyle}><option value="all">{pick('Gemini 与 Claude/GPT', 'Gemini и Claude / GPT', 'Gemini / Claude & GPT')}</option><option value="gemini">{pick('Gemini 系列', 'Серия Gemini', 'Gemini')}</option><option value="other">{pick('Claude 和 GPT 系列', 'Claude и GPT', 'Claude & GPT')}</option></select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="menu-bar-display" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{pick('账号区显示系列', 'Семейство в списке аккаунтов', 'Account quota family')}</label>
        <select id="menu-bar-display" className={selectStyle} value={preferences.display_scope} disabled={disabled} onChange={event => void update({ display_scope: event.target.value as MenuBarQuotaScope })}><option value="gemini">{pick('Gemini 系列', 'Серия Gemini', 'Gemini')}</option><option value="other">{pick('Claude 和 GPT 系列', 'Claude и GPT', 'Claude & GPT')}</option><option value="all">{pick('Gemini 与 Claude/GPT', 'Gemini и Claude / GPT', 'Gemini / Claude & GPT')}</option></select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="menu-bar-label" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{pick('账号名称格式', 'Формат имени аккаунта', 'Account name format')}</label>
        <select id="menu-bar-label" className={selectStyle} value={preferences.label_style} disabled={disabled} onChange={event => void update({ label_style: event.target.value as MenuBarPreferences['label_style'] })}><option value="email_then_label">{pick('邮箱优先', 'Сначала email', 'Email first')}</option><option value="label_then_email">{pick('备注优先', 'Сначала заметка', 'Note first')}</option><option value="email_only">{pick('仅邮箱', 'Только email', 'Email only')}</option></select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="menu-bar-reset-time" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{pick('重置时间显示', 'Таймер сброса', 'Reset time display')}</label>
        <select id="menu-bar-reset-time" className={selectStyle} value={menuBarResetTimeDisplay(preferences)} disabled={disabled} onChange={event => void update({ reset_time_display: event.target.value as MenuBarResetTimeDisplay })}><option value="hover">{pick('悬浮显示', 'При наведении', 'On hover')}</option><option value="always">{pick('始终显示', 'Всегда', 'Always')}</option><option value="hidden">{pick('不显示', 'Скрыть', 'Hidden')}</option></select>
      </div>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">{toggle('show_aggregate', pick('显示整体额度', 'Показывать сводную квоту', 'Show aggregate quotas'))}{toggle('hide_unavailable', pick('隐藏失效和禁用账号', 'Скрывать отключённые аккаунты', 'Hide invalid and disabled accounts'))}{toggle('show_session', pick('显示 5 小时额度', 'Показывать 5-часовую квоту', 'Show 5-hour quota'))}{toggle('show_weekly', pick('显示周额度', 'Показывать недельную квоту', 'Show weekly quota'))}{toggle('show_icons', pick('显示应用和模型图标', 'Показывать иконки', 'Show app and model icons'))}</div>
    <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-white/[0.07] dark:bg-[#18181b]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">{pick('绿色：高于', 'Зелёный: выше', 'Green: above')} <input aria-label={pick('绿色额度阈值', 'Порог зелёного', 'Green quota threshold')} type="number" min={preferences.red_below + 1} max={100} defaultValue={preferences.green_above} key={'green' + preferences.green_above} disabled={disabled} className="h-10 w-20 rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-white/[0.1] dark:bg-[#111113]" onBlur={event => { const value = Number(event.target.value); if (value !== preferences.green_above && Number.isInteger(value) && value > preferences.red_below && value <= 100) void update({ green_above: value }); else event.target.value = String(preferences.green_above); }} /> %</label>
        <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">{pick('红色：低于', 'Красный: ниже', 'Red: below')} <input aria-label={pick('红色额度阈值', 'Порог красного', 'Red quota threshold')} type="number" min={0} max={preferences.green_above - 1} defaultValue={preferences.red_below} key={'red' + preferences.red_below} disabled={disabled} className="h-10 w-20 rounded-lg border border-zinc-200 bg-white px-2 text-sm dark:border-white/[0.1] dark:bg-[#111113]" onBlur={event => { const value = Number(event.target.value); if (value !== preferences.red_below && Number.isInteger(value) && value >= 0 && value < preferences.green_above) void update({ red_below: value }); else event.target.value = String(preferences.red_below); }} /> %</label>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{pick('两个阈值之间为黄色，包含边界值。', 'Значения между порогами подсвечиваются жёлтым.', 'Values between the thresholds are yellow, including boundaries.')}</p>
    </div>
    <div className="space-y-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
      <p>{pick('聚合额度为有效账号剩余比例的平均值，分别统计 5 小时与周窗口；缺失或过期数据不参与计算。', 'Сводная квота — среднее значение остатка по валидным аккаунтам для 5-часового и недельного окон.', 'Aggregate quotas are mean remaining percentages across valid accounts, calculated separately for 5-hour and weekly windows. Missing or stale data is excluded.')}</p>
      <p>{pick('可用账号指剩余额度高于切换保留阈值的账号，登录状态在切换时验证。至少保留一个额度窗口；显示设置自动保存，重新打开菜单后生效。', 'Оставьте хотя бы одно окно квот; изменения сохраняются автоматически.', 'Available accounts have quota above the switch reserve; sign-in is verified during switching. Keep at least one quota window. Display settings save automatically and apply when reopening the menu.')}</p>
    </div>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
