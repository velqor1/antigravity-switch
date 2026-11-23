import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { NavigationDropdown } from './NavDropdowns';
import { isActive, getCurrentNavItem, type NavItem } from './constants';

interface NavMenuProps {
    navItems: NavItem[];
}

const PILL_SPRING = {
    type: 'spring' as const,
    stiffness: 460,
    damping: 34,
    mass: 0.78,
};

const HOVER_SPRING = {
    type: 'spring' as const,
    stiffness: 520,
    damping: 38,
    mass: 0.65,
};

/**
 * 导航菜单组件 - 带弹簧滑动胶囊动效
 */
export function NavMenu({ navItems }: NavMenuProps) {
    const location = useLocation();
    const visibleNavItems = navItems;
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);

    return (
        <>
            {/* 文字胶囊 (≥ 880px) */}
            <nav
                onMouseLeave={() => setHoveredPath(null)}
                onMouseDown={(e) => e.stopPropagation()}
                className="hidden min-[880px]:flex items-center gap-0.5 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] p-1 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    const hovered = hoveredPath === item.path && !active;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            onMouseEnter={() => setHoveredPath(item.path)}
                            className={`relative px-4 xl:px-5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap select-none flex items-center gap-2 transition-colors duration-150 ${
                                active
                                    ? 'text-white dark:text-zinc-950'
                                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                        >
                            {hovered && (
                                <motion.span
                                    layoutId="nav-hover-pill"
                                    transition={HOVER_SPRING}
                                    className="absolute inset-0 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
                                />
                            )}
                            {active && (
                                <motion.span
                                    layoutId="nav-active-pill"
                                    transition={PILL_SPRING}
                                    className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100 shadow-[0_2px_10px_rgba(0,0,0,0.22)] dark:shadow-[0_2px_12px_rgba(255,255,255,0.14)]"
                                />
                            )}
                            <Icon className="relative z-10 w-3.5 h-3.5 shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                            <span className="relative z-10">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* 图标胶囊 (480px - 880px) */}
            <nav
                onMouseLeave={() => setHoveredPath(null)}
                onMouseDown={(e) => e.stopPropagation()}
                className="hidden min-[480px]:flex min-[880px]:hidden items-center gap-0.5 rounded-full bg-zinc-200/75 dark:bg-[#141417] border border-zinc-300/70 dark:border-white/[0.08] p-1"
            >
                {visibleNavItems.map((item) => {
                    const active = isActive(location.pathname, item.path);
                    const hovered = hoveredPath === item.path && !active;
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            draggable="false"
                            onMouseEnter={() => setHoveredPath(item.path)}
                            className={`relative p-2 rounded-full transition-colors duration-150 ${
                                active
                                    ? 'text-white dark:text-zinc-950'
                                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100'
                            }`}
                            title={item.label}
                        >
                            {hovered && (
                                <motion.span
                                    layoutId="nav-hover-pill-compact"
                                    transition={HOVER_SPRING}
                                    className="absolute inset-0 rounded-full bg-black/[0.05] dark:bg-white/[0.06]"
                                />
                            )}
                            {active && (
                                <motion.span
                                    layoutId="nav-active-pill-compact"
                                    transition={PILL_SPRING}
                                    className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-zinc-100 shadow-sm"
                                />
                            )}
                            <Icon className="relative z-10 w-4 h-4" strokeWidth={active ? 2.2 : 1.9} />
                        </Link>
                    );
                })}
            </nav>

            {/* 图标+文字下拉 (375px - 480px) */}
            <div className="max-[374px]:hidden min-[480px]:hidden block" onMouseDown={(e) => e.stopPropagation()}>
                <NavigationDropdown
                    navItems={visibleNavItems}
                    isActive={(path) => isActive(location.pathname, path)}
                    getCurrentNavItem={() => getCurrentNavItem(location.pathname, visibleNavItems)}
                    onNavigate={() => {}}
                    showLabel={true}
                />
            </div>

            {/* 图标下拉 (< 375px) */}
            <div className="min-[375px]:hidden" onMouseDown={(e) => e.stopPropagation()}>
                <NavigationDropdown
                    navItems={visibleNavItems}
                    isActive={(path) => isActive(location.pathname, path)}
                    getCurrentNavItem={() => getCurrentNavItem(location.pathname, visibleNavItems)}
                    onNavigate={() => {}}
                    showLabel={false}
                />
            </div>
        </>
    );
}
