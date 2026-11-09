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
  // Mapa de cobertura: os contornos dos municípios ficam em assets/municipios.geojson.
  // Aqui só a posição do nome de cada município e da base (ponto de partida).
  mapaRotulos: {
    "Nova Iguaçu": [-22.70, -43.53],
    "Duque de Caxias": [-22.66, -43.31],
    "Rio de Janeiro": [-22.93, -43.47],
    "Niterói": [-22.915, -43.065],
  },
  mapaVizinhos: [["Magé", -22.62, -43.10], ["São Gonçalo", -22.80, -42.99]],
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

  // Página de reservas do Google Agenda ("Agenda de agendamentos").
  // Preenchido: o botão "Agendar" abre essa página dentro do site, com os horários livres da sua agenda.
  // Vazio (""): usa o formulário próprio do site, conectado ao Google Agenda pela conta de serviço (agenda-config.php).
  // Para voltar à página de reservas do Google, cole entre as aspas:
  // https://calendar.google.com/calendar/appointments/schedules/AcZssZ25gLU9mfg06dVwexH09kKzk3KGn9nSaVpUgUGZgBxkSkKDm_N5woDil1dccoPBrSu8D1IzscS0?gv=true
  googleAgendamentoUrl: "",
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
  if (mapa && window.L) initCoverageMap(mapa).catch((e) => console.warn("Mapa:", e));

  async function initCoverageMap(mapa) {
    const L = window.L;
    const geo = await fetch("assets/municipios.geojson").then((r) => r.json());
    mapa.innerHTML =
      '<div class="map__canvas" role="region" aria-label="Mapa de cobertura: municípios atendidos"></div>' +
      '<div class="cov-title"><b>Mapa de Cobertura</b><small>Municípios atendidos</small></div>' +
      '<div class="cov-north" aria-hidden="true"><svg viewBox="0 0 24 32"><path d="M12 2l7 18-7-5-7 5z"/></svg>N</div>' +
      '<div class="cov-legend"><i></i><span><b>Áreas atendidas</b><small>(municípios)</small></span></div>';
    mapa.classList.add("cov");
    const map = L.map($(".map__canvas", mapa), {
      zoomSnap: 0.25, scrollWheelZoom: false, zoomControl: false, attributionControl: true, tap: false,
    });
    // posição inicial afastada (antes de adicionar camadas); depois "voa" até a região
    const bounds = L.geoJSON(geo).getBounds();
    map.setView(bounds.getCenter(), 8);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.control.scale({ position: "bottomleft", imperial: false, maxWidth: 120 }).addTo(map);
    const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/";
    L.tileLayer(esri + "World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18, className: "cov-sat", attribution: "Imagens &copy; Esri",
    }).addTo(map);
    L.tileLayer(esri + "Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 18, className: "cov-roads", attribution: "Vias &copy; Esri, OpenStreetMap",
    }).addTo(map);

    // Municípios: preenchimento dourado + contorno que "corre"
    const areas = L.geoJSON(geo, {
      style: () => ({ color: "#ffcf5a", weight: 2, opacity: 1, fillColor: "#e0a530", fillOpacity: 0.32, className: "cov-area" }),
      onEachFeature: (f, layer) => {
        layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.5 }));
        layer.on("mouseout", () => layer.setStyle({ fillOpacity: 0.32 }));
      },
    }).addTo(map);
    // comprimento normalizado para a animação de "desenhar" o contorno
    areas.eachLayer((l) => l._path && l._path.setAttribute("pathLength", "1000"));
    L.geoJSON(geo, { style: () => ({ color: "#fff4cf", weight: 1.4, opacity: 0.9, fill: false, dashArray: "6 14", className: "cov-flow", interactive: false }) }).addTo(map);

    // Nomes dos municípios e cidades vizinhas
    const labels = [];
    Object.entries(CONFIG.mapaRotulos || {}).forEach(([nome, p], i) => {
      labels.push(L.marker(p, { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "cov-label", html: '<span style="--d:' + (0.6 + i * 0.25) + 's">' + nome + "</span>", iconSize: null }) }).addTo(map));
    });
    (CONFIG.mapaVizinhos || []).forEach(([nome, lat, lng]) =>
      L.marker([lat, lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: "cov-near", html: nome, iconSize: null }) }).addTo(map));

    const fit = (animate) => {
      const w = mapa.clientWidth;
      const opts = { paddingTopLeft: w < 420 ? [12, 64] : [24, 70], paddingBottomRight: w < 420 ? [12, 48] : [24, 40] };
      if (animate) map.flyToBounds(bounds, { ...opts, duration: 2.2 }); else map.fitBounds(bounds, opts);
    };
    // "voa" até a região quando o mapa aparece na tela
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () => { mapa.classList.add("cov--on"); fit(!reduce); };
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); start(); } }, { threshold: 0.35 });
      io.observe(mapa);
    } else start();
    let lastW = mapa.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(mapa.clientWidth - lastW) < 2) return;
      lastW = mapa.clientWidth; map.invalidateSize(); if (mapa.classList.contains("cov--on")) fit(false);
    }).observe(mapa);
  }
  if (CONFIG.horario) $$("[data-horario]").forEach((el) => (el.textContent = CONFIG.horario));

  // ---------- Janela do agendamento (abre/fecha) ----------
  const modal = $("#bk-modal");
  const gcalUrl = CONFIG.googleAgendamentoUrl;
  if (modal && gcalUrl) {
    // Usa a página de reservas do Google Agenda no lugar do formulário próprio
    $("#bk-gcal").hidden = false;
    $("#bk").hidden = true;
    $("#bk-gcal-link").href = gcalUrl.replace(/[?&]gv=true/, "");
    const sub = $(".bk-modal__head p", modal);
    if (sub) sub.textContent = "Escolha um horário livre. A reserva é confirmada na hora e você recebe o convite por e-mail.";
    modal.classList.add("bk-modal--gcal");
  }
  const loadGcal = () => {
    const frame = $(".bk-gcal__frame", modal);
    if (!gcalUrl || !frame || $("iframe", frame)) return;
    const f = document.createElement("iframe");
    f.src = gcalUrl; f.title = "Agenda de reservas GR Scan"; f.loading = "eager";
    f.addEventListener("load", () => frame.classList.add("is-loaded"));
    frame.append(f);
  };
  const openBooking = () => {
    if (!modal || modal.open) return;
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
    document.body.classList.add("modal-open");
    if (gcalUrl) loadGcal(); else document.dispatchEvent(new Event("bk:open"));
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
    // Aviso do deslocamento calculado (aparece no passo 3)
    const travel = document.createElement("p");
    travel.className = "bk__travel"; travel.hidden = true;
    dateInput.closest("fieldset").querySelector("legend").after(travel);

    let gMode = false, gKey = null, gReq = 0;
    const enterGoogleMode = () => {
      if (gMode) return;
      gMode = true;
      form.classList.add("is-google");
      dateInput.hidden = true; days.hidden = false;
      dateInput.closest(".field").classList.add("field--full");
      slots.closest(".field").classList.add("field--full");
      $("#bk-submit").textContent = "Reservar horário";
      const sub = $(".bk-modal__head p");
      if (sub) sub.textContent = "Os horários já consideram o tempo de deslocamento até a sua clínica e são reservados na hora.";
    };
    const addrKey = () => {
      const e = form.elements.endereco.value.trim(), c = form.elements.cidade.value.trim();
      return e.length >= 4 && c.length >= 2 ? e + "|" + c : "";
    };
    const loadAvailability = async (force) => {
      if (!CONFIG.endpointDisponibilidade || !location.protocol.startsWith("http")) return;
      const key = addrKey();
      if (!force && G && key === gKey && Date.now() - gLoadedAt < 60000) return;
      const req = ++gReq;
      let url = CONFIG.endpointDisponibilidade + "?t=" + Date.now();
      if (key) {
        url += "&endereco=" + encodeURIComponent(form.elements.endereco.value.trim()) + "&cidade=" + encodeURIComponent(form.elements.cidade.value.trim());
        if (gMode) {
          days.innerHTML = '<p class="bk__hint bk__loading">Calculando o deslocamento e os horários livres…</p>';
          slots.innerHTML = ""; travel.hidden = true;
        }
      }
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        if (req !== gReq) return; // chegou uma resposta mais nova
        if (!j.ok) return; // agenda não conectada: segue com as regras fixas
        enterGoogleMode();
        gKey = key; gLoadedAt = Date.now();
        if (j.precisa_endereco) {
          G = {}; travel.hidden = true; dateInput.value = "";
          days.innerHTML = '<p class="bk__hint">Preencha o <strong>endereço da clínica</strong> (passo 2) para ver os horários. ' +
            "O tempo de deslocamento é calculado automaticamente.</p>";
          slots.innerHTML = "";
          return;
        }
        G = j.dias || {};
        const d = j.deslocamento;
        if (d) {
          travel.innerHTML = "";
          const txt = document.createElement("span");
          txt.textContent = d.estimado
            ? "Deslocamento estimado desde " + (d.origem || "a base") + ": " + d.min + " min" + (d.km ? " (" + d.km + " km)" : "") +
              ". Os horários abaixo já consideram a ida e a volta." + (d.aproximado ? " Endereço localizado pela cidade; confira a rua e o número." : "")
            : "Não localizamos o endereço exato; consideramos " + d.min + " min de deslocamento.";
          travel.append(txt); travel.hidden = false;
        }
        renderDays();
      } catch (_) { /* mantém o modo atual */ }
    };
    document.addEventListener("bk:open", () => loadAvailability(false));
    // recalcula quando o endereço muda
    let addrTimer;
    ["endereco", "cidade"].forEach((n) => {
      const el = form.elements[n];
      const go = () => { clearTimeout(addrTimer); addrTimer = setTimeout(() => { if (gMode && addrKey() !== gKey) loadAvailability(true); }, 900); };
      el.addEventListener("input", go);
      el.addEventListener("change", go);
    });

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
