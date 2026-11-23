import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import LogoIcon from '../../assets/logo.png';

export function NavLogo() {
    const { t } = useTranslation();

    return (
        <Link
            to="/"
            draggable="false"
            onMouseDown={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 text-[14.5px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100 group select-none"
        >
            <motion.img
                src={LogoIcon}
                alt="agy-switch"
                whileHover={{ scale: 1.07, rotate: -4 }}
                whileTap={{ scale: 0.93 }}
                transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                className="w-7 h-7 rounded-xl cursor-pointer shrink-0 shadow-sm ring-1 ring-black/10 dark:ring-white/[0.12]"
                draggable="false"
                onError={(e) => {
                    e.currentTarget.src = '/logo.png';
                }}
            />
            <span className="text-nowrap group-hover:text-zinc-950 dark:group-hover:text-white transition-colors">
                {t('common.app_name', 'AntiGravity Switch')}
            </span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-zinc-200/80 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-300 border border-zinc-300/80 dark:border-white/[0.1]">
                2.0
            </span>
        </Link>
    );
}
