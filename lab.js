'use strict';
const el = (tag, text, className) => { const node = document.createElement(tag); if(text !== undefined) node.textContent = text; if(className) node.className = className; return node; };
let dataset, selected;
const friendly = value => value.replace(/[-_]/g, ' ').replace(/^./, c => c.toUpperCase());
const outcomes = {reject: 'REJECTED', approve: 'POLICY APPROVED', 'dry-run': 'DRY RUN · PASSES POLICY'};

function renderCase(item, updateUrl = true) {
  selected = item.name;
  const target = document.getElementById('lab-result'); target.replaceChildren();
  const report = item.report;
  const heading = el('div', undefined, 'lab-result-head');
  heading.append(el('span', outcomes[report.outcome] || report.outcome, 'lab-badge ' + (report.outcome === 'reject' ? 'reject' : '')));
  heading.append(el('h2', friendly(item.name)));
  heading.append(el('p', item.description || (report.outcome === 'reject' ? 'The engine rejected this proposal. The reasons below identify the checks that failed.' : 'Every configured check passed. No filesystem or network operation was performed.')));
  target.append(heading);
  const decision = el('section', undefined, 'lab-section'); decision.append(el('h3', 'Decision trace'));
  const reasons = el('ul');
  for (const error of report.errors) reasons.append(el('li', error.code + ': ' + error.message));
  for (const check of report.checks) {
    if (!check.reasons.length) reasons.append(el('li', check.step_id + ' / ' + check.tool + ' — all configured checks pass'));
    else for (const reason of check.reasons) reasons.append(el('li', check.step_id + ' / ' + reason.code + ' — ' + reason.message));
  }
  decision.append(reasons); target.append(decision);
  const input = el('section', undefined, 'lab-section');
  const row = el('div', undefined, 'lab-copy-row'); row.append(el('h3', 'Exact plan input'));
  const copy = el('button', 'Copy JSON'); copy.type = 'button'; row.append(copy); input.append(row);
  const pre = el('pre'); pre.append(el('code', JSON.stringify(item.plan, null, 2))); input.append(pre);
  const feedback = el('p', '', 'lab-copy-status'); feedback.setAttribute('role', 'status'); input.append(feedback);
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(item.plan, null, 2)); feedback.textContent = 'Plan copied.'; } catch { feedback.textContent = 'Select the JSON above to copy it.'; } });
  target.append(input);
  const detailSection = el('section', undefined, 'lab-section');
  const details = el('details', undefined, 'lab-details'); details.append(el('summary', 'Full engine output + content hashes'));
  const output = el('pre'); output.append(el('code', JSON.stringify(report, null, 2))); details.append(output); detailSection.append(details); target.append(detailSection);
  document.querySelectorAll('.lab-case').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.name === item.name)));
  if(updateUrl) { const url = new URL(location.href); url.searchParams.set('case', item.name); history.replaceState(null, '', url); }
}

function renderList() {
  const query = document.getElementById('case-filter').value.trim().toLowerCase();
  const matches = dataset.cases.filter(item => JSON.stringify([item.name, item.description, item.report.outcome, item.report.errors, item.report.checks]).toLowerCase().includes(query));
  const list = document.getElementById('case-list'); list.replaceChildren();
  for(const item of matches) {
    const button = el('button', undefined, 'lab-case'); button.type = 'button'; button.dataset.name = item.name;
    button.setAttribute('aria-pressed', String(item.name === selected));
    button.append(el('strong', friendly(item.name)), el('span', item.report.outcome === 'reject' ? 'Rejected proposal' : 'Passing proposal'));
    button.addEventListener('click', () => renderCase(item)); list.append(button);
  }
  if(!matches.length) list.append(el('p', 'No matching scenarios. Try “path” or clear the search.', 'lab-empty'));
  document.getElementById('case-count').textContent = matches.length + ' of ' + dataset.cases.length + ' scenarios';
}

async function load() {
  try {
    const response = await fetch('data/lab.json'); if(!response.ok) throw new Error('Could not load fixtures');
    dataset = await response.json();
    if(!Array.isArray(dataset.cases) || !dataset.cases.length) throw new Error('Fixture dataset is empty');
    const summary = document.getElementById('lab-summary');
    for(const [value, label] of [[dataset.evaluation.passed + '/' + dataset.evaluation.total, 'fixture expectations met'], [dataset.cases.filter(x=>x.report.outcome==='reject').length, 'rejected fixture proposals'], [dataset.evaluation.deterministic ? 'Identical' : 'Mismatch', 'outputs on repeated evaluation']]) {
      const stat = el('div', undefined, 'lab-stat'); stat.append(el('strong', String(value)), el('span', label)); summary.append(stat);
    }
    const name = new URL(location.href).searchParams.get('case');
    renderCase(dataset.cases.find(x => x.name === name) || dataset.cases[0], false);
    renderList(); document.getElementById('case-filter').addEventListener('input', renderList);
  } catch(error) {
    document.getElementById('lab-result').replaceChildren(el('p', 'The replay data is unavailable.'));
    const errorNode = document.getElementById('lab-error'); errorNode.hidden = false;
    errorNode.append(el('p', 'Reload this page or open the versioned fixtures directly:'));
    const link = el('a', 'TraceGate fixtures on GitHub'); link.href = 'https://github.com/Steve5829/tracegate/tree/main/fixtures'; errorNode.append(link);
  }
}
load();
