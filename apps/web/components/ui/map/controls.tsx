"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Locate, Maximize, Minus, Plus, Layers, Search } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";

import { useMap } from "./core";

type MapControlsProps = {
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    showZoom?: boolean;
    showCompass?: boolean;
    showLocate?: boolean;
    showSearch?: boolean;
    showFullscreen?: boolean;
    showSatellite?: boolean;
    isSatellite?: boolean;
    onToggleSatellite?: () => void;
    className?: string;
    onLocate?: (coords: { longitude: number; latitude: number }) => void;
};

const positionClasses = {
    "top-left": "top-2 left-2",
    "top-right": "top-2 right-2",
    "bottom-left": "bottom-2 left-2",
    "bottom-right": "right-2 bottom-[max(env(safe-area-inset-bottom,0px),2.5rem)]",
};

function ControlGroup({ children }: { children: React.ReactNode }) {
    return (
        <div className="border-border bg-background [&>button:not(:last-child)]:border-border flex flex-col overflow-hidden rounded-md border shadow-sm [&>button:not(:last-child)]:border-b">
            {children}
        </div>
    );
}

function ControlButton({
    onClick,
    label,
    children,
    disabled = false,
}: {
    onClick: () => void;
    label: string;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            type="button"
            className={cn(
                "flex size-8 items-center justify-center transition-all",
                "first:rounded-t-md last:rounded-b-md",
                "hover:bg-accent dark:hover:bg-accent/40",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                "disabled:pointer-events-none disabled:opacity-50",
            )}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

function MapControls({
    position = "bottom-right",
    showZoom = true,
    showCompass = false,
    showLocate = false,
    showSearch = false,
    showFullscreen = false,
    showSatellite = false,
    isSatellite = false,
    onToggleSatellite,
    className,
    onLocate,
}: MapControlsProps) {
    const { map } = useMap();
    const [waitingForLocation, setWaitingForLocation] = useState(false);
    const [searchingPlace, setSearchingPlace] = useState(false);

    const handleZoomIn = useCallback(() => {
        map?.zoomTo(map.getZoom() + 1, { duration: 300 });
    }, [map]);

    const handleZoomOut = useCallback(() => {
        map?.zoomTo(map.getZoom() - 1, { duration: 300 });
    }, [map]);

    const handleResetBearing = useCallback(() => {
        map?.resetNorthPitch({ duration: 300 });
    }, [map]);

    const handleLocate = useCallback(() => {
        setWaitingForLocation(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const coords = {
                        longitude: pos.coords.longitude,
                        latitude: pos.coords.latitude,
                    };
                    map?.flyTo({
                        center: [coords.longitude, coords.latitude],
                        zoom: 14,
                        duration: 1500,
                    });
                    onLocate?.(coords);
                    setWaitingForLocation(false);
                },
                (error) => {
                    console.error("Error getting location:", error);
                    setWaitingForLocation(false);
                },
            );
        }
    }, [map, onLocate]);

    const handleFullscreen = useCallback(() => {
        const container = map?.getContainer();
        if (!container) return;
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }, [map]);

    const handleSearch = useCallback(async () => {
        const term = window.prompt("Buscar lugar o dirección");
        if (!term || !term.trim()) return;

        setSearchingPlace(true);
        try {
            const response = await fetch(
                `/api/geocode?q=${encodeURIComponent(term.trim())}`
            );

            if (!response.ok) {
                throw new Error(`Search request failed (${response.status})`);
            }

            const results = (await response.json()) as Array<{ lon: string; lat: string }>;
            const first = results[0];
            if (!first) {
                window.alert("No se encontraron resultados para la búsqueda.");
                return;
            }

            const lng = Number.parseFloat(first.lon);
            const lat = Number.parseFloat(first.lat);
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                window.alert("La ubicación encontrada no es válida.");
                return;
            }

            map?.flyTo({
                center: [lng, lat],
                zoom: Math.max(map.getZoom(), 14),
                duration: 1200,
            });
        } catch (error) {
            console.error("Error searching location:", error);
            window.alert("No se pudo completar la búsqueda. Inténtalo de nuevo.");
        } finally {
            setSearchingPlace(false);
        }
    }, [map]);

    return (
        <div
            className={cn(
                "absolute z-10 flex flex-col gap-1.5",
                positionClasses[position],
                className,
            )}
        >
            {showZoom && (
                <ControlGroup>
                    <ControlButton onClick={handleZoomIn} label="Zoom in">
                        <Plus className="size-4" />
                    </ControlButton>
                    <ControlButton onClick={handleZoomOut} label="Zoom out">
                        <Minus className="size-4" />
                    </ControlButton>
                </ControlGroup>
            )}
            {showCompass && (
                <ControlGroup>
                    <CompassButton onClick={handleResetBearing} />
                </ControlGroup>
            )}
            {showLocate && (
                <ControlGroup>
                    <ControlButton
                        onClick={handleLocate}
                        label="Find my location"
                        disabled={waitingForLocation}
                    >
                        {waitingForLocation ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Locate className="size-4" />
                        )}
                    </ControlButton>
                </ControlGroup>
            )}
            {showSearch && (
                <ControlGroup>
                    <ControlButton
                        onClick={() => {
                            void handleSearch();
                        }}
                        label="Search place"
                        disabled={searchingPlace}
                    >
                        {searchingPlace ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Search className="size-4" />
                        )}
                    </ControlButton>
                </ControlGroup>
            )}
            {showFullscreen && (
                <ControlGroup>
                    <ControlButton onClick={handleFullscreen} label="Toggle fullscreen">
                        <Maximize className="size-4" />
                    </ControlButton>
                </ControlGroup>
            )}
            {showSatellite && (
                <ControlGroup>
                    <ControlButton
                        onClick={() => onToggleSatellite?.()}
                        label={
                            isSatellite ? "Switch to street map" : "Switch to satellite map"
                        }
                        disabled={!onToggleSatellite}
                    >
                        <Layers
                            className={cn(
                                "size-4",
                                isSatellite && "text-sky-600 dark:text-sky-400",
                            )}
                        />
                    </ControlButton>
                </ControlGroup>
            )}
        </div>
    );
}

function CompassButton({ onClick }: { onClick: () => void }) {
    const { map } = useMap();
    const compassRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!map || !compassRef.current) return;

        const compass = compassRef.current;

        const updateRotation = () => {
            const bearing = map.getBearing();
            const pitch = map.getPitch();
            compass.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`;
        };

        map.on("rotate", updateRotation);
        map.on("pitch", updateRotation);
        updateRotation();

        return () => {
            map.off("rotate", updateRotation);
            map.off("pitch", updateRotation);
        };
    }, [map]);

    return (
        <ControlButton onClick={onClick} label="Reset bearing to north">
            <svg
                ref={compassRef}
                viewBox="0 0 24 24"
                className="size-5 transition-transform duration-200"
                style={{ transformStyle: "preserve-3d" }}
            >
                <path d="M12 2L16 12H12V2Z" className="fill-red-500" />
                <path d="M12 2L8 12H12V2Z" className="fill-red-300" />
                <path d="M12 22L16 12H12V22Z" className="fill-muted-foreground/60" />
                <path d="M12 22L8 12H12V22Z" className="fill-muted-foreground/30" />
            </svg>
        </ControlButton>
    );
}

export { MapControls };
