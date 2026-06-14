import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
const app = initializeApp({
 apiKey: "AIzaSyBw6dKBEDGfuh-he23WHJGG-L6mRDH_lFo",
 authDomain: "fashion-empire-online.firebaseapp.com",
 projectId: "fashion-empire-online",
 storageBucket: "fashion-empire-online.firebasestorage.app",
 messagingSenderId: "270445447440",
 appId: "1:270445447440:web:17b31b34a0bbecbe87bd95"
});
const db = getFirestore(app);
const auth = getAuth(app);
const ADMIN_EMAILS = ["loothakeryt@gmail.com", "kp1496140@gmail.com"];
function showAdminToast(msg, isError=false){
 let t = document.getElementById("adminToast");
 t.innerText = msg;
 t.style.background = isError ? "#e00" : "#111";
 t.classList.add("show");
 setTimeout(()=> t.classList.remove("show"), 3000);
}
onAuthStateChanged(auth, user => {
 if(user){
 document.getElementById("adminLoginGate").style.display = "none";
 document.getElementById("adminPanel").style.display = "block";
 loadProducts();
 loadReviews();
 loadGallery();
 loadOrders();
 } else {
 document.getElementById("adminLoginGate").style.display = "flex";
 document.getElementById("adminPanel").style.display = "none";
 }
});
window.adminLogin = async function(){
 let email = document.getElementById("adminEmail").value.trim();
 let pass = document.getElementById("adminPassword").value;
 let err = document.getElementById("adminLoginErr");
 err.style.display = "none";
 try {
 let cred = await signInWithEmailAndPassword(auth, email, pass);
 } catch(e){
 err.innerText = "Email ya password galat hai.";
 err.style.display = "block";
 }
};
window.adminLogout = () => signOut(auth);
window.switchTab = function(tab){
 document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
 document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
 document.getElementById(`tab-${tab}`).classList.add("active");
 event.currentTarget.classList.add("active");
};
let allProductsData = {};
async function loadProducts(){
 try {
 let snap = await getDocs(collection(db, "products"));
 allProductsData = {};
 let rows = "";
 let cats = new Set();
 snap.forEach(d => {
 let p = d.data();
 allProductsData[d.id] = p;
 cats.add(p.category);
 rows += `
 <tr>
 <td><img src="${p.image1||''}" class="prod-img-thumb" onerror="this.src='https://via.placeholder.com/55'"></td>
 <td class="prod-title-cell">${p.title||'—'}<small>${p.category||''}</small></td>
 <td><strong>₹${p.price||0}</strong>${p.oldprice?`<br><span style="color:#aaa;text-decoration:line-through;font-size:12px;">₹${p.oldprice}</span>`:""}</td>
 <td><span class="status-badge status-active">Active</span></td>
 <td>
 <div class="table-actions">
 <button class="icon-btn edit" onclick="editProduct('${d.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
 <button class="icon-btn del" onclick="deleteProduct('${d.id}','${(p.title||'').replace(/'/g,"\\'")}')"><i class="fa-solid fa-trash"></i></button>
 </div>
 </td>
 </tr>`;
 });
 document.getElementById("statProducts").innerText = snap.size;
 document.getElementById("statCategories").innerText = cats.size;
 document.getElementById("productsTableWrap").innerHTML = snap.empty
 ? `<p style="color:#aaa;text-align:center;padding:30px;">Koi products nahi hain. Pehle add karo!</p>`
 : `<div style="overflow-x:auto;"><table class="products-table">
 <thead><tr><th>Image</th><th>Title</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
 <tbody>${rows}</tbody>
 </table></div>`;
 } catch(e){
 console.error(e);
 document.getElementById("productsTableWrap").innerHTML = `<p style="color:#e00;">Error loading products.</p>`;
 }
}
const CLOUD_NAME = "dnga18lnc";
const UPLOAD_PRESET = "fashion empire";
window.uploadImage = async function(input, urlFieldId, prevId, placeholderId, progWrapId, progBarId, progTxtId){
 let file = input.files[0];
 if(!file) return;
 let reader = new FileReader();
 reader.onload = e => {
 let prev = document.getElementById(prevId);
 let ph = document.getElementById(placeholderId);
 prev.src = e.target.result;
 prev.style.display = "block";
 ph.style.display = "none";
 };
 reader.readAsDataURL(file);
 let formData = new FormData();
 formData.append("file", file);
 formData.append("upload_preset", UPLOAD_PRESET);
 formData.append("folder", "fashion_empire");
 document.getElementById(progWrapId).style.display = "flex";
 document.getElementById(progBarId).style.width = "10%";
 document.getElementById(progTxtId).innerText = "Uploading...";
 try {
 let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
 method: "POST",
 body: formData
 });
 let data = await res.json();
 if(data.secure_url){
 document.getElementById(urlFieldId).value = data.secure_url;
 document.getElementById(progBarId).style.width = "100%";
 document.getElementById(progTxtId).innerText = "Done!";
 setTimeout(()=>{
 document.getElementById(progWrapId).style.display = "none";
 }, 1000);
 toast("✅ Image upload ho gayi!");
 } else {
 throw new Error(data.error?.message || "Upload failed");
 }
 } catch(e){
 toast("❌ Upload failed: " + e.message, true);
 document.getElementById(progWrapId).style.display = "none";
 }
};
window.saveProduct = async function(){
 let id = document.getElementById("editProductId").value;
 let title = document.getElementById("pTitle").value.trim();
 let price = parseFloat(document.getElementById("pPrice").value);
 let img1 = document.getElementById("pImg1").value.trim();
 if(!title || !price || !img1){
 showAdminToast("❌ Title, Price aur Image 1 zaroori hain!", true); return;
 }
 let data = {
 title,
 price,
 oldprice: parseFloat(document.getElementById("pOldPrice").value) || 0,
 category: document.getElementById("pCategory").value,
 image1: img1,
 image2: document.getElementById("pImg2").value.trim() || "",
 image3: document.getElementById("pImg3").value.trim() || "",
 image4: document.getElementById("pImg4").value.trim() || "",
 description: document.getElementById("pDesc").value.trim() || "",
 updatedAt: serverTimestamp()
 };
 document.getElementById("saveBtnText").innerText = "Saving...";
 try {
 if(id){
 await updateDoc(doc(db, "products", id), data);
 showAdminToast("✅ Product update ho gaya!");
 } else {
 data.createdAt = serverTimestamp();
 await addDoc(collection(db, "products"), data);
 showAdminToast("✅ Product add ho gaya!");
 }
 clearForm();
 loadProducts();
 document.querySelectorAll(".admin-tab")[0].click();
 } catch(e){
 showAdminToast("❌ Error: " + e.message, true);
 }
 document.getElementById("saveBtnText").innerText = "Save Product";
};
window.editProduct = function(id){
 let p = allProductsData[id];
 if(!p) return;
 document.getElementById("editProductId").value = id;
 document.getElementById("pTitle").value = p.title || "";
 document.getElementById("pPrice").value = p.price || "";
 document.getElementById("pOldPrice").value = p.oldprice || "";
 document.getElementById("pCategory").value = p.category || "menswear";
 document.getElementById("pImg1").value = p.image1 || "";
 document.getElementById("pImg2").value = p.image2 || "";
 document.getElementById("pImg3").value = p.image3 || "";
 document.getElementById("pImg4").value = p.image4 || "";
 document.getElementById("pDesc").value = p.description || "";
 document.getElementById("addFormTitle").innerText = "Edit Product";
 document.getElementById("saveBtnText").innerText = "Update Product";
 document.querySelectorAll(".admin-tab")[1].click();
 window.scrollTo({ top:0, behavior:"smooth" });
};
window.deleteProduct = async function(id, title){
 if(!confirm(`"${title}" delete karna chahte ho? Yeh undo nahi hoga.`)) return;
 try {
 await deleteDoc(doc(db, "products", id));
 showAdminToast("🗑️ Product delete ho gaya!");
 loadProducts();
 } catch(e){
 showAdminToast("❌ Delete failed: " + e.message, true);
 }
};
window.clearForm = function(){
 ["pTitle","pPrice","pOldPrice","pImg1","pImg2","pImg3","pImg4","pDesc","editProductId"].forEach(id => {
 document.getElementById(id).value = "";
 });
 document.getElementById("pCategory").value = "menswear";
 document.getElementById("addFormTitle").innerText = "Add New Product";
 document.getElementById("saveBtnText").innerText = "Save Product";
};
async function loadReviews(){
 try {
 let snap = await getDocs(collection(db, "reviews"));
 document.getElementById("statReviews").innerText = snap.size;
 let html = "";
 snap.forEach(d => {
 let r = d.data();
 let stars = "⭐".repeat(r.rating||5);
 html += `
 <div style="background:#f9f9f9;border-radius:14px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
 <div>
 <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
 <strong>${r.userName||"Anonymous"}</strong>
 <span style="font-size:14px;">${stars}</span>
 </div>
 <p style="font-size:14px;color:#555;margin-bottom:4px;">${r.comment||""}</p>
 <small style="color:#aaa;">${r.productTitle||""}</small>
 </div>
 <button class="icon-btn del" onclick="deleteReview('${d.id}')" title="Delete">
 <i class="fa-solid fa-trash"></i>
 </button>
 </div>`;
 });
 document.getElementById("reviewsAdminWrap").innerHTML = snap.empty
 ? `<p style="color:#aaa;text-align:center;padding:30px;">Koi reviews nahi hain abhi.</p>`
 : html;
 } catch(e){ console.error(e); }
}
window.deleteReview = async function(id){
 if(!confirm("Is review ko delete karna chahte ho?")) return;
 await deleteDoc(doc(db, "reviews", id));
 showAdminToast("🗑️ Review delete ho gaya!");
 loadReviews();
};
window.openNotifPanel = function(){
 document.getElementById("notifPanel").style.display = "block";
 document.getElementById("notifOverlay").style.display = "block";
};
window.closeNotifPanel = function(){
 document.getElementById("notifPanel").style.display = "none";
 document.getElementById("notifOverlay").style.display = "none";
};
let galleryItems = [];
async function loadGallery(){
 try {
 let snap = await getDocs(collection(db, "gallery"));
 galleryItems = [];
 snap.forEach(d => galleryItems.push({ id: d.id, ...d.data() }));
 galleryItems.sort((a,b) => (b.uploadedAt?.seconds||0) - (a.uploadedAt?.seconds||0));
 renderGallery();
 } catch(e){
 document.getElementById("galleryGrid").innerHTML =
 `<div class="gal-empty" style="grid-column:1/-1;color:#e00;"><i class="fa-solid fa-triangle-exclamation"></i><p>Error: ${e.message}</p></div>`;
 }
}
function renderGallery(){
 let grid = document.getElementById("galleryGrid");
 let count = galleryItems.length;
 document.getElementById("galCount").innerText = count ? `(${count} photos)` : "";
 if(count === 0){
 grid.innerHTML = `<div class="gal-empty" style="grid-column:1/-1;">
 <i class="fa-solid fa-image"></i>
 <p style="color:#555;">Gallery khaali hai — upar se photo upload karo</p>
 </div>`;
 return;
 }
 let gridHTML = galleryItems.map((item, i) => `
 <div class="gallery-item">
 <img src="${item.url}" alt="photo ${i+1}" loading="lazy">
 <div class="gal-overlay">
 <button class="gal-url-btn" onclick="copyGalleryUrl('${item.url}')">
 <i class="fa-solid fa-copy"></i> URL Copy
 </button>
 <button class="gal-del-btn" onclick="deleteGalleryItem('${item.id}')">
 <i class="fa-solid fa-trash"></i> Delete
 </button>
 </div>
 </div>
 `).join("");
 let urlListHTML = `<div style="grid-column:1/-1;margin-top:16px;">
 <p style="font-size:13px;color:#888;margin-bottom:8px;">
 <i class="fa-solid fa-link" style="color:#c9a84c;margin-right:6px;"></i>
 <strong style="color:#c9a84c;">Photo URL list</strong> — tap karo copy karne ke liye
 </p>
 ${galleryItems.map((item, i) => `
 <div onclick="copyGalleryUrl('${item.url}')" style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:12px;color:#c9a84c;word-break:break-all;cursor:pointer;">
 <strong style="color:#888;">📷 ${i+1}.</strong> ${item.url}
 </div>
 `).join("")}
 </div>`;
 grid.innerHTML = gridHTML + urlListHTML;
}
window.galleryBulkUpload = async function(input){
 let files = Array.from(input.files).filter(f => f.type.startsWith("image/"));
 input.value = "";
 if(!files.length) return;
 let progArea = document.getElementById("galProgressArea");
 progArea.style.display = "block";
 progArea.innerHTML = `<div style="background:#1a1a1a;border-radius:12px;padding:14px 16px;color:#c9a84c;font-size:14px;">
 <i class="fa-solid fa-spinner fa-spin"></i> &nbsp;${files.length} photo${files.length>1?"s":""} upload ho rahi hai${files.length>1?"n":""}...
 </div>`;
 let uploaded = 0;
 let failed = 0;
 for(let file of files){
 try {
 let formData = new FormData();
 formData.append("file", file);
 formData.append("upload_preset", UPLOAD_PRESET);
 formData.append("folder", "fashion_empire_gallery");
 let res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method:"POST", body:formData });
 let data = await res.json();
 if(data.secure_url){
 let docRef = await addDoc(collection(db, "gallery"), {
 url: data.secure_url,
 publicId: data.public_id || "",
 uploadedAt: serverTimestamp()
 });
 galleryItems.unshift({ id: docRef.id, url: data.secure_url });
 uploaded++;
 progArea.innerHTML = `<div style="background:#1a1a1a;border-radius:12px;padding:14px 16px;color:#c9a84c;font-size:14px;">
 <i class="fa-solid fa-spinner fa-spin"></i> &nbsp;${uploaded}/${files.length} upload ho gayi...
 </div>`;
 } else {
 failed++;
 console.error("Cloudinary error:", data.error?.message);
 }
 } catch(e){
 failed++;
 console.error("Upload error:", e);
 }
 }
 progArea.style.display = "none";
 renderGallery();
 if(uploaded > 0) showAdminToast(`✅ ${uploaded} photo${uploaded>1?"s":""} upload ho gai${uploaded>1?"n":""}!`);
 if(failed > 0) showAdminToast(`❌ ${failed} photo fail hui — preset check karo`, true);
}
window.copyGalleryUrl = function(url){
 navigator.clipboard.writeText(url).then(() => {
 let badge = document.getElementById("urlCopiedBadge");
 badge.style.opacity = "1";
 badge.style.transform = "translateX(-50%) translateY(0)";
 setTimeout(() => {
 badge.style.opacity = "0";
 badge.style.transform = "translateX(-50%) translateY(80px)";
 }, 2200);
 }).catch(() => {
 let ta = document.createElement("textarea");
 ta.value = url;
 document.body.appendChild(ta);
 ta.select();
 document.execCommand("copy");
 ta.remove();
 showAdminToast("✅ URL copy ho gayi!");
 });
};
window.deleteGalleryItem = async function(id){
 if(!confirm("Is photo ko gallery se delete karna chahte ho?")) return;
 try {
 await deleteDoc(doc(db, "gallery", id));
 galleryItems = galleryItems.filter(i => i.id !== id);
 renderGallery();
 showAdminToast("🗑️ Photo delete ho gayi!");
 } catch(e){
 showAdminToast("❌ Delete failed: " + e.message, true);
 }
};
const origSwitchTab = window.switchTab;
window.switchTab = function(tab){
 origSwitchTab(tab);
 if(tab === "gallery") loadGallery();
};
window.sendNotification = async function(){
 let title = document.getElementById("notifTitle").value.trim();
 let body = document.getElementById("notifBody").value.trim();
 let url = document.getElementById("notifUrl").value.trim();
 let btn = document.getElementById("notifBtnTxt");
 if(!title || !body){ toast("Title aur message zaroori hai!", true); return; }
 btn.innerText = "Sending...";
 try {
 await addDoc(collection(db, "notifications"), {
 title, body, url,
 createdAt: serverTimestamp(),
 sent: true
 });
 if(Notification.permission === "granted"){
 new Notification(title, { body, icon: "/images/icon-192.png" });
 }
 toast("✅ Notification save ho gayi! Customers dekh sakenge.");
 closeNotifPanel();
 } catch(e){
 toast("❌ Error: " + e.message, true);
 }
 btn.innerText = "Notification Bhejo";
};
let allOrders = [];
async function loadOrders(){
 try {
 let snap = await getDocs(collection(db, "orders"));
 allOrders = [];
 snap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
 allOrders.sort((a,b)=> (b.orderTime?.seconds||0) - (a.orderTime?.seconds||0));
 renderOrders(allOrders);
 updateOrderStats(allOrders);
 } catch(e){
 document.getElementById("ordersListWrap").innerHTML = `<p style="color:#e00;padding:20px;">Orders load nahi hui: ${e.message}</p>`;
 }
}
function updateOrderStats(orders){
 let counts = { pending:0, confirmed:0, shipped:0, delivered:0, cancelled:0 };
 orders.forEach(o => { if(counts[o.status]!==undefined) counts[o.status]++; });
 let statsRow = document.getElementById("orderStatsRow");
 if(!statsRow) return;
 statsRow.innerHTML = `
 <div class="stat-mini"><h3 style="color:#111;">${orders.length}</h3><p>Total Orders</p></div>
 <div class="stat-mini"><h3 style="color:#f5a623;">${counts.pending}</h3><p>Pending</p></div>
 <div class="stat-mini"><h3 style="color:#0066cc;">${counts.confirmed}</h3><p>Confirmed</p></div>
 <div class="stat-mini"><h3 style="color:#8B5CF6;">${counts.shipped}</h3><p>Shipped</p></div>
 <div class="stat-mini"><h3 style="color:#00a854;">${counts.delivered}</h3><p>Delivered</p></div>`;
 let badge = document.getElementById("pendingBadge");
 if(badge){
 if(counts.pending > 0){
 badge.textContent = counts.pending;
 badge.style.display = "inline-block";
 } else {
 badge.style.display = "none";
 }
 }
}
function renderOrders(orders){
 let wrap = document.getElementById("ordersListWrap");
 if(!wrap) return;
 if(orders.length === 0){
 wrap.innerHTML = `<p style="text-align:center;color:#aaa;padding:30px;">Koi orders nahi hain abhi.</p>`;
 return;
 }
 wrap.innerHTML = "";
 orders.forEach(order => {
 let statusColors = { pending:"#f5a623", confirmed:"#0066cc", shipped:"#8B5CF6", delivered:"#00a854", cancelled:"#e00" };
 let statusEmoji = { pending:"🟡", confirmed:"🟢", shipped:"🔵", delivered:"✅", cancelled:"❌" };
 let dateStr = order.orderTime
 ? new Date(order.orderTime.seconds*1000).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})
 : "—";
 let card = document.createElement("div");
 card.className = `order-card ${order.status||"pending"}`;
 card.id = `order-${order.id}`;
 let waMsg = encodeURIComponent(
 `Hello ${order.naam}! 👋
Fashion Empire yahan se baat kar raha hoon.
Aapka order:
` +
 `📦 ${order.productTitle}
💰 ₹${order.productPrice}
` +
 (order.selectedSize && order.selectedSize!="N/A" ? `📐 Size: ${order.selectedSize}
` : "") +
 `
Status: ${(order.status||"pending").toUpperCase()}
Koi sawaal ho toh batao!`
 );
 card.innerHTML = `
 <div class="order-top">
 <img class="order-prod-img" src="${order.productImage||''}" alt="${order.productTitle||''}">
 <div class="order-info" style="flex:1;">
 <h4>${order.productTitle||'—'}</h4>
 <p>₹${order.productPrice||0} ${order.selectedSize && order.selectedSize!="N/A" ? `· Size: <strong>${order.selectedSize}</strong>` : ""}</p>
 <p class="order-price">💰 ₹${order.productPrice||0}</p>
 <div class="order-id-badge">ID: ${order.id.slice(0,8).toUpperCase()} · ${dateStr}</div>
 </div>
 <div>
 <span style="background:${statusColors[order.status||'pending']}20;color:${statusColors[order.status||'pending']};padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;">
 ${statusEmoji[order.status||'pending']} ${(order.status||'pending').toUpperCase()}
 </span>
 </div>
 </div>
 <div class="order-customer">
 <strong>${order.naam||'—'}</strong> · 📞 ${order.phone||'—'} ${order.altPhone ? `/ ${order.altPhone}` : ""}<br>
 📍 ${order.address||'—'}, ${order.city||'—'}, ${order.state||'—'} — ${order.pincode||'—'}
 ${order.notes ? `<br>📝 <em>${order.notes}</em>` : ""}
 </div>
 <div class="order-actions">
 <select class="status-select" onchange="updateOrderStatus('${order.id}', this.value)">
 <option value="pending" ${order.status==='pending' ?'selected':''}>🟡 Pending</option>
 <option value="confirmed" ${order.status==='confirmed' ?'selected':''}>🟢 Confirmed</option>
 <option value="shipped" ${order.status==='shipped' ?'selected':''}>🔵 Shipped</option>
 <option value="delivered" ${order.status==='delivered' ?'selected':''}>✅ Delivered</option>
 <option value="cancelled" ${order.status==='cancelled' ?'selected':''}>❌ Cancelled</option>
 </select>
 <button class="order-wa-btn" onclick="window.open('https://wa.me/91${order.phone||''}?text=${waMsg}','_blank')">
 <i class="fa-brands fa-whatsapp"></i> WhatsApp
 </button>
 <button class="order-del-btn" onclick="deleteOrder('${order.id}')">
 <i class="fa-solid fa-trash"></i>
 </button>
 </div>`;
 wrap.appendChild(card);
 });
}
window.filterOrders = function(){
 let val = document.getElementById("orderStatusFilter").value;
 let filtered = val === "all" ? allOrders : allOrders.filter(o => o.status === val);
 renderOrders(filtered);
};
window.updateOrderStatus = async function(orderId, newStatus){
 try {
 await updateDoc(doc(db, "orders", orderId), { status: newStatus, updatedAt: serverTimestamp() });
 let order = allOrders.find(o => o.id === orderId);
 if(order) order.status = newStatus;
 let card = document.getElementById(`order-${orderId}`);
 if(card){
 card.className = `order-card ${newStatus}`;
 }
 updateOrderStats(allOrders);
 showAdminToast(`✅ Order status: ${newStatus.toUpperCase()}`);
 } catch(e){
 showAdminToast("❌ Update failed: " + e.message, true);
 }
};
window.deleteOrder = async function(orderId){
 if(!confirm("Ye order delete karna chahte ho?")) return;
 try {
 await deleteDoc(doc(db, "orders", orderId));
 allOrders = allOrders.filter(o => o.id !== orderId);
 renderOrders(allOrders);
 updateOrderStats(allOrders);
 showAdminToast("🗑️ Order delete ho gaya!");
 } catch(e){
 showAdminToast("❌ Delete failed: " + e.message, true);
 }
};
const _origSwitch = window.switchTab;
window.switchTab = function(tab){
 _origSwitch(tab);
 if(tab === "orders") loadOrders();
 if(tab === "gallery") loadGallery();
 if(tab === "analytics") loadAnalytics();
 if(tab === "coupons") loadCouponsAdmin();
};
async function loadAnalytics(){
 let wrap = document.getElementById("analyticsWrap");
 if(!wrap) return;
 try {
 let ordersSnap = await getDocs(collection(db, "orders"));
 let productsSnap = await getDocs(collection(db, "products"));
 let orders = [];
 ordersSnap.forEach(d => orders.push({ id:d.id, ...d.data() }));
 let totalRevenue = orders
 .filter(o => o.status !== "cancelled")
 .reduce((s,o) => s + (o.finalOrderPrice || o.productPrice || 0), 0);
 let deliveredCount = orders.filter(o => o.status === "delivered").length;
 let pendingCount = orders.filter(o => o.status === "pending").length;
 let cancelledCount = orders.filter(o => o.status === "cancelled").length;
 let now = Date.now();
 let days = Array.from({length:7}, (_,i)=>{
 let d = new Date(now - (6-i)*86400000);
 return { label: d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}), count:0, rev:0 };
 });
 orders.forEach(o => {
 if(!o.orderTime?.seconds) return;
 let ms = o.orderTime.seconds * 1000;
 let diff = Math.floor((now - ms) / 86400000);
 if(diff >= 0 && diff < 7){
 days[6-diff].count++;
 days[6-diff].rev += (o.finalOrderPrice || o.productPrice || 0);
 }
 });
 let prodCount = {};
 orders.forEach(o => {
 if(!o.productTitle) return;
 prodCount[o.productId] = prodCount[o.productId] || { title:o.productTitle, image:o.productImage, count:0, rev:0 };
 prodCount[o.productId].count++;
 prodCount[o.productId].rev += (o.finalOrderPrice || o.productPrice || 0);
 });
 let topProds = Object.values(prodCount).sort((a,b)=>b.count-a.count).slice(0,5);
 let cityCount = {};
 orders.forEach(o => { if(o.city){ cityCount[o.city] = (cityCount[o.city]||0)+1; } });
 let topCities = Object.entries(cityCount).sort((a,b)=>b[1]-a[1]).slice(0,6);
 let maxRev = Math.max(...days.map(d=>d.rev), 1);
 let barsHtml = days.map(d => `
 <div class="bar-col">
 <div class="bar-val">₹${d.rev>999?Math.round(d.rev/100)/10+"k":d.rev}</div>
 <div class="bar" style="height:${Math.round((d.rev/maxRev)*120)+4}px;"></div>
 <div class="bar-label">${d.label}</div>
 </div>`).join("");
 let topProdsHtml = topProds.length ? topProds.map((p,i) => `
 <div class="top-prod-item">
 <div class="top-rank">${["🥇","🥈","🥉","4️⃣","5️⃣"][i]}</div>
 <img src="${p.image||''}" alt="${p.title}">
 <div>
 <h4>${p.title}</h4>
 <p>${p.count} orders · ₹${p.rev} revenue</p>
 </div>
 </div>`).join("")
 : "<p style='color:#aaa;text-align:center;padding:20px;'>Koi orders nahi hain abhi.</p>";
 let citiesHtml = topCities.length
 ? topCities.map(([c,n])=>`<div class="city-badge">${c} (${n})</div>`).join("")
 : "<p style='color:#aaa;'>Data nahi hai abhi.</p>";
 wrap.innerHTML = `
 <div class="analytics-stats">
 <div class="an-stat"><h3 style="color:#ff416c;">₹${totalRevenue.toLocaleString("en-IN")}</h3><p>Total Revenue</p></div>
 <div class="an-stat"><h3 style="color:#0066cc;">${orders.length}</h3><p>Total Orders</p></div>
 <div class="an-stat"><h3 style="color:#00a854;">${deliveredCount}</h3><p>Delivered</p></div>
 <div class="an-stat"><h3 style="color:#f5a623;">${pendingCount}</h3><p>Pending</p></div>
 <div class="an-stat"><h3 style="color:#e00;">${cancelledCount}</h3><p>Cancelled</p></div>
 </div>
 <div class="chart-wrap">
 <div class="chart-title"><i class="fa-solid fa-chart-bar"></i> Last 7 Days Revenue</div>
 <div class="bar-chart">${barsHtml}</div>
 </div>
 <div class="chart-wrap">
 <div class="chart-title"><i class="fa-solid fa-trophy"></i> Top Selling Products</div>
 <div class="top-products-list">${topProdsHtml}</div>
 </div>
 <div class="chart-wrap">
 <div class="chart-title"><i class="fa-solid fa-location-dot"></i> Top Cities</div>
 <div class="city-list">${citiesHtml}</div>
 </div>
 <div style="text-align:right;margin-top:16px;">
 <button class="admin-btn" onclick="exportOrdersExcel()">
 <i class="fa-solid fa-file-excel"></i> Excel Export
 </button>
 </div>`;
 } catch(e){
 if(wrap) wrap.innerHTML = `<p style="color:#e00;">Analytics load nahi hui: ${e.message}</p>`;
 }
}
window.exportOrdersExcel = async function(){
 showAdminToast("⏳ Excel file ban rahi hai...");
 try {
 let snap = await getDocs(collection(db, "orders"));
 let rows = [["Order ID","Product","Price","Final Price","Coupon","Size","Status","Naam","Phone","Alt Phone","Address","City","State","Pincode","Notes","Date"]];
 snap.forEach(d => {
 let o = d.data();
 let date = o.orderTime ? new Date(o.orderTime.seconds*1000).toLocaleString("en-IN") : "";
 rows.push([
 d.id.slice(0,8).toUpperCase(),
 o.productTitle||"",
 o.productPrice||0,
 o.finalOrderPrice||o.productPrice||0,
 o.couponCode||"",
 o.selectedSize||"",
 o.status||"pending",
 o.naam||"",
 o.phone||"",
 o.altPhone||"",
 o.address||"",
 o.city||"",
 o.state||"",
 o.pincode||"",
 o.notes||"",
 date
 ]);
 });
 let csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
 let blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
 let url = URL.createObjectURL(blob);
 let a = document.createElement("a");
 a.href = url;
 a.download = `fashion-empire-orders-${new Date().toISOString().slice(0,10)}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 showAdminToast("✅ Excel file download ho gayi!");
 } catch(e){
 showAdminToast("❌ Export failed: " + e.message, true);
 }
};
async function loadCouponsAdmin(){
 let wrap = document.getElementById("couponsListWrap");
 if(!wrap) return;
 try {
 let snap = await getDocs(collection(db, "coupons"));
 if(snap.empty){
 wrap.innerHTML = `<p style="color:#aaa;text-align:center;padding:20px;">Koi coupons nahi hain. Upar se banao!</p>`;
 return;
 }
 wrap.innerHTML = "";
 snap.forEach(d => {
 let c = d.data();
 let typeText = c.type === "percent" ? `${c.value}% off` : `₹${c.value} off`;
 let minText = c.minOrder ? ` (min order ₹${c.minOrder})` : "";
 let div = document.createElement("div");
 div.className = "coupon-card";
 div.innerHTML = `
 <div>
 <div class="coupon-card-code">${c.code||""}</div>
 <div class="coupon-card-info" style="margin-top:6px;">${typeText}${minText}</div>
 </div>
 <div style="display:flex;gap:8px;align-items:center;">
 <button class="coupon-toggle ${c.active?'active':'inactive'}" onclick="toggleCoupon('${d.id}',${!c.active})">
 ${c.active ? "✅ Active" : "❌ Inactive"}
 </button>
 <button class="icon-btn del" onclick="deleteCoupon('${d.id}')"><i class="fa-solid fa-trash"></i></button>
 </div>`;
 wrap.appendChild(div);
 });
 } catch(e){
 if(wrap) wrap.innerHTML = `<p style="color:#e00;">Error: ${e.message}</p>`;
 }
}
window.saveCoupon = async function(){
 let code = document.getElementById("cpCode")?.value.trim().toUpperCase();
 let type = document.getElementById("cpType")?.value;
 let value = parseFloat(document.getElementById("cpValue")?.value);
 let minOrder = parseFloat(document.getElementById("cpMinOrder")?.value) || 0;
 if(!code || !value){ showAdminToast("❌ Code aur value zaroori hai!", true); return; }
 try {
 await addDoc(collection(db,"coupons"),{ code, type, value, minOrder, active:true, createdAt:serverTimestamp() });
 showAdminToast(`✅ Coupon "${code}" ban gaya!`);
 ["cpCode","cpValue","cpMinOrder"].forEach(id=>{ let el=document.getElementById(id); if(el) el.value=""; });
 loadCouponsAdmin();
 } catch(e){ showAdminToast("❌ Error: "+e.message, true); }
};
window.toggleCoupon = async function(id, newActive){
 try {
 await updateDoc(doc(db,"coupons",id), { active:newActive });
 showAdminToast(newActive ? "✅ Coupon active ho gaya!" : "⏸️ Coupon deactivate ho gaya!");
 loadCouponsAdmin();
 } catch(e){ showAdminToast("❌ Error: "+e.message, true); }
};
window.deleteCoupon = async function(id){
 if(!confirm("Ye coupon delete karna chahte ho?")) return;
 try {
 await deleteDoc(doc(db,"coupons",id));
 showAdminToast("🗑️ Coupon delete ho gaya!");
 loadCouponsAdmin();
 } catch(e){ showAdminToast("❌ Error: "+e.message, true); }
};