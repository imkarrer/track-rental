import { prisma } from "@/lib/db/prisma"

const DEFAULT_OFFSETS = [3, 1]

export async function getReminderOffsets(): Promise<number[]> {
  try {
    const config = await prisma.reminderConfig.findUnique({
      where: { id: "default" },
    })
    if (config?.offsets?.length) {
      return config.offsets
    }
  } catch (error) {
    console.error("Failed to load reminder config, using defaults:", error)
  }
  return DEFAULT_OFFSETS
}

export async function setReminderOffsets(offsets: number[]) {
  await prisma.reminderConfig.upsert({
    where: { id: "default" },
    update: { offsets },
    create: { id: "default", offsets },
  })
}

export { DEFAULT_OFFSETS }


