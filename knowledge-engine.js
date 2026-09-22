(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KnowledgeEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = new Set(['person', 'project', 'experience', 'concept', 'decision', 'pitfall', 'evidence', 'question']);
  const DOMAINS = new Set(['backend', 'runtime', 'ai', 'game', 'career']);
  const LEVELS = new Set(['upstream', 'resume', 'personal-note', 'study', 'new-build']);
  const SOURCE_LEVELS = new Set(['upstream', 'resume', 'new-build', 'personal-note']);
  const WORK_TYPES = new Set(['project', 'experience', 'evidence']);
  const RESERVED = new Set(['__proto__', 'prototype', 'constructor']);
  const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
  const MAX_STATE_BYTES = 1024 * 1024;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validId = value => typeof value === 'string' && ID.test(value) && !RESERVED.has(value);
  const text = (value, limit = 8000, allowEmpty = false) => typeof value === 'string' && value.length <= limit && (allowEmpty || value.trim().length > 0);
  const unique = items => [...new Set(items)];
  const lower = value => String(value).normalize('NFKC').toLocaleLowerCase('en-US');
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const issue = (errors, path, code, message) => errors.push({path, code, message});
  const sortedEdges = edges => [...edges].sort((a, b) => compare(`${a.source}\0${a.target}\0${a.kind}\0${a.id || ''}`, `${b.source}\0${b.target}\0${b.kind}\0${b.id || ''}`));

  function validateGraph(data) {
    const errors = [], warnings = [];
    if (!record(data)) return {ok: false, errors: [{path: '$', code: 'graph.object', message: 'Graph must be an object.'}], warnings};
    if (![1, 2].includes(data.schemaVersion)) issue(errors, 'schemaVersion', 'graph.version', 'Graph schemaVersion must be 1 or 2.');
    for (const [key, maximum] of [['nodes', 1000], ['edges', 5000], ['paths', 100]]) {
      if (!Array.isArray(data[key]) || data[key].length > maximum) issue(errors, key, 'graph.array', `${key} must be an array with at most ${maximum} entries.`);
    }
    if (errors.length) return {ok: false, errors, warnings};
    const ids = new Set();
    for (const [index, node] of data.nodes.entries()) {
      const at = `nodes[${index}]`;
      if (!record(node)) { issue(errors, at, 'node.object', 'Node must be an object.'); continue; }
      if (!validId(node.id) || ids.has(node.id)) issue(errors, `${at}.id`, 'node.id', 'Node IDs must be unique safe identifiers.');
      else ids.add(node.id);
      if (!text(node.label, 200)) issue(errors, `${at}.label`, 'node.label', 'A label of at most 200 characters is required.');
      if (!TYPES.has(node.type)) issue(errors, `${at}.type`, 'node.type', 'Unknown node type.');
      if (!DOMAINS.has(node.domain)) issue(errors, `${at}.domain`, 'node.domain', 'Unknown domain.');
      if (!LEVELS.has(node.evidenceLevel)) issue(errors, `${at}.evidenceLevel`, 'node.evidence', 'Unknown evidence level.');
      if (!text(node.summary, 4000, true)) issue(errors, `${at}.summary`, 'node.summary', 'Summary must be a string of at most 4000 characters.');
      for (const [field, maxItems, maxLength] of [['details', 30, 8000], ['tags', 80, 100]]) {
        if (!Array.isArray(node[field]) || node[field].length > maxItems || node[field].some(value => !text(value, maxLength))) {
          issue(errors, `${at}.${field}`, 'node.strings', `${field} must contain bounded nonempty strings.`);
        }
      }
      if (!Array.isArray(node.sources) || node.sources.length > 30) issue(errors, `${at}.sources`, 'node.sources', 'sources must contain at most 30 entries.');
      else for (const [s, source] of node.sources.entries()) {
        const sourceAt = `${at}.sources[${s}]`;
        if (!record(source) || !text(source.label, 300)) { issue(errors, sourceAt, 'source.object', 'Source needs a label.'); continue; }
        if (!text(source.url, 2048) && !text(source.reference, 1000)) issue(errors, sourceAt, 'source.reference', 'Source needs a URL or reference.');
        if (source.url !== undefined) {
          if (!text(source.url, 2048) || !/^https?:\/\/[^\s]+$/i.test(source.url)) issue(errors, `${sourceAt}.url`, 'source.url', 'Source URL must use HTTP or HTTPS without whitespace.');
          else {
            try { const parsed = new URL(source.url); if (!parsed.hostname || parsed.username || parsed.password) throw new Error(); }
            catch { issue(errors, `${sourceAt}.url`, 'source.url', 'Source URL is malformed or contains credentials.'); }
          }
        }
        if (source.reference !== undefined && !text(source.reference, 1000)) issue(errors, `${sourceAt}.reference`, 'source.reference', 'Source reference must be bounded text.');
      }
      if (node.interview !== undefined) {
        const interview = node.interview;
        if (!record(interview) || !text(interview.prompt, 2000) || !text(interview.answer, 12000) || !Array.isArray(interview.followups) || interview.followups.length > 20 || interview.followups.some(value => !text(value, 2000))) {
          issue(errors, `${at}.interview`, 'node.interview', 'Interview needs bounded prompt, answer and followups.');
        }
      }
    }
    const edgeIds = new Set();
    for (const [index, edge] of data.edges.entries()) {
      const at = `edges[${index}]`;
      if (!record(edge)) { issue(errors, at, 'edge.object', 'Edge must be an object.'); continue; }
      if (!ids.has(edge.source) || !ids.has(edge.target)) issue(errors, at, 'edge.reference', 'Both edge endpoints must name existing nodes.');
      if (!text(edge.label, 200) || !text(edge.kind, 80)) issue(errors, at, 'edge.label', 'Edge needs bounded label and kind.');
      if (edge.id !== undefined) {
        if (!validId(edge.id) || edgeIds.has(edge.id)) issue(errors, `${at}.id`, 'edge.id', 'Optional edge IDs must be unique safe identifiers.');
        else edgeIds.add(edge.id);
      }
    }
    const pathIds = new Set();
    for (const [index, path] of data.paths.entries()) {
      const at = `paths[${index}]`;
      if (!record(path)) { issue(errors, at, 'path.object', 'Path must be an object.'); continue; }
      if (!validId(path.id) || pathIds.has(path.id)) issue(errors, `${at}.id`, 'path.id', 'Path IDs must be unique safe identifiers.');
      else pathIds.add(path.id);
      if (!text(path.title, 200) || !text(path.description, 2000, true)) issue(errors, at, 'path.text', 'Path needs bounded title and description.');
      if (!Array.isArray(path.nodeIds) || !path.nodeIds.length || path.nodeIds.length > 100 || path.nodeIds.some(id => !ids.has(id))) issue(errors, `${at}.nodeIds`, 'path.reference', 'Path must reference 1–100 existing nodes.');
    }
    return {ok: errors.length === 0, errors, warnings};
  }

  // Aliases describe explicit text mentions, not semantic equivalence or skill proficiency.
  const FIXED_TERMS = [
    ['Java', ['Java']], ['JavaScript', ['JavaScript', 'ECMAScript']], ['TypeScript', ['TypeScript']],
    ['Python', ['Python', 'Python语言']], ['C++', ['C++', 'C++11', 'C++14', 'C++17', 'C++20', 'CPP']],
    ['C', ['C', 'C11', 'C17', 'C语言', 'C language', 'C programming']], ['Go', ['Go', 'Golang', 'Go语言', 'Go language']],
    ['SQL', ['SQL', '结构化查询语言']], ['Spring Boot', ['Spring Boot', 'SpringBoot']], ['Spring', ['Spring']],
    ['Kafka', ['Kafka', 'Apache Kafka']], ['Kubernetes', ['Kubernetes', 'K8s', '容器编排']],
    ['AWS', ['AWS', 'Amazon Web Services', '亚马逊云']], ['Redis', ['Redis']],
    ['PostgreSQL', ['PostgreSQL', 'Postgres']], ['RAG', ['RAG', 'retrieval augmented generation', 'retrieval-augmented generation', '检索增强生成']],
    ['MCP', ['MCP', 'Model Context Protocol', '模型上下文协议']], ['OAuth', ['OAuth', 'OAuth2', 'OAuth 2.0', '开放授权']],
    ['Godot', ['Godot']], ['Multithreading', ['multithreading', 'multi-threading', 'multithreaded', '多线程']],
    ['Concurrency', ['concurrency', 'concurrent programming', '并发编程', '并发']],
    ['CI/CD', ['CI/CD', 'continuous integration', 'continuous delivery', '持续集成', '持续交付']],
    ['Docker', ['Docker']], ['React', ['React', 'React.js']], ['FastAPI', ['FastAPI']],
    ['Flask', ['Flask']], ['GDScript', ['GDScript']], ['Idempotency', ['idempotency', 'idempotent', '幂等性', '幂等']],
    ['Distributed systems', ['distributed systems', 'distributed system', '分布式系统']],
    ['Testing', ['unit tests', 'unit testing', 'integration tests', 'integration testing', '单元测试', '集成测试']],
    ['Git', ['Git']], ['Linux', ['Linux']], ['REST', ['REST', 'RESTful']], ['gRPC', ['gRPC']],
    ['GraphQL', ['GraphQL']], ['MongoDB', ['MongoDB']], ['MySQL', ['MySQL']],
    ['PyTorch', ['PyTorch']], ['TensorFlow', ['TensorFlow']], ['YOLOv5', ['YOLOv5']], ['PgVector', ['PgVector', 'pgvector']],
    ['MessagePack', ['MessagePack']], ['KCP', ['KCP']], ['MultiMesh', ['MultiMesh']], ['JSON', ['JSON']],
    ['Serialization', ['serialization', '序列化']], ['Cache-aside', ['cache-aside', 'cache aside']],
    ['Database transactions', ['database transactions', 'transactional writes', '数据库事务']],
    ['Query optimization', ['query optimization', 'query plans', '查询优化', '查询计划']]
  ];
  const GENERIC_TAGS = new Set(['backend', 'runtime', 'ai', 'ai tooling', 'game', 'game systems', 'career', 'developer tools', 'open source', 'personal project', 'study', 'question', 'gsoc']);
  function dictionary(data, fixedOnly = false) {
    const terms = FIXED_TERMS.map(([term, aliases]) => ({term, aliases}));
    if (fixedOnly) return terms;
    const known = new Set(terms.flatMap(item => item.aliases.map(lower)));
    for (const tag of data.nodes.flatMap(node => node.tags).sort(compare)) {
      if (tag.length < 2 || tag.length > 60 || known.has(lower(tag)) || GENERIC_TAGS.has(lower(tag))) continue;
      known.add(lower(tag)); terms.push({term: tag, aliases: [tag]});
    }
    return terms;
  }
  function occurrences(value, alias) {
    const normalized = String(value).normalize('NFKC');
    const haystack = lower(normalized), needle = lower(alias), found = [];
    const latin = /[a-z0-9]/i.test(needle[0]);
    let start = 0;
    while (start <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, start);
      if (at < 0) break;
      const end = at + needle.length;
      const before = haystack[at - 1] || '', after = haystack[end] || '';
      const bounded = !latin || (!/[a-z0-9_+#]/i.test(before) && !/[a-z0-9_+#]/i.test(after));
      const shortCase = (!['C', 'Go'].includes(alias) || normalized.slice(at, end) === alias) && !(alias === 'C' && before === '.');
      const ordinaryGo = alias === 'Go' && /^\s+(?:to|through|over|beyond|ahead|back|home|for)\b/i.test(normalized.slice(end));
      if (bounded && shortCase && !ordinaryGo) found.push({start: at, end, phrase: normalized.slice(at, end)});
      start = Math.max(end, at + 1);
    }
    return found;
  }
  const hasTerm = (value, item) => item.aliases.some(alias => occurrences(value, alias).length);
  function fields(node) {
    return [{name: 'label', text: node.label, weight: 8}, {name: 'tags', text: node.tags.join(' · '), weight: 6},
      {name: 'summary', text: node.summary, weight: 3}, ...node.details.map((value, index) => ({name: `details[${index}]`, text: value, weight: 1})),
      ...(node.interview ? [{name: 'interview.prompt', text: node.interview.prompt, weight: 2}, {name: 'interview.answer', text: node.interview.answer, weight: 1}] : [])];
  }
  function snippet(value, terms) {
    const normalized = lower(value);
    let index = -1;
    for (const term of terms) { const found = normalized.indexOf(lower(term)); if (found >= 0 && (index < 0 || found < index)) index = found; }
    const start = Math.max(0, index - 50);
    return (start ? '…' : '') + value.slice(start, start + 240) + (start + 240 < value.length ? '…' : '');
  }
  function searchNodes(data, query, options = {}) {
    if (!validateGraph(data).ok || typeof query !== 'string' || !record(options)) return [];
    const requested = unique(query.trim().slice(0, 500).split(/\s+/u).filter(Boolean));
    const terms = dictionary(data);
    const queries = requested.map(word => ({word, variants: unique([word, ...terms.filter(term => hasTerm(word, term)).flatMap(term => term.aliases)])}));
    const results = [];
    for (const node of data.nodes) {
      if (options.type && options.type !== 'all' && node.type !== options.type) continue;
      if (options.domain && options.domain !== 'all' && node.domain !== options.domain) continue;
      const matched = new Set(), matchedFields = [], snippets = [];
      let rank = 0;
      for (const field of fields(node)) {
        const hits = queries.filter(q => q.variants.some(alias => occurrences(field.text, alias).length));
        if (!hits.length) continue;
        hits.forEach(hit => matched.add(hit.word));
        matchedFields.push(field.name); rank += field.weight * hits.length;
        snippets.push({field: field.name, text: snippet(field.text, hits.flatMap(hit => hit.variants)), terms: hits.map(hit => hit.word)});
      }
      if (queries.length && matched.size !== queries.length) continue;
      results.push({nodeId: node.id, node, rank, matchedTerms: [...matched], matchedFields,
        snippets: snippets.slice(0, 3), basis: {evidenceLevel: node.evidenceLevel, sources: node.sources}});
    }
    return results.sort((a, b) => b.rank - a.rank || compare(a.nodeId, b.nodeId));
  }

  function adjacency(data, direction) {
    const links = new Map(data.nodes.map(node => [node.id, []]));
    for (const edge of sortedEdges(data.edges)) {
      if (direction !== 'in') links.get(edge.source).push({id: edge.target, edge});
      if (direction !== 'out') links.get(edge.target).push({id: edge.source, edge});
    }
    return links;
  }
  function neighbors(data, id, options = {}) {
    const empty = {nodeIds: [], edges: []};
    if (!validateGraph(data).ok || !record(options)) return empty;
    const depth = options.depth === undefined ? 1 : options.depth;
    const direction = options.direction || 'both';
    if (!Number.isInteger(depth) || depth < 0 || depth > 6 || !['both', 'out', 'in'].includes(direction)) return empty;
    const links = adjacency(data, direction);
    if (!links.has(id)) return empty;
    const distance = new Map([[id, 0]]), queue = [id];
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (distance.get(current) >= depth) continue;
      for (const next of links.get(current)) if (!distance.has(next.id)) { distance.set(next.id, distance.get(current) + 1); queue.push(next.id); }
    }
    const nodeIds = [...distance.keys()];
    return {nodeIds, edges: sortedEdges(data.edges.filter(edge => distance.has(edge.source) && distance.has(edge.target)))};
  }
  function findPath(data, from, to, options = {}) {
    const direction = record(options) ? options.direction || 'both' : 'both';
    const empty = {found: false, nodeIds: [], edges: [], direction};
    if (!record(options) || !['both', 'out', 'in'].includes(direction) || !validateGraph(data).ok) return empty;
    const links = adjacency(data, direction);
    if (!links.has(from) || !links.has(to)) return empty;
    const previous = new Map([[from, null]]), queue = [from];
    for (let head = 0; head < queue.length && !previous.has(to); head++) {
      for (const next of links.get(queue[head])) if (!previous.has(next.id)) { previous.set(next.id, {id: queue[head], edge: next.edge}); queue.push(next.id); }
    }
    if (!previous.has(to)) return empty;
    const nodeIds = [], edges = [];
    for (let current = to; current !== null;) {
      nodeIds.push(current); const step = previous.get(current);
      if (step) { edges.push(step.edge); current = step.id; } else current = null;
    }
    return {found: true, nodeIds: nodeIds.reverse(), edges: edges.reverse(), direction};
  }

  function mentionContext(jobText, occurrence) {
    const before = jobText.slice(Math.max(0, occurrence.start - 45), occurrence.start);
    const after = jobText.slice(occurrence.end, occurrence.end + 45);
    const excluded = /(?:\b(?:no|without)\s+(?:prior\s+)?|\bnot\s+(?:(?:using|requiring)\s+)?|无需|不要求|不需要)\s*$/i.test(before) || /^\s*(?:experience\s+)?(?:is\s+)?(?:not required|not necessary|不是必需|非必需|不要求)/i.test(after);
    const priority = /(?:preferred|nice to have|bonus|加分|优先)/i.test(before + after) ? 'preferred' : /(?:required|must|require|必须|要求)/i.test(before + after) ? 'required' : 'mentioned';
    return {excluded, priority, text: snippet(jobText.slice(Math.max(0, occurrence.start - 70), Math.min(jobText.length, occurrence.end + 110)), [occurrence.phrase])};
  }
  function evidencePaths(data, node) {
    const paths = [];
    // Only directly connected evidence is presented as corroboration. Unrelated
    // graph reachability never creates evidence for a technical requirement.
    const edges = sortedEdges(data.edges.filter(edge => edge.kind === 'supports' && (edge.source === node.id || edge.target === node.id)));
    for (const edge of edges) {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const other = data.nodes.find(item => item.id === otherId);
      if (other.type === 'evidence' && other.sources.length && SOURCE_LEVELS.has(other.evidenceLevel)) paths.push({nodeIds: [node.id, other.id], edges: [edge]});
    }
    return paths.length ? paths : [{nodeIds: [node.id], edges: []}];
  }
  function matchJob(data, jobText) {
    const output = {matchedTerms: [], supported: [], studyOnly: [], unmatchedKnown: [], recommendedNodeIds: [], ranking: [], mentions: [], excludedMentions: [],
      limitations: ['Explicit known technical phrases only; no semantic AI score or qualification percentage.', 'Degree, seniority, dates, work authorization, and overall job eligibility are not assessed.', 'Support means a lexical match on a source-tagged work or evidence node, not independent verification of proficiency.'], errors: []};
    const validation = validateGraph(data);
    if (!validation.ok) { output.errors = validation.errors; return output; }
    if (typeof jobText !== 'string' || jobText.length > 50000) { output.errors.push({path: 'jobText', code: 'job.text', message: 'Job text must be a string of at most 50000 characters.'}); return output; }
    jobText = jobText.normalize('NFKC');
    const terms = dictionary(data, true), rank = new Map();
    const allLocations = terms.flatMap(item => item.aliases.flatMap(alias => occurrences(jobText, alias).map(location => ({...location, term: item.term}))));
    for (const item of terms) {
      const locations = allLocations.filter(location => location.term === item.term && !allLocations.some(other => other.term !== item.term && other.start <= location.start && other.end >= location.end && other.end - other.start > location.end - location.start));
      if (!locations.length) continue;
      const contexts = locations.map(location => ({...location, ...mentionContext(jobText, location)}));
      const accepted = contexts.filter(context => !context.excluded);
      if (!accepted.length) { output.excludedMentions.push({term: item.term, reason: 'Explicitly stated as unnecessary or absent.', contexts: unique(contexts.map(context => context.text))}); continue; }
      output.matchedTerms.push(item.term);
      output.mentions.push({term: item.term, priority: accepted.some(context => context.priority === 'required') ? 'required' : accepted.some(context => context.priority === 'preferred') ? 'preferred' : 'mentioned', snippets: unique(accepted.map(context => context.text)).slice(0, 3)});
      const matching = data.nodes.filter(node => fields(node).some(field => hasTerm(field.text, item)));
      const sourceBacked = matching.filter(node => WORK_TYPES.has(node.type) && SOURCE_LEVELS.has(node.evidenceLevel) && node.sources.length && [node.label, node.summary, node.tags.join(' ')].some(value => hasTerm(value, item)));
      const study = matching.filter(node => !sourceBacked.includes(node));
      const entry = nodes => ({term: item.term, nodeIds: nodes.map(node => node.id), paths: nodes.flatMap(node => evidencePaths(data, node)),
        snippets: nodes.slice(0, 8).map(node => ({nodeId: node.id, text: snippet(fields(node).find(field => hasTerm(field.text, item)).text, item.aliases)})),
        basis: nodes.map(node => ({nodeId: node.id, type: node.type, evidenceLevel: node.evidenceLevel, sources: node.sources}))});
      if (sourceBacked.length) output.supported.push(entry(sourceBacked));
      else if (study.length) output.studyOnly.push(entry(study));
      else output.unmatchedKnown.push(item.term);
      for (const node of sourceBacked.length ? sourceBacked : study) {
        const existing = rank.get(node.id) || {nodeId: node.id, points: 0, reasons: []};
        const points = sourceBacked.includes(node) ? 3 : 1;
        existing.points += points; existing.reasons.push(`${points} point${points > 1 ? 's' : ''}: ${item.term} · ${points === 3 ? 'source-tagged work/evidence' : 'study or contextual mention'}`); rank.set(node.id, existing);
      }
    }
    output.ranking = [...rank.values()].sort((a, b) => b.points - a.points || compare(a.nodeId, b.nodeId));
    output.recommendedNodeIds = output.ranking.map(item => item.nodeId);
    return output;
  }

  function iso(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    const normalized = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, digits) => '.' + (digits || '').padEnd(3, '0') + 'Z');
    return date.toISOString() === normalized ? normalized : null;
  }
  function reviewErrors(review, path, errors) {
    if (!record(review)) { issue(errors, path, 'review.object', 'Review must be an object.'); return; }
    const allowed = ['rating', 'repetitions', 'intervalDays', 'dueDate', 'lastReviewedAt'];
    if (Object.keys(review).some(key => !allowed.includes(key)) || allowed.some(key => !own(review, key))) issue(errors, path, 'review.fields', 'Review has missing or unknown fields.');
    if (!['again', 'hard', 'good'].includes(review.rating)) issue(errors, `${path}.rating`, 'review.rating', 'Unknown self-rating.');
    if (!Number.isInteger(review.repetitions) || review.repetitions < 0 || review.repetitions > 10000) issue(errors, `${path}.repetitions`, 'review.repetitions', 'Repetitions must be an integer from 0 to 10000.');
    if (!Number.isInteger(review.intervalDays) || review.intervalDays < 1 || review.intervalDays > 365) issue(errors, `${path}.intervalDays`, 'review.interval', 'Interval must be 1–365 days.');
    if (!iso(review.dueDate) || !iso(review.lastReviewedAt)) issue(errors, path, 'review.date', 'Review dates must be valid UTC ISO timestamps.');
    else if (new Date(review.dueDate) - new Date(review.lastReviewedAt) !== review.intervalDays * 86400000) issue(errors, path, 'review.schedule', 'Due date must agree with the interval and last review.');
  }
  function scheduleReview(previous, rating, nowISO) {
    if (!['again', 'hard', 'good'].includes(rating)) throw new TypeError('rating must be again, hard, or good');
    const now = iso(nowISO);
    if (!now) throw new TypeError('nowISO must be a valid UTC ISO timestamp');
    if (previous !== null && previous !== undefined) {
      const errors = []; reviewErrors(previous, 'previous', errors);
      if (errors.length) throw new TypeError(errors[0].message);
    }
    const repetitions = rating === 'again' ? 0 : Math.min(10000, (previous?.repetitions || 0) + (rating === 'good' ? 1 : 0));
    const intervalDays = rating === 'again' ? 1 : rating === 'hard' ? Math.min(365, Math.max(1, Math.ceil((previous?.intervalDays || 1) * 1.2))) : repetitions === 1 ? 3 : repetitions === 2 ? 7 : Math.min(365, (previous?.intervalDays || 3) * 2);
    const dueDate = new Date(new Date(now).getTime() + intervalDays * 86400000).toISOString();
    if (!iso(dueDate)) throw new RangeError('Scheduled date exceeds the supported four-digit year range');
    return {rating, repetitions, intervalDays, dueDate, lastReviewedAt: now};
  }
  function validateStudyState(state, data) {
    const errors = [];
    const invalid = () => ({ok: false, errors, value: null});
    if (!record(state)) { issue(errors, '$', 'state.object', 'Study state must be an object.'); return invalid(); }
    const keys = ['schemaVersion', 'ratings', 'dueDates', 'notes'];
    if (state.schemaVersion !== 1 || Object.keys(state).some(key => !keys.includes(key)) || keys.some(key => !own(state, key))) issue(errors, '$', 'state.fields', 'Study state must have schemaVersion 1 and ratings, dueDates, notes only.');
    const graphResult = data === undefined ? null : validateGraph(data);
    const known = graphResult?.ok ? new Set(data.nodes.map(node => node.id)) : null;
    if (graphResult && !graphResult.ok) issue(errors, '$', 'state.graph', 'A supplied graph must be valid.');
    for (const field of ['ratings', 'dueDates', 'notes']) {
      if (!record(state[field]) || Object.keys(state[field]).length > 1000) { issue(errors, field, 'state.map', `${field} must be an object with at most 1000 entries.`); continue; }
      for (const [id, value] of Object.entries(state[field])) {
        if (!validId(id) || (known && !known.has(id))) issue(errors, `${field}.${id}`, 'state.id', 'Study entry must reference a safe, known node ID.');
        if (field === 'ratings') reviewErrors(value, `${field}.${id}`, errors);
        else if (field === 'dueDates' && !iso(value)) issue(errors, `${field}.${id}`, 'state.date', 'Due dates must be valid UTC ISO timestamps.');
        else if (field === 'notes' && !text(value, 8000, true)) issue(errors, `${field}.${id}`, 'state.note', 'Notes must be plain strings of at most 8000 characters.');
      }
    }
    if (record(state.ratings) && record(state.dueDates)) {
      for (const [id, review] of Object.entries(state.ratings)) if (!own(state.dueDates, id) || !record(review) || iso(review.dueDate) !== iso(state.dueDates[id])) issue(errors, `dueDates.${id}`, 'state.schedule', 'Each rating needs the same date in dueDates.');
    }
    let serialized;
    try { serialized = JSON.stringify(state); if (new TextEncoder().encode(serialized).length > MAX_STATE_BYTES) issue(errors, '$', 'state.size', 'Study state exceeds 1 MiB.'); }
    catch { issue(errors, '$', 'state.json', 'Study state must be serializable JSON.'); }
    if (errors.length) return invalid();
    return {ok: true, errors, value: JSON.parse(serialized)};
  }
  function exportStudyState(state, data) {
    const result = validateStudyState(state, data);
    if (!result.ok) throw new TypeError(result.errors[0].message);
    return JSON.stringify(result.value, null, 2) + '\n';
  }
  function importStudyState(raw, data) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_STATE_BYTES) return {ok: false, errors: [{path: '$', code: 'state.size', message: 'Import must be JSON text no larger than 1 MiB.'}], value: null};
    try { return validateStudyState(JSON.parse(raw), data); }
    catch { return {ok: false, errors: [{path: '$', code: 'state.json', message: 'Import is not valid study-state JSON.'}], value: null}; }
  }

  return Object.freeze({validateGraph, searchNodes, neighbors, findPath, matchJob, scheduleReview, validateStudyState, exportStudyState, importStudyState});
});
