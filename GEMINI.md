# Engineering Standards & Architectural Mandates

This document contains absolute mandates for the project's architecture, authentication, and core workflows. All future modifications MUST strictly adhere to these standards.

## 1. Clerk Authentication Lifecycle & Redirects
*   **Initialization Guards:** In Client Components, always check `isLoaded` before accessing Clerk state or sending requests.
    ```tsx
    if (!isLoaded) return null; // or a loading spinner
    ```
    This applies to `useUser()`, `useAuth()`, `useSignIn()`, and `useSession()`.
*   **Centralized Redirect Authority:** Never create redirect logic in multiple layers simultaneously. Prevent conflicts between:
    *   `middleware.ts`
    *   `layout.tsx`
    *   `page.tsx`
    *   Client-side components
    Only ONE layer should control a specific redirection flow to eliminate infinite loops.
*   **Component Boundary:** Never use Client Auth Hooks (e.g., `useUser()`) inside Server Components.
*   **Middleware Integrity:**
    *   **Explicit Public Routes:** `/`, `/sign-in`, and `/sign-up` MUST always be explicitly excluded from protection.
    *   **Asset Exclusion:** The Middleware matcher MUST never intercept `_next/*`, `favicon.ico`, Clerk internal routes, or standard static assets.

## 2. Data & Schema Integrity
*   **Prisma Stability:** Before changing Prisma schema relations:
    *   Analyze existing working fields.
    *   Preserve current IDs and working data types.
    *   Avoid breaking existing `create()` or `update()` calls.
*   **Surgical Updates:** Prefer targeted data sanitation (handling nulls/empty strings) over large-scale refactors of working controllers.

## 3. Operations & Terminal Environment
*   **Safe CLI Generation:** Never generate PowerShell-invalid syntax. Ensure all commands are valid for terminal execution without embedded explanation text.
*   **Clean Build Recommendation:** After making authentication or routing changes, always perform a clean build:
    ```bash
    rmdir /s /q .next ; npm run dev
    ```

## 4. Design & UI
*   **Aesthetic Consistency:** Maintain the dark, futuristic UI theme and `Rajdhani` typography. 
*   **Non-Breaking Modularization:** Add features without redesigning existing layouts, sidebars, or working modules.

## GOAL: Stable Authentication Lifecycle
*   No redirect loops or hydration mismatches.
*   No 500 Internal Server Errors after login.
*   No middleware conflicts or Clerk loading crashes.
*   No Prisma schema breakage or working-feature regressions.
*   **Minimal, non-breaking fixes over large rewrites.**
