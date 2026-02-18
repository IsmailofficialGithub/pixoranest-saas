# Project Documentation

## 1. Project Overview

This is a **multi-tenant SaaS platform** for AI-powered communication services. It enables resellers (Admins) to white-label and sell AI voice, WhatsApp, and social media automation services to their end-user Clients.

**Three-tier user hierarchy:**

| Role | Description |
|------|-------------|
| **Super Admin** | Platform owner. Manages the service catalog, onboards Admins, controls n8n workflows, views all analytics. |
| **Admin (Reseller)** | Manages their own Clients, sets custom pricing with markup, configures white-label branding (logo, colors, custom domain), assigns services. |
| **Client (End User)** | Uses assigned AI services, views usage/billing, manages leads and campaigns. |

**Tech stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase (Auth, Postgres, Edge Functions, Realtime) + n8n workflow automation.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React SPA (Vite)                      │
│  ┌──────────────┬──────────────┬──────────────────────┐  │
│  │ /super-admin │   /admin     │      /client         │  │
│  │  (platform)  │  (reseller)  │    (end user)        │  │
│  └──────┬───────┴──────┬───────┴──────────┬───────────┘  │
│         │              │                  │              │
│         └──────────────┼──────────────────┘              │
│                        │                                 │
│              AuthContext / RoleGuard                      │
└────────────────────────┼─────────────────────────────────┘
                         │ Supabase JS Client
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase Backend                       │
│  ┌────────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │  Auth       │ │ Postgres │ │   Edge Functions       │ │
│  │ (email/pw)  │ │ (23 tbl) │ │  manage-admin/client   │ │
│  │             │ │  + RLS   │ │  trigger-campaign      │ │
│  │             │ │  + Views │ │  score-lead            │ │
│  └────────────┘ └──────────┘ │  handle-call-status    │ │
│                               │  clone-workflow        │ │
│                               │  store-logs            │ │
│                               └────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │ Webhooks / API calls
                          ▼
┌─────────────────────────────────────────────────────────┐
│               External Integrations                      │
│  ┌───────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │ Retell AI  │ │ Exotel /   │ │  Meta WhatsApp       │  │
│  │ (Voice AI) │ │ Twilio     │ │  Business API        │  │
│  └───────────┘ └────────────┘ └──────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐   │
│  │          n8n (Workflow Automation)                  │   │
│  │  Orchestrates campaigns, posting, webhooks         │   │
│  └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Frontend Routing

- `/` — Landing page
- `/login` — Shared login (redirects by role)
- `/super-admin/*` — Super Admin dashboard (nested routes via `SuperAdminDashboard.tsx`)
- `/admin/*` — Admin/Reseller dashboard (nested routes via `AdminDashboard.tsx`)
- `/client/*` — Client dashboard (nested routes via `ClientLayout.tsx` with `<Outlet>`)

### Key Frontend Patterns

- **Context Providers**: `AuthContext` (session + role), `AdminContext` (branding + admin profile), `ClientContext` (client profile + assigned services + admin branding)
- **Protected Routes**: `<ProtectedRoute allowedRoles={["client"]}>` wraps role-gated sections
- **Dynamic Sidebar**: Client sidebar is built dynamically from `assignedServices` using `src/lib/service-routes.ts` mappings
- **White-Label Branding**: Admin's `primary_color`/`secondary_color`/`logo_url` applied via CSS custom properties in `AdminContext` and `ClientContext`

---

## 3. User Roles & Access

### Super Admin
| Capability | Route | Page |
|---|---|---|
| Dashboard overview | `/super-admin` | `DashboardHome` |
| Manage service catalog | `/super-admin/services` | `ServicesPage` |
| Onboard & manage Admins | `/super-admin/admins` | `AdminsPage` |
| View all Clients | `/super-admin/clients` | `ClientsPage` |
| n8n workflow controller | `/super-admin/n8n-controller` | `N8nControllerPage` |
| Platform analytics | `/super-admin/analytics` | `AnalyticsPage` |
| Platform settings | `/super-admin/settings` | `SettingsPage` |

### Admin (Reseller)
| Capability | Route |
|---|---|
| Dashboard | `/admin` |
| Manage own Clients | `/admin/clients` |
| Service catalog (assigned) | `/admin/services` |
| Custom pricing setup | `/admin/pricing` |
| White-label settings | `/admin/white-label` |
| Voice/WhatsApp/Social pages | `/admin/voice-telecaller`, etc. |
| Analytics & Billing | `/admin/analytics`, `/admin/billing` |

### Client (End User)
| Capability | Route |
|---|---|
| Dashboard | `/client` |
| Voice Telecaller | `/client/voice-telecaller` |
| Voice Receptionist | `/client/voice-receptionist` |
| Voice Agent | `/client/voice-agent` |
| WhatsApp | `/client/whatsapp` |
| Social Media | `/client/social-media` |
| Leads | `/client/leads` |
| Usage & Billing | `/client/usage` |
| Analytics | `/client/analytics` |
| Settings | `/client/settings` |

> **Note:** Clients only see sidebar items for services assigned to them via `client_services`.

---

## 4. Authentication Flow

```
User visits /login
       │
       ▼
Email + Password → Supabase Auth (signInWithPassword)
       │
       ▼
onAuthStateChange fires → fetchUserProfile(userId)
       │
       ├─ Query `profiles` table (name, email, phone)
       ├─ Query `user_roles` table (role)
       │
       ▼
AuthContext populated: { session, user, profile: { role } }
       │
       ▼
Login page redirects to getRedirectPath(role):
  - super_admin → /super-admin
  - admin       → /admin
  - client      → /client
       │
       ▼
ProtectedRoute checks:
  1. Session exists? (else → /login)
  2. Profile loaded & role in allowedRoles? (else → /login)
  3. ✅ Render children
```

**Key files:**
- `src/contexts/AuthContext.tsx` — Session management, profile fetching, role-based redirect
- `src/components/ProtectedRoute.tsx` — Route guard component
- `src/pages/Login.tsx` — Login form

---

## 5. Service Enablement Hierarchy

Services flow through a three-level enablement chain:

```
Super Admin                    Admin                       Client
┌────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│ Creates service │    │ Gets service        │    │ Gets service     │
│ in `services`   │───▶│ via `admin_service_ │───▶│ via `client_     │
│ catalog         │    │ assignments`        │    │ services`        │
└────────────────┘    └─────────────────────┘    └──────────────────┘
```

1. **Super Admin** creates services in the `services` table (5 core services with slugs like `ai-voice-telecaller`)
2. **Super Admin** assigns services to specific Admins via `admin_service_assignments` (toggle `is_enabled`)
3. **Admin** activates services for their Clients via `client_services` (sets `usage_limit`, optional `plan_id`)
4. **Client's sidebar** dynamically renders only assigned services by querying `client_services` joined with `services`

### The 5 Core Services

| Service | DB Slug | Route Slug | Description |
|---|---|---|---|
| AI Voice Telecaller | `ai-voice-telecaller` | `voice-telecaller` | Outbound AI calling campaigns |
| AI Voice Receptionist | `ai-voice-receptionist` | `voice-receptionist` | Inbound AI call handling |
| AI Voice Agent | `ai-voice-agent` | `voice-agent` | General-purpose voice AI |
| WhatsApp Automation | `whatsapp-automation` | `whatsapp` | WhatsApp messaging & campaigns |
| Social Media Automation | `social-media-automation` | `social-media` | Multi-platform social posting |

> Slug mapping between DB and routes is handled by `src/lib/service-routes.ts`.

---

## 6. Core Services — Detailed

### AI Voice Telecaller
- **Purpose**: Run outbound AI calling campaigns
- **Workflow**: Create Campaign → Upload CSV contacts → Configure AI script → Schedule/Launch → Monitor progress → View call logs → Score leads
- **Key components**: `CreateCampaignWizard`, `CSVUploadWizard`, `CallLogsTable`, `RealtimeCampaignProgress`
- **Tables**: `voice_campaigns`, `campaign_contacts`, `call_logs`, `leads`
- **Edge functions**: `trigger-telecaller-campaign`, `handle-call-status`, `score-lead`

### AI Voice Receptionist
- **Purpose**: Handle inbound calls with AI
- **Features**: Call routing, AI-powered responses, transcripts, call summaries
- **Tables**: `call_logs` (with `call_type = 'inbound'`)

### AI Voice Agent
- **Purpose**: General-purpose voice AI assistant
- **Features**: Test calls, performance metrics, configuration
- **Key components**: `TestCallButton`
- **Integration**: Retell AI (`src/lib/integrations/retell-ai.ts`)

### WhatsApp Automation
- **Purpose**: Send messages and run WhatsApp campaigns
- **Features**: Individual messaging, bulk campaigns, template management, delivery tracking
- **Key components**: `WhatsAppComposer`
- **Tables**: `whatsapp_campaigns`, `whatsapp_messages`
- **Integration**: Meta WhatsApp Business API (`src/lib/integrations/whatsapp.ts`)

### Social Media Automation
- **Purpose**: Post to multiple social platforms
- **Features**: Multi-platform posting, scheduling, engagement analytics, platform connection
- **Key components**: `ConnectSocialPlatform`
- **Tables**: `social_media_posts`
- **Integration**: Social media APIs (`src/lib/integrations/social-media.ts`)

---

## 7. Key Workflows

### Campaign Creation (Voice Telecaller)
```
1. Client clicks "New Campaign"
2. CreateCampaignWizard opens (multi-step)
3. Step 1: Campaign name & type
4. Step 2: Upload CSV → CSVUploadWizard validates & previews contacts
5. Step 3: Configure AI script / prompt
6. Step 4: Schedule or launch immediately
7. Campaign saved to `voice_campaigns`, contacts to `campaign_contacts`
8. Edge function `trigger-telecaller-campaign` kicks off calls via n8n
9. `handle-call-status` webhook receives call updates
10. `score-lead` processes transcripts into lead scores
```

### Lead Management Pipeline
```
New → Contacted → Qualified → Converted
                            → Lost
```
- Leads are auto-created from call results or manually added
- Fields: name, phone, email, company, lead_score, interest_level, tags
- Managed in `LeadsPage` with `LeadsTable` (sortable, filterable, bulk actions)

### Usage Tracking & Billing
- `usage_tracking` records per-unit consumption (calls made, messages sent, etc.)
- `client_services.usage_consumed` tracks aggregate usage against `usage_limit`
- `invoices` + `invoice_items` for billing
- `admin_pricing` allows Admins to set markup over base service prices
- `RealtimeUsageMeter` component shows live usage

### White-Label Branding
- Admin sets `primary_color`, `secondary_color`, `logo_url`, `custom_domain` in `admins` table
- `AdminContext` applies CSS custom properties (`--admin-primary`, `--admin-secondary`)
- `ClientContext` inherits admin branding so clients see their admin's brand
- Sidebar, headers, and active states use these dynamic colors

---

## 8. Database Schema

### Auth & Identity
| Table | Purpose | Key Columns |
|---|---|---|
| `profiles` | User profile data | `user_id`, `email`, `full_name`, `phone` |
| `user_roles` | Role assignment | `user_id`, `role` (super_admin / admin / client) |

### Organization
| Table | Purpose | Key Columns |
|---|---|---|
| `admins` | Reseller organizations | `user_id`, `company_name`, `primary_color`, `logo_url`, `custom_domain`, `commission_rate` |
| `clients` | End-user organizations | `user_id`, `admin_id` (FK→admins), `company_name`, `industry` |

### Services & Pricing
| Table | Purpose | Key Columns |
|---|---|---|
| `services` | Service catalog | `name`, `slug`, `base_price`, `base_pricing_model`, `category` |
| `service_plans` | Tiered plans per service | `service_id`, `plan_name`, `plan_tier`, `monthly_price`, `usage_limit` |
| `admin_service_assignments` | Which admins can resell which services | `admin_id`, `service_id`, `is_enabled` |
| `client_services` | Which services a client has access to | `client_id`, `service_id`, `usage_limit`, `usage_consumed`, `plan_id` |
| `admin_pricing` | Admin-specific markup pricing | `admin_id`, `service_id`, `markup_percentage`, `custom_price_per_unit` |

### Voice
| Table | Purpose |
|---|---|
| `voice_campaigns` | Campaign metadata (name, status, schedule, script, contact counts) |
| `campaign_contacts` | Individual contacts within a campaign |
| `call_logs` | Call records (status, duration, transcript, AI summary, cost) |
| `leads` | Leads generated from calls (score, status, follow-up date, tags) |

### WhatsApp
| Table | Purpose |
|---|---|
| `whatsapp_campaigns` | WhatsApp campaign metadata |
| `whatsapp_messages` | Individual message records with delivery status |

### Social Media
| Table | Purpose |
|---|---|
| `social_media_posts` | Posts with platform, content, schedule, engagement stats |

### Workflows (n8n)
| Table | Purpose |
|---|---|
| `workflow_templates` | Master workflow templates managed by Super Admin |
| `client_workflow_instances` | Cloned workflow instances per client |
| `client_workflow_credentials` | Credentials for client workflow integrations |
| `workflow_executions` | Execution logs per workflow instance |

### Messaging
| Table | Purpose |
|---|---|
| `conversations` | Admin↔Client conversation threads |
| `messages` | Individual messages within conversations |

### Billing
| Table | Purpose |
|---|---|
| `invoices` | Invoice headers (client, admin, amounts, status) |
| `invoice_items` | Line items per invoice |
| `usage_tracking` | Granular usage records (type, quantity, cost) |

### System
| Table | Purpose |
|---|---|
| `notifications` | User notifications (type, title, message, read status) |
| `audit_logs` | Action audit trail (who did what, old/new values) |
| `error_logs` | Centralized error logging |
| `platform_settings` | Key-value platform configuration |

### Views
| View | Purpose |
|---|---|
| `campaign_stats` | Aggregated campaign statistics (calls made, answered, leads generated, avg duration) |

---

## 9. Edge Functions

All edge functions are deployed via Supabase and configured in `supabase/config.toml`.

| Function | Purpose | Trigger |
|---|---|---|
| `manage-admin` | Creates admin user: auth account + profile + user_role + admins record | Called by Super Admin UI |
| `manage-client` | Creates client user: auth account + profile + user_role + clients record | Called by Admin UI |
| `clone-workflow-for-client` | Clones an n8n workflow template into a client-specific instance | Called when activating a service for a client |
| `activate-client-workflow` | Activates or deactivates a client's workflow instance | Called from workflow management UI |
| `trigger-telecaller-campaign` | Kicks off an outbound voice campaign via n8n | Called when client launches a campaign |
| `handle-call-status` | Webhook receiver for call status updates from telephony provider | Called by Exotel/Twilio webhook |
| `score-lead` | AI-based lead scoring from call transcripts | Called after call completion |
| `store-logs` | Centralized error logging endpoint | Called by frontend error handler |

> **Note:** All functions have `verify_jwt = false` in config for webhook compatibility. Authentication is handled internally where needed.

---

## 10. Security Model

### Row-Level Security (RLS)
All tables have RLS enabled. Access is enforced at the database level:

| Role | Access Pattern |
|---|---|
| **Super Admin** | Can read/write all records across all tables |
| **Admin** | Can only access records belonging to their own clients (`clients.admin_id = admin.id`) |
| **Client** | Can only access their own records (`client_id = client.id`) |

### Helper Functions (Postgres)
| Function | Purpose |
|---|---|
| `is_super_admin()` | Returns true if current user has `super_admin` role |
| `has_role(_role, _user_id)` | Checks if a user has a specific role |
| `get_admin_id_for_user()` | Returns the admin ID for the current authenticated user |
| `get_client_admin_id()` | Returns the admin ID that owns the current client |
| `increment_usage(p_amount, p_client_id, p_service_slug)` | Atomically increments usage counter |
| `cleanup_old_notifications()` | Housekeeping for old notification records |

### Frontend Security
- `ProtectedRoute` component blocks access to role-gated routes
- `AuthContext` clears session data on logout
- API keys for external services are stored as Supabase secrets, never in frontend code

---

## 11. Tech Stack Reference

### Core
| Package | Purpose |
|---|---|
| `react` + `react-dom` | UI framework |
| `vite` | Build tool & dev server |
| `typescript` | Type safety |
| `tailwindcss` + `tailwindcss-animate` | Utility-first CSS |
| `@supabase/supabase-js` | Supabase client (auth, DB, realtime, storage) |

### UI Components
| Package | Purpose |
|---|---|
| `shadcn/ui` (Radix primitives) | Accessible component library |
| `lucide-react` | Icon set |
| `recharts` | Charts and data visualization |
| `sonner` | Toast notifications |
| `cmdk` | Command palette |
| `vaul` | Drawer component |
| `react-colorful` | Color picker (white-label settings) |
| `embla-carousel-react` | Carousel component |

### Data & State
| Package | Purpose |
|---|---|
| `@tanstack/react-query` | Server state management, caching, auto-refetch |
| `@tanstack/react-table` | Headless table with sorting, filtering, pagination |
| `react-hook-form` + `zod` | Form management with schema validation |
| `@hookform/resolvers` | Zod resolver for react-hook-form |

### Utilities
| Package | Purpose |
|---|---|
| `date-fns` | Date formatting and manipulation |
| `papaparse` | CSV parsing for contact uploads |
| `jspdf` + `jspdf-autotable` | PDF generation for exports/invoices |
| `class-variance-authority` | Component variant management |
| `clsx` + `tailwind-merge` | Conditional class merging |

### Routing & PWA
| Package | Purpose |
|---|---|
| `react-router-dom` | Client-side routing |
| `vite-plugin-pwa` | Progressive Web App support |

### Drag & Drop
| Package | Purpose |
|---|---|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag and drop interactions (e.g., Kanban boards) |

---

## 12. Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (button, card, dialog, etc.)
│   ├── admin/           # Admin-specific components (sidebar, header, modals)
│   ├── client/          # Client-specific components (sidebar, header, nav)
│   ├── super-admin/     # Super Admin components (forms, dialogs)
│   ├── tables/          # Reusable data tables (DataTable, LeadsTable, CallLogsTable)
│   ├── skeletons/       # Loading skeleton components
│   ├── csv/             # CSV upload wizard steps
│   └── ...              # Feature components (WhatsAppComposer, TestCallButton, etc.)
├── contexts/            # React contexts (Auth, Admin, Client)
├── hooks/               # Custom hooks (useCampaigns, useWhatsApp, useSocialMedia, etc.)
├── lib/
│   ├── integrations/    # External API wrappers (retell-ai, whatsapp, telephony, social-media)
│   ├── service-routes.ts # Service slug ↔ route mapping
│   └── utils.ts         # Shared utilities
├── pages/
│   ├── super-admin/     # Super Admin pages
│   ├── admin/           # Admin pages
│   └── client/          # Client pages
└── integrations/
    └── supabase/        # Supabase client & generated types

supabase/
├── functions/           # Edge Functions (manage-admin, trigger-campaign, etc.)
├── config.toml          # Function configuration
└── migrations/          # Database migrations

n8n-workflows/           # n8n workflow JSON templates
```
