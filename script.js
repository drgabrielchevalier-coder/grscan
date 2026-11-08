/* ============================================================
   CONFIGURAÇÃO — edite apenas este bloco
   ============================================================ */
const CONFIG = {
  // Link da "Agenda de agendamentos" do Google Agenda.
  // Google Agenda > Criar > Agenda de agendamentos > Compartilhar >
  // "Incorporar no site" e copie o endereço (src) do iframe. Ex.:
  // "https://calendar.google.com/calendar/appointments/schedules/AcZssZ...?gv=true"
  googleCalendarUrl: "",

  // WhatsApp com DDI + DDD, só números. Ex.: "5511999999999"
  whatsapp: "",
  whatsappMessage: "Olá! Gostaria de agendar um escaneamento digital com a GRScan.",

  email: "",       // Ex.: "contato@grscan.com.br"
  instagram: "",   // Ex.: "grscan"
};
/* ============================================================ */

(function () {
  // Agenda do Google
  const booking = document.getElementById("booking");
  if (CONFIG.googleCalendarUrl && booking) {
    const url = CONFIG.googleCalendarUrl.includes("gv=true")
      ? CONFIG.googleCalendarUrl
      : CONFIG.googleCalendarUrl + (CONFIG.googleCalendarUrl.includes("?") ? "&" : "?") + "gv=true";
    booking.innerHTML =
      '<iframe src="' + url + '" title="Agendamento online GRScan" loading="lazy"></iframe>';
  }

  // Links de contato
  const setLinks = (selector, href) => {
    document.querySelectorAll(selector).forEach((a) => {
      if (href) {
        a.href = href;
        a.target = "_blank";
        a.rel = "noopener";
      } else if (!a.closest(".booking__fallback")) {
        a.hidden = true;
      }
    });
  };
  setLinks("[data-whatsapp]", CONFIG.whatsapp &&
    "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(CONFIG.whatsappMessage));
  setLinks("[data-email]", CONFIG.email && "mailto:" + CONFIG.email);
  setLinks("[data-instagram]", CONFIG.instagram && "https://instagram.com/" + CONFIG.instagram);

  // Sem WhatsApp configurado, o botão do fallback leva ao e-mail (ou some)
  const fbBtn = document.querySelector(".booking__fallback [data-whatsapp]");
  if (fbBtn && !CONFIG.whatsapp) {
    if (CONFIG.email) { fbBtn.href = "mailto:" + CONFIG.email; fbBtn.textContent = "Agendar por e-mail"; }
    else fbBtn.hidden = true;
  }

  // Menu mobile
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("menu");
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open);
  });
  nav.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    })
  );

  // Ano no rodapé
  document.getElementById("ano").textContent = new Date().getFullYear();

  // Animação ao rolar
  const els = document.querySelectorAll(".card, .step, .section__head, .chips, .faq details");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }
})();
