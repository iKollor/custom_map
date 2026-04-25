"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@workspace/ui/components/chart";

import { MapPopup } from "../popup";
import { chartConfigFromSegments, segmentPercent } from "./helpers";
import type { ClusterPieDetails, ClusterPieSegment } from "./types";

// ============================================================================
// Popup helpers
// ============================================================================

/** Merge case-duplicated segments (e.g. "Formal" + "formal" → "Formal"). */
function mergeSegmentsByName(segments: ClusterPieSegment[]): ClusterPieSegment[] {
    const map = new globalThis.Map<string, ClusterPieSegment>();
    for (const seg of segments) {
        const key = seg.category.toLowerCase().trim();
        const existing = map.get(key);
        if (existing) {
            existing.count += seg.count;
        } else {
            map.set(key, { ...seg, category: seg.category.trim() });
        }
    }
    const merged = Array.from(map.values()).sort((a, b) => b.count - a.count);
    const total = merged.reduce((sum, s) => sum + s.count, 0) || 1;
    return merged.map((s) => ({
        ...s,
        percent: segmentPercent(s.count, total),
    }));
}

/** Collapse tail categories into "Otros" when there are too many. */
const MAX_VISIBLE_CATEGORIES = 8;
function collapseOtros(segments: ClusterPieSegment[]): ClusterPieSegment[] {
    if (segments.length <= MAX_VISIBLE_CATEGORIES) return segments;
    const visible = segments.slice(0, MAX_VISIBLE_CATEGORIES - 1);
    const rest = segments.slice(MAX_VISIBLE_CATEGORIES - 1);
    const otrosCount = rest.reduce((sum, s) => sum + s.count, 0);
    const total = segments.reduce((sum, s) => sum + s.count, 0) || 1;
    return [
        ...visible,
        {
            category: `Otros (${rest.length})`,
            color: "#94a3b8",
            count: otrosCount,
            percent: segmentPercent(otrosCount, total),
        },
    ];
}

// ============================================================================
// ClusterPiePopup — Interactive cluster breakdown
// ============================================================================

export function ClusterPiePopup({
    details,
    onClose,
}: {
    details: ClusterPieDetails;
    onClose: () => void;
}) {
    const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

    // Merge duplicates and collapse tail
    const segments = useMemo(() => {
        const merged = mergeSegmentsByName(details.segments);
        return collapseOtros(merged);
    }, [details.segments]);

    const total = details.pointCount;

    // Chart data — when focused, gray-out non-focused segments
    const chartData = useMemo(
        () =>
            segments.map((seg) => ({
                category: seg.category,
                value: seg.count,
                percent: seg.percent,
                fill: focusedCategory && focusedCategory !== seg.category
                    ? "hsl(var(--muted) / 0.25)"
                    : seg.color,
                originalFill: seg.color,
                isFocused: focusedCategory === seg.category,
            })),
        [segments, focusedCategory],
    );

    const chartConfig = useMemo<ChartConfig>(
        () => chartConfigFromSegments(segments),
        [segments],
    );

    const focusedSegment = focusedCategory
        ? segments.find((s) => s.category === focusedCategory)
        : null;

    const handleLegendClick = (category: string) => {
        setFocusedCategory((prev) => (prev === category ? null : category));
    };

    return (
        <MapPopup
            longitude={details.coordinates[0]}
            latitude={details.coordinates[1]}
            onClose={onClose}
            closeButton
            className="w-64 p-0"
            offset={24}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/40 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex size-5 items-center justify-center rounded-md bg-primary/10">
                        <span className="text-[10px] font-bold text-primary">C</span>
                    </div>
                    <div>
                        <p className="text-xs font-semibold leading-tight">Cluster</p>
                        <p className="text-[10px] text-muted-foreground">
                            {total} puntos · {segments.length} categoría{segments.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="relative px-3 pt-3 pb-1">
                <ChartContainer
                    config={chartConfig}
                    className="mx-auto aspect-square h-36 w-36"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    formatter={(value, _name, item) => {
                                        const raw = item?.payload as
                                            | { category?: string; percent?: number; originalFill?: string }
                                            | undefined;
                                        return (
                                            <div className="flex items-center gap-2 text-xs">
                                                <span
                                                    className="size-2 rounded-full"
                                                    style={{ background: raw?.originalFill ?? item?.color }}
                                                />
                                                <span className="font-medium">{raw?.category ?? ""}</span>
                                                <span className="ml-auto tabular-nums">
                                                    {value} ({raw?.percent ?? 0}%)
                                                </span>
                                            </div>
                                        );
                                    }}
                                />
                            }
                        />
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="category"
                            innerRadius={36}
                            outerRadius={58}
                            strokeWidth={1.5}
                            stroke="hsl(var(--background))"
                            paddingAngle={1.5}
                            animationBegin={0}
                            animationDuration={400}
                            animationEasing="ease-out"
                        >
                            {chartData.map((entry, i) => (
                                <Cell
                                    key={`${entry.category}-${i}`}
                                    fill={entry.fill}
                                    opacity={focusedCategory && !entry.isFocused ? 0.2 : 0.9}
                                    style={{ transition: "opacity 200ms ease, fill 200ms ease" }}
                                />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>

                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-lg font-bold leading-none tabular-nums">
                            {focusedSegment ? focusedSegment.count : total}
                        </p>
                        <p className="mt-0.5 max-w-20 truncate text-[9px] text-muted-foreground">
                            {focusedSegment ? focusedSegment.category : "total"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Interactive Legend with proportional bars */}
            <div className="max-h-44 space-y-0.5 overflow-y-auto px-3 pb-3">
                {segments.map((seg) => {
                    const barWidth = Math.max(6, (seg.count / (segments[0]?.count || 1)) * 100);
                    const isActive = focusedCategory === seg.category;
                    const isDimmed = focusedCategory !== null && !isActive;

                    return (
                        <button
                            key={seg.category}
                            type="button"
                            className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all duration-150 ${
                                isActive
                                    ? "bg-primary/8 ring-1 ring-primary/20"
                                    : isDimmed
                                      ? "opacity-40 hover:opacity-70"
                                      : "hover:bg-accent/40"
                            }`}
                            onClick={() => handleLegendClick(seg.category)}
                        >
                            <span
                                className="size-2 shrink-0 rounded-full ring-1 ring-white/20 transition-transform group-hover:scale-125"
                                style={{ backgroundColor: seg.color }}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="truncate text-[11px] font-medium leading-tight">
                                        {seg.category}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                        {seg.count}
                                        <span className="ml-0.5 text-[9px] opacity-60">
                                            ({seg.percent}%)
                                        </span>
                                    </span>
                                </div>
                                {/* Proportional bar */}
                                <div className="mt-0.5 h-1 w-full rounded-full bg-muted/40">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{
                                            width: `${barWidth}%`,
                                            backgroundColor: seg.color,
                                            opacity: isDimmed ? 0.3 : 0.75,
                                        }}
                                    />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Footer hint */}
            {focusedCategory && (
                <div className="border-t border-border/30 px-3 py-1.5 text-center">
                    <button
                        type="button"
                        className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setFocusedCategory(null)}
                    >
                        Clic para mostrar todas
                    </button>
                </div>
            )}
        </MapPopup>
    );
}
