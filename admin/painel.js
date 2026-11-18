/* Painel GR Scan: confirmação antes de ações sensíveis (formulários com data-pergunta) */
document.querySelectorAll("form.confirmar").forEach(function (f) {
  f.addEventListener("submit", function (e) {
    var q = f.getAttribute("data-pergunta");
    if (q && !window.confirm(q)) e.preventDefault();
  });
});
