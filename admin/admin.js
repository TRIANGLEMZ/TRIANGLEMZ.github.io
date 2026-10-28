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
let supabaseClient;
let contentRows = [];
let activeContentFilter = "all";
let localMode = false;
let previewObjectUrls = [];
let framePickerObjectUrl = "";

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
  const rows = activeContentFilter === "all"
    ? contentRows
    : contentRows.filter((row) => row.kind === activeContentFilter);
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
    preview.className = `content-preview${row.kind === "image" ? " content-preview-poster" : ""}`;
    const localImage = row.kind === "image" ? row.blob : row.kind === "video" ? row.thumbnail_blob : null;
    const previewUrl = localImage instanceof Blob
      ? URL.createObjectURL(localImage)
      : row.kind === "video"
        ? row.thumbnail_url
        : row.kind === "image"
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
        preview.textContent = row.kind === "video" ? "Video" : "Poster";
      }, { once: true });
      preview.appendChild(image);
    } else if (row.kind === "video" && (row.blob instanceof Blob || row.media_url)) {
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
      preview.textContent = row.kind === "video" ? "Video" : row.kind === "image" ? "Poster" : "Tautan";
    }
    previewCell.appendChild(preview);
    tr.appendChild(previewCell);
    const values = [
      row.kind === "video" ? "Video" : row.kind === "image" ? "Poster" : "Penjualan",
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
  const isVideo = kindField.value === "video";
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
  if (kindField.value !== "video" || editorPanel.hidden) {
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
    if ((kind === "image" && !isImage) || (kind === "video" && !isVideo)) {
      showMessage(dashboardMessage, "Jenis file tidak sesuai dengan jenis konten.", true);
      return;
    }
    if (upload.size > 100 * 1024 * 1024) {
      showMessage(dashboardMessage, "Ukuran file maksimal 100 MB.", true);
      return;
    }
  }
  if (thumbnailUpload.size && kind !== "video") {
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

    let thumbnailUrl = kind === "video" || (kind === "image" && !upload.size)
      ? current?.thumbnail_url || ""
      : "";
    if (kind === "video" && thumbnailUpload.size) {
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
    if ((thumbnailUpload.size || kind !== "video") && current?.thumbnail_url) {
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
      thumbnail_url: kind === "video" || (kind === "image" && !upload.size)
        ? current?.thumbnail_url || ""
        : "",
      link_url: kind === "sale" ? linkUrl : "",
      sort_order: current?.sort_order ?? contentRows.length,
      blob: kind === "sale" ? null : upload.size ? upload : current?.blob || null,
      thumbnail_blob: kind === "video" ? thumbnailUpload.size ? thumbnailUpload : current?.thumbnail_blob || null : null
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
