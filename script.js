// Versão do deploy: não editar à mão (ver CLAUDE.md)
var GRSCAN_VERSAO = "2.4";

/* ============================================================
   CONFIGURAÇÃO — edite apenas este bloco
   ============================================================ */
const CONFIG = {
  // WhatsApp com DDI + DDD, só números. Ex.: "5581999999999"
  whatsapp: "5521992114630",
  whatsappMessage: "Olá! Gostaria de solicitar um orçamento de escaneamento intraoral com a GR Scan.",
  email: "grscan@implantstore.com.br", // aparece no rodapé
  instagram: "",   // Ex.: "grscan"

  // Região atendida (aparece no texto)
  regiao: "Rio de Janeiro e Região Metropolitana",
  // Mapa de cobertura: os contornos dos municípios ficam em assets/municipios.geojson.
  // Aqui só a posição do nome de cada município e da base (ponto de partida).
  // Nomes sobre os municípios (vazio = sem nomes). Ex.: "Niterói": [-22.915, -43.065],
  mapaRotulos: {},
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
  // Recebe os pedidos de orçamento e envia por e-mail (configure em email-config.php)
  endpointOrcamento: "orcamento.php",
  endpointPrecos: "precos-publicos.php",
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
  // Sem o contato configurado: botões com data-fallback-label viram "Solicitar orçamento"
  // (abrem o formulário de orçamento); os demais ficam ocultos. Nenhum botão finge ser WhatsApp.
  const setLinks = (selector, href) => {
    $$(selector).forEach((a) => {
      if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; return; }
      const label = a.dataset.fallbackLabel;
      if (label && a.classList.contains("btn")) {
        a.href = "#orcamento"; a.setAttribute("data-open-quote", ""); a.textContent = label;
      } else { a.hidden = true; }
    });
  };
  setLinks("[data-whatsapp]", CONFIG.whatsapp && waLink(CONFIG.whatsappMessage));
  setLinks("[data-email]", CONFIG.email && "mailto:" + CONFIG.email);
  setLinks("[data-instagram]", CONFIG.instagram && "https://instagram.com/" + CONFIG.instagram);

  // ---------- Região, horário e mapa ----------
  if (CONFIG.regiao) $$("[data-regiao]").forEach((el) => (el.textContent = CONFIG.regiao));
  const mapa = $("#mapa");
  // Leaflet (cerca de 150 KB) e as imagens de satélite só carregam quando o mapa se aproxima da tela.
  // O CSS do Leaflet entra na camada "vendor", abaixo dos estilos do site.
  const loadLeaflet = () => {
    if (window.L) return Promise.resolve();
    const css = document.createElement("style");
    css.textContent = '@import url("assets/vendor/leaflet/leaflet.css") layer(vendor);';
    document.head.append(css);
    return new Promise((res, rej) => {
      const js = document.createElement("script");
      js.src = "assets/vendor/leaflet/leaflet.js"; js.onload = res; js.onerror = rej;
      document.head.append(js);
    });
  };
  const startMap = () => loadLeaflet().then(() => initCoverageMap(mapa)).catch((e) => console.warn("Mapa:", e));
  if (mapa) {
    if ("IntersectionObserver" in window) {
      const mio = new IntersectionObserver((es) => { if (es[0].isIntersecting) { mio.disconnect(); startMap(); } }, { rootMargin: "600px 0px" });
      mio.observe(mapa);
    } else startMap();
  }

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
      labels.push(L.marker([p[0], p[1]], { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "cov-label" + (p[2] === "sm" ? " cov-label--sm" : ""), html: '<span style="--d:' + (0.6 + i * 0.25) + 's">' + nome + "</span>", iconSize: null }) }).addTo(map));
    });
    (CONFIG.mapaVizinhos || []).forEach(([nome, lat, lng]) =>
      L.marker([lat, lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: "cov-near", html: nome, iconSize: null }) }).addTo(map));

    // etiquetas dos municípios pequenos só aparecem com zoom
    const zoomCls = () => mapa.classList.toggle("cov--zoom", map.getZoom() >= 11.5);
    map.on("zoomend", zoomCls);
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

  // ---------- Janela de orçamento (cálculo automático) ----------
  // Preços vêm de precos-publicos.php (tabela administrável no painel); a prévia usa
  // assets/orcamento-calculo.js e o servidor recalcula tudo ao enviar.
  // Link de convite (?r=<região>&origem=convite): guarda a origem nesta aba e limpa o endereço
  const linkConvite = (() => {
    const q = new URLSearchParams(location.search);
    const r = (q.get("r") || "").toLowerCase(), o = q.get("origem");
    if (!q.has("r") && !q.has("origem")) return { regiao: "" };
    if (o === "convite") { try { sessionStorage.setItem("grscan_origem", "convite"); } catch (_) { /* sem armazenamento: segue sem origem */ } }
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) { /* navegador antigo */ }
    return { regiao: /^[a-z_]{1,40}$/.test(r) ? r : "" };
  })();
  const origemVisita = () => { try { return sessionStorage.getItem("grscan_origem") === "convite" ? "convite" : ""; } catch (_) { return ""; } };

  const qModal = $("#qt-modal"), qForm = $("#qt");
  if (qModal && qForm) {
    const CALC = window.GRSCAN_CALC;
    const brl = (c) => CALC.formatarBRL(c);
    let tabela = null, carregando = null;

    const openQuote = (e) => {
      if (e) e.preventDefault();
      if (qModal.open) return;
      if (typeof qModal.showModal === "function") qModal.showModal(); else qModal.setAttribute("open", "");
      document.body.classList.add("modal-open");
      const box = $(".bk-modal__box", qModal); if (box) box.scrollTop = 0;
      carregarTabela();
    };
    const closeQuote = () => {
      if (typeof qModal.close === "function" && qModal.open) qModal.close(); else qModal.removeAttribute("open");
      document.body.classList.remove("modal-open");
    };
    qModal.addEventListener("close", () => document.body.classList.remove("modal-open"));
    qModal.addEventListener("click", (e) => { if (e.target === qModal) closeQuote(); });
    $$("[data-close-quote]").forEach((b) => b.addEventListener("click", closeQuote));
    $$("[data-open-quote]").forEach((b) => b.addEventListener("click", openQuote));
    if (location.hash === "#orcamento") setTimeout(openQuote, 400);

    // Odontograma: clicar nos dentes preenche o campo
    const dentes = qForm.elements.dentes, elementos = qForm.elements.elementos;
    const syncTeeth = () => {
      const sel = $$(".tooth[aria-pressed=true]", qForm).map((b) => b.dataset.t);
      dentes.value = sel.join(", ");
      elementos.value = sel.length || "";
    };
    $$(".tooth", qForm).forEach((b) => b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      syncTeeth();
    }));
    const hoje = new Date(); hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
    qForm.elements.data_desejada.min = hoje.toISOString().slice(0, 10);

    const status = $("#qt-status"), falha = $("#qt-falha"), conteudo = $("#qt-conteudo");
    const lista = $("#qt-pacientes"), tpl = $("#qt-tpl-paciente"), regiao = $("#qt-regiao");
    const qErr = $("#qt-error"), totalEl = $("#qt-total"), resumo = $("#qt-resumo"), descontoEl = $("#qt-desconto");

    const carregarTabela = () => {
      if (tabela || carregando) return carregando;
      status.hidden = false; falha.hidden = true; conteudo.hidden = true;
      carregando = fetch(CONFIG.endpointPrecos, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((j) => {
          if (!j || !j.ok) throw new Error("tabela");
          tabela = j;
          const t = Date.parse(j.agora); difServidor = isNaN(t) ? 0 : t - Date.now();
          montar();
          if (linkConvite.regiao && j.regioes.some((x) => x.id === linkConvite.regiao)) { regiao.value = linkConvite.regiao; atualizar(); }
          status.hidden = true; conteudo.hidden = false; iniciarOferta();
        })
        .catch(() => { status.hidden = true; falha.hidden = false; })
        .finally(() => { carregando = null; });
      return carregando;
    };
    $("#qt-recarregar").addEventListener("click", carregarTabela);

    // Oferta de deslocamento grátis: prazo real definido no painel, contado pela hora do servidor
    let difServidor = 0, relogioOferta = 0;
    const agoraServidor = () => Date.now() + difServidor;
    const ofertaEl = $("#qt-oferta"), ofertaTempo = $("#qt-oferta-tempo");
    const ofertaAberta = () => !!(tabela && CALC.ofertaAtiva(tabela, agoraServidor()));
    const doisDig = (n) => String(n).padStart(2, "0");
    const tickOferta = () => {
      const fim = ofertaAberta() ? Date.parse(tabela.promocao_deslocamento.fim) : 0;
      const resta = fim - agoraServidor();
      if (resta <= 0) {
        clearInterval(relogioOferta); relogioOferta = 0;
        if (tabela) tabela.promocao_deslocamento = null;
        ofertaEl.hidden = true; montarRegioes(); atualizar();
        return;
      }
      const s = Math.floor(resta / 1000);
      ofertaTempo.textContent = doisDig(Math.floor(s / 3600)) + ":" + doisDig(Math.floor(s / 60) % 60) + ":" + doisDig(s % 60);
    };
    const iniciarOferta = () => {
      clearInterval(relogioOferta); relogioOferta = 0;
      ofertaEl.hidden = !ofertaAberta();
      if (!ofertaEl.hidden) { tickOferta(); relogioOferta = setInterval(tickOferta, 1000); }
    };

    const procPorId = (id) => tabela.procedimentos.find((p) => p.id === id);
    const temComp = (id) => tabela.componentes.some((c) => c.id === id);
    const usaImplantes = (valor) => valor === "implante" || !!(procPorId(valor) && procPorId(valor).implantes);

    const opcoesProcedimento = () => {
      const ops = []; let implanteIncluido = false;
      tabela.procedimentos.forEach((p) => {
        if (p.grupo === "implante") {
          if (!implanteIncluido) { ops.push(["implante", "Implante(s)"]); implanteIncluido = true; }
          return;
        }
        ops.push([p.id, p.nome + (p.sob_avaliacao || p.preco === null ? " · sob avaliação" : "")]);
      });
      return ops;
    };

    function montarRegioes() {
      const sel = regiao.value;
      regiao.length = 1;
      tabela.regioes.forEach((r) => {
        const o = document.createElement("option");
        o.value = r.id;
        o.textContent = r.nome + (r.sob_consulta || r.taxa === null ? " · sob consulta" : "");
        regiao.append(o);
      });
      regiao.value = sel;
    }
    const montar = () => {
      montarRegioes();
      const faixas = tabela.faixas_desconto.slice().sort((a, b) => a.min - b.min);
      const txt = faixas.map((f, i) => {
        const prox = faixas[i + 1];
        const qtd = !prox ? f.min + " ou mais pacientes" : prox.min - 1 > f.min ? f.min + " a " + (prox.min - 1) + " pacientes" : f.min + (f.min > 1 ? " pacientes" : " paciente");
        return qtd + ": " + brl(f.preco);
      });
      $("#qt-faixas").textContent = faixas.length ? "Valor clínica por escaneamento convencional, conforme o total de pacientes da visita: 1 paciente: preço da tabela · " + txt.join(" · ") + "." : "";
      lista.innerHTML = "";
      adicionarPaciente();
    };

    const renumerar = () => {
      $$(".qt-paciente", lista).forEach((el, i) => {
        $(".qt-paciente__n", el).textContent = "Paciente " + (i + 1);
        const rm = $(".qt-remover", el);
        rm.setAttribute("aria-label", "Remover paciente " + (i + 1));
        rm.hidden = lista.children.length === 1;
      });
      $("#qt-add").hidden = lista.children.length >= tabela.limite_pacientes;
    };

    const ajustarPaciente = (el) => {
      const sel = $("[data-campo=procedimento]", el), imp = $("[data-campo=implantes]", el);
      const ehImp = usaImplantes(sel.value);
      $$(".qt-imp", el).forEach((l) => { l.hidden = !ehImp || (l.dataset.comp && !temComp(l.dataset.comp)); });
      const max = Math.max(1, Math.min(32, parseInt(imp.value, 10) || 1));
      $$(".qt-comp input", el).forEach((inp) => {
        if (!ehImp) inp.value = "0";
        inp.max = String(max);
        if ((parseInt(inp.value, 10) || 0) > max) inp.value = String(max);
      });
      if (!ehImp) imp.value = "1";
    };

    const adicionarPaciente = () => {
      const el = tpl.content.firstElementChild.cloneNode(true);
      const sel = $("[data-campo=procedimento]", el);
      opcoesProcedimento().forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o); });
      lista.append(el);
      ajustarPaciente(el); renumerar(); atualizar();
      return el;
    };
    $("#qt-add").addEventListener("click", () => { const el = adicionarPaciente(); $("select", el).focus(); });
    lista.addEventListener("click", (e) => {
      const rm = e.target.closest(".qt-remover"); if (!rm) return;
      rm.closest(".qt-paciente").remove(); renumerar(); atualizar();
      $("#qt-add").focus();
    });
    lista.addEventListener("change", (e) => { const p = e.target.closest(".qt-paciente"); if (p) ajustarPaciente(p); atualizar(); });
    lista.addEventListener("input", (e) => { const p = e.target.closest(".qt-paciente"); if (p && e.target.dataset.campo === "implantes") ajustarPaciente(p); atualizar(); });
    regiao.addEventListener("change", atualizar);

    const pedido = () => ({
      regiao: regiao.value,
      pacientes: $$(".qt-paciente", lista).map((el) => {
        const v = $("[data-campo=procedimento]", el).value, p = { procedimento: v };
        if (usaImplantes(v)) {
          p.implantes = $("[data-campo=implantes]", el).value;
          if (temComp("transfer")) p.transfers = $("[data-campo=transfers]", el).value;
          if (temComp("tibase")) p.tibases = $("[data-campo=tibases]", el).value;
        }
        return p;
      }),
    });

    let ultimo = null;
    function atualizar() {
      if (!tabela) return;
      qErr.textContent = "";
      const calc = CALC.calcular(tabela, pedido(), agoraServidor());
      ultimo = calc;
      const semRegiao = !regiao.value;
      const errosReais = calc.erros.filter((m) => !(semRegiao && /região/.test(m)));
      resumo.innerHTML = "";
      const ul = document.createElement("ul"); ul.className = "qt-itens";
      calc.itens.forEach((it) => {
        const li = document.createElement("li");
        if (it.tipo === "deslocamento") li.className = "qt-item--desloc";
        const q = document.createElement("span"); q.className = "qt-item__quem";
        q.textContent = it.paciente ? "Paciente " + it.paciente : "";
        const d = document.createElement("span"); d.className = "qt-item__desc";
        d.textContent = it.descricao + (it.qtd > 1 ? " × " + it.qtd : "");
        const v = document.createElement("span"); v.className = "qt-item__valor";
        v.textContent = it.total === null ? (it.tipo === "deslocamento" ? "sob consulta" : "sob avaliação") : it.total === 0 && it.tipo === "deslocamento" ? "grátis" : brl(it.total);
        if (it.promocao) {
          const s = document.createElement("s"), g = document.createElement("b");
          s.textContent = brl(it.preco_base); g.className = "qt-gratis"; g.textContent = "GRÁTIS";
          v.textContent = ""; v.append(s, " ", g);
        } else if (it.desconto > 0) { const s = document.createElement("s"); s.textContent = brl(it.preco_base * it.qtd); v.prepend(s, " "); }
        li.append(q, d, v); ul.append(li);
      });
      // Linha final, como no e-mail: Total (ou Subtotal quando algo depende de confirmação)
      if (calc.itens.length && !errosReais.length) {
        const li = document.createElement("li"); li.className = "qt-item--total";
        const q = document.createElement("span"); q.className = "qt-item__quem";
        const d = document.createElement("span"); d.className = "qt-item__desc";
        const v = document.createElement("span"); v.className = "qt-item__valor";
        const parcial = semRegiao || calc.pendente;
        d.textContent = parcial ? "Subtotal" : "Total";
        if (parcial) { const n = document.createElement("small"); n.textContent = semRegiao ? "escolha a região para incluir o deslocamento" : "total sob confirmação da GR Scan"; d.append(n); }
        v.textContent = brl(parcial ? calc.subtotal : calc.total);
        li.append(q, d, v); ul.append(li);
      }
      if (calc.itens.length) resumo.append(ul);
      if (errosReais.length) { const p = document.createElement("p"); p.className = "qt-resumo__erro"; p.textContent = errosReais[0]; resumo.append(p); }
      const comDesconto = calc.faixa ? calc.itens.filter((i) => i.desconto > 0 && !i.promocao).length : 0;
      descontoEl.hidden = !comDesconto;
      if (comDesconto) descontoEl.textContent = "Desconto clínica: " + calc.pacientes + " pacientes na mesma visita → " + brl(calc.faixa.preco) + " por escaneamento elegível.";
      if (errosReais.length) totalEl.innerHTML = "<span>Total</span> <b>—</b>";
      else if (semRegiao) totalEl.innerHTML = "<span>Subtotal</span> <b>" + brl(calc.subtotal) + "</b> <small>escolha a região para incluir o deslocamento</small>";
      else if (calc.pendente) totalEl.innerHTML = "<span>Subtotal</span> <b>" + brl(calc.subtotal) + "</b> <small>total sob confirmação da GR Scan</small>";
      else totalEl.innerHTML = "<span>Total</span> <b>" + brl(calc.total) + "</b>";
    }

    const textoWhatsApp = () => {
      const c = ultimo, f = qForm.elements;
      let t = "Olá! Orçamento de escaneamento intraoral GR Scan:\n\n";
      c.itens.forEach((it) => {
        t += "• " + (it.paciente ? "Paciente " + it.paciente + ": " : "") + it.descricao + (it.qtd > 1 ? " × " + it.qtd : "") + " — " +
          (it.promocao ? "grátis (oferta, de " + brl(it.preco_base) + ")" : it.total === null ? "sob consulta" : it.total === 0 && it.tipo === "deslocamento" ? "grátis" : brl(it.total)) + "\n";
      });
      t += c.pendente || !regiao.value ? "\n*Subtotal: " + brl(c.subtotal) + "* (total sob confirmação)\n" : "\n*Total: " + brl(c.total) + "*\n";
      if (f.dentes.value) t += "Dentes: " + f.dentes.value + "\n";
      if (f.nome.value.trim()) t += "\nDentista: " + f.nome.value.trim() + (f.clinica.value.trim() ? " — " + f.clinica.value.trim() : "");
      t += "\n\nValores sujeitos à confirmação da disponibilidade, da compatibilidade dos componentes e da viabilidade técnica.";
      return t;
    };
    $("#qt-whatsapp").addEventListener("click", () => {
      if (!ultimo || !ultimo.itens.length) return;
      const url = CONFIG.whatsapp ? waLink(textoWhatsApp()) : "https://wa.me/?text=" + encodeURIComponent(textoWhatsApp());
      window.open(url, "_blank", "noopener");
    });

    qForm.addEventListener("input", (e) => {
      const f = e.target.closest(".field"); if (f) f.classList.remove("is-invalid");
    });
    const qFail = (el, msg) => {
      (el.closest(".field") || el.closest("label") || el).classList.add("is-invalid");
      qErr.textContent = msg;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el.focus) el.focus({ preventScroll: true });
      return false;
    };
    const qValidate = () => {
      const f = qForm.elements;
      if (!regiao.value) return qFail(regiao, "Escolha a região da clínica.");
      const c = CALC.calcular(tabela, pedido(), agoraServidor());
      if (c.erros.length) return qFail($("#qt-pacientes"), c.erros[0]);
      if (!f.nome.value.trim()) return qFail(f.nome, "Informe o nome do dentista responsável.");
      if (f.telefone.value.replace(/\D/g, "").length < 10) return qFail(f.telefone, "Informe um WhatsApp com DDD.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim())) return qFail(f.email, "Informe um e-mail válido.");
      if (!f.aceite_privacidade.checked) return qFail(f.aceite_privacidade, "Confirme o uso dos dados para responder ao orçamento.");
      return true;
    };

    let enviando = false;
    qForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (enviando || !tabela) return;
      qErr.textContent = "";
      if (!qValidate()) return;
      const f = qForm.elements;
      const d = Object.assign(pedido(), {
        dentes: f.dentes.value.trim(), elementos: f.elementos.value.trim(), data_desejada: f.data_desejada.value, obs: f.obs.value.trim(),
        nome: f.nome.value.trim(), clinica: f.clinica.value.trim(), cro: f.cro.value.trim(), telefone: f.telefone.value.trim(),
        email: f.email.value.trim(), preferencia: f.preferencia.value, aceite_privacidade: f.aceite_privacidade.checked, website: f.website.value,
        origem: origemVisita(),
      });
      const btn = $("#qt-submit"), label = btn.textContent;
      enviando = true; btn.disabled = true; btn.textContent = "Enviando…";
      let ok = false, j = {};
      try {
        const r = await fetch(CONFIG.endpointOrcamento, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
        j = await r.json().catch(() => ({})); ok = r.ok && j.ok;
      } catch (_) { ok = false; }
      enviando = false; btn.disabled = false; btn.textContent = label;
      if (ok) {
        $("#qt-numero").textContent = (j.numero ? "Orçamento " + j.numero + " · " : "") +
          (j.pendente ? "subtotal " + brl(j.subtotal) + " (total sob confirmação)" : "total " + brl(j.total));
        $("#qt-done-text").textContent = "Enviamos uma cópia para " + d.email + ". A GR Scan confirma disponibilidade e responde por " + d.preferencia + ".";
        qForm.hidden = true; $("#qt-done").hidden = false; $(".bk-modal__box", qModal).scrollTop = 0;
        return;
      }
      qErr.textContent = j.message || "Não foi possível enviar agora. Tente novamente em instantes ou compartilhe pelo WhatsApp.";
    });
  }

  // ---------- Spotlight (adaptado do componente "Spotlight" do 21st.dev) ----------
  // Luz dourada que segue o cursor dentro do card e acende a borda mais próxima.
  // Só atualiza duas variáveis CSS por quadro; em telas de toque fica desligado.
  $$(".bk-launch, [data-spotlight]").forEach((el) => {
    el.setAttribute("data-spotlight", "");
    el.insertAdjacentHTML("afterbegin", '<span class="spot-light" aria-hidden="true"></span><span class="spot-ring" aria-hidden="true"></span>');
    let raf = 0;
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--spot-x", clientX - r.left + "px");
        el.style.setProperty("--spot-y", clientY - r.top + "px");
      });
    });
  });

  // ---------- Cabeçalho, ano e animações ----------
  document.getElementById("ano").textContent = new Date().getFullYear();
  const header = $(".header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu (celular e tablet)
  const toggle = $(".nav-toggle");
  const setMenu = (open) => {
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    header.classList.toggle("is-menu-open", open);
    document.body.classList.toggle("menu-open", open);
  };
  if (toggle) {
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("#menu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && header.classList.contains("is-menu-open")) { setMenu(false); toggle.focus(); } });
    const wide = matchMedia("(min-width: 1081px)");
    if (wide.addEventListener) wide.addEventListener("change", (m) => { if (m.matches) setMenu(false); });
  }
  // Marca no menu a seção visível
  const navLinks = $$('.nav__list a[href^="#"]');
  if ("IntersectionObserver" in window && navLinks.length) {
    const byId = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));
    const sio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const a = byId.get(e.target.id);
        if (a && e.isIntersecting) { navLinks.forEach((l) => l.removeAttribute("aria-current")); a.setAttribute("aria-current", "true"); }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    byId.forEach((_, id) => { const sec = document.getElementById(id); if (sec) sio.observe(sec); });
  }

  // Cena 3D de escaneamento (Three.js) só carrega quando se aproxima da tela
  const scan = $("#scanscene");
  if (scan) {
    const loadScene = () => import("./assets/cena-escaneamento.js").catch((e) => { console.warn("Cena 3D indisponível:", e); scan.classList.add("is-fallback"); });
    if ("IntersectionObserver" in window) {
      const tio = new IntersectionObserver((es) => { if (es[0].isIntersecting) { tio.disconnect(); loadScene(); } }, { rootMargin: "500px 0px" });
      tio.observe(scan);
    } else loadScene();
  }

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
