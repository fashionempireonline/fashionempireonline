const CACHE_NAME = "fashion-empire-v4";
const ASSETS = [
  "/", "/index.html", "/style.css", "/script.js",
  "/product.html", "/login.html", "/signup.html",
  "/admin_with_gallery__1_.html",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  // Purane SARE caches delete karo
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log("Deleting old cache:", k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if(e.request.url.includes("firebaseapp") ||
     e.request.url.includes("googleapis.com/identitytoolkit") ||
     e.request.url.includes("firestore.googleapis.com") ||
     e.request.url.includes("cloudinary.com")) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network first for HTML files — hamesha fresh version lo
      if(e.request.url.endsWith(".html") || e.request.url.endsWith("/")){
        return fetch(e.request).then(res => {
          if(res && res.status === 200){
            let clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      }
      // Cache first for CSS/JS/fonts
      return cached || fetch(e.request).then(res => {
        if(res && res.status === 200 && res.type === "basic"){
          let clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

/* ============================
   PUSH NOTIFICATIONS
============================ */
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data.json(); } catch(err) {
    data = { title: "Fashion Empire", body: e.data ? e.data.text() : "New update!" };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Fashion Empire 👑", {
      body:    data.body  || "Naye products aaye hain! Dekho abhi.",
      icon:    data.icon  || "/images/icon-192.png",
      badge:   data.badge || "/images/icon-192.png",
      image:   data.image || "",
      tag:     data.tag   || "fashion-empire",
      data:    { url: data.url || "/" },
      actions: [
        { action: "open",    title: "Dekho 👀" },
        { action: "dismiss", title: "Baad mein" }
      ],
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  if(e.action === "dismiss") return;
  let url = e.notification.data?.url || "/";
  e.waitUntil(
    clients.matchAll({ type:"window" }).then(clientList => {
      for(let client of clientList){
        if(client.url === url && "focus" in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});
