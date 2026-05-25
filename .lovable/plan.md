# BI GLOBO PHARMA

Sistema web executivo de gestão comercial farmacêutica (Sell In / Sell Out) para representante. Visual BI corporativo: laranja forte, verde militar escuro, preto grafite, cinza escuro. Padrão brasileiro (R$, DD/MM/AAAA, vírgula decimal).

## Direção visual

- Paleta: `#0E0F0C` (grafite), `#1A1D17` (verde militar escuríssimo), `#2A2E26` (cinza escuro), `#F26A1F` (laranja forte destaque), `#E5E7E1` (texto claro).
- Tipografia: **Space Grotesk** (display/números) + **Inter** (corpo) — vibe dashboard BI premium.
- Cards densos, bordas retas (radius 6px), divisores sutis, números tabulares grandes, micro-animações Framer Motion. Contraste WCAG AA.

## Fases de entrega

### Fase 1 — Fundação (esta entrega)
1. **Ativar Lovable Cloud** (auth, DB Postgres, storage).
2. **Design system** completo em `src/styles.css` (tokens oklch, variantes de cards/botões/tabelas).
3. **Auth** com 3 papéis: `admin`, `representante`, `viewer` (tabela `user_roles` + função `has_role`).
4. **Schema DB**:
   - `clientes`, `metas_mensais`, `pedidos_enviados`, `notas_fiscais`, `itens_nf`, `sell_in`, `sell_out`, `mapas_vendas_arquivos`.
   - RLS por papel.
5. **Layout shell** com sidebar (Dashboard, Pedidos, NFs, Sell In, Sell Out) + header.
6. **Dashboard Home** com:
   - 4 cards superiores (Meta / Enviados / Faturados / GAP).
   - Tabela resumo por cliente (Pendência Inicial, Enviado, Meta, Faturado, Pendência Final) com rodapé TOTAL GERAL.
   - Formatação BR (`Intl.NumberFormat('pt-BR')`).
7. **Importação Excel** (`.xlsx`) via `xlsx` lib — interpreta datas/números BR, popula metas, pedidos, NFs, sell in/out.
8. **Módulo Pedidos Enviados**: form (Data, Cliente, Valor) + tabela mensal + total.
9. **Módulo Notas Fiscais**: form + tabela + modal lateral com itens da NF (Código, Produto, Qtd, Vlr Unit, Total, Desconto).
10. **Botões grandes** "Consolidado Sell In" e "Consolidado Sell Out".

### Fase 2 — Consolidados e Sell Out por cliente
- Tela Sell In: tabela dinâmica cliente × mês, totais, filtros (mês/ano/cliente), acumulados.
- Tela Sell Out: 15 botões de cliente (ANDORINHA, BANDEIRANTES, CAMPEÃ, CG MEDICAMENTOS, DF DISTRIBUIDORA, DISMAP, FARMA CONDE, IMPACTA MED, JK MEDICAMENTOS, MAXIFARMA, MEDSOL, MILFARMA, NAVARRO INTER, NAVARRO SP, NUCLEO).
- Para cada cliente: detalhe Sell Out + seção **Mapas de Vendas** (upload PDF/Excel/imagem, link compartilhável, histórico, download).

### Fase 3 — Exportação e polish
- Exportar PDF (jsPDF) e Excel (xlsx) dos relatórios.
- Otimização de performance (paginação, índices DB).
- Permissões finas por papel nas telas.

## Técnico

- **Stack**: TanStack Start + React 19 + Tailwind v4 + shadcn + Lovable Cloud (Supabase).
- **Excel**: lib `xlsx` (SheetJS) no client para parse, server fn para persistência.
- **Upload Mapas**: bucket Storage `mapas-vendas` (público com URLs assinadas para compartilhamento).
- **Formatação BR**: helpers `formatBRL`, `formatDateBR`, `parseBRNumber`.
- **PDF/Excel export**: `jspdf` + `jspdf-autotable`, `xlsx`.

## Confirmação

Começarei pela **Fase 1** (fundação + Dashboard + importação Excel + Pedidos + NFs). Confirma para eu seguir? Se quiser ajustar paleta, fontes ou ordem das fases, me diz antes.