# Design Agent Guide

## Objetivo
Mantener una UI consistente en todo el workspace usando componentes del ecosistema shadcn y, cuando corresponda, componentes del registry animate-ui.

## Regla Principal
Antes de crear UI custom, reutiliza componentes existentes de `@workspace/ui/components`.

## Stack UI Oficial
- Base components: shadcn (paquete compartido `packages/ui`)
- Primitive layer: radix-ui
- Iconos: lucide-react
- Estilos: Tailwind + tokens (variables CSS)
- Helpers: `cn` desde `@workspace/ui/lib/utils`

## Rutas y Convenciones
- Componentes compartidos: `packages/ui/src/components`
- Import recomendado desde apps:
  - `@workspace/ui/components/button`
  - `@workspace/ui/components/card`
  - `@workspace/ui/components/dialog`
  - etc.
- Evitar duplicar componentes visuales dentro de `apps/web/components` si no son realmente específicos de negocio.

## Componentes Prioritarios
Para formularios y paneles:
- `button`, `input`, `label`, `card`, `alert`, `dialog`, `dropdown-menu`, `checkbox`, `separator`

Para overlays y acciones:
- usar `Dialog` en lugar de modales creados con `div` + `fixed`
- usar `DropdownMenu` para menús de usuario/acciones

## Qué Evitar
- Botones con clases hardcodeadas repetidas en cada pantalla
- Inputs y labels nativos con estilos distintos por página
- Overlays manuales si ya existe `Dialog`
- Checkboxes dibujados a mano con `span` + `border`

## Motion y Microinteracción
- Usar animaciones cortas y funcionales (`animate-in`, `fade-in`, `zoom-in`)
- Evitar animaciones largas o decorativas que afecten rendimiento
- Mantener transiciones de estado de foco/hover activas en componentes interactivos

## Accesibilidad
- Usar componentes radix/shadcn siempre que sea posible por soporte a11y integrado
- Mantener `aria-label` en icon-only buttons
- No romper estados de `focus-visible`

## Animate-UI Registry
Estado actual:
- El registry `@animate-ui` está configurado en `apps/web/components.json`.
- Para componentes compartidos conviene configurarlo tambien en `packages/ui/components.json` para poder instalarlos directamente en el paquete `@workspace/ui`.

Recomendacion de flujo:
1. Ejecutar comandos de shadcn desde `packages/ui`.
2. Agregar componente al paquete compartido.
3. Consumirlo desde apps con imports `@workspace/ui/components/*`.

## Checklist Antes de Merge
- Se reutilizaron componentes compartidos (`@workspace/ui/components/*`)
- No hay UI duplicada innecesaria
- Estados disabled/hover/focus funcionan
- No hay estilos inline evitables
- La vista funciona en desktop y mobile
