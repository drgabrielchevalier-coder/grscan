/* ============================================================
   CONFIGURAÇÃO — edite apenas este bloco
   ============================================================ */
const CONFIG = {
  // WhatsApp com DDI + DDD, só números. Ex.: "5581999999999"
  whatsapp: "",
  whatsappMessage: "Olá! Gostaria de solicitar um orçamento de escaneamento intraoral com a GR Scan.",
  email: "",       // Ex.: "contato@grscan.com.br" (aparece no rodapé)
  instagram: "",   // Ex.: "grscan"

  // Região atendida (aparece no texto)
  regiao: "Rio de Janeiro e Região Metropolitana",
  // Locais marcados no mapa. "rotulo" = onde o nome aparece: "top", "bottom", "left" ou "right".
  // O mapa se ajusta sozinho para mostrar todos.
  mapaLocais: [
    { nome: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, rotulo: "left" },
    { nome: "Niterói", lat: -22.8832, lng: -43.1034, rotulo: "right" },
    { nome: "Duque de Caxias", lat: -22.7856, lng: -43.3117, rotulo: "right" },
    { nome: "Nova Iguaçu", lat: -22.7592, lng: -43.4511, rotulo: "top" },
    { nome: "Campo Grande", lat: -22.9035, lng: -43.5592, rotulo: "bottom" },
  ],
  // Raio aproximado de atendimento ao redor de cada local, em km (0 = sem círculo)
  mapaRaioKm: 5,
  // Horário de atendimento (texto). Ex.: "Segunda a sexta, das 8h às 18h, com hora marcada."
  horario: "",

  // Agenda do formulário de agendamento
  agenda: {
    diasDaSemana: [1, 2, 3, 4, 5], // 0=domingo, 1=segunda … 6=sábado
    inicio: "08:00",               // primeiro horário do dia
    fim: "17:00",                  // último horário do dia
    intervaloMinutos: 60,          // espaço entre um horário e outro
    antecedenciaDias: 1,           // 1 = a partir de amanhã
    diasNoFuturo: 60,              // até quantos dias à frente pode agendar
    datasBloqueadas: [],           // Ex.: ["2026-12-25", "2027-01-01"]
  },

  // Arquivo que envia a solicitação por e-mail (configure o e-mail dentro de agendar.php).
  // Deixe "" para enviar só pelo WhatsApp.
  endpointAgendamento: "agendar.php",
  // Lê os horários livres do Google Agenda (configure em agenda-config.php).
  // Enquanto não estiver configurado, o formulário usa as regras de "agenda" acima.
  endpointDisponibilidade: "disponibilidade.php",
};
/* ============================================================ */

document.documentElement.classList.remove("no-js");
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const waLink = (text) => "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(text);

  // ---------- Links de contato ----------
  const setLinks = (selector, href) => {
    $$(selector).forEach((a) => {
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
      else if (a.classList.contains("btn")) { a.href = "#agendar"; }
      else { a.hidden = true; }
    });
  };
  setLinks("[data-whatsapp]", CONFIG.whatsapp && waLink(CONFIG.whatsappMessage));
  setLinks("[data-email]", CONFIG.email && "mailto:" + CONFIG.email);
  setLinks("[data-instagram]", CONFIG.instagram && "https://instagram.com/" + CONFIG.instagram);

  // ---------- Região, horário e mapa ----------
  if (CONFIG.regiao) $$("[data-regiao]").forEach((el) => (el.textContent = CONFIG.regiao));
  const mapa = $("#mapa");
  const locais = CONFIG.mapaLocais || [];
  if (mapa && locais.length && window.L) {
    mapa.innerHTML = '<div class="map__canvas" role="region" aria-label="Mapa da área de atendimento"></div>';
    const L = window.L;
    const map = L.map($(".map__canvas", mapa), { zoomSnap: 0.25,
      scrollWheelZoom: false, zoomControl: true, attributionControl: true, tap: false,
    });
    // Mapa do OpenStreetMap (escurecido no CSS para combinar com o site)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    const OFFSETS = { top: [0, -10], bottom: [0, 10], left: [-10, 0], right: [10, 0] };
    const pts = [];
    locais.forEach((l, i) => {
      const p = [l.lat, l.lng]; pts.push(p);
      if (CONFIG.mapaRaioKm) {
        L.circle(p, { radius: CONFIG.mapaRaioKm * 1000, color: "#d9a441", weight: 1, opacity: 0.5, fillColor: "#d9a441", fillOpacity: 0.12, interactive: false }).addTo(map);
      }
      const icon = L.divIcon({ className: "map-pin", html: '<span style="animation-delay:' + i * 0.3 + 's"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
      L.marker(p, { icon, title: l.nome, keyboard: false })
        .bindTooltip(l.nome, { permanent: true, direction: l.rotulo || "top", offset: OFFSETS[l.rotulo || "top"], className: "map-tip" })
        .addTo(map);
    });
    const fit = () => {
      const w = mapa.clientWidth;
      // margem maior à direita para caber o rótulo de Niterói
      map.fitBounds(L.latLngBounds(pts), {
        paddingTopLeft: w < 420 ? [40, 40] : [60, 50],
        paddingBottomRight: w < 420 ? [70, 40] : [110, 50],
        maxZoom: 12,
      });
    };
    fit();
    let lastW = 0;
    new ResizeObserver(() => {
      if (Math.abs(mapa.clientWidth - lastW) < 2) return;
      lastW = mapa.clientWidth; map.invalidateSize(); fit();
    }).observe(mapa);
  }
  if (CONFIG.horario) $$("[data-horario]").forEach((el) => (el.textContent = CONFIG.horario));

  // ---------- Janela do agendamento (abre/fecha) ----------
  const modal = $("#bk-modal");
  const openBooking = () => {
    if (!modal || modal.open) return;
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
    document.body.classList.add("modal-open");
    document.dispatchEvent(new Event("bk:open"));
    const box = $(".bk-modal__box", modal); if (box) box.scrollTop = 0;
    setTimeout(() => {
      const first = $('input[name="trabalho"]', modal);
      if (first && !$("#bk").hidden) first.focus({ preventScroll: true });
    }, 50);
  };
  const closeBooking = () => {
    if (!modal) return;
    if (typeof modal.close === "function" && modal.open) modal.close(); else modal.removeAttribute("open");
    document.body.classList.remove("modal-open");
  };
  if (modal) {
    modal.addEventListener("close", () => document.body.classList.remove("modal-open"));
    // clique fora da caixa fecha
    modal.addEventListener("click", (e) => { if (e.target === modal) closeBooking(); });
    $$("[data-close-booking]").forEach((b) => b.addEventListener("click", closeBooking));
    $$("[data-open-booking]").forEach((b) => b.addEventListener("click", openBooking));
    // todos os botões/links "#agendar" abrem o formulário
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href="#agendar"]');
      if (!a) return;
      e.preventDefault();
      openBooking();
    });
    if (location.hash === "#agendar") setTimeout(openBooking, 400);
  }

  // ---------- Formulário de agendamento ----------
  const form = $("#bk");
  if (form) {
    const A = CONFIG.agenda;
    const pad = (n) => String(n).padStart(2, "0");
    const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fmtDate = (s) => { const [y, m, d] = s.split("-"); return d + "/" + m + "/" + y; };
    const weekday = (s) => new Date(s + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" });

    const dateInput = form.elements.data;
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const min = new Date(today); min.setDate(min.getDate() + A.antecedenciaDias);
    const max = new Date(today); max.setDate(max.getDate() + A.diasNoFuturo);
    dateInput.min = iso(min); dateInput.max = iso(max);

    // Horários vindos do Google Agenda (null = usa as regras fixas de CONFIG.agenda)
    let G = null, gLoadedAt = 0;
    const dayOk = (s) => {
      if (G) return !!(s && G[s] && G[s].length);
      if (!s || s < dateInput.min || s > dateInput.max) return false;
      if (A.datasBloqueadas.includes(s)) return false;
      return A.diasDaSemana.includes(new Date(s + "T12:00:00").getDay());
    };
    const diasTxt = () => {
      const n = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      return A.diasDaSemana.map((d) => n[d]).join(", ");
    };

    const slots = $("#slots");
    const slotHtml = (h) => '<label class="tslot"><input type="radio" name="hora" value="' + h + '"><span>' + h + "</span></label>";
    const renderSlots = () => {
      const s = dateInput.value;
      slots.classList.remove("is-invalid");
      if (!s) { slots.innerHTML = '<p class="bk__hint">Escolha uma data para ver os horários.</p>'; return; }
      if (!dayOk(s)) {
        slots.innerHTML = G
          ? '<p class="bk__hint">Não há mais horários livres nesta data. Escolha outro dia.</p>'
          : '<p class="bk__hint">Sem atendimento nesta data. Atendemos: ' + diasTxt() + '.</p>';
        return;
      }
      if (G) { slots.innerHTML = G[s].map(slotHtml).join(""); return; }
      let html = "";
      for (let t = toMin(A.inicio); t <= toMin(A.fim); t += A.intervaloMinutos) {
        html += slotHtml(pad(Math.floor(t / 60)) + ":" + pad(t % 60));
      }
      slots.innerHTML = html;
    };
    dateInput.addEventListener("change", renderSlots);
    dateInput.addEventListener("input", renderSlots);

    // ---- Modo Google Agenda: mostra só os dias e horários livres ----
    const days = document.createElement("div");
    days.className = "days"; days.id = "days"; days.hidden = true;
    dateInput.after(days);
    const dayLabel = (s) => {
      const d = new Date(s + "T12:00:00");
      const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      return "<small>" + wd + "</small><b>" + pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "</b>";
    };
    const renderDays = () => {
      const list = Object.keys(G).filter((s) => G[s].length).sort();
      if (!list.length) {
        days.innerHTML = '<p class="bk__hint">Nenhum horário livre no momento. Fale com a gente pelo WhatsApp ou tente mais tarde.</p>';
      } else {
        days.innerHTML = list.map((s) =>
          '<label class="tslot tday"><input type="radio" name="dia" value="' + s + '"' + (s === dateInput.value ? " checked" : "") +
          "><span>" + dayLabel(s) + "</span></label>").join("");
      }
      if (dateInput.value && !dayOk(dateInput.value)) dateInput.value = "";
      renderSlots();
    };
    days.addEventListener("change", (e) => {
      if (e.target.name !== "dia") return;
      dateInput.value = e.target.value; renderSlots();
    });
    const loadAvailability = async (force) => {
      if (!CONFIG.endpointDisponibilidade || !location.protocol.startsWith("http")) return;
      if (!force && G && Date.now() - gLoadedAt < 60000) return;
      try {
        const r = await fetch(CONFIG.endpointDisponibilidade + "?t=" + Date.now(), { cache: "no-store" });
        const j = await r.json();
        if (!j.ok || !j.dias) return; // agenda não conectada: segue com as regras fixas
        G = j.dias; gLoadedAt = Date.now();
        form.classList.add("is-google");
        dateInput.hidden = true; days.hidden = false;
        dateInput.closest(".field").classList.add("field--full");
        slots.closest(".field").classList.add("field--full");
        $("#bk-submit").textContent = "Reservar horário";
        const sub = $(".bk-modal__head p"); if (sub) sub.textContent = "Os horários mostrados estão livres e são reservados na hora.";
        renderDays();
      } catch (_) { /* mantém o modo sem agenda */ }
    };
    document.addEventListener("bk:open", () => loadAvailability(false));

    // limpa marca de erro ao editar
    form.addEventListener("input", (e) => {
      const f = e.target.closest(".field"); if (f) f.classList.remove("is-invalid");
      const c = e.target.closest(".chips, .slots"); if (c) c.classList.remove("is-invalid");
    });

    const errorBox = $("#bk-error");
    form.addEventListener("input", () => (errorBox.textContent = ""));
    const fail = (el, msg) => {
      (el.closest(".field") || el.closest(".chips") || el).classList.add("is-invalid");
      errorBox.textContent = msg;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el.focus) el.focus({ preventScroll: true });
      return false;
    };

    const validate = () => {
      const f = form.elements;
      if (!form.querySelector('input[name="trabalho"]:checked')) return fail($(".chips", form), "Escolha o tipo de trabalho.");
      for (const name of ["clinica", "endereco", "cidade"]) {
        if (!f[name].value.trim()) return fail(f[name], "Informe o local do atendimento.");
      }
      if (!dayOk(f.data.value)) return fail(f.data, "Escolha uma data disponível.");
      if (!form.querySelector('input[name="hora"]:checked')) { slots.classList.add("is-invalid"); errorBox.textContent = "Escolha um horário."; slots.scrollIntoView({ behavior: "smooth", block: "center" }); return false; }
      if (!f.nome.value.trim()) return fail(f.nome, "Informe o nome do dentista responsável.");
      if (f.telefone.value.replace(/\D/g, "").length < 10) return fail(f.telefone, "Informe um WhatsApp com DDD.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return fail(f.email, "Informe um e-mail válido.");
      return true;
    };

    const collect = () => {
      const d = Object.fromEntries(new FormData(form).entries());
      Object.keys(d).forEach((k) => (d[k] = String(d[k]).trim()));
      return d;
    };

    const summary = (d) => [
      ["Trabalho", d.trabalho + " — " + d.arcadas + (d.pacientes > 1 ? " — " + d.pacientes + " pacientes" : "")],
      ["Local", d.clinica + " — " + d.endereco + ", " + d.cidade],
      ["Data", fmtDate(d.data) + " (" + weekday(d.data) + ") às " + d.hora],
      ["Dentista", d.nome],
      ["Contato", d.telefone + " · " + d.email],
      d.laboratorio && ["Laboratório", d.laboratorio],
      d.obs && ["Observações", d.obs],
    ].filter(Boolean);

    const waText = (d) => "Olá! Gostaria de agendar um escaneamento com a GR Scan.\n\n" +
      summary(d).map(([k, v]) => "*" + k + ":* " + v).join("\n");

    const showDone = (d, modo) => {
      $("#bk-sum").innerHTML = summary(d).map(([k, v]) => {
        const li = document.createElement("li");
        li.innerHTML = "<strong></strong> ";
        li.firstChild.textContent = k + ":";
        li.append(v);
        return li.outerHTML;
      }).join("");
      const wa = $("#bk-wa");
      if (CONFIG.whatsapp) { wa.href = waLink(waText(d)); wa.hidden = false; }
      $("#bk-done h3").textContent = modo === "reservado" ? "Horário reservado!" : "Solicitação enviada!";
      $("#bk-done-text").textContent =
        modo === "reservado" ? "Seu escaneamento está agendado. Enviamos os detalhes para " + d.email + "."
        : modo === "email" ? "Recebemos o seu pedido e enviamos uma cópia para " + d.email + ". Vamos confirmar o horário com você em breve."
        : "Finalize o envio da mensagem no WhatsApp para concluir o pedido. Vamos confirmar o horário com você em breve.";
      form.hidden = true;
      const done = $("#bk-done"); done.hidden = false;
      done.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorBox.textContent = "";
      if (!validate()) return;
      const d = collect();
      const btn = $("#bk-submit");
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Enviando…";
      let ok = false, j = {};
      if (CONFIG.endpointAgendamento && location.protocol.startsWith("http")) {
        try {
          const r = await fetch(CONFIG.endpointAgendamento, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
          });
          j = await r.json().catch(() => ({}));
          ok = r.ok && j.ok;
        } catch (_) { ok = false; }
      }
      btn.disabled = false; btn.textContent = label;
      if (ok) {
        if (j.reservado) loadAvailability(true);
        return showDone(d, j.reservado ? "reservado" : "email");
      }
      if (j.ocupado) {
        // alguém reservou esse horário antes: atualiza a lista e pede outro
        await loadAvailability(true);
        errorBox.textContent = j.message || "Esse horário acabou de ser reservado. Escolha outro.";
        slots.classList.add("is-invalid");
        slots.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (CONFIG.whatsapp) {
        window.open(waLink(waText(d)), "_blank", "noopener");
        return showDone(d, "whatsapp");
      }
      errorBox.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
    });

    $("#bk-new").addEventListener("click", () => {
      form.reset(); dateInput.value = "";
      if (G) renderDays(); else renderSlots();
      $("#bk-done").hidden = true; form.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // ---------- Cabeçalho, ano e animações ----------
  document.getElementById("ano").textContent = new Date().getFullYear();
  const header = $(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const els = $$(".reveal, .fade-up");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  } else {
    els.forEach((el) => el.classList.add("is-visible"));
  }
})();
