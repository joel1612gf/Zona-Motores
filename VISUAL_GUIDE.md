# VISUAL_GUIDE.md — Sistema Visual del SaaS Zona Business

**LECTURA OBLIGATORIA antes de crear o rediseñar cualquier pantalla del SaaS (`/business/[slug]/...`).** Este documento codifica los patrones validados visualmente en las secciones terminadas:

- **Reportes** — [src/app/business/[slug]/reports/page.tsx](src/app/business/%5Bslug%5D/reports/page.tsx) → referencia para vistas **analíticas** (KPIs, tabs underline, charts, tablas fiscales, blob decorativo).
- **Productos** — [src/app/business/[slug]/products/page.tsx](src/app/business/%5Bslug%5D/products/page.tsx) → referencia para **catálogos/listas** con responsive dual (tabla en desktop, cards apiladas en mobile). **No usa KPIs.**
- **Ventas** — [src/app/business/[slug]/sales/page.tsx](src/app/business/%5Bslug%5D/sales/page.tsx) → referencia para tabs glass + grid de cards interactivas (radar de cobros).
- **Finanzas** — [src/app/business/[slug]/finance/page.tsx](src/app/business/%5Bslug%5D/finance/page.tsx) → referencia para layout con tabs pill y cards ultra-redondeadas (`rounded-[2.5rem]`).
- **Bancos** — [src/app/business/[slug]/banks/page.tsx](src/app/business/%5Bslug%5D/banks/page.tsx) → referencia para summary cards con gradiente y card "Agregar nueva" en grid.

> Antes de inventar un componente, **abre la sección análoga arriba y copia el patrón**.

---

## 0. PRINCIPIO RECTOR — estética inviolable, estructura flexible

Esta es la regla más importante del documento: **lo que NO se negocia es la estética; lo que SÍ se adapta es la estructura.**

### 🔒 INVIOLABLE — debe verse idéntico en TODA pantalla nueva

| Elemento | Regla exacta |
|---|---|
| **Firma tipográfica de eyebrow/label** | `text-[10px] font-black uppercase tracking-widest text-muted-foreground` |
| **Cards de contenido (glassmorphism)** | `border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border` |
| **Botón primario (glow de marca)** | `shadow-xl shadow-primary/20` (o `shadow-lg shadow-primary/20` si es compacto) + `font-bold` |
| **Radios grandes en superficies principales** | `rounded-[1.5rem]`, `rounded-[2rem]` o `rounded-[2.5rem]` (nunca `rounded-md`/`rounded-sm` en cards) |
| **Header de sección** | Patrón completo del §3 (chip primary + H1 `font-headline` + subtítulo + acciones a la derecha en desktop) |
| **Iconografía** | Solo `lucide-react`. Tamaños canónicos del §14. |
| **Paleta neutra** | Solo `slate-*` o tokens del theme. Nada de `gray-*`/`neutral-*` mezclados. |
| **Color primario** | `bg-primary` / `text-primary` para acción principal y foco activo. |

### 🔄 FLEXIBLE — usa solo si el caso lo exige

| Elemento | Cuándo SÍ | Cuándo NO |
|---|---|---|
| **KPI cards (§5)** | Dashboard, Reportes, Finanzas, Bancos — vistas analíticas con métricas | Clientes, Productos, Personal, Web Sync — catálogos/transaccionales |
| **Tabs (§7)** | Hay 2+ vistas dentro de la misma sección (Reportes: Finanzas/Inventario/Fiscal) | La sección tiene una sola vista (Clientes, Personal) |
| **Filtros + búsqueda (§9)** | Hay listas con > 10–20 items o categorías | Lista corta o pantalla con un solo objeto |
| **Empty state (§10)** | La pantalla puede quedar vacía (sin datos) | El contenido es siempre presente (Configuración) |
| **Loading state (§11)** | Hay fetch async desde Firestore | Datos siempre disponibles (cliente puro) |
| **Blob decorativo** | Vistas "premium" (Reportes, Sales) | Listas densas (Productos) |
| **Modales/Diálogos (§12)** | Hay forms o confirmaciones destructivas | Solo lectura |

### Regla de oro

> **No agregues KPIs, tabs, empty states, blobs ni cualquier otro bloque "porque sí".** Si el caso de uso no lo exige, lo dejas afuera. La consistencia se mantiene por la **estética** (lista inviolable arriba), no por replicar siempre la misma estructura.

---

## 0.5 PROTOCOLO DE USO

Antes de escribir UI nueva:

1. Decide qué tipo de pantalla es: **analítica** (Reportes-style) vs **catálogo/transaccional** (Productos-style).
2. Abre el `page.tsx` de la sección modelo más parecida.
3. Copia exactamente: **header**, **wrappers de card**, **radios**, **tipografía**, **colores**.
4. Agrega solo los bloques opcionales (§5, §7, §9, §10, §11, §12) que el caso de uso justifique.
5. Cumple obligatoriamente el bloque **§13 RESPONSIVE**.
6. Antes de declarar terminado, recorre el **§16 CHECKLIST FINAL** (los pasos marcados "SI aplica" se saltan si tu pantalla no los necesita).
7. Si rompes algo de la **lista inviolable** (§0), justifícalo en una línea de comentario y avísale al usuario.

---

## 1. TOKENS DE MARCA

### Colores (CSS variables HSL en [src/app/globals.css](src/app/globals.css))

| Token Tailwind | Valor | Uso |
|---|---|---|
| `bg-primary` / `text-primary` | `hsl(221 83% 53%)` ≈ `#2563eb` | Acción principal, KPI dominante, foco activo |
| `bg-primary-foreground` | blanco | Texto sobre `bg-primary` |
| `bg-background` | `hsl(210 40% 98%)` casi blanco | Fondo de página |
| `bg-card` | blanco puro | Fondo de cards opacas |
| `bg-muted` / `text-muted-foreground` | gris frío suave | Backgrounds secundarios, texto descriptivo |
| `border-border` / `ring-border` | `hsl(214 32% 91%)` | Líneas y rings sutiles |

**Paleta semántica directa de Tailwind** (usar literalmente):

- **Éxito:** `emerald-500/600`, fondos `emerald-50/100`.
- **Advertencia:** `amber-500/600`, fondos `amber-50/100`.
- **Peligro:** `red-500/600`, fondos `red-50/100`.
- **Escala neutra:** `slate-50 / 100 / 200 / 300 / 400 / 500 / 900`. **Nunca** mezclar con `gray-*` o `neutral-*`.

### Tipografía

- **Headline (`font-headline`):** Oswald — H1, KPIs grandes, títulos de card, montos.
- **Body (`font-body`):** Inter — texto general.
- **Mono (`font-mono`):** códigos y referencias.

| Clase | Uso |
|---|---|
| `text-3xl font-bold font-headline tracking-tight` | H1 de página |
| `text-xl font-headline` | Título de card / sección |
| `text-3xl font-bold font-headline tracking-tighter leading-none` | Valor de KPI principal |
| `text-sm font-medium text-muted-foreground` | Subtítulo del header |
| **`text-[10px] font-black uppercase tracking-widest text-muted-foreground`** | **Eyebrow / label — FIRMA INVIOLABLE** |
| `text-[9px]` / `text-[8px]` | Micro-labels en chips |
| `text-xs text-muted-foreground font-medium uppercase tracking-widest` | Hints / metadatos |

### Radios

| Tamaño | Clase | Cuándo |
|---|---|---|
| Pequeño | `rounded-xl` (12px) | Badges, inputs, tabs internos |
| Medio | `rounded-2xl` (16px) | Botones, chip de icono header, cards estándar |
| Grande | `rounded-[1.5rem]` (24px) | Cards de fila, tablas envueltas |
| XL | `rounded-[2rem]` (32px) | Cards principales, modales, summary cards |
| XXL | `rounded-[2.5rem]` (40px) | Cards "premium" (Finanzas) |

`rounded-md` / `rounded-sm` solo para inputs internos. Nunca para superficies de página.

---

## 2. LAYOUT DE PÁGINA — composición flexible

El esqueleto canónico tiene **un único bloque obligatorio** (Header) y el resto se compone según el caso:

```tsx
return (
  <div className="space-y-8 pb-12 relative animate-in fade-in duration-500">
    {/* Blob decorativo — OPCIONAL, vistas premium/analíticas */}
    {/* §3 Header — OBLIGATORIO */}
    {/* §5 KPIs — OPCIONAL, solo si la pantalla muestra métricas analíticas */}
    {/* §7 Tabs — OPCIONAL, solo si hay 2+ vistas */}
    {/* §9 Filtros — OPCIONAL, según volumen */}
    {/* §8 Tablas / §6 Cards / contenido principal */}
    {/* §10 Empty state — OPCIONAL */}
    {/* §11 Loading state — OPCIONAL */}
    {/* §12 Diálogos al final del JSX */}
  </div>
);
```

### Wrapper raíz (siempre)

- `space-y-8` (preferido) o `space-y-6` para listas densas.
- `pb-12` para que el último elemento respire.
- `animate-in fade-in duration-500` siempre que la página haga fetch.
- `relative` solo si vas a usar blob decorativo.
- **No agregues padding al wrapper.** Ya viene del shell ([src/app/business/[slug]/layout.tsx](src/app/business/%5Bslug%5D/layout.tsx) → `p-6 md:p-8`).

### Composiciones típicas

- **Pantalla analítica** (Reportes, Dashboard): Header + KPIs + Tabs + Cards/Tablas.
- **Catálogo/lista** (Productos, Clientes, Personal): Header + Filtros + Tabs(opcional) + Lista responsive dual.
- **Vista de un solo objeto** (Configuración, Detalle): Header + Cards de contenido.
- **Workflow/wizard**: Header + Card glass premium con steps internos.

---

## 3. HEADER DE SECCIÓN — único bloque ESTRUCTURALMENTE OBLIGATORIO

Idéntico en TODAS las pantallas del SaaS. Cópialo así:

```tsx
<div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
  <div className="space-y-1">
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25">
        <Icon className="h-6 w-6 text-primary-foreground" />
      </div>
      <h1 className="text-3xl font-bold font-headline tracking-tight">Nombre de la sección</h1>
    </div>
    <p className="text-muted-foreground font-medium">
      Descripción breve y útil (1 línea)
    </p>
  </div>

  {/* Acciones a la derecha en desktop, full-width en mobile */}
  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
    {/* Acciones secundarias (outline) + acción principal (bg-primary) */}
  </div>
</div>
```

**Reglas inviolables del header:**

- El **chip de icono primary** (`p-2.5 bg-primary rounded-2xl shadow-lg shadow-primary/25` con `Icon h-6 w-6 text-primary-foreground`) es invariante.
- El H1 es siempre `text-3xl font-bold font-headline tracking-tight`.
- El subtítulo es siempre `text-muted-foreground font-medium`. Si menciona el nombre de la empresa, énfasis con `<span className="text-foreground font-bold">`.
- En desktop las acciones van **a la derecha** (`md:flex-row justify-between`).
- En mobile el header se apila (`flex-col`) y las acciones ocupan `w-full`.

> Si una sección no tiene acciones a la derecha (raro), el header se queda solo con la columna izquierda y listo.

---

## 4. BOTONES

```tsx
{/* Acción principal — siempre con glow de marca */}
<Button className="rounded-2xl h-12 px-6 shadow-xl shadow-primary/20 gap-2 font-bold">
  <Plus className="h-5 w-5" /> Acción Principal
</Button>

{/* Acción secundaria (outline tematizada) */}
<Button variant="outline" className="rounded-2xl h-12 px-6 border-primary/20 hover:bg-primary/5 gap-2 font-bold">
  <Icon className="h-5 w-5 text-primary" /> Secundaria
</Button>

{/* Icon-only */}
<Button variant="outline" size="icon" className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/5">
  <RefreshCw className="h-5 w-5 text-primary" />
</Button>

{/* Botón compacto dentro de tabla / fila */}
<Button className="rounded-xl font-bold shadow-lg shadow-primary/20">…</Button>
```

Reglas:

- **Primario:** SIEMPRE con `shadow-xl shadow-primary/20` (o `shadow-lg shadow-primary/20` si es compacto). El glow azul es identidad inviolable.
- **Outline tematizado:** `border-primary/20` + icono con `text-primary`. Variantes: `border-emerald-500/20` + `text-emerald-500`, `border-red-200` + `text-red-500`.
- **Mobile:** `flex-1 md:flex-none` o `w-full md:w-auto`.
- **Destructivo en modal:** `bg-red-600 text-white hover:bg-red-700 rounded-xl px-8 font-bold h-12`.

---

## 5. KPI CARDS — OPCIONALES (solo para pantallas analíticas)

> **Regla:** No agregues KPIs a menos que el caso de uso exija mostrar métricas analíticas. Las pantallas de catálogo/transaccionales (Clientes, Productos, Personal, Web Sync) **no llevan KPIs**.

**Sí van KPIs en:** Dashboard, Reportes, Finanzas, Bancos (summary financiero), cualquier vista de "resumen del negocio".
**No van KPIs en:** Productos, Clientes, Personal, Web Sync, Configuración, vistas de detalle individual, formularios.

Cuando aplique, usa una de las tres variantes:

### A. KPI dominante (relleno primary)

```tsx
<Card className="border-none relative overflow-hidden group transition-all hover:-translate-y-1 bg-primary text-primary-foreground shadow-primary/30">
  <Icon className="absolute -bottom-4 -right-4 h-28 w-28 opacity-[0.15] group-hover:scale-110 transition-transform" />
  <CardHeader className="pb-2">
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/60">Título</p>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold font-headline tracking-tighter leading-none">$12,400</div>
    <p className="text-xs mt-2.5 font-medium text-primary-foreground/80">Descripción</p>
  </CardContent>
</Card>
```

### B. KPI semántico (borde lateral coloreado)

```tsx
<Card className="border-none relative overflow-hidden group transition-all hover:-translate-y-1 bg-card border-l-4 border-l-emerald-500 shadow-sm">
  {/* mismo contenido, eyebrow con `text-muted-foreground` */}
</Card>
```

Variantes: `border-l-emerald-500` (success), `border-l-amber-500` (warning), `border-l-red-500` (danger).

### C. Summary card con gradiente (estilo Bancos USD)

```tsx
<Card className="border-none shadow-2xl bg-gradient-to-br from-blue-600/90 to-blue-800/90 backdrop-blur-md ring-1 ring-white/20 rounded-[2rem] overflow-hidden group">
  <CardContent className="p-6 relative">
    <Banknote className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10 -rotate-12 group-hover:scale-110 group-hover:rotate-0 transition-all duration-700" />
    {/* contenido */}
  </CardContent>
</Card>
```

Reglas comunes (cuando uses KPIs):

- Watermark icon + `hover:-translate-y-1` siempre.
- Grid responsive: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` (3 KPIs) o `lg:grid-cols-4` (4 KPIs).

---

## 6. CARDS DE CONTENIDO (glassmorphism — INVIOLABLE)

### Glass (predeterminado)

```tsx
<Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden rounded-[1.5rem]">
  <CardHeader className="bg-muted/30 pb-6 border-b">
    <CardTitle className="text-xl font-headline flex items-center gap-2">
      <DollarSign className="h-5 w-5 text-primary" /> Título
    </CardTitle>
    <CardDescription>Subtítulo</CardDescription>
  </CardHeader>
  <CardContent className="pt-8 space-y-4">…</CardContent>
</Card>
```

### Glass premium (Finanzas)

```tsx
<Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md ring-1 ring-border rounded-[2.5rem] overflow-hidden">
  <CardHeader className="p-8 pb-4">…</CardHeader>
  <CardContent className="p-8 pt-0">…</CardContent>
</Card>
```

Reglas (las cards SIEMPRE se ven así, sin importar si la página es analítica o catálogo):

- **Nunca** `border` con color visible. Usa `border-none` + `ring-1 ring-border`.
- `bg-card/60 backdrop-blur-md` es no negociable.
- `CardHeader` con `bg-muted/30` o `bg-muted/20` + `border-b` separa head de body.

---

## 7. TABS — OPCIONALES (solo si la sección tiene 2+ vistas)

> Muchas pantallas tienen **una sola vista** (Clientes, Personal, Configuración) y no requieren tabs. No los agregues por defecto.

Cuando aplique, elige variante:

### A. Underline minimalista (Reportes — para vistas analíticas)

```tsx
<TabsList className="bg-transparent h-auto p-0 gap-4 sm:gap-8 justify-start border-b w-full rounded-none mb-8 flex-wrap">
  <TabsTrigger value="finance" className="data-[state=active]:text-primary data-[state=active]:after:scale-x-100 relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary after:scale-x-0 after:transition-transform text-muted-foreground font-bold text-xs uppercase tracking-widest h-12 px-2 bg-transparent gap-2">
    <Calculator className="h-4 w-4" /> Finanzas
  </TabsTrigger>
</TabsList>
```

### B. Pill blanca (Productos, Finanzas — para CRUD/listas)

```tsx
<TabsList className="bg-slate-100 p-1 rounded-2xl h-12 border border-slate-200/60 shadow-inner">
  <TabsTrigger value="todos" className="rounded-xl px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all font-bold">
    Todos
  </TabsTrigger>
</TabsList>
```

### C. Glass (Sales — sobre fondo decorativo)

```tsx
<TabsList className="bg-background/40 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl h-auto shadow-inner">
  <TabsTrigger value="radar" className="rounded-xl px-6 py-2.5 text-sm font-bold data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all gap-2">
    <AlertCircle className="h-4 w-4" /> Radar de Cobros
  </TabsTrigger>
</TabsList>
```

Reglas (cuando uses tabs):

- Siempre con **icono Lucide** en el trigger.
- Label en `font-bold` (B/C) o `font-bold text-xs uppercase tracking-widest` (A).
- En mobile: `flex-col md:flex-row` y `w-full md:w-auto` si los triggers no caben.

---

## 8. TABLAS Y LISTAS

### Tabla envuelta (Reportes Fiscal)

```tsx
<div className="rounded-[1.5rem] border shadow-xl bg-card overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm text-left">
      <thead>
        <tr className="bg-muted/50 border-b">
          <th className="px-6 py-5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Columna</th>
        </tr>
      </thead>
      <tbody className="divide-y bg-background/50 backdrop-blur-sm">
        <tr className="hover:bg-muted/40 transition-colors group">
          <td className="px-6 py-5">…</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Lista vertical con divisores (Reportes Inventario)

```tsx
<Card className="border-none shadow-xl bg-card/60 backdrop-blur-md ring-1 ring-border overflow-hidden">
  <CardContent className="p-0">
    <div className="divide-y">
      <div className="flex items-center justify-between p-4 px-6 hover:bg-muted/30 transition-all group">
        <div className="w-12 h-12 bg-primary/5 rounded-2xl flex flex-col items-center justify-center border border-primary/10 group-hover:bg-primary group-hover:text-primary-foreground transition-all">…</div>
        {/* info */}
      </div>
    </div>
  </CardContent>
</Card>
```

### Lista tipo grid (Productos desktop) — patrón clave para catálogos

Usa `grid-cols-[1fr_120px_120px_…]` cuando necesites alineación por píxel y filas en card individuales:

```tsx
<div className="grid items-center gap-4 p-4 px-6 bg-white border border-slate-200 rounded-[1.5rem] hover:border-primary/20 hover:translate-y-[-2px] transition-all duration-300 shadow-sm group grid-cols-[1fr_120px_120px_100px_80px_100px]">
  …
</div>
```

Padding: filas `px-6 py-5` (tabla) o `p-4 px-6` (lista en card). Hover: `hover:bg-muted/30` o `hover:bg-muted/40`.

---

## 9. FILTROS Y BÚSQUEDA — OPCIONALES (según volumen de datos)

> Si la lista tiene < 10–20 items o solo un objeto, no agregues barra de filtros.

```tsx
<div className="flex flex-col sm:flex-row gap-3">
  <div className="relative flex-1 max-w-md">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
    <Input
      placeholder="Buscar por nombre o código..."
      className="pl-10 rounded-xl h-12 border-slate-200 focus:border-primary/50 transition-all"
    />
  </div>
  <Select>
    <SelectTrigger className="w-full sm:w-[220px] h-12 rounded-xl border-slate-200">
      <SelectValue placeholder="Categoría" />
    </SelectTrigger>
    <SelectContent className="rounded-xl">…</SelectContent>
  </Select>
</div>
```

Reglas (cuando uses filtros):

- Inputs: `h-12 rounded-xl border-slate-200 focus:border-primary/50`.
- Search icon SIEMPRE absoluto + `text-slate-400`, padding-left `pl-10`.
- Mobile apila (`flex-col`), desktop al lado (`sm:flex-row`).

---

## 10. EMPTY STATES — OPCIONALES (solo si la pantalla puede quedar vacía)

### A. Card dasheada (Sales radar despejado)

```tsx
<Card className="bg-card/40 backdrop-blur-md border-dashed border-2 border-muted-foreground/20 rounded-[2rem]">
  <CardContent className="flex flex-col items-center justify-center py-20 text-center">
    <div className="p-4 bg-muted/50 rounded-full mb-4">
      <Receipt className="h-10 w-10 text-muted-foreground opacity-60" />
    </div>
    <p className="text-lg font-bold font-headline text-foreground">Radar despejado</p>
    <p className="text-sm text-muted-foreground mt-1">No hay ventas pendientes por cobrar.</p>
  </CardContent>
</Card>
```

### B. Hero centrado con halo (Bancos sin cuentas)

```tsx
<div className="flex flex-col items-center justify-center py-24 gap-5">
  <div className="relative">
    <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
    <div className="relative p-8 bg-white/60 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl">
      <Landmark className="h-14 w-14 text-blue-400 mx-auto" />
    </div>
  </div>
  <div className="text-center space-y-2">
    <h2 className="text-xl font-bold">Sin cuentas registradas</h2>
    <p className="text-sm text-slate-500 max-w-sm">Texto explicativo.</p>
  </div>
  <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 shadow-lg shadow-blue-500/25">
    <Plus className="h-4 w-4" /> Acción primaria
  </Button>
</div>
```

### C. Inline en tabla (Reportes Fiscal)

```tsx
<tr><td colSpan={5} className="py-20 text-center">
  <div className="flex flex-col items-center gap-2 opacity-30">
    <Info className="h-10 w-10" />
    <p className="text-sm font-bold uppercase tracking-widest italic">Sin registros</p>
  </div>
</td></tr>
```

---

## 11. LOADING STATES — OPCIONALES (solo si hay fetch async)

```tsx
{/* Spinner premium (Reportes) */}
<div className="p-20 text-center flex flex-col items-center gap-4">
  <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
  <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Sincronizando…</p>
</div>

{/* Spinner simple (Productos) */}
<div className="flex items-center justify-center h-64">
  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
</div>

{/* Skeleton de cards (Bancos) */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {[1,2,3].map(i => <Skeleton key={i} className="h-60 rounded-[1.5rem]" />)}
</div>
```

Regla: cards → `Skeleton`. Acción corta → `Loader2`.

---

## 12. MODALES Y DIÁLOGOS — OPCIONALES (solo si hay forms/confirmaciones)

```tsx
<DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl">
  <DialogHeader>
    <DialogTitle className="font-headline text-xl">Título</DialogTitle>
    <DialogDescription>Descripción</DialogDescription>
  </DialogHeader>
  …
  <DialogFooter className="gap-2">
    <Button variant="outline" className="rounded-xl">Cancelar</Button>
    <Button className="rounded-xl">Confirmar</Button>
  </DialogFooter>
</DialogContent>
```

AlertDialog destructivo:

```tsx
<AlertDialogContent className="bg-white rounded-[2rem] border-slate-200 shadow-2xl">
  <AlertDialogHeader>
    <AlertDialogTitle className="text-2xl font-bold font-headline">¿Eliminar?</AlertDialogTitle>
    <AlertDialogDescription className="text-slate-500">…</AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter className="mt-6 gap-3">
    <AlertDialogCancel className="rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-widest h-12">Cancelar</AlertDialogCancel>
    <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700 rounded-xl px-8 font-bold h-12">
      Sí, Eliminar
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>
```

En mobile: `w-[90vw]`, footer `flex-row gap-3` con botones `flex-1`.

---

## 13. RESPONSIVE — OBLIGATORIO ✱

**Toda pantalla debe pasar las pruebas en `sm` (640px), `md` (768px), `lg` (1024px) antes de declararse terminada.** No se merge sin pasar por móvil.

### Reglas duras

1. **Header:** siempre `flex flex-col md:flex-row gap-6`. Acciones: `w-full md:w-auto` y botones internos `flex-1 md:flex-none`.
2. **Grids de KPI/cards** (cuando apliquen): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (o `lg:grid-cols-4` si son 4).
3. **Filtros** (cuando apliquen): `flex flex-col sm:flex-row gap-3`. Search ocupa `flex-1 max-w-md`.
4. **Tabs con muchos items** (cuando apliquen): `flex flex-wrap` o `flex-col md:flex-row` si no caben.
5. **Listas/tablas con > 4 columnas:** patrón **dual** obligatorio:
   ```tsx
   <div className="hidden md:block">{/* tabla/grid desktop */}</div>
   <div className="grid grid-cols-1 gap-4 md:hidden">{/* cards mobile */}</div>
   ```
   No hagas scroll horizontal en mobile salvo libro fiscal (Reportes Fiscal lo justifica).
6. **Modales en mobile:** `w-[90vw]` o `max-w-sm`, footer `flex-row gap-3`, botones `flex-1`.
7. **Padding del shell:** ya viene del layout (`p-6 md:p-8`). No agregues padding al wrapper raíz, solo `space-y-*` y `pb-12`.
8. **Texto largo:** `truncate` en filas, `line-clamp-1/2` en títulos. `min-w-0` en flex children con texto truncable.
9. **Touch targets:** ≥ `h-10` (preferido `h-12`). Acciones de fila pueden ser `opacity-0 group-hover:opacity-100` solo en desktop; en mobile **siempre visibles**.
10. **Sidebar móvil:** responsabilidad del shell ([src/components/business/sidebar.tsx](src/components/business/sidebar.tsx)). No la dupliques.

### Breakpoints reales

- `sm:` 640px — filas de filtros, grids 2-col.
- `md:` 768px — header horizontal, oculta vista mobile de listas.
- `lg:` 1024px — grid de 3-4 KPIs.
- `xl:` y `2xl:` — refinamientos opcionales.

---

## 14. ICONOGRAFÍA Y MICRO-INTERACCIONES

- **Solo `lucide-react`.** Sin emojis, sin SVGs custom.
- Tamaños: `h-3.5 w-3.5` (chip pequeño / acción de fila), `h-4 w-4` (botón / tab), `h-5 w-5` (icono de card), `h-6 w-6` (chip header), `h-10 w-10` (empty state mid), `h-14 w-14` (empty state hero), `h-28/h-32 w-28/w-32` (watermark de KPI).
- **Pulse dot:** `<div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />` o `bg-emerald-500`.
- **Blob decorativo** (vistas premium): `<div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />` en wrapper `relative`.
- **Hover en cards interactivas:** `hover:-translate-y-1` o `hover:translate-y-[-2px]` + `transition-all`.
- **Hover en watermark:** `group-hover:scale-110 group-hover:rotate-0 transition-all duration-700`.
- **Acciones de fila:** `opacity-0 group-hover:opacity-100` solo en desktop.

---

## 15. ANTI-PATRONES (NO HACER)

### Estética (NUNCA)

- ❌ Sombras estándar sin tinte. Usa `shadow-xl shadow-primary/20` en primarios.
- ❌ Cards con `border` visible. Usa `border-none ring-1 ring-border`.
- ❌ Cards sin glassmorphism (`bg-card/60 backdrop-blur-md`).
- ❌ Radios menores a `rounded-xl` para superficies.
- ❌ Eyebrow sin `text-[10px] font-black uppercase tracking-widest`.
- ❌ Mezclar `gray-*`, `neutral-*`, `slate-*`. Solo `slate-*`.
- ❌ Componentes de otra librería (MUI, Chakra, Mantine). Solo Radix/shadcn + Tailwind.
- ❌ Iconos en SVG inline o emojis. Solo Lucide.

### Estructura (depende del caso)

- ❌ **Agregar KPIs a pantallas de catálogo/transaccionales** solo "porque queda bonito". Si no hay métricas analíticas, no van.
- ❌ **Agregar Tabs a pantallas de una sola vista**. No inventes pestañas redundantes.
- ❌ Agregar empty states a pantallas que nunca quedan vacías.
- ❌ Agregar loading states a pantallas sin fetch async.

### Layout

- ❌ Padding personalizado en el wrapper raíz (ya viene del shell).
- ❌ Tablas en mobile con scroll horizontal cuando puedes apilar en cards.
- ❌ Botones < `h-10` en mobile.
- ❌ Acción destructiva sin `AlertDialog`.

---

## 16. CHECKLIST FINAL antes de declarar una pantalla terminada

Recorrer en orden. Los items marcados **SI APLICA** se saltan si la pantalla no requiere ese bloque.

### Inviolables (siempre verificar)

- [ ] **Header** sigue el template de §3 exacto (chip `bg-primary rounded-2xl shadow-primary/25` + H1 `text-3xl font-bold font-headline tracking-tight` + subtítulo `text-muted-foreground font-medium` + acciones a la derecha en `md:flex-row`).
- [ ] **Wrapper raíz** con `space-y-8 pb-12 animate-in fade-in duration-500` (+ `relative` si tiene blob). Sin padding propio.
- [ ] **Botón primario** con `shadow-xl shadow-primary/20` y `font-bold`.
- [ ] **Cards de contenido** con `border-none ring-1 ring-border bg-card/60 backdrop-blur-md` y radio `rounded-[1.5rem]`/`rounded-[2rem]`/`rounded-[2.5rem]`.
- [ ] **Eyebrows / labels** con `text-[10px] font-black uppercase tracking-widest text-muted-foreground`.
- [ ] **Iconos** solo `lucide-react`. Tamaños canónicos del §14.
- [ ] **Paleta neutra** solo `slate-*` o tokens del theme.
- [ ] **Mobile (≤768px) probado:** header se apila, acciones full-width, listas con > 4 columnas tienen vista alterna en cards (`hidden md:block` + `md:hidden`).
- [ ] Pasaste `npm run typecheck` sin errores nuevos.

### Condicionales (saltar si no aplican)

- [ ] **SI APLICA — KPIs:** grid responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4`), `hover:-translate-y-1`, watermark icon. *(Saltar si la pantalla no es analítica.)*
- [ ] **SI APLICA — Tabs:** una de las tres variantes (§7) con icono Lucide en cada trigger. *(Saltar si la pantalla tiene una sola vista.)*
- [ ] **SI APLICA — Filtros:** patrón del §9 con search icon absoluto + select `h-12 rounded-xl`. *(Saltar si el listado es corto.)*
- [ ] **SI APLICA — Empty state:** uno de los formatos del §10. *(Saltar si la pantalla nunca queda vacía.)*
- [ ] **SI APLICA — Loading state:** Skeleton para cards / `Loader2` para acciones cortas. *(Saltar si no hay fetch async.)*
- [ ] **SI APLICA — Modales:** `rounded-[2rem]` y `backdrop-blur-xl`. Footer mobile-friendly. *(Saltar si no hay diálogos.)*
- [ ] **SI APLICA — Acción destructiva:** confirmada con `AlertDialog` y botón `bg-red-600`. *(Saltar si no hay deletes.)*
- [ ] **SI APLICA — Blob decorativo:** solo en vistas premium/analíticas. *(Saltar en catálogos densos.)*

> Una pantalla que no pasa los **inviolables** no se entrega. Una pantalla que no necesita los **condicionales** no los agrega.

---

## 17. CÓMO EXTENDER ESTE DOCUMENTO

Si una pantalla nueva valida un patrón que aún no está aquí (con aprobación del dueño del proyecto), agrega una sección con:

1. Snippet del patrón.
2. Cuándo usarlo (vs. los existentes).
3. Variantes responsive.
4. Anti-patrón asociado, si aplica.
5. Si es estructural opcional, agrégalo a la tabla "FLEXIBLE" del §0 con su criterio "SÍ / NO".

Mantén este archivo bajo 600 líneas; si crece más, divide por dominio (`VISUAL_GUIDE_TABLES.md`, etc.).
