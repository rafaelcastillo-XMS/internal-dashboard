import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    Send, MapPin, Phone, Mail, Building, Globe,
    User, ExternalLink, Activity,
    Bot, Settings2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Client } from "@/data/dummy"
import { getClientIntegrationConfig } from "@/features/clients/integrations"
import { queryNotebooklm } from "@/features/clients/notebooklm"
import { useClientRecord } from "@/features/clients/useClientRecord"

type Message = {
    id: string
    text: string
    sender: "user" | "client"
    timestamp: Date
}

function ChatArea({ client }: { client: Client }) {
    const navigate = useNavigate()
    const integration = getClientIntegrationConfig(client.id)
    const hasCustomLogo = Boolean(client.avatar && !client.avatar.includes("pravatar.cc"))
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            text: integration.notebooklm.enabled && integration.notebooklm.notebookId
                ? `Hi, I'm connected to NotebookLM for ${client.name}. Ask me anything and I'll answer from ${integration.notebooklm.notebookTitle || "the selected notebook"}.`
                : `Hi, I'm ${client.contact}. Connect NotebookLM in integrations to answer with real client knowledge.`,
            sender: "client",
            timestamp: new Date()
        }
    ])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const [conversationId, setConversationId] = useState<string | undefined>(undefined)
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setMessages([{
            id: "1",
            text: integration.notebooklm.enabled && integration.notebooklm.notebookId
                ? `Hi, I'm connected to NotebookLM for ${client.name}. Ask me anything and I'll answer from ${integration.notebooklm.notebookTitle || "the selected notebook"}.`
                : `Hi, I'm ${client.contact}. Connect NotebookLM in integrations to answer with real client knowledge.`,
            sender: "client",
            timestamp: new Date()
        }])
        setConversationId(undefined)
    }, [client.contact, client.id, integration.notebooklm.enabled, integration.notebooklm.notebookId, integration.notebooklm.notebookTitle, client.name])

    const handleSend = async () => {
        if (!inputValue.trim()) return
        const prompt = inputValue.trim()
        const newUserMsg: Message = {
            id: Date.now().toString(),
            text: prompt,
            sender: "user",
            timestamp: new Date()
        }
        setMessages(prev => [...prev, newUserMsg])
        setInputValue("")
        setIsTyping(true)

        try {
            let reply = "NotebookLM is not enabled for this client yet. Open integrations and select a notebook first."
            let nextConversationId = conversationId

            if (integration.notebooklm.enabled && integration.notebooklm.notebookId) {
                const result = await queryNotebooklm({
                    notebookId: integration.notebooklm.notebookId,
                    query: prompt,
                    conversationId,
                })
                reply = result.answer || "NotebookLM returned an empty answer."
                nextConversationId = result.conversationId
            }

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: reply,
                sender: "client",
                timestamp: new Date()
            }])
            setConversationId(nextConversationId)
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : "NotebookLM could not answer right now."

            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: message,
                sender: "client",
                timestamp: new Date()
            }])
        } finally {
            setIsTyping(false)
        }
    }

    useEffect(() => {
        if (scrollRef.current) {
            const vp = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
            if (vp) vp.scrollTop = vp.scrollHeight
        }
    }, [messages, isTyping])

    return (
        <div className="flex-1 flex flex-col h-full border-r border-slate-100 dark:border-slate-800">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
                {hasCustomLogo ? (
                    <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        <img src={client.avatar} alt={`${client.name} logo`} className="h-full w-full object-cover" />
                    </div>
                ) : (
                    <Avatar className="w-10 h-10 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <AvatarFallback className={`${client.color} text-white font-bold`}>{client.initials}</AvatarFallback>
                    </Avatar>
                )}
                <div>
                    <h2 className="font-semibold text-slate-800 dark:text-white">Chat – {client.contact}</h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]" />
                            {client.name} · Online
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${integration.notebooklm.enabled && integration.notebooklm.notebookId
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                            }`}>
                            <Bot className="h-3 w-3" />
                            {integration.notebooklm.enabled && integration.notebooklm.notebookId ? "NotebookLM live" : "Demo mode"}
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="ml-auto rounded-xl border-slate-200 bg-white/80 dark:border-slate-700 dark:bg-slate-900/70"
                    onClick={() => navigate(`/clients/${client.id}/integrations`)}
                >
                    <Settings2 className="h-4 w-4" />
                    Integrations
                </Button>
            </div>

            <ScrollArea className="flex-1 p-5" ref={scrollRef}>
                <div className="max-w-2xl mx-auto space-y-5 pb-4 pt-2">
                    <AnimatePresence initial={false}>
                        {messages.map(msg => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`flex items-end max-w-[78%] gap-2 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                    {msg.sender === "client" && (
                                        hasCustomLogo ? (
                                            <div className="mb-1 h-7 w-7 overflow-hidden rounded-full border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                                <img src={client.avatar} alt={`${client.name} logo`} className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <Avatar className="w-7 h-7 mb-1 border border-slate-100 dark:border-slate-700 shadow-sm">
                                                <AvatarFallback className="text-xs">{client.initials}</AvatarFallback>
                                            </Avatar>
                                        )
                                    )}
                                    <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-[14px] leading-relaxed ${msg.sender === "user"
                                        ? "bg-blue-600 text-white rounded-br-sm"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-sm"
                                        }`}>
                                        {msg.text}
                                        <div className={`text-[10px] mt-1 ${msg.sender === "user" ? "text-blue-100/80 text-right" : "text-slate-400"}`}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex justify-start"
                            >
                                <div className="flex items-end gap-2">
                                    <Avatar className="w-7 h-7 mb-1 border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <AvatarFallback className="text-xs">{client.initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center h-11">
                                        {[0, 0.2, 0.4].map(delay => (
                                            <motion.div key={delay} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay }} className="w-1.5 h-1.5 bg-slate-400/80 rounded-full" />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
                <div className="max-w-2xl mx-auto flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-full border border-slate-200 dark:border-slate-700 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
                    <Input
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSend()}
                        placeholder={integration.notebooklm.enabled && integration.notebooklm.notebookId
                            ? `Ask NotebookLM about ${client.name}...`
                            : `Message ${client.contact}...`}
                        className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-4 text-sm"
                    />
                    <Button onClick={handleSend} size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 h-9 w-9">
                        <Send className="w-4 h-4 text-white" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

function SidebarInfo({ client }: { client: Client }) {
    return (
        <div className="w-[320px] bg-white dark:bg-slate-900 h-full shrink-0 overflow-hidden hidden lg:flex flex-col">
            <div className="p-6 flex flex-col items-center border-b border-slate-100 dark:border-slate-800">
                <div className="mb-4 h-24 w-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {client.avatar ? (
                        <img src={client.avatar} alt={`${client.name} logo`} className="h-full w-full object-cover" />
                    ) : (
                        <div className={`flex h-full w-full items-center justify-center ${client.color} text-3xl font-bold text-white`}>
                            {client.initials}
                        </div>
                    )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{client.name}</h3>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${client.status === "active"
                    ? "bg-green-500/10 text-green-600 border-green-200 dark:text-green-400 dark:border-green-800/50"
                    : "bg-slate-500/10 text-slate-500 border-slate-200 dark:text-slate-400 dark:border-slate-800"
                    }`}>
                    {client.status === "active" ? "Active" : "Inactive"}
                </div>
            </div>

            <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                    <section>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Client Information</h4>
                        <div className="grid gap-4">
                            <InfoItem icon={User} label="POC - Owner Name" value={client.pocOwnerName} />
                            <InfoItem icon={Activity} label="Level of Service" value={client.levelOfService} badge />
                            <InfoItem icon={Building} label="Industry" value={client.industry} />
                            <InfoItem icon={MapPin} label="Location" value={client.location} />
                        </div>
                    </section>

                    <Separator className="bg-slate-100 dark:bg-slate-800" />

                    <section>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact & Media</h4>
                        <div className="grid gap-4">
                            <InfoItem icon={Phone} label="Phone" value={client.phone} />
                            <InfoItem icon={Mail} label="Email" value={client.email} />
                            <InfoItem icon={Globe} label="Website" value={client.website} isLink />
                        </div>
                    </section>
                </div>
            </ScrollArea>
        </div>
    )
}

function InfoItem({ icon: Icon, label, value, isLink, linkUrl, badge }: { icon: React.ElementType, label: string, value: string, isLink?: boolean, linkUrl?: string, badge?: boolean }) {
    return (
        <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
                <Icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                {badge ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                        {value}
                    </span>
                ) : isLink ? (
                    <a
                        href={linkUrl || value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 truncate"
                    >
                        {value} <ExternalLink className="w-3 h-3" />
                    </a>
                ) : (
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{value}</p>
                )}
            </div>
        </div>
    )
}

export function Clients() {
    const { clientId } = useParams<{ clientId: string }>()
    const { client } = useClientRecord(clientId)

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <ChatArea client={client} />
            <SidebarInfo client={client} />
        </div>
    )
}
