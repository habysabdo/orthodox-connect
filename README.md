# orthodox-connect

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-zzqmd3zn)

## Authentication deployment

See [the Netlify and Supabase authentication troubleshooting guide](docs/auth-deployment-troubleshooting.md) for build-time environment validation, Supabase redirect configuration, and the auth-loading timeout behavior.

## Admin user management

The Admin Panel user-management tools require these server-side Netlify environment variables:

- `SUPABASE_URL` (or the existing `VITE_SUPABASE_URL` fallback)
- `SUPABASE_SERVICE_ROLE_KEY`

Keep the service-role key server-side. The browser calls the protected `/api/admin-users` Netlify Function and never receives the credential.

## Bunny Stream video uploads

Video posts first create a Bunny Stream video placeholder, then materialize the selected browser file as an `ArrayBuffer`. Files up to 5MB are sent through the authenticated binary upload function; larger files and failed binary requests use Bunny's signed, resumable TUS endpoint. Configure one of these server-side Netlify environment variables with the Bunny Stream library API key:

- `BUNNY_STREAM_API_KEY` (preferred)
- `BUNNY_API_KEY`
- `BUNNY_STREAM_LIBRARY_API_KEY`

The library ID and CDN hostname have project defaults. They can be overridden with `BUNNY_LIBRARY_ID` and `BUNNY_STREAM_CDN_HOSTNAME`. Keep the API key server-side; the browser receives only short-lived TUS authorization scoped to one video.

## Web push configuration

Direct-message push notifications require VAPID credentials in the Netlify environment:

- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT` (optional; defaults to the OrthodoxConnect support email)
- `VITE_VAPID_PUBLIC_KEY` or `VITE_WEB_PUSH_PUBLIC_KEY` (optional browser-facing alias for the same public key)

Generate one VAPID key pair with `npx web-push generate-vapid-keys`, store the keys in Netlify, and keep the private key server-only. Users can then enable notifications from the bell control in the app header. On iPhone, the PWA must first be added to the Home Screen.

The app includes a valid public-key fallback so browser configuration can be parsed safely, but it does not attempt to subscribe users until a matching server-side public/private VAPID pair is configured.
