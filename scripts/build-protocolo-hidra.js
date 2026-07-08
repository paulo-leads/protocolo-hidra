import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ============================================================
// CONFIGURACAO
// ============================================================
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BASE_PATH = "/protocolo-hidra/";
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];
const BUILD_TIME = BUILD_TIMESTAMP.split("T")[1].split(".")[0]; // HH:MM:SS

// ============================================================
// SPINTAX
// ============================================================
const SPINTAX = [
  "Segundo {Steve Jobs}, {a inovacao} {distingue um lider de um seguidor|e o que separa quem lidera de quem segue}.",
  "Como diria {Peter Drucker}, {o melhor jeito de prever o futuro e cria-lo|nao se gerencia o que nao se mede}.",
  "{Jeff Bezos} ensina que {sua marca e o que as pessoas dizem sobre voce quando voce nao esta na sala|o cliente e o centro do universo}.",
  "{Elon Musk} repete que {se algo e importante o suficiente, voce tenta mesmo que as probabilidades nao estejam a seu favor|e preciso inovar na velocidade da luz}.",
  "{Warren Buffett} diz que {o risco vem de nao saber o que voce esta fazendo|a melhor coisa que voce pode fazer por si mesmo e investir em conhecimento}.",
  "{Paulo Leads} reforca que {dado sem contexto e apenas ruido — hidrize antes de agir|a prospeccao nao e sobre quantidade, e sobre densidade de oportunidade}.",
  "{Seth Godin} afirma que {o mercado mudou — agora as pessoas compram de quem confiam, nao de quem grita mais alto|entregue um ativo, nao um discurso}.",
  "{Gary Vaynerchuk} prega que {o conteudo e rei, mas o contexto e Deus|a paciencia e o novo diferencial competitivo}.",
  "{Bill Gates} lembra que {a tecnologia e apenas uma ferramenta — o que realmente importa e o que voce faz com ela|medir e o primeiro passo para melhorar}.",
  "{Tony Robbins} ensina que {a qualidade da sua pergunta determina a qualidade da sua resposta|se voce quer mudar seus resultados, mude seus padroes}.",
  "{Rafael Kogut} diz que {vender e transferir conviccao — sem conviccao, nao ha venda|a objeccao nao e um nao, e um pedido de mais informacao}.",
  "{Roberto Shinyashiki} afirma que {o sucesso nao tem a ver com o que voce conquista, mas com quem voce se torna|a coragem e a primeira das virtudes humanas}.",
  "{Flavio Augusto} ensina que {o brasileiro nao e empreendedor por opcao, e por necessidade — e isso nos torna mais resilientes|seu maior ativo e sua capacidade de aprender}.",
  "{Luiz Gaziri} reforca que {o mercado B2B brasileiro e movido a relacionamento, nao a trafego — e relacionamento se constroi com dado, nao com volume}.",
  "{Sun Tzu} diria que {conhece-te a ti mesmo e conhece teu concorrente, e mil batalhas serao vencidas|a melhor vitoria e vencer sem lutar — ou seja, com dados superiores}.",
];

function randomSpintax() {
  return SPINTAX[Math.floor(Math.random() * SPINTAX.length)];
}

function processSpintax(text) {
  return text.replace(/\{([^}]+)\}/g, (_match, group) => {
    const options = group.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });
}

// ============================================================
// SCAN LINKS
// ============================================================
function scanLinks(dir = "docs", basePath = BASE_PATH) {
  const links = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      links.push(...scanLinks(fullPath, basePath));
    } else if (entry.name === "index.html") {
      const relative = path.relative("docs", fullPath);
      links.push(relative);
    }
  }
  return links.sort();
}

// ============================================================
// HELPERS
// ============================================================
function linkToName(link) {
  return link
    .replace(/\/index\.html$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/ De /g, " de ")
    .replace(/ Da /g, " da ")
    .replace(/ Do /g, " do ")
    .replace(/ Em /g, " em ")
    .replace(/ E /g, " e ");
}

function linkToSlug(link) {
  return link.replace(/\/index\.html$/, "");
}

function linkToUrl(link) {
  return `${SITE_URL}/${linkToSlug(link)}/`;
}

function categorizeLink(link) {
  if (/^consulta-|^cartao-cnpj|^certidao|^dados-cadastrais|^redesim|^situacao-cadastral|^consultar-/.test(link)) return "Ferramentas de Consulta";
  if (/^empresas-em-/.test(link)) return "Listas por Cidade";
  if (/^empresas-no-|^empresas-na-/.test(link)) return "Listas por Estado";
  if (/^lista-de-/.test(link)) return "Listas por Nicho / Segmento";
  if (/^como-|^prospeccao-|^prospectar-|^script-|^modelo-|^texto-|^cadencia-|^captacao-|^funil-|^maquina-|^playbook-|^pitch-|^sdr-|^outbound-|^vendas-b2b|^b2b-|^mercado-b2b|^geracao-|^gerador-|^gerar-|^lead-|^leads-|^icp-|^econodata-|^alternativa-|^melhor-|^ferramenta-|^nichos-|^quantas-|^vitor-azevedo/.test(link)) return "Guias e Playbooks";
  if (/^leadjet-vs-|^comparativos/.test(link)) return "Comparativos";
  return "Outros";
}

// ============================================================
// EXTRACTOR
// ============================================================
function extractMetaFromHtml(html, link) {
  const meta = {
    title: "",
    description: "",
    datePublished: "",
    dateModified: "",
    author: "",
    authorUrl: "",
    image: "",
    sameAs: [],
    keywords: [],
    breadcrumbs: [],
    faqCount: 0,
    wordCount: 0,
    hasDataset: false,
  };

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) meta.description = descMatch[1].trim();

  const dpMatch = html.match(/"datePublished":"([^"]+)"/);
  if (dpMatch) meta.datePublished = dpMatch[1];

  const dmMatch = html.match(/"dateModified":"([^"]+)"/);
  if (dmMatch) meta.dateModified = dmMatch[1];

  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) meta.author = authorMatch[1];
  const authorUrlMatch = html.match(/"author"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  if (authorUrlMatch) meta.authorUrl = authorUrlMatch[1];

  const imgMatch = html.match(/"image":"([^"]+)"/);
  if (imgMatch) meta.image = imgMatch[1];
  const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImgMatch && !meta.image) meta.image = ogImgMatch[1];

  const sameAsSection = html.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
  if (sameAsSection) {
    meta.sameAs = sameAsSection[1]
      .split(",")
      .map((s) => s.replace(/["'\s]/g, ""))
      .filter(Boolean);
  }

  const kwMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
  if (kwMatch) meta.keywords = kwMatch[1].split(",").map((s) => s.trim());

  const bcMatches = html.matchAll(/"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/g);
  for (const bc of bcMatches) {
    meta.breadcrumbs.push(bc[1]);
  }

  const faqMatches = html.match(/"@type":"Question"/g);
  if (faqMatches) meta.faqCount = faqMatches.length;

  meta.hasDataset = html.includes('"@type":"Dataset"');

  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  meta.wordCount = textContent.split(" ").length;

  return meta;
}

// ============================================================
// MAIN
// ============================================================
const allLinks = (() => {
  try {
    return scanLinks();
  } catch {
    console.error("Erro ao escanear links. Usando fallback.");
    return ["index.html", "lista-de-empresas-de-logistica/index.html", "lista-de-transportadoras/index.html"];
  }
})();

console.log(`\n📡 Escaneadas ${allLinks.length} paginas`);

// ============================================================
// 1. CONSTRUIR TERMOS
// ============================================================
console.log("\n📖 Extraindo metadados de cada pagina...");

const terms = allLinks.map((link, index) => {
  const filePath = `docs/${link}`;
  let html = "";
  let meta = {
    title: "",
    description: "",
    datePublished: "",
    dateModified: "",
    author: "",
    authorUrl: "",
    image: "",
    sameAs: [],
    keywords: [],
    breadcrumbs: [],
    faqCount: 0,
    wordCount: 0,
    hasDataset: false,
  };

  try {
    html = readFileSync(filePath, "utf8");
    meta = extractMetaFromHtml(html, link);
  } catch {
    console.warn(`  ⚠️ Nao foi possivel ler ${link}, usando dados minimos`);
  }

  const name = meta.title || linkToName(link);
  const url = linkToUrl(link);
  const category = categorizeLink(link);

  // Hash inclui BUILD_TIMESTAMP completo (com hora, minuto, segundo)
  const contentHash = createHash("sha256")
    .update(name + url + BUILD_TIMESTAMP)
    .digest("hex");

  const rawQuote = processSpintax(randomSpintax());
  const businessPhrase = `${name}: ${rawQuote}`;

  return {
    id: linkToSlug(link),
    name,
    url,
    category,
    index: index + 1,
    description: meta.description || "",
    contentHash,
    lastModified: meta.dateModified || BUILD_DATE,
    lastModifiedFull: BUILD_TIMESTAMP.replace("T", " ").split(".")[0], // "2026-07-08 HH:MM:SS"
    datePublished: meta.datePublished || BUILD_DATE,
    author: meta.author || "Paulo C. P. Santos",
    authorUrl: meta.authorUrl || `${SITE_URL}/paulo-leads/`,
    image: meta.image || `${SITE_URL}/assets/img/protocolo-hidra-painel-1200.png`,
    wordCount: meta.wordCount,
    faqCount: meta.faqCount,
    hasDataset: meta.hasDataset,
    keywords: meta.keywords,
    breadcrumbs: meta.breadcrumbs,
    businessPhrase,
    sameAs: meta.sameAs,
    inDefinedTermSet: "urn:protocolo-hidra:2026",
  };
});

const dateModified = BUILD_DATE;
const fullTimestamp = BUILD_TIMESTAMP.replace("T", " ").split(".")[0]; // "2026-07-08 HH:MM:SS"

mkdirSync("docs", { recursive: true });

// ============================================================
// 2. GLOSSARIO.JSON
// ============================================================
const glossario = {
  "@context": ["https://schema.org", { "skos": "http://www.w3.org/2004/02/skos/core#", "proof": "https://w3id.org/security#" }],
  "@type": "DataCatalog",
  "@id": "urn:protocolo-hidra:catalog:2026",
  name: "Protocolo Hidra — Diretorio B2B",
  description: "Diretorio completo de listas empresariais, ferramentas de consulta, guias de prospeccao e comparativos do ecossistema Paulo Leads.",
  inLanguage: "pt-BR",
  dateCreated: "2026-06-30",
  dateModified,
  lastBuild: fullTimestamp,
  version: BUILD_DATE.replace(/-/g, "."),
  totalTerms: terms.length,
  publisher: {
    "@type": "Organization",
    name: "Protocolo Hidra",
    url: SITE_URL,
    founder: { "@type": "Person", name: "Paulo C. P. Santos", url: `${SITE_URL}/paulo-leads/` },
  },
  proof: {
    type: "Sha256Hash",
    hash: createHash("sha256").update(JSON.stringify(terms)).digest("hex"),
    timestamp: BUILD_TIMESTAMP,
  },
  categoryBreakdown: (() => {
    const cats = {};
    terms.forEach((t) => { if (!cats[t.category]) cats[t.category] = 0; cats[t.category]++; });
    return cats;
  })(),
  terms,
};

writeFileSync("docs/glossario.json", JSON.stringify(glossario, null, 2), "utf8");
console.log(`✅ glossario.json gerado com ${terms.length} termos`);

// ============================================================
// 3. SITEMAP (COM HORARIO COMPLETO)
// ============================================================
const sitemapEntries = [];
sitemapEntries.push({ url: `${SITE_URL}/`, priority: "1.0", changefreq: "daily", lastmod: fullTimestamp });

const categories = {};
terms.forEach((t) => {
  if (!categories[t.category]) categories[t.category] = [];
  categories[t.category].push(t);
});
Object.keys(categories).forEach((cat) => {
  sitemapEntries.push({
    url: `${SITE_URL}/#${cat.toLowerCase().replace(/\s+/g, "-")}`,
    priority: "0.9",
    changefreq: "daily",
    lastmod: fullTimestamp,
  });
});

sitemapEntries.push(
  { url: `${SITE_URL}/glossario.json`, priority: "0.9", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/sitemap.xml`, priority: "0.7", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/llms.txt`, priority: "0.8", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/script.js`, priority: "0.6", changefreq: "daily", lastmod: fullTimestamp },
);

terms.forEach((t) => {
  const priority = t.index <= 10 ? "0.8" : t.index <= 50 ? "0.7" : t.index <= 200 ? "0.6" : "0.5";
  sitemapEntries.push({
    url: t.url,
    priority,
    changefreq: "weekly",
    lastmod: t.lastModifiedFull || fullTimestamp,
  });
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

writeFileSync("docs/sitemap.xml", sitemapXml, "utf8");
console.log(`✅ sitemap.xml gerado com ${sitemapEntries.length} URLs (todos com horario completo)`);

// ============================================================
// 4. ROBOTS.TXT
// ============================================================
const robots = `# ============================================================
# Protocolo Hidra — Diretorio B2B
# Ultimo build: ${fullTimestamp}
# ============================================================

User-agent: *
Allow: /
Allow: /glossario.json
Allow: /llms.txt
Allow: /script.js
Allow: /sitemap.xml
Disallow: /node_modules/
Sitemap: ${SITE_URL}/sitemap.xml

# === Crawlers de IA (LLMs) ===

User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Bingbot
Allow: /
User-agent: Microsoftbot
Allow: /
User-agent: BingPreview
Allow: /
User-agent: adidxbot
Allow: /
User-agent: Msnbot
Allow: /
User-agent: BingUACrawler
Allow: /
User-agent: Anthropic-ai
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: CCBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Meta-ExternalAgent
Allow: /
User-agent: FacebookBot
Allow: /
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: AlexaBot
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: DuckDuckBot
Allow: /
User-agent: DuckDuckGo-Favicons-Bot
Allow: /
User-agent: YandexBot
Allow: /
User-agent: YandexImages
Allow: /
User-agent: Baiduspider
Allow: /
User-agent: SemanticScholarBot
Allow: /
User-agent: omgili
Allow: /
User-agent: omgilibot
Allow: /
User-agent: Bytespider
Allow: /
`;

writeFileSync("docs/robots.txt", robots, "utf8");
console.log("✅ robots.txt gerado");

// ============================================================
// 5. LLMS.TXT
// ============================================================
const llmsLines = [
  `# Protocolo Hidra — Diretorio B2B`,
  `> Canonical-Source: ${SITE_URL}`,
  `> Language: pt-BR`,
  `> Last-Modified: ${fullTimestamp}`,
  `> Total Pages: ${terms.length}`,
  `> API JSON: ${SITE_URL}/glossario.json`,
  `> License: CC BY 4.0`,
  ``,
  `# Categorias`,
  ``,
];

Object.entries(categories).forEach(([cat, catTerms]) => {
  llmsLines.push(`## ${cat} (${catTerms.length} paginas)`);
  catTerms.slice(0, 20).forEach((t) => {
    llmsLines.push(`- ${t.name}: ${t.url} (importancia: ${t.index <= 10 ? "0.9" : t.index <= 50 ? "0.8" : "0.7"})`);
  });
  llmsLines.push(``);
});

llmsLines.push(`# Metadados Tecnicos`);
llmsLines.push(`> Build: ${BUILD_TIMESTAMP}`);
llmsLines.push(`> Total de paginas: ${terms.length}`);
llmsLines.push(`> Total de palavras: ${terms.reduce((s, t) => s + t.wordCount, 0).toLocaleString()}`);

writeFileSync("docs/llms.txt", llmsLines.join("\n") + "\n", "utf8");
console.log("✅ llms.txt gerado");

// ============================================================
// 6. INJETAR SPINTAX VISIVEL + TIMESTAMP EM CADA PAGINA
// ============================================================
console.log("\n📝 Injetando spintax VISIVEL e timestamps nas paginas...");
let updatedCount = 0;
let skippedCount = 0;

allLinks.forEach((link) => {
  try {
    const filePath = `docs/${link}`;
    let html = readFileSync(filePath, "utf8");
    const term = terms.find((t) => t.id === linkToSlug(link));

    const phrase = processSpintax(randomSpintax());
    const pageHash = term?.contentHash || createHash("sha256").update(html).digest("hex").substring(0, 16);
    const pageDate = term?.lastModified || BUILD_DATE;

    // ================================================================
    // BLOCO SPINTAX VISIVEL — Aparece na pagina, no final do conteudo
    // ================================================================
    // Formato: uma frase em italico com autor, visivel, com data e hash
    const spintaxVisible = `
<!-- Protocolo Hidra | Fras gerada em ${fullTimestamp} | Hash: ${pageHash} -->
<div class="protocolo-hidra-spintax" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">
  <p style="margin:0;font-style:italic;">&ldquo;${phrase}&rdquo;</p>
  <p style="margin:6px 0 0;font-size:0.75rem;color:#64748B;">
    <strong>Protocolo Hidra</strong> · Gerado em ${fullTimestamp} · 
    <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${pageHash.substring(0, 12)}</code>
  </p>
</div>

<!-- Timestamp completo visivel -->
<p style="font-size:0.8rem;color:#64748B;margin-top:16px;">
  Ultima revisao das fontes e dados: ${fullTimestamp} · 
  Hash: <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${pageHash.substring(0, 16)}</code>
</p>
`;

    // Procura o <p> de "Ultima revisao" existente e substitui
    const ultimaRevisaoRegex = /<p[^>]*>.*?[Uu]ltima revisao[^<]*<\/p>/i;
    if (ultimaRevisaoRegex.test(html)) {
      // Ja existe "Ultima revisao" - substitui pelo bloco completo
      html = html.replace(ultimaRevisaoRegex, spintaxVisible);
    } else {
      // Nao existe - procura </body> e insere antes
      const bodyCloseVariants = ["</body>", "</BODY>", "</body >", "</Body>"];
      let injected = false;
      for (const variant of bodyCloseVariants) {
        if (html.includes(variant)) {
          html = html.replace(variant, `${spintaxVisible}\n${variant}`);
          injected = true;
          break;
        }
      }
      if (!injected) {
        html += spintaxVisible;
      }
    }

    // Bloco hidden (pra crawler ler tambem)
    const spintaxHidden = `
<div style="display:none;" data-wikivendas-spintax="true" data-hash="${pageHash}" data-date="${fullTimestamp}">
  <p>${phrase}</p>
  <meta itemprop="dateModified" content="${fullTimestamp}">
  <meta itemprop="version" content="${BUILD_DATE.replace(/-/g, ".")}">
  <meta itemprop="sha256" content="${pageHash}">
  <meta itemprop="buildTime" content="${fullTimestamp}">
</div>
`;

    // Injeta hidden antes de </body> tambem
    const bodyCloseVariants = ["</body>", "</BODY>", "</body >", "</Body>"];
    for (const variant of bodyCloseVariants) {
      if (html.includes(variant)) {
        html = html.replace(variant, `${spintaxHidden}\n${variant}`);
        break;
      }
    }

    // Atualiza meta description com timestamp completo
    const metaDesc = `<meta name="description" content="${(term?.description || linkToName(link)).substring(0, 130)} — Gerado em ${fullTimestamp} | Hash: ${pageHash.substring(0, 12)}">`;
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description"[^>]*>/, metaDesc);
    } else {
      html = html.replace("<head>", `<head>\n  ${metaDesc}`);
    }

    // Atualiza dateModified no JSON-LD com timestamp completo
    html = html.replace(/"dateModified":"[^"]+"/, `"dateModified":"${fullTimestamp}"`);

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    skippedCount++;
    console.warn(`  ⚠️ ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} paginas atualizadas com spintax VISIVEL + timestamps`);
if (skippedCount > 0) console.log(`⚠️ ${skippedCount} paginas nao puderam ser lidas`);

// ============================================================
// 7. SCRIPT.JS
// ============================================================
const scriptJs = `// ============================================================
// Protocolo Hidra — Script de Ecossistema Vivo
// ============================================================
(function() {
  var BUILD_FULL = "${fullTimestamp}";
  var BUILD_DATE = "${BUILD_DATE}";
  var BUILD_TIME = "${BUILD_TIME}";
  var TOTAL_TERMS = ${terms.length};
  var GLOSSARIO_URL = "${SITE_URL}/glossario.json";

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
    version: "${BUILD_DATE.replace(/-/g, ".")}",
    buildDate: BUILD_DATE,
    buildTime: BUILD_TIME,
    buildFull: BUILD_FULL,
    totalTerms: TOTAL_TERMS,
    glossarioUrl: GLOSSARIO_URL,
  };
})();
`;

writeFileSync("docs/script.js", scriptJs, "utf8");
console.log("✅ script.js gerado");

// ============================================================
// 8. FINALIZAR
// ============================================================
console.log(`\n🏁 Build finalizado!`);
console.log(`   📁 docs/glossario.json — ${terms.length} termos`);
console.log(`   📁 docs/sitemap.xml — ${sitemapEntries.length} URLs (com horario completo)`);
console.log(`   📁 docs/robots.txt — 20+ crawlers`);
console.log(`   📁 docs/llms.txt`);
console.log(`   📁 docs/script.js`);
console.log(`   📁 ${updatedCount} paginas atualizadas`);
console.log(`   🕐 Build: ${fullTimestamp}`);
console.log(`   👁️ Spintax VISIVEL em todas as paginas + timestamp com HORAS`);
