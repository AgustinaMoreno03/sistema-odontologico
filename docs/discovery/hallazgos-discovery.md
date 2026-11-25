# Hallazgos de verificación — Informe de Discovery

> Revisión del `docs/discovery/informe-discovery.md` realizada el **2026-11-25** por verificación externa
> (apertura de fuentes citadas) antes de la entrega del jueves 2026-11-26. El informe **no se modificó**:
> cada hallazgo deja el texto original tal cual y propone el ajuste.

## Ajuste 1 — Precios de Dentalink no verificables en la URL citada

**(a) Original** (`docs/discovery/informe-discovery.md`, §4.1, fila *Dentalink*, línea 133):

> "Desde USD 35 / 50 / 75 por mes (Esencial/Pro/Titanium, Argentina, 1 profesional; con equipo: a cotizar). Chile: desde $35.000 CLP IVA incl."

Y su respaldo en §7.1, fuente #1 (línea 218):

> "**Verificada en la nota** (fetch de la página de planes, 2026-11-17). Precios "desde" para 1 profesional; con equipo: **(no público)**"

**(b) Motivo**: no verificable / contradicha. Al **2026-11-25** las páginas de planes citadas
(`https://www.softwaredentalink.com/ar/planes` y `https://www.softwaredentalink.com/cl/planes`) **no publican
ningún precio**: los tres planes muestran "Solicitá tu cotización" y la FAQ dice "los precios varían según las
necesidades". Además, la fuente #8 del propio informe (blog de Odonthia, relevamiento 09/10/2026) sostiene lo
contrario: Dentalink "**no publica precios**: los planes Esencial, Pro y Titanium se cotizan con ventas". No se
puede comprobar el fetch del 2026-11-17; la cifra carece de evidencia pública actual.

**(c) Corrección propuesta**: registrar la celda de precio de Dentalink como **«No evidenciado — la página de
planes no publica precios (cotización a pedido), verificado el 2026-11-25»**, o adjuntar al informe una
captura/archivo del 2026-11-17 que muestre USD 35/50/75 y CLP 35.000. Ajustar también la mención de §4.2
("la suite regional Dentalink desde USD 35/mes") y el resumen ejecutivo. **No inventar un reemplazo de URL.**

## Ajuste 2 — Precio de Odonthia no coincide con la fuente citada

**(a) Original** (`docs/discovery/informe-discovery.md`, §4.1, fila *Odonthia*, línea 139):

> "Gratis / ARS 74.500 / ARS 153.700 por mes con IVA (US$ 47 / 97 en el resto de LATAM); el plan gratis no vence (la IA y el WhatsApp automático se pagan)"

**(b) Motivo**: no coincide. La fuente citada para esa fila (fuente #8,
`https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026`, abierta el 2026-11-25) publica
"**Gratis / ARS 157.300 por mes, con IVA (US$ 97 en el resto de LATAM**)" — **un solo plan pago**, no dos, y
cifras distintas de las informadas (157.300 ≠ 153.700; no existe plan de ARS 74.500 ni US$ 47). El blog declara
"Actualizado el 9 de octubre de 2026", fecha **anterior** a la re-consulta del informe (2026-11-22), por lo que
la discrepancia no se explica por una actualización posterior. (Nota: `discovery/discovery.md` registra una
tercera cifra — ARS 20.900/46.900 — lo que refuerza que el dato no está estabilizado.)

**(c) Corrección propuesta**: alinear la fila con lo que la fuente publica al momento de citarla
(**ARS 157.300 con IVA / US$ 97, un plan pago**) o marcar el precio como **«No evidenciado»** y re-consultar la
página de precios oficial de Odonthia antes de usar cualquier cifra.

## Ajuste 3 — Rango "USD 25-35/mes" del resumen incluye a Dentaly sin fuente en USD

**(a) Original** (`docs/discovery/informe-discovery.md`, §1 Resumen ejecutivo, línea 15):

> "Frente a un mercado argentino fragmentado y barato (Dentaly, OCLÜ y Dentalink desde ~USD 25-35/mes; ...)"

**(b) Motivo**: no verificable. Ninguna fuente citada publica el precio de **Dentaly** en USD: el propio informe
lo registra en pesos (§4.1: "ARS 35.000/mes (Pro, 1 profesional), ARS 100.000/mes (Clínica)") y §7.1 (fuente #3)
reconoce que la página "devolvió contenido vacío (SPA Vite+React)" y solo se apoya en contenido indexado. La
conversión implícita a USD no está en ninguna fuente (no se declara tipo de cambio), y el rango agrupa a un
producto sin precio en USD como si lo tuviera.

**(c) Corrección propuesta**: en el resumen, citar a Dentaly en **ARS** (o excluirlo del rango USD) y/o marcar
el precio de Dentaly como **«No evidenciado»** hasta poder verificarlo en su página oficial; no presentar
conversiones sin fuente.

---

*Verificación externa propia del revisor: 9 URLs abiertas el 2026-11-25 (detalla en el reporte de revisión).
Esta verificación NO reemplaza la verificación personal que debe hacer el grupo (mínimo 5 fuentes, una de cada
tipo), que sigue pendiente.*
