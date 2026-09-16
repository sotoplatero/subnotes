---
name: subnotes
description: >-
  Úsalo cuando alguien quiera escribir, redactar o mejorar una nota de Substack (Substack
  Notes), o sacar ideas para una; cuando pida «una nota» para anunciar un post o promocionar
  su newsletter; cuando quiera que aprendas, clones o analices su voz o su estilo de
  Substack; cuando pregunte si ya habló de un tema o qué notas suyas funcionaron mejor; o
  cuando pase su handle o la URL de su perfil de Substack — aunque no diga «nota» ni «skill».
---

# subnotes — tus notas de Substack, con tus datos

Escribir notas con un modelo sale plausible y ajeno: suena a cualquiera y repite lo que ya
dijiste. Este skill arregla las dos cosas por el mismo camino, que son **tus notas
publicadas**: se bajan del perfil público, se guardan, y de ahí salen el perfil de voz, los
formatos que a ti te funcionan y la comprobación de si el tema ya salió.

Solo hay lo que ve un visitante: reacciones, restacks y respuestas. **Impresiones, alcance y
suscriptores por nota no están** —son privados del panel— y no se estiman.

## Los scripts

Junto a este archivo, en `scripts/`. Node 22.5+, sin dependencias ni claves:

```bash
node <ruta>/scripts/subnotes.mjs sync <handle> [--full]   # bajar / actualizar
node <ruta>/scripts/subnotes.mjs                         # la ayuda: todos los comandos
```

`--handle` sobra cuando solo hay un perfil bajado. El estado vive **fuera del skill**, en
`~/.claude/subnotes/<handle>/`: `notes.db`, `VOZ.md` y `LEEME.md`.

## En qué situación estás

Lo primero, siempre: `subnotes.mjs estado`. Si dice que no hay base para ese handle, es la 1.

### 1. No hay perfil → bootea

Los datos van antes que las preguntas: esa es la diferencia con un cuestionario de estilo.

1. **Pide el handle.** El de `substack.com/@handle`, no el dominio de la publicación. La URL
   entera vale. Si no existe, el script da un 404 limpio: no sigas inventando.
2. **`subnotes.mjs sync <handle> --full`.** Enséñale el resumen: cuántas notas, desde cuándo.
3. **`subnotes.mjs muestra --n 60`** y **`subnotes.mjs stats`**.
4. **Pregunta solo lo que la muestra no contesta.** Con `AskUserQuestion`, una sola llamada:
   a quién le escribe, qué temas quedan fuera, qué le da vergüenza ajena de sus propias
   notas, si las notas son escaparate del newsletter o cosa aparte. Longitud, tuteo, emojis,
   cadencia y cierres **se infieren y se enseñan para que los corrija**, no se preguntan:
   preguntar lo que ya sabes gasta la paciencia del usuario en lo que menos vale.
5. **Escribe `VOZ.md`** siguiendo `references/perfil-de-voz.md`, guárdalo en
   `~/.claude/subnotes/<handle>/` y regístralo: `subnotes.mjs perfil --version v0.1`.
6. **Resume en cinco líneas** lo inferido, pide que lo corrija, y sigue con lo que venía a
   hacer.

El ranking de formatos **no se construye aquí**: se etiqueta sobre la marcha la primera vez
que haga falta (`references/formatos.md`). Etiquetar 60 notas antes de escribir la primera es
el paso que más cansa y el que menos se nota.

### 2. Hay perfil → escribe

Es el día a día. Lee `references/escribir-nota.md` y síguelo.

### 3. El perfil se ha quedado viejo

`subnotes.mjs estado` lo avisa solo. Ofrece `subnotes.mjs sync` y, si han entrado
bastantes notas, reperfilar (`references/perfil-de-voz.md`).

## Las reglas que hacen esto útil

- **Ninguna cifra fuera de la base.** Lo que no está, se dice; no se estima.
- **Menos de 5 notas no es un patrón.** Vale para formatos, temas y horarios.
- **Lo que no se ve en los datos, se pregunta o se declara.** Rellenar con lo que suele
  funcionar en redes es exactamente lo que produce notas genéricas.
- **Nada de datos inventados dentro de una nota.** Sale con su nombre y es pública.

## Recursos

| Archivo | Cuándo leerlo |
|---|---|
| `references/escribir-nota.md` | Cada vez que se escribe una nota |
| `references/perfil-de-voz.md` | Al bootear o reperfilar |
| `references/formatos.md` | Al elegir formato, y al etiquetar el histórico |
| `references/api-substack.md` | Solo si el sync falla o Substack cambia la API |

## Lo que esto no hace

- **No publica ni entra en tu cuenta.** Devuelve texto para copiar.
- **No audita la newsletter.** Para eso está `auditoria-substack`, con los CSV exportados.
- **No baja notas ajenas para imitarlas.** Puede bajar cualquier perfil público, pero la voz
  que construye es para escribir como quien lo encarga, no para suplantar a nadie.
