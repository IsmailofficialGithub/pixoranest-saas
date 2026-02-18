
# Project Documentation

Create a comprehensive `DOCUMENTATION.md` file at the project root that explains the full working of this multi-tenant AI services SaaS platform.

## Document Structure

### 1. Project Overview
- Multi-tenant SaaS platform for AI-powered communication services
- Three-tier user hierarchy: Super Admin, Admin (resellers), Client (end users)
- Built with React + Vite + TypeScript + Supabase

### 2. Architecture Section
- **Frontend**: React SPA with role-based routing (`/super-admin/*`, `/admin/*`, `/client/*`)
- **Backend**: Supabase (auth, Postgres DB with RLS, Edge Functions, Realtime)
- **Workflow Automation**: n8n integration for campaign execution and external API orchestration
- **External Integrations**: Retell AI (voice), Exotel/Twilio (telephony), Meta WhatsApp Business API, social media APIs

### 3. User Roles and Access
- **Super Admin**: Platform owner -- manages services catalog, onboards admins, views all analytics, controls n8n workflows, platform settings
- **Admin (Reseller)**: Manages their own clients, sets custom pricing with markup, white-label branding (logo, colors, custom domain), assigns services to clients
- **Client**: End user who uses assigned AI services (voice telecaller, receptionist, agent, WhatsApp, social media), views usage/billing, manages leads

### 4. Authentication Flow
- Email/password login via Supabase Auth
- Post-login role lookup from `user_roles` table
- Automatic redirect to role-specific dashboard (`/super-admin`, `/admin`, `/client`)
- Protected routes enforce role-based access via `ProtectedRoute` component

### 5. Service Enablement Hierarchy
- Super Admin creates services in the catalog (5 core services)
- Super Admin assigns services to Admins via `admin_service_assignments`
- Admins activate services for their Clients via `client_services`
- Clients only see services assigned to them in their sidebar/dashboard

### 6. Core Services Documentation
- **AI Voice Telecaller**: Outbound calling campaigns with CSV contact upload, AI scripts, call logs, lead scoring
- **AI Voice Receptionist**: Inbound call handling with AI, call routing, transcripts
- **AI Voice Agent**: General-purpose voice AI with performance metrics
- **WhatsApp Automation**: Message sending, campaigns, template management, delivery tracking
- **Social Media Automation**: Multi-platform posting, scheduling, engagement analytics

### 7. Key Workflows
- Campaign creation (wizard flow with CSV upload, script config, scheduling)
- Lead management pipeline (new, contacted, qualified, converted, lost)
- Usage tracking and billing (per-unit and monthly subscription models)
- White-label branding (CSS custom properties applied via context providers)

### 8. Database Schema Overview (23 tables)
- Auth/identity: `profiles`, `user_roles`
- Organization: `admins`, `clients`
- Services: `services`, `service_plans`, `admin_service_assignments`, `client_services`, `admin_pricing`
- Voice: `voice_campaigns`, `campaign_contacts`, `call_logs`, `leads`
- WhatsApp: `whatsapp_campaigns`, `whatsapp_messages`
- Social: `social_media_posts`
- Workflows: `client_workflow_instances`, `client_workflow_credentials`
- Messaging: `conversations`, `messages`
- Billing: `invoices`, `invoice_items`, `usage_tracking`
- System: `notifications`, `audit_logs`, `error_logs`, `platform_settings`

### 9. Edge Functions
- `manage-admin` / `manage-client`: User provisioning (creates auth user + profile + role + org record)
- `clone-workflow-for-client`: Clones n8n workflow templates for client-specific instances
- `activate-client-workflow`: Activates/deactivates workflow instances
- `trigger-telecaller-campaign`: Kicks off outbound voice campaigns
- `handle-call-status`: Webhook receiver for call status updates from telephony
- `score-lead`: AI-based lead scoring from call transcripts
- `store-logs`: Centralized error logging endpoint

### 10. Security Model
- Row-Level Security (RLS) on all tables
- Hierarchical access: Super Admin sees all, Admins see their clients only, Clients see own data only
- Helper functions: `is_super_admin()`, `has_role()`, `get_admin_id_for_user()`

### 11. Tech Stack Reference
Quick reference of all key dependencies and their purpose

## Implementation Details

**File to create**: `DOCUMENTATION.md` (project root)

**Estimated size**: ~300-400 lines of well-structured Markdown covering all sections above with clear headings, tables for the database schema, and ASCII diagrams for the architecture flow.
