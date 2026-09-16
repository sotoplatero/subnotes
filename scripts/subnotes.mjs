#!/usr/bin/env node
/**
 * subnotes — la única puerta de entrada.
 *
 *   node scripts/subnotes.mjs <comando> [--handle <handle>] [--json]
 *
 * Cada comando se declara una vez, con su uso y su descripción, y de esa misma
 * declaración sale la ayuda: no hay dos sitios que puedan decir cosas distintas.
 * Un comando devuelve `{ datos, texto }` — los datos son lo que sale con --json,
 * `texto` es cómo se lee sin él. Ninguna cifra sale de otro sitio que no sea la base.
 */
import {
	openDb, hasProfile, perfiles, resuelveHandle, normalizaHandle, dataDir,
	mediana, percentil, plano, slugsConocidos, parseArgs, upsertNote,
} from './db.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const COMANDOS = [];
const comando = (uso, que, run, opts = {}) =>
	COMANDOS.push({ nombre: uso.split(' ')[0], uso, que, run, ...opts });

const ayuda = () => [
	'subnotes · tus notas de Substack, con tus datos',
	'',
	'  node scripts/subnotes.mjs <comando> [--handle <handle>] [--json]',
	'',
	// el uso largo se lleva su línea: alinear a la fuerza deja columnas pegadas
	...COMANDOS.map((c) => (c.uso.length < 46 ? `  ${c.uso.padEnd(46)}${c.que}` : `  ${c.uso}\n  ${' '.repeat(46)}${c.que}`)),
	'',
	'  --handle sobra si solo hay un perfil bajado. Todo acepta --json.',
].join('\n');

const linea = (n) => {
	const f = n.format ? ` [${n.format}]` : '';
	return `#${n.id} · ${(n.date || '').slice(0, 10)} · ${n.reaction_count} reac · ${n.restacks} restacks · ${n.children_count} resp · ${n.words} pal${f}\n${n.body}\n`;
};
const lista = (notas) => notas.forEach((x) => console.log(linea(x) + '---'));

/** Las notas de la base, opcionalmente filtradas por formato. */
const todas = ({ db, args }) => {
	const rows = db.prepare('SELECT * FROM notes ORDER BY date DESC').all();
	return args.formato ? rows.filter((n) => n.format === String(args.formato)) : rows;
};

// ────────────────────────────────────────────────────────────────────── sync

comando('sync [<handle>] [--full] [--max N]', 'baja o actualiza las notas del perfil público', async ({ args }) => {
	const handle = normalizaHandle(args._[1] || args.handle) || resuelveHandle();
	if (!handle) throw new Error('Uso: sync <handle|https://substack.com/@handle> [--full]\nSi lo que tienes es el dominio de la publicación, el handle del perfil es otra cosa: míralo en substack.com/@...');

	const perfil = await pide(`${API}/user/${encodeURIComponent(handle)}/public_profile`)
		.catch((e) => {
			if (String(e.message).startsWith('404')) throw new Error(`No existe el perfil @${handle} en Substack. Comprueba el handle (es el de substack.com/@handle, no el dominio de la publicación).`);
			throw e;
		});
	const userId = perfil.id;
	const db = openDb(handle);

	const full = Boolean(args.full) || db.prepare('SELECT COUNT(*) AS n FROM notes').get().n === 0;
	const pararTras = Number(args.parar ?? 2);
	const maxPaginas = Number(args.max ?? (full ? 500 : 20));

	const cuenta = { nuevas: 0, actualizadas: 0, iguales: 0, ajenas: 0, respuestas: 0 };
	let paginas = 0, secas = 0, aviso = null;

	try {
		for await (const items of paginasDeNotas(userId, maxPaginas)) {
			paginas++;
			let nuevasPagina = 0;
			for (const item of items) {
				const c = item.comment;
				if (!c?.id) continue;
				// Solo notas propias de primer nivel: las respuestas y los restacks de
				// otros son otro registro y contaminarían el perfil de voz.
				if (c.user_id !== userId) { cuenta.ajenas++; continue; }
				if (c.ancestor_path) { cuenta.respuestas++; continue; }
				const r = upsertNote(db, item, handle);
				if (r === 'new') { cuenta.nuevas++; nuevasPagina++; }
				else if (r === 'updated') cuenta.actualizadas++;
				else cuenta.iguales++;
			}
			process.stderr.write(`\r  página ${paginas} · ${cuenta.nuevas} nuevas · ${cuenta.actualizadas} actualizadas`);
			if (!full && (secas = nuevasPagina === 0 ? secas + 1 : 0) >= pararTras) break;
		}
	} catch (e) { aviso = e.message; }
	process.stderr.write('\r');

	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const rango = db.prepare('SELECT MIN(date) AS desde, MAX(date) AS hasta FROM notes').get();
	const ahora = new Date().toISOString();
	db.prepare(`INSERT INTO profile (handle, user_id, name, bio, last_sync, notes_count)
		VALUES (?,?,?,?,?,?)
		ON CONFLICT(handle) DO UPDATE SET user_id=excluded.user_id, name=excluded.name,
		bio=excluded.bio, last_sync=excluded.last_sync, notes_count=excluded.notes_count`)
		.run(handle, userId, perfil.name ?? null, perfil.bio ?? null, ahora, total);

	const dir = dataDir(handle);
	writeFileSync(join(dir, 'LEEME.md'), leeme({ handle, perfil, total, rango, ahora, full, aviso }), 'utf8');
	if (aviso) process.exitCode = 2;

	const datos = {
		handle, user_id: userId, nombre: perfil.name, paginas, ...cuenta,
		total_en_base: total, desde: rango.desde, hasta: rango.hasta,
		recorrido: full ? 'completo' : 'incremental', base: join(dir, 'notes.db'), aviso,
	};
	return { datos, texto() {
		console.log(`@${handle} (${perfil.name ?? 'sin nombre'}) · recorrido ${datos.recorrido}, ${paginas} páginas`);
		console.log(`  ${cuenta.nuevas} notas nuevas, ${cuenta.actualizadas} con métricas actualizadas, ${cuenta.iguales} sin cambios`);
		if (cuenta.ajenas || cuenta.respuestas) console.log(`  descartadas: ${cuenta.respuestas} respuestas, ${cuenta.ajenas} de otros autores`);
		console.log(`  ${total} notas en la base, de ${(rango.desde || '?').slice(0, 10)} a ${(rango.hasta || '?').slice(0, 10)}`);
		console.log(`  ${join(dir, 'notes.db')}`);
		if (aviso) console.log(`  AVISO: ${aviso}`);
	} };
}, { base: false });

// ───────────────────────────────────────────────────────────────────── estado

comando('estado', 'qué hay en la base, y si toca resincronizar o reperfilar', ({ db, handle }) => {
	const p = db.prepare('SELECT * FROM profile WHERE handle = ?').get(handle) || {};
	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const r = db.prepare('SELECT MIN(date) AS desde, MAX(date) AS hasta FROM notes').get();
	const sinFormato = db.prepare('SELECT COUNT(*) AS n FROM notes WHERE format IS NULL').get().n;
	const dias = p.last_sync ? Math.floor((Date.now() - Date.parse(p.last_sync)) / 86400000) : null;
	const nuevas = p.voice_notes_count != null ? total - p.voice_notes_count : null;
	const desfasado = nuevas != null && (nuevas >= 30 || (dias != null && dias > 60));
	const datos = { ...p, total, ...r, sin_formato: sinFormato, dias_desde_sync: dias, nuevas_desde_perfil: nuevas, perfil_desfasado: desfasado };
	return { datos, texto() {
		console.log(`@${handle} · ${p.name ?? ''}`);
		console.log(`  ${total} notas, de ${(r.desde || '?').slice(0, 10)} a ${(r.hasta || '?').slice(0, 10)}`);
		console.log(`  último sync: ${p.last_sync ?? 'nunca'}${dias != null ? ` (hace ${dias} días)` : ''}`);
		console.log(`  perfil de voz: ${p.voice_version ?? 'sin construir'}${p.voice_built_at ? ` del ${p.voice_built_at.slice(0, 10)}` : ''}`);
		if (nuevas != null) console.log(`  notas nuevas desde el perfil: ${nuevas}`);
		if (sinFormato) console.log(`  sin etiqueta de formato: ${sinFormato}`);
		if (desfasado) console.log('  → el perfil se ha quedado viejo: conviene reperfilar.');
	} };
});

// ────────────────────────────────────────────────────────────────────── stats

comando('stats', 'tus medianas: longitud, forma, cadencia, reacciones', (ctx) => {
	const all = todas(ctx);
	if (!all.length) throw new Error('La base está vacía.');
	const fechas = all.map((n) => Date.parse(n.date)).filter(Number.isFinite).sort((a, b) => a - b);
	const semanas = Math.max(1, (fechas.at(-1) - fechas[0]) / (7 * 86400000));
	const largos = all.map((n) => n.chars);
	const porc = (f) => Math.round((all.filter(f).length / all.length) * 100);
	const datos = {
		handle: ctx.handle, notas: all.length,
		desde: all.at(-1).date?.slice(0, 10), hasta: all[0].date?.slice(0, 10),
		por_semana: Number((all.length / semanas).toFixed(1)),
		mediana_reacciones: mediana(all.map((n) => n.reaction_count)),
		mediana_restacks: mediana(all.map((n) => n.restacks)),
		mediana_respuestas: mediana(all.map((n) => n.children_count)),
		mediana_caracteres: mediana(largos), mediana_palabras: mediana(all.map((n) => n.words)),
		caracteres_p10: percentil(largos, 0.1), caracteres_p90: percentil(largos, 0.9),
		mediana_lineas: mediana(all.map((n) => n.lines)),
		con_adjunto_pct: porc((n) => n.attachments_count > 0),
		con_enlace_pct: porc((n) => /https?:\/\//.test(n.body || '')),
		termina_en_pregunta_pct: porc((n) => /\?\s*$/.test((n.body || '').trim())),
	};
	return { datos, texto() {
		const s = datos;
		console.log(`# Tus números, @${s.handle} (${s.notas} notas, ${s.desde} → ${s.hasta})\n`);
		console.log(`cadencia    ${s.por_semana} notas por semana`);
		console.log(`reacciones  mediana ${s.mediana_reacciones} · restacks ${s.mediana_restacks} · respuestas ${s.mediana_respuestas}`);
		console.log(`longitud    mediana ${s.mediana_caracteres} caracteres (${s.mediana_palabras} palabras), p10 ${s.caracteres_p10} · p90 ${s.caracteres_p90}`);
		console.log(`forma       ${s.mediana_lineas} líneas de mediana · ${s.con_adjunto_pct}% con adjunto · ${s.con_enlace_pct}% con enlace · ${s.termina_en_pregunta_pct}% acaban preguntando`);
		console.log('\nSe compara contra tu propia mediana, no contra ningún benchmark del sector.');
		console.log('Impresiones y suscriptores por nota no están aquí: son privados del panel.');
	} };
});

// ───────────────────────────────────────────────────────────────────── muestra

comando('muestra [--n 60]', 'muestra mezclada a propósito, para destilar la voz', (ctx) => {
	const n = Number(ctx.args.n ?? 60);
	const all = todas(ctx);
	if (!all.length) throw new Error('La base está vacía.');
	// Mezclada a propósito: alto, medio y bajo rendimiento, y cortas y largas.
	// Aprender solo de los éxitos produce una caricatura del autor en su mejor día.
	const porReac = [...all].sort((a, b) => b.reaction_count - a.reaction_count);
	const t = Math.ceil(porReac.length / 3);
	const cupo = Math.ceil(n / 3);
	const elegidas = new Map();
	for (const estrato of [porReac.slice(0, t), porReac.slice(t, 2 * t), porReac.slice(2 * t)]) {
		// dentro de cada estrato, reparte por longitud: si no, solo salen las cortas
		const porLargo = [...estrato].sort((a, b) => a.chars - b.chars);
		const paso = Math.max(1, Math.floor(porLargo.length / cupo));
		for (let i = 0; i < porLargo.length && elegidas.size < n; i += paso) elegidas.set(porLargo[i].id, porLargo[i]);
	}
	const notas = [...elegidas.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
	return { datos: { handle: ctx.handle, total: all.length, muestra: notas.length, notas }, texto() {
		console.log(`# Muestra de ${notas.length} notas de @${ctx.handle} (de ${all.length} en la base)\n`);
		console.log('Mezcla deliberada de rendimiento alto/medio/bajo y de longitudes distintas.\n');
		lista(notas);
	} };
});

// ───────────────────────────────────────────────────────────────────────── top

comando('top [--n 20] [--metrica restacks] [--formato <slug>] [--desde AAAA-MM-DD]',
	'tus mejores notas, filtrables por formato', (ctx) => {
	const { args } = ctx;
	const metrica = { reacciones: 'reaction_count', restacks: 'restacks', respuestas: 'children_count' }[String(args.metrica || 'reacciones')] || 'reaction_count';
	const desde = args.desde ? String(args.desde) : '0000';
	const notas = todas(ctx)
		.filter((n) => (n.date || '') >= desde)
		.sort((a, b) => b[metrica] - a[metrica] || (b.date || '').localeCompare(a.date || ''))
		.slice(0, Number(args.n ?? 20));
	return { datos: { handle: ctx.handle, metrica, formato: args.formato ?? null, notas }, texto() {
		console.log(`# Top ${notas.length} de @${ctx.handle} por ${metrica}${args.formato ? ` · formato ${args.formato}` : ''}${args.desde ? ` desde ${args.desde}` : ''}\n`);
		lista(notas);
	} };
});

// ────────────────────────────────────────────────────────────────────── buscar

comando('buscar "<texto>" [--n 10]', '¿ya he hablado de esto? (ignora tildes y mayúsculas)', (ctx) => {
	const { args } = ctx;
	const q = args._.slice(1).join(' ').trim() || String(args.q || '');
	if (!q) throw new Error('Uso: buscar "<texto>"');
	const terminos = plano(q).split(/\s+/).filter((t) => t.length > 2);
	const all = todas(ctx);
	const notas = all.map((nota) => {
		const cuerpo = plano(nota.body || '');
		return { aciertos: terminos.filter((t) => cuerpo.includes(t)).length, ...nota };
	}).filter((x) => x.aciertos > 0)
		.sort((a, b) => b.aciertos - a.aciertos || b.reaction_count - a.reaction_count)
		.slice(0, Number(args.n ?? 10));
	return { datos: { handle: ctx.handle, consulta: q, encontradas: notas.length, notas }, texto() {
		if (!notas.length) return console.log(`Nada parecido a «${q}» en las ${all.length} notas de @${ctx.handle}. Tema virgen.`);
		console.log(`# ${notas.length} notas tuyas tocan «${q}» (de ${all.length})\n`);
		for (const x of notas) console.log(`${x.aciertos}/${terminos.length} términos · ` + linea(x) + '---');
	} };
});

// ──────────────────────────────────────────────────────────────────── formatos

comando('formatos [--min 5]', 'ranking de formatos por mediana de reacciones', (ctx) => {
	const minMuestra = Number(ctx.args.min ?? 5);
	const all = todas(ctx);
	const grupos = Map.groupBy(all.filter((n) => n.format), (n) => n.format);
	const ranking = [...grupos].map(([formato, notas]) => ({
		formato, n: notas.length,
		mediana_reacciones: mediana(notas.map((x) => x.reaction_count)),
		mediana_restacks: mediana(notas.map((x) => x.restacks)),
		mediana_caracteres: mediana(notas.map((x) => x.chars)),
		poca_muestra: notas.length < minMuestra,
		ejemplos: [...notas].sort((a, b) => b.reaction_count - a.reaction_count).slice(0, 2).map((x) => x.id),
	})).sort((a, b) => a.poca_muestra - b.poca_muestra || b.mediana_reacciones - a.mediana_reacciones);
	const sinEtiquetar = all.filter((n) => !n.format).length;
	const medianaGlobal = mediana(all.map((n) => n.reaction_count));
	return { datos: { handle: ctx.handle, mediana_global: medianaGlobal, sin_etiquetar: sinEtiquetar, ranking }, texto() {
		console.log(`# Formatos de @${ctx.handle} · mediana global ${medianaGlobal} reacciones\n`);
		if (!ranking.length) return console.log(`Ninguna nota etiquetada todavía (${sinEtiquetar} pendientes). Usa: etiquetar pendientes`);
		for (const f of ranking) {
			console.log(`${String(f.mediana_reacciones).padStart(5)} reac  ${f.formato.padEnd(22)} n=${String(f.n).padEnd(4)} ${f.mediana_caracteres} car · ej. #${f.ejemplos.join(', #')}${f.poca_muestra ? '   (poca muestra: no es un ganador)' : ''}`);
		}
		if (sinEtiquetar) console.log(`\n${sinEtiquetar} notas sin etiquetar: el ranking mejora si las clasificas.`);
	} };
});

// ─────────────────────────────────────────────────────────────────── etiquetar

comando('etiquetar [--n 40]', 'las notas que faltan por clasificar, de mayor a menor peso', ({ db, args }) => {
	const notas = db.prepare('SELECT id, date, reaction_count, chars, body FROM notes WHERE format IS NULL ORDER BY reaction_count DESC LIMIT ?').all(Number(args.n ?? 40));
	return { datos: { pendientes: notas }, texto() {
		console.log(`# ${notas.length} notas sin formato (de mayor a menor rendimiento)\n`);
		for (const r of notas) console.log(`#${r.id} · ${(r.date || '').slice(0, 10)} · ${r.reaction_count} reac\n${r.body}\n---`);
		console.log('\nClasifícalas contra references/formatos.md y guárdalas con:');
		console.log('  etiquetar-aplicar --datos {"<id>":"<slug>"}');
	} };
});

// Valida contra el catálogo y contra la base: un slug mal escrito se convertía en
// un formato fantasma con n=1 que ensuciaba el ranking, y en silencio.
comando('etiquetar-aplicar --datos {"<id>":"<slug>"}', 'guarda las etiquetas (o --archivo lote.json)', async ({ db, args }) => {
	const datos = args.archivo
		? JSON.parse((await import('node:fs')).readFileSync(String(args.archivo), 'utf8'))
		: JSON.parse(String(args.datos || '{}'));
	const validos = slugsConocidos();
	const existe = db.prepare('SELECT 1 FROM notes WHERE id = ?');
	const st = db.prepare('UPDATE notes SET format = ?, format_tagged_at = ? WHERE id = ?');
	const ahora = new Date().toISOString();
	const malSlug = [], malId = [];
	let n = 0;
	for (const [id, slug] of Object.entries(datos)) {
		if (validos.length && !validos.includes(String(slug))) { malSlug.push(`${id}: ${slug}`); continue; }
		if (!existe.get(Number(id))) { malId.push(String(id)); continue; }
		st.run(String(slug), ahora, Number(id));
		n++;
	}
	const faltan = db.prepare('SELECT COUNT(*) AS n FROM notes WHERE format IS NULL').get().n;
	return { datos: { etiquetadas: n, pendientes: faltan, slugs_desconocidos: malSlug, ids_inexistentes: malId }, texto() {
		console.log(`${n} notas etiquetadas. Quedan ${faltan} sin formato.`);
		if (malSlug.length) console.log(`  slugs que no están en el catálogo (no guardados): ${malSlug.join(', ')}`);
		if (malId.length) console.log(`  ids que no están en la base (no guardados): ${malId.join(', ')}`);
	} };
});

// ────────────────────────────────────────────────────────────────────── perfil

comando('perfil --version v0.1', 'registra que VOZ.md se ha escrito, y con cuántas notas', ({ db, handle, args }) => {
	const version = String(args.version || 'v0.1');
	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const ahora = new Date().toISOString();
	db.prepare('UPDATE profile SET voice_version = ?, voice_built_at = ?, voice_notes_count = ? WHERE handle = ?')
		.run(version, ahora, total, handle);
	return { datos: { handle, voice_version: version, voice_built_at: ahora, voice_notes_count: total },
		texto: () => console.log(`Perfil de voz ${version} registrado para @${handle} sobre ${total} notas.`) };
});

// ──────────────────────────────────────────────────────────── la API pública

const API = 'https://substack.com/api/v1';
const UA = 'Mozilla/5.0 (compatible; subnotes/1.0; +https://github.com/)';

async function pide(url) {
	const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
	if (res.status === 429) throw new Error('429: Substack está frenando las peticiones. Espera un rato largo y reanuda; lo bajado ya está guardado.');
	if (!res.ok) throw new Error(`${res.status} al pedir ${url}`);
	return res.json();
}

/** El feed paginado, página a página, hasta que se acaba el histórico. */
async function* paginasDeNotas(userId, maxPaginas) {
	let cursor = null;
	for (let i = 0; i < maxPaginas; i++) {
		const url = new URL(`${API}/reader/feed/profile/${userId}`);
		url.searchParams.append('types[]', 'note');
		if (cursor) url.searchParams.set('cursor', cursor);
		const data = await pide(url.toString());
		if (!data.items?.length) return;
		yield data.items;
		if (!(cursor = data.nextCursor)) return;
	}
}

const leeme = ({ handle, perfil, total, rango, ahora, full, aviso }) => `# Notas de @${handle}

${total} notas de ${perfil.name ?? handle}, de ${(rango.desde || '?').slice(0, 10)} a ${(rango.hasta || '?').slice(0, 10)}.
Último sync: ${ahora} (recorrido ${full ? 'completo' : 'incremental'}).
${aviso ? `\nEl último sync se interrumpió: ${aviso}\n` : ''}
## Qué hay

\`notes.db\` (SQLite) con una fila por nota propia de primer nivel: texto, fecha,
reacciones, restacks, respuestas, adjuntos y URL. Cada sync refresca los números.

## Qué NO hay, y no se puede inventar

Impresiones, seguidores ganados y suscriptores por nota. Son privados del panel de
Substack y esto lee lo mismo que un visitante cualquiera, sin iniciar sesión.
Cualquier cifra de alcance o conversión que aparezca por ahí no sale de estos datos.

## De quién es

Lo que hay dentro lo escribió ${perfil.name ?? '@' + handle}. Sirve para estudiar y
reutilizar su propia voz, no para republicarlo.
`;

// ──────────────────────────────────────────────────────────────────────── main

const args = parseArgs(process.argv.slice(2));
const cmd = COMANDOS.find((c) => c.nombre === args._[0]);
if (!cmd || args.help) {
	console.log(ayuda());
	process.exit(cmd ? 0 : 1);
}

try {
	const ctx = { args };
	if (cmd.base !== false) {
		ctx.handle = resuelveHandle(args.handle);
		if (!ctx.handle) throw new Error('No hay ninguna base bajada todavía. Empieza por: subnotes.mjs sync <handle> --full');
		if (!hasProfile(ctx.handle)) {
			throw new Error(`No hay base para @${ctx.handle}. Lánzale primero: subnotes.mjs sync ${ctx.handle} --full`
				+ (perfiles().length ? `\nBajados: ${perfiles().join(', ')}` : ''));
		}
		ctx.db = openDb(ctx.handle);
	}
	const { datos, texto } = await cmd.run(ctx);
	if (args.json) console.log(JSON.stringify(datos, null, 2));
	else texto();
} catch (e) {
	console.error(String(e.message || e));
	process.exit(1);
}
