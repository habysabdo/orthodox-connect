/* OrthodoxConnect service worker — legacy-safe offline caching and push. */

var VERSION = 'v8';
var APP_SHELL = 'oc-shell-' + VERSION;
var RUNTIME = 'oc-runtime-' + VERSION;
var PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png'];

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', function (event) {
    try {
      if (!self.caches) return;
      event.waitUntil(
        caches.open(APP_SHELL)
          .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
          .then(function () { return self.skipWaiting(); })
          .catch(function (error) { console.warn('Service worker install was skipped.', error); }),
      );
    } catch (error) {
      console.warn('Service worker install is unavailable.', error);
    }
  });

  self.addEventListener('activate', function (event) {
    try {
      if (!self.caches) return;
      event.waitUntil(
        caches.keys()
          .then(function (keys) {
            return Promise.all(keys.filter(function (key) {
              return key !== APP_SHELL && key !== RUNTIME;
            }).map(function (key) {
              return caches.delete(key);
            }));
          })
          .then(function () { return self.clients && self.clients.claim ? self.clients.claim() : undefined; })
          .catch(function (error) { console.warn('Service worker activation was skipped.', error); }),
      );
    } catch (error) {
      console.warn('Service worker activation is unavailable.', error);
    }
  });

  self.addEventListener('fetch', function (event) {
    try {
      if (!self.caches || !event.request) return;
      var request = event.request;
      var url = new URL(request.url);

      // API traffic — authentication and session above all — never goes through
      // this worker. Returning without calling respondWith leaves the request
      // entirely to the browser, so credentials, cookies and redirects behave
      // exactly as they would with no service worker installed, and no response
      // is ever cached or replayed.
      if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/.netlify/') === 0) {
        return;
      }

      if (request.method !== 'GET') return;

      if (request.mode === 'navigate') {
        event.respondWith(
          fetch(request).then(function (response) {
            var copy = response.clone();
            caches.open(RUNTIME).then(function (cache) {
              return cache.put(request, copy);
            }).catch(function () {});
            return response;
          }).catch(function () {
            return caches.match(request).then(function (cached) {
              return cached || caches.match('/index.html');
            });
          }),
        );
        return;
      }

      // Vite filenames are content-hashed. Let the browser fetch them directly
      // so an old service worker cannot keep JavaScript from a previous deploy.
      if (url.origin === self.location.origin && url.pathname.indexOf('/assets/') === 0) {
        return;
      }

      // The ringtone is always fetched from the network. Caching it would let a
      // "not found" response (the SPA fallback) be replayed forever once a real
      // ringtone file is added to the deployment.
      if (url.origin === self.location.origin && url.pathname === '/ringtone.mp3') {
        return;
      }

      if (url.origin === self.location.origin) {
        event.respondWith(
          caches.match(request).then(function (cached) {
            var network = fetch(request).then(function (response) {
              if (response && response.status === 200) {
                var copy = response.clone();
                caches.open(RUNTIME).then(function (cache) {
                  return cache.put(request, copy);
                }).catch(function () {});
              }
              return response;
            }).catch(function () { return cached; });
            return cached || network;
          }).catch(function () { return fetch(request); }),
        );
      }
    } catch (error) {
      console.warn('Service worker fetch handling was skipped.', error);
    }
  });

  if (self.registration && 'pushManager' in self.registration && typeof self.registration.showNotification === 'function') {
    self.addEventListener('push', function (event) {
      try {
        var data = {};
        try {
          data = event.data ? event.data.json() : {};
        } catch (parseError) {
          data = { body: event.data ? event.data.text() : 'You received a new message.' };
        }

        var notificationData = data.data || {};
        notificationData.url = data.url || notificationData.url || '/chat';
        event.waitUntil(
          self.registration.showNotification(data.title || 'New Message', {
            body: data.body || 'You received a new message.',
            icon: data.icon || '/icon-192.png',
            badge: data.badge || '/icon-192.png',
            tag: data.tag || 'orthodoxconnect-message',
            renotify: true,
            data: notificationData,
          }).catch(function (error) { console.warn('Push notification display failed.', error); }),
        );
      } catch (error) {
        console.warn('Push notification handling was skipped.', error);
      }
    });

    self.addEventListener('notificationclick', function (event) {
      try {
        if (event.notification) event.notification.close();
        var notificationData = event.notification && event.notification.data ? event.notification.data : {};
        var destination = new URL(notificationData.url || '/', self.location.origin).href;
        if (!self.clients || typeof self.clients.matchAll !== 'function') return;
        event.waitUntil(
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
            var exact = clients.find(function (client) { return client.url === destination; });
            if (exact && typeof exact.focus === 'function') return exact.focus();

            var existing = clients.find(function (client) {
              try {
                return new URL(client.url).origin === self.location.origin;
              } catch (error) {
                return false;
              }
            });
            if (existing) {
              var navigation = typeof existing.navigate === 'function' ? existing.navigate(destination) : Promise.resolve(existing);
              return navigation.then(function () {
                return typeof existing.focus === 'function' ? existing.focus() : existing;
              });
            }
            return typeof self.clients.openWindow === 'function' ? self.clients.openWindow(destination) : undefined;
          }).catch(function (error) { console.warn('Notification click handling failed.', error); }),
        );
      } catch (error) {
        console.warn('Notification click handling was skipped.', error);
      }
    });
  }

  self.addEventListener('message', function (event) {
    try {
      if (event.data === 'SKIP_WAITING' && typeof self.skipWaiting === 'function') self.skipWaiting();
    } catch (error) {
      console.warn('Service worker message handling was skipped.', error);
    }
  });
}
