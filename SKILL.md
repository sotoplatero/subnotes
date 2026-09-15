---
name: subnotes
description: >-
  Escribe notas de Substack (Substack Notes) con la voz real del autor, aprendida de sus
  propias notas publicadas: descarga todo su histórico desde el perfil público, lo guarda en
  una base SQLite, destila un perfil de voz con evidencia citada y propone cada nota nueva
  con los formatos que a ÉL le han funcionado, en bloques listos para copiar y pegar.
  Úsalo SIEMPRE que alguien quiera escribir, redactar, mejorar o sacar ideas para una nota
  de Substack; cuando pida «una nota» para anunciar un post, promocionar su newsletter o
  repartir una idea en Notes; cuando quiera que aprendas, clones o analices su estilo o su
  voz de Substack; cuando pregunte si ya habló de un tema o qué notas suyas funcionaron
  mejor; o cuando pase su handle o la URL de su perfil de Substack — aunque no diga
  literalmente «nota» ni «skill». Si aún no hay perfil construido, este skill lo bootea:
  descarga las notas y destila la voz antes de escribir nada.
---

# subnotes — tus notas de Substack, con tus datos

Escribir notas con un modelo sale plausible y ajeno: suena a cualquiera y repite lo que ya
dijiste. Este skill arregla las dos cosas por el mismo camino, que son **tus notas
publicadas**. Se bajan, se guardan, y de ahí salen tanto el perfil de voz como los formatos
que a ti te funcionan y la comprobación de si el tema ya salió.

La fuente es el **perfil público**: se lee lo mismo que vería cualquier visitante, sin
iniciar sesión. Eso tiene una consecuencia que se dice al usuario y no se rodea: hay
reacciones, restacks y respuestas, pero **no hay impresiones, ni alcance, ni suscriptores
ganados por nota**. Eso es privado del panel. Lo que no está en la base no se estima.

## Dónde está todo

Los scripts viven junto a este archivo, en `scripts/`. Corren con Node 18+ (SQLite necesita
22.5+), sin dependencias:

```bash
node --no-warnings=ExperimentalWarning <ruta-del-skill>/scripts/sync.mjs  <handle> [--full]
node --no-warnings=ExperimentalWarning <ruta-del-skill>/scripts/query.mjs <subcomando> --handle <handle>
```

El estado vive **fuera del skill**, en `~/.claude/subnotes/<handle>/`: `notes.db` (la base),
`VOZ.md` (el perfil) y `LEEME.md` (qué hay y qué falta). Así sobrevive a reinstalaciones y
admite varios perfiles.

## En qué situación estás

Lo primero, siempre: `query.mjs estado --handle <handle>`. Si el comando dice que no hay
base para ese handle, es la situación 1.

### 1. No hay perfil todavía → bootea

En este orden. Los datos van antes que las preguntas, y esa es la diferencia con un
cuestionario de estilo.

1. **Pide el handle.** Es el de `substack.com/@handle`, no el dominio de la publicación. Si
   el usuario da la URL entera, vale igual. Si el handle no existe, el script lo dice con un
   404 limpio: no sigas inventando.
2. **Descarga el histórico entero:** `sync.mjs <handle> --full`. Sin notas no hay perfil.
   Enséñale el resumen: cuántas notas, desde cuándo.
3. **Saca la muestra:** `query.mjs muestra --handle <handle> --n 60` y
   `query.mjs stats --handle <handle>`. La muestra viene mezclada a propósito (rendimiento
   alto, medio y bajo; cortas y largas) porque destilar la voz solo de los éxitos produce
   una caricatura del autor en su mejor día.
4. **Pregunta solo lo que la muestra no contesta.** Con `AskUserQuestion`, una sola llamada:
   a quién le escribe, qué temas quedan fuera, qué le da vergüenza ajena de sus propias
   notas, si las notas son escaparate del newsletter o cosa aparte. Lo que los datos ya
   resuelven —longitud, tuteo, emojis, cadencia, cierres— **se infiere y se enseña para que
   lo corrija**, no se pregunta. Preguntar lo que ya sabes gasta la paciencia del usuario en
   lo que menos vale.
5. **Escribe `VOZ.md`** siguiendo `references/perfil-de-voz.md` (dimensiones, regla de
   evidencia y plantilla), guárdalo en `~/.claude/subnotes/<handle>/` y regístralo:
   `query.mjs perfil --handle <handle> --version v0.1`.
6. **Etiqueta los formatos** con `references/formatos.md`: `query.mjs etiquetar pendientes`,
   clasificar, `query.mjs etiquetar aplicar --archivo <json>`. Con 40–60 notas etiquetadas ya
   hay ranking útil. Si el histórico es grande, etiqueta las 60 más rendidoras y sigue en
   otra sesión: el ranking mejora, pero no hace falta acabarlo para empezar a escribir.
7. **Resume en cinco líneas** lo que has inferido y pídele que corrija. Luego sigue con lo
   que venía a hacer.

### 2. Hay perfil → escribe (esto es el día a día)

Lee `references/escribir-nota.md` y síguelo. En corto: leer `VOZ.md`, comprobar con
`query.mjs buscar` si ya habló del tema, traer 5–8 notas reales como anclas, elegir formatos
según **su** ranking (`query.mjs formatos`), elegir tú el tono según el material, y entregar
**tres variantes distintas en enfoque, cada una en su bloque de código**.

El bloque contiene exactamente el texto que se publica, y nada más. Ni etiquetas, ni
comillas, ni recuento de caracteres: todo lo que entre ahí acaba pegado en Substack.

### 3. Hay perfil pero se ha quedado viejo

`query.mjs estado` lo dice solo cuando hay ≥30 notas nuevas desde el perfil o han pasado 60
días desde el último sync. Ofrece `sync.mjs <handle>` (incremental, rápido) y, si han
entrado bastantes notas, reperfilar a `v0.2` con una línea de qué cambió. La voz de alguien
que publica se mueve; un perfil de hace un año miente con confianza.

## Los comandos

| Para qué | Comando |
|---|---|
| Bajar todo el histórico | `sync.mjs <handle> --full` |
| Actualizar (rápido) | `sync.mjs <handle>` |
| Ver qué hay y si toca reperfilar | `query.mjs estado --handle <h>` |
| Muestra para destilar la voz | `query.mjs muestra --handle <h> --n 60` |
| Sus medianas de forma y cadencia | `query.mjs stats --handle <h>` |
| ¿Ya habló de esto? | `query.mjs buscar "<tema>" --handle <h>` |
| Sus mejores notas | `query.mjs top --handle <h> --n 15 [--metrica restacks]` |
| Ranking de formatos | `query.mjs formatos --handle <h>` |
| Etiquetar formatos | `query.mjs etiquetar pendientes/aplicar --handle <h>` |
| Registrar el perfil escrito | `query.mjs perfil --handle <h> --version v0.1` |
| Volcar a markdown legible | `query.mjs export --handle <h>` |

Todos aceptan `--json` si prefieres procesar la salida en vez de leerla.

## Las reglas que hacen esto útil

- **Ninguna cifra fuera de la base.** Reacciones, restacks y respuestas son reales. Alcance,
  impresiones y suscriptores ganados no están: se dice, no se estima.
- **Menos de 5 notas no es un patrón.** Vale para formatos, temas y horarios. El script marca
  la poca muestra; no la conviertas en consejo.
- **Se compara contra su propia mediana**, nunca contra benchmarks del sector.
- **Lo que no se ve en los datos, se pregunta o se declara.** Rellenar con lo que suele
  funcionar en redes es exactamente lo que produce notas genéricas.
- **Nada de datos inventados dentro de una nota.** Sale con su nombre y es pública.

## Recursos

| Archivo | Cuándo leerlo |
|---|---|
| `references/perfil-de-voz.md` | Al bootear o reperfilar: dimensiones, regla de evidencia, plantilla de `VOZ.md` |
| `references/formatos.md` | Al etiquetar el histórico y al elegir formato para una nota nueva |
| `references/escribir-nota.md` | Cada vez que se escribe una nota: procedimiento, tono, entrega |
| `references/api-substack.md` | Solo si el sync falla o Substack cambia la API |

## Lo que esto no hace

- **No publica.** Devuelve texto para copiar; publicar lo hace el autor.
- **No entra en tu cuenta.** Si quieres métricas privadas de tus notas, están en tu panel de
  Substack y tendrías que traerlas tú.
- **No audita la newsletter.** Para eso está `auditoria-substack`, que trabaja con los CSV
  exportados y ve lo que aquí no se ve.
- **No baja notas ajenas para imitarlas.** Baja perfiles públicos, sí —también el de otro, si
  quieres estudiarlo—, pero el perfil de voz que construye es para escribir como quien lo
  encarga, no para suplantar a nadie.
