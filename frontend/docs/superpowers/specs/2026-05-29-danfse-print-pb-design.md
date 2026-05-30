# DANFSe Print: Preto & Branco + 1 Página A4

## Problem

O DANFSe impresso via `window.print()` pode estourar 1 página A4 e usa cores desnecessárias para um documento fiscal impresso.

## Solution

Aplicar `@media print` CSS agressivo: escala 0.9, overflow hidden, override de cores para P&B puro, margem A4 consistente. Sem mudanças em componentes React.

## Changes

### 1. `src/index.css` — substituir bloco `@media print`

| O que | Como |
|-------|------|
| Margem A4 | `@page { size: A4; margin: 5mm; }` |
| Matar cores | `* { background: transparent !important; color: black !important; box-shadow: none !important; }` |
| Fundo do body | `html, body { background: white !important; }` |
| Headers de seção | `.bg-slate-800 { background: #e5e5e5 !important; }` (cinza claro) |
| Esconder sidebar | Classes existentes mantidas (`.xl\:col-span-3`, `display: none`) |
| Escalar pra caber | `#danfse-document-view { transform: scale(0.9); transform-origin: top left; width: calc(190mm / 0.9); overflow: hidden; }` |
| Fontes reduzidas | Manter overrides atuais (9px, 8px, 7.5px, etc.) |
| Casos específicos | `.bg-emerald-900` → `#e5e5e5`; `.bg-\[#fafdfb\]` → `white` |

### 2. `src/pages/GerarDanfeView.tsx` — `handleDownloadPdf`

Manter `window.print()` — a sidebar já some via `@media print`. Zero mudanças no componente.

### 3. `src/components/DanfseView.tsx`

Nenhuma mudança. As classes `print:bg-gray-200`, `print:text-black`, `print:hidden` já cobrem o necessário.

## Riscos & Mitigação

| Risco | Mitigação |
|-------|-----------|
| Scale 0.9 cria espaço branco | `width: calc(190mm / 0.9)` recalcula o tamanho real |
| Overflow ainda ocorre | `overflow: hidden` corta excesso; se precisar, `body { max-height: 297mm }` |
| Navegador ignora `@page margin` | `size: A4` força o formato; a margem pode variar, mas 5mm é seguro |
| Logo NFS-e (verde/dourado) ainda tem cor | Aceitável — é parte do layout padrão do DANFSe |

## Critério de Sucesso

- Cabe em 1 folha A4 no print preview
- Sem cores (exceto logo NFS-e que é tolerado)
- Sidebar não aparece
- Conteúdo legível
- Nenhuma dependência nova
- Build passa (`npm run lint && npm run build`)
