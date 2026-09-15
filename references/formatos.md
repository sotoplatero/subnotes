# Formatos de nota

Dos cosas viven aquí: el **catálogo** de formatos que funcionan en Notes, y la **taxonomía**
con la que se etiqueta el histórico. Son la misma lista, y esa es la gracia: al etiquetar
tus notas con estas etiquetas, el catálogo deja de ser un manual genérico y se ordena por lo
que a ti te ha funcionado.

El catálogo propone. **Tus datos mandan.**

## Cómo se usa el ranking

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs formatos --handle <handle>
```

Devuelve, por formato: cuántas notas tuyas lo usan, la mediana de reacciones, la mediana de
longitud y dos ejemplos. Ordenado por mediana.

Dos cautelas que evitan conclusiones falsas:

- **Menos de 5 notas no es un ganador.** El script lo marca. Un formato con dos notas y una
  de ellas viral dice más de la suerte que del formato.
- **Se compara contra tu mediana global**, no contra nada externo. Un formato «bueno» es el
  que supera tu propia mediana.

## Etiquetar el histórico

Una vez, y queda guardado en `notes.format`:

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs etiquetar pendientes --handle <handle> --n 40
# clasificar cada nota contra la tabla de abajo, y guardar:
node --no-warnings=ExperimentalWarning scripts/query.mjs etiquetar aplicar --archivo etiquetas.json --handle <handle>
```

`etiquetas.json` es `{"<id de nota>": "<slug de formato>"}`. Usa **los slugs exactos** de la
tabla; si una nota no encaja en ninguno, `otro` — es información honesta, y si `otro` crece
mucho es que a esta lista le falta un formato tuyo (añádelo aquí, no lo fuerces).

Una nota puede parecerse a dos formatos. Elige el que explique **por qué el lector se para**:
lo que hace el trabajo, no lo que decora.

## El catálogo

| Slug | Qué es | Cuándo funciona |
|---|---|---|
| `gancho-giro` | Primera línea que promete una cosa, el cuerpo entrega otra | Cuando la idea tiene una vuelta de tuerca real. Sin giro, es clickbait |
| `sentencia` | Una o dos frases, sin contexto, para citar | Cuando la idea aguanta sola. Es el formato más difícil de fingir |
| `opinion-con-filo` | Postura clara contra algo que se da por sentado | Cuando de verdad piensas eso y puedes sostenerlo en los comentarios |
| `dato-contraintuitivo` | Un número o hecho que descoloca, más tu lectura | Cuando el dato es verificable. Si no lo es, no se publica |
| `confesion` | Algo que te salió mal, te costó o te da apuro | Cuando sirve al lector, no cuando busca consuelo |
| `micro-historia` | Escena mínima con tensión y remate | Cuando hay un detalle concreto. Una anécdota sin detalle es relleno |
| `lista-corta` | 3–5 puntos, una línea cada uno | Cuando el material es de verdad enumerable; si no, queda a hueco |
| `detras-de-camaras` | Cómo se hace algo tuyo por dentro | Cuando enseña el proceso, no el resultado |
| `pregunta-abierta` | Una pregunta que te interesa de verdad | Cuando quieres respuestas. Preguntar por preguntar se nota y no convierte |
| `cita-comentada` | Frase de otro + qué te hace pensar | Cuando tu comentario aporta más que la cita |
| `antes-despues` | Cómo pensabas antes, qué te hizo cambiar | Cuando el cambio es honesto y reciente |
| `recomendacion` | Señalar el trabajo de otro | Cuando lo has leído. Substack premia esto más que otras redes |
| `anuncio` | Empujar un post, un lanzamiento, algo tuyo | Con cuentagotas: el histórico suele mostrar que rinde por debajo de la mediana, y conviene decírselo al autor con su propio número |
| `tutorial-prompt` | Pasos copiables o un prompt entero regalado en la nota | Cuando el lector puede ejecutarlo hoy sin ti. Si hay que comprar algo para usarlo, no es esto |
| `explicacion` | Desmontar un concepto técnico en lenguaje llano | Cuando el término asusta más que la cosa («skills», «claude code») |
| `otro` | No encaja en ninguno | Etiqueta legítima. Si abunda, falta un formato en esta lista |

## Cómo se elige formato al escribir

De las tres variantes que se entregan: **dos con formatos del top del autor** (con muestra
suficiente) y **una con un formato que apenas ha usado**. Repetir solo lo que ya rinde
estrecha la voz hasta convertirla en un tic, y la tercera variante es barata: si no gusta,
se descarta y no ha costado nada.

Si el material solo admite un formato —un dato es un dato—, no se fuerzan tres: se dicen dos
buenas y se explica por qué la tercera no venía a cuento.
