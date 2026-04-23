"use client";

import MapLibreGL, { type PopupOptions } from "maplibre-gl";
import { useEffect, useEffectEvent, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";

import { useMap } from "./core";

function PopupCloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="Close popup"
            className="focus-visible:ring-ring hover:bg-muted text-foreground absolute top-0.5 right-0.5 z-10 inline-flex size-5 cursor-pointer items-center justify-center rounded-sm transition-colors focus:outline-none focus-visible:ring-2"
        >
            <X className="size-3.5" />
        </button>
    );
}

type MapPopupProps = {
    /** Longitude coordinate for popup position */
    longitude: number;
    /** Latitude coordinate for popup position */
    latitude: number;
    /** Callback when popup is closed */
    onClose?: () => void;
    /** Popup content */
    children: React.ReactNode;
    /** Additional CSS classes for the popup content (inner card) */
    className?: string;
    /**
     * Additional CSS classes for the outer MapLibre popup wrapper
     * (`.maplibregl-popup`). Use this to set pointer behavior so the popup
     * itself does not steal mouse events from markers (prevents flicker).
     */
    wrapperClassName?: string;
    /** Show a close button in the popup (default: false) */
    closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

function MapPopup({
    longitude,
    latitude,
    onClose,
    children,
    className,
    wrapperClassName,
    closeButton = false,
    ...popupOptions
}: MapPopupProps) {
    const { map } = useMap();
    const container = useMemo(() => document.createElement("div"), []);
    const handleCloseEvent = useEffectEvent(() => onClose?.());

    const popup = useMemo(() => {
        const popupInstance = new MapLibreGL.Popup({
            offset: 16,
            ...popupOptions,
            closeButton: false,
            className: wrapperClassName,
        })
            .setMaxWidth("none")
            .setLngLat([longitude, latitude]);

        return popupInstance;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (wrapperClassName === undefined) return;
        popup.addClassName(wrapperClassName);
        return () => {
            popup.removeClassName(wrapperClassName);
        };
    }, [popup, wrapperClassName]);

    useEffect(() => {
        if (!map) return;

        const onCloseProp = () => handleCloseEvent();

        popup.on("close", onCloseProp);

        popup.setDOMContent(container);
        popup.addTo(map);

        return () => {
            popup.off("close", onCloseProp);
            if (popup.isOpen()) {
                popup.remove();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        popup.setLngLat([longitude, latitude]);
        popup.setOffset(popupOptions.offset ?? 16);
        if (popupOptions.maxWidth) {
            popup.setMaxWidth(popupOptions.maxWidth ?? "none");
        }
    }, [popup, longitude, latitude, popupOptions.offset, popupOptions.maxWidth]);

    const handleClose = () => {
        popup.remove();
    };

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

export { MapPopup, PopupCloseButton };
