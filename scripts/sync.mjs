/**
 * sync.mjs — baja las notas de un perfil público de Substack a notes.db.
 *
 *   node --no-warnings=ExperimentalWarning scripts/sync.mjs <handle|url> [opciones]
 *
 *   --full          recorre todo el histórico (la primera vez, siempre)
 *   --parar N       para tras N páginas seguidas sin notas nuevas (por defecto 2)
 *   --max N         tope duro de páginas, por si acaso
 *   --json          resumen en JSON en vez de texto
 *
 * Lee lo mismo que vería un visitante cualquiera: no inicia sesión en ninguna
 * parte. Por eso hay números que NO están y que este script nunca inventa:
 * impresiones, seguidores ganados y suscriptores por nota son privados del panel.
 */
import { openDb, upsertNote, dataDir, parseArgs } from './db.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (compatible; subnotes/1.0; +https://github.com/)';
const API = 'https://substack.com/api/v1';

function normalizaHandle(input) {
	let s = String(input || '').trim();
	if (!s) return null;
	if (/substack\.com\/@/i.test(s)) s = s.split('@').pop();
	else if (s.startsWith('@')) s = s.slice(1);
	s = s.split(/[/?#]/)[0].trim();
	if (!s || /\s/.test(s)) return null;
	if (s.includes('.')) return null; // un dominio de publicación no es un handle de perfil
	return s.toLowerCase();
}

async function pide(url) {
	const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
	if (res.status === 429) {
		throw new Error('429: Substack está frenando las peticiones. Espera un rato largo y reanuda; lo bajado ya está guardado.');
	}
	if (!res.ok) throw new Error(`${res.status} al pedir ${url}`);
	return res.json();
}

async function resuelvePerfil(handle) {
	try {
		return await pide(`${API}/user/${encodeURIComponent(handle)}/public_profile`);
	} catch (e) {
		if (String(e.message).startsWith('404')) {
			throw new Error(`No existe el perfil @${handle} en Substack. Comprueba el handle (es el de substack.com/@handle, no el dominio de la publicación).`);
		}
		throw e;
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const entrada = args._[0] || args.handle;
	const handle = normalizaHandle(entrada);
	if (!handle) {
		console.error('Uso: sync.mjs <handle|https://substack.com/@handle> [--full] [--parar N] [--max N]');
		console.error('Si lo que tienes es el dominio de la publicación, el handle del perfil es otra cosa: mírala en substack.com/@...');
		process.exit(1);
	}

	const perfil = await resuelvePerfil(handle);
	const userId = perfil.id;
	const db = openDb(handle);

	const yaHabia = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const full = Boolean(args.full) || yaHabia === 0;
	const pararTras = Number(args.parar ?? 2);
	const maxPaginas = Number(args.max ?? (full ? 500 : 20));

	let cursor = null;
	let paginas = 0, nuevas = 0, actualizadas = 0, iguales = 0, ajenas = 0, respuestas = 0;
	let secas = 0;
	let aviso = null;

	try {
		while (paginas < maxPaginas) {
			const url = new URL(`${API}/reader/feed/profile/${userId}`);
			url.searchParams.append('types[]', 'note');
			if (cursor) url.searchParams.set('cursor', cursor);
			const data = await pide(url.toString());
			paginas++;
			const items = data.items || [];
			if (!items.length) break;

			let nuevasPagina = 0;
			for (const item of items) {
				const c = item.comment;
				if (!c || !c.id) continue;
				// Solo notas propias de primer nivel: las respuestas y los restacks de otros
				// son otro registro y contaminarían el perfil de voz.
				if (c.user_id !== userId) { ajenas++; continue; }
				if (c.ancestor_path) { respuestas++; continue; }
				const r = upsertNote(db, item, handle);
				if (r === 'new') { nuevas++; nuevasPagina++; }
				else if (r === 'updated') actualizadas++;
				else iguales++;
			}

			cursor = data.nextCursor;
			if (!cursor) break;
			if (!full) {
				secas = nuevasPagina === 0 ? secas + 1 : 0;
				if (secas >= pararTras) break;
			}
			process.stderr.write(`\r  página ${paginas} · ${nuevas} nuevas · ${actualizadas} actualizadas`);
		}
	} catch (e) {
		aviso = e.message;
	}
	process.stderr.write('\r');

	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const rango = db.prepare('SELECT MIN(date) AS desde, MAX(date) AS hasta FROM notes').get();
	const ahora = new Date().toISOString();
	db.prepare(`INSERT INTO profile (handle, user_id, name, bio, last_sync, notes_count)
		VALUES (?,?,?,?,?,?)
		ON CONFLICT(handle) DO UPDATE SET user_id=excluded.user_id, name=excluded.name,
		bio=excluded.bio, last_sync=excluded.last_sync, notes_count=excluded.notes_count`).run(
		handle, userId, perfil.name ?? null, perfil.bio ?? null, ahora, total,
	);

	const dir = dataDir(handle);
	writeFileSync(join(dir, 'LEEME.md'), leeme({ handle, perfil, total, rango, ahora, full, aviso }), 'utf8');

	const resumen = {
		handle, user_id: userId, nombre: perfil.name, paginas, nuevas, actualizadas, sin_cambios: iguales,
		descartadas: { ajenas, respuestas }, total_en_base: total,
		desde: rango.desde, hasta: rango.hasta, recorrido: full ? 'completo' : 'incremental',
		base: join(dir, 'notes.db'), aviso,
	};

	if (args.json) console.log(JSON.stringify(resumen, null, 2));
	else {
		console.log(`@${handle} (${perfil.name ?? 'sin nombre'}) · recorrido ${resumen.recorrido}, ${paginas} páginas`);
		console.log(`  ${nuevas} notas nuevas, ${actualizadas} con métricas actualizadas, ${iguales} sin cambios`);
		if (ajenas || respuestas) console.log(`  descartadas: ${respuestas} respuestas, ${ajenas} de otros autores`);
		console.log(`  ${total} notas en la base, de ${(rango.desde || '?').slice(0, 10)} a ${(rango.hasta || '?').slice(0, 10)}`);
		console.log(`  ${join(dir, 'notes.db')}`);
		if (aviso) console.log(`  AVISO: ${aviso}`);
	}
	if (aviso) process.exitCode = 2;
}

function leeme({ handle, perfil, total, rango, ahora, full, aviso }) {
	return `# Notas de @${handle}

${total} notas de ${perfil.name ?? handle}, de ${(rango.desde || '?').slice(0, 10)} a ${(rango.hasta || '?').slice(0, 10)}.
Último sync: ${ahora} (recorrido ${full ? 'completo' : 'incremental'}).
${aviso ? `\nEl último sync se interrumpió: ${aviso}\n` : ''}
## Qué hay

\`notes.db\` (SQLite) con una fila por nota propia de primer nivel: texto, fecha,
reacciones, restacks, respuestas, adjuntos y URL. \`metric_history\` guarda una fila
cada vez que los números de una nota cambian.

## Qué NO hay, y no se puede inventar

Impresiones, seguidores ganados y suscriptores por nota. Son privados del panel de
Substack y esto lee lo mismo que un visitante cualquiera, sin iniciar sesión.
Cualquier cifra de alcance o conversión que aparezca por ahí no sale de estos datos.

## De quién es

Lo que hay dentro lo escribió ${perfil.name ?? '@' + handle}. Sirve para estudiar y
reutilizar su propia voz, no para republicarlo.
`;
}

main().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
