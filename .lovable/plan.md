

## Plan: Fix Contact Form Email Flow & Sender Details

### What's wrong now
- Contact form only sends a confirmation to the **submitter** — admin never gets notified
- Sender name says "grass-buddy-bot" instead of "Thirsty Grass"
- From/reply-to aren't set to admin@110labs.com

### Changes

**1. Update sender config in `send-transactional-email/index.ts`**
- Change `SITE_NAME` from `"grass-buddy-bot"` to `"Thirsty Grass"`
- Change the `from` field to use `admin@110labs.com` instead of `noreply@thirstygrass.com`
- Add `reply_to: "admin@110labs.com"` to the enqueue payload

**2. Create admin notification template**
- New file: `supabase/functions/_shared/transactional-email-templates/contact-admin-notification.tsx`
- Sends to admin@110labs.com with the submitter's name, email, and message
- Subject: "New contact form submission from [name]"
- Uses `to: Deno.env.get('ADMIN_EMAILS')` or hardcodes `admin@110labs.com` as the fixed recipient

**3. Register template in `registry.ts`**
- Import and add `contact-admin-notification` to the TEMPLATES map
- Set `to: "admin@110labs.com"` so the template always sends to admin regardless of caller input

**4. Update Contact.tsx to send both emails**
- After the existing confirmation email call, add a second `supabase.functions.invoke` for `contact-admin-notification` passing `{ name, email, message }` as templateData

**5. Redeploy edge functions**
- Deploy `send-transactional-email` to pick up the sender name/from/reply-to changes and new template

### Technical details
- The `reply_to` field needs to be added to the enqueue payload in `send-transactional-email/index.ts` and forwarded by `process-email-queue`
- The admin notification template uses the `to` field on `TemplateEntry` so the Edge Function routes it to admin regardless of `recipientEmail`

