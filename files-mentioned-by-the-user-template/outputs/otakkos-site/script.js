const DATA_KEY = "otakkos_admin_data_v1";
const STATS_KEY = "otakkos_stats_v1";

const supabaseClient = window.otakkosSupabaseClient || null;
const supabaseConfig = window.OTAKKOS_SUPABASE || {};

const defaultAdminData = {
  contact: {
    phoneDisplay: "+225 07 77 73 47 76",
    email: "otakkos007@gmail.com",
    whatsappNumber: "2250777734776",
  },
  jobs: [],
  restaurants: [],
  menu: null,
};

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const mergeAdminData = (data = {}) => ({
  ...defaultAdminData,
  ...data,
  contact: {
    ...defaultAdminData.contact,
    ...(data.contact || {}),
  },
  jobs: Array.isArray(data.jobs) ? data.jobs : [],
  restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
  menu: data.menu || null,
});

const getLocalAdminData = () => mergeAdminData(readJson(DATA_KEY, defaultAdminData));

const fetchAdminData = async () => {
  if (!supabaseClient) return getLocalAdminData();

  const { data, error } = await supabaseClient
    .from("site_settings")
    .select("data")
    .eq("id", supabaseConfig.settingsId || "main")
    .maybeSingle();

  if (error || !data?.data) return getLocalAdminData();

  const adminData = mergeAdminData(data.data);
  writeJson(DATA_KEY, adminData);
  return adminData;
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getStats = () =>
  readJson(STATS_KEY, {
    totalVisits: 0,
    totalInteractions: 0,
    pageVisits: {},
    buttons: {},
  });

const saveStats = (stats) => writeJson(STATS_KEY, stats);

const currentPage = () => {
  const name = location.pathname.split("/").filter(Boolean).pop() || "index.html";
  return name === "" ? "index.html" : name;
};

const saveEvent = async (eventType, label = "") => {
  if (!supabaseClient) return;

  await supabaseClient.from("site_events").insert({
    event_type: eventType,
    page: currentPage(),
    label,
  });
};

const trackVisit = () => {
  if (location.pathname.endsWith("admin.html")) return;

  const stats = getStats();
  const page = currentPage();
  stats.totalVisits += 1;
  stats.pageVisits[page] = (stats.pageVisits[page] || 0) + 1;
  saveStats(stats);
  saveEvent("visit");
};

const trackInteraction = (label) => {
  if (!label || location.pathname.endsWith("admin.html")) return;

  const stats = getStats();
  stats.totalInteractions += 1;
  stats.buttons[label] = (stats.buttons[label] || 0) + 1;
  saveStats(stats);
  saveEvent("interaction", label);
};

const setupNavigation = () => {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");

  toggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
};

const setupInteractionTracking = () => {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("a, button");
    if (!target) return;
    const label =
      target.getAttribute("aria-label") ||
      target.textContent?.replace(/\s+/g, " ").trim() ||
      target.getAttribute("href") ||
      "Interaction";
    trackInteraction(label);
  });
};

const whatsappUrl = (number, message = "") => {
  const cleaned = String(number || "").replace(/\D/g, "");
  const suffix = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${cleaned}${suffix}`;
};

const updateWhatsappLinks = (number) => {
  document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
    try {
      const url = new URL(link.getAttribute("href"), location.href);
      const message = url.searchParams.get("text") || "";
      link.setAttribute("href", whatsappUrl(number, message));
    } catch {
      link.setAttribute("href", whatsappUrl(number));
    }
  });
};

const updateContactBlocks = ({ phoneDisplay, email }) => {
  document.querySelectorAll(".footer").forEach((footer) => {
    const contactTitle = [...footer.querySelectorAll("h3")].find((title) =>
      title.textContent.toLowerCase().includes("contact")
    );
    const block = contactTitle?.parentElement;
    if (!block) return;
    const paragraphs = [...block.querySelectorAll("p")];
    if (paragraphs[0]) paragraphs[0].textContent = phoneDisplay;
    if (paragraphs[1]) paragraphs[1].textContent = email;
  });

  const contactCards = document.querySelectorAll(".contact-info article");
  if (contactCards[0]?.querySelector("h2")) contactCards[0].querySelector("h2").textContent = phoneDisplay;
  if (contactCards[1]?.querySelector("h2")) contactCards[1].querySelector("h2").textContent = email;

  const reviewForm = document.querySelector(".review-form");
  if (reviewForm) reviewForm.setAttribute("action", `mailto:${email}`);
};

const renderCareers = (jobs) => {
  const status = document.querySelector(".careers-status");
  if (!status) return;

  if (!jobs.length) {
    status.innerHTML = `
      <span class="section-kicker">Offres d'emploi</span>
      <h2>Pas d'offres pour le moment</h2>
      <p>Les prochaines opportunités seront publiées ici dès qu'elles seront disponibles.</p>
      <a class="btn primary" href="contact.html">Nous contacter</a>
    `;
    return;
  }

  status.innerHTML = `
    <span class="section-kicker">Offres d'emploi</span>
    <h2>Postes ouverts</h2>
    <div class="job-list">
      ${jobs
        .map(
          (job) => `
            <article class="job-card">
              <strong>${escapeHtml(job.title)}</strong>
              <span>${escapeHtml(job.location || "Abidjan")}</span>
              <p>${escapeHtml(job.description)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
};

const renderCustomMenu = (menu) => {
  if (!menu?.url && !menu?.dataUrl) return;
  const source = menu.url || menu.dataUrl;
  const documentBlock = document.querySelector(".menu-document");
  const pageImage = document.querySelector(".menu-page");
  const download = document.querySelector(".menu-download");
  if (!documentBlock) return;

  if (menu.type === "application/pdf") {
    pageImage?.remove();
    if (!documentBlock.querySelector(".menu-pdf")) {
      documentBlock.insertAdjacentHTML(
        "afterbegin",
        `<iframe class="menu-pdf" src="${source}" title="Menu complet O'Takkos"></iframe>`
      );
    }
  } else if (pageImage) {
    pageImage.src = source;
    pageImage.alt = menu.name || "Menu complet O'Takkos";
  }

  if (download) {
    download.href = source;
    download.textContent = "Ouvrir le menu chargé";
  }
};

const renderExtraRestaurants = (restaurants) => {
  const list = document.querySelector(".restaurants-list");
  if (!list) return;
  list.querySelectorAll("[data-admin-restaurant]").forEach((item) => item.remove());
  if (!restaurants.length) return;

  restaurants.forEach((restaurant) => {
    list.insertAdjacentHTML(
      "beforeend",
      `
        <article class="restaurant-card" data-admin-restaurant>
          <img src="${restaurant.imageUrl || restaurant.imageData || "assets/restaurant-hero-yopougon.jpg"}" alt="${escapeHtml(
            restaurant.name
          )}" />
          <div>
            <span class="section-kicker">${escapeHtml(restaurant.area || "Nouvelle adresse")}</span>
            <h2>${escapeHtml(restaurant.name)}</h2>
            <p>${escapeHtml(restaurant.address)}</p>
          </div>
        </article>
      `
    );
  });
};

const applyAdminData = (data) => {
  updateContactBlocks(data.contact);
  updateWhatsappLinks(data.contact.whatsappNumber);
  renderCareers(data.jobs || []);
  renderCustomMenu(data.menu);
  renderExtraRestaurants(data.restaurants || []);
};

const initSite = async () => {
  setupNavigation();
  setupInteractionTracking();
  trackVisit();
  applyAdminData(await fetchAdminData());
};

initSite();
