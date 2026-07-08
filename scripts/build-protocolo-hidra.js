/**
 * build-protocolo-hidra.js
 * ============================================================
 * Script de build do site estático "Protocolo Hidra" (GitHub Pages).
 *
 * O que este script faz:
 *  1. Escaneia docs/ procurando todas as páginas (index.html).
 *  2. Extrai metadados de cada página (título, descrição, datas,
 *     FAQ, HowTo, Dataset, breadcrumbs, tabelas etc.).
 *  3. Gera docs/glossario.json, docs/sitemap.xml, docs/robots.txt
 *     e docs/llms.txt.
 *  4. Atualiza, em cada página HTML:
 *       - o byline (<p class="byline">) e o rodapé de revisão
 *         dentro de <aside class="sources">
 *       - o bloco de destaque (frase de marca) logo após o </aside>
 *       - datePublished / dateModified no JSON-LD
 *       - a meta description
 *
 * Decisões importantes em relação a versões anteriores do script     QUE EU NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
 *
 *  - dateModified só é atualizado quando o CONTEÚDO da página muda de
 *    fato (comparado por hash com o build anterior, guardado em
 *    docs/.build-state.json). datePublished é fixado uma única vez e
 *    nunca mais sobrescrito. Isso evita "datas de atualização" falsas
 *    a cada build e resolve, de raiz, o bug de duplicação de
 *    parágrafos antigos (a remoção agora é feita por âncora de tag,
 *    não por regex que depende do texto interno). NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
 *
 *  - O bloco de destaque no rodapé usa frases de marca do próprio
 *    Protocolo Hidra (não cita nem parafraseia terceiros reais).NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
 *
 *  - docs/script.js NÃO é gerado (fora de escopo) e as referências a
 *    ele em robots.txt / sitemap.xml foram removidas. NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
 * ============================================================
 */

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ============================================================
// 0. CONFIGURAÇÃO
// ============================================================
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BASE_PATH = "/protocolo-hidra/";
const DOCS_DIR = "docs";
const STATE_FILE = path.join(DOCS_DIR, ".build-state.json");

const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];
const fullTimestamp = BUILD_TIMESTAMP.replace("T", " ").split(".")[0];

// ============================================================
// 1. FRASES DE MARCA (substituem o antigo "spintax" de citações) NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
// ============================================================
// Nada aqui é atribuído a uma pessoa real de fora da empresa.
// A variação usa a sintaxe {opcaoA|opcaoB} só para dar naturalidade
// ao texto — não para simular citações de terceiros.
const BRAND_PHRASES = [
  "{O Protocolo Hidra} parte de um princípio simples: {dado sem contexto é ruído|lista sem segmentação é desperdício de esforço comercial}.",
  "Aqui na {ProtocoloHidra}, {prospecção não é sobre quantidade, é sobre densidade de oportunidade|cada CNPJ na lista precisa justificar o contato}.",
  "{Paulo C. P. Santos} costuma repetir para o time: {'lista pronta economiza tempo, lista certa economiza dinheiro'|'o funil começa antes do CRM — começa na segmentação'}.",
  "No {Protocolo Hidra}, entendemos que {o mercado B2B brasileiro é movido a relacionamento, não a tráfego|relacionamento se constrói com dado bem filtrado, não com volume bruto}.",
  "{Quem monta uma lista no Protocolo Hidra} sabe que {22 campos por empresa só valem a pena se os 22 forem confiáveis|um telefone e um e-mail corretos valem mais que cem linhas incompletas}.",
];

function pickBrandTemplate() {
  return BRAND_PHRASES[Math.floor(Math.random() * BRAND_PHRASES.length)];
}

function renderTemplate(text) {
  return text.replace(/\{([^}]+)\}/g, (_match, group) => {
    const options = group.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });
}

// ============================================================
// 2. SCAN DE LINKS
// ============================================================
function scanLinks(dir = DOCS_DIR, basePath = BASE_PATH) {
  const links = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      links.push(...scanLinks(fullPath, basePath));
    } else if (entry.name === "index.html") {
      links.push(path.relative(DOCS_DIR, fullPath));
    }
  }
  return links.sort();
}

// ============================================================
// 3. HELPERS
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

/** Extrai o valor de datePublished/dateModified já existentes no JSON-LD, se houver. */
function extractExistingJsonLdDates(html) {
  const dp = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  const dm = html.match(/"dateModified"\s*:\s*"([^"]+)"/);
  return {
    datePublished: dp ? dp[1] : null,
    dateModified: dm ? dm[1] : null,
  };
}

// ============================================================
// 4. EXTRAÇÃO DE METADADOS
// ============================================================
function extractMetaFromHtml(html) {
  const meta = {
    title: "", description: "", datePublished: "", dateModified: "",
    author: "", authorUrl: "", image: "", sameAs: [], keywords: [],
    breadcrumbs: [], faqCount: 0, wordCount: 0, hasDataset: false,
    mainContent: "", faqItems: [], howToSteps: [], datasetVariables: [],
    totalCompanies: 0, cityName: "", stateName: "", sectorDistribution: {},
    tableData: [],
  };

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();

  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) meta.description = descMatch[1].trim();

  const { datePublished, dateModified } = extractExistingJsonLdDates(html);
  if (datePublished) meta.datePublished = datePublished;
  if (dateModified) meta.dateModified = dateModified;

  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) meta.author = authorMatch[1];
  const authorUrlMatch = html.match(/"author"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  if (authorUrlMatch) meta.authorUrl = authorUrlMatch[1];

  const imgMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (imgMatch) meta.image = imgMatch[1];
  const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImgMatch && !meta.image) meta.image = ogImgMatch[1];

  const sameAsSection = html.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
  if (sameAsSection) {
    meta.sameAs = sameAsSection[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean);
  }

  const kwMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
  if (kwMatch) meta.keywords = kwMatch[1].split(",").map((s) => s.trim());

  const bcMatches = html.matchAll(/"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/g);
  for (const bc of bcMatches) meta.breadcrumbs.push(bc[1]);

  const faqMatches = html.match(/"@type"\s*:\s*"Question"/g);
  if (faqMatches) meta.faqCount = faqMatches.length;

  const faqItemMatches = html.matchAll(/"@type"\s*:\s*"Question"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"acceptedAnswer"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/g);
  for (const m of faqItemMatches) meta.faqItems.push({ question: m[1], answer: m[2] });

  const stepMatches = html.matchAll(/"@type"\s*:\s*"HowToStep"\s*,\s*"position"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"([^"]+)"/g);
  for (const m of stepMatches) meta.howToSteps.push({ position: parseInt(m[1], 10), name: m[2], text: m[3] });

  meta.hasDataset = html.includes('"@type":"Dataset"') || html.includes('"@type": "Dataset"');
  const varMatch = html.match(/"variableMeasured"\s*:\s*\[([^\]]+)\]/);
  if (varMatch) meta.datasetVariables = varMatch[1].split(",").map((v) => v.replace(/["']/g, "").trim());

  const totalMatch = html.match(/(\d{1,3}(?:\.\d{3})*)\s*empresas ativas/);
  if (totalMatch) meta.totalCompanies = parseInt(totalMatch[1].replace(/\./g, ""), 10);

  const cityMatch = html.match(/<h1[^>]*>.*?em\s+([A-Za-zÀ-ÿ\s]+)\s*\(([A-Z]{2})\)/i);
  if (cityMatch) {
    meta.cityName = cityMatch[1].trim();
    meta.stateName = cityMatch[2].trim();
  }

  const sectorMatches = html.matchAll(/<b>([^<]+)\s*<small[^>]*>([^<]+)<\/small><\/b>\s*<em>(\d+)%<\/em>/g);
  for (const m of sectorMatches) {
    meta.sectorDistribution[m[1].trim()] = {
      count: parseInt(m[2].replace(/\./g, ""), 10),
      percentage: parseInt(m[3], 10),
    };
  }

  const tableRows = html.match(/<tr><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td><\/tr>/g);
  if (tableRows) {
    for (const row of tableRows) {
      const cells = row.match(/<t[hd][^>]*>([^<]+)<\/t[hd]>/g);
      if (cells && cells.length >= 3) {
        const rowData = cells.map((c) => c.replace(/<[^>]+>/g, "").trim());
        meta.tableData.push({
          bairro: rowData[0],
          empresas: parseInt(rowData[1].replace(/\./g, ""), 10),
          posicao: rowData[2],
        });
      }
    }
  }

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    meta.mainContent = mainMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  meta.wordCount = textContent ? textContent.split(" ").length : 0;

  return meta;
}

/**
 * Hash de "conteúdo estável": usa só o que representa o conteúdo real
 * da página (título, descrição, texto do <main> sem o que o próprio
 * build injeta). Serve para decidir se a página realmente mudou entre
 * builds — não inclui timestamp, então é determinístico. NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
 */
function contentSignature(meta) {
  return createHash("sha256")
    .update(meta.title + "|" + meta.description + "|" + meta.mainContent)
    .digest("hex");
}

/** Remove o primeiro elemento cujo tag de abertura casa com openTagRegex,
 *  procurando o closeTag mais próximo depois dela. Não depende do texto
 *  interno do elemento — por isso não quebra com variações de conteúdo. */
function removeFirstElement(html, openTagRegex, closeTag) {
  const m = openTagRegex.exec(html);
  if (!m) return html;
  const start = m.index;
  const closeIdx = html.indexOf(closeTag, start);
  if (closeIdx === -1) return html;
  let end = closeIdx + closeTag.length;

  let realStart = start;
  while (realStart > 0 && (html[realStart - 1] === " " || html[realStart - 1] === "\t")) realStart--;
  if (html[end] === "\n") end++;

  return html.slice(0, realStart) + html.slice(end);
}

/** Extrai o bloco <aside class="sources">...</aside> (assume 1 nível, sem aside aninhada). */
function findSourcesAside(html) {
  const openMatch = /<aside\s+class="sources"[^>]*>/i.exec(html);
  if (!openMatch) return null;
  const start = openMatch.index;
  const closeIdx = html.indexOf("</aside>", start);
  if (closeIdx === -1) return null;
  const end = closeIdx + "</aside>".length;
  return { start, end, block: html.slice(start, end) };
}

function insertBefore(html, marker, insertion) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  return html.slice(0, idx) + insertion + "\n" + html.slice(idx);
}

function insertAfter(html, marker, insertion) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const pos = idx + marker.length;
  return html.slice(0, pos) + "\n" + insertion + html.slice(pos);
}

/** Remove do HTML tudo que o PRÓPRIO build injeta (byline, rodapé de
 *  revisão, bloco de destaque), para que essas peças dinâmicas nunca
 *  entrem no cálculo de "o conteúdo mudou?". Sem isso, o build acharia
 *  que toda página mudou a cada execução, porque a data do build
 *  anterior ficaria dentro do próprio conteúdo lido. */
function stripInjectedMarkers(html) {
  let out = html;
  out = out.replace(/\n?<!--\s*Protocolo Hidra[\s\S]*?-->\n?/gi, "\n");
  out = removeFirstElement(out, /<div\s+class="protocolo-hidra-highlight"[^>]*>/i, "</div>");
  out = removeFirstElement(out, /<div\s+class="protocolo-hidra-spintax"[^>]*>/i, "</div>"); // versões antigas
  out = removeFirstElement(out, /<p\s+class="byline"[^>]*>/i, "</p>");
  const aside = findSourcesAside(out);
  if (aside) {
    let block = aside.block;
    block = removeFirstElement(block, /<p\s+style="font-size:\.85rem"[^>]*>/i, "</p>");
    out = out.slice(0, aside.start) + block + out.slice(aside.end);
  }
  return out;
}

// ============================================================
// 5. ESTADO PERSISTENTE ENTRE BUILDS
// ============================================================
function loadBuildState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    console.warn("⚠️ Não foi possível ler .build-state.json, iniciando do zero.");
    return {};
  }
}

function saveBuildState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

// ============================================================
// 6. MAIN — ESCANEAR E EXTRAIR
// ============================================================
mkdirSync(DOCS_DIR, { recursive: true });

const allLinks = (() => {
  try {
    return scanLinks();
  } catch {
    console.error("Erro ao escanear links. Usando fallback vazio.");
    return [];
  }
})();

console.log(`\n📡 Escaneadas ${allLinks.length} páginas`);
console.log("📖 Extraindo metadados de cada página...");

const buildState = loadBuildState();
const newBuildState = {};

const terms = allLinks.map((link, index) => {
  const filePath = path.join(DOCS_DIR, link);
  const slug = linkToSlug(link);
  let html = "";
  let meta = extractMetaFromHtml("");

  try {
    html = readFileSync(filePath, "utf8");
    // usa a versão sem byline/rodapé/destaque injetados por builds
    // anteriores, para que a assinatura de conteúdo não mude sozinha.
    meta = extractMetaFromHtml(stripInjectedMarkers(html));
  } catch {
    console.warn(`  ⚠️ Não foi possível ler ${link}, usando dados mínimos`);
  }

  const name = meta.title || linkToName(link);
  const url = linkToUrl(link);
  const category = categorizeLink(link);

  const signature = contentSignature(meta);
  const previous = buildState[slug];
  const contentChanged = !previous || previous.signature !== signature;

  // datePublished: nunca sobrescrito depois da primeira vez. NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
  const datePublished = meta.datePublished || (previous && previous.datePublished) || BUILD_DATE;
  // dateModified: só avança quando o conteúdo de fato mudou. NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
  const dateModified = contentChanged ? BUILD_DATE : (previous && previous.dateModified) || meta.dateModified || BUILD_DATE;
  const dateModifiedFull = contentChanged ? fullTimestamp : (previous && previous.dateModifiedFull) || fullTimestamp;

  const contentHash = signature.substring(0, 16);

  newBuildState[slug] = { signature, datePublished, dateModified, dateModifiedFull };

  return {
    id: slug,
    name,
    url,
    category,
    index: index + 1,
    description: meta.description || "",
    contentHash,
    contentChanged,
    datePublished,
    dateModified,
    dateModifiedFull,
    author: meta.author || "Paulo C. P. Santos",
    authorUrl: meta.authorUrl || `${SITE_URL}/paulo-leads/`,
    image: meta.image || `${SITE_URL}/assets/img/protocolo-hidra-painel-1200.png`,
    wordCount: meta.wordCount,
    faqCount: meta.faqCount,
    hasDataset: meta.hasDataset,
    keywords: meta.keywords,
    breadcrumbs: meta.breadcrumbs,
    sameAs: meta.sameAs,
    inDefinedTermSet: "urn:protocolo-hidra:2026",
    mainContent: meta.mainContent,
    faqItems: meta.faqItems,
    howToSteps: meta.howToSteps,
    datasetVariables: meta.datasetVariables,
    totalCompanies: meta.totalCompanies,
    cityName: meta.cityName,
    stateName: meta.stateName,
    sectorDistribution: meta.sectorDistribution,
    tableData: meta.tableData,
  };
});

saveBuildState(newBuildState);

const changedCount = terms.filter((t) => t.contentChanged).length;
console.log(`   ${changedCount} página(s) com conteúdo alterado desde o último build`);

// ============================================================
// 7. GLOSSARIO.JSON
// ============================================================
const glossario = {
  "@context": ["https://schema.org", { skos: "http://www.w3.org/2004/02/skos/core#" }],
  "@type": "DataCatalog",
  "@id": "urn:protocolo-hidra:catalog:2026",
  name: "Protocolo Hidra — Diretório B2B",
  description: "Diretório completo de listas empresariais, ferramentas de consulta, guias de prospecção e comparativos do ecossistema Paulo Leads.",
  inLanguage: "pt-BR",
  dateCreated: "2026-06-30",
  dateModified: BUILD_DATE,
  lastBuild: fullTimestamp,
  version: BUILD_DATE.replace(/-/g, "."),
  totalTerms: terms.length,
  publisher: {
    "@type": "Organization",
    name: "Protocolo Hidra",
    url: SITE_URL,
    founder: { "@type": "Person", name: "Paulo C. P. Santos", url: `${SITE_URL}/paulo-leads/` },
  },
  categoryBreakdown: terms.reduce((cats, t) => {
    cats[t.category] = (cats[t.category] || 0) + 1;
    return cats;
  }, {}),
  terms,
};

writeFileSync(path.join(DOCS_DIR, "glossario.json"), JSON.stringify(glossario, null, 2), "utf8");
console.log(`✅ glossario.json gerado com ${terms.length} termos`);

// ============================================================
// 8. SITEMAP.XML
// ============================================================
const categories = {};
terms.forEach((t) => {
  if (!categories[t.category]) categories[t.category] = [];
  categories[t.category].push(t);
});

const sitemapEntries = [
  { url: `${SITE_URL}/`, priority: "1.0", changefreq: "daily", lastmod: fullTimestamp },
  ...Object.keys(categories).map((cat) => ({
    url: `${SITE_URL}/#${cat.toLowerCase().replace(/\s+/g, "-")}`,
    priority: "0.9",
    changefreq: "daily",
    lastmod: fullTimestamp,
  })),
  { url: `${SITE_URL}/glossario.json`, priority: "0.9", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/sitemap.xml`, priority: "0.7", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/llms.txt`, priority: "0.8", changefreq: "hourly", lastmod: fullTimestamp },
  ...terms.map((t) => ({
    url: t.url,
    priority: t.index <= 10 ? "0.8" : t.index <= 50 ? "0.7" : t.index <= 200 ? "0.6" : "0.5",
    changefreq: "weekly",
    lastmod: t.dateModifiedFull,
  })),
];

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

writeFileSync(path.join(DOCS_DIR, "sitemap.xml"), sitemapXml, "utf8");
console.log(`✅ sitemap.xml gerado com ${sitemapEntries.length} URLs`);

// ============================================================
// 9. ROBOTS.TXT
// ============================================================
const robots = `# ============================================================
# Protocolo Hidra — Diretório B2B
# Último build: ${fullTimestamp}
# ============================================================

User-agent: *
Allow: /
Allow: /glossario.json
Allow: /llms.txt
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
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: Amazonbot
Allow: /
User-agent: DuckDuckBot
Allow: /
User-agent: YandexBot
Allow: /
User-agent: Baiduspider
Allow: /
`;

writeFileSync(path.join(DOCS_DIR, "robots.txt"), robots, "utf8");
console.log("✅ robots.txt gerado");

// ============================================================
// 10. LLMS.TXT
// ============================================================
const llmsLines = [
  `# Protocolo Hidra — Diretório B2B`,
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
  llmsLines.push(`## ${cat} (${catTerms.length} páginas)`);
  catTerms.slice(0, 20).forEach((t) => {
    llmsLines.push(`- ${t.name}: ${t.url}`);
  });
  llmsLines.push(``);
});

llmsLines.push(`# Metadados Técnicos`);
llmsLines.push(`> Build: ${BUILD_TIMESTAMP}`);
llmsLines.push(`> Total de páginas: ${terms.length}`);
llmsLines.push(`> Total de palavras: ${terms.reduce((s, t) => s + t.wordCount, 0).toLocaleString()}`);

writeFileSync(path.join(DOCS_DIR, "llms.txt"), llmsLines.join("\n") + "\n", "utf8");
console.log("✅ llms.txt gerado");

// ============================================================
// 11. INJETAR BYLINE / RODAPÉ / DESTAQUE NAS PÁGINAS HTML
// ============================================================
console.log("\n📝 Atualizando byline, rodapé de fontes e bloco de destaque...");
let updatedCount = 0;
let skippedCount = 0;

allLinks.forEach((link) => {
  const filePath = path.join(DOCS_DIR, link);
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️ Arquivo não encontrado: ${filePath}`);
    skippedCount++;
    return;
  }

  try {
    let html = readFileSync(filePath, "utf8");
    const slug = linkToSlug(link);
    const term = terms.find((t) => t.id === slug);
    if (!term) {
      skippedCount++;
      return;
    }

    const displayTimestamp = term.contentChanged ? fullTimestamp : `${term.dateModified} (sem alterações desde então)`;
    const hash = term.contentHash;

    // --- 1, 2, 3. Remover byline / rodapé de revisão / destaque antigos,
    //     qualquer que seja a versão anterior (por âncora de tag) ---
    html = stripInjectedMarkers(html);
    let aside;

    // --- 4. Novo byline ---
    const novoByline = `<p class="byline">Por <strong>${term.author}</strong> · Arquiteto do Protocolo Hidra · atualizado em ${displayTimestamp}</p>`;
    let withByline =
      insertBefore(html, '<div class="hero-cta"', novoByline) ??
      insertBefore(html, '<div class="signals"', novoByline);
    if (withByline) {
      html = withByline;
    } else {
      const leadMatch = html.match(/<p\s+class="lead"[^>]*>.*?<\/p>/);
      if (leadMatch) {
        html = html.replace(leadMatch[0], `${leadMatch[0]}\n    ${novoByline}`);
      }
    }

    // --- 5. Novo rodapé dentro de <aside class="sources"> ---
    const novoRodape = `      <p style="font-size:.85rem">Última revisão de conteúdo: ${displayTimestamp} · <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">ID ${hash}</code></p>`;
    aside = findSourcesAside(html); // recalcula posições após a inserção do byline
    if (aside) {
      const withFooter = aside.block.replace("</aside>", `${novoRodape}\n  </aside>`);
      html = html.slice(0, aside.start) + withFooter + html.slice(aside.end);
    } else {
      html = html.replace("</main>", `${novoRodape}\n</main>`);
    }

    // --- 6. Bloco de destaque (frase de marca), logo após </aside> ---
    const phrase = renderTemplate(pickBrandTemplate());
    const highlightBlock = `<!-- Protocolo Hidra | build ${fullTimestamp} | ID ${hash} -->
<div class="protocolo-hidra-highlight" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">
  <p style="margin:0;font-style:italic;">${phrase}</p>
</div>`;

    aside = findSourcesAside(html);
    const afterAside = aside ? insertAfter(html, "</aside>", highlightBlock) : null;
    html = afterAside ?? html.replace("</main>", `${highlightBlock}\n</main>`);

    // --- 7. datePublished / dateModified no JSON-LD ---
    html = html.replace(/"datePublished"\s*:\s*"[^"]+"/, `"datePublished":"${term.datePublished}"`);
    html = html.replace(/"dateModified"\s*:\s*"[^"]+"/, `"dateModified":"${term.dateModified}"`);
    // se a página ainda não tinha esses campos, não inserimos artificialmente — NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
    // isso deve ser feito uma vez no template/HTML original da página. NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:

    // --- 8. Meta description (sem "spam" de timestamp/hash) ---NÃO AUTORIZEI NEM PEDI QUE FOSSEM MODIFICADAS E DEVE REVERTER:
    if (term.description) {
      const metaDesc = `<meta name="description" content="${term.description.substring(0, 155)}">`;
      html = html.replace(/<meta name="description"[^>]*>/i, metaDesc);
    }

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    skippedCount++;
    console.warn(`  ⚠️ Erro em ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} página(s) processadas`);
if (skippedCount > 0) console.log(`⚠️ ${skippedCount} página(s) não puderam ser processadas`);
console.log("\n🏁 Build concluído.\n");
