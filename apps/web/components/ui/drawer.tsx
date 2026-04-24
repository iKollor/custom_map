"use client"

import * as React from "react"
import { Dialog as DrawerPrimitive } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

type DrawerContextValue = {
  onOpenChange?: (open: boolean) => void
}

const DrawerContext = React.createContext<DrawerContextValue>({})

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const { onOpenChange, ...rest } = props

  return (
    <DrawerContext.Provider value={{ onOpenChange }}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        onOpenChange={onOpenChange}
        {...rest}
      />
    </DrawerContext.Provider>
  )
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn("fixed inset-0 z-50 bg-black/40", className)}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  const { onOpenChange } = React.useContext(DrawerContext)
  const [dragOffsetY, setDragOffsetY] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const dragStartYRef = React.useRef<number | null>(null)

  const closeByGesture = React.useCallback(() => {
    onOpenChange?.(false)
  }, [onOpenChange])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStartYRef.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return
    const delta = Math.max(0, event.clientY - dragStartYRef.current)
    setDragOffsetY(delta)
  }

  const handlePointerEnd = () => {
    const shouldClose = dragOffsetY >= 80
    dragStartYRef.current = null
    setDragging(false)
    setDragOffsetY(0)
    if (shouldClose) closeByGesture()
  }

  return (
    <DrawerPortal>
      <DrawerPrimitive.Close asChild>
        <DrawerOverlay />
      </DrawerPrimitive.Close>
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-2xl border bg-background shadow-lg data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-8 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-8",
          className,
        )}
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragging ? "none" : undefined,
        }}
        {...props}
      >
        <div
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          style={{ touchAction: "none" }}
        />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
