import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";

/**
 * ============================================================
 * 📋 SCRIPT DE BUILD - PROTOCOLO HIDRA (VERSÃO ROBUSTA)
 * ============================================================
 * Objetivo: Automatizar a geração de metadados e a atualização 
 * dinâmica de 672 páginas HTML do site Protocolo Hidra.
 * 
 * Funcionalidades:
 * 1. Scan de diretórios para localizar arquivos index.html.
 * 2. Extração rica de metadados (JSON-LD, FAQ, HowTo, Tabelas).
 * 3. Geração de arquivos técnicos: glossario.json, sitemap.xml, robots.txt, llms.txt.
 * 4. Injeção de Spintax e Timestamps dinâmicos com Hash SHA-256.
 * 5. Limpeza de resíduos de builds anteriores.
 * ============================================================
 */

// --- CONFIGURAÇÃO ---
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BASE_PATH = "/protocolo-hidra/";
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];
const fullTimestamp = BUILD_TIMESTAMP.replace("T", " ").split(".")[0];

// ============================================================
// 1. SPINTAX (Dicionário de frases aleatórias)
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
// 2. SCAN LINKS (Localização recursiva de páginas)
// ============================================================
function scanLinks(dir = "docs", basePath = BASE_PATH) {
  const links = [];
  if (!existsSync(dir)) return links;
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
// 3. HELPERS (Tratamento de strings e URLs)
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
  const slug = linkToSlug(link);
  return slug === "" ? `${SITE_URL}/` : `${SITE_URL}/${slug}/`;
}

function categorizeLink(link) {
  if (link === "index.html") return "Home";
  if (/^consulta-|^cartao-cnpj|^certidao|^dados-cadastrais|^redesim|^situacao-cadastral|^consultar-/.test(link)) return "Ferramentas de Consulta";
  if (/^empresas-em-/.test(link)) return "Listas por Cidade";
  if (/^empresas-no-|^empresas-na-/.test(link)) return "Listas por Estado";
  if (/^lista-de-/.test(link)) return "Listas por Nicho / Segmento";
  if (/^como-|^prospeccao-|^prospectar-|^script-|^modelo-|^texto-|^cadencia-|^captacao-|^funil-|^maquina-|^playbook-|^pitch-|^sdr-|^outbound-|^vendas-b2b|^b2b-|^mercado-b2b|^geracao-|^gerador-|^gerar-|^lead-|^leads-|^icp-|^econodata-|^alternativa-|^melhor-|^ferramenta-|^nichos-|^quantas-|^vitor-azevedo/.test(link)) return "Guias e Playbooks";
  if (/^leadjet-vs-|^comparativos/.test(link)) return "Comparativos";
  return "Outros";
}

// ============================================================
// 4. EXTRACTOR ROBUSTO (Mineração de dados do HTML)
// ============================================================
function extractMetaFromHtml(html, link) {
  const meta = {
    title: "", description: "", datePublished: "", dateModified: "",
    author: "", authorUrl: "", image: "", sameAs: [], keywords: [],
    breadcrumbs: [], faqCount: 0, wordCount: 0, hasDataset: false,
    mainContent: "", faqItems: [], howToSteps: [], datasetVariables: [],
    totalCompanies: 0, cityName: "", stateName: "", sectorDistribution: {},
    tableData: [], lastBuild: "",
  };

  // Título e Meta Description
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) meta.title = titleMatch[1].trim();
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (descMatch) meta.description = descMatch[1].trim();

  // Datas (Extraídas do JSON-LD)
  const dpMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/);
  if (dpMatch) meta.datePublished = dpMatch[1];
  const dmMatch = html.match(/"dateModified"\s*:\s*"([^"]+)"/);
  if (dmMatch) meta.dateModified = dmMatch[1];

  // Autor e Redes Sociais
  const authorMatch = html.match(/"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) meta.author = authorMatch[1];
  const authorUrlMatch = html.match(/"author"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"/);
  if (authorUrlMatch) meta.authorUrl = authorUrlMatch[1];

  // Imagens (OG e JSON-LD)
  const imgMatch = html.match(/"image"\s*:\s*"([^"]+)"/);
  if (imgMatch) meta.image = imgMatch[1];
  const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  if (ogImgMatch && !meta.image) meta.image = ogImgMatch[1];

  // sameAs (Links externos)
  const sameAsSection = html.match(/"sameAs"\s*:\s*\[([^\]]+)\]/);
  if (sameAsSection) {
    meta.sameAs = sameAsSection[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean);
  }

  // Keywords e Breadcrumbs
  const kwMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]+)"/i);
  if (kwMatch) meta.keywords = kwMatch[1].split(",").map((s) => s.trim());
  const bcMatches = html.matchAll(/"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"/g);
  for (const bc of bcMatches) meta.breadcrumbs.push(bc[1]);

  // FAQ e HowTo
  const faqMatches = html.match(/"@type"\s*:\s*"Question"/g);
  if (faqMatches) meta.faqCount = faqMatches.length;
  const faqItemMatches = html.matchAll(/"@type"\s*:\s*"Question"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"acceptedAnswer"\s*:\s*\{[^}]*"text"\s*:\s*"([^"]+)"/g);
  for (const match of faqItemMatches) meta.faqItems.push({ question: match[1], answer: match[2] });
  const stepMatches = html.matchAll(/"@type"\s*:\s*"HowToStep"\s*,\s*"position"\s*:\s*(\d+)\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"([^"]+)"/g);
  for (const match of stepMatches) meta.howToSteps.push({ position: parseInt(match[1]), name: match[2], text: match[3] });

  // Dataset e Variáveis
  meta.hasDataset = html.includes('"@type":"Dataset"');
  const varMatch = html.match(/"variableMeasured"\s*:\s*\[([^\]]+)\]/);
  if (varMatch) meta.datasetVariables = varMatch[1].split(",").map(v => v.replace(/["']/g, "").trim());

  // Dados Estatísticos (Empresas, Cidade, Setores)
  const totalMatch = html.match(/(\d{1,3}(?:\.\d{3})*)\s*empresas ativas/);
  if (totalMatch) meta.totalCompanies = parseInt(totalMatch[1].replace(/\./g, ''));
  const cityMatch = html.match(/<h1[^>]*>.*?em\s+([A-Za-zÀ-ÿ\s]+)\s*\(([A-Z]{2})\)/i);
  if (cityMatch) { meta.cityName = cityMatch[1].trim(); meta.stateName = cityMatch[2].trim(); }
  const sectorMatches = html.matchAll(/<b>([^<]+)\s*<small[^>]*>([^<]+)<\/small><\/b>\s*<em>(\d+)%<\/em>/g);
  for (const match of sectorMatches) {
    meta.sectorDistribution[match[1].trim()] = { count: parseInt(match[2].replace(/\./g, '')), percentage: parseInt(match[3]) };
  }

  // Tabelas de Dados
  const tableRows = html.match(/<tr><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td><\/tr>/g);
  if (tableRows) {
    for (const row of tableRows) {
      const cells = row.match(/<t[hd][^>]*>([^<]+)<\/t[hd]>/g);
      if (cells && cells.length >= 3) {
        const rowData = cells.map(cell => cell.replace(/<[^>]+>/g, '').trim());
        meta.tableData.push({ bairro: rowData[0], empresas: parseInt(rowData[1].replace(/\./g, '')), posicao: rowData[2] });
      }
    }
  }

  // Word Count e Main Content
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) meta.mainContent = mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  meta.wordCount = textContent.split(" ").length;

  return meta;
}

// ============================================================
// 5. EXECUÇÃO PRINCIPAL
// ============================================================
const allLinks = scanLinks();
console.log(`\n📡 Escaneadas ${allLinks.length} paginas`);

console.log("\n📖 Extraindo metadados e processando paginas...");
const terms = allLinks.map((link, index) => {
  const filePath = path.join("docs", link);
  let html = "";
  let meta = {};

  try {
    html = readFileSync(filePath, "utf8");
    meta = extractMetaFromHtml(html, link);
  } catch (err) {
    console.warn(`  ⚠️ Nao foi possivel ler ${link}: ${err.message}`);
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
    name, url, category, index: index + 1,
    description: meta.description || "",
    contentHash,
    lastModified: meta.dateModified || BUILD_DATE,
    lastModifiedFull: fullTimestamp,
    datePublished: meta.datePublished || BUILD_DATE,
    author: meta.author || "Paulo C. P. Santos",
    authorUrl: meta.authorUrl || `${SITE_URL}/paulo-leads/`,
    image: meta.image || `${SITE_URL}/assets/img/protocolo-hidra-painel-1200.png`,
    wordCount: meta.wordCount || 0,
    faqCount: meta.faqCount || 0,
    hasDataset: meta.hasDataset || false,
    keywords: meta.keywords || [],
    breadcrumbs: meta.breadcrumbs || [],
    businessPhrase,
    sameAs: meta.sameAs || [],
    inDefinedTermSet: "urn:protocolo-hidra:2026",
    mainContent: meta.mainContent || "",
    faqItems: meta.faqItems || [],
    howToSteps: meta.howToSteps || [],
    datasetVariables: meta.datasetVariables || [],
    totalCompanies: meta.totalCompanies || 0,
    cityName: meta.cityName || "",
    stateName: meta.stateName || "",
    sectorDistribution: meta.sectorDistribution || {},
    tableData: meta.tableData || [],
  };
});

// --- GERAÇÃO DE ARQUIVOS TÉCNICOS ---

// 1. GLOSSARIO.JSON
const glossario = {
  "@context": ["https://schema.org", { "skos": "http://www.w3.org/2004/02/skos/core#", "proof": "https://w3id.org/security#" }],
  "@type": "DataCatalog",
  "@id": "urn:protocolo-hidra:catalog:2026",
  name: "Protocolo Hidra — Diretorio B2B",
  description: "Diretorio completo de listas empresariais, ferramentas de consulta, guias de prospeccao e comparativos.",
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
console.log(`✅ glossario.json gerado`);

// 2. SITEMAP.XML
const sitemapEntries = [{ url: `${SITE_URL}/`, priority: "1.0", changefreq: "daily", lastmod: fullTimestamp }];
const categories = {};
terms.forEach((t) => { if (!categories[t.category]) categories[t.category] = []; categories[t.category].push(t); });
Object.keys(categories).forEach((cat) => {
  sitemapEntries.push({ url: `${SITE_URL}/#${cat.toLowerCase().replace(/\s+/g, "-")}`, priority: "0.9", changefreq: "daily", lastmod: fullTimestamp });
});
sitemapEntries.push(
  { url: `${SITE_URL}/glossario.json`, priority: "0.9", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/sitemap.xml`, priority: "0.7", changefreq: "hourly", lastmod: fullTimestamp },
  { url: `${SITE_URL}/llms.txt`, priority: "0.8", changefreq: "hourly", lastmod: fullTimestamp }
);
terms.forEach((t) => {
  const priority = t.index <= 10 ? "0.8" : t.index <= 50 ? "0.7" : t.index <= 200 ? "0.6" : "0.5";
  sitemapEntries.push({ url: t.url, priority, changefreq: "weekly", lastmod: t.lastModifiedFull || fullTimestamp });
});
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map((e) => `  <url>\n    <loc>${e.url}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`).join("\n")}\n</urlset>`;
writeFileSync("docs/sitemap.xml", sitemapXml, "utf8");
console.log(`✅ sitemap.xml gerado`);

// 3. ROBOTS.TXT
const robots = `# Protocolo Hidra — Diretorio B2B\n# Build: ${fullTimestamp}\n\nUser-agent: *\nAllow: /\nAllow: /glossario.json\nAllow: /llms.txt\nAllow: /sitemap.xml\nDisallow: /node_modules/\nSitemap: ${SITE_URL}/sitemap.xml\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ChatGPT-User\nAllow: /\nUser-agent: Anthropic-ai\nAllow: /\nUser-agent: Claude-Web\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n`;
writeFileSync("docs/robots.txt", robots, "utf8");
console.log("✅ robots.txt gerado");

// 4. LLMS.TXT
const llmsLines = [`# Protocolo Hidra — Diretorio B2B`, `> Canonical-Source: ${SITE_URL}`, `> Language: pt-BR`, `> Last-Modified: ${fullTimestamp}`, `> Total Pages: ${terms.length}`, `> API JSON: ${SITE_URL}/glossario.json`, ``, `# Categorias`, ``];
Object.entries(categories).forEach(([cat, catTerms]) => {
  llmsLines.push(`## ${cat} (${catTerms.length} paginas)`);
  catTerms.slice(0, 20).forEach((t) => llmsLines.push(`- ${t.name}: ${t.url}`));
  llmsLines.push(``);
});
writeFileSync("docs/llms.txt", llmsLines.join("\n") + "\n", "utf8");
console.log("✅ llms.txt gerado");

// --- INJEÇÃO DE CONTEÚDO NAS PÁGINAS ---

console.log("\n📝 Atualizando paginas HTML...");
let updatedCount = 0;

allLinks.forEach((link) => {
  const filePath = path.join("docs", link);
  try {
    let html = readFileSync(filePath, "utf8");
    const term = terms.find((t) => t.id === linkToSlug(link));
    const phrase = processSpintax(randomSpintax());
    const pageHash = term?.contentHash || createHash("sha256").update(html).digest("hex").substring(0, 16);

    // --- 1. LIMPEZA (Remoção de lixo e datas antigas) ---
    html = html.replace(/<div\s+class="protocolo-hidra-spintax"[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<div\s+style="display:none;"[^>]*data-wikivendas-spintax[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<!-- Protocolo Hidra | Frase gerada[\s\S]*?-->/gi, '');
    
    // Regex robusta para Byline e Rodapé (Captura variações de tags e atributos)
    html = html.replace(/<p[^>]*class="byline"[^>]*>[\s\S]*?atualizado em[\s\S]*?<\/p>/gi, '');
    html = html.replace(/<p[^>]*>[\s\S]*?Última revisão[\s\S]*?<\/p>/gi, '');
    html = html.replace(/<p[^>]*>[\s\S]*?atualizado em[\s\S]*?<\/p>/gi, ''); // Fallback extra

    // --- 2. NOVOS ELEMENTOS ---
    const novoByline = `<p class="byline">Por <strong>Paulo C. P. Santos</strong> · Arquiteto do Protocolo Hidra · atualizado em ${fullTimestamp}</p>`;
    const novoRodape = `<p style="font-size:.85rem">Última revisão das fontes e dados: ${fullTimestamp} · Hash: <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${pageHash.substring(0, 16)}</code></p>`;
    
    const spintaxVisible = `\n<!-- Protocolo Hidra | Frase gerada em ${fullTimestamp} | Hash: ${pageHash} -->\n<div class="protocolo-hidra-spintax" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">\n  <p style="margin:0;font-style:italic;">&ldquo;${phrase}&rdquo;</p>\n  <p style="margin:6px 0 0;font-size:0.75rem;color:#64748B;">\n    <strong>Protocolo Hidra</strong> · Gerado em ${fullTimestamp} · \n    <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${pageHash.substring(0, 12)}</code>\n  </p>\n</div>\n`;

    // --- 3. INSERÇÃO ESTRUTURAL ---
    
    // Inserção do Byline (Antes do CTA ou Lead)
    if (/<div\s+class="hero-ctas?"/i.test(html)) {
      html = html.replace(/(<div\s+class="hero-ctas?")/i, `${novoByline}\n    $1`);
    } else if (/<div\s+class="signals"/i.test(html)) {
      html = html.replace(/(<div\s+class="signals")/i, `${novoByline}\n    $1`);
    } else if (/<p\s+class="(lead|text)"[^>]*>/i.test(html)) {
      html = html.replace(/(<p\s+class="(lead|text)"[^>]*>.*?<\/p>)/i, `$1\n    ${novoByline}`);
    }

    // Inserção do Rodapé (Dentro do .wrap de aside.sources)
    const sourcesWrapRegex = /(<aside\s+class="sources"[^>]*>[\s\S]*?<div\s+class="wrap"[^>]*>)/i;
    if (sourcesWrapRegex.test(html)) {
      html = html.replace(sourcesWrapRegex, `$1\n      ${novoRodape}`);
    } else if (/<aside\s+class="sources"/i.test(html)) {
      html = html.replace(/(<\/aside>)/i, `${novoRodape}\n$1`);
    } else {
      html = html.replace(/(<\/main>)/i, `${novoRodape}\n$1`);
    }

    // Inserção do Spintax (Após o aside.sources)
    if (/<aside\s+class="sources"/i.test(html)) {
      html = html.replace(/(<\/aside>)/i, `$1\n${spintaxVisible}`);
    } else {
      html = html.replace(/(<\/main>)/i, `${spintaxVisible}\n$1`);
    }

    // --- 4. ATUALIZAÇÃO DE METADADOS ---
    html = html.replace(/"datePublished"\s*:\s*"[^"]+"/, `"datePublished":"${BUILD_DATE}"`);
    html = html.replace(/"dateModified"\s*:\s*"[^"]+"/, `"dateModified":"${fullTimestamp}"`);

    const metaDesc = `<meta name="description" content="${(term?.description || name).substring(0, 130)} — Gerado em ${fullTimestamp} | Hash: ${pageHash.substring(0, 12)}">`;
    if (/<meta\s+name="description"/i.test(html)) {
      html = html.replace(/<meta\s+name="description"[^>]*>/i, metaDesc);
    } else {
      html = html.replace(/<head>/i, `<head>\n  ${metaDesc}`);
    }

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) {
    console.warn(`  ⚠️ Erro em ${link}: ${err.message}`);
  }
});

console.log(`✅ ${updatedCount} páginas atualizadas com sucesso.`);
