/**
 * db.mjs — la base de notas y sus ayudantes.
 *
 * Una base por handle, fuera del skill: ~/.claude/subnotes/<handle>/notes.db.
 * Vive fuera para que reinstalar o mover el skill no se lleve por delante el
 * histórico, y para que un mismo Claude pueda llevar varios perfiles.
 *
 * Sin dependencias: node:sqlite viene en Node 22.5+. Es experimental y avisa por
 * stderr; los scripts se lanzan con --no-warnings=ExperimentalWarning.
 */
import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = process.env.SUBNOTES_DIR || join(homedir(), '.claude', 'subnotes');

export function dataDir(handle) {
	const dir = join(ROOT, handle.toLowerCase());
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function dbPath(handle) {
	return join(dataDir(handle), 'notes.db');
}

export function hasProfile(handle) {
	return existsSync(join(ROOT, handle.toLowerCase(), 'notes.db'));
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL,
  user_id INTEGER,
  date TEXT,
  body TEXT,
  body_json TEXT,
  reaction_count INTEGER DEFAULT 0,
  restacks INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  attachments_count INTEGER DEFAULT 0,
  attachment_types TEXT,
  post_id INTEGER,
  publication_id INTEGER,
  url TEXT,
  chars INTEGER,
  words INTEGER,
  lines INTEGER,
  format TEXT,
  format_tagged_at TEXT,
  raw TEXT,
  first_seen TEXT,
  last_seen TEXT
);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date DESC);
CREATE INDEX IF NOT EXISTS idx_notes_reactions ON notes(reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_notes_format ON notes(format);

CREATE TABLE IF NOT EXISTS metric_history (
  note_id INTEGER NOT NULL,
  seen_at TEXT NOT NULL,
  reaction_count INTEGER,
  restacks INTEGER,
  children_count INTEGER,
  PRIMARY KEY (note_id, seen_at)
);

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

export function openDb(handle) {
	const db = new DatabaseSync(dbPath(handle));
	db.exec('PRAGMA journal_mode = WAL;');
	db.exec(SCHEMA);
	return db;
}

/** El cuerpo de una nota viene en texto plano, pero por si acaso. */
export function cleanBody(body) {
	return (body || '').replace(/\r\n/g, '\n').trim();
}

export function countWords(text) {
	const m = cleanBody(text).match(/\S+/g);
	return m ? m.length : 0;
}

export function noteUrl(handle, id) {
	return `https://substack.com/@${handle}/note/c-${id}`;
}

/**
 * Mete o actualiza una nota. Devuelve 'new' | 'updated' | 'same'.
 *
 * Las métricas solo se guardan en metric_history cuando cambian: una nota puede
 * seguir creciendo semanas después de publicarse, y la foto actual esconde eso.
 */
export function upsertNote(db, item, handle) {
	const c = item.comment || {};
	if (!c.id) return 'skip';
	const now = new Date().toISOString();
	const body = cleanBody(c.body);
	const atts = Array.isArray(c.attachments) ? c.attachments : [];
	const row = {
		id: c.id,
		handle: handle.toLowerCase(),
		user_id: c.user_id ?? null,
		date: c.date ?? null,
		body,
		body_json: c.body_json ? JSON.stringify(c.body_json) : null,
		reaction_count: c.reaction_count ?? 0,
		restacks: c.restacks ?? 0,
		children_count: c.children_count ?? 0,
		attachments_count: atts.length,
		attachment_types: atts.length ? [...new Set(atts.map((a) => a.type || 'unknown'))].join(',') : null,
		post_id: c.post_id ?? null,
		publication_id: c.publication_id ?? null,
		url: noteUrl(handle, c.id),
		chars: body.length,
		words: countWords(body),
		lines: body ? body.split('\n').filter((l) => l.trim()).length : 0,
		raw: JSON.stringify(item),
	};

	const prev = db.prepare('SELECT reaction_count, restacks, children_count FROM notes WHERE id = ?').get(row.id);

	if (!prev) {
		db.prepare(`INSERT INTO notes (id, handle, user_id, date, body, body_json, reaction_count,
			restacks, children_count, attachments_count, attachment_types, post_id, publication_id,
			url, chars, words, lines, raw, first_seen, last_seen)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
			row.id, row.handle, row.user_id, row.date, row.body, row.body_json, row.reaction_count,
			row.restacks, row.children_count, row.attachments_count, row.attachment_types, row.post_id,
			row.publication_id, row.url, row.chars, row.words, row.lines, row.raw, now, now,
		);
		db.prepare('INSERT OR REPLACE INTO metric_history VALUES (?,?,?,?,?)').run(
			row.id, now, row.reaction_count, row.restacks, row.children_count,
		);
		return 'new';
	}

	const changed =
		prev.reaction_count !== row.reaction_count ||
		prev.restacks !== row.restacks ||
		prev.children_count !== row.children_count;

	db.prepare(`UPDATE notes SET body = ?, body_json = ?, reaction_count = ?, restacks = ?,
		children_count = ?, attachments_count = ?, attachment_types = ?, chars = ?, words = ?,
		lines = ?, raw = ?, last_seen = ? WHERE id = ?`).run(
		row.body, row.body_json, row.reaction_count, row.restacks, row.children_count,
		row.attachments_count, row.attachment_types, row.chars, row.words, row.lines, row.raw, now, row.id,
	);

	if (changed) {
		db.prepare('INSERT OR REPLACE INTO metric_history VALUES (?,?,?,?,?)').run(
			row.id, now, row.reaction_count, row.restacks, row.children_count,
		);
		return 'updated';
	}
	return 'same';
}

export function mediana(nums) {
	const a = [...nums].filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
	if (!a.length) return 0;
	const m = Math.floor(a.length / 2);
	return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
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
