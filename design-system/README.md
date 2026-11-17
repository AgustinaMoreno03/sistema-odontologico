# Design system — Sistema de Gestión Odontológica

Mode: deferred
Approval: deferred
Decision source: Active Orchestrator foundation — usuario, 2026-11-17

## Estado

El MVP es **backend** (API + lógica de dominio); el frontend en TypeScript
vanilla queda para cuando haya un primer change visual. La política visual
(`system-and-mockups` / `system-only` / `off`) se define en ese momento —
`deferred` no es un opt-out permanente: en el primer change visual, el usuario
elige una de las tres opciones duraderas y este archivo se actualiza.

## Instrucciones de reemplazo

Cuando llegue el primer change visual:

1. Correr la skill `design-system` (o `/active-orchestrator:design`).
2. Presentar las opciones `system-and-mockups` / `system-only` / `off` y
   actualizar `Mode:` y `Approval:` acá, más la sección `visual_design` de
   `.active-orchestrator-state.json`.
3. Recién ahí crear `brand.md`, `brand.js`, `tokens.css`, `components.html` y
   `assets/` si la opción elegida los requiere.
