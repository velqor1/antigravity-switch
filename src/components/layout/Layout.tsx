import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Navbar from '../navbar/Navbar';
import { AutoSwitchStatusBar } from '../autoSwitch/AutoSwitch';
import ToastContainer from '../common/ToastContainer';

function Layout() {
    const location = useLocation();
    const outlet = useOutlet();

    return (
        <div className="h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 antialiased ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08] overflow-hidden">
            <ToastContainer />
            <Navbar />
            <AutoSwitchStatusBar />
            <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8, scale: 0.994 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -5, scale: 0.996 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-1 min-h-0 flex flex-col overflow-hidden"
                    >
                        {outlet}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}

export default Layout;
