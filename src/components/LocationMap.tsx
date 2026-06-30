"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import type { Map as LeafletMap, Marker } from "leaflet"

export interface LocationRecord {
    id: string
    clockIn: string | null
    clockOut: string | null
    clockInLat: number | null
    clockInLng: number | null
    clockInAccuracy: number | null
    clockOutLat: number | null
    clockOutLng: number | null
    clockOutAccuracy: number | null
    user: { id: string; name: string; email: string; department: { id: string; name: string } | null }
    mode: string
}

interface Props {
    records: LocationRecord[]
    showClockIn: boolean
    showClockOut: boolean
    highlightId: string | null
    onPinClick: (id: string) => void
    timezone: string
}

// SVG map pin — fixed viewBox 24×32, rendered at w×h px.
// Blue + up-arrow  = clock in   (arriving)
// Green + checkmark = clock out (departing)
function pinHtml(type: "in" | "out", highlighted: boolean): string {
    const w  = highlighted ? 28 : 22
    const h  = Math.round(w * 32 / 24)   // keep 24:32 aspect ratio
    const fill    = type === "in"
        ? (highlighted ? "#1d4ed8" : "#2563eb")
        : (highlighted ? "#15803d" : "#16a34a")
    const outline = highlighted ? "#fbbf24" : "white"
    const sw      = highlighted ? 2.5 : 1.5

    // Inner glyph drawn in a 24×24 circle area (tip below at y>24)
    const glyph = type === "in"
        // Up-arrow ↑ centred at (12,12)
        ? `<line x1="12" y1="16" x2="12" y2="7"  stroke="white" stroke-width="2"   stroke-linecap="round"/>
           <line x1="8"  y1="11" x2="12" y2="7"  stroke="white" stroke-width="2"   stroke-linecap="round"/>
           <line x1="16" y1="11" x2="12" y2="7"  stroke="white" stroke-width="2"   stroke-linecap="round"/>`
        // Checkmark ✓ centred at (12,12)
        : `<polyline points="7,13 11,17 17,8" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`

    return (
        `<svg width="${w}" height="${h}" viewBox="0 0 24 32" fill="none" ` +
        `xmlns="http://www.w3.org/2000/svg" ` +
        `style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45))">` +
        `<path d="M12 0C5.373 0 0 5.373 0 12C0 20 12 32 12 32C12 32 24 20 24 12C24 5.373 18.627 0 12 0Z" ` +
        `fill="${fill}" stroke="${outline}" stroke-width="${sw}" stroke-linejoin="round"/>` +
        glyph +
        `</svg>`
    )
}

export default function LocationMap({ records, showClockIn, showClockOut, highlightId, onPinClick, timezone }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef       = useRef<LeafletMap | null>(null)
    const markersRef   = useRef<Marker[]>([])

    // Initialise map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        const L = require("leaflet") as typeof import("leaflet")

        mapRef.current = L.map(containerRef.current, { zoomControl: true })
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(mapRef.current)
        mapRef.current.setView([14.5995, 120.9842], 12)

        return () => {
            mapRef.current?.remove()
            mapRef.current = null
        }
    }, [])

    // Re-draw markers whenever data or filter changes
    useEffect(() => {
        if (!mapRef.current) return
        const L = require("leaflet") as typeof import("leaflet")

        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        const bounds: [number, number][] = []

        records.forEach(rec => {
            const hl = rec.id === highlightId

            if (showClockIn && rec.clockInLat != null && rec.clockInLng != null) {
                const w = hl ? 28 : 22
                const h = Math.round(w * 32 / 24)
                const t = rec.clockIn
                    ? new Date(rec.clockIn).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: timezone })
                    : "N/A"

                const icon = L.divIcon({
                    className: "",
                    html: pinHtml("in", hl),
                    iconSize:   [w, h],
                    iconAnchor: [w / 2, h],
                    popupAnchor: [0, -h],
                })
                const marker = L.marker([rec.clockInLat, rec.clockInLng], { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(
                        `<div style="font-family:system-ui;min-width:150px">
                            <div style="font-weight:700;margin-bottom:4px">${rec.user.name}</div>
                            <div style="color:#2563eb;font-size:0.82rem">&#x2191; Clock In: ${t}</div>
                            ${rec.user.department ? `<div style="color:#888;font-size:0.78rem">${rec.user.department.name}</div>` : ""}
                            ${rec.clockInAccuracy ? `<div style="color:#aaa;font-size:0.75rem">&#xb1;${Math.round(rec.clockInAccuracy)}m accuracy</div>` : ""}
                        </div>`
                    )
                marker.on("click", () => onPinClick(rec.id))
                markersRef.current.push(marker)
                bounds.push([rec.clockInLat, rec.clockInLng])
            }

            if (showClockOut && rec.clockOutLat != null && rec.clockOutLng != null) {
                const w = hl ? 28 : 22
                const h = Math.round(w * 32 / 24)
                const t = rec.clockOut
                    ? new Date(rec.clockOut).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: timezone })
                    : "N/A"

                const icon = L.divIcon({
                    className: "",
                    html: pinHtml("out", hl),
                    iconSize:   [w, h],
                    iconAnchor: [w / 2, h],
                    popupAnchor: [0, -h],
                })
                const marker = L.marker([rec.clockOutLat, rec.clockOutLng], { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(
                        `<div style="font-family:system-ui;min-width:150px">
                            <div style="font-weight:700;margin-bottom:4px">${rec.user.name}</div>
                            <div style="color:#16a34a;font-size:0.82rem">&#x2713; Clock Out: ${t}</div>
                            ${rec.user.department ? `<div style="color:#888;font-size:0.78rem">${rec.user.department.name}</div>` : ""}
                            ${rec.clockOutAccuracy ? `<div style="color:#aaa;font-size:0.75rem">&#xb1;${Math.round(rec.clockOutAccuracy)}m accuracy</div>` : ""}
                        </div>`
                    )
                marker.on("click", () => onPinClick(rec.id))
                markersRef.current.push(marker)
                bounds.push([rec.clockOutLat, rec.clockOutLng])
            }
        })

        if (bounds.length > 0) {
            mapRef.current.fitBounds(bounds as any, { padding: [48, 48], maxZoom: 16 })
        }
    }, [records, showClockIn, showClockOut, highlightId, onPinClick, timezone])

    return <div ref={containerRef} className="h-full w-full" />
}
