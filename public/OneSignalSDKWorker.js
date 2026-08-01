/*
 * OneSignal's background service worker.
 *
 * This is the worker that receives a push message and raises the notification
 * while OrthodoxConnect is closed — no tab, no PWA window, nothing running. It
 * has to be served from the site root so the browser will accept it, and it only
 * imports OneSignal's own worker code, which is why the file is this short.
 *
 * It is registered under the `/onesignal/` scope (see `src/utils/oneSignal.ts`)
 * so that it lives alongside the app's own `/sw.js` at scope `/` instead of
 * replacing it. Two workers claiming the same scope means the last registration
 * wins, which would silently cost the app either its offline cache or its push
 * delivery.
 */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
