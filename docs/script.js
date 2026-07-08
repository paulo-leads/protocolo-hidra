// ============================================================
// Protocolo Hidra — Script de Ecossistema Vivo
// ============================================================
(function() {
  var BUILD_FULL = "2026-07-08 20:18:57";
  var BUILD_DATE = "2026-07-08";
  var BUILD_TIME = "20:18:57";
  var TOTAL_TERMS = 672;
  var GLOSSARIO_URL = "https://paulo-leads.github.io/protocolo-hidra/glossario.json";

  document.addEventListener('DOMContentLoaded', function() {
    var footer = document.querySelector('footer, .site-footer, .pre-footer');
    if (footer) {
      var metaInfo = document.createElement('p');
      metaInfo.style.cssText = 'font-size:0.7rem;color:var(--text-muted,#9fb8d6);margin-top:0.5rem;';
      metaInfo.textContent = '🔄 Ecossistema atualizado em ' + BUILD_FULL + ' | ' + TOTAL_TERMS + ' paginas indexadas';
      footer.appendChild(metaInfo);
    }

    fetch(GLOSSARIO_URL)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.totalTerms) {
          TOTAL_TERMS = data.totalTerms;
          var badges = document.querySelectorAll('[data-eco-count]');
          for (var i = 0; i < badges.length; i++) {
            badges[i].textContent = data.totalTerms + ' paginas';
          }
        }
      })
      .catch(function() {});

    var cards = document.querySelectorAll('[class*="card"], .signal, .tile, .step-card, .ex');
    for (var i = 0; i < cards.length; i++) {
      var badge = document.createElement('span');
      badge.style.cssText = 'display:inline-block;font-size:0.55rem;background:#3b82f6;color:#fff;padding:2px 7px;border-radius:20px;margin-left:8px;vertical-align:middle;';
      badge.textContent = BUILD_TIME;
      var title = cards[i].querySelector('h2, h3, strong');
      if (title) title.appendChild(badge);
    }

    var spintaxDiv = document.querySelector('[data-wikivendas-spintax]');
    if (spintaxDiv) {
      console.log('[Protocolo Hidra] Pagina verificada | Hash: ' + (spintaxDiv.getAttribute('data-hash') || 'N/A') + ' | Data: ' + (spintaxDiv.getAttribute('data-date') || BUILD_FULL));
    }
  });

  window.__PROTOCOLO_HIDRA = {
    version: "2026.07.08",
    buildDate: BUILD_DATE,
    buildTime: BUILD_TIME,
    buildFull: BUILD_FULL,
    totalTerms: TOTAL_TERMS,
    glossarioUrl: GLOSSARIO_URL,
  };
})();
