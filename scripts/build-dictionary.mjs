/**
 * Builds the English game dictionary from the kaikki.org English Wiktionary
 * extract. Place the download at scripts/kaikki.org-dictionary-English.jsonl
 * (about 3.1GB, gitignored). Streams one JSON object per line.
 * Rarity tiers come from scripts/count_1w.txt (Norvig web word counts, gitignored).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const MIN_LEN = 3;
const GLOSS_MAX = 140;
const DUMP_PATH = path.join(__dirname, "kaikki.org-dictionary-English.jsonl");
/** Peter Norvig's Google web unigram counts (word<TAB>count, most frequent first). */
const FREQ_PATH = path.join(__dirname, "count_1w.txt");

const BLOCKLIST = new Set(
  `
  ass asshole bastard bitch bollocks bollock cock crap damn dick dyke fag faggot
  fuck fucking goddamn hell homo nigger nigga piss pussy queer slut whore
  shit shitting shitty cunt tits twat wank wanker retard retarded
  rape raped raping rapee rapist nazi kill murder suicide suicidal
  porn porno pornographic sex sexy erotic penis vagina nude naked anal oral
  blowjob handjob cum jizz semen orgasm arsehole bugger chink gook kike spic
  wetback tranny molest molestation pedophile pedo
  `
    .trim()
    .split(/\s+/)
    .filter(Boolean),
);

const BAD_SENSE_TAGS = new Set(["obsolete", "archaic", "dated"]);
const SKIP_FORM_TAGS = new Set([
  "obsolete",
  "archaic",
  "alternative",
  "misspelling",
  "pronunciation-spelling",
]);
const FORM_OF =
  /^(form of|plural of|alternative spelling of|alternative form of|obsolete form of|archaic form of|abbreviation of|initialism of|acronym of)\b/i;
const TOPIC_LABEL = /^terms relating to\b/i;

/** Lower rank wins when the same spelling appears more than once. */
const POS_RANK = { noun: 0, verb: 1, adj: 2, adv: 3 };
const FORM_RANK_PENALTY = 10;

function isBlocked(word) {
  return BLOCKLIST.has(word.toLowerCase());
}

function acceptWord(word) {
  if (word.length < MIN_LEN) return false;
  if (!/^[a-z]+$/.test(word)) return false;
  if (isBlocked(word)) return false;
  return true;
}

/** Rank cut-offs in the web frequency list: common, uncommon, rare; anything ranked lower is epic. */
const TIER_RANKS = [20_000, 60_000, 150_000];

function loadFrequencyRanks() {
  if (!fs.existsSync(FREQ_PATH)) {
    console.error(
      `Missing ${FREQ_PATH}\nDownload https://norvig.com/ngrams/count_1w.txt into scripts/ (about 5MB).`,
    );
    process.exit(1);
  }
  const ranks = new Map();
  const lines = fs.readFileSync(FREQ_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const word = line.split("\t")[0]?.trim().toLowerCase();
    if (word && !ranks.has(word)) ranks.set(word, ranks.size + 1);
  }
  return ranks;
}

/** Unlisted words this short are the truly obscure ones; longer unlisted words are mostly compounds and inflections. */
const LEGENDARY_MAX_LEN = 6;

/** 0 common … 4 legendary. Words missing from the frequency list are epic, or legendary when short. */
function rarityIndex(word, ranks) {
  const rank = ranks.get(word);
  if (rank != null) {
    const tier = TIER_RANKS.findIndex((max) => rank <= max);
    return tier < 0 ? 3 : tier;
  }
  return word.length <= LEGENDARY_MAX_LEN ? 4 : 3;
}

function clipGloss(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= GLOSS_MAX) return clean;
  return `${clean.slice(0, GLOSS_MAX - 1).trimEnd()}…`;
}

function pickGloss(senses) {
  if (!Array.isArray(senses)) return null;
  for (const sense of senses) {
    const tags = Array.isArray(sense?.tags) ? sense.tags : [];
    if (tags.some((tag) => BAD_SENSE_TAGS.has(tag))) continue;
    const glosses = Array.isArray(sense?.glosses) ? sense.glosses : [];
    for (const gloss of glosses) {
      if (typeof gloss !== "string") continue;
      const text = gloss.replace(/\s+/g, " ").trim();
      if (!text || FORM_OF.test(text) || TOPIC_LABEL.test(text)) continue;
      return clipGloss(text);
    }
  }
  return null;
}

function consider(best, word, gloss, rank) {
  const prev = best.get(word);
  if (!prev || rank < prev.rank) best.set(word, { gloss, rank });
}

const CLUE_POS = new Set(["noun", "verb", "adj", "adv"]);
const REGISTER = new Set([
  "uncommon",
  "slang",
  "informal",
  "us",
  "uk",
  "british",
  "dialect",
  "humorous",
  "colloquial",
]);
const CLUE_CAP = 50000;

function linkWord(entry) {
  const raw =
    typeof entry === "string" ? entry : entry && typeof entry.word === "string" ? entry.word : "";
  const token = raw.toLowerCase().split(/[^a-z]+/).find((part) => part.length >= 3);
  if (!token || isBlocked(token)) return "";
  return token;
}

function firstLink(list) {
  if (!Array.isArray(list)) return "";
  for (const item of list) {
    const word = linkWord(item);
    if (word) return word;
  }
  return "";
}

function senseLinks(senses, key) {
  for (const sense of senses) {
    const word = firstLink(sense?.[key]);
    if (word) return word;
  }
  return "";
}

function secondGloss(senses, first) {
  if (!Array.isArray(senses)) return "";
  let skipped = false;
  for (const sense of senses) {
    const tags = Array.isArray(sense?.tags) ? sense.tags : [];
    if (tags.some((tag) => BAD_SENSE_TAGS.has(tag))) continue;
    const glosses = Array.isArray(sense?.glosses) ? sense.glosses : [];
    for (const gloss of glosses) {
      if (typeof gloss !== "string") continue;
      const text = gloss.replace(/\s+/g, " ").trim();
      if (!text || FORM_OF.test(text) || TOPIC_LABEL.test(text)) continue;
      const clipped = clipGloss(text);
      if (!skipped) {
        skipped = true;
        continue;
      }
      if (clipped !== first) return clipped;
    }
  }
  return "";
}

function blankExample(senses, word) {
  const re = new RegExp(`\\b${word}\\b`, "i");
  for (const sense of senses) {
    const examples = Array.isArray(sense?.examples) ? sense.examples : [];
    for (const example of examples) {
      const text =
        typeof example?.text === "string"
          ? example.text.replace(/\s+/g, " ").trim()
          : "";
      if (!text || !re.test(text)) continue;
      return clipGloss(text.replace(re, "_____"));
    }
  }
  return "";
}

function registerTag(senses) {
  for (const sense of senses) {
    const tags = Array.isArray(sense?.tags) ? sense.tags : [];
    for (const tag of tags) {
      const label = String(tag);
      if (REGISTER.has(label.toLowerCase())) return label;
    }
  }
  return "";
}

function usableForms(forms, lemma) {
  const out = [];
  if (!Array.isArray(forms)) return out;
  for (const form of forms) {
    const tags = Array.isArray(form?.tags) ? form.tags : [];
    const tag = tags.find((item) =>
      /plural|past|gerund|participle|comparative|superlative|third-person/i.test(
        String(item),
      ),
    );
    if (!tag) continue;
    const spelling = String(form?.form ?? "").trim().toLowerCase();
    if (spelling === lemma || spelling.includes(" ") || !acceptWord(spelling)) continue;
    out.push([spelling, String(tag)]);
    if (out.length >= 4) break;
  }
  return out;
}

function homophoneOf(sounds, word) {
  for (const sound of sounds) {
    const raw = sound?.homophone;
    const token = linkWord(typeof raw === "string" ? raw : raw);
    if (token && token !== word) return token;
  }
  return "";
}

function collectClue(clues, row, gloss) {
  const word = String(row.word ?? "").trim().toLowerCase();
  const pos = String(row.pos ?? "");
  if (!CLUE_POS.has(pos) || !acceptWord(word) || word.length > 12) return;
  const senses = Array.isArray(row.senses) ? row.senses : [];
  const sounds = Array.isArray(row.sounds) ? row.sounds : [];
  const alt = secondGloss(senses, gloss);
  const syn = firstLink(row.synonyms) || senseLinks(senses, "synonyms");
  const ant = firstLink(row.antonyms) || senseLinks(senses, "antonyms");
  const example = blankExample(senses, word);
  const etym = row.etymology_text ? clipGloss(String(row.etymology_text)) : "";
  const ipaRaw = sounds.find((sound) => typeof sound?.ipa === "string")?.ipa ?? "";
  const ipa = ipaRaw.length > 48 ? ipaRaw.slice(0, 48) : ipaRaw;
  const homo = homophoneOf(sounds, word);
  const tag = registerTag(senses);
  const hyper = firstLink(row.hypernyms);
  const hypo = firstLink(row.hyponyms);
  const kind = hyper ? `a kind of ${hyper}` : hypo ? `broader than ${hypo}` : "";
  const forms = usableForms(row.forms, word);
  let score = 0;
  if (syn && syn !== word) score += 2;
  if (ant && ant !== word) score += 2;
  if (example) score += 2;
  if (etym) score += 1;
  if (homo) score += 3;
  if (ipa) score += 1;
  if (alt) score += 2;
  if (forms.length) score += 2;
  if (tag) score += 2;
  if (kind) score += 3;
  if (score < 3) return;
  const packed = {};
  if (syn && syn !== word) packed.s = syn;
  if (ant && ant !== word) packed.a = ant;
  if (example) packed.x = example;
  if (etym) packed.y = etym;
  if (homo) packed.h = homo;
  if (ipa) packed.i = ipa;
  if (tag) packed.t = tag;
  if (kind) packed.k = kind;
  if (forms.length) packed.f = forms;
  clues.push({ score, row: [word, pos, gloss, alt, packed] });
  if (clues.length > CLUE_CAP * 2) {
    clues.sort((a, b) => b.score - a.score);
    clues.length = CLUE_CAP;
  }
}

if (!fs.existsSync(DUMP_PATH)) {
  console.error(
    `Missing ${DUMP_PATH}\nDownload the kaikki.org English JSONL (about 3.1GB) and save it at that path.`,
  );
  process.exit(1);
}
const ranks = loadFrequencyRanks();

const best = new Map();
const clues = [];
const rl = readline.createInterface({
  input: fs.createReadStream(DUMP_PATH, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let lines = 0;
let parsed = 0;
const started = Date.now();

for await (const line of rl) {
  lines += 1;
  if (lines % 200_000 === 0) {
    const sec = ((Date.now() - started) / 1000).toFixed(0);
    console.log(
      `… ${lines.toLocaleString()} lines, ${best.size.toLocaleString()} words, ${sec}s`,
    );
  }
  if (!line.includes('"lang_code": "en"') && !line.includes('"lang_code":"en"')) {
    continue;
  }
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (row.lang_code !== "en") continue;
  parsed += 1;
  const gloss = pickGloss(row.senses);
  if (!gloss) continue;
  const rank = POS_RANK[row.pos] ?? 8;
  const word = String(row.word ?? "").trim().toLowerCase();
  if (acceptWord(word)) {
    consider(best, word, gloss, rank);
    collectClue(clues, row, gloss);
  }

  const forms = Array.isArray(row.forms) ? row.forms : [];
  for (const form of forms) {
    const tags = Array.isArray(form?.tags) ? form.tags : [];
    if (tags.some((tag) => SKIP_FORM_TAGS.has(tag))) continue;
    const spelling = String(form?.form ?? "").trim().toLowerCase();
    if (spelling === word || !acceptWord(spelling)) continue;
    consider(best, spelling, gloss, rank + FORM_RANK_PENALTY);
  }
}

// A plural that is also an obscure acronym headword ("cats" / CAT Scheme)
// should show the lemma's gloss instead.
for (const [word, entry] of best) {
  if (entry.rank >= FORM_RANK_PENALTY) continue;
  const lemma = word.endsWith("es")
    ? word.slice(0, -2)
    : word.endsWith("s")
      ? word.slice(0, -1)
      : "";
  if (lemma.length < MIN_LEN) continue;
  const base = best.get(lemma);
  if (!base || base.rank >= FORM_RANK_PENALTY) continue;
  const acronym = lemma.toUpperCase();
  if (acronym === lemma || !entry.gloss.includes(acronym)) continue;
  best.set(word, { gloss: base.gloss, rank: base.rank + FORM_RANK_PENALTY });
}

const words = [...best.keys()].sort();
const publicDir = path.join(root, "public", "dictionary");
fs.mkdirSync(publicDir, { recursive: true });
const gzPath = path.join(publicDir, "english-words.json.gz");
const plainPath = path.join(publicDir, "english-words.json");
const gzip = zlib.createGzip({ level: 9 });
const out = fs.createWriteStream(gzPath);
const finished = new Promise((resolve, reject) => {
  out.on("finish", resolve);
  out.on("error", reject);
  gzip.on("error", reject);
});
gzip.pipe(out);
gzip.write("[");
const tierNames = ["common", "uncommon", "rare", "epic", "legendary"];
const tierCounts = [0, 0, 0, 0, 0];
for (let i = 0; i < words.length; i += 1) {
  const word = words[i];
  const tier = rarityIndex(word, ranks);
  tierCounts[tier] += 1;
  if (i > 0) gzip.write(",");
  gzip.write(JSON.stringify([word, best.get(word).gloss, tier]));
}
console.log(
  "Rarity tiers:",
  tierNames
    .map((name, i) => `${name} ${tierCounts[i].toLocaleString()} (${((tierCounts[i] / words.length) * 100).toFixed(1)}%)`)
    .join(", "),
);
gzip.write("]");
gzip.end();
await finished;
fs.rmSync(plainPath, { force: true });

clues.sort((a, b) => b.score - a.score);
const clueRows = clues.slice(0, CLUE_CAP).map((item) => item.row);
const cluePath = path.join(publicDir, "english-clues.json.gz");
const clueGzip = zlib.createGzip({ level: 9 });
const clueOut = fs.createWriteStream(cluePath);
const clueDone = new Promise((resolve, reject) => {
  clueOut.on("finish", resolve);
  clueOut.on("error", reject);
  clueGzip.on("error", reject);
});
clueGzip.pipe(clueOut);
clueGzip.write(JSON.stringify(clueRows));
clueGzip.end();
await clueDone;
const clueBytes = fs.statSync(cluePath).size;
console.log(
  `Wrote ${clueRows.length.toLocaleString()} clue faces to public/dictionary/english-clues.json.gz (${clueBytes.toLocaleString()} bytes)`,
);

const sec = ((Date.now() - started) / 1000).toFixed(1);
const gzBytes = fs.statSync(gzPath).size;
console.log(
  `Wrote ${words.length.toLocaleString()} words to public/dictionary/english-words.json.gz (${gzBytes.toLocaleString()} bytes)`,
);
console.log(
  `Scanned ${lines.toLocaleString()} lines (${parsed.toLocaleString()} English) in ${sec}s`,
);
