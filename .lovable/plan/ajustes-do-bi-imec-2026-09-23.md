# Ajustes do BI IMEC

## Dashboard
- Reorganizar o Dashboard no mesmo padrão do BI Globo, preservando a identidade azul do IMEC.
- Manter as pendências no resumo por cliente apenas como valor total, removendo a tabela detalhada de pendências do Dashboard.
- Adicionar o card de Meta mensal com progresso visual e edição restrita a administrador.
- Fazer o botão “Exportar PNG” capturar a própria visualização atual do Dashboard, com o mês, cards e tabela que estiverem visíveis.

## Por Cliente
- Criar a entrada “Por Clientes” no menu lateral e na tela inicial do BI IMEC.
- Criar uma grade de clientes seguindo o padrão visual do BI Globo.
- Em cada cliente, exibir somente o gráfico de Sell In e, abaixo, a tabela de pendências com filtros, totais e exportação.

## Acesso
- Manter “Importar Excel” visível apenas para administradores no menu e na tela inicial.
- Bloquear também o acesso direto à página de importação para usuários sem essa permissão.

## Dados e detalhes técnicos
- Criar uma tabela mensal de metas do IMEC, protegida pelas mesmas regras de acesso do módulo: leitura para usuários autorizados e gravação somente por administrador.
- Reutilizar os componentes, formatação brasileira e padrões visuais existentes; nenhuma tela do BI Globo será alterada.
- Completar os metadados próprios das novas páginas do IMEC.
