const categories = [
  { key: "party", label: "Party Flyer", folder: "party flyer", prefix: "party flyer", numbers: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { key: "promotional", label: "Promotional Flyer", folder: "Promotional Flyer", prefix: "Promotional Flyer", numbers: Array.from({ length: 10 }, (_, index) => index + 1) },
  { key: "sports", label: "Sports Flyer", folder: "Sports Flyer", prefix: "Sports Flyer", numbers: Array.from({ length: 4 }, (_, index) => index + 1) }
];

const works = categories.flatMap((category) => category.numbers.map((fileNumber, index) => ({
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
  gallery.innerHTML = visibleWorks.map((work, index) => `
    <article class="design-card" style="animation-delay: ${Math.min(index * .025, .3)}s">
      <button type="button" aria-label="Buka ${work.label} ${work.number}">
        <img src="${encodeURI(work.file)}" alt="${work.label} ${work.number}" loading="lazy">
        <span class="card-meta"><span>${work.label}</span><small>${String(work.number).padStart(2, "0")} / ${work.category === "party" ? "17" : work.category === "promotional" ? "10" : "04"}</small></span>
      </button>
    </article>`).join("");

  gallery.querySelectorAll(".design-card button").forEach((button, index) => {
    button.addEventListener("click", () => openLightbox(visibleWorks[index]));
  });
}

function openLightbox(work) {
  lightboxImage.src = encodeURI(work.file);
  lightboxImage.alt = `${work.label} ${work.number}`;
  lightboxCaption.textContent = `${work.label} / karya ${String(work.number).padStart(2, "0")}`;
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
