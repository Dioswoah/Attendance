"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
    src?: string | null
    name?: string | null
    className?: string
}

export function UserAvatar({ src, name, className }: UserAvatarProps) {
    const [imgFailed, setImgFailed] = useState(false)
    const initial = name?.trim().charAt(0)?.toUpperCase() || "U"
    // Request higher resolution from Google profile URLs
    const highResSrc = src?.replace(/=s\d+-c$/, "=s200-c") ?? src

    if (!src || imgFailed) {
        return (
            <span className={cn("flex items-center justify-center", className)}>
                {initial}
            </span>
        )
    }

    return (
        <img
            src={highResSrc || src}
            alt={name || ""}
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
        />
    )
}
