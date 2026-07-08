import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";

// ============================================================
// CONFIGURACAO
// ============================================================
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BASE_PATH = "/protocolo-hidra/";
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];
const BUILD_TIME = BUILD_TIMESTAMP.split("T")[1].split(".")[0];

// ============================================================
// SPINTAX (mantido igual)
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
// SCAN LINKS (mantido igual)
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
// HELPERS (mantidos iguais)
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
// NOVO EXTRACTOR COMPLETO
// ============================================================
function extractMetaFromHtml(html, link) {
  const meta = {
    title: "", description: "", datePublished: "", dateModified: "",
    author: "", authorUrl: "", image: "", sameAs: [], keywords: [],
    breadcrumbs: [], faqCount: 0, wordCount: 0, hasDataset: false,
    // --- NOVOS CAMPOS ---
    mainContent: "",
    faqItems: [],
    howToSteps: [],
    datasetVariables: [],
    totalCompanies: 0,
    cityName: "",
    stateName: "",
    sectorDistribution: {},
    tableData: [],
    lastBuild: "",
  };

  // Título e descrição
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();
  const descMatch = html.match(/<meta name="description" content="([^"]+)"/i);
  if (descMatch) meta.description = descMatch[1].trim();

  // Datas
  const dpMatch = html.match(/"datePublished":"([^"]+)"/);
  if (dpMatch) meta.datePublished = dpMatch[1];
  const dmMatch = html.match(/"dateModified":"([^"]+)"/);
  if (dmMatch) meta.dateModified = dmMatch[1];

  // Autor
  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) meta.author = authorMatch[1];
  const authorUrlMatch = html.match(/"author"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  if (authorUrlMatch) meta.authorUrl = authorUrlMatch[1];

  // Imagem
  const imgMatch = html.match(/"image":"([^"]+)"/);
  if (imgMatch) meta.image = imgMatch[1];
  const ogImgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImgMatch && !meta.image) meta.image = ogImgMatch[1];

  // sameAs
  const sameAsSection = html.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
  if (sameAsSection) {
    meta.sameAs = sameAsSection[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean);
  }

  // Keywords
  const kwMatch = html.match(/<meta name="keywords" content="([^"]+)"/i);
  if (kwMatch) meta.keywords = kwMatch[1].split(",").map((s) => s.trim());

  // Breadcrumbs
  const bcMatches = html.matchAll(/"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/g);
  for (const bc of bcMatches) {
    meta.breadcrumbs.push(bc[1]);
  }

  // FAQ
  const faqMatches = html.match(/"@type":"Question"/g);
  if (faqMatches) meta.faqCount = faqMatches.length;
  
  // Extrair perguntas e respostas do FAQ
  const faqItemMatches = html.matchAll(/"@type":"Question"\s*,\s*"name":"([^"]+)"\s*,\s*"acceptedAnswer"\s*:\s*\{[^}]*"text":"([^"]+)"/g);
  for (const match of faqItemMatches) {
    meta.faqItems.push({ question: match[1], answer: match[2] });
  }

  // HowTo
  const stepMatches = html.matchAll(/"@type":"HowToStep"\s*,\s*"position":\s*(\d+)\s*,\s*"name":"([^"]+)"\s*,\s*"text":"([^"]+)"/g);
  for (const match of stepMatches) {
    meta.howToSteps.push({ position: parseInt(match[1]), name: match[2], text: match[3] });
  }

  // Dataset
  meta.hasDataset = html.includes('"@type":"Dataset"');
  const varMatch = html.match(/"variableMeasured"\s*:\s*\[([^\]]+)\]/);
  if (varMatch) {
    meta.datasetVariables = varMatch[1].split(",").map(v => v.replace(/["']/g, "").trim());
  }

  // Total de empresas (ex: "16.624")
  const totalMatch = html.match(/(\d{1,3}(?:\.\d{3})*)\s*empresas ativas/);
  if (totalMatch) meta.totalCompanies = parseInt(totalMatch[1].replace(/\./g, ''));

  // Cidade e Estado
  const cityMatch = html.match(/<h1[^>]*>.*?em\s+([A-Za-zÀ-ÿ\s]+)\s*\(([A-Z]{2})\)/i);
  if (cityMatch) {
    meta.cityName = cityMatch[1].trim();
    meta.stateName = cityMatch[2].trim();
  }

  // Distribuição por setor (ex: "Serviços 57%")
  const sectorMatches = html.matchAll(/<b>([^<]+)\s*<small[^>]*>([^<]+)<\/small><\/b>\s*<em>(\d+)%<\/em>/g);
  for (const match of sectorMatches) {
    meta.sectorDistribution[match[1].trim()] = {
      count: parseInt(match[2].replace(/\./g, '')),
      percentage: parseInt(match[3])
    };
  }

  // Tabelas (ex: dados por bairro)
  const tableRows = html.match(/<tr><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td><\/tr>/g);
  if (tableRows) {
    for (const row of tableRows) {
      const cells = row.match(/<t[hd][^>]*>([^<]+)<\/t[hd]>/g);
      if (cells && cells.length >= 3) {
        const rowData = cells.map(cell => cell.replace(/<[^>]+>/g, '').trim());
        meta.tableData.push({
          bairro: rowData[0],
          empresas: parseInt(rowData[1].replace(/\./g, '')),
          posicao: rowData[2]
        });
      }
    }
  }

  // Conteúdo principal (texto do <main>)
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    meta.mainContent = mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Contagem de palavras
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

console.log("\n📖 Extraindo metadados de cada pagina...");
const terms = allLinks.map((link, index) => {
  const filePath = `docs/${link}`;
  let html = "";
  let meta = {
    title: "", description: "", datePublished: "", dateModified: "",
    author: "", authorUrl: "", image: "", sameAs: [], keywords: [],
    breadcrumbs: [], faqCount: 0, wordCount: 0, hasDataset: false,
    mainContent: "", faqItems: [], howToSteps: [], datasetVariables: [],
    totalCompanies: 0, cityName: "", stateName: "", sectorDistribution: {},
    tableData: [], lastBuild: "",
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
    lastModifiedFull: BUILD_TIMESTAMP.replace("T", " ").split(".")[0],
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
    // Novos campos
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

const fullTimestamp = BUILD_TIMESTAMP.replace("T", " ").split(".")[0];

mkdirSync("docs", { recursive: true });

// ============================================================
// 2. GLOSSARIO.JSON (agora com dados completos)
// ============================================================
const glossario = {
  "@context": ["https://schema.org", { "skos": "http://www.w3.org/2004/02/skos/core#", "proof": "https://w3id.org/security#" }],
  "@type": "DataCatalog",
  "@id": "urn:protocolo-hidra:catalog:2026",
  name: "Protocolo Hidra — Diretorio B2B",
  description: "Diretorio completo de listas empresariais, ferramentas de consulta, guias de prospeccao e comparativos do ecossistema Paulo Leads.",
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
console.log(`✅ glossario.json gerado com ${terms.length} termos (agora com dados completos)`);

// ============================================================
// 3. SITEMAP (mantido igual)
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
// 4. ROBOTS.TXT (mantido igual)
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
// 5. LLMS.TXT (mantido igual)
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
// 6. INJETAR SPINTAX + REMOVER DATAS ANTIGAS (VERSÃO DEFINITIVA)
// ============================================================
console.log("\n📝 Injetando spintax e substituindo TODAS as datas antigas...");
let updatedCount = 0;
let skippedCount = 0;

allLinks.forEach((link) => {
  const filePath = `docs/${link}`;
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️ Arquivo não encontrado: ${filePath}`);
    skippedCount++;
    return;
  }

  try {
    let html = readFileSync(filePath, "utf8");
    const term = terms.find((t) => t.id === linkToSlug(link));
    const phrase = processSpintax(randomSpintax());
    const pageHash = term?.contentHash || createHash("sha256").update(html).digest("hex").substring(0, 16);

    // --- 1. REMOVER BLOCOS SPINTAX ANTIGOS ---
    html = html.replace(/<div class="protocolo-hidra-spintax"[^>]*>[\s\S]*?<\/div>/g, '');
    html = html.replace(/<div style="display:none;"[^>]*data-wikivendas-spintax[^>]*>[\s\S]*?<\/div>/g, '');

    // --- 2. REMOVER AS 2 DATAS ANTIGAS ---
    // 2a. Remove o byline antigo (qualquer parágrafo com classe "byline" que contenha "atualizado em")
    html = html.replace(/<p\s+class="byline"[^>]*>.*?atualizado em.*?<\/p>/gi, '');
    
    // 2b. Remove o rodapé antigo do sources (qualquer parágrafo que contenha "Última revisão")
    html = html.replace(/<p[^>]*>.*?Última revisão.*?<\/p>/gi, '');

    // --- 3. CRIAR AS 2 NOVAS DATAS ---
    const novoTimestamp = `2026-07-08 20:02:07`; // Usando o timestamp do exemplo
    const novoHash = pageHash.substring(0, 16);
    
    const novoByline = `<p class="byline">Por <strong>Paulo C. P. Santos</strong> · Arquiteto do Protocolo Hidra · atualizado em ${novoTimestamp}</p>`;
    const novoRodape = `<p style="font-size:.85rem">Última revisão das fontes e dados: ${novoTimestamp} · Hash: <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${novoHash}</code></p>`;

    // --- 4. INSERIR AS NOVAS DATAS ---
    // 4a. Insere o novo byline ANTES do <div class="hero-cta">
    html = html.replace(/(<div\s+class="hero-cta")/, `${novoByline}\n    $1`);
    
    // 4b. Insere o novo rodapé DENTRO do <aside class="sources">, antes do </aside>
    html = html.replace(/(<\/aside>)/, `${novoRodape}\n$1`);

    // --- 5. CRIAR O BLOCO SPINTAX VISÍVEL ---
    const spintaxVisible = `
<!-- Protocolo Hidra | Frase gerada em ${fullTimestamp} | Hash: ${pageHash} -->
<div class="protocolo-hidra-spintax" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">
  <p style="margin:0;font-style:italic;">&ldquo;${phrase}&rdquo;</p>
  <p style="margin:6px 0 0;font-size:0.75rem;color:#64748B;">
    <strong>Protocolo Hidra</strong> · Gerado em ${fullTimestamp} · 
    <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${pageHash.substring(0, 12)}</code>
  </p>
</div>
`;

    // --- 6. INSERIR O BLOCO SPINTAX ---
    // Insere depois do </aside> (que agora já tem o novo rodapé)
    html = html.replace(/(<\/aside>)/, `$1\n${spintaxVisible}`);

    // --- 7. ATUALIZAR dateModified NO JSON-LD ---
    html = html.replace(/"dateModified":"[^"]+"/, `"dateModified":"${fullTimestamp}"`);

    // --- 8. ATUALIZAR META DESCRIPTION ---
    const metaDesc = `<meta name="description" content="${(term?.description || linkToName(link)).substring(0, 130)} — Gerado em ${fullTimestamp} | Hash: ${pageHash.substring(0, 12)}">`;
    if (/<meta name="description"/i.test(html)) {
      html = html.replace(/<meta name="description"[^>]*>/i, metaDesc);
    } else {
      html = html.replace(/<head>/i, `<head>\n  ${metaDesc}`);
    }

    // --- 9. ESCREVER O ARQUIVO ---
    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    skippedCount++;
    console.warn(`  ⚠️ Erro em ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} páginas atualizadas com as 2 novas datas e spintax`);
if (skippedCount > 0) console.log(`⚠️ ${skippedCount} páginas não puderam ser processadas`);

// ============================================================
// 7. SCRIPT.JS (mantido igual)
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
console.log(`   📁 docs/glossario.json — ${terms.length} termos (agora com dados completos)`);
console.log(`   📁 docs/sitemap.xml — ${sitemapEntries.length} URLs (com horario completo)`);
console.log(`   📁 docs/robots.txt — 20+ crawlers`);
console.log(`   📁 docs/llms.txt`);
console.log(`   📁 docs/script.js`);
console.log(`   📁 ${updatedCount} paginas atualizadas`);
console.log(`   🕐 Build: ${fullTimestamp}`);
console.log(`   👁️ Spintax VISIVEL + 2 novas datas em todas as paginas`);
