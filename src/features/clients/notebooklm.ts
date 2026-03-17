export type NotebookSummary = {
    id: string
    title: string
    source_count: number
    url: string
    ownership: string
    is_shared: boolean
    created_at: string | null
    modified_at: string | null
}

type NotebookListResponse = {
    status: "success" | "error"
    notebooks?: NotebookSummary[]
    error?: string
}

type NotebookQueryResponse = {
    status: "success" | "error"
    answer?: string
    conversation_id?: string
    error?: string
}

export async function fetchNotebooklmNotebooks() {
    const response = await fetch("/api/notebooklm/notebooks")
    const data = await response.json() as NotebookListResponse

    if (!response.ok || data.status === "error") {
        throw new Error(data.error ?? "Unable to load NotebookLM notebooks.")
    }

    return data.notebooks ?? []
}

export async function queryNotebooklm(input: {
    notebookId: string
    query: string
    conversationId?: string
}) {
    const response = await fetch("/api/notebooklm/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
    })

    const data = await response.json() as NotebookQueryResponse

    if (!response.ok || data.status === "error") {
        throw new Error(data.error ?? "NotebookLM could not answer this question.")
    }

    return {
        answer: data.answer ?? "",
        conversationId: data.conversation_id,
    }
}
