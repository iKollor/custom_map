"use client";

import MapLibreGL, { type MarkerOptions, type PopupOptions } from "maplibre-gl";
import {
    createContext,
    useContext,
    useEffect,
    useEffectEvent,
    useMemo,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@workspace/ui/lib/utils";

import { useMap } from "./core";
import { PopupCloseButton } from "./popup";

type MarkerContextValue = {
    marker: MapLibreGL.Marker;
    map: MapLibreGL.Map | null;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarkerContext() {
    const context = useContext(MarkerContext);
    if (!context) {
        throw new Error("Marker components must be used within MapMarker");
    }
    return context;
}

type MapMarkerProps = {
    longitude: number;
    latitude: number;
    children: ReactNode;
    onClick?: (e: MouseEvent) => void;
    onContextMenu?: (e: MouseEvent) => void;
    onPointerDown?: (e: PointerEvent) => void;
    onPointerUp?: (e: PointerEvent) => void;
    onPointerCancel?: (e: PointerEvent) => void;
    onMouseEnter?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onDragStart?: (lngLat: { lng: number; lat: number }) => void;
    onDrag?: (lngLat: { lng: number; lat: number }) => void;
    onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

function MapMarker({
    longitude,
    latitude,
    children,
    onClick,
    onContextMenu,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onMouseEnter,
    onMouseLeave,
    onDragStart,
    onDrag,
    onDragEnd,
    draggable = false,
    ...markerOptions
}: MapMarkerProps) {
    const { map } = useMap();

    // useEffectEvent evita re-subscribirse cuando cambian los callbacks props.
    const handleClick = useEffectEvent((e: MouseEvent) => onClick?.(e));
    const handleContextMenu = useEffectEvent((e: MouseEvent) =>
        onContextMenu?.(e),
    );
    const handlePointerDown = useEffectEvent((e: PointerEvent) =>
        onPointerDown?.(e),
    );
    const handlePointerUp = useEffectEvent((e: PointerEvent) =>
        onPointerUp?.(e),
    );
    const handlePointerCancel = useEffectEvent((e: PointerEvent) =>
        onPointerCancel?.(e),
    );
    const handleMouseEnter = useEffectEvent((e: MouseEvent) =>
        onMouseEnter?.(e),
    );
    const handleMouseLeave = useEffectEvent((e: MouseEvent) =>
        onMouseLeave?.(e),
    );
    const handleDragStart = useEffectEvent(
        (lngLat: { lng: number; lat: number }) => onDragStart?.(lngLat),
    );
    const handleDrag = useEffectEvent((lngLat: { lng: number; lat: number }) =>
        onDrag?.(lngLat),
    );
    const handleDragEnd = useEffectEvent((lngLat: { lng: number; lat: number }) =>
        onDragEnd?.(lngLat),
    );

    const marker = useMemo(() => {
        return new MapLibreGL.Marker({
            ...markerOptions,
            element: document.createElement("div"),
            draggable,
        }).setLngLat([longitude, latitude]);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!map) return;
        marker.addTo(map);
        return () => {
            marker.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        const element = marker.getElement();
        const emitDrag = (fn: (p: { lng: number; lat: number }) => void) => () => {
            const { lng, lat } = marker.getLngLat();
            fn({ lng, lat });
        };
        const onDragStartInternal = emitDrag(handleDragStart);
        const onDragInternal = emitDrag(handleDrag);
        const onDragEndInternal = emitDrag(handleDragEnd);

        element?.addEventListener("click", handleClick);
        element?.addEventListener("contextmenu", handleContextMenu);
        element?.addEventListener("pointerdown", handlePointerDown);
        element?.addEventListener("pointerup", handlePointerUp);
        element?.addEventListener("pointercancel", handlePointerCancel);
        element?.addEventListener("mouseenter", handleMouseEnter);
        element?.addEventListener("mouseleave", handleMouseLeave);
        marker.on("dragstart", onDragStartInternal);
        marker.on("drag", onDragInternal);
        marker.on("dragend", onDragEndInternal);

        return () => {
            element?.removeEventListener("click", handleClick);
            element?.removeEventListener("contextmenu", handleContextMenu);
            element?.removeEventListener("pointerdown", handlePointerDown);
            element?.removeEventListener("pointerup", handlePointerUp);
            element?.removeEventListener("pointercancel", handlePointerCancel);
            element?.removeEventListener("mouseenter", handleMouseEnter);
            element?.removeEventListener("mouseleave", handleMouseLeave);
            marker.off("dragstart", onDragStartInternal);
            marker.off("drag", onDragInternal);
            marker.off("dragend", onDragEndInternal);
        };
    }, [marker]);

    if (
        marker.getLngLat().lng !== longitude ||
        marker.getLngLat().lat !== latitude
    ) {
        marker.setLngLat([longitude, latitude]);
    }
    if (marker.isDraggable() !== draggable) {
        marker.setDraggable(draggable);
    }

    const currentOffset = marker.getOffset();
    const newOffset = markerOptions.offset ?? [0, 0];
    const [newOffsetX, newOffsetY] = Array.isArray(newOffset)
        ? newOffset
        : [newOffset.x, newOffset.y];
    if (currentOffset.x !== newOffsetX || currentOffset.y !== newOffsetY) {
        marker.setOffset(newOffset);
    }

    if (marker.getRotation() !== markerOptions.rotation) {
        marker.setRotation(markerOptions.rotation ?? 0);
    }
    if (marker.getRotationAlignment() !== markerOptions.rotationAlignment) {
        marker.setRotationAlignment(markerOptions.rotationAlignment ?? "auto");
    }
    if (marker.getPitchAlignment() !== markerOptions.pitchAlignment) {
        marker.setPitchAlignment(markerOptions.pitchAlignment ?? "auto");
    }

    return (
        <MarkerContext.Provider value={{ marker, map }}>
            {children}
        </MarkerContext.Provider>
    );
}

type MarkerContentProps = {
    children?: ReactNode;
    className?: string;
};

function MarkerContent({ children, className }: MarkerContentProps) {
    const { marker } = useMarkerContext();

    return createPortal(
        <div className={cn("relative cursor-pointer", className)}>
            {children || <DefaultMarkerIcon />}
        </div>,
        marker.getElement(),
    );
}

function DefaultMarkerIcon() {
    return (
        <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
    );
}

type MarkerPopupProps = {
    children: ReactNode;
    className?: string;
    closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

function MarkerPopup({
    children,
    className,
    closeButton = false,
    ...popupOptions
}: MarkerPopupProps) {
    const { marker, map } = useMarkerContext();
    const container = useMemo(() => document.createElement("div"), []);

    const popup = useMemo(() => {
        const popupInstance = new MapLibreGL.Popup({
            offset: 16,
            ...popupOptions,
            closeButton: false,
        })
            .setMaxWidth("none")
            .setDOMContent(container);

        return popupInstance;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!map) return;

        popup.setDOMContent(container);
        marker.setPopup(popup);

        return () => {
            marker.setPopup(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        popup.setOffset(popupOptions.offset ?? 16);
        if (popupOptions.maxWidth) {
            popup.setMaxWidth(popupOptions.maxWidth ?? "none");
        }
    }, [popup, popupOptions.offset, popupOptions.maxWidth]);

    const handleClose = () => popup.remove();

    return createPortal(
        <div
            className={cn(
                "bg-popover text-popover-foreground relative max-w-62 rounded-md border p-3 shadow-md",
                "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
                className,
            )}
        >
            {closeButton && <PopupCloseButton onClick={handleClose} />}
            {children}
        </div>,
        container,
    );
}

type MarkerTooltipProps = {
    children: ReactNode;
    className?: string;
} & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">;

function MarkerTooltip({
    children,
    className,
    ...popupOptions
}: MarkerTooltipProps) {
    const { marker, map } = useMarkerContext();
    const container = useMemo(() => document.createElement("div"), []);

    const tooltip = useMemo(() => {
        const tooltipInstance = new MapLibreGL.Popup({
            offset: 16,
            anchor: "bottom",
            ...popupOptions,
            closeOnClick: true,
            closeButton: false,
            // Disable pointer events on the whole MapLibre popup wrapper so
            // the tooltip does not steal hover events from the marker (which
            // would cause a flicker loop between mouseenter/mouseleave).
            className: "maplibregl-popup-tooltip pointer-events-none",
        }).setMaxWidth("none");

        return tooltipInstance;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!map) return;

        tooltip.setDOMContent(container);
        const markerElement = marker.getElement();
        const supportsHover =
            typeof window !== "undefined" &&
            window.matchMedia("(hover: hover) and (pointer: fine)").matches;

        const handleMouseEnter = () => {
            if (!supportsHover) return;
            tooltip.setLngLat(marker.getLngLat()).addTo(map);
        };
        const handleMouseLeave = () => tooltip.remove();
        const handleMarkerClick = () => tooltip.remove();
        const handleMapInteraction = () => tooltip.remove();
        const handleDocumentInteraction = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (markerElement?.contains(target)) return;
            tooltip.remove();
        };

        if (supportsHover) {
            markerElement?.addEventListener("mouseenter", handleMouseEnter);
            markerElement?.addEventListener("mouseleave", handleMouseLeave);
        }
        markerElement?.addEventListener("click", handleMarkerClick);
        map.on("click", handleMapInteraction);
        map.on("touchstart", handleMapInteraction);
        map.on("dragstart", handleMapInteraction);
        map.on("movestart", handleMapInteraction);
        map.on("zoomstart", handleMapInteraction);
        map.on("rotatestart", handleMapInteraction);
        map.on("pitchstart", handleMapInteraction);
        document.addEventListener("pointerdown", handleDocumentInteraction, true);
        document.addEventListener("mousedown", handleDocumentInteraction, true);
        document.addEventListener("touchstart", handleDocumentInteraction, true);
        document.addEventListener("click", handleDocumentInteraction, true);
        window.addEventListener("blur", handleMapInteraction);

        return () => {
            if (supportsHover) {
                markerElement?.removeEventListener("mouseenter", handleMouseEnter);
                markerElement?.removeEventListener("mouseleave", handleMouseLeave);
            }
            markerElement?.removeEventListener("click", handleMarkerClick);
            map.off("click", handleMapInteraction);
            map.off("touchstart", handleMapInteraction);
            map.off("dragstart", handleMapInteraction);
            map.off("movestart", handleMapInteraction);
            map.off("zoomstart", handleMapInteraction);
            map.off("rotatestart", handleMapInteraction);
            map.off("pitchstart", handleMapInteraction);
            document.removeEventListener("pointerdown", handleDocumentInteraction, true);
            document.removeEventListener("mousedown", handleDocumentInteraction, true);
            document.removeEventListener("touchstart", handleDocumentInteraction, true);
            document.removeEventListener("click", handleDocumentInteraction, true);
            window.removeEventListener("blur", handleMapInteraction);
            tooltip.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        tooltip.setOffset(popupOptions.offset ?? 16);
        if (popupOptions.maxWidth) {
            tooltip.setMaxWidth(popupOptions.maxWidth ?? "none");
        }
    }, [tooltip, popupOptions.offset, popupOptions.maxWidth]);

    return createPortal(
        <div
            className={cn(
                "bg-popover text-popover-foreground pointer-events-none rounded-md border px-2.5 py-1.5 text-xs text-balance shadow-md",
                "animate-in fade-in-0 zoom-in-95 duration-200 ease-out",
                className,
            )}
        >
            {children}
        </div>,
        container,
    );
}

type MarkerLabelProps = {
    children: ReactNode;
    className?: string;
    position?: "top" | "bottom";
};

function MarkerLabel({
    children,
    className,
    position = "top",
}: MarkerLabelProps) {
    const positionClasses = {
        top: "bottom-full mb-1",
        bottom: "top-full mt-1",
    };

    return (
        <div
            className={cn(
                "absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
                "text-foreground text-[10px] font-medium",
                positionClasses[position],
                className,
            )}
        >
            {children}
        </div>
    );
}

export {
    MapMarker,
    MarkerContent,
    MarkerPopup,
    MarkerTooltip,
    MarkerLabel,
};
