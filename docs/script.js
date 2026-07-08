// ============================================================
// Protocolo Hidra — Script de Ecossistema Vivo
// ============================================================
(function() {
  const BUILD_DATE = "2026-07-08";
  const BUILD_TIMESTAMP = "2026-07-08T18:35:39.249Z";
  const TOTAL_TERMS = 673;
  const GLOSSARIO_URL = "https://paulo-leads.github.io/protocolo-hidra/glossario.json";

  // Atualiza footer com timestamp
  document.addEventListener('DOMContentLoaded', function() {
    const footer = document.querySelector('footer');
    if (footer) {
      const meta = document.createElement('p');
      meta.style.cssText = 'font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem;';
      meta.textContent = '🔄 Ecossistema atualizado em ' + BUILD_DATE;
      footer.appendChild(meta);
    }

    // Badge "Verificado" nos cards
    document.querySelectorAll('.wv-card, .category-card, .step-card, .plan-card').forEach(card => {
      const badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;font-size:0.6rem;background:var(--accent);color:#fff;padding:2px 8px;border-radius:20px;margin-left:8px;';
      badge.textContent = '✓ ' + BUILD_DATE;
      const title = card.querySelector('h3');
      if (title) title.appendChild(badge);
    });

    // Carrega contagem do glossario.json
    fetch(GLOSSARIO_URL)
      .then(r => r.json())
      .then(data => {
        const statsEl = document.querySelector('.stats-strip .stats-grid');
        if (statsEl && data.terms) {
          const newStat = document.createElement('div');
          newStat.className = 'stat-item';
          newStat.innerHTML = '<strong>' + data.terms.length + '</strong><span>páginas indexadas</span>';
          statsEl.appendChild(newStat);
        }
      })
      .catch(() => {});
  });

  // Expõe metadados para crawlers
  window.__PROTOCOLO_HIDRA = {
    version: "2026.07.08",
    buildDate: BUILD_DATE,
    totalTerms: TOTAL_TERMS,
    glossarioUrl: GLOSSARIO_URL,
  };
})();
