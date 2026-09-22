'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../knowledge-engine.js');

const source = {label: 'Public contribution', url: 'https://example.org/change/17'};
function node(id, type, tags, evidenceLevel = 'study', extra = {}) {
  return {id, label: id, type, domain: 'backend', summary: `Notes about ${tags.join(', ')}.`, details: [], tags, evidenceLevel, sources: [], ...extra};
}
function graph() {
  return {schemaVersion: 2, nodes: [
    node('job-java', 'experience', ['Java', 'OAuth'], 'resume', {label: 'Integration service', sources: [{label: 'Resume', reference: 'Integration role'}]}),
    node('java-proof', 'evidence', ['Java'], 'upstream', {sources: [source]}),
    node('python-build', 'project', ['Python'], 'new-build', {label: 'Python planner', sources: [source]}),
    node('cpp-build', 'project', ['C++17'], 'new-build', {sources: [source]}),
    node('js-build', 'project', ['JavaScript'], 'upstream', {sources: [source]}),
    node('postgres-study', 'concept', ['PostgreSQL']),
    node('thread-study', 'concept', ['Multithreading'], 'study', {summary: 'Thread lifecycle and synchronization. 多线程与同步。'}),
    node('java-question', 'question', ['Java'], 'study', {interview: {prompt: 'Explain Java collections.', answer: 'Choose according to access patterns.', followups: ['Which tradeoff matters?']}}),
    node('retry-pitfall', 'pitfall', ['Idempotency'], 'personal-note', {sources: [{label: 'Personal note', reference: 'Retry investigation'}]})
  ], edges: [
    {id: 'proof-job', source: 'java-proof', target: 'job-java', kind: 'supports', label: 'supports'},
    {id: 'job-question', source: 'job-java', target: 'java-question', kind: 'prompts', label: 'practice'},
    {id: 'job-study', source: 'job-java', target: 'postgres-study', kind: 'related', label: 'next study topic'},
    {id: 'question-study', source: 'java-question', target: 'postgres-study', kind: 'related', label: 'related'}
  ], paths: [{id: 'java-path', title: 'Explore a contribution', description: 'Read the evidence then the work.', nodeIds: ['java-proof', 'job-java', 'java-question']}]};
}
function state() { return {schemaVersion: 1, ratings: {}, dueDates: {}, notes: {}}; }
const now = '2026-09-22T12:00:00.000Z';

test('module loads as a browser global without CommonJS or side effects', () => {
  const context = vm.createContext({URL, TextEncoder});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'knowledge-engine.js'), 'utf8'), context);
  assert.equal(typeof context.KnowledgeEngine.matchJob, 'function');
  assert.equal(context.KnowledgeEngine.validateGraph(graph()).ok, true);
  assert.equal(context.document, undefined);
});
test('valid graph includes reference-only sources and version 2', () => assert.equal(E.validateGraph(graph()).ok, true));
test('malformed graph shapes return errors instead of throwing', () => {
  for (const data of [null, [], {}, {schemaVersion: 2, nodes: {}, edges: [], paths: []}]) {
    assert.equal(E.validateGraph(data).ok, false);
    assert.deepEqual(E.searchNodes(data, 'Java'), []);
    assert.deepEqual(E.neighbors(data, 'x'), {nodeIds: [], edges: []});
    assert.equal(E.findPath(data, 'a', 'b').found, false);
    assert.ok(E.matchJob(data, 'Java').errors.length);
  }
});
test('duplicate IDs, dangling edges and unknown path references are caught', () => {
  const data = graph(); data.nodes.push({...data.nodes[0]}); data.edges[0].target = 'missing'; data.paths[0].nodeIds.push('absent');
  const result = E.validateGraph(data);
  for (const code of ['node.id', 'edge.reference', 'path.reference']) assert.ok(result.errors.some(error => error.code === code));
});
test('unsafe source URLs, prototype keys and malformed interview data are rejected', () => {
  const data = graph(); data.nodes[0].sources = [{label: 'Bad', url: 'javascript:alert(1)'}]; data.nodes[1].id = '__proto__'; data.nodes[7].interview.followups = 'not an array';
  const codes = E.validateGraph(data).errors.map(error => error.code);
  assert.ok(codes.includes('source.url')); assert.ok(codes.includes('node.id')); assert.ok(codes.includes('node.interview'));
});
test('search ranks label matches and returns explicit field and evidence basis', () => {
  const data = graph(); data.nodes[5].details = ['Compare the Python client with another database client.'];
  const results = E.searchNodes(data, 'Python');
  assert.equal(results[0].nodeId, 'python-build');
  assert.ok(results[0].rank > results[1].rank);
  assert.ok(results[0].matchedFields.includes('label'));
  assert.equal(results[0].basis.evidenceLevel, 'new-build');
  assert.ok(results[0].snippets.every(item => typeof item.text === 'string' && !ownMarkup(item)));
});
function ownMarkup(item) { return Object.hasOwn(item, 'html'); }
test('bilingual aliases find English-tagged concepts with Chinese queries', () => {
  const result = E.searchNodes(graph(), '多线程', {type: 'concept'});
  assert.deepEqual(result.map(item => item.nodeId), ['thread-study']);
});
test('filters and multiword AND matching do not widen the requested result', () => {
  assert.deepEqual(E.searchNodes(graph(), 'Java OAuth', {type: 'experience'}).map(item => item.nodeId), ['job-java']);
  assert.deepEqual(E.searchNodes(graph(), 'Java Kafka'), []);
  assert.deepEqual(E.searchNodes(graph(), 'Java', {domain: 'game'}), []);
});
test('Java does not match JavaScript and C does not match C++ or arbitrary words', () => {
  assert.ok(!E.searchNodes(graph(), 'Java').some(item => item.nodeId === 'js-build'));
  const result = E.matchJob(graph(), 'JavaScript and C++17. This role draws on teamwork.');
  assert.ok(result.matchedTerms.includes('JavaScript')); assert.ok(result.matchedTerms.includes('C++'));
  for (const term of ['Java', 'C', 'AWS']) assert.ok(!result.matchedTerms.includes(term));
});
test('company initials and generic graph tags do not become technical requirements', () => {
  const data = graph(); data.nodes[0].label = 'K.C. Voicebotics'; data.nodes[1].tags.push('Required', 'experience');
  const result = E.matchJob(data, 'C experience required.');
  assert.deepEqual(result.matchedTerms, ['C']);
  assert.ok(!result.supported.some(item => item.nodeIds.includes('job-java')));
});
test('longer explicit technology names suppress overlapping shorter aliases', () => {
  assert.deepEqual(E.matchJob(graph(), 'Spring Boot').matchedTerms, ['Spring Boot']);
  assert.deepEqual(E.matchJob(graph(), 'Spring or Spring Boot').matchedTerms, ['Spring Boot', 'Spring']);
});
test('search and matching leave all graph data unchanged', () => {
  const data = graph(), before = JSON.stringify(data);
  E.searchNodes(data, 'Java'); E.matchJob(data, 'Java, Kafka, PostgreSQL'); E.neighbors(data, 'job-java'); E.findPath(data, 'java-proof', 'postgres-study');
  assert.equal(JSON.stringify(data), before);
});
test('neighbors are bounded and missing IDs never select the whole graph', () => {
  assert.deepEqual(E.neighbors(graph(), 'job-java', {depth: 0}).nodeIds, ['job-java']);
  assert.equal(E.neighbors(graph(), 'java-proof', {depth: 1}).nodeIds.length, 2);
  assert.equal(E.neighbors(graph(), 'java-proof', {depth: 2}).nodeIds.length, 4);
  assert.deepEqual(E.neighbors(graph(), 'missing').nodeIds, []);
  assert.deepEqual(E.neighbors(graph(), 'job-java', {depth: 99}).nodeIds, []);
});
test('BFS returns a shortest real path and respects edge direction', () => {
  const result = E.findPath(graph(), 'java-proof', 'postgres-study', {direction: 'out'});
  assert.deepEqual(result.nodeIds, ['java-proof', 'job-java', 'postgres-study']);
  assert.equal(result.edges.length, result.nodeIds.length - 1);
  result.edges.forEach((edge, i) => { assert.equal(edge.source, result.nodeIds[i]); assert.equal(edge.target, result.nodeIds[i + 1]); });
  assert.equal(E.findPath(graph(), 'postgres-study', 'java-proof', {direction: 'out'}).found, false);
  assert.equal(E.findPath(graph(), 'postgres-study', 'java-proof').found, true);
  assert.equal(E.findPath(graph(), 'job-java', 'python-build').found, false);
  assert.deepEqual(E.findPath(graph(), 'job-java', 'job-java').nodeIds, ['job-java']);
});
test('cycles do not cause repeated nodes or nontermination', () => {
  const data = graph(); data.edges.push({source: 'postgres-study', target: 'java-proof', label: 'cycle', kind: 'related'});
  assert.equal(new Set(E.neighbors(data, 'job-java', {depth: 6}).nodeIds).size, 4);
  assert.equal(E.findPath(data, 'job-java', 'postgres-study').edges.length, 1);
});
test('job comparison separates supported, study-only and absent known terms', () => {
  const result = E.matchJob(graph(), 'Required: Java, PostgreSQL, Kafka. Python preferred.');
  assert.deepEqual(result.supported.map(item => item.term), ['Java', 'Python']);
  assert.deepEqual(result.studyOnly.map(item => item.term), ['PostgreSQL']);
  assert.deepEqual(result.unmatchedKnown, ['Kafka']);
  assert.ok(result.supported.find(item => item.term === 'Java').paths.some(p => p.nodeIds.length === 2));
  assert.ok(result.ranking.every(item => item.reasons.length && Number.isInteger(item.points)));
  assert.equal(result.score, undefined); assert.equal(result.qualification, undefined);
});
test('a study node connected to work is not promoted into supported experience', () => {
  const result = E.matchJob(graph(), 'PostgreSQL');
  assert.equal(result.supported.length, 0); assert.equal(result.studyOnly[0].term, 'PostgreSQL');
});
test('an unrelated evidence adjacency is not presented as a support path', () => {
  const data = graph(); data.edges[0].kind = 'contrasts';
  const result = E.matchJob(data, 'Java');
  assert.ok(result.supported[0].paths.every(p => p.edges.length === 0));
});
test('question answers and personal pitfalls are context rather than work evidence', () => {
  const result = E.matchJob(graph(), 'Idempotency');
  assert.equal(result.supported.length, 0); assert.deepEqual(result.studyOnly[0].nodeIds, ['retry-pitfall']);
});
test('bilingual JD aliases and unknown tech are explicit without full-eligibility claims', () => {
  const result = E.matchJob(graph(), '要求多线程、检索增强生成、K8s和持续集成。');
  for (const term of ['Multithreading', 'RAG', 'Kubernetes', 'CI/CD']) assert.ok(result.matchedTerms.includes(term));
  assert.ok(result.studyOnly.some(item => item.term === 'Multithreading'));
  assert.ok(result.limitations.some(message => message.includes('work authorization')));
});
test('explicitly unnecessary requirements are excluded; ordinary go is not a language', () => {
  const result = E.matchJob(graph(), 'Kafka is not required. No prior Java experience required. Go to our office to meet the team. Python preferred.');
  assert.deepEqual(result.matchedTerms, ['Python']);
  assert.ok(result.excludedMentions.some(item => item.term === 'Kafka'));
  assert.ok(result.excludedMentions.some(item => item.term === 'Java'));
});
test('job text bounds and unrecognized text do not invent requirements', () => {
  assert.equal(E.matchJob(graph(), 'x'.repeat(50001)).errors[0].code, 'job.text');
  const result = E.matchJob(graph(), 'Five years of industry experience and a degree.');
  assert.deepEqual(result.matchedTerms, []); assert.deepEqual(result.recommendedNodeIds, []);
});
test('self-ratings produce deterministic UTC intervals without changing the input', () => {
  const first = E.scheduleReview(null, 'good', now);
  assert.equal(first.intervalDays, 3); assert.equal(first.dueDate, '2026-09-25T12:00:00.000Z');
  assert.deepEqual(first, E.scheduleReview(null, 'good', now));
  const before = JSON.stringify(first), second = E.scheduleReview(first, 'good', first.dueDate);
  assert.equal(second.intervalDays, 7); assert.equal(second.repetitions, 2);
  const again = E.scheduleReview(second, 'again', second.dueDate);
  assert.equal(again.intervalDays, 1); assert.equal(again.repetitions, 0);
  assert.equal(JSON.stringify(first), before);
});
test('invalid ratings, impossible calendar dates and corrupt schedules reject', () => {
  assert.throws(() => E.scheduleReview(null, 'expert', now), TypeError);
  assert.throws(() => E.scheduleReview(null, 'good', '2026-02-30T12:00:00Z'), TypeError);
  const first = E.scheduleReview(null, 'hard', now); first.dueDate = now;
  assert.throws(() => E.scheduleReview(first, 'good', now), TypeError);
});
test('hard interval grows slowly and long review series stays bounded', () => {
  let review = E.scheduleReview(null, 'hard', now);
  assert.equal(review.intervalDays, 2);
  for (let i = 0; i < 20; i++) review = E.scheduleReview(review, 'good', review.dueDate);
  assert.equal(review.intervalDays, 365);
});
test('study-state round trip preserves plain text including markup without rendering it', () => {
  const input = state(), review = E.scheduleReview(null, 'good', now);
  input.ratings['job-java'] = review; input.dueDates['job-java'] = review.dueDate;
  input.notes['job-java'] = '<img src=x onerror=alert(1)> 复习 < & >';
  const raw = E.exportStudyState(input, graph()), result = E.importStudyState(raw, graph());
  assert.equal(result.ok, true); assert.deepEqual(result.value, input);
  result.value.notes['job-java'] = 'changed'; assert.notEqual(result.value.notes['job-java'], input.notes['job-java']);
});
test('unknown IDs, extra fields, oversized notes and mismatched due dates reject', () => {
  const input = state(); input.notes.missing = 'note'; input.notes['job-java'] = 'x'.repeat(8001); input.extra = true;
  assert.equal(E.validateStudyState(input, graph()).ok, false);
  const scheduled = state(); scheduled.ratings['job-java'] = E.scheduleReview(null, 'good', now); scheduled.dueDates['job-java'] = now;
  assert.ok(E.validateStudyState(scheduled, graph()).errors.some(error => error.code === 'state.schedule'));
});
test('malformed imports and prototype-pollution keys cannot enter accepted state', () => {
  assert.equal(E.importStudyState('{bad').ok, false);
  assert.equal(E.importStudyState('{"schemaVersion":1,"ratings":{},"dueDates":{},"notes":{"__proto__":"x"}}').ok, false);
  assert.equal(E.importStudyState('{"schemaVersion":1,"ratings":{},"dueDates":{},"notes":{"constructor":"x"}}').ok, false);
  assert.equal({}.polluted, undefined);
  assert.equal(E.importStudyState(' '.repeat(1024 * 1024 + 1)).ok, false);
});
test('cyclic direct state is rejected without throwing from validator', () => {
  const input = state(); input.notes['job-java'] = input;
  assert.equal(E.validateStudyState(input).ok, false);
});
test('review payload must contain real bounded primitive values', () => {
  const input = state(), review = E.scheduleReview(null, 'good', now);
  input.ratings['job-java'] = {...review, repetitions: true}; input.dueDates['job-java'] = review.dueDate;
  assert.equal(E.validateStudyState(input, graph()).ok, false);
});
test('invalid supplied graphs are rejected even if the state is empty', () => {
  assert.equal(E.validateStudyState(state(), {schemaVersion: 2, nodes: [], edges: null, paths: []}).ok, false);
});

const dataPath = path.join(__dirname, '..', 'knowledge-data.js');
test('published data script validates and every curated path reference resolves', () => {
  const context = vm.createContext({window: {}});
  vm.runInContext(fs.readFileSync(dataPath, 'utf8'), context, {filename: 'knowledge-data.js'});
  assert.ok(context.window.STEVE_KNOWLEDGE, 'Published data script must expose the browser global.');
  const data = JSON.parse(JSON.stringify(context.window.STEVE_KNOWLEDGE));
  const result = E.validateGraph(data);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  const ids = new Set(data.nodes.map(node => node.id));
  for (const track of data.paths) for (const id of track.nodeIds) assert.ok(ids.has(id));
  const comparison = E.matchJob(data, 'Python, Java, Kubernetes, PostgreSQL, 多线程, CI/CD');
  assert.equal(comparison.errors.length, 0);
  assert.ok(comparison.recommendedNodeIds.every(id => ids.has(id)));
});
