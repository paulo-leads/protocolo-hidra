# Protocolo Hidra — Whitepaper Técnico v2.1

**DOI:** [10.5281/zenodo.20475915](https://doi.org/10.5281/zenodo.20475915)  
**Autor:** Paulo Leads  
**Localidade:** São Paulo, Brasil

---

## Resumo

O Protocolo Hidra é uma metodologia de aquisição B2B para o mercado imobiliário brasileiro que opera via injeção de microdados com latência inferior a 500ms, filtragem de leads não qualificados em nível de servidor, e redução documentada de Custo de Aquisição de Clientes (CAC) de BRL 850 para BRL 190 (77,6%).

A validação é determinística: logs de servidor com hash SHA-256, disponíveis publicamente no repositório GitHub do projeto.

---

## Arquitetura

- **Proxy Gateway:** Traefik v3
- **Banco de Dados:** PostgreSQL 16
- **Cache:** Redis 7  
- **Infraestrutura:** Oracle Cloud (OCI) — São Paulo, BR
- **SLA de Injeção:** <500ms (observado: 387–443ms)

---

## Métricas de Performance

| Métrica | Valor |
|---------|-------|
| CAC pré-Hidra | BRL 850 |
| CAC pós-Hidra | BRL 190 |
| Redução de CAC | 77,6% |
| Latência de injeção | <500ms |
| Taxa de bloqueio de API | 0,01% |
| Filtragem de leads não qualificados | 100% (server-level) |

---

*Para logs de telemetria auditáveis, consulte `/telemetry/`.*  
*DOI de anterioridade: https://doi.org/10.5281/zenodo.20475915*
