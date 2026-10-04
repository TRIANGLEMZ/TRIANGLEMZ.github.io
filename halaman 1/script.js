const videos = [
  {
    file: "video/SHOT VIDEOS A.mp4",
    title: "Shot Videos A",
    description: "A collection of moving images with sharp composition and a dynamic visual rhythm.",
    category: "Showreel"
  },
  {
    file: "video/SHOT VIDEOS B.mp4",
    title: "Shot Videos B",
    description: "An exploration of camera angles that captures moments with a strong point of view.",
    category: "Showreel"
  },
  {
    file: "video/PERSONAL PROJECT.mp4",
    title: "Personal Project",
    description: "A personal project exploring new ideas, moods, and visual languages.",
    category: "Personal Work"
  },
  {
    file: "video/ CINEMATIC CAR.mp4",
    title: "Cinematic Car",
    description: "A cinematic study of shape, light reflections, and the movement of a vehicle.",
    category: "Cinematic"
  },
  {
    file: "video/FILM PENDEK.mp4",
    title: "Short Film",
    description: "A short story shaped through atmosphere, carefully edited shots, and relatable emotion.",
    category: "Short Film"
  },
  {
    file: "video/CINEMATIC VISUALS.mp4",
    title: "Cinematic Visuals",
    description: "An atmospheric visual collection focused on light, color, and image detail.",
    category: "Cinematic"
  },
  {
    file: "video/CINEMATIC SHOTS.mp4",
    title: "Cinematic Shots",
    description: "Cinematic shots that bring spaces, movement, and moments into closer focus.",
    category: "Cinematic"
  }
];

const designWorks = [
  ...Array.from({ length: 17 }, (_, index) => {
    const flyerNumber = index + 1 + (index >= 2 ? 1 : 0);
    return {
    title: `Party Flyer ${flyerNumber}`,
    image: `../hamanan 2/party flyer/party flyer${flyerNumber}.jpg`,
    category: "Party"
    };
  }),
  ...Array.from({ length: 10 }, (_, index) => ({
    title: `Promotional Flyer ${index + 1}`,
    image: `../hamanan 2/Promotional Flyer/Promotional Flyer${index + 1}.jpg`,
    category: "Promotion"
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    title: `Sports Flyer ${index + 1}`,
    image: `../hamanan 2/Sports Flyer/Sports Flyer${index + 1}.jpg`,
    category: "Sports"
  }))
];

const heroVideo = document.querySelector(".hero-video");
const heroProject = document.querySelector(".hero-project");
const heroDescription = document.querySelector(".hero-description");
const heroPanelTitle = document.getElementById("hero-panel-title");
const heroPanelCopy = document.getElementById("hero-panel-copy");
const statusText = document.querySelector(".status-text");
const carousel = document.querySelector(".carousel");
const soundButton = document.querySelector(".sound-button");
const watchButton = document.querySelector(".watch-button");
const designGrid = document.getElementById("design-grid");

let activeIndex = 0;
let idleTimer;
let isDragging = false;
let dragStartX = 0;
let dragStartScroll = 0;

function updateHeroPanel(item) {
  heroProject.textContent = `Featured work / ${item.title}`;
  heroDescription.textContent = item.description;
  heroPanelTitle.textContent = item.title;
  heroPanelCopy.textContent = item.description;
}

function setHero(index) {
  activeIndex = index;
  const item = videos[index];
  heroVideo.pause();
  heroVideo.src = encodeURI(item.file);
  heroVideo.load();
  updateHeroPanel(item);
  statusText.textContent = "Ready to play in 5 seconds";
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(playHero, 5000);
}

function playHero() {
  heroVideo.play().then(() => {
    statusText.textContent = "Now playing";
  }).catch(() => {
    statusText.textContent = "Press the button to play";
  });
}

function pauseHero(showThumbnail = true) {
  heroVideo.pause();
  window.clearTimeout(idleTimer);
  statusText.textContent = showThumbnail ? "Paused after scrolling" : "Paused";
}

function createCard(item, index, copyIndex) {
  const card = document.createElement("article");
  card.className = "video-card";
  card.dataset.index = index;
  card.innerHTML = `
    <div class="card-media">
      <video muted playsinline preload="metadata" src="${encodeURI(item.file)}"></video>
      <span class="card-number">${String(copyIndex + 1).padStart(2, "0")}</span>
      <button class="card-play" type="button" aria-label="Play ${item.title}">▶</button>
    </div>
    <div class="card-copy">
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    </div>`;

  card.querySelector(".card-play").addEventListener("click", () => {
    setHero(index);
    document.querySelector(".hero").scrollIntoView({ behavior: "smooth" });
  });

  return card;
}

function buildCarousel() {
  const copies = [...videos, ...videos, ...videos];
  copies.forEach((item, copyIndex) => {
    carousel.appendChild(createCard(item, copyIndex % videos.length, copyIndex));
  });

  requestAnimationFrame(() => {
    carousel.scrollLeft = carousel.scrollWidth / 3;
  });
}

function normalizeInfiniteScroll() {
  const third = carousel.scrollWidth / 3;
  if (carousel.scrollLeft < third * 0.45) carousel.scrollLeft += third;
  if (carousel.scrollLeft > third * 1.55) carousel.scrollLeft -= third;
}

function scrollCarousel(direction) {
  const card = carousel.querySelector(".video-card");
  const gap = parseFloat(getComputedStyle(carousel).gap) || 0;
  const distance = card ? card.getBoundingClientRect().width + gap : carousel.clientWidth * 0.8;
  carousel.scrollBy({ left: direction * distance, behavior: "smooth" });
}

function startDrag(event) {
  isDragging = true;
  dragStartX = event.pageX || event.touches[0].pageX;
  dragStartScroll = carousel.scrollLeft;
  carousel.classList.add("dragging");
  pauseHero(true);
}

function moveDrag(event) {
  if (!isDragging) return;
  const pageX = event.pageX || event.touches[0].pageX;
  carousel.scrollLeft = dragStartScroll - (pageX - dragStartX);
  normalizeInfiniteScroll();
}

function endDrag() {
  isDragging = false;
  carousel.classList.remove("dragging");
}

const designLightbox = document.getElementById("design-lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxTitle = document.getElementById("lightbox-title");

function openDesignLightbox(work) {
  lightboxImage.src = encodeURI(work.image);
  lightboxImage.alt = work.title;
  lightboxTitle.textContent = work.title;
  designLightbox.classList.add("visible");
  designLightbox.setAttribute("aria-hidden", "false");
}

function closeDesignLightbox() {
  designLightbox.classList.remove("visible");
  designLightbox.setAttribute("aria-hidden", "true");
}

function buildDesignGallery() {
  const firstRow = designWorks.filter((_, index) => index % 2 === 0);
  const secondRow = designWorks.filter((_, index) => index % 2 === 1);
  const renderCards = (works) => [...works, ...works].map((work) => {
    const index = designWorks.indexOf(work);
    return `
      <article class="design-card">
        <button class="design-link" type="button" data-index="${index}" aria-label="View ${work.title}">
          <img src="${encodeURI(work.image)}" alt="${work.title}" draggable="false">
          <span class="design-overlay">
            <span class="design-tag">${work.category}</span>
            <span class="design-count">${String(index + 1).padStart(2, "0")}</span>
          </span>
        </button>
      </article>
    `;
  }).join("");

  designGrid.innerHTML = `
    <div class="marquee-wrap">
      <div class="marquee-row">
        ${renderCards(firstRow)}
      </div>
      <div class="marquee-row reverse" style="margin-top: 18px;">
        ${renderCards(secondRow)}
      </div>
    </div>
  `;

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

heroVideo.addEventListener("ended", () => {
  setHero((activeIndex + 1) % videos.length);
});
heroVideo.addEventListener("click", () => heroVideo.paused ? playHero() : pauseHero(false));
watchButton.addEventListener("click", playHero);
soundButton.addEventListener("click", () => {
  heroVideo.muted = !heroVideo.muted;
  soundButton.textContent = heroVideo.muted ? "🔇" : "🔊";
  soundButton.setAttribute("aria-label", heroVideo.muted ? "Turn sound on" : "Mute sound");
});
carousel.addEventListener("scroll", normalizeInfiniteScroll, { passive: true });
carousel.addEventListener("mousedown", startDrag);
carousel.addEventListener("mousemove", moveDrag);
carousel.addEventListener("mouseup", endDrag);
carousel.addEventListener("mouseleave", endDrag);
carousel.addEventListener("touchstart", startDrag, { passive: true });
carousel.addEventListener("touchmove", moveDrag, { passive: true });
carousel.addEventListener("touchend", endDrag);
document.querySelector(".previous").addEventListener("click", () => {
  pauseHero(true);
  scrollCarousel(-1);
});
document.querySelector(".next").addEventListener("click", () => {
  pauseHero(true);
  scrollCarousel(1);
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
buildCarousel();
buildDesignGallery();
