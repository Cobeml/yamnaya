export function safeText(value: unknown, secrets?: string[]): string;
export function toolDetails(name: string, params?: Record<string, unknown>): { tool: string; detail: string };
export function registerActivity(api: { on(name: string, handler: (event: Record<string, unknown>, context: Record<string, unknown>) => Promise<void>): void }, dependencies?: { getContext(): Promise<Record<string, unknown>>; emit(context: unknown, event: Record<string, unknown>): Promise<void> }): void;
