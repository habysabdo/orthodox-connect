# Supabase auth origins

Configure these entries in **Supabase Dashboard → Authentication → URL Configuration**. Hosted Supabase APIs already provide CORS for browser clients; these entries control where authentication redirects may return.

## Site URL

Use the canonical production origin:

```text
https://orthodox-connect.netlify.app
```

Replace it with the custom production domain if one is configured.

## Redirect URLs

```text
https://orthodox-connect.netlify.app/**
https://**--orthodox-connect.netlify.app/**
http://localhost:8889/**
http://localhost:5173/**
capacitor://localhost/**
http://localhost/**
https://localhost/**
```

The Netlify wildcard covers Deploy Preview hostnames. The localhost and Capacitor entries cover Vite development and native WebViews. Keep the production URL exact, and remove any development origin that the shipped application does not use.

If `VITE_SUPABASE_PROXY_URL` points to a custom proxy, that proxy must answer `OPTIONS` and reflect only approved origins. Allow `authorization`, `apikey`, `content-type`, and `x-client-info`, include `Vary: Origin`, and never combine credentialed requests with `Access-Control-Allow-Origin: *`.
