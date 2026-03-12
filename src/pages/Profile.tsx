import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    Camera, Mail, Phone, MapPin, Building, Link,
    Twitter, Linkedin, Instagram, CheckSquare, Clock, Users, Star
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClients } from "@/features/clients/repository"
import { getTasks } from "@/features/tasks/repository"
import { supabase } from "@/lib/supabase"

const tabs = ["Overview", "Edit Profile"] as const
type Tab = typeof tabs[number]

export function Profile() {
    const tasks = getTasks()
    const clients = getClients()
    const [activeTab, setActiveTab] = useState<Tab>("Overview")
    const [avatarUrl, setAvatarUrl] = useState<string>("")
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
    const [form, setForm] = useState({
        firstName: "Rafael",
        lastName: "Castillo",
        email: "rafael.castillo@xperienceusa.com",
        phone: "+1 (555) 012-3456",
        role: "Marketing Strategist",
        company: "Xperience Ai Marketing Solutions",
        location: "Miami, FL",
        bio: "Marketing strategist specializing in digital campaigns, brand strategy, and AI-powered growth solutions. Passionate about driving measurable results for global brands.",
        website: "xms-marketing.com",
        twitter: "@xms_rafael",
        linkedin: "linkedin.com/in/rafael",
        instagram: "@xms_mktg",
    })
    const stats = [
        { label: "Tasks Done", value: tasks.filter(t => t.status === "done").length, icon: CheckSquare, color: "text-green-600 bg-green-50 dark:bg-green-900/20" },
        { label: "In Progress", value: tasks.filter(t => t.status === "in-progress").length, icon: Clock, color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20" },
        { label: "Clients", value: clients.filter(c => c.status === "active").length, icon: Users, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20" },
        { label: "Performance", value: "94%", icon: Star, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
    ]

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) return
            const meta = session.user.user_metadata
            const fullName: string = meta?.full_name ?? meta?.name ?? ""
            const [first = "", ...rest] = fullName.split(" ")
            setAvatarUrl(meta?.picture ?? meta?.avatar_url ?? "")
            setForm(prev => ({
                ...prev,
                firstName: first,
                lastName: rest.join(" ") || prev.lastName,
                email: session.user.email ?? prev.email,
            }))
        })
    }, [])

    const handleChange = (field: keyof typeof form, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveMsg(null)
        const { error } = await supabase.auth.updateUser({
            email: form.email,
            data: {
                full_name: `${form.firstName} ${form.lastName}`.trim(),
                phone: form.phone,
                role: form.role,
                location: form.location,
                bio: form.bio,
                website: form.website,
                twitter: form.twitter,
                linkedin: form.linkedin,
                instagram: form.instagram,
            },
        })
        setSaving(false)
        setSaveMsg(error ? { ok: false, text: error.message } : { ok: true, text: "Profile saved successfully." })
        setTimeout(() => setSaveMsg(null), 3000)
    }

    return (
        <div className="h-full overflow-auto bg-slate-50 dark:bg-slate-900 p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Cover + Avatar */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm"
                >
                    {/* Avatar + name row */}
                    <div className="px-6 py-8">
                        <div className="flex items-center justify-between mb-6">
                            <div className="relative">
                                <Avatar className="w-24 h-24 ring-4 ring-white dark:ring-slate-800 shadow-lg">
                                    <AvatarImage src={avatarUrl} referrerPolicy="no-referrer" />
                                    <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold">
                                        {(form.firstName[0] ?? "") + (form.lastName[0] ?? "")}
                                    </AvatarFallback>
                                </Avatar>
                                <button className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors">
                                    <Camera className="w-3.5 h-3.5 text-white" />
                                </button>
                            </div>
                            <Button variant="outline" size="sm" className="dark:border-slate-600 dark:text-slate-300">
                                Edit Profile
                            </Button>
                        </div>

                        <div className="flex items-start justify-between flex-wrap gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{form.firstName} {form.lastName}</h1>
                                <p className="text-blue-600 dark:text-blue-400 font-medium text-sm mt-0.5">{form.role}</p>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{form.company}</p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{form.location}</span>
                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{form.email}</span>
                                    <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" />{form.website}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <a href="#" className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all">
                                    <Twitter className="w-4 h-4" />
                                </a>
                                <a href="#" className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-700 hover:border-blue-300 transition-all">
                                    <Linkedin className="w-4 h-4" />
                                </a>
                                <a href="#" className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-pink-500 hover:border-pink-300 transition-all">
                                    <Instagram className="w-4 h-4" />
                                </a>
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
                    {/* Tab bar */}
                    <div role="tablist" className="flex border-b border-slate-100 dark:border-slate-700 px-6 gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                role="tab"
                                aria-selected={activeTab === tab}
                                aria-controls={`tabpanel-${tab.toLowerCase().replace(" ", "-")}`}
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
                            <div role="tabpanel" id="tabpanel-overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Bio */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-2">About</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{form.bio}</p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Recent Tasks</h3>
                                        <div className="space-y-2">
                                            {tasks.slice(0, 5).map(t => (
                                                <div key={t.id} className="flex items-center gap-3 py-2">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "done" ? "bg-green-500" : t.status === "in-progress" ? "bg-amber-500" : "bg-slate-300"}`} />
                                                    <span className={`text-sm flex-1 ${t.status === "done" ? "line-through text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>{t.title}</span>
                                                    <span className="text-xs text-slate-400">{t.client}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Contact card */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white">Contact Information</h3>
                                    <div className="space-y-3">
                                        {[
                                            { icon: Mail, label: "Email", value: form.email },
                                            { icon: Phone, label: "Phone", value: form.phone },
                                            { icon: MapPin, label: "Location", value: form.location },
                                            { icon: Building, label: "Company", value: form.company },
                                            { icon: Link, label: "Website", value: form.website },
                                        ].map(item => (
                                            <div key={item.label} className="flex items-start gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                    <item.icon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                                                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "Edit Profile" && (
                            <div role="tabpanel" id="tabpanel-edit-profile" className="max-w-2xl space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">First Name</label>
                                        <Input value={form.firstName} onChange={e => handleChange("firstName", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Name</label>
                                        <Input value={form.lastName} onChange={e => handleChange("lastName", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</label>
                                    <Input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</label>
                                    <Input value={form.phone} onChange={e => handleChange("phone", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</label>
                                        <Input value={form.role} onChange={e => handleChange("role", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</label>
                                        <Input value={form.location} onChange={e => handleChange("location", e.target.value)} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bio</label>
                                    <textarea
                                        value={form.bio}
                                        onChange={e => handleChange("bio", e.target.value)}
                                        rows={4}
                                        className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Social Links</h4>
                                    <div className="space-y-3">
                                        {[
                                            { field: "twitter" as const, icon: Twitter, label: "Twitter" },
                                            { field: "linkedin" as const, icon: Linkedin, label: "LinkedIn" },
                                            { field: "instagram" as const, icon: Instagram, label: "Instagram" },
                                        ].map(s => (
                                            <div key={s.field} className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                    <s.icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                                </div>
                                                <Input value={form[s.field]} onChange={e => handleChange(s.field, e.target.value)} placeholder={s.label} className="dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
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
                                    <Button variant="outline" className="dark:border-slate-600 dark:text-slate-300">Cancel</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    )
}
