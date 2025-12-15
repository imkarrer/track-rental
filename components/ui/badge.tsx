import * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants: Record<string, string> = {
  default:
    "border-transparent bg-blue-600 text-white hover:bg-blue-700",
  secondary:
    "border-transparent bg-gray-200 text-gray-800 hover:bg-gray-300",
  destructive:
    "border-transparent bg-red-600 text-white hover:bg-red-700",
  outline: "text-gray-900 border-gray-300",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }

