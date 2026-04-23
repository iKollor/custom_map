"use client";

import MapLibreGL from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
    createContext,
    forwardRef,
    useCallback,
    useContext,
    useEffect,
    useEffectEvent,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { cn } from "@workspace/ui/lib/utils";

import { DEFAULT_BASEMAPS } from "./constants";

// ============================================================================
// Theme helpers, MapContext/useMap y el componente Map.
// ============================================================================

type Theme = "light" | "dark";

// Check document class for theme (works with next-themes, etc.)
// Returns "light" as the default when no explicit class is set.
function getDocumentTheme(): Theme {
    if (typeof document === "undefined") return "light";
    if (document.documentElement.classList.contains("dark")) return "dark";
    return "light";
}

function useResolvedTheme(themeProp?: "light" | "dark"): Theme {
    const [detectedTheme, setDetectedTheme] = useState<Theme>(
        () => getDocumentTheme(),
    );

    useEffect(() => {
        if (themeProp) return; // Skip detection if theme is provided via prop

        const observer = new MutationObserver(() => {
            setDetectedTheme(getDocumentTheme());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        // `getDocumentTheme()` siempre devuelve un valor truthy, por lo que
        // el fallback a `matchMedia` sólo aplica si el <html> no tiene la
        // clase `dark` explícita. En la práctica la clase siempre gana; se
        // mantiene el listener sólo para re-render cuando cambie la pref.
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemChange = () => setDetectedTheme(getDocumentTheme());
        mediaQuery.addEventListener("change", handleSystemChange);

        return () => {
            observer.disconnect();
            mediaQuery.removeEventListener("change", handleSystemChange);
        };
    }, [themeProp]);

    return themeProp ?? detectedTheme;
}

type MapContextValue = {
    map: MapLibreGL.Map | null;
    isLoaded: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

function useMap() {
    const context = useContext(MapContext);
    if (!context) {
        throw new Error("useMap must be used within a Map component");
    }
    return context;
}

/** Map viewport state */
type MapViewport = {
    /** Center coordinates [longitude, latitude] */
    center: [number, number];
    /** Zoom level */
    zoom: number;
    /** Bearing (rotation) in degrees */
    bearing: number;
    /** Pitch (tilt) in degrees */
    pitch: number;
};

type MapStyleOption = string | MapLibreGL.StyleSpecification;

type MapRef = MapLibreGL.Map;

type MapProps = {
    children?: ReactNode;
    className?: string;
    theme?: Theme;
    styles?: {
        light?: MapStyleOption;
        dark?: MapStyleOption;
    };
    projection?: MapLibreGL.ProjectionSpecification;
    viewport?: Partial<MapViewport>;
    onViewportChange?: (viewport: MapViewport) => void;
    loading?: boolean;
} & Omit<MapLibreGL.MapOptions, "container" | "style">;

function DefaultLoader() {
    return (
        <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-xs">
            <div className="flex gap-1">
                <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full" />
                <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
                <span className="bg-muted-foreground/60 size-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
            </div>
        </div>
    );
}

function getViewport(map: MapLibreGL.Map): MapViewport {
    const center = map.getCenter();
    return {
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
    };
}

const Map = forwardRef<MapRef, MapProps>(function Map(
    {
        children,
        className,
        theme: themeProp,
        styles,
        projection,
        viewport,
        onViewportChange,
        loading = false,
        ...props
    },
    ref,
) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<MapLibreGL.Map | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isStyleLoaded, setIsStyleLoaded] = useState(false);
    const currentStyleRef = useRef<MapStyleOption | null>(null);
    const styleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const internalUpdateRef = useRef(false);
    const resolvedTheme = useResolvedTheme(themeProp);

    const isControlled = viewport !== undefined && onViewportChange !== undefined;

    const handleViewportChange = useEffectEvent((nextViewport: MapViewport) => {
        onViewportChange?.(nextViewport);
    });

    const mapStyles = useMemo(
        () => ({
            dark: styles?.dark ?? DEFAULT_BASEMAPS.dark,
            light: styles?.light ?? DEFAULT_BASEMAPS.light,
        }),
        [styles],
    );

    useImperativeHandle(ref, () => mapInstance as MapLibreGL.Map, [mapInstance]);

    const clearStyleTimeout = useCallback(() => {
        if (styleTimeoutRef.current) {
            clearTimeout(styleTimeoutRef.current);
            styleTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        const initialStyle =
            resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;
        currentStyleRef.current = initialStyle;

        const map = new MapLibreGL.Map({
            container: containerRef.current,
            style: initialStyle,
            renderWorldCopies: false,
            attributionControl: {
                compact: true,
            },
            ...props,
            ...viewport,
        });

        const styleDataHandler = () => {
            clearStyleTimeout();
            styleTimeoutRef.current = setTimeout(() => {
                setIsStyleLoaded(true);
                if (projection) {
                    map.setProjection(projection);
                }
            }, 100);
        };
        const loadHandler = () => setIsLoaded(true);

        const handleMove = () => {
            if (internalUpdateRef.current) return;
            handleViewportChange(getViewport(map));
        };

        map.on("load", loadHandler);
        map.on("styledata", styleDataHandler);
        map.on("move", handleMove);
        setMapInstance(map);

        return () => {
            clearStyleTimeout();
            map.off("load", loadHandler);
            map.off("styledata", styleDataHandler);
            map.off("move", handleMove);
            map.remove();
            setIsLoaded(false);
            setIsStyleLoaded(false);
            setMapInstance(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!mapInstance || !isControlled || !viewport) return;
        if (mapInstance.isMoving()) return;

        const current = getViewport(mapInstance);
        const next = {
            center: viewport.center ?? current.center,
            zoom: viewport.zoom ?? current.zoom,
            bearing: viewport.bearing ?? current.bearing,
            pitch: viewport.pitch ?? current.pitch,
        };

        if (
            next.center[0] === current.center[0] &&
            next.center[1] === current.center[1] &&
            next.zoom === current.zoom &&
            next.bearing === current.bearing &&
            next.pitch === current.pitch
        ) {
            return;
        }

        internalUpdateRef.current = true;
        mapInstance.jumpTo(next);
        internalUpdateRef.current = false;
    }, [mapInstance, isControlled, viewport]);

    useEffect(() => {
        if (!mapInstance || !resolvedTheme) return;

        const newStyle =
            resolvedTheme === "dark" ? mapStyles.dark : mapStyles.light;

        if (currentStyleRef.current === newStyle) return;

        clearStyleTimeout();
        currentStyleRef.current = newStyle;
        setIsStyleLoaded(false);

        mapInstance.setStyle(newStyle, { diff: true });
    }, [mapInstance, resolvedTheme, mapStyles, clearStyleTimeout]);

    const contextValue = useMemo(
        () => ({
            map: mapInstance,
            isLoaded: isLoaded && isStyleLoaded,
        }),
        [mapInstance, isLoaded, isStyleLoaded],
    );

    return (
        <MapContext.Provider value={contextValue}>
            <div
                ref={containerRef}
                className={cn("relative h-full w-full", className)}
            >
                {(!isLoaded || loading) && <DefaultLoader />}
                {mapInstance && children}
            </div>
        </MapContext.Provider>
    );
});

export { Map, useMap, MapContext };
export type { MapRef, MapViewport, MapStyleOption, MapProps, Theme };
