

## Plan: Persist ZIP Through the Magic Link Signup Flow

### Problem
The ZIP code entered on the homepage is stored only in React state. When the user submits their email and clicks the magic link, they land on `/dashboard` with no ZIP in their profile. The ZIP is lost.

### Solution
Thread the ZIP through the magic link using Supabase OTP metadata, then auto-save it to the profile on sign-in.

### Changes

**1. Pass ZIP as metadata in the OTP call** (`src/components/EmailNotificationForm.tsx`)
- Add `data: { zip_code: zipCode }` to the `signInWithOtp` options
- Supabase stores this in `raw_user_meta_data` on the auth.users row

**2. Update the profile trigger to capture ZIP** (new migration)
- Modify `handle_new_user()` to read `NEW.raw_user_meta_data->>'zip_code'` and write it to `profiles.zip_code` if present
- This means brand-new users get their ZIP saved automatically at account creation

**3. Handle returning users** (`src/contexts/AuthContext.tsx`)
- In `onAuthStateChange` for `SIGNED_IN`: if the user's profile has no `zip_code`, check `user.user_metadata.zip_code` and update the profile
- Remove the early return for `/dashboard` so the zip_code check always runs
- If zip_code is still missing (no metadata either), redirect to `/onboarding`
- If zip_code exists, stay on `/dashboard`

**4. Pre-fill onboarding ZIP from metadata** (`src/pages/Onboarding.tsx`)
- On mount, check `user.user_metadata.zip_code` and pre-fill the ZIP input if available
- This covers edge cases where the trigger didn't fire (e.g., returning user who signed up before this change)

### Technical details
- `signInWithOtp({ email, options: { data: { zip_code }, emailRedirectTo } })` — the `data` field maps to `raw_user_meta_data`
- The trigger change uses `CREATE OR REPLACE FUNCTION` so it's safe to re-run
- Returning users won't have the trigger fire again, which is why step 3 handles them client-side

