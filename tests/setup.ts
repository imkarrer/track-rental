import { vi } from "vitest"

// Mock 'server-only' module which throws when imported outside Next.js server components
vi.mock("server-only", () => ({}))

