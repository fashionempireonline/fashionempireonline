import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw6dKBEDGfuh-he23WHJGG-L6mRDH_lFo",
  authDomain: "fashion-empire-online.firebaseapp.com",
  projectId: "fashion-empire-online",
  storageBucket: "fashion-empire-online.firebasestorage.app",
  messagingSenderId: "270445447440",
  appId: "1:270445447440:web:17b31b34a0bbecbe87bd95"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* ============================
   CART & WISHLIST — localStorage se load
============================ */
let cart     = JSON.parse(localStorage.getItem("fe_cart")     || "[]");
let wishlist = JSON.parse(localStorage.getItem("fe_wishlist") || "[]");
let allProducts = {};

/* ============================
   PAGINATION STATE
============================ */
const PAGE_SIZE = 12;
let lastVisible = null;
let isLoadingMore = false;
let allLoaded = false;

/* ============================
   SAVE TO LOCALSTORAGE
============================ */
function saveCart()    { localStorage.setItem("fe_cart",     JSON.stringify(cart));     }
function saveWishlist(){ localStorage.setItem("fe_wishlist", JSON.stringify(wishlist));  }

/* ============================
   TOAST
============================ */
function showToast(msg){
  let t = document.getElementById("toast");
  if(!t) return;
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), 2500);
}
window.showToast = showToast;

/* ============================
   XSS SAFE — TEXT ESCAPE
============================ */
function escapeHtml(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/* ============================
   DISCOUNT CALC
============================ */
function calculateDiscount(oldPrice, price){
  if(!oldPrice || !price) return "";
  return Math.round(((oldPrice - price) / oldPrice) * 100) + "% OFF";
}

/* ============================
   SKELETON LOADER
============================ */
function showSkeletons(){
  let c = document.getElementById("products");
  if(!c) return;
  c.innerHTML = Array(8).fill(`
    <div class="card skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line short"></div>
    </div>`).join("");
}

/* ============================
   BUILD CARD — XSS SAFE (DOM API use karo)
============================ */
function buildCard(docId, p){
  let discount  = calculateDiscount(p.oldprice, p.price);
  let inWish    = wishlist.find(i => i.id === docId);
  let safeTitle = escapeHtml(p.title || "Product");
  let safePrice = escapeHtml(String(p.price || 0));
  let safeOld   = escapeHtml(String(p.oldprice || ""));
  let safeCat   = escapeHtml((p.category || "all").toLowerCase());
  let safeImg   = escapeHtml(p.image1 || "");

  let card = document.createElement("div");
  card.className           = "card";
  card.dataset.category    = safeCat;
  card.dataset.price       = p.price || 0;
  card.dataset.id          = docId;
  card.dataset.createdAt   = p.createdAt?.seconds || 0;
  card.style.animation     = "fadeInUp 0.5s ease both";

  // Image container
  let imgDiv = document.createElement("div");
  imgDiv.className = "image";

  let img = document.createElement("img");
  img.src     = safeImg;
  img.alt     = safeTitle;
  img.loading = "lazy";
  imgDiv.appendChild(img);

  if(discount){
    let badge = document.createElement("span");
    badge.className   = "badge-discount";
    badge.textContent = discount;
    imgDiv.appendChild(badge);
  }

  let wishBtn = document.createElement("button");
  wishBtn.className = "wishlist-card-btn";
  wishBtn.id        = `wbtn-${docId}`;
  wishBtn.innerHTML = inWish
    ? `<i class="fa-solid fa-heart" style="color:#ff416c;"></i>`
    : `<i class="fa-regular fa-heart"></i>`;
  wishBtn.addEventListener("click", () => window.toggleWishlist(docId));
  imgDiv.appendChild(wishBtn);

  // Info container
  let info = document.createElement("div");
  info.className = "info";

  let h3 = document.createElement("h3");
  h3.textContent = p.title || "Product";
  info.appendChild(h3);

  let priceDiv = document.createElement("div");
  priceDiv.className = "price";
  priceDiv.innerHTML = `<span class="new">₹${safePrice}</span>` +
    (p.oldprice ? `<span class="old">₹${safeOld}</span>` : "");
  info.appendChild(priceDiv);

  let ratingDiv = document.createElement("div");
  ratingDiv.className = "card-rating";
  ratingDiv.id        = `rating-${docId}`;
  ratingDiv.innerHTML = `<span class="stars" style="color:#ddd;">★★★★★</span><span class="rating-count">loading...</span>`;
  info.appendChild(ratingDiv);

  let btnDiv = document.createElement("div");
  btnDiv.className = "card-buttons";

  let cartBtn = document.createElement("button");
  cartBtn.className = "cart-btn";
  cartBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Add To Cart`;
  cartBtn.addEventListener("click", () => window.addToCart(docId));
  btnDiv.appendChild(cartBtn);

  let viewBtn = document.createElement("button");
  viewBtn.className = "view-btn";
  viewBtn.innerHTML = `<i class="fa-solid fa-eye"></i> View`;
  viewBtn.addEventListener("click", () => { window.location.href = `product.html?id=${encodeURIComponent(docId)}`; });
  btnDiv.appendChild(viewBtn);
  info.appendChild(btnDiv);

  let waBtn = document.createElement("button");
  waBtn.className = "whatsapp-btn";
  waBtn.innerHTML = `<i class="fa-brands fa-whatsapp"></i> Order On WhatsApp`;
  waBtn.addEventListener("click", () => window.orderWhatsApp(p.title || "", docId));
  info.appendChild(waBtn);

  card.appendChild(imgDiv);
  card.appendChild(info);
  return card;
}

/* ============================
   LOAD PRODUCTS — Pagination
============================ */
async function loadFirebaseProducts(isLoadMore = false){
  if(isLoadingMore || allLoaded) return;
  isLoadingMore = true;

  if(!isLoadMore) showSkeletons();

  try {
    let container = document.getElementById("products");
    if(!container) return;

    // Build query with pagination
    let q;
    if(lastVisible && isLoadMore){
      q = query(collection(db, "products"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(PAGE_SIZE));
    } else {
      q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
      container.innerHTML = "";
    }

    const snap = await getDocs(q);

    if(snap.empty && !isLoadMore){
      container.innerHTML = `<p style="padding:20px;color:#888;grid-column:1/-1;text-align:center;">Koi products nahi mile.</p>`;
      hideLoadMoreBtn();
      return;
    }

    if(snap.empty){
      allLoaded = true;
      hideLoadMoreBtn();
      showToast("✅ Sab products load ho gaye!");
      return;
    }

    snap.forEach(d => {
      let p = d.data();
      allProducts[d.id] = p;
      container.appendChild(buildCard(d.id, p));
    });

    lastVisible = snap.docs[snap.docs.length - 1];

    // Agar returned items PAGE_SIZE se kam hain toh sab load ho gaye
    if(snap.docs.length < PAGE_SIZE){
      allLoaded = true;
      hideLoadMoreBtn();
    } else {
      showLoadMoreBtn();
    }

    if(!isLoadMore){
      loadAllRatings();
    }
    loadRecommended();

  } catch(err){
    console.error(err);
    let c = document.getElementById("products");
    if(c) c.innerHTML = `<p style="padding:20px;color:#e00;grid-column:1/-1;text-align:center;">Products load nahi hue. Refresh karein.</p>`;
  } finally {
    isLoadingMore = false;
  }
}

function showLoadMoreBtn(){
  let existing = document.getElementById("loadMoreBtn");
  if(existing) return;
  let btn = document.createElement("button");
  btn.id        = "loadMoreBtn";
  btn.className = "load-more-btn";
  btn.innerHTML = `<i class="fa-solid fa-arrow-down"></i> Aur Products Dekho`;
  btn.style.cssText = `
    display:block; margin:30px auto; padding:14px 36px;
    background:linear-gradient(135deg,#ff416c,#ff4b2b);
    color:white; border:none; border-radius:50px;
    font-family:'Poppins',sans-serif; font-size:15px;
    font-weight:600; cursor:pointer; transition:0.3s;
    box-shadow:0 5px 20px rgba(255,65,108,0.3);
  `;
  btn.addEventListener("click", () => {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;
    btn.disabled  = true;
    loadFirebaseProducts(true).then(()=>{
      if(!allLoaded){
        btn.innerHTML = `<i class="fa-solid fa-arrow-down"></i> Aur Products Dekho`;
        btn.disabled  = false;
      }
    });
  });
  btn.addEventListener("mouseenter", () => btn.style.transform = "translateY(-2px)");
  btn.addEventListener("mouseleave", () => btn.style.transform = "translateY(0)");

  // Insert after products section
  let productsSection = document.getElementById("products");
  if(productsSection && productsSection.parentNode){
    productsSection.parentNode.insertBefore(btn, productsSection.nextSibling);
  }
}

function hideLoadMoreBtn(){
  let btn = document.getElementById("loadMoreBtn");
  if(btn) btn.remove();
}

loadFirebaseProducts();

/* ============================
   RATINGS
============================ */
async function loadAllRatings(){
  try {
    let snap = await getDocs(collection(db, "reviews"));
    let ratings = {};
    snap.forEach(d => {
      let r = d.data();
      if(!r.productId || !r.rating) return;
      if(!ratings[r.productId]) ratings[r.productId] = { sum:0, count:0 };
      ratings[r.productId].sum   += r.rating;
      ratings[r.productId].count += 1;
    });

    Object.keys(ratings).forEach(pid => {
      let avg   = (ratings[pid].sum / ratings[pid].count).toFixed(1);
      let count = ratings[pid].count;
      let el    = document.getElementById(`rating-${pid}`);
      if(el){
        let filled = Math.round(avg);
        let stars  = "★".repeat(filled) + "☆".repeat(5-filled);
        el.innerHTML = `<span class="stars" style="color:#f5a623;">${stars}</span> <span class="rating-count">${avg} (${count})</span>`;
      }
    });

    document.querySelectorAll(".card-rating").forEach(el => {
      if(el.querySelector(".rating-count")?.innerText === "loading..."){
        el.innerHTML = `<span class="stars" style="color:#ddd;">★★★★★</span> <span class="rating-count" style="color:#ccc;">No reviews yet</span>`;
      }
    });
  } catch(e){ console.error(e); }
}

/* ============================
   RECOMMENDED
============================ */
function loadRecommended(){
  let section = document.getElementById("recommendedSection");
  if(!section) return;

  let lastCat = localStorage.getItem("fe_lastCategory") || null;
  let recIds  = [];

  Object.keys(allProducts).forEach(id => {
    let p = allProducts[id];
    if(!lastCat || (p.category||"").toLowerCase() === lastCat.toLowerCase()){
      recIds.push(id);
    }
  });

  if(recIds.length < 4){
    Object.keys(allProducts).forEach(id => {
      if(!recIds.includes(id)) recIds.push(id);
    });
  }

  recIds = recIds.slice(0, 4);
  if(recIds.length === 0){ section.style.display="none"; return; }

  let wrap = document.getElementById("recommendedGrid");
  if(!wrap) return;
  wrap.innerHTML = "";
  recIds.forEach(id => {
    let card = buildCard(id, allProducts[id]);
    wrap.appendChild(card);
  });
  section.style.display = "block";
}

/* ============================
   ADVANCED FILTER
============================ */
window.applyFilters = function(){
  let minP   = parseFloat(document.getElementById("filterMinPrice")?.value) || 0;
  let maxP   = parseFloat(document.getElementById("filterMaxPrice")?.value) || Infinity;
  let selCat = document.getElementById("filterCategory")?.value || "all";
  let hasDisc= document.getElementById("filterDiscount")?.checked;

  let visibleCount = 0;
  document.querySelectorAll(".card").forEach(card => {
    let price = parseFloat(card.dataset.price || 0);
    let cat   = card.dataset.category || "all";
    let id    = card.dataset.id;
    let p     = allProducts[id] || {};
    let hasD  = p.oldprice && p.price && p.oldprice > p.price;

    let show = price >= minP && price <= maxP;
    if(selCat !== "all" && cat !== selCat) show = false;
    if(hasDisc && !hasD) show = false;

    card.style.display = show ? "block" : "none";
    if(show) visibleCount++;
  });

  // No results message
  let noRes = document.getElementById("noResultsMsg");
  if(visibleCount === 0){
    if(!noRes){
      let msg = document.createElement("p");
      msg.id        = "noResultsMsg";
      msg.style.cssText = "padding:40px;color:#888;grid-column:1/-1;text-align:center;font-size:15px;";
      msg.textContent   = "😕 Koi products nahi mile. Filters change karo.";
      document.getElementById("products").appendChild(msg);
    }
  } else {
    if(noRes) noRes.remove();
  }

  closeFilterPanel();
  showToast("✅ Filter apply ho gaya!");
};

window.clearFilters = function(){
  let fields = ["filterMinPrice","filterMaxPrice","filterCategory","filterDiscount"];
  fields.forEach(id => {
    let el = document.getElementById(id);
    if(!el) return;
    if(el.type === "checkbox") el.checked = false;
    else el.value = el.tagName === "SELECT" ? "all" : "";
  });
  document.querySelectorAll(".card").forEach(c => c.style.display = "block");
  let noRes = document.getElementById("noResultsMsg");
  if(noRes) noRes.remove();
  closeFilterPanel();
  showToast("🔄 Filters clear ho gaye!");
};

window.openFilterPanel  = () => {
  document.getElementById("filterPanel").classList.add("open");
  document.getElementById("filterOverlay").classList.add("open");
};
window.closeFilterPanel = () => {
  document.getElementById("filterPanel").classList.remove("open");
  document.getElementById("filterOverlay").classList.remove("open");
};

/* ============================
   CART — XSS Safe renderCart
============================ */
window.addToCart = function(id){
  let p = allProducts[id];
  if(!p) return;
  let existing = cart.find(i => i.id === id);
  if(existing){
    existing.qty++;
    showToast(`🛒 ${escapeHtml(p.title)} — Qty: ${existing.qty}`);
  } else {
    cart.push({ id, name: p.title, price: p.price, image: p.image1, qty: 1 });
    showToast("🛒 Cart mein add ho gaya!");
  }
  saveCart();
  renderCart();
  updateBadges();
  localStorage.setItem("fe_lastCategory", (p.category||"").toLowerCase());
};

window.increaseQty = function(id){
  let item = cart.find(i => i.id === id);
  if(item){ item.qty++; saveCart(); renderCart(); updateBadges(); }
};

window.decreaseQty = function(id){
  let idx = cart.findIndex(i => i.id === id);
  if(idx === -1) return;
  if(cart[idx].qty > 1){ cart[idx].qty--; }
  else { cart.splice(idx, 1); }
  saveCart(); renderCart(); updateBadges();
};

window.removeItem = function(id){
  cart = cart.filter(i => i.id !== id);
  saveCart(); renderCart(); updateBadges();
  showToast("🗑️ Item remove ho gaya");
};

/* ============================
   RENDER CART — XSS Safe (DOM API)
============================ */
function renderCart(){
  let cartItems  = document.getElementById("cart-items");
  let cartFooter = document.getElementById("cart-footer");
  if(!cartItems) return;
  cartItems.innerHTML = "";

  if(cart.length === 0){
    cartItems.innerHTML = "<p class='empty-msg'>🛒 Cart is empty</p>";
    if(cartFooter) cartFooter.style.display = "none";
    return;
  }

  let total = 0;
  cart.forEach(item => {
    total += item.price * item.qty;

    let div = document.createElement("div");
    div.className = "cart-item";

    let img = document.createElement("img");
    img.src = item.image || "";
    img.alt = item.name  || "Product";
    div.appendChild(img);

    let info = document.createElement("div");
    info.className = "cart-item-info";

    let h4 = document.createElement("h4");
    h4.textContent = item.name || "Product";
    info.appendChild(h4);

    let priceP = document.createElement("p");
    priceP.className   = "cart-item-price";
    priceP.textContent = `₹${item.price}`;
    info.appendChild(priceP);

    let qtyRow = document.createElement("div");
    qtyRow.className = "qty-row";

    let minusBtn = document.createElement("button");
    minusBtn.className   = "qty-btn";
    minusBtn.textContent = "−";
    minusBtn.addEventListener("click", ()=> window.decreaseQty(item.id));

    let qtySpan = document.createElement("span");
    qtySpan.textContent = item.qty;

    let plusBtn = document.createElement("button");
    plusBtn.className   = "qty-btn";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", ()=> window.increaseQty(item.id));

    let removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    removeBtn.addEventListener("click", ()=> window.removeItem(item.id));

    qtyRow.appendChild(minusBtn);
    qtyRow.appendChild(qtySpan);
    qtyRow.appendChild(plusBtn);
    qtyRow.appendChild(removeBtn);
    info.appendChild(qtyRow);
    div.appendChild(info);
    cartItems.appendChild(div);
  });

  let totalEl = document.getElementById("cart-total-price");
  if(totalEl) totalEl.textContent = `₹${total}`;
  if(cartFooter) cartFooter.style.display = "block";
}

window.checkoutWhatsApp = function(){
  let msg = "Hello! Mujhe ye products order karne hain:\n\n";
  let total = 0;
  cart.forEach(item => {
    msg += `• ${item.name} x${item.qty} = ₹${item.price * item.qty}\n`;
    total += item.price * item.qty;
  });
  msg += `\n*Total: ₹${total}*\n\nKripya order confirm karein.`;
  window.open(`https://wa.me/919174709695?text=${encodeURIComponent(msg)}`, "_blank");
};

window.openCart  = () => document.getElementById("cartPopup").classList.add("active");
window.closeCart = () => document.getElementById("cartPopup").classList.remove("active");

/* ============================
   WISHLIST — XSS Safe
============================ */
window.toggleWishlist = function(id){
  let p = allProducts[id];
  if(!p) return;
  let idx = wishlist.findIndex(i => i.id === id);
  let btn = document.getElementById(`wbtn-${id}`);

  if(idx !== -1){
    wishlist.splice(idx, 1);
    if(btn) btn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
    showToast("💔 Wishlist se hata diya");
  } else {
    wishlist.push({ id, title: p.title, price: p.price, image: p.image1 });
    if(btn) btn.innerHTML = `<i class="fa-solid fa-heart" style="color:#ff416c;"></i>`;
    showToast("❤️ Wishlist mein add ho gaya!");
  }
  saveWishlist(); renderWishlist(); updateBadges();
};

window.removeWishlist = function(id){
  wishlist = wishlist.filter(i => i.id !== id);
  let btn = document.getElementById(`wbtn-${id}`);
  if(btn) btn.innerHTML = `<i class="fa-regular fa-heart"></i>`;
  saveWishlist(); renderWishlist(); updateBadges();
  showToast("💔 Wishlist se hata diya");
};

/* ============================
   RENDER WISHLIST — XSS Safe (DOM API)
============================ */
function renderWishlist(){
  let el = document.getElementById("wishlist-items");
  if(!el) return;
  el.innerHTML = "";
  if(wishlist.length === 0){
    el.innerHTML = "<p class='empty-msg'>💔 Wishlist is empty</p>";
    return;
  }
  wishlist.forEach(item => {
    let div = document.createElement("div");
    div.className = "cart-item";

    let img = document.createElement("img");
    img.src = item.image || "";
    img.alt = item.title || "Product";
    div.appendChild(img);

    let info = document.createElement("div");
    info.className = "cart-item-info";

    let h4 = document.createElement("h4");
    h4.textContent = item.title || "Product";
    info.appendChild(h4);

    let priceP = document.createElement("p");
    priceP.className   = "cart-item-price";
    priceP.textContent = `₹${item.price}`;
    info.appendChild(priceP);

    let qtyRow = document.createElement("div");
    qtyRow.className = "qty-row";

    let addBtn = document.createElement("button");
    addBtn.className = "cart-btn";
    addBtn.style.cssText = "padding:8px 12px;font-size:12px;";
    addBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Add to Cart`;
    addBtn.addEventListener("click", ()=>{ window.addToCart(item.id); closeWishlist(); openCart(); });

    let removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    removeBtn.addEventListener("click", ()=> window.removeWishlist(item.id));

    qtyRow.appendChild(addBtn);
    qtyRow.appendChild(removeBtn);
    info.appendChild(qtyRow);
    div.appendChild(info);
    el.appendChild(div);
  });
}

window.openWishlist  = () => document.getElementById("wishlistPopup").classList.add("active");
window.closeWishlist = () => document.getElementById("wishlistPopup").classList.remove("active");

/* ============================
   BADGES
============================ */
function updateBadges(){
  let cc = cart.reduce((s,i)=>s+i.qty, 0);
  let wc = wishlist.length;
  let cb = document.getElementById("cartBadge");
  let wb = document.getElementById("wishlistBadge");
  if(cb){ cb.innerText=cc; cb.style.display=cc>0?"flex":"none"; }
  if(wb){ wb.innerText=wc; wb.style.display=wc>0?"flex":"none"; }
}

/* ============================
   CATEGORY FILTER
============================ */
window.filterCategory = function(category, el){
  category = category.toLowerCase();
  document.getElementById("searchInput").value = "";
  document.querySelectorAll(".category").forEach(c => c.classList.remove("active-cat"));
  if(el) el.classList.add("active-cat");

  let noRes = document.getElementById("noResultsMsg");
  if(noRes) noRes.remove();

  let visibleCount = 0;
  document.querySelectorAll(".card").forEach(card => {
    let show = category === "all" || card.dataset.category === category;
    card.style.display = show ? "block" : "none";
    if(show) visibleCount++;
  });

  if(visibleCount === 0){
    let msg = document.createElement("p");
    msg.id        = "noResultsMsg";
    msg.style.cssText = "padding:40px;color:#888;grid-column:1/-1;text-align:center;font-size:15px;";
    msg.textContent   = `😕 "${category}" category mein koi product nahi hai.`;
    document.getElementById("products").appendChild(msg);
  }

  if(category !== "all") localStorage.setItem("fe_lastCategory", category);
};

/* ============================
   LIVE SEARCH
============================ */
window.searchProducts = function(){
  let s = document.getElementById("searchInput").value.toLowerCase().trim();
  let noRes = document.getElementById("noResultsMsg");
  if(noRes) noRes.remove();

  let visibleCount = 0;
  document.querySelectorAll(".card").forEach(card => {
    let title = card.querySelector("h3")?.textContent.toLowerCase() || "";
    let cat   = card.dataset.category || "";
    let show  = title.includes(s) || cat.includes(s);
    card.style.display = show ? "block" : "none";
    if(show) visibleCount++;
  });

  if(s && visibleCount === 0){
    let msg = document.createElement("p");
    msg.id        = "noResultsMsg";
    msg.style.cssText = "padding:40px;color:#888;grid-column:1/-1;text-align:center;font-size:15px;";
    msg.textContent   = `😕 "${s}" ke liye koi result nahi mila.`;
    document.getElementById("products").appendChild(msg);
  }
};

/* ============================
   SORT — "New Arrivals" fix bhi
============================ */
window.sortProducts = function(){
  let val  = document.getElementById("sortSelect").value;
  let cont = document.getElementById("products");
  let cards= [...document.querySelectorAll("#products .card")];

  cards.sort((a,b)=>{
    let pa = parseFloat(a.dataset.price   || 0);
    let pb = parseFloat(b.dataset.price   || 0);
    let ta = parseInt(a.dataset.createdAt || 0);
    let tb = parseInt(b.dataset.createdAt || 0);

    if(val === "low")  return pa - pb;
    if(val === "high") return pb - pa;
    if(val === "new")  return tb - ta;  // ✅ Fixed: newest first
    return 0;
  });

  cards.forEach(c => cont.appendChild(c));
  showToast("✅ Products sort ho gaye!");
};

/* ============================
   WHATSAPP SINGLE
============================ */
window.orderWhatsApp = function(product, id){
  let productLink = id
    ? `${window.location.origin}/product.html?id=${id}`
    : window.location.href;
  let msg = `Hello! Mujhe ye product order karna hai:\n\n*${product}*\n\n🔗 Product Link:\n${productLink}\n\nKripya price aur availability batayein.`;
  window.open(`https://wa.me/919174709695?text=${encodeURIComponent(msg)}`, "_blank");
};

/* ============================
   LOGOUT
============================ */
window.logoutUser = function(){
  signOut(auth).then(()=>{
    localStorage.removeItem("fe_userName");
    localStorage.removeItem("fe_userEmail");
    showToast("👋 Logout ho gaye!");
    setTimeout(()=>{ window.location.href="login.html"; }, 1200);
  });
};

/* ============================
   INIT — render saved cart & wishlist
============================ */
renderCart();
renderWishlist();
updateBadges();
