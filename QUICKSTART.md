# Quick-Start Guide for Developers

Get up and running with the AI Services Platform in under 10 minutes.

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 18 | Runtime |
| npm / bun | Latest | Package manager |
| Git | Any | Version control |

---

## 2. Local Setup

```bash
# Clone the repo
git clone <YOUR_GIT_URL>
cd <PROJECT_DIR>

# Install dependencies
npm install        # or: bun install

# Start dev server (hot-reload on http://localhost:8080)
npm run dev
```

The app opens at `http://localhost:8080`. Login at `/login` with credentials provisioned via the `manage-admin` or `manage-client` edge functions.

---

## 3. Environment Variables

All config lives in `.env` at the project root (already committed):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon (public) key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

> **Private secrets** (API keys for Retell AI, WhatsApp, n8n, etc.) are stored as **Supabase Edge Function secrets**, never in the codebase. See `DEPLOYMENT.md` for the full list.

---

## 4. Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui primitives (Button, Card, Dialog…)
│   ├── admin/           # Admin dashboard components
│   ├── client/          # Client dashboard components
│   ├── super-admin/     # Super Admin components
│   ├── tables/          # DataTable, LeadsTable, CallLogsTable
│   └── skeletons/       # Loading skeletons
├── contexts/            # React contexts
│   ├── AuthContext.tsx   # Auth state, role detection, logout
│   ├── AdminContext.tsx  # Admin branding & data
│   └── ClientContext.tsx # Client session & assigned services
├── hooks/               # Custom hooks
│   ├── useCampaigns.ts  # Voice campaign CRUD
│   ├── useWhatsApp.ts   # WhatsApp messaging
│   ├── useSocialMedia.ts
│   └── useRetellCall.ts # Browser-based test calls
├── pages/               # Route-level page components
│   ├── admin/           # /admin/* routes
│   ├── client/          # /client/* routes
│   └── super-admin/     # /super-admin/* routes
├── lib/                 # Utilities & integrations
│   ├── service-routes.ts # DB slug → route mapping
│   ├── logger.ts        # Centralized logging
│   ├── error-handler.ts # Global error boundary helpers
│   └── integrations/    # External API wrappers
├── integrations/
│   └── supabase/        # Auto-generated client & types (DO NOT EDIT types.ts)
└── main.tsx             # App entry point
```

```
supabase/
├── config.toml          # Edge function config
├── functions/           # Serverless edge functions (Deno)
│   ├── manage-admin/
│   ├── manage-client/
│   ├── trigger-telecaller-campaign/
│   ├── handle-call-status/
│   ├── score-lead/
│   └── store-logs/
└── migrations/          # SQL migrations (DO NOT EDIT manually)
```

---

## 5. Key Code Patterns

### 5.1 Supabase Client

Always import the singleton client:

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### 5.2 Authentication & Role Check

```typescript
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, profile, loading, logout } = useAuth();
  // profile.role → "super_admin" | "admin" | "client"
}
```

### 5.3 Protected Routes

Wrap pages with `ProtectedRoute` and specify allowed roles:

```tsx
<Route path="/admin/*" element={
  <ProtectedRoute allowedRoles={["admin"]}>
    <AdminDashboard />
  </ProtectedRoute>
} />
```

### 5.4 Data Fetching (TanStack Query)

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const { data, isLoading } = useQuery({
  queryKey: ["campaigns", clientId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("voice_campaigns")
      .select("*")
      .eq("client_id", clientId);
    if (error) throw error;
    return data;
  },
});
```

### 5.5 Service Slug → Route Mapping

Database slugs differ from URL paths. Always use the helper:

```typescript
import { getRouteSlug, getServicePath } from "@/lib/service-routes";

getRouteSlug("ai-voice-telecaller");  // → "voice-telecaller"
getServicePath("whatsapp-automation"); // → "/client/whatsapp"
```

### 5.6 Design Tokens (Tailwind)

Never use raw colors. Use semantic tokens from the design system:

```tsx
// ✅ Correct
<div className="bg-background text-foreground border-border" />
<Button className="bg-primary text-primary-foreground" />

// ❌ Wrong
<div className="bg-white text-black border-gray-200" />
```

### 5.7 Toast Notifications

```typescript
import { toast } from "sonner";

toast.success("Campaign created!");
toast.error("Failed to send message.");
```

### 5.8 Edge Functions (Deno)

Edge functions live in `supabase/functions/<name>/index.ts` and auto-deploy on push.

```typescript
// Calling from frontend
const { data, error } = await supabase.functions.invoke("score-lead", {
  body: { callLogId: "uuid-here" },
});
```

---

## 6. Common Tasks

| Task | Command / Action |
|------|-----------------|
| Run dev server | `npm run dev` |
| Run tests | `npm run test` |
| Build for production | `npm run build` |
| Add a dependency | Use Lovable's `lov-add-dependency` tool |
| Database migration | Use Lovable's `supabase--migration` tool |
| Deploy | Click **Publish** in Lovable editor |

---

## 7. Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `CampaignCard.tsx` |
| Hooks | camelCase with `use` prefix | `useCampaigns.ts` |
| Pages | PascalCase with `Page` suffix | `LeadsPage.tsx` |
| DB tables | snake_case, plural | `voice_campaigns` |
| Edge functions | kebab-case | `trigger-telecaller-campaign` |
| CSS tokens | `--kebab-case` | `--primary-foreground` |

---

## 8. Gotchas

1. **Never edit `src/integrations/supabase/types.ts`** — it's auto-generated from the DB schema.
2. **Supabase returns max 1000 rows** by default. Use `.range()` for pagination.
3. **Service slugs in DB** use `ai-` prefix (e.g., `ai-voice-telecaller`), but routes drop it (`voice-telecaller`). Always use `getRouteSlug()`.
4. **Edge function secrets** are configured in the Supabase dashboard, not in `.env`.
5. **RLS is enabled on all tables** — queries will return empty if the user's role doesn't match the policy.

---

## 9. Further Reading

- [`DOCUMENTATION.md`](./DOCUMENTATION.md) — Full architecture, schema, and service docs
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Deployment checklist and secrets reference
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query)
