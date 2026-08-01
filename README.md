# orthodox-connect

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-zzqmd3zn)

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

## OneSignal background notifications

Alerts that arrive while the app is closed are delivered through OneSignal, which needs three variables in the Netlify environment:

- `VITE_ONESIGNAL_APP_ID` — the OneSignal app id, read by the browser
- `ONESIGNAL_APP_ID` — the same id, read by the send function
- `ONESIGNAL_REST_API_KEY` — server-only; never expose it to the browser

`public/OneSignalSDKWorker.js` is the background worker that raises the notification. It registers under the `/onesignal/` scope so the app's own `/sw.js` keeps scope `/` for offline caching. Members are asked for notification permission when they sign in, and the subscription is linked to their account id so alerts can be addressed to a person rather than a device.

`POST /api/send-push` sends an alert. It is admin-only, because the REST key can notify every subscriber:

```json
{ "title": "Vespers tonight", "message": "Service begins at 6pm.", "externalIds": ["<user id>"], "url": "https://orthodoxconnect.live/" }
```

Omit `externalIds` to broadcast to the `Subscribed Users` segment, or pass `segments` to choose others. Server-side flows can import `sendOneSignalNotification` from the same function instead of making an HTTP request. Until the variables above are set the browser skips OneSignal entirely and the endpoint answers `503`, so the existing VAPID notifications continue to work on their own.
