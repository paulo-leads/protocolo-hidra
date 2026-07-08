import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import path from "path";

const SITE_ROOT = "/home/ubuntu/protocolo-hidra";
const DOCS_DIR = path.join(SITE_ROOT, "docs");
const SITE_URL = "https://paulo-leads.github.io/protocolo-hidra";
const BUILD_TIMESTAMP = new Date().toISOString();
const BUILD_DATE = BUILD_TIMESTAMP.split("T")[0];
const fullTimestamp = BUILD_TIMESTAMP.replace("T", " ").split(".")[0];

const SPINTAX = [
  "Segundo {Steve Jobs}, {a inovacao} {distingue um lider de um seguidor|e o que separa quem lidera de quem segue}.",
  "Como diria {Peter Drucker}, {o melhor jeito de prever o futuro e cria-lo|nao se gerencia o que nao se mede}.",
  "{Jeff Bezos} ensina que {sua marca e o que as people dizem sobre voce quando voce nao esta na sala|o cliente e o centro do universo}.",
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

function randomSpintax() { return SPINTAX[Math.floor(Math.random() * SPINTAX.length)]; }
function processSpintax(text) { return text.replace(/\{([^}]+)\}/g, (_, g) => g.split("|")[Math.floor(Math.random() * g.split("|").length)]); }

function scanLinks(dir) {
  const links = [];
  if (!existsSync(dir)) return links;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "assets") {
      links.push(...scanLinks(fullPath));
    } else if (entry.name === "index.html") {
      links.push(fullPath);
    }
  }
  return links;
}

const allFiles = scanLinks(DOCS_DIR);
console.log(`📡 Escaneadas ${allFiles.length} paginas`);

let updatedCount = 0;
allFiles.forEach((filePath) => {
  try {
    let html = readFileSync(filePath, "utf8");
    const name = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || path.basename(path.dirname(filePath))).trim();
    const contentHash = createHash("sha256").update(name + filePath + BUILD_TIMESTAMP).digest("hex");
    const phrase = processSpintax(randomSpintax());

    // 1. LIMPEZA ROBUSTA
    html = html.replace(/<div\s+class="protocolo-hidra-spintax"[^>]*>[\s\S]*?<\/div>/gi, '');
    html = html.replace(/<!-- Protocolo Hidra | Frase gerada[\s\S]*?-->/gi, '');
    html = html.replace(/<p[^>]*class="byline"[^>]*>[\s\S]*?<\/p>/gi, '');
    html = html.replace(/<p[^>]*>Última revisão das fontes e dados:[\s\S]*?<\/p>/gi, '');

    // 2. ELEMENTOS
    const novoByline = `<p class="byline">Por <strong>Paulo C. P. Santos</strong> · Arquiteto do Protocolo Hidra · atualizado em ${fullTimestamp}</p>`;
    const novoRodape = `<p style="font-size:.85rem">Última revisão das fontes e dados: ${fullTimestamp} · Hash: <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${contentHash.substring(0, 16)}</code></p>`;
    const spintaxVisible = `\n<!-- Protocolo Hidra | Frase gerada em ${fullTimestamp} | Hash: ${contentHash} -->\n<div class="protocolo-hidra-spintax" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">\n  <p style="margin:0;font-style:italic;">&ldquo;${phrase}&rdquo;</p>\n  <p style="margin:6px 0 0;font-size:0.75rem;color:#64748B;">\n    <strong>Protocolo Hidra</strong> · Gerado em ${fullTimestamp} · \n    <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">${contentHash.substring(0, 12)}</code>\n  </p>\n</div>\n`;

    // 3. INSERÇÃO ESTRUTURAL
    // Inserir Byline: Procura hero-ctas, hero-cta, lead ou h1
    if (html.includes('class="hero-ctas"')) {
      html = html.replace(/(<div\s+class="hero-ctas")/i, `${novoByline}\n    $1`);
    } else if (html.includes('class="hero-cta"')) {
      html = html.replace(/(<div\s+class="hero-cta")/i, `${novoByline}\n    $1`);
    } else if (html.includes('class="lead"')) {
      html = html.replace(/(<p\s+class="lead"[^>]*>.*?<\/p>)/i, `$1\n    ${novoByline}`);
    } else if (html.includes('</h1>')) {
      html = html.replace(/(<\/h1>)/i, `$1\n    ${novoByline}`);
    }

    // Inserir Rodapé e Spintax: Procura </main>, </footer> ou </body>
    if (html.includes('</main>')) {
      html = html.replace(/(<\/main>)/i, `${novoRodape}${spintaxVisible}$1`);
    } else if (html.includes('<footer')) {
      html = html.replace(/(<footer)/i, `${novoRodape}${spintaxVisible}$1`);
    } else {
      html = html.replace(/(<\/body>)/i, `${novoRodape}${spintaxVisible}$1`);
    }

    // 4. METADADOS
    html = html.replace(/"dateModified"\s*:\s*"[^"]+"/, `"dateModified":"${fullTimestamp}"`);

    writeFileSync(filePath, html, "utf8");
    updatedCount++;
  } catch (err) { console.warn(`⚠️ Erro em ${filePath}: ${err.message}`); }
});
console.log(`✅ ${updatedCount} páginas atualizadas.`);
