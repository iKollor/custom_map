"use client";

import { useMemo } from "react";
import { Cell, LabelList, Pie, PieChart } from "recharts";

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
    const labelFontSize = Math.max(9, Math.round(radius * 0.32));

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
            className="relative flex items-center justify-center opacity-85"
            style={{ width: size, height: size, overflow: "visible" }}
        >
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
                        outerRadius={outerRadius}
                        strokeWidth={1.5}
                        stroke="#ffffff"
                        fillOpacity={0.85}
                        isAnimationActive={false}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`${entry.category}-${index}`} fill={entry.fill} />
                        ))}
                        <LabelList
                            dataKey={showPercent ? "percent" : "value"}
                            className="fill-background"
                            stroke="none"
                            fontSize={labelFontSize}
                            fontWeight={600}
                            style={{ pointerEvents: "none" }}
                            formatter={(value) =>
                                showPercent ? `${value}%` : `${value}`
                            }
                        />
                    </Pie>
                </PieChart>
            </ChartContainer>
        </div>
    );
}
