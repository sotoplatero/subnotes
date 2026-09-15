# Cómo se destila `VOZ.md`

El perfil de voz no es una descripción bonita del autor. Es la lista de decisiones concretas
que hay que tomar para escribir una nota que podría haber escrito él. Si un rasgo del perfil
no cambia ninguna palabra del texto generado, sobra.

## La regla que lo sostiene: evidencia

**Cada rasgo va acompañado de dos notas propias que lo demuestran, citadas por id.** Sin esa
disciplina salen adjetivos vacíos —«cercano pero profesional», «directo y auténtico»— que
suenan a informe y no sirven para escribir. Con ella, el rasgo se vuelve comprobable: si
alguien duda, va y lee las dos notas.

Cuando la muestra no deja ver algo con claridad, se escribe «no se ve en los datos» y se
pregunta o se deja fuera. Rellenar huecos con lo que suele hacer la gente en redes es
exactamente lo que convierte el perfil en genérico.

## De dónde salen los datos

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs muestra --handle <handle> --n 60
node --no-warnings=ExperimentalWarning scripts/query.mjs stats   --handle <handle>
node --no-warnings=ExperimentalWarning scripts/query.mjs top     --handle <handle> --n 15
```

`muestra` mezcla a propósito rendimiento alto, medio y bajo, y longitudes distintas. Es la
base del perfil. `stats` da las cifras de forma (longitud, líneas, cadencia, % con enlace).
`top` sirve para el apartado de temas y para los ejemplos, no para la voz: si el perfil se
destila solo de los éxitos, sale una caricatura del autor en su mejor día.

## Las dimensiones

Se recorren todas. Cada una, una o dos frases y sus dos ids.

1. **Apertura.** Cómo entra en la nota: afirmación seca, escena, dato, pregunta, cita.
   ¿Calienta o va directo?
2. **Longitud y ritmo.** Mediana de caracteres y el rango real (p10–p90 de `stats`).
   ¿Frases cortas encadenadas o periodos largos? ¿Párrafos de una línea?
3. **Persona y trato.** Primera persona, plural, impersonal. Tuteo o no. ¿Interpela al
   lector o piensa en voz alta?
4. **Léxico propio.** Las palabras y giros que son suyos —y los que nunca usa. Esta es la
   dimensión que más se nota al leer, y la que más rápido delata una imitación.
5. **Puntuación y forma.** Saltos de línea, guiones, mayúsculas, cursivas, emojis (con
   el porcentaje real, no la impresión).
6. **Humor e ironía.** Si lo hay, de qué tipo: seco, autoparódico, ninguno.
7. **Cierre.** Sentencia, pregunta, enlace, nada. `stats` da el % que acaba preguntando:
   si es 4%, cerrar siempre con pregunta lo delata al instante.
8. **Enlaces e imágenes.** Qué porcentaje lleva adjunto o enlace, y para qué los usa.
9. **Territorio.** Los 3–5 temas que son suyos, y los que claramente no toca.

## Anti-imitación

Un apartado aparte, y es el que más trabajo ahorra después: **los tics que salen al
imitarlo y que hay que evitar**. La metáfora que ya usó diez veces, el remate que se ha
convertido en muletilla, la estructura que repite cuando no tiene nada que decir. Un modelo
que imita sin esta lista amplifica justo lo peor, porque es lo más frecuente en la muestra.

## Plantilla de `VOZ.md`

Se guarda en `~/.claude/subnotes/<handle>/VOZ.md`.

```markdown
# Voz de @<handle> — v0.1
Destilada el <fecha> de <N> notas (<primera> → <última>).

## En una frase
<Cómo escribe, dicho de forma que sirva para escribir.>

## Forma
- Longitud: mediana <X> caracteres, rango habitual <p10>–<p90>.
- Líneas: <n> de mediana. <Cómo reparte los saltos.>
- Cierre: <qué hace>, <%> acaban en pregunta.
- Adjuntos: <%> · Enlaces: <%> · Emojis: <%>

## Rasgos
### Apertura
<Rasgo.> — #<id>, #<id>
### Léxico propio
Suyas: <palabras>. Nunca: <palabras>. — #<id>, #<id>
### <resto de dimensiones>

## Territorio
<3–5 temas suyos, con un id cada uno.> Fuera: <lo que no toca>.

## Anti-imitación
- <Tic a evitar.> — se ve en #<id>
```

## Versionado

`v0.1` la primera vez. Al reperfilar, sube a `v0.2` y añade **una línea de qué cambió**
respecto a la anterior: qué rasgo se movió y desde qué notas se ve. La voz de alguien que
publica se mueve; un perfil de hace un año miente con confianza.

Después de escribir `VOZ.md`, deja constancia en la base para saber cuándo toca reperfilar:

```bash
node --no-warnings=ExperimentalWarning scripts/query.mjs perfil --handle <handle> --version v0.1
```

(`query.mjs estado` avisa solo cuando hay ≥30 notas nuevas desde entonces o pasan 60 días.)
