#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import time
import requests
from xml.etree import ElementTree as ET

# ============================================================
# CONFIGURAÇÃO
# ============================================================
INDEXNOW_KEY = "89bd45da3b4e45b9b086b2ecca466207"  # Sua chave fornecida
SITEMAP_PATH = "docs/sitemap.xml"
INDEXNOW_URL = "https://api.indexnow.org/indexnow"
# YANDEX_URL = "https://yandex.com/indexnow"  # opcional

# ============================================================
# EXTRAIR URLs DO SITEMAP
# ============================================================
def extract_urls_from_sitemap(sitemap_path):
    try:
        tree = ET.parse(sitemap_path)
        root = tree.getroot()
        # Namespace pode estar presente
        ns = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        urls = []
        for url_elem in root.findall('ns:url', ns):
            loc = url_elem.find('ns:loc', ns)
            if loc is not None and loc.text:
                urls.append(loc.text)
        return urls
    except Exception as e:
        print(f"❌ Erro ao ler sitemap: {e}")
        return []

# ============================================================
# ENVIAR PARA INDEXNOW
# ============================================================
def submit_to_indexnow(urls, key, host=None, batch_size=10000):
    if not urls:
        print("⚠️ Nenhuma URL para enviar.")
        return

    # O host é o domínio principal (extraído da primeira URL)
    if not host:
        # Pega o domínio da primeira URL (ex: https://paulo-leads.github.io)
        first_url = urls[0]
        parts = first_url.split('/')
        host = f"{parts[0]}//{parts[2]}"

    print(f"📤 Enviando {len(urls)} URLs para IndexNow (chave: {key[:8]}...)")

    # IndexNow permite no máximo 10.000 URLs por requisição, mas podemos enviar todas de uma vez (até 10k)
    # Vamos dividir em lotes se necessário
    for i in range(0, len(urls), batch_size):
        batch = urls[i:i+batch_size]
        payload = {
            "host": host,
            "key": key,
            "keyLocation": f"{host}/{key}.txt",  # arquivo de verificação deve existir
            "urlList": batch
        }
        try:
            response = requests.post(INDEXNOW_URL, json=payload, timeout=30)
            if response.status_code == 200:
                print(f"✅ Lote {i//batch_size + 1}: {len(batch)} URLs enviadas com sucesso.")
            elif response.status_code == 202:
                print(f"✅ Lote {i//batch_size + 1}: Aceito (processamento em andamento).")
            else:
                print(f"⚠️ Lote {i//batch_size + 1}: Falha {response.status_code} - {response.text}")
        except Exception as e:
            print(f"❌ Erro ao enviar lote {i//batch_size + 1}: {e}")

        # Pequena pausa para não sobrecarregar
        if i + batch_size < len(urls):
            time.sleep(1)

# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    if not os.path.exists(SITEMAP_PATH):
        print(f"❌ Sitemap não encontrado: {SITEMAP_PATH}")
        sys.exit(1)

    urls = extract_urls_from_sitemap(SITEMAP_PATH)
    if not urls:
        print("❌ Nenhuma URL extraída do sitemap.")
        sys.exit(1)

    print(f"📋 Encontradas {len(urls)} URLs no sitemap.")

    # Opcional: limitar para teste (descomente se quiser enviar só as primeiras 10)
    # urls = urls[:10]

    submit_to_indexnow(urls, INDEXNOW_KEY)

    print("✅ Finalizado.")
