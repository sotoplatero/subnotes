# La API pública de notas de Substack

Lo que usa `sync.mjs`. Está aquí para que, si algún día cambia, se pueda arreglar sin
adivinar. Todo verificado contra perfiles reales.

## Resolver el handle

```
GET https://substack.com/api/v1/user/{handle}/public_profile
```

Devuelve `{ id, name, handle, bio, photo_url, ... }`. El `id` es lo que hace falta.
Si el handle no existe responde **404** con `{"error":"profile not found"}`.

El handle es el de `substack.com/@handle`, **no** el dominio de la publicación. Una persona
puede tener `objetobrillante.substack.com` como publicación y otro handle distinto como
perfil. `sync.mjs` rechaza a propósito cualquier entrada con un punto: es más honesto fallar
que sincronizar la cuenta equivocada.

## Bajar las notas

```
GET https://substack.com/api/v1/reader/feed/profile/{user_id}?types[]=note&cursor={nextCursor}
```

Devuelve `{ items: [...], nextCursor, originalCursorTimestamp }`.

- **Páginas de 12.** El parámetro `limit` se acepta pero se ignora.
- **`nextCursor`** encadena la siguiente página. Las páginas no se solapan. Cuando no viene
  `nextCursor`, se acabó el histórico.
- Cada item trae `comment` con lo que importa: `id`, `body` (texto plano), `body_json`,
  `date` (ISO), `reaction_count`, `restacks`, `children_count`, `attachments[]`,
  `ancestor_path`, `user_id`, `post_id`, `publication_id`.

**Filtro que aplica `sync.mjs`:** solo entra lo que cumple `comment.user_id === user_id` y
`ancestor_path` vacío. Es decir, notas propias de primer nivel. Las respuestas a otros y los
restacks ajenos se cuentan aparte pero no se guardan: son otro registro de escritura y
mezclarlos ensucia el perfil de voz.

## Lo que esta API NO da

Impresiones, alcance, seguidores ganados y suscriptores atribuidos a una nota. Eso vive en
el panel privado del autor y no sale por aquí. Se puede decir «esta nota tiene 112
reacciones»; no se puede decir «esta nota convirtió». Si hace falta ese dato, hay que mirarlo
a mano en Substack — y entonces es un dato aportado por el autor, no un dato de la base.

## Límites y cortesía

Sin autenticación, sin cookies, leyendo lo mismo que cualquier visitante. Aun así Substack
frena: si responde **429**, `sync.mjs` para, lo dice y deja guardado lo que ya bajó. Se
reanuda más tarde y el sync incremental retoma donde estaba. No conviene insistir en bucle.
