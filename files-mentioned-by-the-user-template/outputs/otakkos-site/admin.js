const DATA_KEY = "otakkos_admin_data_v1";
const STATS_KEY = "otakkos_stats_v1";
const PASSWORD_KEY = "otakkos_admin_password_v1";
const SESSION_KEY = "otakkos_admin_session_v1";

const supabaseClient = window.otakkosSupabaseClient || null;
const supabaseConfig = window.OTAKKOS_SUPABASE || {};

const defaultData = {
  contact: {
    phoneDisplay: "+225 07 77 73 47 76",
    email: "otakkos007@gmail.com",
    whatsappNumber: "2250777734776",
  },
  jobs: [],
  restaurants: [],
  menu: null,
};

const $ = (selector) => document.querySelector(selector);

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const mergeData = (data = {}) => ({
  ...defaultData,
  ...data,
  contact: {
    ...defaultData.contact,
    ...(data.contact || {}),
  },
  jobs: Array.isArray(data.jobs) ? data.jobs : [],
  restaurants: Array.isArray(data.restaurants) ? data.restaurants : [],
  menu: data.menu || null,
});

const getLocalData = () => mergeData(readJson(DATA_KEY, defaultData));

const getData = async () => {
  if (!supabaseClient) return getLocalData();

  const { data, error } = await supabaseClient
    .from("site_settings")
    .select("data")
    .eq("id", supabaseConfig.settingsId || "main")
    .maybeSingle();

  if (error || !data?.data) return getLocalData();

  const adminData = mergeData(data.data);
  writeJson(DATA_KEY, adminData);
  return adminData;
};

const saveData = async (data) => {
  const adminData = mergeData(data);
  writeJson(DATA_KEY, adminData);

  if (supabaseClient) {
    const { error } = await supabaseClient.from("site_settings").upsert({
      id: supabaseConfig.settingsId || "main",
      data: adminData,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert("Impossible d'enregistrer dans Supabase. Vérifie que les tables et permissions sont bien créées.");
      console.error(error);
      return;
    }
  }

  await renderAdmin();
};

const getLocalStats = () =>
  readJson(STATS_KEY, {
    totalVisits: 0,
    totalInteractions: 0,
    pageVisits: {},
    buttons: {},
  });

const getStats = async () => {
  if (!supabaseClient) return getLocalStats();

  const { data, error } = await supabaseClient
    .from("site_events")
    .select("event_type,label")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return getLocalStats();

  const stats = {
    totalVisits: 0,
    totalInteractions: 0,
    pageVisits: {},
    buttons: {},
  };

  data.forEach((event) => {
    if (event.event_type === "visit") stats.totalVisits += 1;
    if (event.event_type === "interaction") {
      stats.totalInteractions += 1;
      if (event.label) stats.buttons[event.label] = (stats.buttons[event.label] || 0) + 1;
    }
  });

  return stats;
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const readImageAsCompressedDataUrl = (file, maxWidth = 1400, quality = 0.86) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const ratio = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.onerror = reject;
      image.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fileExtension = (file) => {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName !== file.name) return fromName.toLowerCase();
  if (file.type === "application/pdf") return "pdf";
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  return "jpg";
};

const uploadFile = async (folder, file) => {
  if (!supabaseClient) return "";

  const bucket = supabaseConfig.uploadsBucket || "site-uploads";
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${fileExtension(file)}`;
  const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabaseClient.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

const isLoggedIn = async () => {
  if (!supabaseClient) return sessionStorage.getItem(SESSION_KEY) === "true";
  const { data } = await supabaseClient.auth.getSession();
  return Boolean(data.session);
};

const setLocalLoggedIn = (value) => {
  if (value) sessionStorage.setItem(SESSION_KEY, "true");
  else sessionStorage.removeItem(SESSION_KEY);
};

const updateVisibility = async () => {
  const loggedIn = await isLoggedIn();
  $("#admin-login").classList.toggle("is-hidden", loggedIn);
  $("#admin-panel").classList.toggle("is-hidden", !loggedIn);
  if (loggedIn) await renderAdmin();
};

const renderStats = async () => {
  const stats = await getStats();
  $("#stat-visits").textContent = stats.totalVisits || 0;
  $("#stat-interactions").textContent = stats.totalInteractions || 0;

  const entries = Object.entries(stats.buttons || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  $("#top-buttons").innerHTML =
    entries.length === 0
      ? "<p>Aucune interaction pour le moment.</p>"
      : entries
          .map(([label, count]) => `<p><strong>${escapeHtml(label)}</strong><span>${count}</span></p>`)
          .join("");
};

const renderJobs = (jobs) => {
  $("#jobs-list").innerHTML =
    jobs.length === 0
      ? "<p>Aucune offre publiée.</p>"
      : jobs
          .map(
            (job, index) => `
              <article>
                <strong>${escapeHtml(job.title)}</strong>
                <span>${escapeHtml(job.location || "Abidjan")}</span>
                <p>${escapeHtml(job.description)}</p>
                <button type="button" data-delete-job="${index}">Supprimer</button>
              </article>
            `
          )
          .join("");
};

const renderRestaurants = (restaurants) => {
  $("#restaurants-list").innerHTML =
    restaurants.length === 0
      ? "<p>Aucun restaurant ajouté depuis l'admin.</p>"
      : restaurants
          .map(
            (restaurant, index) => `
              <article>
                <strong>${escapeHtml(restaurant.name)}</strong>
                <span>${escapeHtml(restaurant.area)}</span>
                <p>${escapeHtml(restaurant.address)}</p>
                <button type="button" data-delete-restaurant="${index}">Supprimer</button>
              </article>
            `
          )
          .join("");
};

const renderAdmin = async () => {
  const data = await getData();
  const contactForm = $("#contact-form");
  contactForm.elements.phoneDisplay.value = data.contact.phoneDisplay;
  contactForm.elements.email.value = data.contact.email;
  contactForm.elements.whatsappNumber.value = data.contact.whatsappNumber;
  $("#menu-current").textContent = data.menu?.name || "Menu officiel";
  await renderStats();
  renderJobs(data.jobs || []);
  renderRestaurants(data.restaurants || []);
};

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;

  if (!supabaseClient) {
    const localPassword = localStorage.getItem(PASSWORD_KEY) || "admin";
    const ok = username === "admin" && password === localPassword;
    $("#login-feedback").textContent = ok ? "" : "Identifiants incorrects.";
    setLocalLoggedIn(ok);
    await updateVisibility();
    return;
  }

  const email = username === "admin" ? supabaseConfig.adminEmail : username;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  $("#login-feedback").textContent = error ? "Identifiants incorrects ou utilisateur admin non créé dans Supabase." : "";
  await updateVisibility();
});

$("#logout-button").addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  setLocalLoggedIn(false);
  await updateVisibility();
});

$("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = form.newPassword.value;

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      alert("Impossible de changer le mot de passe.");
      return;
    }
  } else {
    localStorage.setItem(PASSWORD_KEY, password);
  }

  form.reset();
  alert("Mot de passe mis à jour.");
});

$("#contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = await getData();
  data.contact = {
    phoneDisplay: form.elements.phoneDisplay.value.trim(),
    email: form.elements.email.value.trim(),
    whatsappNumber: form.elements.whatsappNumber.value.replace(/\D/g, ""),
  };
  await saveData(data);
  alert("Coordonnées mises à jour.");
});

$("#job-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = await getData();
  data.jobs = data.jobs || [];
  data.jobs.push({
    title: form.elements.title.value.trim(),
    location: form.elements.location.value.trim(),
    description: form.elements.description.value.trim(),
    createdAt: new Date().toISOString(),
  });
  form.reset();
  await saveData(data);
});

$("#clear-jobs").addEventListener("click", async () => {
  const data = await getData();
  data.jobs = [];
  await saveData(data);
});

$("#jobs-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-job]");
  if (!button) return;
  const data = await getData();
  data.jobs.splice(Number(button.dataset.deleteJob), 1);
  await saveData(data);
});

$("#menu-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.elements.menuFile.files[0];
  if (!file) return;

  const data = await getData();
  let url = "";
  let dataUrl = "";

  try {
    url = await uploadFile("menus", file);
  } catch (error) {
    console.error(error);
    dataUrl = file.type.startsWith("image/")
      ? await readImageAsCompressedDataUrl(file, 1800, 0.9)
      : await readFileAsDataUrl(file);
  }

  data.menu = {
    name: file.name,
    type: file.type || "application/octet-stream",
    url,
    dataUrl,
    updatedAt: new Date().toISOString(),
  };
  form.reset();
  await saveData(data);
  alert("Menu chargé.");
});

$("#reset-menu").addEventListener("click", async () => {
  const data = await getData();
  data.menu = null;
  await saveData(data);
});

$("#restaurant-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const file = form.elements.image.files[0];
  const data = await getData();
  let imageUrl = "";
  let imageData = "";

  if (file) {
    try {
      imageUrl = await uploadFile("restaurants", file);
    } catch (error) {
      console.error(error);
      imageData = await readImageAsCompressedDataUrl(file, 1200, 0.86);
    }
  }

  data.restaurants = data.restaurants || [];
  data.restaurants.push({
    name: form.elements.name.value.trim(),
    area: form.elements.area.value.trim(),
    address: form.elements.address.value.trim(),
    imageUrl,
    imageData,
    createdAt: new Date().toISOString(),
  });
  form.reset();
  await saveData(data);
});

$("#clear-restaurants").addEventListener("click", async () => {
  const data = await getData();
  data.restaurants = [];
  await saveData(data);
});

$("#restaurants-list").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-restaurant]");
  if (!button) return;
  const data = await getData();
  data.restaurants.splice(Number(button.dataset.deleteRestaurant), 1);
  await saveData(data);
});

updateVisibility();
