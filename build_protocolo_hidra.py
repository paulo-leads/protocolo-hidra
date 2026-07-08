#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import re
import json
import hashlib
import random
from datetime import datetime
from bs4 import BeautifulSoup

# ============================================================
# CONFIGURAÇÃO
# ============================================================
SITE_URL = "https://paulo-leads.github.io/protocolo-hidra"
BASE_PATH = "/protocolo-hidra/"
BUILD_TIMESTAMP = datetime.utcnow().isoformat()  # "2026-07-08T20:02:07.123Z"
BUILD_DATE = BUILD_TIMESTAMP.split("T")[0]       # "2026-07-08"
FULL_TIMESTAMP = BUILD_TIMESTAMP.replace("T", " ").split(".")[0]  # "2026-07-08 20:02:07"

# ============================================================
# SPINTAX (mesmo conteúdo)
# ============================================================
SPINTAX = [
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
]

def random_spintax():
    return random.choice(SPINTAX)

def process_spintax(text):
    def repl(match):
        options = match.group(1).split("|")
        return random.choice(options).strip()
    return re.sub(r"\{([^}]+)\}", repl, text)

# ============================================================
# HELPERS
# ============================================================
def link_to_name(link):
    name = link.replace("/index.html", "").replace("-", " ")
    name = re.sub(r"\b\w", lambda m: m.group(0).upper(), name)
    for word in [" De ", " Da ", " Do ", " Em ", " E "]:
        name = name.replace(word, word.lower())
    return name

def link_to_slug(link):
    return link.replace("/index.html", "")

def link_to_url(link):
    return f"{SITE_URL}/{link_to_slug(link)}/"

def categorize_link(link):
    if re.search(r"^consulta-|^cartao-cnpj|^certidao|^dados-cadastrais|^redesim|^situacao-cadastral|^consultar-", link):
        return "Ferramentas de Consulta"
    if re.search(r"^empresas-em-", link):
        return "Listas por Cidade"
    if re.search(r"^empresas-no-|^empresas-na-", link):
        return "Listas por Estado"
    if re.search(r"^lista-de-", link):
        return "Listas por Nicho / Segmento"
    if re.search(r"^como-|^prospeccao-|^prospectar-|^script-|^modelo-|^texto-|^cadencia-|^captacao-|^funil-|^maquina-|^playbook-|^pitch-|^sdr-|^outbound-|^vendas-b2b|^b2b-|^mercado-b2b|^geracao-|^gerador-|^gerar-|^lead-|^leads-|^icp-|^econodata-|^alternativa-|^melhor-|^ferramenta-|^nichos-|^quantas-|^vitor-azevedo", link):
        return "Guias e Playbooks"
    if re.search(r"^leadjet-vs-|^comparativos", link):
        return "Comparativos"
    return "Outros"

# ============================================================
# EXTRAÇÃO DE METADADOS (com BeautifulSoup + regex para JSON-LD)
# ============================================================
def extract_meta_from_html(html, link):
    soup = BeautifulSoup(html, "lxml")
    meta = {
        "title": "",
        "description": "",
        "datePublished": "",
        "dateModified": "",
        "author": "",
        "authorUrl": "",
        "image": "",
        "sameAs": [],
        "keywords": [],
        "breadcrumbs": [],
        "faqCount": 0,
        "wordCount": 0,
        "hasDataset": False,
        "mainContent": "",
        "faqItems": [],
        "howToSteps": [],
        "datasetVariables": [],
        "totalCompanies": 0,
        "cityName": "",
        "stateName": "",
        "sectorDistribution": {},
        "tableData": [],
    }

    # Título
    title_tag = soup.find("title")
    if title_tag:
        meta["title"] = title_tag.get_text(strip=True)

    # Description
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag and desc_tag.get("content"):
        meta["description"] = desc_tag["content"].strip()

    # Datas (extraídas do JSON-LD)
    jsonld_scripts = soup.find_all("script", type="application/ld+json")
    for script in jsonld_scripts:
        try:
            data = json.loads(script.string)
            # Se for um graph, percorremos
            if isinstance(data, dict) and "@graph" in data:
                for item in data["@graph"]:
                    if "datePublished" in item:
                        meta["datePublished"] = item["datePublished"]
                    if "dateModified" in item:
                        meta["dateModified"] = item["dateModified"]
                    if "author" in item and isinstance(item["author"], dict):
                        if "name" in item["author"]:
                            meta["author"] = item["author"]["name"]
                        if "url" in item["author"]:
                            meta["authorUrl"] = item["author"]["url"]
                    if "image" in item:
                        meta["image"] = item["image"]
                    if "sameAs" in item:
                        meta["sameAs"] = item["sameAs"]
                    if "keywords" in item:
                        meta["keywords"] = item["keywords"]
                    if "breadcrumbs" in item:
                        meta["breadcrumbs"] = item["breadcrumbs"]
                    if item.get("@type") == "FAQPage" and "mainEntity" in item:
                        meta["faqCount"] = len(item["mainEntity"])
                        for q in item["mainEntity"]:
                            if q.get("@type") == "Question":
                                meta["faqItems"].append({
                                    "question": q.get("name", ""),
                                    "answer": q.get("acceptedAnswer", {}).get("text", "")
                                })
                    if item.get("@type") == "HowTo" and "step" in item:
                        for step in item["step"]:
                            meta["howToSteps"].append({
                                "position": step.get("position"),
                                "name": step.get("name"),
                                "text": step.get("text")
                            })
                    if item.get("@type") == "Dataset":
                        meta["hasDataset"] = True
                        if "variableMeasured" in item:
                            meta["datasetVariables"] = item["variableMeasured"]
            elif isinstance(data, dict):
                # Objeto único
                if "datePublished" in data:
                    meta["datePublished"] = data["datePublished"]
                if "dateModified" in data:
                    meta["dateModified"] = data["dateModified"]
                # ... etc (pode expandir se necessário)
        except:
            pass

    # Fallback se não encontrou no JSON-LD: procurar no HTML com regex
    if not meta["datePublished"]:
        dp_match = re.search(r'"datePublished":"([^"]+)"', html)
        if dp_match:
            meta["datePublished"] = dp_match.group(1)
    if not meta["dateModified"]:
        dm_match = re.search(r'"dateModified":"([^"]+)"', html)
        if dm_match:
            meta["dateModified"] = dm_match.group(1)

    # Autor via regex
    if not meta["author"]:
        author_match = re.search(r'"author"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"', html)
        if author_match:
            meta["author"] = author_match.group(1)

    # Imagem
    if not meta["image"]:
        img_match = re.search(r'"image":"([^"]+)"', html)
        if img_match:
            meta["image"] = img_match.group(1)
        else:
            og_img = soup.find("meta", property="og:image")
            if og_img and og_img.get("content"):
                meta["image"] = og_img["content"]

    # Keywords
    if not meta["keywords"]:
        kw_tag = soup.find("meta", attrs={"name": "keywords"})
        if kw_tag and kw_tag.get("content"):
            meta["keywords"] = [k.strip() for k in kw_tag["content"].split(",")]

    # Breadcrumbs (extrair do JSON-LD ou do HTML)
    # Já extraímos do JSON-LD, mas se não tiver, tenta do HTML
    if not meta["breadcrumbs"]:
        bc_items = re.findall(r'"item"\s*:\s*"[^"]*"\s*,\s*"name"\s*:\s*"([^"]+)"', html)
        if bc_items:
            meta["breadcrumbs"] = bc_items

    # FAQ Count
    if meta["faqCount"] == 0:
        meta["faqCount"] = len(re.findall(r'"@type":"Question"', html))

    # Dataset
    if not meta["hasDataset"]:
        meta["hasDataset"] = '"@type":"Dataset"' in html

    # Total de empresas
    total_match = re.search(r'(\d{1,3}(?:\.\d{3})*)\s*empresas ativas', html)
    if total_match:
        meta["totalCompanies"] = int(total_match.group(1).replace(".", ""))

    # Cidade/Estado
    city_match = re.search(r'<h1[^>]*>.*?em\s+([A-Za-zÀ-ÿ\s]+)\s*\(([A-Z]{2})\)', html, re.I)
    if city_match:
        meta["cityName"] = city_match.group(1).strip()
        meta["stateName"] = city_match.group(2).strip()

    # Distribuição por setor (ex: "Serviços 57%")
    sector_matches = re.findall(r'<b>([^<]+)\s*<small[^>]*>([^<]+)<\/small><\/b>\s*<em>(\d+)%<\/em>', html)
    for name, count, perc in sector_matches:
        meta["sectorDistribution"][name.strip()] = {
            "count": int(count.replace(".", "")),
            "percentage": int(perc)
        }

    # Tabelas (ex: bairro, empresas, posição)
    table_rows = re.findall(r'<tr><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><td[^>]*>([^<]+)<\/td><\/tr>', html)
    for row in table_rows:
        meta["tableData"].append({
            "bairro": row[0],
            "empresas": int(row[1].replace(".", "")),
            "posicao": row[2]
        })

    # Conteúdo principal (texto do <main>)
    main_tag = soup.find("main")
    if main_tag:
        meta["mainContent"] = main_tag.get_text(" ", strip=True)

    # Contagem de palavras (todo o texto)
    text_content = soup.get_text(" ", strip=True)
    meta["wordCount"] = len(text_content.split())

    return meta

# ============================================================
# ESCANEAMENTO DE ARQUIVOS
# ============================================================
def scan_links(directory="docs"):
    links = []
    for root, dirs, files in os.walk(directory):
        # Ignora pastas ocultas e node_modules
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != "node_modules"]
        for file in files:
            if file == "index.html":
                full_path = os.path.join(root, file)
                relative = os.path.relpath(full_path, "docs")
                links.append(relative)
    return sorted(links)

# ============================================================
# MAIN
# ============================================================
all_links = scan_links()
print(f"\n📡 Escaneadas {len(all_links)} paginas")

terms = []
for idx, link in enumerate(all_links, start=1):
    file_path = os.path.join("docs", link)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()
        meta = extract_meta_from_html(html, link)
    except Exception as e:
        print(f"  ⚠️ Erro ao ler {link}: {e}")
        meta = {}

    name = meta.get("title") or link_to_name(link)
    url = link_to_url(link)
    category = categorize_link(link)
    content_hash = hashlib.sha256((name + url + BUILD_TIMESTAMP).encode()).hexdigest()
    raw_quote = process_spintax(random_spintax())
    business_phrase = f"{name}: {raw_quote}"

    terms.append({
        "id": link_to_slug(link),
        "name": name,
        "url": url,
        "category": category,
        "index": idx,
        "description": meta.get("description", ""),
        "contentHash": content_hash,
        "lastModified": meta.get("dateModified") or BUILD_DATE,
        "lastModifiedFull": FULL_TIMESTAMP,
        "datePublished": meta.get("datePublished") or BUILD_DATE,
        "author": meta.get("author") or "Paulo C. P. Santos",
        "authorUrl": meta.get("authorUrl") or f"{SITE_URL}/paulo-leads/",
        "image": meta.get("image") or f"{SITE_URL}/assets/img/protocolo-hidra-painel-1200.png",
        "wordCount": meta.get("wordCount", 0),
        "faqCount": meta.get("faqCount", 0),
        "hasDataset": meta.get("hasDataset", False),
        "keywords": meta.get("keywords", []),
        "breadcrumbs": meta.get("breadcrumbs", []),
        "businessPhrase": business_phrase,
        "sameAs": meta.get("sameAs", []),
        "inDefinedTermSet": "urn:protocolo-hidra:2026",
        "mainContent": meta.get("mainContent", ""),
        "faqItems": meta.get("faqItems", []),
        "howToSteps": meta.get("howToSteps", []),
        "datasetVariables": meta.get("datasetVariables", []),
        "totalCompanies": meta.get("totalCompanies", 0),
        "cityName": meta.get("cityName", ""),
        "stateName": meta.get("stateName", ""),
        "sectorDistribution": meta.get("sectorDistribution", {}),
        "tableData": meta.get("tableData", []),
    })

# ============================================================
# GERAR GLOSSARIO
# ============================================================
glossario = {
    "@context": ["https://schema.org", {"skos": "http://www.w3.org/2004/02/skos/core#", "proof": "https://w3id.org/security#"}],
    "@type": "DataCatalog",
    "@id": "urn:protocolo-hidra:catalog:2026",
    "name": "Protocolo Hidra — Diretorio B2B",
    "description": "Diretorio completo de listas empresariais, ferramentas de consulta, guias de prospeccao e comparativos do ecossistema Paulo Leads.",
    "inLanguage": "pt-BR",
    "dateCreated": "2026-06-30",
    "dateModified": BUILD_DATE,
    "lastBuild": FULL_TIMESTAMP,
    "version": BUILD_DATE.replace("-", "."),
    "totalTerms": len(terms),
    "publisher": {
        "@type": "Organization",
        "name": "Protocolo Hidra",
        "url": SITE_URL,
        "founder": {"@type": "Person", "name": "Paulo C. P. Santos", "url": f"{SITE_URL}/paulo-leads/"}
    },
    "proof": {
        "type": "Sha256Hash",
        "hash": hashlib.sha256(json.dumps(terms).encode()).hexdigest(),
        "timestamp": BUILD_TIMESTAMP
    },
    "categoryBreakdown": {},
    "terms": terms
}
# Preencher breakdown
for t in terms:
    cat = t["category"]
    glossario["categoryBreakdown"][cat] = glossario["categoryBreakdown"].get(cat, 0) + 1

with open("docs/glossario.json", "w", encoding="utf-8") as f:
    json.dump(glossario, f, indent=2, ensure_ascii=False)
print(f"✅ glossario.json gerado com {len(terms)} termos")

# ============================================================
# GERAR SITEMAP (sem script.js)
# ============================================================
sitemap_entries = []
sitemap_entries.append({"url": f"{SITE_URL}/", "priority": "1.0", "changefreq": "daily", "lastmod": FULL_TIMESTAMP})

categories = {}
for t in terms:
    categories.setdefault(t["category"], []).append(t)

for cat in categories:
    sitemap_entries.append({
        "url": f"{SITE_URL}/#{cat.lower().replace(' ', '-')}",
        "priority": "0.9",
        "changefreq": "daily",
        "lastmod": FULL_TIMESTAMP
    })

sitemap_entries.extend([
    {"url": f"{SITE_URL}/glossario.json", "priority": "0.9", "changefreq": "hourly", "lastmod": FULL_TIMESTAMP},
    {"url": f"{SITE_URL}/sitemap.xml", "priority": "0.7", "changefreq": "hourly", "lastmod": FULL_TIMESTAMP},
    {"url": f"{SITE_URL}/llms.txt", "priority": "0.8", "changefreq": "hourly", "lastmod": FULL_TIMESTAMP}
])

for t in terms:
    priority = "0.8" if t["index"] <= 10 else ("0.7" if t["index"] <= 50 else ("0.6" if t["index"] <= 200 else "0.5"))
    sitemap_entries.append({
        "url": t["url"],
        "priority": priority,
        "changefreq": "weekly",
        "lastmod": t.get("lastModifiedFull") or FULL_TIMESTAMP
    })

sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
sitemap_xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
for e in sitemap_entries:
    sitemap_xml += f'  <url>\n    <loc>{e["url"]}</loc>\n    <lastmod>{e["lastmod"]}</lastmod>\n    <changefreq>{e["changefreq"]}</changefreq>\n    <priority>{e["priority"]}</priority>\n  </url>\n'
sitemap_xml += '</urlset>'

with open("docs/sitemap.xml", "w", encoding="utf-8") as f:
    f.write(sitemap_xml)
print(f"✅ sitemap.xml gerado com {len(sitemap_entries)} URLs")

# ============================================================
# GERAR ROBOTS.TXT
# ============================================================
robots = f"""# ============================================================
# Protocolo Hidra — Diretorio B2B
# Ultimo build: {FULL_TIMESTAMP}
# ============================================================

User-agent: *
Allow: /
Allow: /glossario.json
Allow: /llms.txt
Allow: /sitemap.xml
Disallow: /node_modules/
Sitemap: {SITE_URL}/sitemap.xml

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
"""
with open("docs/robots.txt", "w", encoding="utf-8") as f:
    f.write(robots)
print("✅ robots.txt gerado")

# ============================================================
# GERAR LLMS.TXT
# ============================================================
llms_lines = [
    "# Protocolo Hidra — Diretorio B2B",
    f"> Canonical-Source: {SITE_URL}",
    f"> Language: pt-BR",
    f"> Last-Modified: {FULL_TIMESTAMP}",
    f"> Total Pages: {len(terms)}",
    f"> API JSON: {SITE_URL}/glossario.json",
    f"> License: CC BY 4.0",
    "",
    "# Categorias",
    ""
]
for cat, cat_terms in categories.items():
    llms_lines.append(f"## {cat} ({len(cat_terms)} paginas)")
    for t in cat_terms[:20]:
        priority = "0.9" if t["index"] <= 10 else ("0.8" if t["index"] <= 50 else "0.7")
        llms_lines.append(f"- {t['name']}: {t['url']} (importancia: {priority})")
    llms_lines.append("")
llms_lines.append("# Metadados Tecnicos")
llms_lines.append(f"> Build: {BUILD_TIMESTAMP}")
llms_lines.append(f"> Total de paginas: {len(terms)}")
llms_lines.append(f"> Total de palavras: {sum(t['wordCount'] for t in terms):,}")

with open("docs/llms.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(llms_lines) + "\n")
print("✅ llms.txt gerado")

# ============================================================
# INJEÇÃO DE SPINTAX + REMOÇÃO/INSERÇÃO DE DATAS (USANDO BEAUTIFULSOUP)
# ============================================================
print("\n📝 Injetando spintax e substituindo TODAS as datas antigas...")
updated_count = 0
skipped_count = 0

for link in all_links:
    file_path = os.path.join("docs", link)
    if not os.path.exists(file_path):
        print(f"  ⚠️ Arquivo não encontrado: {file_path}")
        skipped_count += 1
        continue

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()

        # Encontrar o termo correspondente
        term = next((t for t in terms if t["id"] == link_to_slug(link)), None)
        phrase = process_spintax(random_spintax())
        page_hash = term["contentHash"] if term else hashlib.sha256(html.encode()).hexdigest()[:16]

        # ---------- 1. REMOVER BLOCOS SPINTAX ANTIGOS ----------
        soup = BeautifulSoup(html, "lxml")

        # Remover divs com classe protocolo-hidra-spintax ou data-wikivendas-spintax
        for div in soup.find_all("div", class_="protocolo-hidra-spintax"):
            div.decompose()
        for div in soup.find_all("div", attrs={"data-wikivendas-spintax": True}):
            div.decompose()

        # ---------- 2. REMOVER BYLINE ANTIGO ----------
        # Procurar <p class="byline"> que contenha "atualizado em"
        for p in soup.find_all("p", class_="byline"):
            if p.string and "atualizado em" in p.get_text():
                p.decompose()

        # ---------- 3. REMOVER RODAPÉ ANTIGO (dentro de <aside class="sources">) ----------
        aside = soup.find("aside", class_="sources")
        if aside:
            for p in aside.find_all("p", style=True):
                style = p.get("style", "")
                if "font-size" in style and ".85rem" in style:
                    if "Última revisão" in p.get_text():
                        p.decompose()

        # Fallback: remover qualquer parágrafo com "Última revisão" ou "atualizado em" que possa ter sobrado
        for p in soup.find_all("p"):
            text = p.get_text()
            if "atualizado em" in text or "Última revisão" in text:
                p.decompose()

        # ---------- 4. CRIAR NOVAS DATAS ----------
        novo_byline = f'<p class="byline">Por <strong>Paulo C. P. Santos</strong> · Arquiteto do Protocolo Hidra · atualizado em {FULL_TIMESTAMP}</p>'
        novo_rodape = f'<p style="font-size:.85rem">Última revisão das fontes e dados: {FULL_TIMESTAMP} · Hash: <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">{page_hash[:16]}</code></p>'

        # ---------- 5. INSERIR NOVO BYLINE (antes de hero-cta) ----------
        hero_cta = soup.find("div", class_="hero-cta")
        if hero_cta:
            hero_cta.insert_before(BeautifulSoup(novo_byline, "lxml"))
        else:
            # Fallback: antes de signals ou após lead
            signals = soup.find("div", class_="signals")
            if signals:
                signals.insert_before(BeautifulSoup(novo_byline, "lxml"))
            else:
                lead = soup.find("p", class_="lead")
                if lead:
                    lead.insert_after(BeautifulSoup(novo_byline, "lxml"))
                else:
                    # Inserir antes do fechamento de </main>? Melhor não.
                    pass

        # ---------- 6. INSERIR NOVO RODAPÉ DENTRO DE <aside class="sources"> ----------
        aside = soup.find("aside", class_="sources")
        if aside:
            aside.append(BeautifulSoup(novo_rodape, "lxml"))
        else:
            # Fallback: antes de </main>
            main_tag = soup.find("main")
            if main_tag:
                main_tag.append(BeautifulSoup(novo_rodape, "lxml"))

        # ---------- 7. CRIAR E INSERIR BLOCO SPINTAX ----------
        spintax_html = f"""
<!-- Protocolo Hidra | Frase gerada em {FULL_TIMESTAMP} | Hash: {page_hash} -->
<div class="protocolo-hidra-spintax" style="margin:24px 0;padding:16px 20px;background:#f0f5ff;border-left:4px solid #1D4ED8;border-radius:0 10px 10px 0;font-size:0.95rem;line-height:1.6;color:#0B2545;">
  <p style="margin:0;font-style:italic;">&ldquo;{phrase}&rdquo;</p>
  <p style="margin:6px 0 0;font-size:0.75rem;color:#64748B;">
    <strong>Protocolo Hidra</strong> · Gerado em {FULL_TIMESTAMP} · 
    <code style="font-size:0.7rem;background:#e2e8f0;padding:1px 6px;border-radius:3px;">{page_hash[:12]}</code>
  </p>
</div>
"""
        if aside:
            aside.insert_after(BeautifulSoup(spintax_html, "lxml"))
        else:
            main_tag = soup.find("main")
            if main_tag:
                main_tag.append(BeautifulSoup(spintax_html, "lxml"))

        # ---------- 8. ATUALIZAR JSON-LD (datePublished e dateModified) ----------
        # Converter soup de volta para string para usar regex seguro
        new_html = str(soup)
        new_html = re.sub(r'"datePublished":"[^"]+"', f'"datePublished":"{BUILD_DATE}"', new_html)
        new_html = re.sub(r'"dateModified":"[^"]+"', f'"dateModified":"{FULL_TIMESTAMP}"', new_html)

        # ---------- 9. ATUALIZAR META DESCRIPTION ----------
        desc_content = term["description"][:130] if term else link_to_name(link)
        meta_desc = f'<meta name="description" content="{desc_content} — Gerado em {FULL_TIMESTAMP} | Hash: {page_hash[:12]}">'
        if re.search(r'<meta name="description"', new_html, re.I):
            new_html = re.sub(r'<meta name="description"[^>]*>', meta_desc, new_html, flags=re.I)
        else:
            new_html = new_html.replace("<head>", f"<head>\n  {meta_desc}")

        # ---------- 10. SALVAR ARQUIVO ----------
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_html)
        updated_count += 1

    except Exception as e:
        skipped_count += 1
        print(f"  ⚠️ Erro em {link}: {e}")

print(f"✅ {updated_count} páginas atualizadas com as 2 novas datas dinâmicas e spintax")
if skipped_count:
    print(f"⚠️ {skipped_count} páginas não puderam ser processadas")
