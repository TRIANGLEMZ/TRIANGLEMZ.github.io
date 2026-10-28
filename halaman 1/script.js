let videos = window.DEFAULT_SITE_CONTENT.videos;
let designWorks = window.DEFAULT_SITE_CONTENT.designs;
let creativeWorks = [];
let digitalProducts = [];
let activeDigitalProduct = null;

const heroVideo = document.querySelector(".hero-video");
const heroProject = document.querySelector(".hero-project");
const heroDescription = document.querySelector(".hero-description");
const heroPanelTitle = document.getElementById("hero-panel-title");
const heroPanelCopy = document.getElementById("hero-panel-copy");
const statusText = document.querySelector(".status-text");
const videoGrid = document.querySelector(".video-grid");
const soundButton = document.querySelector(".sound-button");
const watchButton = document.querySelector(".watch-button");
const designGrid = document.getElementById("design-grid");

let activeIndex = 0;
let videoPreviewObserver;
let designImageObserver;
let creativeVideoObserver;

function updateHeroPanel(item) {
  heroProject.textContent = `Featured work / ${item.title}`;
  heroDescription.textContent = item.description;
  heroPanelTitle.textContent = item.title;
  heroPanelCopy.textContent = item.description;
}

function getDefaultDesignThumbnail(mediaUrl) {
  const design = window.DEFAULT_SITE_CONTENT.designs.find((item) => {
    try {
      return new URL(item.image, window.location.href).href === mediaUrl;
    } catch {
      return false;
    }
  });
  return design?.thumbnail ? new URL(design.thumbnail, window.location.href).href : "";
}

function getDefaultVideoThumbnail(mediaUrl) {
  const video = window.DEFAULT_SITE_CONTENT.videos.find((item) => {
    try {
      return new URL(item.file, window.location.href).href === mediaUrl;
    } catch {
      return false;
    }
  });
  return video?.thumbnail ? new URL(video.thumbnail, window.location.href).href : "";
}

async function openHeroFullscreen() {
  if (!videos.length) return;
  heroVideo.controls = true;
  try {
    loadHeroSource();
    if (typeof heroVideo.requestFullscreen === "function") {
      await heroVideo.requestFullscreen();
    } else if (typeof heroVideo.webkitEnterFullscreen === "function") {
      heroVideo.webkitEnterFullscreen();
    } else {
      heroVideo.controls = false;
      statusText.textContent = "Full-screen playback is not supported on this device";
      return;
    }
    playHero();
  } catch (error) {
    heroVideo.controls = false;
    console.error("Tidak dapat membuka video layar penuh:", error);
    statusText.textContent = "Unable to open full-screen playback";
  }
}

function setHero(index) {
  const item = videos[index];
  if (!item) return;
  activeIndex = index;
  heroVideo.pause();
  heroVideo.controls = false;
  heroVideo.removeAttribute("src");
  delete heroVideo.dataset.loadedSource;
  heroVideo.load();
  heroVideo.poster = item.thumbnail || "";
  heroVideo.dataset.videoSource = item.file;
  updateHeroPanel(item);
  statusText.textContent = "Press Play Now to watch";
}

function loadHeroSource() {
  const item = videos[activeIndex];
  if (!item) return;
  if (heroVideo.dataset.loadedSource === item.file) return;
  heroVideo.src = new URL(item.file, window.location.href).href;
  heroVideo.dataset.loadedSource = item.file;
  heroVideo.load();
}

function playHero() {
  if (!videos.length) return;
  loadHeroSource();
  heroVideo.play().then(() => {
    statusText.textContent = "Now playing";
  }).catch(() => {
    statusText.textContent = "Press the button to play";
  });
}

function pauseHero(showThumbnail = true) {
  heroVideo.pause();
  statusText.textContent = showThumbnail ? "Paused after scrolling" : "Paused";
}

function createCard(item, index, copyIndex) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.dataset.index = index;
  const media = document.createElement("div");
  media.className = "card-media";
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "none";
  video.poster = item.thumbnail || "";
  if (!item.thumbnail) video.dataset.src = item.file;
  const number = document.createElement("span");
  number.className = "card-number";
  number.textContent = String(copyIndex + 1).padStart(2, "0");
  const play = document.createElement("button");
  play.className = "card-play";
  play.type = "button";
  play.setAttribute("aria-label", `Play ${item.title}`);
  play.textContent = "▶";
  const fullscreen = document.createElement("button");
  fullscreen.className = "card-fullscreen";
  fullscreen.type = "button";
  fullscreen.setAttribute("aria-label", `Watch ${item.title} full screen`);
  fullscreen.textContent = "⛶";
  media.append(video, number, play, fullscreen);
  const copy = document.createElement("div");
  copy.className = "card-copy";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const description = document.createElement("p");
  description.textContent = item.description;
  copy.append(title, description);
  card.append(media, copy);

  play.addEventListener("click", () => {
    setHero(index);
    playHero();
    document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
  });
  fullscreen.addEventListener("click", () => {
    setHero(index);
    openHeroFullscreen();
  });

  return card;
}

function buildVideoGrid() {
  videoPreviewObserver?.disconnect();
  videoGrid.replaceChildren();
  if (!videos.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No videos available yet.";
    videoGrid.appendChild(emptyState);
    return;
  }
  videos.forEach((item, index) => {
    videoGrid.appendChild(createCard(item, index, index));
  });
  if ("IntersectionObserver" in window) {
    videoPreviewObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const video = entry.target;
        video.src = new URL(video.dataset.src, window.location.href).href;
        video.preload = "metadata";
        video.load();
        observer.unobserve(video);
      });
    }, { rootMargin: "0px" });
    videoGrid.querySelectorAll(".video-card video[data-src]").forEach((video) => videoPreviewObserver.observe(video));
  }
}

const designLightbox = document.getElementById("design-lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxTitle = document.getElementById("lightbox-title");
const lightboxDescription = document.getElementById("lightbox-description");

function openDesignLightbox(work) {
  lightboxImage.src = new URL(work.image, window.location.href).href;
  lightboxImage.alt = work.title;
  lightboxTitle.textContent = work.title;
  lightboxDescription.textContent = work.description || "";
  designLightbox.classList.add("visible");
  designLightbox.setAttribute("aria-hidden", "false");
}

function closeDesignLightbox() {
  designLightbox.classList.remove("visible");
  designLightbox.setAttribute("aria-hidden", "true");
}

function buildDesignGallery() {
  designImageObserver?.disconnect();
  const firstRow = designWorks.filter((_, index) => index % 2 === 0);
  const secondRow = designWorks.filter((_, index) => index % 2 === 1);
  const marquee = document.createElement("div");
  marquee.className = "marquee-wrap";
  const renderCards = (works, row) => {
    [...works, ...works].forEach((work) => {
      const index = designWorks.indexOf(work);
      const card = document.createElement("article");
      card.className = "design-card";
      const button = document.createElement("button");
      button.className = "design-link";
      button.type = "button";
      button.dataset.index = index;
      button.setAttribute("aria-label", `View ${work.title}`);
      const image = document.createElement("img");
      image.src = new URL(work.thumbnail || work.image, window.location.href).href;
      image.alt = work.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.fetchPriority = "low";
      image.addEventListener("error", () => {
        if (image.src !== new URL(work.image, window.location.href).href) {
          image.src = new URL(work.image, window.location.href).href;
        }
      }, { once: true });
      image.draggable = false;
      const overlay = document.createElement("span");
      overlay.className = "design-overlay";
      const category = document.createElement("span");
      category.className = "design-tag";
      category.textContent = work.category;
      const count = document.createElement("span");
      count.className = "design-count";
      count.textContent = String(index + 1).padStart(2, "0");
      overlay.append(category, count);
      button.append(image, overlay);
      card.appendChild(button);
      row.appendChild(card);
    });
  };
  const firstRowElement = document.createElement("div");
  firstRowElement.className = "marquee-row";
  renderCards(firstRow, firstRowElement);
  const secondRowElement = document.createElement("div");
  secondRowElement.className = "marquee-row reverse";
  secondRowElement.style.marginTop = "18px";
  renderCards(secondRow, secondRowElement);
  marquee.append(firstRowElement, secondRowElement);
  designGrid.replaceChildren(marquee);
  if ("IntersectionObserver" in window) {
    designImageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.loading = "eager";
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "300px" });
    designGrid.querySelectorAll("img[loading='lazy']").forEach((image) => designImageObserver.observe(image));
  } else {
    designGrid.querySelectorAll("img[loading='lazy']").forEach((image) => {
      image.loading = "eager";
    });
  }

  designGrid.querySelectorAll(".marquee-row").forEach((row) => {
    const animation = row.getAnimations()[0];
    let dragStartX = 0;
    let animationStartTime = 0;
    let hasDragged = false;
    let suppressClick = false;

    row.addEventListener("pointerdown", (event) => {
      if (!animation || event.button !== 0) return;
      dragStartX = event.clientX;
      animationStartTime = Number(animation.currentTime) || 0;
      hasDragged = false;
      animation.pause();
      row.classList.add("is-dragging");
      row.setPointerCapture(event.pointerId);
    });

    row.addEventListener("pointermove", (event) => {
      if (!row.hasPointerCapture(event.pointerId) || !animation) return;
      const deltaX = event.clientX - dragStartX;
      if (Math.abs(deltaX) > 5) hasDragged = true;

      const duration = Number(animation.effect.getTiming().duration);
      const cycleWidth = row.scrollWidth / 2;
      const direction = row.classList.contains("reverse") ? 1 : -1;
      const nextTime = animationStartTime + (deltaX / cycleWidth) * duration * direction;
      animation.currentTime = ((nextTime % duration) + duration) % duration;
    });

    const endMarqueeDrag = (event) => {
      if (!row.hasPointerCapture(event.pointerId)) return;
      row.releasePointerCapture(event.pointerId);
      row.classList.remove("is-dragging");
      animation?.play();
      if (hasDragged) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
    };

    row.addEventListener("pointerup", endMarqueeDrag);
    row.addEventListener("pointercancel", endMarqueeDrag);
    row.addEventListener("click", (event) => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });

  designGrid.querySelectorAll(".design-link").forEach((button) => {
    button.addEventListener("click", () => {
      openDesignLightbox(designWorks[Number(button.dataset.index)]);
    });
  });
}

function buildCreativeGallery() {
  creativeVideoObserver?.disconnect();
  const section = document.getElementById("proses-kreatif");
  const grid = document.getElementById("creative-grid");
  const navLink = document.querySelector('.main-nav a[href="#proses-kreatif"]');
  grid.replaceChildren();
  section.hidden = creativeWorks.length === 0;
  navLink.hidden = section.hidden;
  creativeWorks.forEach((work) => {
    const card = document.createElement("article");
    card.className = "creative-card";
    const media = document.createElement("div");
    media.className = "creative-media";
    if (work.kind === "process_video") {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.dataset.src = work.media;
      if (work.thumbnail) video.poster = new URL(work.thumbnail, window.location.href).href;
      media.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = new URL(work.thumbnail || work.media, window.location.href).href;
      image.alt = work.title;
      image.loading = "lazy";
      image.decoding = "async";
      const button = document.createElement("button");
      button.className = "creative-image-button";
      button.type = "button";
      button.setAttribute("aria-label", `Lihat foto ${work.title}`);
      button.appendChild(image);
      button.addEventListener("click", () => openDesignLightbox({
        image: work.media,
        title: work.title,
        description: work.description
      }));
      media.appendChild(button);
    }
    const copy = document.createElement("div");
    copy.className = "creative-copy";
    const title = document.createElement("h3");
    title.textContent = work.title;
    const description = document.createElement("p");
    description.textContent = work.description || work.category || "";
    copy.append(title, description);
    card.append(media, copy);
    grid.appendChild(card);
  });
  const videosToLoad = grid.querySelectorAll("video[data-src]");
  if ("IntersectionObserver" in window) {
    creativeVideoObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const video = entry.target;
        video.src = new URL(video.dataset.src, window.location.href).href;
        video.preload = "metadata";
        video.load();
        observer.unobserve(video);
      });
    }, { rootMargin: "160px" });
    videosToLoad.forEach((video) => creativeVideoObserver.observe(video));
  } else {
    videosToLoad.forEach((video) => {
      video.src = new URL(video.dataset.src, window.location.href).href;
      video.preload = "metadata";
      video.load();
    });
  }
}

heroVideo.addEventListener("ended", () => {
  if (videos.length) setHero((activeIndex + 1) % videos.length);
});
heroVideo.addEventListener("click", () => heroVideo.paused ? playHero() : pauseHero(false));
watchButton.addEventListener("click", openHeroFullscreen);
document.querySelector(".fullscreen-button").addEventListener("click", openHeroFullscreen);
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement !== heroVideo) heroVideo.controls = false;
});
heroVideo.addEventListener("webkitendfullscreen", () => {
  heroVideo.controls = false;
});
soundButton.addEventListener("click", () => {
  heroVideo.muted = !heroVideo.muted;
  soundButton.textContent = heroVideo.muted ? "🔇" : "🔊";
  soundButton.setAttribute("aria-label", heroVideo.muted ? "Turn sound on" : "Mute sound");
});
document.querySelector(".lightbox-close").addEventListener("click", closeDesignLightbox);
document.querySelector(".lightbox-back").addEventListener("click", () => {
  closeDesignLightbox();
  document.querySelector("#beranda").scrollIntoView({ behavior: "smooth" });
});
designLightbox.addEventListener("click", (event) => {
  if (event.target === designLightbox) closeDesignLightbox();
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.querySelector(button.dataset.scroll);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && designLightbox.classList.contains("visible")) {
    closeDesignLightbox();
  }
});

setHero(0);
buildVideoGrid();
buildDesignGallery();

async function loadManagedContent() {
  const supabaseClient = window.createPortfolioSupabaseClient?.();
  if (!supabaseClient) {
    try {
      const localRows = await window.portfolioLocalStore.list();
      const [managedVideos, managedImages, managedProcessVideos, managedProcessImages] = await Promise.all([
        window.portfolioLocalStore.getSetting("managed:video"),
        window.portfolioLocalStore.getSetting("managed:image"),
        window.portfolioLocalStore.getSetting("managed:process_video"),
        window.portfolioLocalStore.getSetting("managed:process_image")
      ]);
      const localMediaUrl = (row) => {
        if (row.blob instanceof Blob) return URL.createObjectURL(row.blob);
        return row.media_url.startsWith("local://") ? "" : row.media_url;
      };
      if (managedVideos) {
        videos = localRows.filter((row) => row.kind === "video")
          .map((row) => ({
            file: localMediaUrl(row),
            thumbnail: row.thumbnail_blob instanceof Blob
              ? URL.createObjectURL(row.thumbnail_blob)
              : row.thumbnail_url || (row.blob instanceof Blob ? "" : getDefaultVideoThumbnail(localMediaUrl(row))),
            title: row.title,
            description: row.description,
            category: row.category
          }))
          .filter((row) => row.file);
        if (videos.length) {
          setHero(0);
        } else {
          pauseHero(false);
          heroVideo.removeAttribute("src");
          heroVideo.removeAttribute("poster");
          heroVideo.load();
          heroProject.textContent = "No featured video";
          heroDescription.textContent = "";
          heroPanelTitle.textContent = "No videos available";
          heroPanelCopy.textContent = "";
          statusText.textContent = "Add a video from the admin dashboard";
        }
        buildVideoGrid();
      }
      if (managedImages) {
        designWorks = localRows.filter((row) => row.kind === "image")
          .map((row) => ({
            image: localMediaUrl(row),
            thumbnail: row.thumbnail_blob instanceof Blob
              ? URL.createObjectURL(row.thumbnail_blob)
              : row.thumbnail_url || getDefaultDesignThumbnail(row.media_url),
            title: row.title,
            description: row.description,
            category: row.category
          }))
          .filter((row) => row.image);
        buildDesignGallery();
      }
      if (managedProcessVideos || managedProcessImages) {
        creativeWorks = localRows
          .filter((row) => row.kind === "process_video" ? managedProcessVideos : row.kind === "process_image" && managedProcessImages)
          .map((row) => ({
            kind: row.kind,
            media: localMediaUrl(row),
            thumbnail: row.thumbnail_blob instanceof Blob
              ? URL.createObjectURL(row.thumbnail_blob)
              : row.thumbnail_url || "",
            title: row.title,
            description: row.description,
            category: row.category
          }))
          .filter((row) => row.media);
        buildCreativeGallery();
      }
      renderSalesLinks(localRows.filter((row) => row.kind === "sale" && row.link_url));
    } catch (error) {
      console.error("Gagal memuat konten lokal; konten bawaan tetap ditampilkan:", error);
    }
    return;
  }
  try {
    const [contentResult, stateResult] = await Promise.all([
      supabaseClient.from("site_content")
        .select("kind,title,description,category,media_url,thumbnail_url,link_url")
        .order("sort_order", { ascending: true }),
      supabaseClient.from("site_content_state").select("kind,managed")
    ]);
    if (contentResult.error) throw contentResult.error;
    if (stateResult.error) throw stateResult.error;
    const data = contentResult.data;
    const managedKinds = new Set(stateResult.data.filter((item) => item.managed).map((item) => item.kind));

    const managedVideos = data.filter((item) => item.kind === "video" && item.media_url)
      .map((item) => ({
        file: item.media_url,
        thumbnail: item.thumbnail_url || getDefaultVideoThumbnail(item.media_url),
        title: item.title,
        description: item.description,
        category: item.category
      }));
    const managedDesigns = data.filter((item) => item.kind === "image" && item.media_url)
      .map((item) => ({
        image: item.media_url,
        thumbnail: item.thumbnail_url || getDefaultDesignThumbnail(item.media_url),
        title: item.title,
        description: item.description,
        category: item.category
      }));
    const managedCreativeWorks = data
      .filter((item) =>
        (item.kind === "process_video" && managedKinds.has("process_video")
          || item.kind === "process_image" && managedKinds.has("process_image"))
        && item.media_url)
      .map((item) => ({
        kind: item.kind,
        media: item.media_url,
        thumbnail: item.thumbnail_url,
        title: item.title,
        description: item.description,
        category: item.category
      }));
    if (managedKinds.has("video")) {
      videos = managedVideos;
      if (videos.length) {
        setHero(0);
      } else {
        pauseHero(false);
        heroVideo.removeAttribute("src");
        heroVideo.removeAttribute("poster");
        heroVideo.load();
        heroProject.textContent = "No featured video";
        heroDescription.textContent = "";
        heroPanelTitle.textContent = "No videos available";
        heroPanelCopy.textContent = "";
        statusText.textContent = "Add a video from the admin dashboard";
      }
      buildVideoGrid();
    }
    if (managedKinds.has("image")) {
      designWorks = managedDesigns;
      buildDesignGallery();
    }
    if (managedKinds.has("process_video") || managedKinds.has("process_image")) {
      creativeWorks = managedCreativeWorks;
      buildCreativeGallery();
    }
    renderSalesLinks(data.filter((item) => item.kind === "sale" && item.link_url));
  } catch (error) {
    console.error("Gagal memuat konten admin; konten bawaan tetap ditampilkan:", error);
  }
}

function renderSalesLinks(items) {
  const section = document.getElementById("penjualan");
  const container = document.getElementById("sales-links");
  container.replaceChildren();
  items.forEach((item) => {
    let url;
    try {
      url = new URL(item.link_url);
    } catch {
      console.error("Link penjualan tidak valid:", item.link_url);
      return;
    }
    if (!["http:", "https:"].includes(url.protocol)) return;
    const link = document.createElement("a");
    link.className = "sale-link";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const description = document.createElement("span");
    description.textContent = item.description || item.category;
    link.append(title, description);
    container.appendChild(link);
  });
  section.hidden = items.length === 0;
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(url.hostname)
      && url.hostname !== "youtu.be") return "";
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const match = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(price));
}

function openDigitalProduct(product) {
  activeDigitalProduct = product;
  const dialog = document.getElementById("shop-dialog");
  const preview = document.getElementById("shop-dialog-preview");
  preview.replaceChildren();
  if (product.preview_type === "youtube") {
    const videoId = getYouTubeVideoId(product.preview_url);
    if (videoId) {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
      iframe.title = `Preview ${product.title}`;
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      preview.appendChild(iframe);
    }
  } else if (product.preview_type === "video" && product.preview_url) {
    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.src = new URL(product.preview_url, window.location.href).href;
    preview.appendChild(video);
  }
  preview.hidden = !preview.childElementCount;
  document.getElementById("shop-dialog-type").textContent = product.asset_type;
  document.getElementById("shop-dialog-title").textContent = product.title;
  document.getElementById("shop-dialog-description").textContent = product.description || "Aset digital siap digunakan.";
  document.getElementById("shop-dialog-price").textContent = formatPrice(product.price);
  document.getElementById("shop-purchase-form").reset();
  document.getElementById("shop-purchase-message").textContent = "";
  dialog.hidden = false;
  dialog.setAttribute("aria-hidden", "false");
  document.getElementById("buyer-name").focus();
}

function closeDigitalProduct() {
  const dialog = document.getElementById("shop-dialog");
  document.getElementById("shop-dialog-preview").replaceChildren();
  dialog.hidden = true;
  dialog.setAttribute("aria-hidden", "true");
  activeDigitalProduct = null;
}

function renderDigitalProducts(products) {
  const section = document.getElementById("toko");
  const navLink = document.querySelector('.main-nav a[href="#toko"]');
  const grid = document.getElementById("shop-grid");
  grid.replaceChildren();
  digitalProducts = products;
  section.hidden = products.length === 0;
  navLink.hidden = section.hidden;
  products.forEach((product) => {
    let checkoutUrl;
    try {
      checkoutUrl = new URL(product.checkout_url);
    } catch {
      console.error("Link pembayaran produk tidak valid:", product.id);
      return;
    }
    if (!["http:", "https:"].includes(checkoutUrl.protocol)) return;
    const card = document.createElement("article");
    card.className = "shop-card";
    const cover = document.createElement("img");
    cover.className = "shop-card-cover";
    cover.src = new URL(product.cover_url, window.location.href).href;
    cover.alt = `Sampul ${product.title}`;
    cover.loading = "lazy";
    cover.decoding = "async";
    const copy = document.createElement("div");
    copy.className = "shop-card-copy";
    const type = document.createElement("p");
    type.className = "shop-card-type";
    type.textContent = product.asset_type;
    const title = document.createElement("h3");
    title.textContent = product.title;
    const price = document.createElement("strong");
    price.className = "shop-card-price";
    price.textContent = formatPrice(product.price);
    const button = document.createElement("button");
    button.className = "shop-card-button";
    button.type = "button";
    button.textContent = "Detail & beli";
    button.addEventListener("click", () => openDigitalProduct(product));
    copy.append(type, title, price, button);
    card.append(cover, copy);
    grid.appendChild(card);
  });
}

async function loadDigitalProducts(supabaseClient) {
  if (!supabaseClient) {
    const rows = await window.portfolioLocalStore.list();
    const products = rows.filter((row) => row.kind === "product").map((row) => ({
      ...row,
      cover_url: row.cover_blob instanceof Blob ? URL.createObjectURL(row.cover_blob) : row.cover_url,
      preview_url: row.preview_blob instanceof Blob ? URL.createObjectURL(row.preview_blob) : row.preview_url
    }));
    renderDigitalProducts(products);
    return;
  }
  const { data, error } = await supabaseClient.from("digital_products")
    .select("id,title,description,asset_type,price,cover_url,preview_url,preview_type,checkout_url,sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Gagal memuat aset digital:", error);
    return;
  }
  renderDigitalProducts(data);
}

document.querySelector(".shop-dialog-close").addEventListener("click", closeDigitalProduct);
document.getElementById("shop-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeDigitalProduct();
});
document.getElementById("shop-purchase-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("buyer-name").value.trim();
  if (!name || !activeDigitalProduct) {
    document.getElementById("shop-purchase-message").textContent = "Masukkan nama Anda sebelum melanjutkan.";
    return;
  }
  let checkoutUrl;
  try {
    checkoutUrl = new URL(activeDigitalProduct.checkout_url);
  } catch {
    document.getElementById("shop-purchase-message").textContent = "Link pembelian produk belum tersedia.";
    return;
  }
  if (!["http:", "https:"].includes(checkoutUrl.protocol)) {
    document.getElementById("shop-purchase-message").textContent = "Link pembelian produk tidak valid.";
    return;
  }
  window.location.assign(checkoutUrl.href);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.getElementById("shop-dialog").hidden) closeDigitalProduct();
});

if (window.location.protocol === "file:") {
  document.getElementById("file-protocol-notice").hidden = false;
}

async function recordDailyVisitor() {
  const supabaseClient = window.createPortfolioSupabaseClient?.();
  if (!supabaseClient) return;
  try {
    let visitorId = localStorage.getItem("portfolio-visitor-id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("portfolio-visitor-id", visitorId);
    }
    const { error } = await supabaseClient.from("daily_visitors").insert({
      visitor_id: visitorId,
      visited_on: new Date().toISOString().slice(0, 10)
    });
    if (error && error.code !== "23505") throw error;
  } catch (error) {
    console.error("Gagal mencatat statistik pengunjung:", error);
  }
}

loadManagedContent();
loadDigitalProducts(window.createPortfolioSupabaseClient?.()).catch((error) => {
  console.error("Gagal menyiapkan toko digital:", error);
});
recordDailyVisitor();
