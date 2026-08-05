export interface PromptOptimizationResult {
  summary: string
  strengths: string[]
  improvements: string[]
  optimizedPrompt: string
}

export function optimizePromptWithOpenAI(prompt: string): Promise<PromptOptimizationResult>
