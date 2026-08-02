# Netlify and Supabase authentication troubleshooting

This application initializes authentication in `StoreProvider`; it does not currently expose a separate `useAuth` hook. The provider is the effective auth hook for the application gate, so its initial session restore now has a 12-second fallback that always releases the “Signing you in…” screen.

## 1. Verify Netlify build-time environment variables

Vite replaces `VITE_*` variables while the site is built. Adding them only to a local shell, a runtime function, or a different Netlify deploy context does not place them in the browser bundle.

1. Open the Netlify project for `orthodox-connect`.
2. Go to **Project configuration → Environment variables**.
3. Confirm both names exist exactly as written:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Confirm each variable is available to **Builds** and to every required deploy context:
   - Production
   - Deploy Previews
   - Branch deploys, if used
5. Use the Supabase project URL for `VITE_SUPABASE_URL` and only the browser-safe anon or publishable key for `VITE_SUPABASE_ANON_KEY`. Never place a service-role or secret key in a `VITE_*` variable.
6. Trigger a new deploy after changing a variable. Existing Vite artifacts do not change when environment settings change.

The repository runs a safe structural check automatically before `vite build`:

```bash
npm run check:auth-env
```

It reports only whether the values are present and structurally valid; it never prints either value. To inspect a Netlify context without displaying values, authenticate the Netlify CLI and pipe its dotenv output into the same validator:

```bash
netlify env:list --plain --scope builds --context production | node scripts/check-supabase-env.mjs --stdin-dotenv
netlify env:list --plain --scope builds --context deploy-preview | node scripts/check-supabase-env.mjs --stdin-dotenv
```

If the CLI reports an expired session, re-authenticate before running the remote checks. A local successful check proves only that the current shell is configured; it does not prove that Netlify’s production or Deploy Preview build context is configured.

After deployment, open the browser console. A missing or malformed build-time value produces this application error without exposing the key:

```text
Supabase is not configured correctly: a valid endpoint ... and VITE_SUPABASE_ANON_KEY must be set.
```

## 2. Configure Supabase origins and redirect URLs

In the Supabase dashboard, open **Authentication → URL Configuration**.

1. Set **Site URL** to the canonical production origin:

   ```text
   https://orthodox-connect.netlify.app
   ```

   Replace it if the site uses a custom production domain.

2. Add every exact callback origin/path used by the app to **Redirect URLs**. For a single-page app that returns to the root, use:

   ```text
   https://orthodox-connect.netlify.app/**
   http://localhost:8889/**
   ```

3. If Netlify Deploy Previews use the standard generated hostname, add the narrow preview wildcard supported by Supabase:

   ```text
   https://**--orthodox-connect.netlify.app/**
   ```

4. Prefer an exact production URL over a broad wildcard. Keep wildcard entries for previews and branch deploys only.
5. Ensure every OAuth provider’s callback URL points to the Supabase callback endpoint shown by Supabase, not directly to the Netlify page.

Supabase Auth redirect allow-listing and browser CORS are separate concerns. Hosted Supabase APIs already return the browser CORS headers needed by `supabase-js`; there is normally no project-level dashboard field where a Netlify origin must be added for standard Auth API calls. If a request is blocked by CORS:

1. Confirm the browser is calling the real Supabase project URL, not the placeholder client or an incorrect proxy.
2. Inspect the failed request URL and response in DevTools. A redirect, HTML error page, DNS proxy, or custom edge layer often appears as a CORS error even though the root cause is upstream.
3. If `VITE_SUPABASE_PROXY_URL` is configured, add CORS handling on that proxy for the production and preview origins, including `OPTIONS` requests and the `authorization`, `apikey`, `content-type`, and `x-client-info` headers.
4. Do not use `Access-Control-Allow-Origin: *` together with credentialed requests. Reflect only approved Netlify origins and include `Vary: Origin` on a custom proxy.

## 3. Confirm the auth fallback behavior

The initial provider restore performs three operations: Supabase session verification, Netlify Identity restoration, and `/api/session` loading. Previously, any unresolved promise prevented `AUTH_CHECKED` from being dispatched, so the gate could remain on “Signing you in…” forever.

The provider now starts a 12-second timer when authentication restoration begins. Normal success or failure clears the timer and marks auth as checked. If a network call never settles, the timer marks auth as checked and logs a timeout without exposing credentials. A signed-out browser sees the login page; a browser with cached member state can remain usable while the late session request continues in the background.

Use DevTools to test the fallback:

1. Open the deployed site in a private window and open the Network panel.
2. Block the Supabase auth hostname or set the network to Offline before reloading.
3. Confirm “Signing you in…” disappears after approximately 12 seconds.
4. Restore connectivity and verify a normal sign-in completes.
5. Check `/api/session` separately. A `401` or `403` should produce a signed-out state; a hanging request should no longer trap the entire UI.

## Code review findings

- `src/lib/config.ts` correctly reads Vite variables through `import.meta.env`, validates the URL, strips accidental quoting, and keeps the key out of logs.
- `src/lib/supabase.ts` avoids a startup crash when configuration is absent, but its placeholder client means the console warning is essential during deployment troubleshooting.
- `src/store/StoreProvider.tsx` had a sound `finally` fallback for rejected promises, but no protection against promises that never settled. The new deadline closes that gap.
- The current email/password form authenticates through Netlify Identity, not `supabase.auth`. Supabase URL and key configuration still affects the separate Supabase session validation and storage client, but Supabase redirect URLs do not control the existing Netlify Identity login form.
- The app combines Supabase session validation with Netlify Identity state. Troubleshooting must therefore inspect both the Supabase request and `/api/session`; a successful Supabase session alone does not guarantee that the application session endpoint can identify the user.
- The `/api/session` request previously omitted the Identity bearer token, while the function called `requireAppUser` without its request object. Both sides now pass the request credentials explicitly so the session endpoint can resolve the signed-in Identity user.
- The repository still depends on `netlify-identity-widget`, so changing auth providers or removing the Identity bridge requires a separate migration and is outside this targeted fix.

## Official references

- Netlify environment variables: https://docs.netlify.com/build/configure-builds/environment-variables/
- Netlify deploy contexts: https://docs.netlify.com/build/configure-builds/file-based-configuration/#deploy-contexts
- Supabase Auth redirect URLs and wildcard patterns: https://supabase.com/docs/guides/auth/redirect-urls
