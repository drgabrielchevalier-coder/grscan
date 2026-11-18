/* ============================================================
   GR Scan — regras de cálculo do orçamento (espelho de app/calculo.php).
   Mesmos casos de teste nos dois lados: tests/orcamento-casos.json.
   Valores em centavos. Só mostra a prévia: o servidor recalcula ao enviar.
   ============================================================ */
(function (w) {
  "use strict";

  function inteiro(v) {
    if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) < 1e9 ? v : null;
    if (typeof v === "string" && /^-?\d{1,9}$/.test(v.trim())) return parseInt(v, 10);
    return null;
  }
  function porId(lista) { const m = {}; (lista || []).forEach(function (x) { m[x.id] = x; }); return m; }

  function calcular(cfg, pedido) {
    const erros = [], itens = [];
    const procs = porId(cfg.procedimentos), comps = porId(cfg.componentes), regs = porId(cfg.regioes);
    const limite = cfg.limite_pacientes || 30;
    let pacientes = pedido && pedido.pacientes;
    if (!Array.isArray(pacientes) || pacientes.length === 0) { erros.push("Adicione ao menos um paciente."); pacientes = []; }
    else if (pacientes.length > limite) { erros.push("Até " + limite + " pacientes por orçamento. Para mais, fale com a GR Scan."); pacientes = []; }
    const n = pacientes.length;

    let faixa = null;
    (cfg.faixas_desconto || []).slice().sort(function (a, b) { return a.min - b.min; })
      .forEach(function (f) { if (n >= f.min) faixa = f; });

    pacientes.forEach(function (p, i) {
      const num = i + 1;
      if (!p || typeof p !== "object") { erros.push("Paciente " + num + ": dados inválidos."); return; }
      const escolha = typeof p.procedimento === "string" ? p.procedimento : "";
      let proc = null, implantes = null, descricao = "";

      if (escolha === "implante" || (procs[escolha] && procs[escolha].implantes)) {
        const bruto = p.implantes !== undefined ? p.implantes : (escolha === "implante" ? null : procs[escolha].implantes.min);
        implantes = inteiro(bruto);
        if (implantes === null || implantes < 1 || implantes > 32) { erros.push("Paciente " + num + ": informe a quantidade de implantes (1 a 32)."); return; }
      }
      if (escolha === "implante") {
        for (const x of cfg.procedimentos || []) {
          const r = x.implantes;
          if (x.grupo === "implante" && x.disponivel !== false && r && implantes >= r.min && (r.max === null || implantes <= r.max)) { proc = x; break; }
        }
        descricao = (proc ? proc.nome : "Implantes") + " · " + implantes + (implantes === 1 ? " implante" : " implantes");
      } else if (procs[escolha] && procs[escolha].disponivel !== false) {
        proc = procs[escolha];
        descricao = proc.nome + (implantes !== null && implantes > 1 ? " · " + implantes + " implantes" : "");
      } else {
        erros.push("Paciente " + num + ": procedimento indisponível."); return;
      }

      if (!proc || proc.sob_avaliacao || proc.preco === null) {
        itens.push({ paciente: num, tipo: "escaneamento", id: proc ? proc.id : "implante", descricao: descricao, qtd: 1, unitario: null, total: null, preco_base: null, desconto: 0, sob_avaliacao: true });
      } else {
        const base = proc.preco;
        const unit = proc.desconto_volume && faixa ? Math.min(base, faixa.preco) : base;
        itens.push({ paciente: num, tipo: "escaneamento", id: proc.id, descricao: descricao, qtd: 1, unitario: unit, total: unit, preco_base: base, desconto: base - unit, sob_avaliacao: false });
      }

      [["transfer", "transfers"], ["tibase", "tibases"]].forEach(function (par) {
        const cid = par[0], campo = par[1];
        if (!(campo in p) || p[campo] === "" || p[campo] === null || p[campo] === undefined) return;
        const q = inteiro(p[campo]);
        if (q === null || q < 0) { erros.push("Paciente " + num + ": quantidade inválida de " + campo + "."); return; }
        if (q === 0) return;
        if (implantes === null) { erros.push("Paciente " + num + ": transfers e TiBases só para implantes."); return; }
        if (q > implantes) { erros.push("Paciente " + num + ": no máximo " + implantes + " " + campo + " (um por implante)."); return; }
        const c = comps[cid];
        if (!c || c.disponivel === false) { erros.push("Paciente " + num + ": componente indisponível."); return; }
        const sob = !!c.sob_avaliacao || c.preco === null;
        itens.push({ paciente: num, tipo: cid, id: cid, descricao: c.nome, qtd: q, unitario: sob ? null : c.preco, total: sob ? null : q * c.preco, preco_base: sob ? null : c.preco, desconto: 0, sob_avaliacao: sob });
      });
    });

    const regiaoId = pedido && typeof pedido.regiao === "string" ? pedido.regiao : "";
    let deslocamento = null;
    if (!regs[regiaoId]) erros.push("Escolha a região da clínica.");
    else {
      const r = regs[regiaoId], sob = !!r.sob_consulta || r.taxa === null;
      deslocamento = sob ? null : r.taxa;
      itens.push({ paciente: null, tipo: "deslocamento", id: r.id, descricao: "Deslocamento · " + r.nome, qtd: 1, unitario: deslocamento, total: deslocamento, preco_base: deslocamento, desconto: 0, sob_avaliacao: sob });
    }

    let subtotal = 0, pendente = false;
    itens.forEach(function (it) { if (it.total === null) pendente = true; else subtotal += it.total; });
    return {
      itens: itens, faixa: faixa ? { min: faixa.min, preco: faixa.preco } : null, pacientes: n,
      deslocamento: deslocamento, subtotal: subtotal, total: pendente ? null : subtotal, pendente: pendente, erros: erros,
    };
  }

  function formatarBRL(centavos) {
    const neg = centavos < 0, v = Math.abs(centavos);
    const reais = String(Math.floor(v / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (neg ? "-" : "") + "R$ " + reais + "," + String(v % 100).padStart(2, "0");
  }

  w.GRSCAN_CALC = { calcular: calcular, formatarBRL: formatarBRL };
})(typeof window !== "undefined" ? window : this);
