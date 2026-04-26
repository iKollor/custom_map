"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart } from "recharts";

import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@workspace/ui/components/chart";

import { chartConfigFromSegments, segmentPercent } from "./helpers";

// ============================================================================
// ClusterPieMarkerChart — Pie rendered inside each cluster HTML marker
// ============================================================================

export function ClusterPieMarkerChart({
    radius,
    total,
    showPercent,
    segments,
}: {
    radius: number;
    total: number;
    showPercent: boolean;
    segments: Array<{ color: string; count: number; label?: string }>;
}) {
    const size = radius * 2;
    const outerRadius = Math.max(8, radius - 2);
    const innerRadius = Math.max(12, radius * 0.45);
    const labelFontSize = Math.max(11, Math.round(radius * 0.5));

    const chartConfig = useMemo<ChartConfig>(
        () =>
            chartConfigFromSegments(segments, {
                value: { label: showPercent ? "Porcentaje" : "Cantidad" },
            }),
        [segments, showPercent],
    );

    const data = useMemo(
        () =>
            segments.map((segment) => ({
                category: segment.label ?? "Categoria",
                value: segment.count,
                percent: segmentPercent(segment.count, total),
                fill: segment.color,
            })),
        [segments, total],
    );

    return (
        <div
            className="relative flex items-center justify-center opacity-95 transition-transform hover:scale-105"
            style={{ width: size, height: size, overflow: "visible" }}
        >
            {/* Center background circle for the text */}
            <div 
                className="absolute rounded-full bg-background shadow-sm"
                style={{ width: innerRadius * 2 + 1, height: innerRadius * 2 + 1 }}
            />
            {/* Center total text */}
            <span 
                className="absolute z-10 font-bold text-foreground pointer-events-none tabular-nums tracking-tighter"
                style={{ fontSize: labelFontSize }}
            >
                {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
            </span>

            <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square h-full w-full overflow-visible [&_.recharts-text]:fill-background [&_.recharts-wrapper]:overflow-visible! [&_.recharts-surface]:overflow-visible"
            >
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <ChartTooltip
                        cursor={false}
                        allowEscapeViewBox={{ x: true, y: true }}
                        isAnimationActive={false}
                        wrapperStyle={{
                            zIndex: 50,
                            pointerEvents: "none",
                            transform: "translate(-50%, 0)",
                            left: "50%",
                            top: size + 16,
                            transition: "none",
                        }}
                        content={
                            <ChartTooltipContent
                                nameKey="value"
                                hideLabel
                                className="min-w-48 px-3 py-2 text-[12px] shadow-lg"
                            />
                        }
                    />
                    <Pie
                        data={data}
                        dataKey="value"
                        nameKey="category"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        strokeWidth={1.5}
                        stroke="hsl(var(--background))"
                        fillOpacity={0.9}
                        paddingAngle={data.length > 1 ? 1 : 0}
                        isAnimationActive={false}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`${entry.category}-${index}`} fill={entry.fill} />
                        ))}
                    </Pie>
                </PieChart>
            </ChartContainer>
        </div>
    );
}
