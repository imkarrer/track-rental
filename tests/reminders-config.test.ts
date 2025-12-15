import { describe, it, expect, beforeEach, vi } from "vitest"
import { getReminderOffsets, setReminderOffsets, DEFAULT_OFFSETS } from "@/lib/reminders/config"

const mockPrisma = vi.hoisted(() => ({
  reminderConfig: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock("@/lib/db/prisma", () => ({ prisma: mockPrisma }))

describe("reminders/config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("DEFAULT_OFFSETS", () => {
    it("exports default offsets as [3, 1]", () => {
      expect(DEFAULT_OFFSETS).toEqual([3, 1])
    })
  })

  describe("getReminderOffsets", () => {
    it("returns configured offsets when available", async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        id: "default",
        offsets: [7, 3, 1],
      })

      const result = await getReminderOffsets()
      expect(result).toEqual([7, 3, 1])
    })

    it("returns default offsets when config is null", async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue(null)

      const result = await getReminderOffsets()
      expect(result).toEqual([3, 1])
    })

    it("returns default offsets when config has empty offsets array", async () => {
      mockPrisma.reminderConfig.findUnique.mockResolvedValue({
        id: "default",
        offsets: [],
      })

      const result = await getReminderOffsets()
      expect(result).toEqual([3, 1])
    })

    it("returns default offsets when database query fails", async () => {
      mockPrisma.reminderConfig.findUnique.mockRejectedValue(new Error("db error"))

      const result = await getReminderOffsets()
      expect(result).toEqual([3, 1])
    })
  })

  describe("setReminderOffsets", () => {
    it("upserts reminder offsets", async () => {
      mockPrisma.reminderConfig.upsert.mockResolvedValue({
        id: "default",
        offsets: [5, 2],
      })

      await setReminderOffsets([5, 2])

      expect(mockPrisma.reminderConfig.upsert).toHaveBeenCalledWith({
        where: { id: "default" },
        update: { offsets: [5, 2] },
        create: { id: "default", offsets: [5, 2] },
      })
    })
  })
})

