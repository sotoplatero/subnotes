# Escribir una nota

El trabajo del día a día. Entra un encargo —un tema, un enlace, un párrafo a medias, a veces
solo «una nota sobre esto»— y sale texto listo para pegar en Substack.

## El procedimiento

**1. Lee `VOZ.md`.** Está en `~/.claude/subnotes/<handle>/VOZ.md`. Es el contrato: forma,
rasgos, territorio y, sobre todo, la lista anti-imitación. Si no existe, no hay perfil
todavía: arranca el booteo antes de escribir nada.

**2. Comprueba si ya lo dijo.**

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs buscar "<3-5 palabras del tema>" --handle <handle>
```

Si aparecen notas suyas sobre lo mismo, **dilo antes de escribir**, con id y fecha. Y usa el
hallazgo: la nota nueva puede contradecir a la vieja, actualizarla o llevarla más lejos, y
eso casi siempre es mejor nota que repetir el mismo argumento con otras palabras.

Si no aparece nada, también se dice: «tema virgen» es información útil.

**3. Trae las anclas.** 5–8 notas reales que se parezcan a lo que vas a escribir —por tema o
por formato— con `buscar` o `top`. Escribir con texto suyo delante produce mucha mejor
imitación que escribir con una descripción de su estilo.

**4. Elige formato.** Mira el ranking real:

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs formatos --handle <handle>
```

Dos variantes con formatos de su top (con muestra suficiente), una con un formato que apenas
ha usado. El detalle está en `formatos.md`.

**5. Elige el tono tú.** Nada de preguntar al usuario qué tono quiere: léelo del material.
Un dato duro pide sequedad; una historia personal pide calma; una discusión pide filo. El
tono **modula** dentro del registro que fija `VOZ.md`; no lo sustituye. Entrega en plan
«esto es lo que necesitas»: una línea por variante diciendo qué tono lleva y por qué ese
material lo pide.

Si el encargo ya nombra el tono («algo con humor», «sin ironía, que es serio»), manda el
encargo. Si al usuario no le convence, lo cambia en una frase y se rehace: más rápido que
un cuestionario por delante.

**6. Escribe tres variantes distintas en enfoque.** Tres ángulos, no tres redacciones del
mismo párrafo. Si las tres dicen lo mismo, es una variante con tres pieles y no sirve para
elegir.

Calibra la longitud con sus números (`stats`): dentro de su rango habitual (p10–p90), no
en su máximo. Respeta su forma: líneas, cierre, emojis, enlaces — todo eso está medido.

**7. Entrega.**

## La entrega: siempre en bloque para copiar

Cada variante va **dentro de un bloque de código**, y dentro del bloque va exactamente el
texto que se publica. Nada más: ni comillas, ni «Variante 1:», ni el recuento de caracteres,
ni una nota del traductor. Todo lo que entra en el bloque acaba pegado en Substack por
accidente antes o después.

Los comentarios van fuera, en una línea por variante:

````
**1 · confesión, tono seco** — tu formato con mejor mediana (78 reac, n=14)

```
Tardé tres años en admitir que la mitad de lo que publico no lo lee nadie.

La otra mitad paga el alquiler.
```

**2 · dato contraintuitivo, tono de curiosidad** — el material trae un número y el número
hace el trabajo

```
...
```
````

Al final, un bloque de tres líneas como mucho: si el tema ya salió (con ids), qué se ha
calibrado con sus datos, y qué probar si ninguna encaja. Sin sermones.

## Lo que hunde una nota

- **La coletilla de manual.** «¿Y tú qué opinas?» si sus notas no acaban preguntando —`stats`
  dice el porcentaje real—. Si es 4%, cerrar así lo delata.
- **Las tres variantes con el mismo remate.** Es el tic más frecuente al generar en lote.
- **Hashtags y emojis decorativos** que no están en su histórico.
- **El dato inventado.** Si la nota necesita una cifra, o está en el encargo o se pregunta.
  Una nota es pública y lleva su nombre.
- **Los números que no existen.** Reacciones, restacks y respuestas son reales y están en la
  base. Impresiones, alcance y suscriptores ganados **no están** y no se estiman.
- **La imitación de superficie**: copiar sus muletillas sin su forma de pensar. Por eso el
  apartado anti-imitación de `VOZ.md` se lee antes de escribir, no después.

## Cuando el encargo trae un texto de partida

Si el usuario pega un párrafo, un borrador o un fragmento de un post suyo, ese texto manda
sobre el tema: se conserva su idea y su ángulo, y el trabajo es ajustarlo a su forma de nota
(longitud, apertura, cierre) y ofrecer los tres enfoques. No se reescribe entero por gusto:
si una frase suya ya funciona, se deja tal cual.
