# GC - Gestão Casa

Web app **mobile-first** para gerenciar as compras mensais da casa: estoque, consumo previsto, preço médio e lembretes recorrentes. Ele gera **sugestões automáticas de compra** a partir desses dados.

**Usar agora:** https://marqueziniai.github.io/gc-gestao-casa/
No celular, abra o link e use **"Adicionar à tela inicial"** para instalar como app (PWA).

## Funcionalidades (MVP)

| Área | O que faz |
|---|---|
| **Início** | Resumo do mês, custo estimado, itens a comprar e lembretes vencidos com resposta rápida |
| **Compras** | Lista mensal gerada pelas sugestões, quantidades editáveis (+/−), registro de compra real (quantidade + preço), ignorar no ciclo, busca/filtros, total estimado × gasto, fechamento de ciclo e histórico |
| **Estoque** | Catálogo com ajuste rápido (+/−, ou toque no número para digitar), filtros (abaixo do ideal, incompletos, inativos), edição completa e histórico de compras por produto |
| **Lembretes** | "Tem X?" a cada N meses, com as respostas **Tenho** (confirma o estoque), **Comprar** (vai para a lista) e **Adiar 7d**, além de pausar, editar e revisão do mês |
| **+** | Cadastro rápido de produto (só nome, unidade e estoque) em qualquer tela |
| **Ajustes** | Exportar/importar backup (.json), restaurar a demonstração, apagar os dados |

### Regras de cálculo

- **Sugestão:** `max(0, consumo_mensal × meses_cobertura + reserva − estoque)`, arredondada para o múltiplo da embalagem. Produtos sem consumo configurado não recebem sugestão.
- **Custo estimado:** `quantidade_planejada × preço_médio`. Itens sem preço aparecem como "Preço não informado" e o total fica marcado como parcial.
- **Preço médio:** média ponderada `Σ(qtd × preço) / Σ(qtd)` de todas as compras registradas. Editar ou excluir uma compra recalcula a média.
- **Estoque:** `estoque + quantidade_comprada` na mesma operação que registra a compra. O estoque nunca fica negativo e não é zerado na virada do mês.
- **Lembretes:** a próxima data é calculada a partir do dia da checagem, respeitando meses curtos (31/01 + 1 mês = 28/02 ou 29/02). "Adiar" soma 7 dias e nunca antecipa a data.

### Integridade garantida

- Uma lista aberta por vez (estados: em preparação → ativa → fechada → arquivada).
- Uma linha por produto na lista. Adicionar de novo atualiza a linha, nunca duplica.
- Cada compra tem um id gerado ao abrir o formulário, então um toque duplo não registra duas vezes.
- Produto com histórico de compras não pode ser excluído, só desativado (o histórico é preservado).

## Executar localmente

Requisitos: Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes das regras de negócio (Vitest)
npm run build      # build de produção em dist/
npm run deploy     # build + publica no GitHub Pages (branch gh-pages)
```

## Stack e arquitetura

React 18 + TypeScript + Vite + Tailwind CSS v4, ícones Lucide. Sem backend.

```
src/
  types.ts            modelo de dados (Product, ShoppingList, Purchase, Reminder)
  lib/calc.ts         regras de cálculo puras (sugestão, custo, média, datas)
  lib/reducer.ts      todas as operações do app como ações atômicas
  lib/storage.ts      adaptador de persistência (hoje: localStorage)
  lib/selectors.ts    totais e agrupamentos derivados
  store.tsx           contexto React, toasts, confirmações e modais
  pages/              Início, Compras, Estoque, Lembretes
  components/         UI base, formulários (sheets) e cards
  seed.ts             dados de demonstração
```

**Para migrar para um banco de dados:** implemente outro `StorageAdapter` (ex.: Supabase/Firebase/API própria). Como todas as mutações já passam por ações do `reducer`, elas podem ser enviadas ao servidor sem mexer nas telas.

## Limitações conhecidas

- Os dados ficam **no navegador do aparelho** (localStorage), sem sincronização entre celular e computador. Use **Ajustes → Exportar/Importar backup** para transferir.
- Lembretes aparecem **dentro do app**. Notificações push em segundo plano exigem backend/serviço de push e ficam para uma próxima etapa.
- Um único usuário/casa, sem login.
- O preço é por unidade de medida do produto. Não há conversão automática entre unidades (ex.: g ↔ kg).
