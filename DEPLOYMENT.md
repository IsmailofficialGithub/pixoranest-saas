# Deployment Guide

## Architecture

This is a **Vite + React** application with a **Supabase** backend. Lovable handles hosting and deployment automatically.

## Pre-deployment Checklist

### Application
- [ ] All tests passing (`npm run test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No TypeScript errors
- [ ] Error tracking configured (logger → store-logs edge function)

### Supabase Setup
- [ ] Database schema deployed (all migrations applied)
- [ ] RLS policies enabled on all tables
- [ ] Storage buckets created (if applicable)
- [ ] Edge Functions deployed
- [ ] Realtime enabled for required tables

### Edge Function Secrets (Supabase Dashboard → Settings → Edge Functions)
Configure these secrets as needed:

| Secret | Required For | Where to Get |
|--------|-------------|--------------|
| `N8N_WEBHOOK_URL` | Workflow automation | Your n8n instance URL |
| `N8N_API_KEY` | n8n API access | n8n Settings → API |
| `RETELL_AI_API_KEY` | Voice AI calls | [Retell AI Dashboard](https://www.retell.ai/) |
| `EXOTEL_ACCOUNT_SID` | Telephony (Exotel) | Exotel Dashboard |
| `EXOTEL_API_KEY` | Telephony (Exotel) | Exotel Dashboard |
| `EXOTEL_API_TOKEN` | Telephony (Exotel) | Exotel Dashboard |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp messaging | Meta Business Suite |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp messaging | Meta Business Suite |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp messaging | Meta Business Suite |
| `FACEBOOK_APP_ID` | Social media posting | Meta Developers |
| `FACEBOOK_APP_SECRET` | Social media posting | Meta Developers |
| `RESEND_API_KEY` | Transactional emails | [Resend Dashboard](https://resend.com/) |

### n8n Setup
- [ ] Instance deployed and accessible
- [ ] Workflow templates imported from `/n8n-workflows/`
- [ ] Credentials configured in n8n
- [ ] Webhooks tested end-to-end

### External Services
- [ ] Retell AI account and agent configured
- [ ] Telephony provider (Exotel/Twilio/Telnyx) configured
- [ ] WhatsApp Business API approved by Meta
- [ ] Social media developer apps created (Facebook, Instagram, LinkedIn, Twitter)

## Post-deployment

- [ ] Verify edge functions responding (check logs in Supabase dashboard)
- [ ] Test user authentication flow
- [ ] Test core user journeys (campaign creation, calls, messaging)
- [ ] Monitor error logs (`error_logs` table)
- [ ] Verify webhook connectivity (n8n ↔ Supabase)

## Publishing

Use the **Publish** button in Lovable to deploy to production. This pushes code and schema from the test environment to live.

> ⚠️ **Data is NOT synced between test and live environments.** If you're removing columns/tables, check live data first.

## Monitoring

- Review `error_logs` table regularly for application errors
- Check Supabase Dashboard → Edge Function logs for backend issues
- Monitor `usage_tracking` table for service consumption
- Set up external uptime monitoring on your published URL
