# subnotes

Escribe notas de Substack con tu voz de verdad, aprendida de las notas que ya has publicado.

Escribir notas con un modelo sale plausible y ajeno: suena a cualquiera y repite lo que ya
dijiste. Este skill arregla las dos cosas por el mismo camino, que son **tus propias notas**.
Se bajan del perfil público, se guardan en SQLite, y de ahí salen tres cosas: un perfil de
voz con evidencia citada, el ranking de los formatos que a ti te funcionan, y la comprobación
de si el tema ya lo tocaste.

## Instalación

```bash
npx skills add sotoplatero/subnotes
```

También puedes bajar el `.skill` o el `.zip` de la [última release](https://github.com/sotoplatero/subnotes/releases/latest),
o clonar el repo y enlazarlo a mano:

```bash
git clone https://github.com/sotoplatero/subnotes
ln -s "$PWD/subnotes" ~/.claude/skills/subnotes
```

Hay que reiniciar la sesión para que el agente lo cargue.

**Requisitos:** Node 22.5 o más nuevo (usa `node:sqlite`, que viene incluido). Sin
dependencias, sin `npm install`, sin claves de API. No inicia sesión en Substack: lee lo
mismo que vería cualquier visitante.

## Cómo se usa

La primera vez, dale tu handle y deja que bootee:

> «quiero que aprendas a escribir mis notas de substack, mi perfil es substack.com/@tuhandle»

Descarga tu histórico, saca una muestra mezclada (notas que fueron bien, regular y mal),
pregunta solo lo que los datos no contestan y escribe tu `VOZ.md`. A partir de ahí:

> «escríbeme una nota sobre X»

Devuelve tres variantes en bloques listos para copiar, con formatos sacados de tu ranking
real, avisando si el tema ya salió en tu histórico.

## Qué hay dentro

| | |
|---|---|
| `scripts/sync.mjs` | Baja tus notas del perfil público a SQLite. Incremental; `--full` la primera vez |
| `scripts/query.mjs` | `estado`, `perfil`, `muestra`, `top`, `buscar`, `stats`, `formatos`, `etiquetar`, `export` |
| `scripts/db.mjs` | Esquema e inserción, con histórico de métricas |
| `references/perfil-de-voz.md` | Cómo se destila el perfil: dimensiones y regla de evidencia |
| `references/formatos.md` | Catálogo de formatos y taxonomía para etiquetar el histórico |
| `references/escribir-nota.md` | El procedimiento de escritura |
| `references/api-substack.md` | Los endpoints usados, documentados |

## Dónde viven tus datos

En `~/.claude/subnotes/<handle>/`: `notes.db`, `VOZ.md` y un `LEEME.md`. Fuera del skill a
propósito, para que reinstalarlo o moverlo no se lleve por delante el histórico. Se puede
cambiar con la variable de entorno `SUBNOTES_DIR`.

Nada sale de tu máquina salvo las peticiones a la API pública de Substack.

## Lo que este skill no hace

- **No publica.** Devuelve texto para copiar; publicar lo haces tú.
- **No entra en tu cuenta.** Por eso hay reacciones, restacks y respuestas, pero no
  impresiones, alcance ni suscriptores ganados: eso es privado de tu panel. Lo que no está en
  los datos se declara, no se estima.
- **No audita la newsletter.** Eso son los CSV exportados, que es otra herramienta.

## Licencia

MIT
