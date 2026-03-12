import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, MapPin, Phone, Mail, Building } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

type Message = {
    id: string
    text: string
    sender: "user" | "client"
    timestamp: Date
}

const mockResponses = [
    "Entendido, me parece perfecto.",
    "¿Me podrías dar más detalles sobre eso, por favor?",
    "¡Excelente! Avancemos con esa propuesta.",
    "Déjame consultarlo y te aviso pronto.",
    "Me gustaría programar una llamada para discutirlo.",
    "Suena muy interesante para nuestra campaña 360."
]

export function ClienteChat() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            text: "Hola, me gustaría información sobre sus servicios 360.",
            sender: "client",
            timestamp: new Date()
        }
    ])
    const [inputValue, setInputValue] = useState("")
    const [isTyping, setIsTyping] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const handleSend = () => {
        if (!inputValue.trim()) return

        const newUserMsg: Message = {
            id: Date.now().toString(),
            text: inputValue,
            sender: "user",
            timestamp: new Date()
        }

        setMessages(prev => [...prev, newUserMsg])
        setInputValue("")
        setIsTyping(true)

        // Simulate mock response
        setTimeout(() => {
            const mockResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]
            const newClientMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: mockResponse,
                sender: "client",
                timestamp: new Date()
            }
            setMessages(prev => [...prev, newClientMsg])
            setIsTyping(false)
        }, 1500 + Math.random() * 1000)
    }

    // Scroll to bottom effect
    useEffect(() => {
        if (scrollRef.current) {
            const scrollViewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (scrollViewport) {
                scrollViewport.scrollTop = scrollViewport.scrollHeight;
            }
        }
    }, [messages, isTyping])

    return (
        <div className="flex h-full w-full bg-white relative">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col h-full relative border-r border-slate-100">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur-md z-10 sticky top-0">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800">Chat con Carlos Ruiz</h2>
                        <p className="text-sm text-slate-500 flex items-center mt-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                            En línea
                        </p>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                    <div className="max-w-3xl mx-auto space-y-6 pb-6 pt-4">
                        <AnimatePresence initial={false}>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`flex items-end max-w-[80%] space-x-2 ${msg.sender === "user" ? "flex-row-reverse space-x-reverse" : "flex-row"}`}>
                                        {msg.sender === "client" && (
                                            <Avatar className="w-8 h-8 mb-1 border border-slate-100 shadow-sm">
                                                <AvatarImage src="https://i.pravatar.cc/150?u=carlos" />
                                                <AvatarFallback>CR</AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div
                                            className={`px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed ${msg.sender === "user"
                                                ? "bg-blue-600 text-white rounded-br-sm shadow-blue-500/20"
                                                : "bg-slate-100 text-slate-800 rounded-bl-sm"
                                                }`}
                                        >
                                            {msg.text}
                                            <div className={`text-[11px] mt-1 ${msg.sender === "user" ? "text-blue-100/80 text-right" : "text-slate-400"}`}>
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex justify-start"
                                >
                                    <div className="flex items-end space-x-2">
                                        <Avatar className="w-8 h-8 mb-1 border border-slate-100 shadow-sm">
                                            <AvatarImage src="https://i.pravatar.cc/150?u=carlos" />
                                            <AvatarFallback>CR</AvatarFallback>
                                        </Avatar>
                                        <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm flex space-x-1.5 items-center h-[52px]">
                                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 bg-slate-400/80 rounded-full" />
                                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-slate-400/80 rounded-full" />
                                            <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-slate-400/80 rounded-full" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </ScrollArea>

                <div className="p-4 bg-white/80 backdrop-blur-md">
                    <div className="max-w-3xl mx-auto flex items-center space-x-3 bg-slate-50 p-2 rounded-full border border-slate-200 focus-within:bg-white focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Escribe un mensaje para Carlos..."
                            className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-4 text-[15px]"
                        />
                        <Button onClick={handleSend} size="icon" className="rounded-full bg-blue-600 hover:bg-blue-700 transition-colors h-10 w-10 shrink-0 shadow-sm shadow-blue-500/20">
                            <Send className="w-4 h-4 text-white" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Profile Area */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-80 border-l border-slate-100 bg-slate-50/50 flex flex-col hidden lg:flex"
            >
                <div className="p-8 flex flex-col items-center border-b border-slate-100 bg-white shadow-[0_4px_20px_-15px_rgba(0,0,0,0.1)] z-10">
                    <Avatar className="w-28 h-28 mb-5 ring-4 ring-white shadow-xl">
                        <AvatarImage src="https://i.pravatar.cc/150?u=carlos" />
                        <AvatarFallback className="text-3xl bg-slate-100 text-slate-600 font-semibold">CR</AvatarFallback>
                    </Avatar>
                    <h3 className="text-2xl font-semibold text-slate-800 tracking-tight">Carlos Ruiz</h3>
                    <p className="text-blue-600 font-medium text-sm mt-1 bg-blue-50 px-3 py-1 rounded-full">Director de Marketing</p>
                    <div className="flex justify-center w-full space-x-3 mt-6">
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all">
                            <Phone className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10 text-slate-600 hover:text-blue-600 border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all">
                            <Mail className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Información</h4>
                            <div className="space-y-4">
                                <div className="flex items-center text-sm text-slate-700 font-medium group cursor-default">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mr-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                        <Building className="w-4 h-4" />
                                    </div>
                                    TechCorp Solutions
                                </div>
                                <div className="flex items-center text-sm text-slate-700 font-medium group cursor-default">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mr-3 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    Madrid, España
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-slate-200/60" />

                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Notas Internas</h4>
                            <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200/50 text-sm text-slate-700 leading-relaxed shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                                Cliente interesado en la campaña 360 y renovación de branding. Presupuesto aprobado para Q3.
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </motion.div>
        </div>
    )
}
