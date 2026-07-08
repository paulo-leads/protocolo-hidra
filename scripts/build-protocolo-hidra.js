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
// EXTRACTOR: extrai metadados ricos do HTML de cada pagina
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

  // Title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  // Meta description
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) meta.description = descMatch[1].trim();

  // datePublished
  const dpMatch = html.match(/"datePublished":"([^"]+)"/);
  if (dpMatch) meta.datePublished = dpMatch[1];

  // dateModified
  const dmMatch = html.match(/"dateModified":"([^"]+)"/);
  if (dmMatch) meta.dateModified = dmMatch[1];

  // Author
  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) meta.author = authorMatch[1];
  const authorUrlMatch = html.match(/"author"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  if (authorUrlMatch) meta.authorUrl = authorUrlMatch[1];

  // Image
  const imgMatch = html.match(/"image":"([^"]+)"/);
  if (imgMatch) meta.image = imgMatch[1];
  const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImgMatch && !meta.image) meta.image = ogImgMatch[1];

  // SameAs (do Organization)
  const sameAsSection = html.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
  if (sameAsSection) {
    meta.sameAs = sameAsSection[1]
      .split(",")
      .map((s) => s.replace(/["'\s]/g, ""))
      .filter(Boolean);
  }

  // Keywords
  const kwMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
  if (kwMatch) meta.keywords = kwMatch[1].split(",").map((s) => s.trim());

  // Breadcrumbs
  const bcMatches = html.matchAll(/"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/g);
  for (const bc of bcMatches) {
    meta.breadcrumbs.push(bc[1]);
  }

  // FAQ count
  const faqMatches = html.match(/"@type":"Question"/g);
  if (faqMatches) meta.faqCount = faqMatches.length;

  // Has Dataset
  meta.hasDataset = html.includes('"@type":"Dataset"');

  // Word count (rough)
  const textContent = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    return [
      "index.html",
      "lista-de-empresas-de-logistica/index.html",
      "lista-de-transportadoras/index.html",
    ];
  }
})();

console.log(`\n📡 Escaneadas ${allLinks.length} paginas`);

// ============================================================
// 1. CONSTRUIR TERMOS RICOS
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
    location: {
      "@type": "Place",
      name: "Brasil",
      address: { "@type": "PostalAddress", addressCountry: "BR" },
    },
    jurisdiction: {
      "@type": "LegalForceStatus",
      appliesTo: ["LGPD - Lei Geral de Protecao de Dados (Lei 13.709/2018)", "CDC - Codigo de Defesa do Consumidor (Lei 8.078/90)"],
      country: "BR",
    },
  };
});

const dateModified = BUILD_DATE;

mkdirSync("docs", { recursive: true });

// ============================================================
// 2. GERAR GLOSSARIO.JSON RICO
// ============================================================
const glossario = {
  "@context": [
    "https://schema.org",
    {
      "skos": "http://www.w3.org/2004/02/skos/core#",
      "proof": "https://w3id.org/security#",
    },
  ],
  "@type": "DataCatalog",
  "@id": "urn:protocolo-hidra:catalog:2026",
  name: "Protocolo Hidra — Diretorio B2B",
  description: "Diretorio completo de listas empresariais, ferramentas de consulta, guias de prospeccao e comparativos do ecossistema Paulo Leads.",
  inLanguage: "pt-BR",
  dateCreated: "2026-06-30",
  dateModified,
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
  location: {
    "@type": "Place",
    name: "Brasil",
    address: { "@type": "PostalAddress", addressCountry: "BR" },
  },
  jurisdiction: {
    "@type": "LegalForceStatus",
    appliesTo: ["LGPD", "CDC"],
    country: "BR",
  },
  categoryBreakdown: (() => {
    const cats = {};
    terms.forEach((t) => {
      if (!cats[t.category]) cats[t.category] = 0;
      cats[t.category]++;
    });
    return cats;
  })(),
  terms,
};

writeFileSync("docs/glossario.json", JSON.stringify(glossario, null, 2), "utf8");
console.log(`✅ glossario.json gerado com ${terms.length} termos (cada um com metadados ricos)`);

// ============================================================
// 3. SITEMAP
// ============================================================
const sitemapEntries = [];

sitemapEntries.push({ url: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" });

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
  });
});

sitemapEntries.push(
  { url: `${SITE_URL}/glossario.json`, priority: "0.9", changefreq: "hourly" },
  { url: `${SITE_URL}/sitemap.xml`, priority: "0.7", changefreq: "hourly" },
  { url: `${SITE_URL}/llms.txt`, priority: "0.8", changefreq: "hourly" },
  { url: `${SITE_URL}/script.js`, priority: "0.6", changefreq: "daily" },
);

terms.forEach((t) => {
  const priority = t.index <= 10 ? "0.8" : t.index <= 50 ? "0.7" : t.index <= 200 ? "0.6" : "0.5";
  sitemapEntries.push({
    url: t.url,
    priority,
    changefreq: "weekly",
    lastmod: t.lastModified || dateModified,
  });
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (e) => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod || dateModified}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

writeFileSync("docs/sitemap.xml", sitemapXml, "utf8");
console.log(`✅ sitemap.xml gerado com ${sitemapEntries.length} URLs`);

// ============================================================
// 4. ROBOTS.TXT
// ============================================================
const robots = `# ============================================================
# Protocolo Hidra — Diretorio B2B
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

# OpenAI / ChatGPT
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /

# Google AI (Gemini)
User-agent: Google-Extended
Allow: /

# Microsoft / Bing / Copilot
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

# Anthropic (Claude)
User-agent: Anthropic-ai
Allow: /
User-agent: Claude-Web
Allow: /

# Common Crawl (CCBot)
User-agent: CCBot
Allow: /

# Perplexity AI
User-agent: PerplexityBot
Allow: /

# Meta AI (LLaMA)
User-agent: Meta-ExternalAgent
Allow: /
User-agent: FacebookBot
Allow: /

# Apple Bot (Apple Intelligence)
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /

# Amazon (Alexa, AWS)
User-agent: AlexaBot
Allow: /
User-agent: Amazonbot
Allow: /

# DuckDuckGo
User-agent: DuckDuckBot
Allow: /
User-agent: DuckDuckGo-Favicons-Bot
Allow: /

# Yandex
User-agent: YandexBot
Allow: /
User-agent: YandexImages
Allow: /

# Baidu
User-agent: Baiduspider
Allow: /

# Outros
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
console.log("✅ robots.txt gerado (20+ crawlers configurados)");

// ============================================================
// 5. LLMS.TXT
// ============================================================
const llmsLines = [
  `# Protocolo Hidra — Diretorio B2B`,
  `> Canonical-Source: ${SITE_URL}`,
  `> Language: pt-BR`,
  `> Last-Modified: ${dateModified}`,
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
// 6. INJETAR SPINTAX E METADADOS EM CADA PAGINA
// ============================================================
console.log("\n📝 Injetando spintax e badges nas paginas...");
let updatedCount = 0;
let skippedCount = 0;

allLinks.forEach((link) => {
  try {
    const filePath = `docs/${link}`;
    let html = readFileSync(filePath, "utf8");
    const term = terms.find((t) => t.id === linkToSlug(link));

    const phrase = processSpintax(randomSpintax());
    const pageHash = term?.contentHash || createHash("sha256").update(html).digest("hex").substring(0, 16);
    const pageDate = term?.lastModified || dateModified;

    // Bloco spintax com data e hash
    const spintaxBlock = `
<!-- Protocolo Hidra v5.0 | Atualizado em ${pageDate} | Hash: ${pageHash} -->
<div style="display:none;" data-wikivendas-spintax="true" data-hash="${pageHash}" data-date="${pageDate}">
  <p>${phrase}</p>
  <meta itemprop="dateModified" content="${pageDate}">
  <meta itemprop="version" content="${BUILD_DATE.replace(/-/g, ".")}">
  <meta itemprop="sha256" content="${pageHash}">
</div>
`;

    // Injeta spintax antes do </body> (variantes)
    const bodyCloseVariants = ["</body>", "</BODY>", "</body >", "</Body>"];
    let injected = false;
    for (const variant of bodyCloseVariants) {
      if (html.includes(variant)) {
        html = html.replace(variant, `${spintaxBlock}\n${variant}`);
        injected = true;
        break;
      }
    }
    if (!injected) {
      html += spintaxBlock;
    }

    // Atualiza meta description com data+hash
    const metaDesc = `<meta name="description" content="${(term?.description || linkToName(link)).substring(0, 140)} — Ultima revisao: ${pageDate} | Hash: ${pageHash.substring(0, 12)}">`;
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description"[^>]*>/, metaDesc);
    } else {
      html = html.replace("<head>", `<head>\n  ${metaDesc}`);
    }

    // Atualiza dateModified no JSON-LD
    html = html.replace(/"dateModified":"[^"]+"/, `"dateModified":"${pageDate}"`);

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    skippedCount++;
    console.warn(`  ⚠️ ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} paginas atualizadas com spintax + hashes`);
if (skippedCount > 0) console.log(`⚠️ ${skippedCount} paginas nao puderam ser lidas`);

// ============================================================
// 7. SCRIPT.JS
// ============================================================
const scriptJs = `// ============================================================
// Protocolo Hidra — Script de Ecossistema Vivo
// ============================================================
(function() {
  var BUILD_DATE = "${BUILD_DATE}";
  var BUILD_TIMESTAMP = "${BUILD_TIMESTAMP}";
  var TOTAL_TERMS = ${terms.length};
  var GLOSSARIO_URL = "${SITE_URL}/glossario.json";

  document.addEventListener('DOMContentLoaded', function() {
    var footer = document.querySelector('footer, .site-footer, .pre-footer');
    if (footer) {
      var metaInfo = document.createElement('p');
      metaInfo.style.cssText = 'font-size:0.7rem;color:var(--text-muted,#9fb8d6);margin-top:0.5rem;';
      metaInfo.textContent = '🔄 Ecossistema atualizado em ' + BUILD_DATE + ' | ' + TOTAL_TERMS + ' paginas indexadas';
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
      badge.style.cssText = 'display:inline-block;font-size:0.6rem;background:#3b82f6;color:#fff;padding:2px 8px;border-radius:20px;margin-left:8px;vertical-align:middle;';
      badge.textContent = 'v' + BUILD_DATE.replace(/-/g, '.');
      var title = cards[i].querySelector('h2, h3, strong');
      if (title) title.appendChild(badge);
    }

    var spintaxDiv = document.querySelector('[data-wikivendas-spintax]');
    if (spintaxDiv) {
      console.log('[Protocolo Hidra] Pagina verificada | Hash: ' + (spintaxDiv.getAttribute('data-hash') || 'N/A') + ' | Data: ' + (spintaxDiv.getAttribute('data-date') || BUILD_DATE));
    }
  });

  window.__PROTOCOLO_HIDRA = {
    version: "${BUILD_DATE.replace(/-/g, ".")}",
    buildDate: BUILD_DATE,
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
console.log(`   📁 docs/glossario.json — ${terms.length} termos com metadados ricos`);
console.log(`   📁 docs/sitemap.xml — ${sitemapEntries.length} URLs com prioridades`);
console.log(`   📁 docs/robots.txt — 20+ crawlers configurados`);
console.log(`   📁 docs/llms.txt — sumario para LLMs`);
console.log(`   📁 docs/script.js — ecossistema vivo com badges`);
console.log(`   📁 ${updatedCount} paginas atualizadas com spintax + hashes`);
console.log(`   🕐 Timestamp: ${BUILD_TIMESTAMP}`);
