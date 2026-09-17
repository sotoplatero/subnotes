/**
 * db.mjs — la base de notas y sus ayudantes.
 *
 * Una base por handle, fuera del skill: ~/.claude/subnotes/<handle>/notes.db.
 * Vive fuera para que reinstalar o mover el skill no se lleve por delante el
 * histórico, y para que un mismo Claude pueda llevar varios perfiles.
 *
 * Sin dependencias: node:sqlite viene en Node 22.5+. Avisa de que es experimental
 * por stderr, así que se importa con el aviso ya silenciado.
 */
process.removeAllListeners('warning');
const { DatabaseSync } = await import('node:sqlite');

import { homedir } from 'node:os';
import { mkdirSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = process.env.SUBNOTES_DIR || join(homedir(), '.claude', 'subnotes');

export function dataDir(handle) {
	const dir = join(ROOT, handle.toLowerCase());
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function hasProfile(handle) {
	return existsSync(join(ROOT, handle.toLowerCase(), 'notes.db'));
}

/** Los handles que ya tienen base bajada. */
export function perfiles() {
	if (!existsSync(ROOT)) return [];
	return readdirSync(ROOT, { withFileTypes: true })
		.filter((d) => d.isDirectory() && existsSync(join(ROOT, d.name, 'notes.db')))
		.map((d) => d.name);
}

/**
 * De «@x», «substack.com/@x» o «x» al handle. null si es un dominio de
 * publicación: es más honesto fallar que sincronizar la cuenta equivocada.
 */
export function normalizaHandle(input) {
	let s = String(input || '').trim();
	if (!s) return null;
	if (/substack\.com\/@/i.test(s)) s = s.split('@').pop();
	else if (s.startsWith('@')) s = s.slice(1);
	s = s.split(/[/?#]/)[0].trim();
	if (!s || /\s/.test(s) || s.includes('.')) return null;
	return s.toLowerCase();
}

/**
 * El handle de la orden, o el único que haya bajado. Pedir --handle cuando solo
 * hay un perfil es fricción pura, y es el caso normal.
 */
export function resuelveHandle(input) {
	const dado = normalizaHandle(input);
	if (dado) return dado;
	const hay = perfiles();
	if (hay.length === 1) return hay[0];
	if (!hay.length) return null;
	throw new Error(`Hay varios perfiles bajados (${hay.join(', ')}): di cuál con --handle.`);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL,
  user_id INTEGER,
  date TEXT,
  body TEXT,
  reaction_count INTEGER DEFAULT 0,
  restacks INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  attachments_count INTEGER DEFAULT 0,
  url TEXT,
  chars INTEGER,
  words INTEGER,
  lines INTEGER,
  format TEXT,
  format_tagged_at TEXT,
  first_seen TEXT,
  last_seen TEXT
);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_notes_reactions ON notes(reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_notes_format ON notes(format);

CREATE TABLE IF NOT EXISTS profile (
  handle TEXT PRIMARY KEY,
  user_id INTEGER,
  name TEXT,
  bio TEXT,
  last_sync TEXT,
  notes_count INTEGER,
  voice_version TEXT,
  voice_built_at TEXT,
  voice_notes_count INTEGER
);
`;

/**
 * Bases de antes guardaban el item entero de la API (`raw`), el `body_json` y un
 * historial de métricas que ninguna consulta llegó a leer. Pesaban diez veces lo
 * que hacía falta. Se tiran la primera vez que se abre la base.
 */
const SOBRAN = ['raw', 'body_json', 'post_id', 'publication_id', 'attachment_types'];

function limpiaEsquemaViejo(db) {
	const columnas = db.prepare('PRAGMA table_info(notes)').all().map((c) => c.name);
	const tira = SOBRAN.filter((c) => columnas.includes(c));
	const tabla = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metric_history'").get();
	if (!tira.length && !tabla) return;
	for (const c of tira) db.exec(`ALTER TABLE notes DROP COLUMN ${c}`);
	if (tabla) db.exec('DROP TABLE metric_history');
	db.exec('VACUUM');
}

export function openDb(handle) {
	const db = new DatabaseSync(join(dataDir(handle), 'notes.db'));
	db.exec('PRAGMA journal_mode = WAL;');
	db.exec(SCHEMA);
	limpiaEsquemaViejo(db);
	return db;
}

/** El cuerpo de una nota viene en texto plano, pero por si acaso. */
export function cleanBody(body) {
	return (body || '').replace(/\r\n/g, '\n').trim();
}

export function noteUrl(handle, id) {
	return `https://substack.com/@${handle}/note/c-${id}`;
}

/** Mete o actualiza una nota. Devuelve 'new' | 'updated' | 'same'. */
export function upsertNote(db, item, handle) {
	const c = item.comment || {};
	if (!c.id) return 'skip';
	const now = new Date().toISOString();
	const body = cleanBody(c.body);
	const palabras = body.match(/\S+/g);
	const row = {
		id: c.id,
		handle: handle.toLowerCase(),
		user_id: c.user_id ?? null,
		date: c.date ?? null,
		body,
		reaction_count: c.reaction_count ?? 0,
		restacks: c.restacks ?? 0,
		children_count: c.children_count ?? 0,
		attachments_count: Array.isArray(c.attachments) ? c.attachments.length : 0,
		url: noteUrl(handle, c.id),
		chars: body.length,
		words: palabras ? palabras.length : 0,
		lines: body ? body.split('\n').filter((l) => l.trim()).length : 0,
	};

	const prev = db.prepare('SELECT reaction_count, restacks, children_count FROM notes WHERE id = ?').get(row.id);

	if (!prev) {
		db.prepare(`INSERT INTO notes (id, handle, user_id, date, body, reaction_count, restacks,
			children_count, attachments_count, url, chars, words, lines, first_seen, last_seen)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
			row.id, row.handle, row.user_id, row.date, row.body, row.reaction_count, row.restacks,
			row.children_count, row.attachments_count, row.url, row.chars, row.words, row.lines, now, now,
		);
		return 'new';
	}

	const changed =
		prev.reaction_count !== row.reaction_count ||
		prev.restacks !== row.restacks ||
		prev.children_count !== row.children_count;

	db.prepare(`UPDATE notes SET body = ?, reaction_count = ?, restacks = ?, children_count = ?,
		attachments_count = ?, chars = ?, words = ?, lines = ?, last_seen = ? WHERE id = ?`).run(
		row.body, row.reaction_count, row.restacks, row.children_count,
		row.attachments_count, row.chars, row.words, row.lines, now, row.id,
	);

	return changed ? 'updated' : 'same';
}

export function mediana(nums) {
	const a = [...nums].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
	if (!a.length) return 0;
	const m = Math.floor(a.length / 2);
	return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

export function percentil(nums, p) {
	const a = [...nums].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
	if (!a.length) return 0;
	return a[Math.min(a.length - 1, Math.floor(a.length * p))];
}

/** Sin tildes y en minúsculas: «boletín» y «Boletin» son la misma palabra. */
export const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * La raíz aproximada, para que «lectores» encuentre «lector» y no solo al revés.
 * No es un lematizador: recorta el plural y se queda ahí a propósito.
 */
export const raiz = (t) => (t.length > 5 && t.endsWith('es') ? t.slice(0, -2) : t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

/**
 * Palabras funcionales. Las de 3-6 letras son el problema: pasan cualquier filtro
 * de longitud y aparecen en casi todas las notas, así que puntúan sin informar.
 */
const VACIAS = new Set(`ademas algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bien cada casi como con cosa cual cuales cuando cuanto desde donde dos ella ellas ello ellos entre era eran eres esa esas ese eso esos esta estan estar estas este esto estos fue fueron hace hacer hacia han has hasta hay igual incluso jamas luego mas mientras mismo mucha muchas mucho muchos muy nada nadie ninguna ninguno nos nosotros nuestra nuestro nunca otra otras otro otros para pero poco pocos por porque pues que quien quienes segun ser sera siempre sido sin sino sobre solo son soy sus tal tambien tampoco tan tanto tiene tienen todas todo todos tras tus una uno unos vez ya yo
	las los del ellas lla lle les mis nada sean vas van voy eso ese esa aca alli ahi cuya cuyo cuyas cuyos tener tengo tienes puede pueden podia debe deben esos unas cuanta cuantos
	the and for with that this from your you are but not all any can has how its our out the was what when which who will would about into more some than then there these they` .trim().split(/\s+/));

export const esVacia = (t) => VACIAS.has(t);

/**
 * Los slugs del catálogo, leídos de references/formatos.md. La lista vive en un
 * sitio solo: el documento que el agente lee para clasificar.
 */
export function slugsConocidos() {
	try {
		const md = readFileSync(join(import.meta.dirname, '..', 'references', 'formatos.md'), 'utf8');
		return [...md.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gm)].map((m) => m[1]);
	} catch { return []; }
}

/** Argumentos estilo --clave valor / --bandera, sin dependencias. */
export function parseArgs(argv) {
	const out = { _: [] };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const next = argv[i + 1];
			if (next === undefined || next.startsWith('--')) out[key] = true;
			else { out[key] = next; i++; }
		} else out._.push(a);
	}
	return out;
}
