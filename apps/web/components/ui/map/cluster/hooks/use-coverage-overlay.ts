"use client";

import MapLibreGL from "maplibre-gl";
import { useEffect } from "react";

import { CLUSTER_DEFAULTS } from "../../constants";
import { useMap } from "../../core";
import { buildConvexHull } from "../../utils";

import type { ClusterLayerIds, MapClusterLayerProps } from "../types";

/**
 * Computes a convex-hull polygon per visible cluster and renders it as a
 * coloured fill + outline, tinted by the cluster's dominant category.
 */
export function useCoverageOverlay<
    P extends GeoJSON.GeoJsonProperties = GeoJSON.GeoJsonProperties,
>(
    ids: ClusterLayerIds,
    opts: {
        coverageEnabled: boolean;
        coverageOverlayOptions: MapClusterLayerProps<P>["coverageOverlayOptions"];
        pieOptions: MapClusterLayerProps<P>["pieOptions"];
        pointColor: string;
    },
) {
    const { map, isLoaded } = useMap();
    const { sourceId, coverageSourceId } = ids;
    const { coverageEnabled, coverageOverlayOptions, pieOptions, pointColor } = opts;

    useEffect(() => {
        if (!isLoaded || !map || !coverageEnabled || !pieOptions) return;

        const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined;
        const coverageSource = map.getSource(coverageSourceId) as MapLibreGL.GeoJSONSource | undefined;
        if (!source || !coverageSource) return;

        let cancelled = false;
        const maxLeaves =
            coverageOverlayOptions?.maxLeavesPerCluster ?? CLUSTER_DEFAULTS.coverageMaxLeaves;

        const getLeaves = (clusterId: number) =>
            source.getClusterLeaves(clusterId, maxLeaves, 0) as Promise<MapLibreGL.MapGeoJSONFeature[]>;

        const refreshCoverage = async () => {
            if (!map.getSource(sourceId) || !map.getSource(coverageSourceId)) return;

            const clusterFeatures = map
                .querySourceFeatures(sourceId)
                .filter((f) => f.properties?.cluster);

            const seen = new Set<number>();
            const overlays: GeoJSON.Feature<GeoJSON.Polygon, { overlayColor: string }>[] = [];

            for (const cf of clusterFeatures) {
                const clusterId = Number(cf.properties?.cluster_id ?? NaN);
                const pointCount = Number(cf.properties?.point_count ?? 0);
                if (!Number.isFinite(clusterId) || pointCount < 3 || seen.has(clusterId)) continue;
                seen.add(clusterId);

                let leaves: MapLibreGL.MapGeoJSONFeature[];
                try {
                    leaves = await getLeaves(clusterId);
                } catch {
                    continue;
                }
                if (cancelled || leaves.length < 3) continue;

                const points = leaves
                    .map((l) => (l.geometry as GeoJSON.Point).coordinates as [number, number])
                    .filter((c) => Array.isArray(c) && c.length === 2);
                if (points.length < 3) continue;

                const counts = new globalThis.Map<string, number>();
                for (const leaf of leaves) {
                    const cat = String(leaf.properties?.[pieOptions.categoryProperty] ?? "").trim();
                    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
                }

                let dominantCat = "";
                let dominantN = -1;
                for (const [cat, n] of counts) {
                    if (n > dominantN) { dominantCat = cat; dominantN = n; }
                }

                const color =
                    pieOptions.categoryColors[dominantCat] ??
                    String(leaves[0]?.properties?.[pieOptions.colorProperty] ?? pointColor);

                const hull = buildConvexHull(points);
                if (hull.length < 3) continue;

                const first = hull[0];
                const ring = first ? [...hull, first] : hull;

                overlays.push({
                    type: "Feature",
                    properties: { overlayColor: color },
                    geometry: { type: "Polygon", coordinates: [ring] },
                });
            }

            if (!cancelled) {
                coverageSource.setData({ type: "FeatureCollection", features: overlays });
            }
        };

        const handleRefresh = () => void refreshCoverage();

        map.on("moveend", handleRefresh);
        map.on("zoomend", handleRefresh);
        map.on("sourcedata", handleRefresh);
        handleRefresh();

        return () => {
            cancelled = true;
            map.off("moveend", handleRefresh);
            map.off("zoomend", handleRefresh);
            map.off("sourcedata", handleRefresh);
        };
    }, [
        isLoaded,
        map,
        coverageEnabled,
        coverageOverlayOptions?.maxLeavesPerCluster,
        sourceId,
        coverageSourceId,
        pieOptions,
        pointColor,
    ]);
}
