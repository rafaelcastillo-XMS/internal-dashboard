import { motion } from "framer-motion"

const MONDAY_LOGO = "https://dapulse-res.cloudinary.com/image/upload/f_auto,q_auto/remote_mondaycom_static/uploads/product/monday-logo.png"

export function Tasks() {
    return (
        <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
            {/* Subtle animated background grid */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
                style={{
                    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 59px, currentColor 59px, currentColor 60px),
                                      repeating-linear-gradient(90deg, transparent, transparent 59px, currentColor 59px, currentColor 60px)`,
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="relative z-10 mx-auto flex max-w-lg flex-col items-center text-center px-6"
            >
                {/* Glow ring */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-gradient-to-br from-[#ff3d57]/10 via-[#ffcb00]/10 to-[#00ca72]/10 blur-3xl pointer-events-none" />

                {/* Monday.com Logo */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    className="mb-8 flex items-center justify-center"
                >
                    <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#ff3d57]/20 via-[#ffcb00]/20 to-[#00ca72]/20 blur-xl" />
                        <div className="relative rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-6 shadow-lg">
                            <img
                                src={MONDAY_LOGO}
                                alt="monday.com logo"
                                className="h-10 w-auto object-contain"
                                onError={(e) => {
                                    const target = e.currentTarget
                                    target.style.display = "none"
                                    const fallback = target.nextElementSibling as HTMLElement
                                    if (fallback) fallback.style.display = "flex"
                                }}
                            />
                            <div className="hidden items-center gap-2 text-2xl font-extrabold" style={{ color: "#ff3d57" }}>
                                <svg width="32" height="32" viewBox="0 0 72 72" fill="none"><rect x="4" y="20" width="12" height="32" rx="6" fill="#ff3d57"/><rect x="24" y="10" width="12" height="42" rx="6" fill="#ffcb00"/><rect x="44" y="25" width="12" height="27" rx="6" fill="#00ca72"/><circle cx="62" cy="52" r="6" fill="#ff3d57"/></svg>
                                monday
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Status badge */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="mb-5"
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                        </span>
                        Integration In Progress
                    </span>
                </motion.div>

                {/* Heading */}
                <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-3 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl"
                >
                    Task Management is Coming Soon
                </motion.h1>

                {/* Description */}
                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="mb-8 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400"
                >
                    We are currently integrating with{" "}
                    <strong className="font-semibold text-slate-700 dark:text-slate-300">monday.com</strong>{" "}
                    to bring you a powerful, real-time task management experience.
                    All your boards, tasks, and workflows will sync directly into this dashboard.
                </motion.p>


            </motion.div>
        </div>
    )
}
