import { useState } from "react"
import { motion } from "framer-motion"
import {
    Camera, Mail, Phone, MapPin, Building, Link,
    Twitter, Linkedin, Instagram, CheckSquare, Clock, Users, Star
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClients } from "@/features/clients/repository"
import { useProfile } from "@/features/profile/useProfile"
import { useMondayTasks, statusColor } from "@/features/tasks/useMondayTasks"

const tabs = ["Overview", "Edit Profile"] as const
type Tab = typeof tabs[number]

export function Profile() {
    const clients = getClients()
    const [activeTab, setActiveTab] = useState<Tab>("Overview")
    const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const { profile, loading, saving, save, setProfile } = useProfile()
    const { tasks, loading: loadingTasks } = useMondayTasks()

    const doneTasks = tasks.filter(t => t.statusIndex === 1)
    const inProgressTasks = tasks.filter(t => t.statusIndex !== 1)

    const stats = [
        { label: "Tasks Done", value: loadingTasks ? "…" : doneTasks.length, icon: CheckSquare, color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
        { label: "In Progress", value: loadingTasks ? "…" : inProgressTasks.length, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
        { label: "Clients", value: clients.filter(c => c.status === "active").length, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
        { label: "Performance", value: "94%", icon: Star, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
    ]

    const handleChange = (field: keyof ProfileData, value: string) => {
        setProfile(prev => prev ? { ...prev, [field]: value } : prev)
    }

    const handleSave = async () => {
        if (!profile) return
        const result = await save({
            first_name: profile.first_name,
            last_name: profile.last_name,
            phone: profile.phone,
            role: profile.role,
            company: profile.company,
            location: profile.location,
            bio: profile.bio,
            website: profile.website,
            twitter: profile.twitter,
            linkedin: profile.linkedin,
            instagram: profile.instagram,
        })
        setSaveMsg({ ok: result.ok, text: result.message })
        setTimeout(() => setSaveMsg(null), 3000)
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        )
    }

    if (!profile) return null

    const initials = (profile.first_name[0] ?? "") + (profile.last_name[0] ?? "")
    const fullName = `${profile.first_name} ${profile.last_name}`.trim()

    return (
        <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 custom-scrollbar">
            <div className="mx-auto max-w-screen-2xl p-6 space-y-6">

                {/* Cover + Avatar */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm"
                >
                    <div className="px-6 py-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="relative">
                                <Avatar className="w-24 h-24 ring-4 ring-white dark:ring-slate-800 shadow-lg">
                                    <AvatarImage src={profile.avatar_url} referrerPolicy="no-referrer" />
                                    <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors">
                                    <Camera className="w-3.5 h-3.5 text-white" />
                                </button>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="dark:border-slate-600 dark:text-slate-300"
                                onClick={() => setActiveTab("Edit Profile")}
                            >
                                Edit Profile
                            </Button>
                        </div>

                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{fullName || "—"}</h1>
                                <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mt-0.5">{profile.role || "—"}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{profile.company || "—"}</p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                                    {profile.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>}
                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{profile.email}</span>
                                    {profile.website && <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" />{profile.website}</span>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {profile.twitter && (
                                    <a href={`https://twitter.com/${profile.twitter.replace("@", "")}`} target="_blank" rel="noreferrer"
                                        className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all">
                                        <Twitter className="w-4 h-4" />
                                    </a>
                                )}
                                {profile.linkedin && (
                                    <a href={`https://${profile.linkedin.startsWith("http") ? "" : ""}${profile.linkedin}`} target="_blank" rel="noreferrer"
                                        className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-700 hover:border-blue-300 transition-all">
                                        <Linkedin className="w-4 h-4" />
                                    </a>
                                )}
                                {profile.instagram && (
                                    <a href={`https://instagram.com/${profile.instagram.replace("@", "")}`} target="_blank" rel="noreferrer"
                                        className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-pink-500 hover:border-pink-300 transition-all">
                                        <Instagram className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((s, i) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4"
                        >
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color} shrink-0`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Tabs */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden"
                >
                    <div role="tablist" className="flex border-b border-slate-100 dark:border-slate-700 px-6 gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                role="tab"
                                aria-selected={activeTab === tab}
                                onClick={() => setActiveTab(tab)}
                                className={`py-4 px-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab
                                    ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-6">
                        {activeTab === "Overview" && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">About</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                            {profile.bio || <span className="italic text-slate-400">No bio yet. Go to Edit Profile to add one.</span>}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">My Tasks</h3>
                                        {loadingTasks ? (
                                            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                                Loading tasks…
                                            </div>
                                        ) : tasks.length === 0 ? (
                                            <p className="text-sm text-slate-400 py-4">No tasks assigned.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {tasks.slice(0, 8).map(task => {
                                                    const color = statusColor(task.statusIndex)
                                                    const colorMap: Record<string, string> = {
                                                        green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                                        blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                                        amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                                        purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                                                        slate: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
                                                    }
                                                    return (
                                                        <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{task.name}</p>
                                                                <p className="text-xs text-slate-400 truncate">{task.board}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {task.dueDate && (
                                                                    <span className="text-[11px] text-slate-400">{task.dueDate}</span>
                                                                )}
                                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colorMap[color]}`}>
                                                                    {task.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Contact Information</h3>
                                    <div className="space-y-3">
                                        {[
                                            { icon: Mail, label: "Email", value: profile.email },
                                            { icon: Phone, label: "Phone", value: profile.phone },
                                            { icon: MapPin, label: "Location", value: profile.location },
                                            { icon: Building, label: "Company", value: profile.company },
                                            { icon: Link, label: "Website", value: profile.website },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                    <item.icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.value || "—"}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "Edit Profile" && (
                            <div className="max-w-2xl space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">First Name</label>
                                        <Input value={profile.first_name} onChange={e => handleChange("first_name", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Name</label>
                                        <Input value={profile.last_name} onChange={e => handleChange("last_name", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                                    <Input type="email" value={profile.email} disabled className="dark:bg-slate-700 dark:border-slate-600 dark:text-white opacity-60 cursor-not-allowed" />
                                    <p className="text-[11px] text-slate-400">Email is managed by your login account.</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</label>
                                    <Input value={profile.phone} onChange={e => handleChange("phone", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</label>
                                        <Input value={profile.role} onChange={e => handleChange("role", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</label>
                                        <Input value={profile.location} onChange={e => handleChange("location", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Company</label>
                                    <Input value={profile.company} onChange={e => handleChange("company", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Website</label>
                                    <Input value={profile.website} onChange={e => handleChange("website", e.target.value)} placeholder="yoursite.com" className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bio</label>
                                    <textarea
                                        value={profile.bio}
                                        onChange={e => handleChange("bio", e.target.value)}
                                        rows={4}
                                        className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Social Links</h4>
                                    <div className="space-y-3">
                                        {[
                                            { field: "twitter" as const, icon: Twitter, label: "Twitter / X", placeholder: "@handle" },
                                            { field: "linkedin" as const, icon: Linkedin, label: "LinkedIn", placeholder: "linkedin.com/in/yourname" },
                                            { field: "instagram" as const, icon: Instagram, label: "Instagram", placeholder: "@handle" },
                                        ].map(s => (
                                            <div key={s.field} className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                    <s.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                                </div>
                                                <Input
                                                    value={profile[s.field]}
                                                    onChange={e => handleChange(s.field, e.target.value)}
                                                    placeholder={s.placeholder}
                                                    className="dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {saveMsg && (
                                    <p className={`text-sm ${saveMsg.ok ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                        {saveMsg.text}
                                    </p>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                                    >
                                        {saving ? "Saving…" : "Save Changes"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="dark:border-slate-600 dark:text-slate-300"
                                        onClick={() => setActiveTab("Overview")}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
