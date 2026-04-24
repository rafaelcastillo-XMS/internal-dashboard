export interface Client {
    id: string
    name: string
    industry: string
    contact: string
    role: string
    email: string
    location: string
    avatar: string
    initials: string
    status: "active" | "inactive"
    color: string
    tagColor: string
    note: string
    // New fields
    pocOwnerName: string
    levelOfService: string
    phone: string
    website: string
    geoTargets: string
    nextInteraction: string
    customersProLink: string
}

export const clients: Client[] = [
    {
        id: "holts-garage",
        name: "Holt's Garage",
        industry: "Automotive Repair & Service",
        contact: "Eric Holt",
        role: "Owner",
        email: "eric@holtsgarage.com",
        location: "Austin, USA",
        avatar: "https://i.pravatar.cc/150?u=holts-garage",
        initials: "HG",
        status: "active",
        color: "bg-emerald-600",
        tagColor: "text-emerald-700 bg-emerald-50",
        note: "Pilot client for the live data layer. NotebookLM is the first connected integration and will power the client chat with real workshop knowledge.",
        pocOwnerName: "Eric Holt & Rafael",
        levelOfService: "Pilot Integration",
        phone: "+1 512 555 0197",
        website: "https://holtsgarage.com",
        geoTargets: "Austin Metro",
        nextInteraction: "2026-03-18",
        customersProLink: "https://pro.xms.com/holts-garage"
    },
]

export type TaskStatus = "todo" | "in-progress" | "done"
export type TaskPriority = "high" | "medium" | "low"

export interface Task {
    id: string
    title: string
    description: string
    status: TaskStatus
    priority: TaskPriority
    client: string
    clientId: string
    assignee: string
    dueDate: string
    tags: string[]
    subtasks?: { id: string; title: string; done: boolean }[]
}

export const tasks: Task[] = [
    {
        id: "t1",
        title: "Review Q1 Marketing Report",
        description: "Analyze the Q1 performance metrics, identify key wins and improvement areas across all client campaigns. Prepare executive summary for leadership.",
        status: "in-progress",
        priority: "high",
        client: "IBM",
        clientId: "ibm",
        assignee: "Rafael A.",
        dueDate: "2026-03-12",
        tags: ["reporting", "analytics"],
        subtasks: [
            { id: "s1", title: "Gather campaign data", done: true },
            { id: "s2", title: "Build performance charts", done: true },
            { id: "s3", title: "Write executive summary", done: false },
            { id: "s4", title: "Review with team", done: false },
        ]
    },
    {
        id: "t2",
        title: "Social Media Campaign – Coca-Cola Summer",
        description: "Design and schedule social media content for Coca-Cola's summer campaign. Includes Instagram, TikTok and X posts. Creative assets to be reviewed by client.",
        status: "todo",
        priority: "high",
        client: "Coca-Cola",
        clientId: "coca-cola",
        assignee: "Rafael A.",
        dueDate: "2026-03-20",
        tags: ["social media", "creative"],
        subtasks: [
            { id: "s5", title: "Draft content calendar", done: false },
            { id: "s6", title: "Create visual assets", done: false },
            { id: "s7", title: "Client review", done: false },
        ]
    },
    {
        id: "t3",
        title: "Brand Strategy Meeting Prep",
        description: "Prepare presentation deck for brand strategy alignment meeting. Include competitive analysis, positioning map, and proposed messaging framework.",
        status: "done",
        priority: "medium",
        client: "McDonald's",
        clientId: "mcdonalds",
        assignee: "Rafael A.",
        dueDate: "2026-03-05",
        tags: ["strategy", "branding"],
        subtasks: [
            { id: "s8", title: "Competitive analysis", done: true },
            { id: "s9", title: "Positioning deck", done: true },
            { id: "s10", title: "Present to client", done: true },
        ]
    },
    {
        id: "t4",
        title: "IBM Think Conference Materials",
        description: "Produce all print and digital materials for IBM Think 2025 conference. Includes booth design, digital signage, handouts and social media assets.",
        status: "in-progress",
        priority: "high",
        client: "IBM",
        clientId: "ibm",
        assignee: "Rafael A.",
        dueDate: "2026-03-18",
        tags: ["event", "design"],
        subtasks: [
            { id: "s11", title: "Booth design concepts", done: true },
            { id: "s12", title: "Digital signage", done: false },
            { id: "s13", title: "Print materials", done: false },
        ]
    },
    {
        id: "t5",
        title: "McDonald's McHappy Day Campaign",
        description: "End-to-end campaign execution for McHappy Day 2026. Coordinate with media partners, influencers and McDonald's regional teams for maximum reach.",
        status: "todo",
        priority: "medium",
        client: "McDonald's",
        clientId: "mcdonalds",
        assignee: "Rafael A.",
        dueDate: "2026-04-01",
        tags: ["campaign", "social media"],
        subtasks: []
    },
    {
        id: "t6",
        title: "Chevrolet EV Launch – Latam Creatives",
        description: "Develop creative assets for Chevrolet's electric vehicle launch in Latin America. Includes OOH, digital display and video storyboards.",
        status: "todo",
        priority: "low",
        client: "Chevrolet",
        clientId: "chevrolet",
        assignee: "Rafael A.",
        dueDate: "2026-04-10",
        tags: ["creative", "video"],
        subtasks: []
    },
    {
        id: "t7",
        title: "Ford Q1 Quarterly Review",
        description: "Prepare quarterly business review deck for Ford. Summarize campaign performance, ROI analysis and roadmap for Q2 activities.",
        status: "done",
        priority: "medium",
        client: "Ford Company",
        clientId: "ford",
        assignee: "Rafael A.",
        dueDate: "2026-03-07",
        tags: ["reporting", "client"],
        subtasks: [
            { id: "s14", title: "Data collection", done: true },
            { id: "s15", title: "QBR deck", done: true },
            { id: "s16", title: "Client meeting", done: true },
        ]
    },
]

export const calendarEvents = [
    { id: "e1", date: "2026-03-09", time: "09:00", title: "Team Standup", type: "meeting", color: "bg-blue-500" },
    { id: "e2", date: "2026-03-09", time: "14:00", title: "IBM Client Call", type: "client", color: "bg-purple-500" },
    { id: "e3", date: "2026-03-10", time: "10:00", title: "Design Review – Coca-Cola", type: "review", color: "bg-red-500" },
    { id: "e4", date: "2026-03-11", time: "11:00", title: "Coca-Cola Campaign Kickoff", type: "kickoff", color: "bg-red-500" },
    { id: "e5", date: "2026-03-12", time: "15:00", title: "Ford Quarterly Review", type: "client", color: "bg-slate-500" },
    { id: "e6", date: "2026-03-13", time: "09:30", title: "Weekly Strategy Sync", type: "meeting", color: "bg-blue-500" },
    { id: "e7", date: "2026-03-14", time: "13:00", title: "McDonald's Brand Meeting", type: "client", color: "bg-yellow-500" },
    { id: "e8", date: "2026-03-17", time: "10:00", title: "IBM Think Prep Call", type: "client", color: "bg-blue-600" },
    { id: "e9", date: "2026-03-18", time: "16:00", title: "Chevrolet Creatives Review", type: "review", color: "bg-orange-500" },
    { id: "e10", date: "2026-03-20", time: "09:00", title: "All-Hands Monthly Meeting", type: "meeting", color: "bg-green-500" },
    { id: "e11", date: "2026-03-24", time: "14:00", title: "Social Media Strategy – Q2", type: "strategy", color: "bg-indigo-500" },
    { id: "e12", date: "2026-03-26", time: "11:00", title: "Coca-Cola Assets Delivery", type: "deadline", color: "bg-red-600" },
]
