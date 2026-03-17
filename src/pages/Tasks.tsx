import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    CheckSquare, Clock, Circle, Flag, Calendar, X,
    ChevronRight, User, Tag, CheckCircle2, Plus, ArrowRight, Trash2
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClients } from "@/features/clients/repository"
import { getTasks } from "@/features/tasks/repository"
import type { Task, TaskStatus, TaskPriority } from "@/data/dummy"

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string; bg: string; border: string; next?: TaskStatus }> = {
    "todo": {
        label: "To Do",
        icon: Circle,
        color: "text-slate-400",
        bg: "bg-slate-50 dark:bg-slate-800/60",
        border: "border-slate-200 dark:border-slate-700",
        next: "in-progress",
    },
    "in-progress": {
        label: "In Progress",
        icon: Clock,
        color: "text-amber-500",
        bg: "bg-amber-50/50 dark:bg-amber-900/10",
        border: "border-amber-200 dark:border-amber-800/40",
        next: "done",
    },
    "done": {
        label: "Done",
        icon: CheckSquare,
        color: "text-green-500",
        bg: "bg-green-50/50 dark:bg-green-900/10",
        border: "border-green-200 dark:border-green-800/40",
    },
}

const priorityConfig: Record<string, string> = {
    high: "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
    medium: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
    low: "text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400",
}

type LiveTask = Task & { subtasks: { id: string; title: string; done: boolean }[] }

function TaskCard({
    task, onClick, isSelected, onDragStart, onDragEnd
}: {
    task: LiveTask
    onClick: () => void
    isSelected: boolean
    onDragStart: () => void
    onDragEnd: () => void
}) {
    const cfg = statusConfig[task.status]
    const Icon = cfg.icon
    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            draggable
            onDragStart={() => onDragStart()}
            onDragEnd={onDragEnd}
            onClick={onClick}
            className={`p-4 rounded-xl border transition-all select-none ${cfg.bg} ${isSelected
                    ? `border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800/50 cursor-grab active:cursor-grabbing`
                    : `${cfg.border} hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer`
                }`}
        >
            <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-tight ${task.status === "done" ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                        {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityConfig[task.priority]}`}>
                            {task.priority}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-[9px] text-white font-bold">RA</span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate ml-1">{task.client}</span>
                    </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
            </div>

            {task.subtasks.length > 0 && (
                <div className="mt-3">
                    <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {task.subtasks.filter(s => s.done).length}/{task.subtasks.length} subtasks
                    </p>
                </div>
            )}
        </motion.article>
    )
}

function TaskDetail({
    task, onClose, onAdvanceStatus, onUpdateSubtasks
}: {
    task: LiveTask
    onClose: () => void
    onAdvanceStatus: (id: string, next: TaskStatus) => void
    onUpdateSubtasks: (id: string, subtasks: LiveTask["subtasks"]) => void
}) {
    const [subtasks, setSubtasks] = useState(task.subtasks)
    const cfg = statusConfig[task.status]
    const Icon = cfg.icon
    const nextStatus = cfg.next

    const toggleSubtask = (subId: string) => {
        const updated = subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s)
        setSubtasks(updated)
        onUpdateSubtasks(task.id, updated)
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between shrink-0">
                <div className="flex items-start gap-3 flex-1 min-w-0 mr-3">
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div className="min-w-0">
                        <h2 className="font-semibold text-slate-900 dark:text-white text-base leading-snug">{task.title}</h2>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${priorityConfig[task.priority]}`}>
                                <Flag className="w-2.5 h-2.5 inline mr-1" />{task.priority}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
                                {cfg.label}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Close task detail"
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">
                    {/* Description */}
                    <div>
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{task.description}</p>
                    </div>

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assignee</h3>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                                    <User className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300">{task.assignee}</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Client</h3>
                            <span className="text-sm text-slate-700 dark:text-slate-300">{task.client}</span>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Due Date</h3>
                            <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {new Date(task.dueDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </div>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tags</h3>
                            <div className="flex flex-wrap gap-1">
                                {task.tags.map(tag => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        <Tag className="w-2.5 h-2.5" />{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Subtasks */}
                    {subtasks.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    Subtasks ({subtasks.filter(s => s.done).length}/{subtasks.length})
                                </h3>
                            </div>
                            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                                    style={{ width: `${(subtasks.filter(s => s.done).length / subtasks.length) * 100}%` }}
                                />
                            </div>
                            <div className="space-y-1">
                                {subtasks.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => toggleSubtask(sub.id)}
                                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group text-left"
                                    >
                                        {sub.done
                                            ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                            : <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-blue-400 transition-colors shrink-0" />
                                        }
                                        <span className={`text-sm ${sub.done ? "line-through text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                                            {sub.title}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add subtask */}
                    <button className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all text-sm">
                        <Plus className="w-4 h-4" /> Add subtask
                    </button>

                    {/* Action buttons – below subtasks */}
                    <div className="space-y-2 pt-1">
                        {nextStatus && (
                            <Button
                                onClick={() => onAdvanceStatus(task.id, nextStatus)}
                                className="w-full gap-2 justify-center"
                                variant={nextStatus === "done" ? "default" : "outline"}
                            >
                                {nextStatus === "done" ? (
                                    <><CheckCircle2 className="w-4 h-4" /> Mark as Done</>
                                ) : (
                                    <><ArrowRight className="w-4 h-4" /> Move to In Progress</>
                                )}
                            </Button>
                        )}
                        {task.status === "done" && (
                            <Button
                                onClick={() => onAdvanceStatus(task.id, "todo")}
                                variant="outline"
                                className="w-full gap-2 justify-center text-slate-500"
                            >
                                <Circle className="w-4 h-4" /> Reopen Task
                            </Button>
                        )}
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}

type NewTaskForm = {
    title: string
    description: string
    client: string
    priority: TaskPriority
    dueDate: string
    subtaskInputs: string[]
}

function CreateTaskModal({ onClose, onCreate }: {
    onClose: () => void
    onCreate: (task: LiveTask) => void
}) {
    const clients = getClients()
    const [form, setForm] = useState<NewTaskForm>({
        title: "",
        description: "",
        client: clients[0].name,
        priority: "medium",
        dueDate: "",
        subtaskInputs: [""],
    })

    const setField = <K extends keyof NewTaskForm>(key: K, value: NewTaskForm[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }

    const addSubtaskInput = () => {
        setForm(prev => ({ ...prev, subtaskInputs: [...prev.subtaskInputs, ""] }))
    }

    const updateSubtaskInput = (i: number, value: string) => {
        const updated = [...form.subtaskInputs]
        updated[i] = value
        setForm(prev => ({ ...prev, subtaskInputs: updated }))
    }

    const removeSubtaskInput = (i: number) => {
        setForm(prev => ({ ...prev, subtaskInputs: prev.subtaskInputs.filter((_, idx) => idx !== i) }))
    }

    const handleCreate = () => {
        if (!form.title.trim()) return
        const subtasks = form.subtaskInputs
            .filter(s => s.trim())
            .map((s, i) => ({ id: `new-sub-${Date.now()}-${i}`, title: s.trim(), done: false }))

        const newTask: LiveTask = {
            id: `t-${Date.now()}`,
            title: form.title.trim(),
            description: form.description.trim(),
            status: "todo",
            priority: form.priority,
            client: form.client,
            clientId: clients.find(c => c.name === form.client)?.id ?? "",
            assignee: "Rafael A.",
            dueDate: form.dueDate || new Date().toISOString().split("T")[0],
            tags: [],
            subtasks,
        }
        onCreate(newTask)
        onClose()
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label="Create new task"
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
            >
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-semibold text-slate-900 dark:text-white text-base">New Task</h2>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
                                Title <span className="text-red-400">*</span>
                            </label>
                            <Input
                                value={form.title}
                                onChange={e => setField("title", e.target.value)}
                                placeholder="Task title..."
                                className="dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Description</label>
                            <textarea
                                value={form.description}
                                onChange={e => setField("description", e.target.value)}
                                placeholder="What needs to be done?"
                                rows={3}
                                className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder:text-slate-400"
                            />
                        </div>

                        {/* Client + Priority row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Client</label>
                                <select
                                    value={form.client}
                                    onChange={e => setField("client", e.target.value)}
                                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Priority</label>
                                <select
                                    value={form.priority}
                                    onChange={e => setField("priority", e.target.value as TaskPriority)}
                                    className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                        </div>

                        {/* Due date */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">Due Date</label>
                            <Input
                                type="date"
                                value={form.dueDate}
                                onChange={e => setField("dueDate", e.target.value)}
                                className="dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                        </div>

                        {/* Subtasks */}
                        <div>
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Subtasks</label>
                            <div className="space-y-2">
                                {form.subtaskInputs.map((sub, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-slate-600 shrink-0" />
                                        <Input
                                            value={sub}
                                            onChange={e => updateSubtaskInput(i, e.target.value)}
                                            placeholder={`Subtask ${i + 1}...`}
                                            className="flex-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm h-8"
                                        />
                                        {form.subtaskInputs.length > 1 && (
                                            <button
                                                onClick={() => removeSubtaskInput(i)}
                                                className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={addSubtaskInput}
                                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add subtask
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <Button
                            onClick={handleCreate}
                            disabled={!form.title.trim()}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
                        >
                            Create Task
                        </Button>
                        <Button variant="outline" onClick={onClose} className="dark:border-slate-600 dark:text-slate-300">
                            Cancel
                        </Button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}

const columns: { status: TaskStatus; label: string }[] = [
    { status: "todo", label: "To Do" },
    { status: "in-progress", label: "In Progress" },
    { status: "done", label: "Done" },
]

export function Tasks() {
    const initialTasks = getTasks()
    const [taskList, setTaskList] = useState<LiveTask[]>(
        initialTasks.map(t => ({ ...t, subtasks: t.subtasks ?? [] }))
    )
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [filter, setFilter] = useState<TaskStatus | "all">("all")
    const [createOpen, setCreateOpen] = useState(false)

    // Drag state
    const dragTaskId = useRef<string | null>(null)
    const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)

    const selectedTask = taskList.find(t => t.id === selectedId) ?? null

    const advanceStatus = (id: string, next: TaskStatus) => {
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, status: next } : t))
    }

    const updateSubtasks = (id: string, subtasks: LiveTask["subtasks"]) => {
        setTaskList(prev => prev.map(t => t.id === id ? { ...t, subtasks } : t))
    }

    const handleDragStart = (taskId: string) => {
        dragTaskId.current = taskId
    }

    const handleDrop = (status: TaskStatus) => {
        if (!dragTaskId.current) return
        setTaskList(prev => prev.map(t => t.id === dragTaskId.current ? { ...t, status } : t))
        dragTaskId.current = null
        setDragOverCol(null)
    }

    const filteredTasks = filter === "all" ? taskList : taskList.filter(t => t.status === filter)

    return (
        <>
            <div className="flex h-full bg-slate-50 dark:bg-slate-900 relative">
                {/* Main task list – always full width (panel overlays it) */}
                <div className="w-full flex flex-col h-full overflow-hidden">
                    {/* Toolbar */}
                    <div className="border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                        <div className="mx-auto max-w-screen-2xl flex items-center justify-between gap-4 p-6">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tasks</h1>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {taskList.length} tasks · {taskList.filter(t => t.status === "in-progress").length} in progress
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                                    {[{ val: "all" as const, label: "All" }, ...columns.map(c => ({ val: c.status, label: c.label }))].map(opt => (
                                        <button
                                            key={opt.val}
                                            onClick={() => setFilter(opt.val)}
                                            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${filter === opt.val
                                                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <div className="mx-auto max-w-screen-2xl p-6">
                            {filter === "all" ? (
                                /* Kanban */
                                <div className="flex gap-5 h-full min-w-max pb-4">
                                    {columns.map(col => {
                                        const colTasks = taskList.filter(t => t.status === col.status)
                                        const cfg = statusConfig[col.status]
                                        const isDragTarget = dragOverCol === col.status
                                        return (
                                            <div
                                                key={col.status}
                                                className="w-[280px] xl:w-auto xl:flex-1 flex flex-col shrink-0"
                                                onDragOver={e => { e.preventDefault(); setDragOverCol(col.status) }}
                                                onDragLeave={() => setDragOverCol(null)}
                                                onDrop={() => handleDrop(col.status)}
                                            >
                                                <div className="flex items-center gap-2 mb-3 shrink-0">
                                                    <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{col.label}</span>
                                                    <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                                                </div>
                                                <div
                                                    className={`flex-1 overflow-y-auto overflow-x-hidden space-y-2.5 pb-4 rounded-xl transition-colors min-h-[80px] p-1 custom-scrollbar ${isDragTarget ? "bg-blue-50 dark:bg-blue-900/10 ring-2 ring-blue-300 dark:ring-blue-700 ring-inset" : ""}`}
                                                >
                                                    {colTasks.map(task => (
                                                        <TaskCard
                                                            key={task.id}
                                                            task={task}
                                                            onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                                                            isSelected={selectedId === task.id}
                                                            onDragStart={() => handleDragStart(task.id)}
                                                            onDragEnd={() => { dragTaskId.current = null; setDragOverCol(null) }}
                                                        />
                                                    ))}
                                                    {colTasks.length === 0 && (
                                                        <div className={`h-16 flex items-center justify-center rounded-xl border-2 border-dashed ${isDragTarget ? "border-blue-400 text-blue-400" : "border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"} text-xs font-medium transition-colors`}>
                                                            Drop here
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                /* Filtered list */
                                <div className="max-w-2xl space-y-2.5">
                                    {filteredTasks.map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            onClick={() => setSelectedId(task.id === selectedId ? null : task.id)}
                                            isSelected={selectedId === task.id}
                                            onDragStart={() => { }}
                                            onDragEnd={() => { }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Detail panel – slides in from right as an overlay */}
                <AnimatePresence>
                    {selectedTask && (
                        <motion.div
                            key={selectedTask.id}
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="absolute right-0 top-0 bottom-0 w-96 z-20 border-l border-slate-100 dark:border-slate-700 shadow-2xl"
                            style={{ boxShadow: "-8px 0 32px rgba(0,0,0,0.10)" }}
                        >
                            <TaskDetail
                                key={selectedTask.id}
                                task={selectedTask}
                                onClose={() => setSelectedId(null)}
                                onAdvanceStatus={advanceStatus}
                                onUpdateSubtasks={updateSubtasks}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Create task modal – outside flex container to avoid z-index issues */}
            <AnimatePresence>
                {createOpen && (
                    <CreateTaskModal
                        onClose={() => setCreateOpen(false)}
                        onCreate={task => setTaskList(prev => [task, ...prev])}
                    />
                )}
            </AnimatePresence>
        </>
    )
}
