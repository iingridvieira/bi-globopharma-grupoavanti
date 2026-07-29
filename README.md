# Globo BI

Desenvolva um sistema web completo de gestão comercial Sell In e Sell Out para representante comercial farmacêutico. Nome: BI GLOBO PHARMA

O sistema deve possuir visual executivo, moderno, sofisticado, clean e profissional, com aparência semelhante a dashboards corporativos de BI.

O sistema precisa transmitir:

 controle comercial

 organização

 produtividade

 gestão estratégica

 sofisticação

 inteligência comercial

 visual premium

DIREÇÃO VISUAL

O sistema deve seguir uma identidade visual moderna e executiva.

CORES PRINCIPAIS

 Laranja forte para destaques

 Verde militar bem escuro

 Preto grafite

 Cinza escuro

Evitar:

 cores vibrantes demais

 aparência infantil

 elementos arredondados exagerados

 visual genérico de CRM simples

REGRA VISUAL OBRIGATÓRIA

Sempre seguir contraste visual correto:

 quando a fonte for clara, o fundo deve ser escuro

 quando o fundo for claro, a fonte deve ser escura

Garantir excelente legibilidade em todo o sistema.

PADRÃO BRASILEIRO

Todo o sistema deve funcionar em padrão brasileiro:

FORMATO MONETÁRIO

R$ 1.050.000,00

DATAS

DD/MM/AAAA

CÁLCULOS

Utilizar matemática brasileira corretamente:

 vírgula decimal

 ponto para milhar

 cálculos financeiros precisos

ESTRUTURA PRINCIPAL

DASHBOARD GERAL (HOME)

A página principal deve seguir aproximadamente o layout do print enviado.

Ela deve conter:

CARDS SUPERIORES

 Meta do mês

 Pedidos enviados

 Pedidos faturados

 GAP (Meta - Faturado)

Todos os cards devem atualizar automaticamente conforme os lançamentos e importações.

TABELA CENTRAL — RESUMO POR CLIENTE

Criar tabela dinâmica consolidada contendo:

| Cliente | Pendência Inicial | Enviado | Meta | Faturado | Pendência Final |

A tabela deve calcular automaticamente:

Pendência Final = Meta - Faturado

Adicionar rodapé com TOTAL GERAL automático.

IMPORTAÇÃO DE EXCEL

O sistema deve permitir importar arquivos Excel (.xlsx).

Esses arquivos serão usados para:

 alimentar o dashboard

 atualizar metas

 atualizar faturamento

 atualizar sell in

 atualizar sell out

O sistema deve interpretar corretamente:

 datas brasileiras

 números brasileiros

 moeda brasileira

MÓDULO — PEDIDOS ENVIADOS

Criar seção contendo:

Campos:

 Data

 Cliente

 Valor

Tabela abaixo mostrando histórico do mês.

Adicionar totalizador automático no rodapé.

MÓDULO — NOTAS FISCAIS FATURADAS

Criar seção contendo:

Campos:

 Data

 Número da NF

 Cliente

 Valor

Tabela abaixo mostrando histórico do mês.

Adicionar totalizador automático.

FUNCIONALIDADE IMPORTANTE — VISUALIZAÇÃO DOS ITENS DA NF

Quando o usuário clicar em uma Nota Fiscal faturada:

Abrir modal ou página lateral mostrando:

ITENS DA NF

Campos:

 Código produto

 Produto

 Quantidade

 Valor unitário

 Valor total

 Desconto

 Total da NF

Esses dados devem vir automaticamente da importação do Excel.

BOTÕES PRINCIPAIS

Após o dashboard principal, criar apenas dois botões grandes:

CONSOLIDADO SELL IN

CONSOLIDADO SELL OUT

CONSOLIDADO SELL IN

Ao clicar em “Consolidado Sell In”:

Criar uma tela consolidada mostrando:

 soma total por cliente

 resultado mês a mês

 tabela dinâmica automática

 total geral consolidado

Os dados devem vir automaticamente dos arquivos Excel importados.

Adicionar filtros:

 mês

 ano

 cliente

O sistema deve calcular automaticamente:

 total mensal

 total anual

 comparativos mensais

 acumulados

CONSOLIDADO SELL OUT

Ao clicar em “Consolidado Sell Out”, abrir página contendo botões individuais para cada cliente:

 ANDORINHA

 BANDEIRANTES

 CAMPEÃ

 CG MEDICAMENTOS

 DF DISTRIBUIDORA

 DISMAP

 FARMA CONDE

 IMPACTA MED

 JK MEDICAMENTOS

 MAXIFARMA

 MEDSOL

 MILFARMA

 NAVARRO INTER

 NAVARRO SP

 NUCLEO

MAPAS DE VENDAS

Dentro de cada cliente do Sell Out:

Criar uma seção chamada:

MAPAS DE VENDAS

Funcionalidades:

 upload de arquivos

 upload de PDFs

 upload de Excel

 upload de imagens

 gerar link compartilhável

 permitir que outros usuários baixem os arquivos através do link

 histórico de arquivos enviados

Mostrar:

 nome do arquivo

 data

 usuário

 botão baixar

CÁLCULOS

Todos os cálculos do sistema precisam funcionar corretamente e automaticamente:

 metas

 percentuais

 gap

 faturamento

 totais

 pendências

 sell in

 sell out

 acumulados mensais

BANCO DE DADOS

Estruturar banco de dados para:

 clientes

 notas fiscais

 itens das notas

 metas mensais

 pedidos enviados

 arquivos anexados

 usuários

 permissões

AUTENTICAÇÃO

Criar login com níveis de acesso:

 administrador

 representante

 usuário visualizador

EXPORTAÇÃO

Permitir exportar relatórios em:

 PDF

 Excel

PERFORMANCE

O sistema deve:

 carregar rápido

 suportar grandes arquivos Excel

 funcionar bem com muitos dados

 possuir navegação fluida

 atualizar informações em tempo real

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bi-globopharma-grupoavanti.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/dbe73e1f-1a57-4269-9637-e264d060e444).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
