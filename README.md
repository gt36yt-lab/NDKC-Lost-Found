# NDKC Lost & Found

Next.js App Router application for Notre Dame of Kidapawan College. Students authenticate with their student ID, browse public lost/found reports, and submit reports with optional photos.

## Requirements

- Node.js 20+
- A Supabase project
- A college logo and campus photo (optional, see Branding)

## Local setup

1. Install packages: `npm install`
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and anon key.
3. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql).
4. In Supabase Authentication settings, turn off **Confirm email**. Student accounts use internal addresses such as `studentid@ndkc.edu.ph`; those addresses cannot receive confirmation mail. Enable a strong password policy and configure rate limits before production.
5. Start the app: `npm run dev`

Signup uses a student ID in the form `3–32 letters, numbers, or hyphens`, plus a password of at least 8 characters. `profiles` is populated by a database trigger from trusted-at-signup Auth metadata. The optional email is kept in Auth metadata and can be supplied as the report contact email.

## Environment variables

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key; never put a service-role key in the browser |
| `NEXT_PUBLIC_LOST_AND_FOUND_EMAIL` | Optional office contact address for the dashboard mail shortcut |

## Deploy to Vercel

Import the project into Vercel, set both environment variables for the appropriate deployment environments, and deploy. Vercel automatically detects Next.js. Run `npm run typecheck` and `npm run build` before release.

## Branding

The interface uses the supplied `public/School-bg.jpg` campus photo for the login and signup background and `public/Logo.jpg` for the official college seal. Keep these filenames' capitalization when deploying to a case-sensitive host.

## Admin access and migrations

Run the current [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor to add profile metadata, admin access policies, report status management, and notifications. Promote an administrator from the SQL Editor using the exact student ID, for example:

```sql
update public.profiles
set is_admin = true
where student_id = 'YOUR_STUDENT_ID';
```

Only trusted project administrators should run that statement. The `/admin` route checks the database `profiles.is_admin` value, while RLS independently enforces report and profile access.

## Data protection notes

- The `public_reports` SQL view exposes item details and location but omits reporter names, student IDs, email addresses, and phone numbers.
- The underlying `reports` table has RLS; authenticated users can insert reports and read only their own complete report rows.
- Photos are publicly viewable by design. Uploads are restricted to authenticated users and an object path whose first folder is the uploader's auth UUID.
- Supabase SQL policies are not a substitute for college moderation procedures. Review access, retention, consent, and disclosure requirements before production.
