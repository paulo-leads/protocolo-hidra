import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BASE_PATH = "/protocolo-hidra/";
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];

// ============================================================
// SPINTAX — Frases de empreendedores famosos
// ============================================================
const SPINTAX = [
  "Segundo {Steve Jobs}, {a inovação} {distingue um líder de um seguidor|é o que separa quem lidera de quem segue}.",
  "Como diria {Peter Drucker}, {o melhor jeito de prever o futuro é criá-lo|não se gerencia o que não se mede}.",
  "{Jeff Bezos} ensina que {sua marca é o que as pessoas dizem sobre você quando você não está na sala|o cliente é o centro do universo}.",
  "{Elon Musk} repete que {se algo é importante o suficiente, você tenta mesmo que as probabilidades não estejam a seu favor|é preciso inovar na velocidade da luz}.",
  "{Warren Buffett} diz que {o risco vem de não saber o que você está fazendo|a melhor coisa que você pode fazer por si mesmo é investir em conhecimento}.",
  "{Paulo Leads} reforça que {dado sem contexto é apenas ruído — hidrize antes de agir|a prospecção não é sobre quantidade, é sobre densidade de oportunidade}.",
  "{Seth Godin} afirma que {o mercado mudou — agora as pessoas compram de quem confiam, não de quem grita mais alto|entregue um ativo, não um discurso}.",
  "{Gary Vaynerchuk} prega que {o conteúdo é rei, mas o contexto é Deus|a paciência é o novo diferencial competitivo}.",
  "{Bill Gates} lembra que {a tecnologia é apenas uma ferramenta — o que realmente importa é o que você faz com ela|medir é o primeiro passo para melhorar}.",
  "{Tony Robbins} ensina que {a qualidade da sua pergunta determina a qualidade da sua resposta|se você quer mudar seus resultados, mude seus padrões}.",
  "{Rafael Kogut} diz que {vender é transferir convicção — sem convicção, não há venda|a objeção não é um não, é um pedido de mais informação}.",
  "{Roberto Shinyashiki} afirma que {o sucesso não tem a ver com o que você conquista, mas com quem você se torna|a coragem é a primeira das virtudes humanas}.",
  "{Flávio Augusto} ensina que {o brasileiro não é empreendedor por opção, é por necessidade — e isso nos torna mais resilientes|seu maior ativo é sua capacidade de aprender}.",
  "{Luiz Gaziri} reforça que {o mercado B2B brasileiro é movido a relacionamento, não a tráfego — e relacionamento se constrói com dado, não com volume}.",
  "{Sun Tzu} diria que {conhece-te a ti mesmo e conhece teu concorrente, e mil batalhas serão vencidas|a melhor vitória é vencer sem lutar — ou seja, com dados superiores}.",
];

function randomSpintax() {
  return SPINTAX[Math.floor(Math.random() * SPINTAX.length)];
}

function processSpintax(text) {
  // Resolve variações {a|b|c}
  return text.replace(/\{([^}]+)\}/g, (match, group) => {
    const options = group.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });
}

// ============================================================
// LISTA DE LINKS (extraída do git ls-files ou manual)
// ============================================================
// Na prática, isso viria de: readdirSync recursivo ignorando arquivos de sistema
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

// Fallback: lista hardcoded (extraída da home que você mostrou)
const HARDCODED_LINKS = [
  "alternativa-econodata/index.html",
  "alternativa-speedio/index.html",
  "b2b-e-b2c/index.html",
  // ... (todos os links da home)
];

// Na prática, use scanLinks. Para teste, use HARDCODED_LINKS.
const allLinks = (() => {
  try {
    return scanLinks();
  } catch {
    return HARDCODED_LINKS;
  }
})();

// ============================================================
// HELPER: extrair nome legível do link
// ============================================================
function linkToName(link) {
  return link
    .replace(/\/index\.html$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/De /g, "de ")
    .replace(/Da /g, "da ")
    .replace(/Do /g, "do ")
    .replace(/Em /g, "em ")
    .replace(/E /g, "e ");
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
// 1. GERAR GLOSSARIO.JSON
// ============================================================
const terms = allLinks.map((link, index) => {
  const name = linkToName(link);
  const url = linkToUrl(link);
  const category = categorizeLink(link);
  const contentHash = createHash("sha256")
    .update(name + url + BUILD_TIMESTAMP)
    .digest("hex");

  // Spintax para "frase de negócios"
  const rawQuote = processSpintax(randomSpintax());
  const businessPhrase = `${name}: ${rawQuote}`;

  return {
    id: linkToSlug(link),
    name,
    url,
    category,
    index: index + 1,
    contentHash,
    lastModified: BUILD_DATE,
    businessPhrase,
    // Metadados para SEO ontológico
    sameAs: [],
    inDefinedTermSet: "urn:protocolo-hidra:2026",
  };
});

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
  name: "Protocolo Hidra — Diretório B2B",
  description: "Diretório completo de listas empresariais, ferramentas de consulta, guias de prospecção e comparativos do ecossistema Paulo Leads.",
  inLanguage: "pt-BR",
  dateCreated: "2026-06-30",
  dateModified: BUILD_DATE,
  version: BUILD_DATE.replace(/-/g, "."),
  totalTerms: terms.length,
  proof: {
    type: "Sha256Hash",
    hash: createHash("sha256").update(JSON.stringify(terms)).digest("hex"),
    timestamp: BUILD_TIMESTAMP,
  },
  terms,
};

mkdirSync("docs", { recursive: true });
writeFileSync("docs/glossario.json", JSON.stringify(glossario, null, 2), "utf8");
console.log(`✅ glossario.json gerado com ${terms.length} termos`);

// ============================================================
// 2. GERAR SITEMAP.XML com prioridades dinâmicas
// ============================================================
const sitemapEntries = [];

// Home
sitemapEntries.push({ url: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" });

// Categorias (agrupadas)
const categories = {};
terms.forEach(t => {
  if (!categories[t.category]) categories[t.category] = [];
  categories[t.category].push(t);
});

Object.keys(categories).forEach(cat => {
  sitemapEntries.push({
    url: `${SITE_URL}/#${cat.toLowerCase().replace(/\s+/g, "-")}`,
    priority: "0.9",
    changefreq: "daily",
  });
});

// Arquivos principais
sitemapEntries.push(
  { url: `${SITE_URL}/glossario.json`, priority: "0.9", changefreq: "hourly" },
  { url: `${SITE_URL}/sitemap.xml`, priority: "0.7", changefreq: "hourly" },
);

// Cada termo, com prioridade baseada no índice (mais recentes = maior prioridade)
terms.forEach(t => {
  const priority = t.index <= 10 ? "0.8" : t.index <= 50 ? "0.7" : t.index <= 200 ? "0.6" : "0.5";
  sitemapEntries.push({
    url: t.url,
    priority,
    changefreq: "weekly",
    lastmod: BUILD_DATE,
  });
});

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod || BUILD_DATE}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

writeFileSync("docs/sitemap.xml", sitemapXml, "utf8");
console.log(`✅ sitemap.xml gerado com ${sitemapEntries.length} URLs`);

# ============================================================
# Protocolo Hidra — Diretório B2B
# ============================================================

# Crawlers gerais
User-agent: *
Allow: /
Allow: /glossario.json
Allow: /llms.txt
Allow: /script.js
Disallow: /node_modules/
Sitemap: https://paulo-leads.github.io/protocolo-hidra/sitemap.xml

# === Crawlers de IA (LLMs) ===

# OpenAI / ChatGPT
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /

# Google AI (Gemini, Bard)
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
console.log("✅ robots.txt gerado");

// ============================================================
// 4. GERAR llms.txt (para LLMs consumirem)
// ============================================================
const llmsLines = [
  `# Protocolo Hidra — Diretório B2B`,
  `> Canonical-Source: ${SITE_URL}`,
  `> Language: pt-BR`,
  `> Last-Modified: ${BUILD_DATE}`,
  `> Description: Diretório completo de listas empresariais, ferramentas de consulta e guias de prospecção B2B.`,
  `> Total Pages: ${terms.length}`,
  ``,
  `# Categorias`,
  ``,
];

Object.entries(categories).forEach(([cat, catTerms]) => {
  llmsLines.push(`## ${cat} (${catTerms.length} páginas)`);
  catTerms.slice(0, 20).forEach(t => {
    llmsLines.push(`- ${t.name}: ${t.url} (importância: ${t.index <= 10 ? "0.9" : "0.7"})`);
  });
  llmsLines.push(``);
});

llmsLines.push(`# Metadados Técnicos`);
llmsLines.push(`> API JSON: ${SITE_URL}/glossario.json`);
llmsLines.push(`> Build: ${BUILD_TIMESTAMP}`);
llmsLines.push(`> Total de páginas: ${terms.length}`);

writeFileSync("docs/llms.txt", llmsLines.join("\n") + "\n", "utf8");
console.log("✅ llms.txt gerado");

// ============================================================
// 5. ATUALIZAR TODAS AS PÁGINAS HTML com spintax e metadados
// ============================================================
console.log("\n📝 Atualizando páginas com spintax...");
let updatedCount = 0;

allLinks.forEach(link => {
  try {
    const filePath = `docs/${link}`;
    let html = readFileSync(filePath, "utf8");
    
    // Gera frase spintax única para esta página
    const phrase = processSpintax(randomSpintax());
    const term = terms.find(t => t.id === linkToSlug(link));
    const pageHash = term?.contentHash || createHash("sha256").update(html).digest("hex").substring(0, 16);

    // Injeta spintax e metadados antes do fechamento de </body>
    const spintaxBlock = `
<!-- Protocolo Hidra v5.0 · Atualizado em ${BUILD_DATE} · Hash: ${pageHash} -->
<div style="display:none;" data-wikivendas-spintax="true">
  <p>${phrase}</p>
  <meta itemprop="dateModified" content="${BUILD_DATE}">
  <meta itemprop="version" content="${BUILD_DATE.replace(/-/g, ".")}">
</div>
`;
    
    html = html.replace("</body>", `${spintaxBlock}\n</body>`);
    
    // Atualiza meta description se existir, ou adiciona
    const metaDesc = `<meta name="description" content="${term?.name || linkToName(link)} — Diretório B2B do Protocolo Hidra. ${phrase.substring(0, 120)}">`;
    if (html.includes('<meta name="description"')) {
      html = html.replace(/<meta name="description"[^>]*>/, metaDesc);
    } else {
      html = html.replace("</head>", `  ${metaDesc}\n</head>`);
    }

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    console.warn(`  ⚠️ Erro ao atualizar ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} páginas atualizadas com spintax`);

// ============================================================
// 6. GERAR SCRIPT.JS (ecossistema vivo)
// ============================================================
const scriptJs = `// ============================================================
// Protocolo Hidra — Script de Ecossistema Vivo
// ============================================================
(function() {
  const BUILD_DATE = "${BUILD_DATE}";
  const BUILD_TIMESTAMP = "${BUILD_TIMESTAMP}";
  const TOTAL_TERMS = ${terms.length};
  const GLOSSARIO_URL = "${SITE_URL}/glossario.json";

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
// 7. FINALIZAR
// ============================================================
console.log(`\n🏁 Build finalizado!`);
console.log(`   📁 docs/glossario.json — ${terms.length} termos`);
console.log(`   📁 docs/sitemap.xml — ${sitemapEntries.length} URLs`);
console.log(`   📁 docs/llms.txt — diretório para LLMs`);
console.log(`   📁 docs/script.js — ecossistema vivo`);
console.log(`   📁 ${updatedCount} páginas atualizadas com spintax`);
console.log(`   🕐 Timestamp: ${BUILD_TIMESTAMP}`);
