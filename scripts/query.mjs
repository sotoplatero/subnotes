/**
 * query.mjs — todo lo que se le pregunta a la base de notas.
 *
 *   node --no-warnings=ExperimentalWarning scripts/query.mjs <subcomando> --handle <handle>
 *
 *   estado                          qué hay en la base y si toca resincronizar o reperfilar
 *   perfil    --version v0.1        registra que VOZ.md se ha escrito (y con cuántas notas)
 *   muestra   [--n 60]              muestra mezclada a propósito, para destilar la voz
 *   top       [--n 20] [--metrica reacciones|restacks|respuestas] [--desde AAAA-MM-DD]
 *   buscar    "<texto>" [--n 10]    ¿ya he hablado de esto?
 *   stats                           tus medianas: longitud, cadencia, reacciones
 *   formatos                        ranking de formatos por mediana de reacciones
 *   etiquetar pendientes [--n 40]   notas sin formato, listas para clasificar
 *   etiquetar aplicar --archivo f.json   guarda {"<id>": "<formato>", ...}
 *   export    [--md CARPETA]        vuelca la base a markdown legible
 *
 * Todo acepta --json. Ninguna cifra sale de otro sitio que no sea la base.
 */
import { openDb, hasProfile, dataDir, mediana, parseArgs } from './db.mjs';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs(process.argv.slice(2));
const sub = args._[0];
const handle = String(args.handle || args.h || '').replace(/^@/, '').toLowerCase();

if (!sub || !handle) {
	console.error('Uso: query.mjs <estado|perfil|muestra|top|buscar|stats|formatos|etiquetar|export> --handle <handle>');
	process.exit(1);
}
if (!hasProfile(handle)) {
	console.error(`No hay base para @${handle}. Lánzale primero: sync.mjs ${handle} --full`);
	process.exit(1);
}
const db = openDb(handle);
const json = Boolean(args.json);
const salida = (obj, texto) => { if (json) console.log(JSON.stringify(obj, null, 2)); else texto(); };
const limpia = ({ raw, body_json, ...resto }) => resto;

const todas = () => db.prepare('SELECT * FROM notes ORDER BY date DESC').all();
const linea = (n) => {
	const f = n.format ? ` [${n.format}]` : '';
	return `#${n.id} · ${(n.date || '').slice(0, 10)} · ${n.reaction_count} reac · ${n.restacks} restacks · ${n.children_count} resp · ${n.words} pal${f}\n${n.body}\n`;
};

// ---------------------------------------------------------------- estado
if (sub === 'estado') {
	const p = db.prepare('SELECT * FROM profile WHERE handle = ?').get(handle) || {};
	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const r = db.prepare('SELECT MIN(date) AS desde, MAX(date) AS hasta FROM notes').get();
	const sinFormato = db.prepare('SELECT COUNT(*) AS n FROM notes WHERE format IS NULL').get().n;
	const dias = p.last_sync ? Math.floor((Date.now() - Date.parse(p.last_sync)) / 86400000) : null;
	const nuevasDesdePerfil = p.voice_notes_count != null ? total - p.voice_notes_count : null;
	const desfasado = nuevasDesdePerfil != null && (nuevasDesdePerfil >= 30 || (dias != null && dias > 60));
	salida({ ...p, total, ...r, sin_formato: sinFormato, dias_desde_sync: dias, nuevas_desde_perfil: nuevasDesdePerfil, perfil_desfasado: desfasado }, () => {
		console.log(`@${handle} · ${p.name ?? ''}`);
		console.log(`  ${total} notas, de ${(r.desde || '?').slice(0, 10)} a ${(r.hasta || '?').slice(0, 10)}`);
		console.log(`  último sync: ${p.last_sync ?? 'nunca'}${dias != null ? ` (hace ${dias} días)` : ''}`);
		console.log(`  perfil de voz: ${p.voice_version ?? 'sin construir'}${p.voice_built_at ? ` del ${p.voice_built_at.slice(0, 10)}` : ''}`);
		if (nuevasDesdePerfil != null) console.log(`  notas nuevas desde el perfil: ${nuevasDesdePerfil}`);
		if (sinFormato) console.log(`  sin etiqueta de formato: ${sinFormato}`);
		if (desfasado) console.log('  → el perfil se ha quedado viejo: conviene reperfilar.');
	});
}

// ---------------------------------------------------------------- perfil
// Deja constancia de que VOZ.md se escribió, y con cuántas notas. Sin esto,
// `estado` no puede saber cuándo el perfil se ha quedado viejo.
else if (sub === 'perfil') {
	const version = String(args.version || 'v0.1');
	const total = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
	const ahora = new Date().toISOString();
	db.prepare('UPDATE profile SET voice_version = ?, voice_built_at = ?, voice_notes_count = ? WHERE handle = ?')
		.run(version, ahora, total, handle);
	salida({ handle, voice_version: version, voice_built_at: ahora, voice_notes_count: total }, () =>
		console.log(`Perfil de voz ${version} registrado para @${handle} sobre ${total} notas.`));
}

// ---------------------------------------------------------------- muestra
// Mezclada a propósito: alto, medio y bajo rendimiento, y cortas y largas.
// Aprender solo de los éxitos produce una caricatura del autor en su mejor día.
else if (sub === 'muestra') {
	const n = Number(args.n ?? 60);
	const all = todas();
	if (!all.length) { console.error('La base está vacía.'); process.exit(1); }
	const porReac = [...all].sort((a, b) => b.reaction_count - a.reaction_count);
	const t = Math.ceil(porReac.length / 3);
	const estratos = [porReac.slice(0, t), porReac.slice(t, 2 * t), porReac.slice(2 * t)];
	const cupo = Math.ceil(n / 3);
	const elegidas = new Map();
	for (const estrato of estratos) {
		// dentro de cada estrato, reparte por longitud: si no, solo salen las cortas
		const porLargo = [...estrato].sort((a, b) => a.chars - b.chars);
		const paso = Math.max(1, Math.floor(porLargo.length / cupo));
		for (let i = 0; i < porLargo.length && elegidas.size < n; i += paso) elegidas.set(porLargo[i].id, porLargo[i]);
	}
	const lista = [...elegidas.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
	salida({ handle, total: all.length, muestra: lista.length, notas: lista.map(limpia) }, () => {
		console.log(`# Muestra de ${lista.length} notas de @${handle} (de ${all.length} en la base)\n`);
		console.log('Mezcla deliberada de rendimiento alto/medio/bajo y de longitudes distintas.\n');
		for (const x of lista) console.log(linea(x) + '---');
	});
}

// ---------------------------------------------------------------- top
else if (sub === 'top') {
	const n = Number(args.n ?? 20);
	const col = { reacciones: 'reaction_count', restacks: 'restacks', respuestas: 'children_count' }[String(args.metrica || 'reacciones')] || 'reaction_count';
	const desde = args.desde ? String(args.desde) : '0000';
	const rows = db.prepare(`SELECT * FROM notes WHERE date >= ? ORDER BY ${col} DESC, date DESC LIMIT ?`).all(desde, n);
	salida({ handle, metrica: col, notas: rows.map(limpia) }, () => {
		console.log(`# Top ${rows.length} de @${handle} por ${col}${args.desde ? ` desde ${args.desde}` : ''}\n`);
		for (const x of rows) console.log(linea(x) + '---');
	});
}

// ---------------------------------------------------------------- buscar
else if (sub === 'buscar') {
	const q = args._.slice(1).join(' ').trim() || String(args.q || '');
	if (!q) { console.error('Uso: buscar "<texto>" --handle <handle>'); process.exit(1); }
	const n = Number(args.n ?? 10);
	const terminos = q.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
	const all = todas();
	const puntuadas = all.map((nota) => {
		const b = (nota.body || '').toLowerCase();
		return { nota, aciertos: terminos.filter((t) => b.includes(t)).length };
	}).filter((x) => x.aciertos > 0)
		.sort((a, b) => b.aciertos - a.aciertos || b.nota.reaction_count - a.nota.reaction_count)
		.slice(0, n);
	salida({ handle, consulta: q, encontradas: puntuadas.length, notas: puntuadas.map((x) => ({ aciertos: x.aciertos, ...limpia(x.nota) })) }, () => {
		if (!puntuadas.length) { console.log(`Nada parecido a «${q}» en las ${all.length} notas de @${handle}. Tema virgen.`); return; }
		console.log(`# ${puntuadas.length} notas tuyas tocan «${q}» (de ${all.length})\n`);
		for (const x of puntuadas) console.log(`${x.aciertos}/${terminos.length} términos · ` + linea(x.nota) + '---');
	});
}

// ---------------------------------------------------------------- stats
else if (sub === 'stats') {
	const all = todas();
	if (!all.length) { console.error('La base está vacía.'); process.exit(1); }
	const fechas = all.map((n) => Date.parse(n.date)).filter(Number.isFinite).sort((a, b) => a - b);
	const semanas = Math.max(1, (fechas.at(-1) - fechas[0]) / (7 * 86400000));
	const largos = all.map((n) => n.chars).sort((a, b) => a - b);
	const pct = (p) => largos[Math.min(largos.length - 1, Math.floor(largos.length * p))];
	const s = {
		handle, notas: all.length,
		desde: all.at(-1).date?.slice(0, 10), hasta: all[0].date?.slice(0, 10),
		por_semana: Number((all.length / semanas).toFixed(1)),
		mediana_reacciones: mediana(all.map((n) => n.reaction_count)),
		mediana_restacks: mediana(all.map((n) => n.restacks)),
		mediana_respuestas: mediana(all.map((n) => n.children_count)),
		mediana_caracteres: mediana(largos), mediana_palabras: mediana(all.map((n) => n.words)),
		caracteres_p10: pct(0.1), caracteres_p90: pct(0.9),
		mediana_lineas: mediana(all.map((n) => n.lines)),
		con_adjunto_pct: Math.round((all.filter((n) => n.attachments_count > 0).length / all.length) * 100),
		con_enlace_pct: Math.round((all.filter((n) => /https?:\/\//.test(n.body || '')).length / all.length) * 100),
		termina_en_pregunta_pct: Math.round((all.filter((n) => /\?\s*$/.test((n.body || '').trim())).length / all.length) * 100),
	};
	salida(s, () => {
		console.log(`# Tus números, @${handle} (${s.notas} notas, ${s.desde} → ${s.hasta})\n`);
		console.log(`cadencia    ${s.por_semana} notas por semana`);
		console.log(`reacciones  mediana ${s.mediana_reacciones} · restacks ${s.mediana_restacks} · respuestas ${s.mediana_respuestas}`);
		console.log(`longitud    mediana ${s.mediana_caracteres} caracteres (${s.mediana_palabras} palabras), p10 ${s.caracteres_p10} · p90 ${s.caracteres_p90}`);
		console.log(`forma       ${s.mediana_lineas} líneas de mediana · ${s.con_adjunto_pct}% con adjunto · ${s.con_enlace_pct}% con enlace · ${s.termina_en_pregunta_pct}% acaban preguntando`);
		console.log('\nSe compara contra tu propia mediana, no contra ningún benchmark del sector.');
		console.log('Impresiones y suscriptores por nota no están aquí: son privados del panel.');
	});
}

// ---------------------------------------------------------------- formatos
else if (sub === 'formatos') {
	const minMuestra = Number(args.min ?? 5);
	const all = todas();
	const sinEtiqueta = all.filter((n) => !n.format).length;
	const grupos = new Map();
	for (const n of all.filter((x) => x.format)) {
		if (!grupos.has(n.format)) grupos.set(n.format, []);
		grupos.get(n.format).push(n);
	}
	const ranking = [...grupos.entries()].map(([formato, notas]) => ({
		formato, n: notas.length,
		mediana_reacciones: mediana(notas.map((x) => x.reaction_count)),
		mediana_restacks: mediana(notas.map((x) => x.restacks)),
		mediana_caracteres: mediana(notas.map((x) => x.chars)),
		poca_muestra: notas.length < minMuestra,
		ejemplos: [...notas].sort((a, b) => b.reaction_count - a.reaction_count).slice(0, 2).map((x) => x.id),
	})).sort((a, b) => Number(a.poca_muestra) - Number(b.poca_muestra) || b.mediana_reacciones - a.mediana_reacciones);
	const medianaGlobal = mediana(all.map((n) => n.reaction_count));
	salida({ handle, mediana_global: medianaGlobal, sin_etiquetar: sinEtiqueta, ranking }, () => {
		console.log(`# Formatos de @${handle} · mediana global ${medianaGlobal} reacciones\n`);
		if (!ranking.length) { console.log(`Ninguna nota etiquetada todavía (${sinEtiqueta} pendientes). Usa: etiquetar pendientes`); return; }
		for (const f of ranking) {
			const marca = f.poca_muestra ? '   (poca muestra: no es un ganador)' : '';
			console.log(`${String(f.mediana_reacciones).padStart(5)} reac  ${f.formato.padEnd(22)} n=${String(f.n).padEnd(4)} ${f.mediana_caracteres} car · ej. #${f.ejemplos.join(', #')}${marca}`);
		}
		if (sinEtiqueta) console.log(`\n${sinEtiqueta} notas sin etiquetar: el ranking mejora si las clasificas.`);
	});
}

// ---------------------------------------------------------------- etiquetar
else if (sub === 'etiquetar') {
	const modo = args._[1] || 'pendientes';
	if (modo === 'pendientes') {
		const n = Number(args.n ?? 40);
		const rows = db.prepare('SELECT id, date, reaction_count, chars, body FROM notes WHERE format IS NULL ORDER BY reaction_count DESC LIMIT ?').all(n);
		salida({ pendientes: rows }, () => {
			console.log(`# ${rows.length} notas sin formato (de mayor a menor rendimiento)\n`);
			for (const r of rows) console.log(`#${r.id} · ${(r.date || '').slice(0, 10)} · ${r.reaction_count} reac\n${r.body}\n---`);
			console.log('\nClasifícalas contra references/formatos.md y guárdalas con:');
			console.log(`  etiquetar aplicar --archivo <json {"<id>": "<formato>"}> --handle ${handle}`);
		});
	} else if (modo === 'aplicar') {
		const datos = args.archivo
			? JSON.parse(readFileSync(String(args.archivo), 'utf8'))
			: JSON.parse(String(args.datos || '{}'));
		const ahora = new Date().toISOString();
		const st = db.prepare('UPDATE notes SET format = ?, format_tagged_at = ? WHERE id = ?');
		let n = 0;
		for (const [id, formato] of Object.entries(datos)) { st.run(String(formato), ahora, Number(id)); n++; }
		const faltan = db.prepare('SELECT COUNT(*) AS n FROM notes WHERE format IS NULL').get().n;
		salida({ etiquetadas: n, pendientes: faltan }, () => console.log(`${n} notas etiquetadas. Quedan ${faltan} sin formato.`));
	} else { console.error('etiquetar pendientes | etiquetar aplicar --archivo f.json'); process.exit(1); }
}

// ---------------------------------------------------------------- export
else if (sub === 'export') {
	const dir = String(args.md === true || !args.md ? join(dataDir(handle), 'notas-md') : args.md);
	mkdirSync(dir, { recursive: true });
	const all = todas();
	const porAnio = new Map();
	for (const n of all) {
		const a = (n.date || '0000').slice(0, 4);
		if (!porAnio.has(a)) porAnio.set(a, []);
		porAnio.get(a).push(n);
	}
	for (const [anio, notas] of porAnio) {
		const md = [`# Notas de @${handle} — ${anio}`, ''].concat(notas.map((n) =>
			`## ${(n.date || '').slice(0, 10)} · ${n.reaction_count} reac · ${n.restacks} restacks · ${n.children_count} resp${n.format ? ` · ${n.format}` : ''}\n\n${n.body}\n\n<${n.url}>\n`)).join('\n');
		writeFileSync(join(dir, `${anio}.md`), md, 'utf8');
	}
	salida({ carpeta: dir, anios: [...porAnio.keys()], notas: all.length }, () =>
		console.log(`${all.length} notas volcadas en ${dir} (${[...porAnio.keys()].join(', ')})`));
}

else { console.error(`Subcomando desconocido: ${sub}`); process.exit(1); }
