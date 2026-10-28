const setupNotice = document.getElementById("setup-notice");
const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const dashboardMessage = document.getElementById("dashboard-message");
const contentList = document.getElementById("content-list");
const editorPanel = document.getElementById("editor-panel");
const contentForm = document.getElementById("content-form");
const kindField = contentForm.elements.kind;
const productForm = document.getElementById("product-form");
const productList = document.getElementById("product-list");
const productMessage = document.getElementById("product-message");
let supabaseClient;
let contentRows = [];
let productRows = [];
let activeContentFilter = "all";
let localMode = false;
let previewObjectUrls = [];
let productPreviewObjectUrls = [];
let framePickerObjectUrl = "";

function isVideoKind(kind) {
  return kind === "video" || kind === "process_video";
}

function isImageKind(kind) {
  return kind === "image" || kind === "process_image";
}

function kindLabel(kind) {
  if (kind === "video") return "Video";
  if (kind === "image") return "Poster";
  if (kind === "process_video") return "Video proses";
  if (kind === "process_image") return "Foto proses";
  return "Penjualan";
}

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setSignedOut(message = "") {
  loginPanel.hidden = false;
  dashboard.hidden = true;
  document.getElementById("logout-button").hidden = true;
  showMessage(loginMessage, message, Boolean(message));
}

async function hashLocalPassword(password) {
  if (!crypto.subtle) throw new Error("Browser ini tidak mendukung penyimpanan kata sandi lokal. Coba browser modern atau HTTPS.");
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashLocalPasswordWithSalt(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((part) => Number.parseInt(part, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations: 310000,
    hash: "SHA-256"
  }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function showLocalLogin() {
  localMode = true;
  setupNotice.hidden = false;
  loginPanel.hidden = false;
  dashboard.hidden = true;
  const hasLocalAdmin = Boolean(await window.portfolioLocalStore.getSetting("admin"));
  document.getElementById("local-activation-link").hidden = hasLocalAdmin;
  document.getElementById("login-email-field").hidden = true;
  loginForm.elements.email.required = false;
  document.getElementById("login-submit").textContent = "Login";
  loginForm.elements.password.autocomplete = "current-password";
  loginForm.elements.password.disabled = !hasLocalAdmin;
  document.getElementById("login-submit").disabled = !hasLocalAdmin;
  document.querySelector(".login-panel h1").textContent = "Login.";
  document.querySelector(".login-panel > p:not(.eyebrow, .message)").textContent = "Masukkan kata sandi untuk melanjutkan.";
  if (!hasLocalAdmin) {
    showMessage(loginMessage, "Login belum disiapkan pada perangkat ini.");
  }

  if (hasLocalAdmin && sessionStorage.getItem("porto-local-admin-session") === "active") {
    await enterLocalDashboard();
  } else {
    sessionStorage.removeItem("porto-local-admin-session");
  }
}

async function enterLocalDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.getElementById("logout-button").hidden = false;
  await Promise.all([loadContent(), loadLocalStatistics()]);
}

async function submitLocalLogin(formData) {
  const password = String(formData.get("password"));
  const storedAdmin = await window.portfolioLocalStore.getSetting("admin");
  if (!storedAdmin) {
    showMessage(loginMessage, "Akses admin belum diaktifkan pada browser ini.", true);
    return;
  }

  const passwordHash = storedAdmin.passwordAlgorithm === "pbkdf2-sha256"
    ? await hashLocalPasswordWithSalt(password, storedAdmin.passwordSalt)
    : await hashLocalPassword(password);
  if (passwordHash !== storedAdmin.passwordHash) {
    showMessage(loginMessage, "Sandi tidak cocok.", true);
    return;
  }
  sessionStorage.setItem("porto-local-admin-session", "active");
  await enterLocalDashboard();
}

async function verifyAdmin() {
  const { data, error } = await supabaseClient.rpc("is_site_admin");
  if (error) throw error;
  if (!data) {
    await supabaseClient.auth.signOut();
    setSignedOut("Akun ini tidak memiliki izin admin.");
    return false;
  }

  loginPanel.hidden = true;
  dashboard.hidden = false;
  document.getElementById("logout-button").hidden = false;
  await Promise.all([loadContent(), loadStatistics()]);
  return true;
}

async function loadContent() {
  if (localMode) {
    contentRows = await window.portfolioLocalStore.list();
    contentRows.sort((left, right) => left.sort_order - right.sort_order);
    renderContentList();
    productRows = contentRows.filter((row) => row.kind === "product");
    renderProductList();
    return;
  }
  const { data, error } = await supabaseClient
    .from("site_content")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  contentRows = data;
  renderContentList();
  try {
    await loadProducts();
  } catch (productError) {
    console.error("Gagal memuat aset digital:", productError);
    productRows = [];
    renderProductList();
    showMessage(productMessage, `Toko belum siap: ${productError.message}. Jalankan pembaruan SQL Supabase.`, true);
  }
}

async function loadLocalStatistics() {
  const [storageLabel, syncLabel] = document.querySelectorAll(".stat-card span");
  document.getElementById("today-count").textContent = "Browser ini";
  document.getElementById("total-count").textContent = "Tidak ada";
  storageLabel.textContent = "Penyimpanan konten";
  syncLabel.textContent = "Sinkronisasi ke pengunjung";
}

function renderContentList() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
  contentList.replaceChildren();
  const contentItems = contentRows.filter((row) => row.kind !== "product");
  const rows = activeContentFilter === "all"
    ? contentItems
    : activeContentFilter === "process"
      ? contentItems.filter((row) => row.kind.startsWith("process_"))
      : contentItems.filter((row) => row.kind === activeContentFilter);
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "empty-row";
    td.textContent = "Belum ada konten pada kategori ini.";
    tr.appendChild(td);
    contentList.appendChild(tr);
    return;
  }
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const previewCell = document.createElement("td");
    previewCell.className = "preview-cell";
    const preview = document.createElement("div");
    preview.className = `content-preview${isImageKind(row.kind) ? " content-preview-poster" : ""}`;
    const localImage = isImageKind(row.kind) ? row.blob : isVideoKind(row.kind) ? row.thumbnail_blob : null;
    const previewUrl = localImage instanceof Blob
      ? URL.createObjectURL(localImage)
      : isVideoKind(row.kind)
        ? row.thumbnail_url
        : isImageKind(row.kind)
          ? row.media_url
          : "";
    if (localImage instanceof Blob) previewObjectUrls.push(previewUrl);
    if (previewUrl && row.kind !== "sale") {
      const image = document.createElement("img");
      image.src = previewUrl;
      image.alt = `Pratinjau ${row.title}`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        preview.classList.add("content-preview-empty");
        image.remove();
        preview.textContent = isVideoKind(row.kind) ? "Video" : "Foto";
      }, { once: true });
      preview.appendChild(image);
    } else if (isVideoKind(row.kind) && (row.blob instanceof Blob || row.media_url)) {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = row.blob instanceof Blob ? URL.createObjectURL(row.blob) : row.media_url;
      if (row.blob instanceof Blob) previewObjectUrls.push(video.src);
      video.addEventListener("error", () => {
        preview.classList.add("content-preview-empty");
        video.remove();
        preview.textContent = "Video";
      }, { once: true });
      preview.appendChild(video);
    } else {
      preview.classList.add("content-preview-empty");
      preview.textContent = isVideoKind(row.kind) ? "Video" : isImageKind(row.kind) ? "Foto" : "Tautan";
    }
    previewCell.appendChild(preview);
    tr.appendChild(previewCell);
    const values = [
      kindLabel(row.kind),
      row.title,
      row.category || "—"
    ];
    values.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    const actionCell = document.createElement("td");
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "row-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editContent(row));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "row-button delete";
    deleteButton.textContent = "Hapus";
    deleteButton.addEventListener("click", () => deleteContent(row));
    actionCell.append(editButton, deleteButton);
    tr.appendChild(actionCell);
    contentList.appendChild(tr);
  });
}

async function loadProducts() {
  if (localMode) {
    productRows = contentRows.filter((row) => row.kind === "product");
    renderProductList();
    return;
  }
  const { data, error } = await supabaseClient.from("digital_products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  productRows = data;
  renderProductList();
}

function renderProductList() {
  productPreviewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  productPreviewObjectUrls = [];
  productList.replaceChildren();
  productRows.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-admin-card";
    const cover = document.createElement("img");
    cover.alt = `Sampul ${product.title}`;
    cover.loading = "lazy";
    cover.src = product.cover_blob instanceof Blob
      ? URL.createObjectURL(product.cover_blob)
      : product.cover_url;
    if (product.cover_blob instanceof Blob) productPreviewObjectUrls.push(cover.src);
    const copy = document.createElement("div");
    copy.className = "product-admin-copy";
    const title = document.createElement("h3");
    title.textContent = product.title;
    const details = document.createElement("p");
    details.textContent = `${product.asset_type} · ${formatProductPrice(product.price)}`;
    const actions = document.createElement("div");
    actions.className = "product-admin-actions";
    const edit = document.createElement("button");
    edit.className = "row-button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editProduct(product));
    const remove = document.createElement("button");
    remove.className = "row-button delete";
    remove.type = "button";
    remove.textContent = "Hapus";
    remove.addEventListener("click", () => deleteProduct(product));
    actions.append(edit, remove);
    copy.append(title, details, actions);
    card.append(cover, copy);
    productList.appendChild(card);
  });
  if (!productRows.length) {
    const empty = document.createElement("p");
    empty.className = "empty-row";
    empty.textContent = "Belum ada aset digital. Pilih “Tambah aset” untuk mulai.";
    productList.appendChild(empty);
  }
}

function formatProductPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(price));
}

function updateProductFields() {
  const previewType = productForm.elements.preview_type.value;
  const previewFileField = document.getElementById("product-preview-file-field");
  const previewYoutubeField = document.getElementById("product-preview-youtube-field");
  const current = productRows.find((product) => product.id === productForm.elements.id.value);
  const coverInput = productForm.elements.cover;
  const previewFileInput = productForm.elements.preview_file;
  const youtubeInput = productForm.elements.preview_youtube_url;
  previewFileField.hidden = previewType !== "video";
  previewYoutubeField.hidden = previewType !== "youtube";
  coverInput.required = !current?.cover_url && !(current?.cover_blob instanceof Blob);
  previewFileInput.required = previewType === "video"
    && !(current?.preview_type === "video" && current.preview_url);
  youtubeInput.required = previewType === "youtube";
}

function editProduct(product) {
  productForm.reset();
  productForm.elements.id.value = product.id;
  productForm.elements.title.value = product.title;
  productForm.elements.asset_type.value = product.asset_type;
  productForm.elements.price.value = product.price;
  productForm.elements.description.value = product.description;
  productForm.elements.checkout_url.value = product.checkout_url;
  productForm.elements.preview_type.value = product.preview_type || "video";
  productForm.elements.preview_youtube_url.value = product.preview_type === "youtube" ? product.preview_url : "";
  document.getElementById("product-form-title").textContent = "Edit aset digital";
  productForm.hidden = false;
  updateProductFields();
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openNewProductForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.preview_type.value = "video";
  document.getElementById("product-form-title").textContent = "Tambah aset digital";
  productForm.hidden = false;
  updateProductFields();
  productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductForm() {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.hidden = true;
  showMessage(productMessage, "");
  updateProductFields();
}

function isHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function normalizeYouTubeUrl(value) {
  const url = new URL(value);
  if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"].includes(url.hostname)) {
    throw new Error("Masukkan link YouTube yang valid.");
  }
  const videoId = url.hostname === "youtu.be"
    ? url.pathname.slice(1).split("/")[0]
    : url.pathname === "/watch"
      ? url.searchParams.get("v")
      : url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!videoId || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
    throw new Error("Link YouTube tidak berisi ID video yang valid.");
  }
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

async function uploadProductFile(file, suffix = "") {
  const extension = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${crypto.randomUUID()}${suffix}.${extension}`;
  const { error } = await supabaseClient.storage.from("site-media").upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return supabaseClient.storage.from("site-media").getPublicUrl(path).data.publicUrl;
}

async function saveProduct(event) {
  event.preventDefault();
  const formData = new FormData(productForm);
  const id = String(formData.get("id") || "");
  const current = productRows.find((product) => product.id === id);
  const cover = formData.get("cover");
  const previewFile = formData.get("preview_file");
  const previewType = String(formData.get("preview_type"));
  const youtubeInput = String(formData.get("preview_youtube_url") || "").trim();
  const checkoutUrl = String(formData.get("checkout_url") || "").trim();
  const price = Number(formData.get("price"));
  let previewUrl = "";

  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
    showMessage(productMessage, "Masukkan harga yang valid.", true);
    return;
  }
  if (!isHttpUrl(checkoutUrl)) {
    showMessage(productMessage, "Link pembelian harus dimulai dengan http:// atau https://.", true);
    return;
  }
  if (cover.size && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(cover.type)) {
    showMessage(productMessage, "Sampul harus JPG, PNG, WebP, atau GIF.", true);
    return;
  }
  if (cover.size > 20 * 1024 * 1024) {
    showMessage(productMessage, "Ukuran gambar sampul maksimal 20 MB.", true);
    return;
  }
  if (previewType === "youtube") {
    try {
      previewUrl = normalizeYouTubeUrl(youtubeInput);
    } catch (error) {
      showMessage(productMessage, error.message, true);
      return;
    }
  } else if (previewType === "video") {
    previewUrl = previewFile.size ? "" : current?.preview_type === "video" ? current.preview_url : "";
    if (previewFile.size && !["video/mp4", "video/webm", "video/quicktime"].includes(previewFile.type)) {
      showMessage(productMessage, "Video preview harus MP4, WebM, atau MOV.", true);
      return;
    }
    if (previewFile.size > 100 * 1024 * 1024) {
      showMessage(productMessage, "Ukuran video preview maksimal 100 MB. Gunakan link YouTube untuk file yang lebih besar.", true);
      return;
    }
    if (!previewFile.size && !previewUrl) {
      showMessage(productMessage, "Pilih video preview atau gunakan link YouTube.", true);
      return;
    }
  }
  if (!cover.size && !current?.cover_url && !(current?.cover_blob instanceof Blob)) {
    showMessage(productMessage, "Unggah gambar sampul produk.", true);
    return;
  }

  const button = productForm.querySelector('[type="submit"]');
  button.disabled = true;
  const newUploads = [];
  let saved = false;
  try {
    let coverUrl = current?.cover_url || "";
    let coverBlob = current?.cover_blob || null;
    if (cover.size) {
      if (localMode) {
        coverUrl = `local://product-cover/${id || crypto.randomUUID()}`;
        coverBlob = cover;
      } else {
        coverUrl = await uploadProductFile(cover, "-cover");
        newUploads.push(coverUrl);
        coverBlob = null;
      }
    }
    let previewBlob = null;
    if (previewType === "video") {
      if (previewFile.size) {
        if (localMode) {
          previewUrl = `local://product-preview/${id || crypto.randomUUID()}`;
          previewBlob = previewFile;
        } else {
          previewUrl = await uploadProductFile(previewFile, "-preview");
          newUploads.push(previewUrl);
        }
      } else {
        previewUrl = current?.preview_type === "video" ? current.preview_url : "";
        previewBlob = current?.preview_type === "video" ? current.preview_blob || null : null;
      }
    } else if (previewType === "none") {
      previewUrl = "";
    }

    const record = {
      title: String(formData.get("title")).trim(),
      description: String(formData.get("description")).trim(),
      asset_type: String(formData.get("asset_type")),
      price,
      cover_url: coverUrl,
      preview_url: previewUrl,
      preview_type: previewType,
      checkout_url: new URL(checkoutUrl).href,
      sort_order: current?.sort_order ?? productRows.length
    };

    if (localMode) {
      const productId = id || crypto.randomUUID();
      await window.portfolioLocalStore.save({
        ...record,
        id: productId,
        kind: "product",
        cover_blob: coverBlob,
        preview_blob: previewBlob
      });
    } else {
      const result = id
        ? await supabaseClient.from("digital_products").update(record).eq("id", id)
        : await supabaseClient.from("digital_products").insert(record);
      if (result.error) throw result.error;
    }
    saved = true;
    let cleanupWarning = false;
    const oldMedia = [];
    if (!localMode && current?.cover_url && cover.size) oldMedia.push(current.cover_url);
    if (!localMode && current?.preview_type === "video" && current.preview_url
      && (previewType !== "video" || previewFile.size)) oldMedia.push(current.preview_url);
    for (const mediaUrl of oldMedia) {
      try {
        await removeUploadedMedia(mediaUrl);
      } catch (cleanupError) {
        cleanupWarning = true;
        console.error("Aset tersimpan, tetapi file preview lama tidak dapat dihapus:", cleanupError);
      }
    }
    closeProductForm();
    try {
      await loadContent();
    } catch (refreshError) {
      console.error("Aset tersimpan, tetapi daftar aset gagal dimuat ulang:", refreshError);
      showMessage(productMessage, `Aset tersimpan, tetapi daftar belum dapat diperbarui: ${refreshError.message}`, true);
      return;
    }
    showMessage(productMessage, cleanupWarning
      ? "Aset tersimpan, tetapi file lama belum berhasil dihapus dari penyimpanan."
      : "Aset digital berhasil disimpan.", cleanupWarning);
  } catch (error) {
    console.error("Gagal menyimpan aset digital:", error);
    if (!saved) {
      for (const uploadUrl of newUploads) {
        try {
          await removeUploadedMedia(uploadUrl);
        } catch (cleanupError) {
          console.error("Gagal membersihkan upload produk yang belum tersimpan:", cleanupError);
        }
      }
    }
    showMessage(productMessage, `Gagal menyimpan aset: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

async function deleteProduct(product) {
  if (!window.confirm(`Hapus aset "${product.title}"?`)) return;
  try {
    if (localMode) {
      await window.portfolioLocalStore.remove(product.id);
    } else {
      const { error } = await supabaseClient.from("digital_products").delete().eq("id", product.id);
      if (error) throw error;
      let cleanupFailed = false;
      for (const mediaUrl of [product.cover_url, product.preview_type === "video" ? product.preview_url : ""]) {
        if (!mediaUrl) continue;
        try {
          await removeUploadedMedia(mediaUrl);
        } catch (cleanupError) {
          cleanupFailed = true;
          console.error("Produk dihapus, tetapi file aset belum dapat dihapus:", cleanupError);
        }
      }
      try {
        await loadContent();
      } catch (refreshError) {
        console.error("Produk dihapus, tetapi daftar aset gagal dimuat ulang:", refreshError);
        showMessage(productMessage, `Produk dihapus, tetapi daftar belum dapat diperbarui: ${refreshError.message}`, true);
        return;
      }
      showMessage(productMessage, cleanupFailed
        ? "Produk dihapus, tetapi file lama belum berhasil dihapus dari penyimpanan."
        : "Aset digital berhasil dihapus.", cleanupFailed);
      return;
    }
    try {
      await loadContent();
    } catch (refreshError) {
      console.error("Aset dihapus, tetapi daftar aset gagal dimuat ulang:", refreshError);
      showMessage(productMessage, `Aset dihapus, tetapi daftar belum dapat diperbarui: ${refreshError.message}`, true);
      return;
    }
    showMessage(productMessage, "Aset digital berhasil dihapus.");
  } catch (error) {
    console.error("Gagal menghapus aset digital:", error);
    showMessage(productMessage, `Gagal menghapus aset: ${error.message}`, true);
  }
}

async function loadStatistics() {
  const today = new Date().toISOString().slice(0, 10);
  const [todayResult, totalResult] = await Promise.all([
    supabaseClient.from("daily_visitors").select("*", { count: "exact", head: true }).eq("visited_on", today),
    supabaseClient.from("daily_visitors").select("*", { count: "exact", head: true })
  ]);
  if (todayResult.error) throw todayResult.error;
  if (totalResult.error) throw totalResult.error;
  document.getElementById("today-count").textContent = todayResult.count.toLocaleString("id-ID");
  document.getElementById("total-count").textContent = totalResult.count.toLocaleString("id-ID");
}

function editContent(row) {
  contentForm.elements.id.value = row.id;
  contentForm.elements.kind.value = row.kind;
  contentForm.elements.title.value = row.title;
  contentForm.elements.category.value = row.category;
  contentForm.elements.description.value = row.description;
  contentForm.elements.media_url.value = /^https?:\/\//i.test(row.media_url || "") ? row.media_url : "";
  contentForm.elements.link_url.value = row.link_url;
  contentForm.elements.media.value = "";
  contentForm.elements.thumbnail.value = "";
  document.getElementById("editor-title").textContent = "Edit konten";
  editorPanel.hidden = false;
  updateEditorFields();
  updateVideoFramePicker();
  editorPanel.scrollIntoView({ behavior: "smooth" });
}

function resetEditor() {
  clearVideoFramePicker();
  contentForm.reset();
  contentForm.elements.id.value = "";
  document.getElementById("editor-title").textContent = "Tambah konten";
  editorPanel.hidden = true;
  updateEditorFields();
}

function updateEditorFields() {
  const isSale = kindField.value === "sale";
  const isVideo = isVideoKind(kindField.value);
  contentForm.elements.media.accept = isVideo
    ? "video/mp4,video/webm,video/quicktime"
    : isSale
      ? ""
      : "image/jpeg,image/png,image/webp,image/gif";
  document.getElementById("media-field").hidden = isSale;
  document.getElementById("media-url-field").hidden = isSale;
  document.getElementById("thumbnail-field").hidden = !isVideo;
  document.getElementById("sale-url-field").hidden = !isSale;
  document.getElementById("video-frame-picker").hidden = !isVideo;
  contentForm.elements.link_url.required = isSale;
  contentForm.elements.media_url.required = !isSale && !contentForm.elements.id.value && !contentForm.elements.media.files.length;
  if (isVideo) updateVideoFramePicker();
}

function clearVideoFramePicker() {
  const video = document.getElementById("frame-picker-video");
  video.pause();
  video.removeAttribute("src");
  delete video.dataset.sourceKey;
  video.load();
  if (framePickerObjectUrl) URL.revokeObjectURL(framePickerObjectUrl);
  framePickerObjectUrl = "";
  document.getElementById("capture-video-frame").disabled = true;
  showMessage(document.getElementById("frame-picker-message"), "");
}

function updateVideoFramePicker() {
  const picker = document.getElementById("video-frame-picker");
  const video = document.getElementById("frame-picker-video");
  const captureButton = document.getElementById("capture-video-frame");
  if (!isVideoKind(kindField.value) || editorPanel.hidden) {
    picker.hidden = true;
    return;
  }
  picker.hidden = false;
  const selectedFile = contentForm.elements.media.files[0];
  const current = contentRows.find((row) => row.id === contentForm.elements.id.value);
  const sourceKey = selectedFile
    ? `file:${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`
    : current?.blob instanceof Blob
      ? `blob:${current.id}:${current.blob.size}`
      : contentForm.elements.media_url.value || current?.media_url || "";
  if (video.dataset.sourceKey === sourceKey) return;

  const source = selectedFile
    ? URL.createObjectURL(selectedFile)
    : current?.blob instanceof Blob
      ? URL.createObjectURL(current.blob)
      : sourceKey;
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (framePickerObjectUrl) URL.revokeObjectURL(framePickerObjectUrl);
  framePickerObjectUrl = source.startsWith("blob:") ? source : selectedFile || current?.blob instanceof Blob ? source : "";
  video.dataset.sourceKey = sourceKey;
  captureButton.disabled = true;
  if (!source) {
    showMessage(document.getElementById("frame-picker-message"), "Pilih file video atau isi URL video terlebih dahulu.");
    return;
  }
  video.crossOrigin = /^https?:\/\//i.test(source) ? "anonymous" : "";
  video.src = source;
  video.load();
  showMessage(document.getElementById("frame-picker-message"), "Geser pemutar ke frame yang ingin dipakai.");
}

async function captureVideoFrame() {
  const video = document.getElementById("frame-picker-video");
  const captureButton = document.getElementById("capture-video-frame");
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) {
    showMessage(document.getElementById("frame-picker-message"), "Tunggu sampai frame video siap dipilih.", true);
    return;
  }
  captureButton.disabled = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Frame tidak dapat dibuat sebagai gambar.")), "image/jpeg", 0.9);
    });
    const frame = new File([blob], `video-thumbnail-${Math.round(video.currentTime)}s.jpg`, { type: "image/jpeg" });
    const transfer = new DataTransfer();
    transfer.items.add(frame);
    contentForm.elements.thumbnail.files = transfer.files;
    showMessage(document.getElementById("frame-picker-message"), `Frame ${video.currentTime.toFixed(1)} detik dipilih. Simpan konten untuk menerapkan thumbnail.`);
  } catch (error) {
    console.error("Gagal mengambil frame thumbnail:", error);
    showMessage(document.getElementById("frame-picker-message"), `Tidak dapat mengambil frame. Coba video lokal atau URL yang mengizinkan akses gambar. ${error.message}`, true);
  } finally {
    captureButton.disabled = video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
  }
}

async function saveContent(event) {
  event.preventDefault();
  const formData = new FormData(contentForm);
  const id = formData.get("id");
  const kind = formData.get("kind");
  const upload = formData.get("media");
  const thumbnailUpload = formData.get("thumbnail");
  let mediaUrl = formData.get("media_url").trim();
  const current = contentRows.find((row) => row.id === id);
  const linkUrl = formData.get("link_url").trim();

  if (current && kind !== current.kind && kind !== "sale" && !upload.size) {
    showMessage(dashboardMessage, "Unggah media baru saat mengubah jenis gambar/video.", true);
    return;
  }
  if (kind !== "sale" && !upload.size && !mediaUrl && !current?.media_url) {
    showMessage(dashboardMessage, "Pilih file media atau isi URL media.", true);
    return;
  }
  if (kind !== "sale" && upload.size) {
    const isImage = upload.type.startsWith("image/");
    const isVideo = upload.type.startsWith("video/");
    if ((isImageKind(kind) && !isImage) || (isVideoKind(kind) && !isVideo)) {
      showMessage(dashboardMessage, "Jenis file tidak sesuai dengan jenis konten.", true);
      return;
    }
    if (upload.size > 100 * 1024 * 1024) {
      showMessage(dashboardMessage, "Ukuran file maksimal 100 MB.", true);
      return;
    }
  }
  if (thumbnailUpload.size && !isVideoKind(kind)) {
    showMessage(dashboardMessage, "Thumbnail hanya dapat ditambahkan ke konten video.", true);
    return;
  }
  if (thumbnailUpload.size && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(thumbnailUpload.type)) {
    showMessage(dashboardMessage, "Thumbnail harus JPG, PNG, WebP, atau GIF.", true);
    return;
  }
  if (thumbnailUpload.size > 20 * 1024 * 1024) {
    showMessage(dashboardMessage, "Ukuran thumbnail maksimal 20 MB.", true);
    return;
  }
  if (kind !== "sale" && mediaUrl && !/^https?:\/\//i.test(mediaUrl)) {
    showMessage(dashboardMessage, "URL media harus dimulai dengan http:// atau https://.", true);
    return;
  }
  if (kind === "sale" && !/^https?:\/\//i.test(linkUrl)) {
    showMessage(dashboardMessage, "Link penjualan harus dimulai dengan http:// atau https://.", true);
    return;
  }

  if (localMode) {
    await saveLocalContent({ formData, id, kind, upload, thumbnailUpload, mediaUrl, current, linkUrl });
    return;
  }

  const saveButton = contentForm.querySelector('[type="submit"]');
  saveButton.disabled = true;
  const uploadedMediaUrls = [];
  let recordSaved = false;
  try {
    if (kind !== "sale" && upload.size) {
      const extension = upload.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const storagePath = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from("site-media").upload(storagePath, upload, {
        contentType: upload.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      mediaUrl = supabaseClient.storage.from("site-media").getPublicUrl(storagePath).data.publicUrl;
      uploadedMediaUrls.push(mediaUrl);
    } else if (kind === "sale") {
      mediaUrl = "";
    }

    let thumbnailUrl = isVideoKind(kind) || (isImageKind(kind) && !upload.size)
      ? current?.thumbnail_url || ""
      : "";
    if (isVideoKind(kind) && thumbnailUpload.size) {
      const extension = thumbnailUpload.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
      const storagePath = `${crypto.randomUUID()}-thumbnail.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from("site-media").upload(storagePath, thumbnailUpload, {
        contentType: thumbnailUpload.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      thumbnailUrl = supabaseClient.storage.from("site-media").getPublicUrl(storagePath).data.publicUrl;
      uploadedMediaUrls.push(thumbnailUrl);
    }

    const record = {
      kind,
      title: formData.get("title").trim(),
      description: formData.get("description").trim(),
      category: formData.get("category").trim(),
      media_url: mediaUrl || current?.media_url || "",
      thumbnail_url: thumbnailUrl,
      link_url: kind === "sale" ? linkUrl : "",
      sort_order: current?.sort_order ?? contentRows.length
    };
    const result = id
      ? await supabaseClient.from("site_content").update(record).eq("id", id)
      : await supabaseClient.from("site_content").insert(record);
    if (result.error) throw result.error;
    recordSaved = true;
    if (kind !== "sale") {
      const { error: stateError } = await supabaseClient.from("site_content_state")
        .upsert({ kind, managed: true });
      if (stateError) throw stateError;
    }

    let cleanupWarning = "";
    if ((upload.size || kind === "sale") && current?.media_url) {
      try {
        await removeUploadedMedia(current.media_url);
      } catch (error) {
        console.error("Konten tersimpan, tetapi media lama tidak dapat dihapus:", error);
        cleanupWarning = " Konten tersimpan, tetapi file lama belum berhasil dihapus dari penyimpanan.";
      }
    }
    if ((thumbnailUpload.size || !isVideoKind(kind)) && current?.thumbnail_url) {
      try {
        await removeUploadedMedia(current.thumbnail_url);
      } catch (error) {
        console.error("Konten tersimpan, tetapi thumbnail lama tidak dapat dihapus:", error);
        cleanupWarning += " Thumbnail lama belum berhasil dihapus dari penyimpanan.";
      }
    }
    resetEditor();
    await loadContent();
    showMessage(dashboardMessage, `Konten berhasil disimpan.${cleanupWarning}`);
  } catch (error) {
    console.error("Gagal menyimpan konten:", error);
    if (!recordSaved) {
      for (const uploadedMediaUrl of uploadedMediaUrls) {
        try {
          await removeUploadedMedia(uploadedMediaUrl);
        } catch (cleanupError) {
          console.error("Gagal membersihkan file upload yang tidak tersimpan:", cleanupError);
        }
      }
    }
    if (recordSaved) {
      resetEditor();
      await loadContent();
      showMessage(dashboardMessage, `Konten tersimpan, tetapi ada masalah saat memperbarui daftar: ${error.message}`, true);
      return;
    }
    showMessage(dashboardMessage, `Gagal menyimpan konten: ${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
}

async function saveLocalContent({ formData, id, kind, upload, thumbnailUpload, mediaUrl, current, linkUrl }) {
  const saveButton = contentForm.querySelector('[type="submit"]');
  saveButton.disabled = true;
  try {
    const recordId = id || crypto.randomUUID();
    const record = {
      id: recordId,
      kind,
      title: formData.get("title").trim(),
      description: formData.get("description").trim(),
      category: formData.get("category").trim(),
      media_url: kind === "sale" ? "" : upload.size ? `local://${recordId}` : mediaUrl || current?.media_url || "",
      thumbnail_url: isVideoKind(kind) || (isImageKind(kind) && !upload.size)
        ? current?.thumbnail_url || ""
        : "",
      link_url: kind === "sale" ? linkUrl : "",
      sort_order: current?.sort_order ?? contentRows.length,
      blob: kind === "sale" ? null : upload.size ? upload : current?.blob || null,
      thumbnail_blob: isVideoKind(kind) ? thumbnailUpload.size ? thumbnailUpload : current?.thumbnail_blob || null : null
    };
    await window.portfolioLocalStore.save(record);
    if (kind !== "sale") await window.portfolioLocalStore.setSetting(`managed:${kind}`, true);
    resetEditor();
    await loadContent();
    showMessage(dashboardMessage, "Konten tersimpan di browser ini saja.");
  } catch (error) {
    console.error("Gagal menyimpan konten lokal:", error);
    showMessage(dashboardMessage, `Gagal menyimpan konten: ${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
}

async function removeUploadedMedia(mediaUrl) {
  let media;
  const config = window.PORTFOLIO_SUPABASE_CONFIG;
  try {
    media = new URL(mediaUrl);
  } catch {
    return;
  }
  const project = new URL(config.url);
  const prefix = "/storage/v1/object/public/site-media/";
  if (media.origin !== project.origin || !media.pathname.startsWith(prefix)) return;
  const path = decodeURIComponent(media.pathname.slice(prefix.length));
  const { error } = await supabaseClient.storage.from("site-media").remove([path]);
  if (error) throw error;
}

async function deleteContent(row) {
  if (!window.confirm(`Hapus "${row.title}"?`)) return;
  try {
    if (localMode) {
      await window.portfolioLocalStore.remove(row.id);
      if (row.kind !== "sale") await window.portfolioLocalStore.setSetting(`managed:${row.kind}`, true);
      await loadContent();
      showMessage(dashboardMessage, "Konten lokal berhasil dihapus dari browser ini.");
      return;
    }
    const { error } = await supabaseClient.from("site_content").delete().eq("id", row.id);
    if (error) throw error;
    await loadContent();
    if (row.media_url) {
      try {
        await removeUploadedMedia(row.media_url);
      } catch (cleanupError) {
        console.error("Konten sudah dihapus, tetapi media tidak dapat dihapus:", cleanupError);
        showMessage(dashboardMessage, "Konten dihapus, tetapi file lama belum berhasil dihapus dari penyimpanan.", true);
        return;
      }
      if (row.thumbnail_url) {
        try {
          await removeUploadedMedia(row.thumbnail_url);
        } catch (cleanupError) {
          console.error("Konten sudah dihapus, tetapi thumbnail tidak dapat dihapus:", cleanupError);
          showMessage(dashboardMessage, "Konten dihapus, tetapi thumbnail lama belum berhasil dihapus dari penyimpanan.", true);
          return;
        }
      }
    }
    showMessage(dashboardMessage, "Konten berhasil dihapus.");
  } catch (error) {
    console.error("Gagal menghapus konten:", error);
    showMessage(dashboardMessage, `Gagal menghapus konten: ${error.message}`, true);
  }
}

async function importDefaults() {
  if (contentRows.length && !window.confirm("Konten bawaan ditambahkan tanpa menimpa konten yang sudah ada. Lanjutkan?")) return;
  const defaults = [
    ...window.DEFAULT_SITE_CONTENT.videos.map((item, index) => ({
      content_key: `video-${index + 1}`,
      kind: "video",
      title: item.title,
      description: item.description,
      category: item.category,
      media_url: new URL(item.file, new URL("../halaman%201/index.html", window.location.href)).href,
      thumbnail_url: item.thumbnail
        ? new URL(item.thumbnail, new URL("../halaman%201/index.html", window.location.href)).href
        : "",
      link_url: "",
      sort_order: index
    })),
    ...window.DEFAULT_SITE_CONTENT.designs.map((item, index) => ({
      content_key: `image-${index + 1}`,
      kind: "image",
      title: item.title,
      description: "",
      category: item.category,
      media_url: new URL(item.image, new URL("../halaman%201/index.html", window.location.href)).href,
      thumbnail_url: item.thumbnail
        ? new URL(item.thumbnail, new URL("../halaman%201/index.html", window.location.href)).href
        : "",
      link_url: "",
      sort_order: index
    }))
  ];
  try {
    if (localMode) {
      const existingIds = new Set(contentRows.map((row) => row.id));
      for (const item of defaults) {
        const id = item.content_key;
        if (existingIds.has(id)) continue;
        const { content_key, ...record } = item;
        await window.portfolioLocalStore.save({ ...record, id, blob: null });
      }
      await window.portfolioLocalStore.setSetting("managed:video", true);
      await window.portfolioLocalStore.setSetting("managed:image", true);
      await loadContent();
      showMessage(dashboardMessage, "Konten bawaan tersedia di browser ini saja.");
      return;
    }
    const { error } = await supabaseClient.from("site_content").upsert(defaults, {
      onConflict: "content_key",
      ignoreDuplicates: true
    });
    if (error) throw error;
    const { error: stateError } = await supabaseClient.from("site_content_state").upsert([
      { kind: "video", managed: true },
      { kind: "image", managed: true }
    ]);
    if (stateError) throw stateError;
    await loadContent();
    showMessage(dashboardMessage, "Konten bawaan berhasil diimpor. File lama tetap tersimpan di website.");
  } catch (error) {
    console.error("Gagal mengimpor konten bawaan:", error);
    showMessage(dashboardMessage, `Gagal mengimpor konten: ${error.message}`, true);
  }
}

document.getElementById("logout-button").addEventListener("click", async () => {
  if (localMode) {
    sessionStorage.removeItem("porto-local-admin-session");
    setSignedOut("Anda sudah keluar dari admin lokal.");
    await showLocalLogin();
    return;
  }
  const { error } = await supabaseClient.auth.signOut();
  if (error) showMessage(dashboardMessage, error.message, true);
  else setSignedOut("Anda sudah keluar.");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  if (localMode) {
    showMessage(loginMessage, "Memeriksa akses lokal…");
    try {
      await submitLocalLogin(formData);
    } catch (error) {
      console.error("Gagal memproses login admin lokal:", error);
      showMessage(loginMessage, `Gagal masuk: ${error.message}`, true);
    }
    return;
  }
  showMessage(loginMessage, "Memeriksa akun…");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (error) showMessage(loginMessage, `Gagal masuk: ${error.message}`, true);
});

kindField.addEventListener("change", updateEditorFields);
contentForm.elements.media.addEventListener("change", () => {
  updateEditorFields();
  updateVideoFramePicker();
});
contentForm.elements.thumbnail.addEventListener("change", updateEditorFields);
document.getElementById("frame-picker-video").addEventListener("loadeddata", () => {
  document.getElementById("capture-video-frame").disabled = false;
});
document.getElementById("frame-picker-video").addEventListener("error", () => {
  document.getElementById("capture-video-frame").disabled = true;
  showMessage(document.getElementById("frame-picker-message"), "Video tidak dapat dimuat untuk memilih frame. Coba file lokal atau URL video langsung.", true);
});
document.getElementById("capture-video-frame").addEventListener("click", captureVideoFrame);
contentForm.addEventListener("submit", saveContent);
document.getElementById("new-content-button").addEventListener("click", () => {
  clearVideoFramePicker();
  contentForm.reset();
  contentForm.elements.id.value = "";
  document.getElementById("editor-title").textContent = "Tambah konten";
  editorPanel.hidden = false;
  updateEditorFields();
  updateVideoFramePicker();
  editorPanel.scrollIntoView({ behavior: "smooth" });
});
document.getElementById("cancel-edit-button").addEventListener("click", resetEditor);
document.getElementById("import-defaults-button").addEventListener("click", importDefaults);
document.querySelectorAll("[data-admin-view]").forEach((button) => {
  button.addEventListener("click", () => {
    const showProducts = button.dataset.adminView === "products";
    document.getElementById("content-management").hidden = showProducts;
    document.getElementById("digital-shop-panel").hidden = !showProducts;
    document.querySelectorAll("[data-admin-view]").forEach((tab) => {
      const selected = tab === button;
      tab.classList.toggle("active", selected);
      tab.setAttribute("aria-pressed", String(selected));
    });
  });
});
document.getElementById("new-product-button").addEventListener("click", openNewProductForm);
document.getElementById("cancel-product-button").addEventListener("click", closeProductForm);
productForm.elements.preview_type.addEventListener("change", updateProductFields);
productForm.elements.cover.addEventListener("change", updateProductFields);
productForm.elements.preview_file.addEventListener("change", updateProductFields);
productForm.addEventListener("submit", saveProduct);
document.querySelectorAll("[data-kind-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    activeContentFilter = button.dataset.kindFilter;
    document.querySelectorAll("[data-kind-filter]").forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle("active", selected);
      filterButton.setAttribute("aria-pressed", String(selected));
    });
    renderContentList();
  });
});
updateProductFields();

supabaseClient = window.createPortfolioSupabaseClient?.();
if (!supabaseClient) {
  showLocalLogin().catch((error) => {
    console.error("Gagal menyiapkan admin lokal:", error);
    setupNotice.hidden = false;
    loginPanel.hidden = false;
    showMessage(loginMessage, `Penyimpanan lokal tidak tersedia: ${error.message}`, true);
  });
} else {
  document.getElementById("login-email-field").hidden = false;
  loginForm.elements.email.required = true;
  contentForm.elements.thumbnail.accept = "image/jpeg,image/png,image/webp,image/gif";
  supabaseClient.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      setSignedOut(error.message);
      return;
    }
    if (!data.session) {
      setSignedOut();
      return;
    }
    try {
      await verifyAdmin();
    } catch (adminError) {
      console.error("Gagal memuat admin:", adminError);
      setSignedOut(`Gagal memuat dashboard: ${adminError.message}`);
    }
  });

  supabaseClient.auth.onAuthStateChange(async (event) => {
    if (event === "SIGNED_IN" && loginPanel.hidden) return;
    if (event === "SIGNED_IN") {
      try {
        await verifyAdmin();
      } catch (adminError) {
        console.error("Gagal memverifikasi admin:", adminError);
        setSignedOut(`Gagal memverifikasi admin: ${adminError.message}`);
      }
    }
  });
}
