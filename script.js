/* ============================================================
   CONFIGURAÇÃO — edite apenas este bloco
   ============================================================ */
const CONFIG = {
  // WhatsApp com DDI + DDD, só números. Ex.: "5581999999999"
  whatsapp: "",
  whatsappMessage: "Olá! Gostaria de solicitar um orçamento de escaneamento intraoral com a GR Scan.",
  email: "",       // Ex.: "contato@grscan.com.br" (aparece no rodapé)
  instagram: "",   // Ex.: "grscan"

  // Região atendida (aparece no texto e no mapa). Ex.: "Recife e Região Metropolitana"
  regiao: "",
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
  if (CONFIG.regiao) {
    $$("[data-regiao]").forEach((el) => (el.textContent = CONFIG.regiao));
    const mapa = $("#mapa");
    if (mapa) {
      mapa.innerHTML = '<iframe title="Mapa da região atendida" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' +
        encodeURIComponent(CONFIG.regiao) + '&z=11&output=embed"></iframe>';
    }
  }
  if (CONFIG.horario) $$("[data-horario]").forEach((el) => (el.textContent = CONFIG.horario));

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

    const dayOk = (s) => {
      if (!s || s < dateInput.min || s > dateInput.max) return false;
      if (A.datasBloqueadas.includes(s)) return false;
      return A.diasDaSemana.includes(new Date(s + "T12:00:00").getDay());
    };
    const diasTxt = () => {
      const n = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      return A.diasDaSemana.map((d) => n[d]).join(", ");
    };

    const slots = $("#slots");
    const renderSlots = () => {
      const s = dateInput.value;
      slots.classList.remove("is-invalid");
      if (!s) { slots.innerHTML = '<p class="bk__hint">Escolha uma data para ver os horários.</p>'; return; }
      if (!dayOk(s)) {
        slots.innerHTML = '<p class="bk__hint">Sem atendimento nesta data. Atendemos: ' + diasTxt() + '.</p>';
        return;
      }
      let html = "";
      for (let t = toMin(A.inicio); t <= toMin(A.fim); t += A.intervaloMinutos) {
        const h = pad(Math.floor(t / 60)) + ":" + pad(t % 60);
        html += '<label class="tslot"><input type="radio" name="hora" value="' + h + '"><span>' + h + "</span></label>";
      }
      slots.innerHTML = html;
    };
    dateInput.addEventListener("change", renderSlots);
    dateInput.addEventListener("input", renderSlots);

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

    const showDone = (d, sentByEmail) => {
      $("#bk-sum").innerHTML = summary(d).map(([k, v]) => {
        const li = document.createElement("li");
        li.innerHTML = "<strong></strong> ";
        li.firstChild.textContent = k + ":";
        li.append(v);
        return li.outerHTML;
      }).join("");
      const wa = $("#bk-wa");
      if (CONFIG.whatsapp) { wa.href = waLink(waText(d)); wa.hidden = false; }
      $("#bk-done-text").textContent = sentByEmail
        ? "Recebemos o seu pedido e enviamos uma cópia para " + d.email + ". Vamos confirmar o horário com você em breve."
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
      btn.disabled = true; btn.textContent = "Enviando…";
      let ok = false;
      if (CONFIG.endpointAgendamento && location.protocol.startsWith("http")) {
        try {
          const r = await fetch(CONFIG.endpointAgendamento, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
          });
          const j = await r.json().catch(() => ({}));
          ok = r.ok && j.ok;
        } catch (_) { ok = false; }
      }
      btn.disabled = false; btn.textContent = "Solicitar agendamento";
      if (ok) return showDone(d, true);
      if (CONFIG.whatsapp) {
        window.open(waLink(waText(d)), "_blank", "noopener");
        return showDone(d, false);
      }
      errorBox.textContent = "Não foi possível enviar agora. Tente novamente em instantes.";
    });

    $("#bk-new").addEventListener("click", () => {
      form.reset(); renderSlots();
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
