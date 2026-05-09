# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Next.js dev server (App Router, port 3000).
- `npm run build` — Production build (`NODE_ENV=production next build`). Note: `next.config.ts` sets `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true`, so `next build` will not catch type/lint errors.
- `npm run typecheck` — `tsc --noEmit`. Always run this before declaring TS work done; the build will not catch type errors.
- `npm run lint` — `next lint`.
- `npm run genkit:dev` / `npm run genkit:watch` — Start the Genkit dev UI for AI flows in [src/ai/dev.ts](src/ai/dev.ts).
- No test runner is configured.

`.env.local` must contain `NEXT_PUBLIC_FIREBASE_*` values (see [src/firebase/config.ts](src/firebase/config.ts)) plus any Genkit/Google AI keys consumed by [src/ai/genkit.ts](src/ai/genkit.ts).

## Architecture

Zona Motores is a hybrid platform with two pillars sharing one Next.js 15 / React 19 codebase and a single Firebase project:

- **Public Marketplace** — routes outside `/business/...` ([src/app/page.tsx](src/app/page.tsx), [src/app/listings/](src/app/listings/), [src/app/dealerships/](src/app/dealerships/), [src/app/profile/](src/app/profile/)). Reads vehicle listings stored under `users/{uid}/vehicleListings/{listingId}` (collection-group queryable; rule at [firestore.rules:87-89](firestore.rules#L87-L89)).
- **Zona Business (SaaS)** — multi-tenant ERP/CRM under [src/app/business/[slug]/](src/app/business/[slug]/) with modules: `dashboard`, `inventory`, `products`, `sales`, `clients`, `staff`, `payables`, `banks`, `cash-register`, `commissions`, `consignment`, `calendar`, `reports`, `finance`, `web-sync`, `settings`. Each tenant lives under `concesionarios/{concesionarioId}` with first- and second-level subcollections (sales, vehicles, caja, cuentas_bancarias/{id}/transacciones/...). Firestore rules currently allow public read/write inside `concesionarios/*` — auth happens at the app layer, not at the rules layer.

### Two-step business auth

[src/context/business-auth-context.tsx](src/context/business-auth-context.tsx) implements a custom auth flow that does **not** use Firebase Auth for tenant access:

1. **Enterprise step** — visitor enters `clave_maestra` for the slug; verified against SHA-256 `clave_maestra_hash` on the `concesionario` doc. Persisted in `sessionStorage` as `zm_business_session`.
2. **Staff step** — user picks a `StaffMember` and types a 4-6 digit PIN, verified against `pin_hash`. Persisted as `zm_staff_session`.

[src/app/business/[slug]/layout.tsx](src/app/business/[slug]/layout.tsx) gates every business route on both flags via `useBusinessAuth()` and redirects to `/business/[slug]/login` or `/business/[slug]/staff-login`. Firebase Auth (`useUser`) is used by the public marketplace side, not the SaaS side.

### Roles and permissions

Five roles: `dueno | encargado | secretario | vendedor | cajero`. The full module-by-role matrix and `CAN_SEE_PURCHASE_COSTS` flag live in [src/lib/business-types.ts](src/lib/business-types.ts) (`ROLE_PERMISSIONS`). Permission levels: `'full' | 'read' | 'own' | false`. Always read this matrix before adding UI controls or data writes inside a business module — gate via `hasPermission(module)` from `useBusinessAuth()`.

### Firestore reactivity (mandatory pattern)

Use the custom hooks in [src/firebase/](src/firebase/):

- `useCollection<T>(query)` and `useDoc<T>(ref)` for real-time subscriptions ([src/firebase/firestore/](src/firebase/firestore/)). The query/ref **must** be memoized with `useMemoFirebase(...)` (the hooks check a `__memo` marker) — passing an unmemoized ref will cause re-subscribe loops.
- For writes, prefer the non-blocking helpers in [src/firebase/non-blocking-updates.tsx](src/firebase/non-blocking-updates.tsx) (`setDocumentNonBlocking`, `addDocumentNonBlocking`, `updateDocumentNonBlocking`, `deleteDocumentNonBlocking`). They fire-and-forget, route Firestore permission failures through `errorEmitter` → [src/components/FirebaseErrorListener.tsx](src/components/FirebaseErrorListener.tsx), and let the UI stay responsive.
- The Firebase SDK is initialized client-side only (`'use client'` on [src/firebase/index.ts](src/firebase/index.ts) and `provider.tsx`). `initializeApp()` is called with no args first (Firebase App Hosting injects config); falls back to `firebaseConfig` in dev. **Do not modify `initializeFirebase()`** — the comment in the file is enforced.

### Fiscal logic (Venezuela 2026)

[src/lib/fiscal-helpers.ts](src/lib/fiscal-helpers.ts) is the single source of truth for tax math:

- `IVA_RATE = 0.16`, `IGTF_RATE = 0.03`.
- IGTF applies **only** when the payment method matches `Zelle | Efectivo USD | Dólares | Zelle / Dólares | Crypto` (substring match, case-insensitive).
- IGTF is computed on `(base + IVA)`, not on base alone.
- Vehicle sales can be IVA-exempt per tenant via `configuracion.vehiculos_exentos_iva`.

Invoice numbers come from per-tenant counters on `business_settings` / `concesionario.configuracion.ultimo_numero_factura_ventas`. Always increment via the counter, never guess.

BCV exchange rate: fetched via [src/app/api/business/exchange-rate/route.ts](src/app/api/business/exchange-rate/route.ts), which proxies `ve.dolarapi.com`, caches 30 min, and freezes updates between 14:00–23:59 Caracas time so "tomorrow's rate" never leaks before midnight.

### AI flows (Genkit)

[src/ai/genkit.ts](src/ai/genkit.ts) configures one shared `ai` instance using `googleAI()` plugin and `googleai/gemini-2.5-flash`. Register new flows by importing them from [src/ai/dev.ts](src/ai/dev.ts). API routes that use AI live under [src/app/api/](src/app/api/): `vehicle-ai`, `vehicle-market-price`, `scan-vehicle-title`, `business/parse-invoice`.

### UI conventions

- Components are shadcn/ui-style under [src/components/ui/](src/components/ui/) on top of Radix primitives ([components.json](components.json) is wired with `aliases.ui = @/components/ui`). Tailwind tokens are CSS-variable based (`baseColor: neutral`).
- Business-specific feature dialogs/wizards live in [src/components/business/](src/components/business/) (e.g. `sale-form-dialog.tsx`, `expense-wizard.tsx`, `vehicle-documents-wizard.tsx`).
- Path alias: `@/* → src/*` ([tsconfig.json](tsconfig.json)).
- Print/PDF documents use html2pdf.js and dedicated `*-print.tsx` components (A4 layouts).

## Project conventions

From [GEMINI.md](GEMINI.md) (the legacy AI context doc, still authoritative):

- **Code, identifiers, and comments → English. UI strings and legal documents → Spanish.** Don't translate the code, don't anglicize the UI.
- Do not invent Venezuelan fiscal rules. If a tax/legal detail is unclear, stop and ask Joel Eduardo (the project owner) rather than guessing a default.
- Stay within the existing UI stack: Radix UI + Tailwind. Don't pull in another component library without authorization.
- The visual language is "premium / glassmorphism" with the brand blue `#2463eb`.

## Things to know before editing

- `next.config.ts` ignores TS and ESLint errors during `next build`. Treat `npm run typecheck` as the real gate.
- Firestore rules under `concesionarios/*` are wide-open; never assume the rules will block bad writes — validate at the app layer (Zod schemas in `src/lib/*-schemas.ts`).
- The repo contains development debris at the root (`build-output*.txt`, `tsc_output.txt`, `repomix-output.xml`, `purchase-order-dialog.tsx.bak`, `fix-*.js/.ps1`, `check-*.js`, `scratch/`). These are not part of the application — don't import from them and don't update them as if they were sources of truth.
- `firebase.json`'s `hosting` block points at a static `public/` fallback; the actual deployment target is Firebase App Hosting (see [apphosting.yaml](apphosting.yaml)), which runs the Next.js server.
