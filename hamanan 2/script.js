const categories = [
  { key: "party", label: "Party Flyer", folder: "party flyer", prefix: "party flyer", numbers: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { key: "promotional", label: "Promotional Flyer", folder: "Promotional Flyer", prefix: "Promotional Flyer", numbers: Array.from({ length: 10 }, (_, index) => index + 1) },
  { key: "sports", label: "Sports Flyer", folder: "Sports Flyer", prefix: "Sports Flyer", numbers: Array.from({ length: 4 }, (_, index) => index + 1) }
];

let works = categories.flatMap((category) => category.numbers.map((fileNumber, index) => ({
  category: category.key,
  label: category.label,
  number: index + 1,
  file: `${category.folder}/${category.prefix}${fileNumber}.jpg`
})));

const gallery = document.querySelector(".gallery");
const filters = document.querySelectorAll(".filter");
const lightbox = document.querySelector(".lightbox");
const lightboxImage = lightbox.querySelector("img");
const lightboxCaption = lightbox.querySelector(".lightbox-caption");

function renderGallery(filter = "all") {
  const visibleWorks = filter === "all" ? works : works.filter((work) => work.category === filter);
  gallery.replaceChildren();
  visibleWorks.forEach((work, index) => {
    const card = document.createElement("article");
    card.className = "design-card";
    card.style.animationDelay = `${Math.min(index * .025, .3)}s`;
    const button = document.createElement("button");
    button.type = "button";
    const title = work.title || `${work.label} ${work.number}`;
    button.setAttribute("aria-label", `Buka ${title}`);
    const image = document.createElement("img");
    image.src = encodeURI(work.file);
    image.alt = title;
    image.loading = "lazy";
    const meta = document.createElement("span");
    meta.className = "card-meta";
    const label = document.createElement("span");
    label.textContent = work.label;
    const count = document.createElement("small");
    const categoryTotal = works.filter((item) => item.category === work.category).length || works.length;
    count.textContent = `${String(work.number).padStart(2, "0")} / ${categoryTotal}`;
    meta.append(label, count);
    button.append(image, meta);
    button.addEventListener("click", () => openLightbox(work));
    card.appendChild(button);
    gallery.appendChild(card);
  });
}

function openLightbox(work) {
  const title = work.title || `${work.label} ${work.number}`;
  lightboxImage.src = encodeURI(work.file);
  lightboxImage.alt = title;
  lightboxCaption.textContent = work.description
    ? `${title} — ${work.description}`
    : `${work.label} / karya ${String(work.number).padStart(2, "0")}`;
  lightbox.showModal();
}

filters.forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    filters.forEach((button) => button.classList.remove("active"));
    filterButton.classList.add("active");
    renderGallery(filterButton.dataset.filter);
  });
});

document.querySelector(".close-lightbox").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});

renderGallery();

async function loadManagedDesigns() {
  const supabaseClient = window.createPortfolioSupabaseClient?.();
  if (!supabaseClient) return;
  try {
    const [contentResult, stateResult] = await Promise.all([
      supabaseClient.from("site_content")
        .select("title,category,media_url")
        .eq("kind", "image")
        .order("sort_order", { ascending: true }),
      supabaseClient.from("site_content_state").select("kind,managed").eq("kind", "image").maybeSingle()
    ]);
    if (contentResult.error) throw contentResult.error;
    if (stateResult.error) throw stateResult.error;
    if (!stateResult.data?.managed) return;
    const data = contentResult.data.filter((item) => item.media_url);
    works = data.map((item, index) => {
      const categoryText = item.category.trim();
      const category = categoryText.toLowerCase().includes("party") ? "party"
        : categoryText.toLowerCase().includes("promotion") ? "promotional"
          : categoryText.toLowerCase().includes("sport") ? "sports" : "all";
      return {
        category,
        label: categoryText || "Design",
        number: index + 1,
        file: item.media_url,
        title: item.title,
        description: item.description
      };
    });
    const counts = Object.fromEntries(["all", "party", "promotional", "sports"].map((key) => [
      key,
      key === "all" ? works.length : works.filter((work) => work.category === key).length
    ]));
    filters.forEach((button) => {
      const count = button.querySelector("span");
      if (count) count.textContent = counts[button.dataset.filter];
    });
    document.querySelector(".count strong").textContent = works.length;
    document.querySelector(".count").lastChild.textContent = " karya terpilih";
    renderGallery(document.querySelector(".filter.active").dataset.filter);
  } catch (error) {
    console.error("Gagal memuat desain dari admin; koleksi bawaan tetap ditampilkan:", error);
  }
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

loadManagedDesigns();
recordDailyVisitor();
