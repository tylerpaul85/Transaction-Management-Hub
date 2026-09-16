# MSREG Marketing Hub — Transaction Management & Sisu Sync Layer

This module provides the data layer, PostgreSQL schema, Row-Level Security (RLS) policies, Sisu integration Edge Functions, manual edit preservation, weekly agent digests, and role-based access control for the MSREG Transaction Management system in Supabase.

---

## 1. Google Workspace Authentication & Access Control

The MSREG Marketing Hub uses an **admin-managed, Google Workspace-only access model**. Public self-serve sign-up, password reset forms, and unvetted registrations are entirely disabled.

### Authentication vs. Authorization
1. **Authentication (Google OAuth SSO)**:
   - Configured with the `hd` (hosted domain) parameter set to `msreg.com` (configurable via `VITE_GOOGLE_WORKSPACE_DOMAIN`).
   - The UI provides exclusively a **"Sign in with Google"** action.
2. **Authorization (Admin-Allowlisted Profiles)**:
   - Authenticating via Google OAuth does not automatically grant application access.
   - Upon sign-in, the system queries the `public.profiles` table (`id`, `email`, `name`, `role`, `agent_id`, `ops_user_id`, `active`).
   - **Access Denied Rule**: If no matching active row exists (`active = false` or missing), the session is instantly revoked (`supabase.auth.signOut()`) and the user receives the notice:
     > *"Your account hasn't been set up yet — contact an admin."*

### Admin "Add User" & Deactivation Flow
- Inside `/ops` (Admin role only), navigate to the **"User Allowlist & Access"** tab.
- **Add User Form**: Enter the team member's Name, Google Workspace Email (`@msreg.com`), and Role (`agent`, `tc`, `listing_coordinator`, or `admin`).
- **Submit Action**:
  1. Inserts the user into `public.profiles` with `active = true`.
  2. Dispatches a branded notification email via **Resend** telling them their account is ready and instructing them to sign in with their Google Workspace credentials. (No magic link/token required).
- **Instant Deactivation**: Clicking **"Deactivate"** immediately flips `active = false`, revoking access on next request without deleting history.

---

## 2. Initial Admin Account Bootstrapping (One-Time Setup)

The very first admin account must be bootstrapped directly in Supabase once:

1. **Sign in once with Google OAuth** as the designated administrator (e.g. `admin@msreg.com`) on the login screen so Supabase creates the record in `auth.users`.
2. **Insert the admin profile in Supabase SQL Editor**:
   ```sql
   -- Bootstrapping the initial system administrator
   INSERT INTO public.profiles (
       id,
       email,
       name,
       role,
       active
   )
   VALUES (
       (SELECT id FROM auth.users WHERE email = 'admin@msreg.com'),
       'admin@msreg.com',
       'David Admin',
       'admin',
       true
   )
   ON CONFLICT (email) DO UPDATE 
   SET role = 'admin', active = true;
   ```
3. **Subsequent Users**: Once the initial admin signs in, all subsequent agents, TCs, and coordinators are added exclusively through the **"Add User"** button in `/ops`.

---

## 3. Database Schema Overview

The database layer consists of core domain tables, Sisu sync tables, and digest logs:

### Core Tables
- `public.profiles` — Admin allowlist extending Supabase Auth users with roles (`'agent' | 'tc' | 'listing_coordinator' | 'admin'`), active flags, and agent/ops links.
- `public.agents` — Agent roster (`id`, `profile_id`, `name`, `email`, `phone`, `sisu_agent_id`, `active`).
- `public.ops_users` — Operations coordinators & admins (`id`, `profile_id`, `name`, `email`, `role: ops_role`).
- `public.transactions` — Core contract-to-close records (`id`, `sisu_transaction_id`, `status`, `property_address`, `city`, `side`, `client_name`, `client_phone`, `other_party_name`, `other_party_agent`, `listing_agent_id`, `selling_agent_id`, `assigned_tc_id`, `contract_date`, `created_at`, `updated_at`).
- `public.milestones` — Escrow milestone checklists (`id`, `transaction_id`, `milestone_type`, `target_date`, `actual_date`, `status`, `source: 'sisu' | 'manual'`, `notes`, `updated_at`, `updated_by`).

### Sisu Sync & Logging Tables
- `public.sisu_webhook_log` — Raw webhook payload ingestion logging (`payload`, `headers`, `event_type`, `transaction_id`, `received_at`, `processed`, `error`).
- `public.sync_conflicts` — Stores conflicts when Sisu attempts to overwrite milestones where `source = 'manual'`.
- `public.reconciliation_runs` — Audit log of nightly reconciliation job executions (`run_at`, `transactions_checked`, `transactions_updated`, `conflicts_found`, `duration_ms`, `status`, `details`).
- `public.digest_log` — Weekly agent digest delivery audit log (`agent_id`, `sent_at`, `transaction_count`, `resend_message_id`, `status`, `error`).

---

## 4. Sisu → Supabase Sync Architecture

### 1. `sisu-webhook-receiver` Edge Function
File: [supabase/functions/sisu-webhook-receiver/index.ts](supabase/functions/sisu-webhook-receiver/index.ts)
- **Signature & Secret Verification**: Verifies incoming `x-sisu-signature` or `x-sisu-secret` header against `SISU_WEBHOOK_SECRET`.
- **Delta vs Full Payload Resolution**: Fetches complete objects from Sisu GET API (`https://beta.sisu.co/api/v1/transactions/${id}`) when needed.
- **Manual Edit Protection Rule**: For milestones where `source = 'manual'` and updated after Sisu, logs a `sync_conflicts` row and prevents CRM overwrite.

### 2. `sisu-nightly-reconciliation` Scheduled Function
File: [supabase/functions/sisu-nightly-reconciliation/index.ts](supabase/functions/sisu-nightly-reconciliation/index.ts)
- Runs nightly to reconcile local transaction state with Sisu CRM.

### 3. `weekly-agent-digest` Edge Function
File: [supabase/functions/weekly-agent-digest/index.ts](supabase/functions/weekly-agent-digest/index.ts)
- Runs every Monday at 7:00 AM Central (`0 7 * * 1`).
- Evaluates active transactions for all active agents and sends a customized summary email via Resend, highlighting overdue milestones in red. Skips agents with 0 deals.

---

## 5. Applying Migrations

1. Run initial transaction management schema:
   `supabase/migrations/20260916000001_transaction_management.sql`
2. Run Sisu sync & logging tables migration:
   `supabase/migrations/20260916000002_sisu_sync_tables.sql`
3. Run weekly agent digest logging migration:
   `supabase/migrations/20260916000003_digest_log.sql`
4. Run Google Workspace auth & profiles allowlist migration:
   `supabase/migrations/20260916000004_google_workspace_auth_profiles.sql`
5. Populate seed data:
   `supabase/seed.sql`
