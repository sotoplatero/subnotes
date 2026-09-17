# Formatos de nota

Dos cosas viven aquí: el **catálogo** de formatos que funcionan en Notes, y la **taxonomía**
con la que se etiqueta el histórico. Son la misma lista, y esa es la gracia: al etiquetar
tus notas con estas etiquetas, el catálogo deja de ser un manual genérico y se ordena por lo
que a ti te ha funcionado.

El catálogo propone. **Tus datos mandan.**

## El catálogo

| Slug | Qué es | Cuándo funciona |
|---|---|---|
| `gancho-giro` | Primera línea que promete una cosa, el cuerpo entrega otra | Cuando la idea tiene una vuelta de tuerca real. Sin giro, es clickbait |
| `sentencia` | Una o dos frases, sin contexto, para citar | Cuando la idea aguanta sola. Es el formato más difícil de fingir |
| `opinion-con-filo` | Postura clara contra algo que se da por sentado | Cuando de verdad piensas eso y puedes sostenerlo en los comentarios |
| `dato-contraintuitivo` | Un número o hecho que descoloca, más tu lectura | Cuando el dato es verificable. Si no lo es, no se publica |
| `confesion` | Algo que te salió mal, te costó, o que pensabas antes y ya no | Cuando sirve al lector, no cuando busca consuelo |
| `micro-historia` | Escena mínima con tensión y remate | Cuando hay un detalle concreto. Una anécdota sin detalle es relleno |
| `lista-corta` | 3–5 puntos, una línea cada uno | Cuando el material es de verdad enumerable; si no, queda a hueco |
| `detras-de-camaras` | Cómo se hace algo tuyo por dentro | Cuando enseña el proceso, no el resultado |
| `tutorial-prompt` | Pasos copiables o un prompt entero regalado en la nota | Cuando el lector puede ejecutarlo hoy sin ti |
| `explicacion` | Desmontar un concepto técnico en lenguaje llano | Cuando el término asusta más que la cosa («skills», «claude code») |
| `recomendacion` | Señalar el trabajo de otro, o comentar una cita suya | Cuando lo has leído y tu comentario aporta. Substack premia esto más que otras redes |
| `anuncio` | Empujar un post, un lanzamiento, algo tuyo | Con cuentagotas: suele rendir por debajo de la mediana, y conviene decírselo al autor con su propio número |
| `otro` | No encaja en ninguno | Etiqueta legítima. Si abunda, falta un formato en esta lista: añádelo aquí, no lo fuerces |

Doce y pico, a propósito: con un catálogo más largo cada formato se queda con tres notas y
el ranking no decide nada. Una nota puede parecerse a dos: elige el que explique **por qué el
lector se para**, lo que hace el trabajo, no lo que decora.

## El ranking

```bash
node scripts/subnotes.mjs formatos
```

Por formato: cuántas notas tuyas lo usan, la mediana de reacciones, la de longitud y dos
ejemplos, ordenado por mediana y contra **tu** mediana global — un formato «bueno» es el que
la supera. Los que no llegan a 5 notas salen marcados: con dos notas y una viral, lo que mide
es la suerte.

## Etiquetar el histórico

Lo normal es que se etiquete solo: cada vez que escribes una nota traes 5–8 anclas y esas se
clasifican de paso (paso 3 de `escribir-nota.md`). En diez notas escritas tienes ~50
etiquetadas sin haber parado nunca.

Si quieres forzarlo —porque el ranking hace falta ya—, hay lote:

```bash
node scripts/subnotes.mjs etiquetar --n 40
node scripts/subnotes.mjs etiquetar-aplicar --datos '{"320752864":"sentencia","318456275":"opinion-con-filo"}'
```

Vienen de mayor a menor rendimiento, así que las primeras 40 son justo las que más pesan en
el ranking. Usa **los slugs exactos** de la tabla: un slug que no esté en ella se rechaza en vez de
colarse en el ranking como un formato fantasma con n=1. Con 40–60 etiquetadas ya hay ranking útil;
lo que quede se etiqueta otro día y el ranking mejora solo. (`--archivo lote.json` si
prefieres un fichero.)

## Cómo se elige formato al escribir

De las tres variantes: **dos con formatos del top del autor** (con muestra suficiente) y
**una con un formato que apenas ha usado**. Repetir solo lo que ya rinde estrecha la voz
hasta convertirla en un tic, y la tercera variante es barata: si no gusta, se descarta.

Si el material solo admite un formato —un dato es un dato—, no se fuerzan tres: se dan dos
buenas y se explica por qué la tercera no venía a cuento. Y si aún no hay nada etiquetado,
se dice y se elige por criterio, no se inventa un ranking.
