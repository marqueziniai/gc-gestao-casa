# GC - Gestão Casa

Web app **mobile-first** para gerenciar as compras mensais da casa: estoque, consumo previsto, preço médio e lembretes recorrentes. Ele gera **sugestões automáticas de compra** a partir desses dados.

**Usar agora:** https://marqueziniai.github.io/gc-gestao-casa/
No celular, abra o link e use **"Adicionar à tela inicial"** para instalar como app (PWA).

## Como funciona

Três abas, pensadas para uso com uma mão:

| Aba | O que faz |
|---|---|
| **Estoque** | Cada produto já mostra **Pacote/Unidade**, **Tenho** (− +) e **Preciso no mês** (− +), agrupados por corredor. Toque no número para digitar o valor exato. Toque no nome para editar (categoria, preço médio opcional, lembrete, desativar). |
| **Compras** | A lista se monta sozinha: entra tudo o que tem `Tenho < Preciso no mês`. Escolha o mercado (**Andorinha · Giga · Carrefour**) e a lista se ordena pelos corredores dele. Cada item mostra quanto tem e quanto precisa no mês. Um toque no círculo = comprado (soma ao estoque); toque no nome para renomear, informar o preço (opcional) ou tirar desta compra. **Finalizar compras** guarda o histórico; o que faltou continua para a próxima. |
| **Lembretes** | "Tem creme dental?" a cada N meses: **Tenho** (confirma o estoque), **Comprar** (vai para a lista), **Adiar 7d**. |

**Mercados e corredores:** em Compras, o botão ⇅ abre o gerenciador:
- **Mercados:** incluir (começa com a ordem do mercado atual) e excluir, com confirmação; sempre resta pelo menos um.
- **Categorias:** incluir e excluir. Ao excluir uma categoria com produtos, você escolhe entre **só a categoria** (os produtos vão para "Sem categoria", sempre no fim da lista) ou **categoria e produtos** (as compras já feitas ficam no histórico).
- **Ordem:** **Montar ordem tocando** (toque nas categorias na sequência em que passa) ou ajuste com ↑ ↓. As categorias valem para todos os mercados, e cada mercado tem a sua ordem.

**Ajustes** (engrenagem): exportar/importar backup (.json), restaurar a lista inicial, apagar dados.

### Regras

- **Falta comprar:** `max(0, preciso_no_mês − tenho)`. Produtos sem "preciso no mês" não entram sozinhos (dá para adicionar à mão).
- **Preço médio (opcional):** média ponderada das compras com preço `Σ(qtd × preço) / Σ(qtd)`. Compras sem preço só atualizam o estoque.
- **Estoque:** a compra soma ao estoque na mesma operação; nunca fica negativo; não é zerado na virada do mês.
- **Lista:** sempre uma lista aberta, uma linha por produto. Itens ajustados à mão, comprados ou tirados da compra não são alterados pela atualização automática.
- **Lembretes:** próxima data a partir do dia da checagem, respeitando meses curtos; "Adiar" nunca antecipa a data.
- **Teclado no iPhone:** os formulários acompanham a área visível acima do teclado (`visualViewport`) e a barra inferior se esconde enquanto você digita.

## Sincronização entre celulares (GitHub privado)

Sem banco de dados: os dados ficam em um único arquivo `dados.json` no repositório **privado** [`marqueziniai/gc-gestao-casa-dados`](https://github.com/marqueziniai/gc-gestao-casa-dados). O app público não contém dados nem credenciais.

**Configurar (uma vez por celular):**
1. No GitHub: *Settings → Developer settings → Fine-grained tokens → Generate new token* ([link direto](https://github.com/settings/personal-access-tokens/new)).
   - Repository access: **Only select repositories** → `gc-gestao-casa-dados`
   - Permissions → Repository → **Contents: Read and write**
   - Validade: até 1 ano
2. No app: **Ajustes → Sincronizar entre celulares**, cole o token e toque em **Conectar**.
   - No 1º celular os dados dele vão para o GitHub.
3. Ainda no 1º celular: **Ajustes → Convidar outro celular**, crie a **senha da casa** e compartilhe o link.
   - No 2º celular, abra o link e digite a senha da casa. Pronto.
   - O link leva o token criptografado com a senha da casa (AES-GCM + PBKDF2) depois do `#`, parte que nunca é enviada a servidor algum. A senha não fica gravada em lugar nenhum.

**Como funciona:**
- **Quando sincroniza:** baixa ao abrir, ao voltar para o app e a cada minuto. Envia ~2,5 s depois de cada alteração.
- **Edição nos dois celulares:** uma junção de três vias (`src/lib/merge.ts`) combina as alterações por registro e por campo. Se cada um marcar itens diferentes da lista, as duas marcações ficam. Se o GitHub mudar entre baixar e enviar, ele recusa a gravação e o app junta de novo antes de tentar outra vez.
- **Histórico:** cada sincronização é um commit, então dá para voltar versões pelo histórico do repositório.
- **Segurança:** o token fica só no navegador de cada celular e enxerga apenas o repositório de dados.

**Limitação:** se os dois celulares alterarem **o mesmo campo do mesmo produto** quase ao mesmo tempo (ex.: o "Tenho" do café), vale a alteração de quem sincronizar por último.

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
  seed.ts             lista inicial de produtos da casa
```

**Para migrar para um banco de dados:** implemente outro `StorageAdapter` (ex.: Supabase/Firebase/API própria). Como todas as mutações já passam por ações do `reducer`, elas podem ser enviadas ao servidor sem mexer nas telas.

## Limitações conhecidas

- Sem a sincronização ligada, os dados ficam só no navegador do aparelho (localStorage).
- Lembretes aparecem **dentro do app**. Notificações push em segundo plano exigem backend/serviço de push e ficam para uma próxima etapa.
- Um único usuário/casa, sem login.
- Os produtos são contados por pacote ou unidade (sem kg/L).
