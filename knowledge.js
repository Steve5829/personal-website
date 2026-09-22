(() => {
  'use strict';
  const E = window.KnowledgeEngine, base = window.STEVE_KNOWLEDGE;
  const $ = id => document.getElementById(id);
  const TYPES = {person:'个人',project:'项目',experience:'经历',concept:'概念',decision:'设计取舍',pitfall:'踩坑',evidence:'证据',question:'面试问题'};
  const DOMAINS = {backend:'后端系统',runtime:'语言运行时',ai:'AI 工具',game:'游戏系统',career:'经历与表达'};
  const LEVELS = {upstream:'上游证据',resume:'简历记载','personal-note':'个人笔记',study:'学习材料','new-build':'新建项目'};
  const STORE = 'steve-knowledge-workspace-v1';
  const freshStudy = () => ({schemaVersion:1,ratings:{},dueDates:{},notes:{}});
  let study = freshStudy(), customNodes = [], customEdges = [], data, nodes, selected = 'steve', activeMode = 'graph', activePath = null, questionId = null, jobResult = null, persistOkay = true, rawRecovery = null;
  function el(tag, cls, value) { const node = document.createElement(tag); if (cls) node.className = cls; if (value !== undefined) node.textContent = value; return node; }
  function button(value, fn, cls = 'node-link') { const node = el('button',cls,value); node.type = 'button'; node.addEventListener('click',fn); return node; }
  function status(message) { $('status').textContent = message; }
  function errorMessage(error) { return error && error.message ? error.message : String(error); }
  function safeURL(value) { try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } }
  function merged(cn = customNodes, ce = customEdges) { return {...base,nodes:[...base.nodes,...cn],edges:[...base.edges,...ce]}; }
  function bundle() { return {format:'steve-knowledge-workspace',version:1,studyState:study,customNodes,customEdges}; }
  function decodeBundle(raw) {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 2000000) throw new Error('文件超过 2 MB 限制。');
    const value = JSON.parse(raw);
    if (!value || value.format !== 'steve-knowledge-workspace' || value.version !== 1 || !Array.isArray(value.customNodes) || !Array.isArray(value.customEdges)) throw new Error('请选择由这个工作台导出的记录文件。');
    if (value.customNodes.length > 250 || value.customEdges.length > 500 || value.customNodes.some(n => !n || !/^local-[a-z0-9-]+$/.test(n.id))) throw new Error('新增知识的格式或数量不正确。');
    const localIds = new Set(value.customNodes.map(n => n.id));
    if (value.customNodes.some(n => !['study','personal-note'].includes(n.evidenceLevel)) || value.customEdges.some(e => !e || (!localIds.has(e.source) && !localIds.has(e.target)))) throw new Error('个人记录不能改写基础知识或来源级别。');
    const graph = merged(value.customNodes,value.customEdges), valid = E.validateGraph(graph);
    if (!valid.ok) throw new Error(`知识数据校验失败：${valid.errors[0].message}`);
    const validated = E.validateStudyState(value.studyState,graph);
    if (!validated.ok) throw new Error(`练习记录校验失败：${validated.errors[0].message}`);
    return {studyState:validated.value,customNodes:value.customNodes,customEdges:value.customEdges};
  }
  function persist() {
    try { const valid = E.validateStudyState(study,data || merged()); if (!valid.ok) throw new Error(valid.errors[0].message); const serialized=JSON.stringify(bundle()); if (new TextEncoder().encode(serialized).length > 2000000) throw new Error('记录超过 2 MB'); if(rawRecovery){localStorage.setItem(STORE+'-recovery',rawRecovery);rawRecovery=null;} localStorage.setItem(STORE,serialized); persistOkay = true; }
    catch { persistOkay = false; status('浏览器暂时不能保存记录。请在关闭页面前点击“导出我的记录”备份。'); }
    return persistOkay;
  }
  function saveNote(id,value) {
    const old=study.notes[id]; study.notes[id]=value;
    try { decodeBundle(JSON.stringify(bundle())); }
    catch { if(old===undefined)delete study.notes[id];else study.notes[id]=old;status('记录超过保存容量，请缩短内容。这次修改尚未保存，已保留之前的记录。');return false; }
    return persist();
  }
  function startQuestion(id) { $('practice-domain').value='';$('due-only').checked=false;questionId=id;switchMode('practice'); }
  function rebuild() { data = merged(); nodes = new Map(data.nodes.map(n => [n.id,n])); $('graph-stats').textContent = `${data.nodes.length} 个节点 · ${data.edges.length} 条关联`; }
  function download(name,content,type = 'text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([content],{type})); const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),10000); }
  const dateLabel = iso => new Date(iso).toLocaleDateString('zh-CN',{month:'short',day:'numeric'});
  const isDue = n => !study.dueDates[n.id] || new Date(study.dueDates[n.id]) <= new Date();
  function badge(text,cls = '') { return el('span',`badge ${cls}`,text); }
  function nodeLink(id) { return button(nodes.get(id)?.label || id,() => { switchMode('graph'); selectNode(id); }); }
  function updateLocation() { try { const url = new URL(location.href); url.searchParams.set('view',activeMode); url.searchParams.set('node',selected); if(activeMode==='practice'&&questionId)url.searchParams.set('question',questionId);else url.searchParams.delete('question'); history.replaceState(null,'',url); } catch {} }
  function switchMode(mode) {
    activeMode = mode;
    document.querySelectorAll('.mode-panel').forEach(p => { p.hidden = p.id !== `${mode}-mode`; });
    document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active',b.dataset.mode === mode); b.setAttribute('aria-pressed',String(b.dataset.mode === mode)); });
    const texts = {graph:['知道什么，为什么，在哪里用过。','从项目进入，沿着设计取舍、踩坑与源码证据继续追问。'],job:['每个要求，找到一段能讲清楚的经历。','把职位描述接到你的知识网络，整理可验证的面试素材。'],practice:['从“看懂了”，到“自己讲得清”。','用自己的话回答，再沿着关联节点补齐细节。']};
    $('mode-title').textContent = texts[mode][0]; $('mode-description').textContent = texts[mode][1];
    if (mode === 'practice') renderPractice(); updateLocation();
  }
  function renderIndex() {
    const query = $('node-search').value.trim();
    let found = E.searchNodes(data,query,{domain:$('domain-filter').value || undefined,type:$('type-filter').value || undefined});
    if(!query){const order={person:0,project:1,experience:2,concept:3,decision:4,pitfall:5,evidence:6,question:7};found.sort((a,b)=>order[a.node.type]-order[b.node.type]||a.node.label.localeCompare(b.node.label));}
    const container = $('node-results'); container.replaceChildren(); $('index-count').textContent = found.length;
    found.forEach(({node,matchedFields}) => {
      const b = button('',() => selectNode(node.id),'index-item'); b.classList.toggle('selected',node.id === selected); b.setAttribute('aria-pressed',String(node.id === selected));
      b.append(el('strong','',node.label),el('small','',`${TYPES[node.type]} · ${DOMAINS[node.domain]}`));
      if (query && matchedFields && !matchedFields.includes('label')) b.append(el('span','search-excerpt',node.summary.slice(0,90)));
      container.append(b);
    });
    if (!found.length) container.append(el('p','no-results','没有找到。换一个中英文关键词，或清除领域和类型筛选。'));
  }
  function selectNode(id,{keepPath = false} = {}) {
    if (!nodes.has(id)) return; selected = id; if (!keepPath) activePath = null;
    renderIndex(); renderGraph(); renderInspector(); renderPathTarget(); updateLocation();
  }
  function renderPathTarget() {
    const old = $('path-target').value; $('path-target').replaceChildren();
    const blank = el('option','','选择另一个知识点 / 项目'); blank.value = ''; $('path-target').append(blank);
    [...data.nodes].filter(n => n.id !== selected && n.type !== 'person').sort((a,b) => a.label.localeCompare(b.label)).forEach(n => { const option = el('option','',`${TYPES[n.type]} · ${n.label}`); option.value = n.id; $('path-target').append(option); });
    if (old !== selected && nodes.has(old)) $('path-target').value = old;
  }
  function svg(tag,attrs = {},content) { const n = document.createElementNS('http://www.w3.org/2000/svg',tag); Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,String(v))); if (content !== undefined) n.textContent = content; return n; }
  function wrapLabel(text,limit = 22) {
    const words = text.replace(/ · /g,' / ').split(/(?<=[\u3400-\u9fff])|\s+/); const lines = ['']; let width = 0;
    words.forEach(word => { const w = [...word].reduce((n,c) => n + (/[^\x00-\x7f]/.test(c) ? 1.8 : 1),0); if (width + w > limit && lines[lines.length-1]) { lines.push(word); width = w; } else { lines[lines.length-1] += (width ? ' ' : '') + word; width += w + 1; } });
    if (lines.length > 2) return [lines[0],lines[1].slice(0,20) + '…']; return lines;
  }
  function renderGraph() {
    const depth = Number($('graph-depth').value); const neighborhood = E.neighbors(data,selected,{depth,direction:'both'});
    let ids, visibleEdges, positions = new Map();
    if (activePath) {
      ids = activePath.nodeIds; visibleEdges = activePath.edges || data.edges.filter(e => ids.some((id,i) => id === e.source && ids[i+1] === e.target || id === e.target && ids[i+1] === e.source));
      const rows = Math.ceil(ids.length / 3); ids.forEach((id,i) => { const row = Math.floor(i/3), col = row % 2 ? 2-i%3 : i%3; positions.set(id,{x:165+285*col,y:rows === 1 ? 330 : 130+420*row/Math.max(1,rows-1)}); });
    } else {
      const priority = {person:0,project:1,experience:2,decision:3,pitfall:4,concept:5,evidence:6,question:7};
      const direct = new Set(E.neighbors(data,selected,{depth:1,direction:'both'}).nodeIds);
      const neighbors = neighborhood.nodeIds.filter(id => id !== selected).sort((a,b) => Number(direct.has(b))-Number(direct.has(a)) || priority[nodes.get(a).type]-priority[nodes.get(b).type] || nodes.get(a).label.localeCompare(nodes.get(b).label));
      ids = [selected,...neighbors.slice(0,10)]; const set = new Set(ids); visibleEdges = neighborhood.edges.filter(e => set.has(e.source) && set.has(e.target));
      positions.set(selected,{x:450,y:340}); const others = ids.slice(1);
      others.forEach((id,i) => { const angle = -Math.PI/2 + Math.PI*2*i/others.length; positions.set(id,{x:450+310*Math.cos(angle),y:340+255*Math.sin(angle)}); });
    }
    const canvas = $('network'); const compact=matchMedia('(max-width:680px)').matches; if(compact){if(activePath){ids.forEach((id,i)=>positions.set(id,{x:i%2?315:110,y:80+Math.floor(i/2)*120}));canvas.setAttribute('viewBox',`0 0 425 ${160+Math.floor((ids.length-1)/2)*120}`);}else{positions.set(selected,{x:220,y:65});ids.slice(1).forEach((id,i)=>positions.set(id,{x:i%2?325:115,y:180+Math.floor(i/2)*115}));canvas.setAttribute('viewBox',`0 0 440 ${140+Math.ceil((ids.length-1)/2)*115}`);}}else canvas.setAttribute('viewBox','0 0 900 680');canvas.replaceChildren();
    visibleEdges.forEach(edge => {
      const a = positions.get(edge.source), b = positions.get(edge.target); if (!a || !b) return;
      canvas.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:`network-edge${activePath ? ' path-edge' : ''}`}));
      if (!compact && (activePath || edge.source === selected || edge.target === selected)) {
        const fraction = .52; const label = svg('text',{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction-5,'text-anchor':'middle',class:'edge-label'},edge.label.length>20 ? edge.label.slice(0,19)+'…' : edge.label); canvas.append(label);
      }
    });
    ids.forEach(id => {
      const n = nodes.get(id), pos = positions.get(id); if (!n) return;
      const isSelected = id === selected; const group = svg('g',{class:`graph-node ${n.type}${isSelected?' selected':''}`,transform:`translate(${pos.x},${pos.y})`,role:'button',tabindex:'0','aria-label':`${n.label}，${TYPES[n.type]}，查看详情`,'aria-pressed':String(isSelected)});
      group.append(svg('title',{},`${n.label}\n${n.summary}`),svg('rect',{x:-85,y:-38,width:170,height:76,rx:12}));
      const lines = wrapLabel(n.label); lines.forEach((line,i) => group.append(svg('text',{x:0,y:lines.length===1 ? -2 : -12+18*i,'text-anchor':'middle'},line)));
      group.append(svg('text',{x:0,y:26,'text-anchor':'middle',class:'node-kind'},TYPES[n.type]));
      group.addEventListener('click',() => selectNode(id,{keepPath:!!activePath})); group.addEventListener('keydown',e => { if (e.key==='Enter'||e.key===' ') {e.preventDefault();selectNode(id,{keepPath:!!activePath});} }); canvas.append(group);
    });
    $('graph-title').textContent = activePath ? activePath.title || '关联路径' : nodes.get(selected).label;
    $('graph-caption').textContent = activePath ? `这条路径包含 ${ids.length} 个节点。点击任意节点，查看解释与来源。连线方向请见右侧关联列表。` : `显示 ${ids.length} / ${neighborhood.nodeIds.length} 个关联节点，优先呈现直接关联。完整直接关联见详情；可搜索进入其他节点。`;
    const banner = $('path-banner'); banner.hidden = !activePath; banner.replaceChildren();
    if (activePath) { banner.append(el('strong','',activePath.description || '沿着这些节点阅读：')); const chain = el('div','path-chain'); ids.forEach((id,i) => { if(i) chain.append(el('span','','→')); chain.append(button(nodes.get(id).label,() => selectNode(id,{keepPath:true}))); }); banner.append(chain); }
  }
  function renderInspector() {
    const n = nodes.get(selected), container = $('inspector'); container.replaceChildren();
    const badges = el('div','node-badges'); badges.append(badge(TYPES[n.type]),badge(LEVELS[n.evidenceLevel],`level-${n.evidenceLevel}`));
    container.append(badges,el('h2','',n.label),el('p','summary',n.summary));
    const tags = el('div','chips'); n.tags.slice(0,7).forEach(t => tags.append(badge(t))); container.append(tags);
    if (n.interview) container.append(button('用这个问题练一遍 →',() => startQuestion(n.id),'primary'));
    const details = el('section','detail-section'); details.append(el('h3','','理解与取舍')); n.details.forEach(text => details.append(el('p','',text))); container.append(details);
    const sources = el('section','detail-section'); sources.append(el('h3','','来源与证据')); const list = el('ul','source-list');
    n.sources.forEach(s => {const li = el('li'); const url = safeURL(s.url); if(url) {const a=el('a','',s.label+' ↗');a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);}else li.append(el('span','',s.label));if(s.reference)li.append(el('span','reference',s.reference));list.append(li);}); sources.append(list); container.append(sources);
    const related = el('section','detail-section'); related.append(el('h3','','直接关联 · 可继续追问'));
    data.edges.filter(e => e.source===n.id || e.target===n.id).forEach(e => {const outgoing=e.source===n.id,id=outgoing?e.target:e.source;const row=el('div','related-item');row.append(el('small','',outgoing?`→ ${e.label}`:`← ${e.label}`),nodeLink(id));related.append(row);});container.append(related);
    const notes = el('section','detail-section'); notes.append(el('h3','','我的理解 · 仅保存在本机')); const area=el('textarea');area.setAttribute('aria-label','我的节点笔记');area.placeholder='用自己的话解释，留下你还没想清楚的部分…';area.value=study.notes[n.id]||'';area.maxLength=8000;const saved=el('span','note-status',area.value?(persistOkay?'已保存到当前浏览器':'仅在当前页面，请导出备份'):'自动保存');area.addEventListener('input',()=>{saved.textContent=saveNote(n.id,area.value)?'已保存到当前浏览器':'未能保存，请导出备份';});notes.append(area,saved);container.append(notes);
    const actions=el('div','button-row');actions.append(button('+ 连接我的新知识',()=>openAdd(),'quiet'));
    if(customNodes.some(c=>c.id===n.id))actions.append(button('删除这个本地节点',()=>{customNodes=customNodes.filter(c=>c.id!==n.id);customEdges=customEdges.filter(e=>e.source!==n.id&&e.target!==n.id);delete study.notes[n.id];delete study.ratings[n.id];delete study.dueDates[n.id];rebuild();const saved=persist();selectNode('steve');if(saved)status('已删除本地节点。基础知识未修改。');},'quiet'));container.append(actions);
  }
  function renderPaths() {
    $('learning-paths').replaceChildren(); data.paths.forEach((path,i)=>{const b=button('',()=>{selected=path.nodeIds[0];activePath=path;renderIndex();renderGraph();renderInspector();renderPathTarget();updateLocation();},'path-button');b.append(el('span','',String(i+1).padStart(2,'0')),el('span','',path.title));$('learning-paths').append(b);});
  }
  function matchJob() {
    const text=$('job-text').value.trim();if(!text){status('先粘贴一份职位描述。');$('job-text').focus();return;}
    jobResult=E.matchJob(data,text); if(jobResult.errors?.length){status(jobResult.errors.map(e=>e.message||e).join(' '));return;}
    renderJob();$('export-job').disabled=false;status('已整理与资料相关的技术要求。点击项目可查看原始依据。');
  }
  function renderJob() {
    const out=$('job-results');out.replaceChildren();
    const group=(title,items,description)=>{const section=el('section','match-section');section.append(el('h3','',title),el('p','',description));if(!items.length)section.append(el('p','','没有匹配项。'));items.forEach(item=>{const card=el('div','match-card');card.append(el('strong','',item.term));const basis=item.basis||[];const tags=el('div','chips');[...new Set(basis.map(b=>b.evidenceLevel))].forEach(level=>tags.append(badge(LEVELS[level],`level-${level}`)));card.append(tags);const ids=[...new Set(item.nodeIds||[])].slice(0,4);if(ids.length)card.append(el('p','',nodes.get(ids[0])?.summary||''));const links=el('div','chips');ids.forEach(id=>links.append(nodeLink(id)));card.append(links);(item.snippets||[]).slice(0,2).forEach(snippet=>card.append(el('p','match-snippet',`${nodes.get(snippet.nodeId)?.label||''} · ${snippet.text}`)));section.append(card);});out.append(section);};
    group('01 / 有经历或项目资料支撑',jobResult.supported||[],'这些关联有来源。具体职责与结果仍应按原始材料表述。');
    group('02 / 需要进一步核对的关联',jobResult.studyOnly||[],'来自学习材料或上下文解释。先核对具体职责，再决定是否能作为工作证据。');
    const missing=el('section','match-section');missing.append(el('h3','','03 / 图谱里暂未找到依据'));const chips=el('div','chips');(jobResult.unmatchedKnown||[]).forEach(t=>chips.append(badge(t)));missing.append(chips,el('p','',(jobResult.unmatchedKnown||[]).length?'仅针对当前识别词表；没有识别到的要求仍需阅读原职位描述。':'当前词表内没有额外缺项。这不代表满足整个职位描述。'));out.append(missing);
    const questions=relevantQuestions(jobResult.recommendedNodeIds||[]).slice(0,5);if(questions.length){const section=el('section','match-section');section.append(el('h3','','04 / 从这些问题开始准备'));questions.forEach(q=>{const card=el('div','match-card');card.append(el('p','',q.interview.prompt),button('开始回答 →',()=>startQuestion(q.id)));section.append(card);});out.append(section);}
    (jobResult.limitations||[]).forEach(t=>out.append(el('p','fine-print',t)));
  }
  function relevantQuestions(ids) {
    const set=new Set(ids);return data.nodes.filter(n=>n.interview).map(n=>({n,score:data.edges.filter(e=>(e.source===n.id&&set.has(e.target))||(e.target===n.id&&set.has(e.source))).length})).filter(v=>v.score>0).sort((a,b)=>b.score-a.score||a.n.label.localeCompare(b.n.label)).map(v=>v.n);
  }
  function sourceMarkdown(n) { return n.sources.map(s=>safeURL(s.url)?`- [${s.label}](${safeURL(s.url)})${s.reference?` — ${s.reference}`:''}`:`- ${s.label}${s.reference?` — ${s.reference}`:''}`).join('\n'); }
  function exportJob() {
    if(!jobResult)return;const lines=['# Steve Chen — 职位面试准备包',`生成日期：${new Date().toLocaleDateString('zh-CN')}`,'','## 职位原文','',$('job-text').value,'','## 有资料支撑的关联',''];
    (jobResult.supported||[]).forEach(item=>{lines.push(`### ${item.term}`,'');(item.nodeIds||[]).slice(0,3).forEach(id=>{const n=nodes.get(id);if(n)lines.push(`**${n.label}** · ${LEVELS[n.evidenceLevel]}`,n.summary,...(item.snippets||[]).filter(s=>s.nodeId===id).map(s=>`匹配依据：${s.text}`),sourceMarkdown(n),'');});});
    lines.push('## 需要进一步核对的关联','',(jobResult.studyOnly||[]).map(i=>i.term).join('、')||'无','', '## 当前图谱未找到依据','',(jobResult.unmatchedKnown||[]).join('、')||'当前已识别词内无额外缺项','', '## 相关面试练习','');
    relevantQuestions(jobResult.recommendedNodeIds||[]).slice(0,8).forEach(q=>lines.push(`### ${q.interview.prompt}`,'',q.interview.answer,'',sourceMarkdown(q),'',...(q.interview.followups||[]).map(f=>`- 追问：${f}`),'',`我的回答：${study.notes[q.id]||'尚未填写'}`,''));
    lines.push('## 使用边界','',...(jobResult.limitations||[]).map(t=>'- '+t),'','本文使用关键词和图谱关联整理资料，不评价录用概率，不发送申请。参考回答应改成自己能解释、能举证的表达。');download('Steve_Job_Interview_Pack.md',lines.join('\n'),'text/markdown;charset=utf-8');status('职位准备包已导出。');
  }
  function practiceQuestions() {
    const domain=$('practice-domain').value,onlyDue=$('due-only').checked;
    return data.nodes.filter(n=>n.interview&&(!domain||n.domain===domain)&&(!onlyDue||isDue(n))).sort((a,b)=>Number(isDue(b))-Number(isDue(a))||a.label.localeCompare(b.label));
  }
  function renderPractice() {
    const questions=practiceQuestions();$('due-count').textContent=`${questions.filter(isDue).length} 待练习`;if(!questions.some(q=>q.id===questionId))questionId=questions[0]?.id||null;
    const list=$('question-list');list.replaceChildren();questions.forEach(q=>{const b=button(q.label,()=>{questionId=q.id;renderPractice();},'question-item');b.classList.toggle('selected',q.id===questionId);b.setAttribute('aria-pressed',String(q.id===questionId));b.append(el('small','',study.dueDates[q.id]?`${isDue(q)?'待复习':'下次'} · ${dateLabel(study.dueDates[q.id])}`:'未练习'));list.append(b);});
    const card=$('practice-card');card.replaceChildren();if(!questionId){card.append(el('h2','','当前队列已完成'),el('p','muted','取消“只看待复习”，或切换领域继续练习。'));return;}
    updateLocation();const q=nodes.get(questionId);const tags=el('div','node-badges');tags.append(badge(DOMAINS[q.domain]),badge(LEVELS[q.evidenceLevel],`level-${q.evidenceLevel}`));card.append(tags,el('h2','',q.interview.prompt),el('p','question-context',q.summary));
    const related=el('div','chips');E.neighbors(data,q.id,{depth:1,direction:'both'}).nodeIds.filter(id=>id!==q.id).slice(0,4).forEach(id=>related.append(nodeLink(id)));card.append(related);
    const answerLabel=el('label','answer-label','先写你的回答');answerLabel.htmlFor='practice-answer';const answer=el('textarea');answer.id='practice-answer';answer.placeholder='Try a 60–90 second answer in your own words. 写下具体情境、你的决定、验证方式，以及仍不确定的部分。';answer.value=study.notes[q.id]||'';answer.maxLength=8000;const saveLabel=el('span','note-status',answer.value?(persistOkay?'已保存到当前浏览器':'仅在当前页面，请导出备份'):'自动保存');answer.addEventListener('input',()=>{saveLabel.textContent=saveNote(q.id,answer.value)?'已保存到当前浏览器':'保存失败，请导出备份';});card.append(answerLabel,answer,saveLabel);
    const ref=el('details');ref.append(el('summary','','查看参考回答与追问'));ref.append(el('p','reference-answer',q.interview.answer));const followups=el('ul','followups');q.interview.followups.forEach(f=>followups.append(el('li','',f)));ref.append(followups,button('回到知识网络查依据 →',()=>{switchMode('graph');selectNode(q.id);},'quiet'));card.append(ref);
    const review=el('section','review-block');review.append(el('h3','','自评这次回答，安排下次复习'));const buttons=el('div','review-buttons');[['again','还讲不清'],['hard','有些卡顿'],['good','能够讲清']].forEach(([rating,label])=>{const next=E.scheduleReview(study.ratings[q.id]||null,rating,new Date().toISOString());const b=button(label,()=>{const scheduled=E.scheduleReview(study.ratings[q.id]||null,rating,new Date().toISOString());const nextState={...study,ratings:{...study.ratings,[q.id]:scheduled},dueDates:{...study.dueDates,[q.id]:scheduled.dueDate}};try{decodeBundle(JSON.stringify({...bundle(),studyState:nextState}));}catch{status('记录容量已满，请先导出并整理笔记。此次自评未保存。');return;}study=nextState;if(persist())status(`已记录自评。${q.label} 下次复习：${dateLabel(scheduled.dueDate)}。`);renderPractice();},'');b.append(el('small','',`${next.intervalDays} 天后`));buttons.append(b);});review.append(buttons);
    if(study.ratings[q.id])review.append(el('p','fine-print',`最近自评：${{again:'还讲不清',hard:'有些卡顿',good:'能够讲清'}[study.ratings[q.id].rating]} · 下次复习 ${dateLabel(study.dueDates[q.id])}`));
    if(questions.length>1)review.append(button('下一题 →',()=>{questionId=questions[(questions.findIndex(n=>n.id===q.id)+1)%questions.length].id;renderPractice();},'quiet'));card.append(review);
  }
  function exportAnswers() {
    const lines=['# Steve Chen — 我的面试与知识笔记',`导出日期：${new Date().toLocaleDateString('zh-CN')}`,''];
    data.nodes.filter(n=>study.notes[n.id]||study.ratings[n.id]).forEach(n=>{lines.push(`## ${n.label}`,'',n.interview?.prompt||n.summary,'',study.notes[n.id]||'（尚未填写回答）','');if(study.dueDates[n.id])lines.push(`下次复习：${dateLabel(study.dueDates[n.id])}`,'');lines.push(sourceMarkdown(n),'');});
    if(lines.length===3)lines.push('尚未填写笔记。可在知识节点或面试训练中开始记录。');download('Steve_My_Interview_Notes.md',lines.join('\n'),'text/markdown;charset=utf-8');
  }
  function openAdd() { $('add-form').reset();$('add-context').textContent=`连接到「${nodes.get(selected).label}」`;$('add-dialog').showModal(); }
  function addKnowledge(event) {
    event.preventDefault();const source=$('add-source').value.trim();if(source&&!safeURL(source)){status('来源链接须为不含账户信息的 HTTP 或 HTTPS 地址。');return;}
    if(customNodes.length>=250){status('本地新增节点已达 250 个，请先导出整理。');return;}
    const id=`local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,body=$('add-details').value.trim();
    if(!body||!$('add-label').value.trim())return;
    const n={id,label:$('add-label').value.trim(),type:$('add-type').value,domain:nodes.get(selected).domain,summary:body.slice(0,240),details:[body],tags:[],evidenceLevel:$('add-level').value,sources:source?[{label:'我添加的来源',url:safeURL(source)}]:[{label:'我的本地笔记',reference:'由当前浏览器使用者添加，未经外部验证。'}]};
    const edge={id:`${id}-edge`,source:selected,target:id,label:'延伸笔记',kind:'supports'};const check=E.validateGraph(merged([...customNodes,n],[...customEdges,edge]));if(!check.ok){status(check.errors[0].message);return;}
    try{decodeBundle(JSON.stringify({...bundle(),customNodes:[...customNodes,n],customEdges:[...customEdges,edge]}));}catch{status('新增知识超过记录容量，请缩短内容或先整理已有笔记。');return;}customNodes.push(n);customEdges.push(edge);rebuild();const saved=persist();$('add-dialog').close();selectNode(id);if(saved)status('新知识已连接并保存在当前浏览器。可导出备份。');
  }
  try {
    if(!E||!base)throw new Error('工作台数据未载入，请刷新或确认离线文件完整。');const validation=E.validateGraph(base);if(!validation.ok)throw new Error(validation.errors[0].message);
    try {const raw=localStorage.getItem(STORE);if(raw){const saved=decodeBundle(raw);study=saved.studyState;customNodes=saved.customNodes;customEdges=saved.customEdges;}}
    catch(error){try{rawRecovery=localStorage.getItem(STORE);}catch{}status(`原有记录未载入：${errorMessage(error)}。可导入之前的备份。`);}
    rebuild();const params=new URLSearchParams(location.search);if(nodes.has(params.get('node')))selected=params.get('node');if(nodes.get(params.get('question'))?.interview)questionId=params.get('question');else if(nodes.get(selected)?.interview)questionId=selected;
    document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
    ['node-search','domain-filter','type-filter'].forEach(id=>$(id).addEventListener(id==='node-search'?'input':'change',renderIndex));
    $('graph-depth').addEventListener('change',()=>{activePath=null;renderGraph();});$('reset-graph').addEventListener('click',()=>{$('node-search').value='';$('type-filter').value='';$('domain-filter').value='';$('graph-depth').value='1';selectNode('steve');});
    $('find-path').addEventListener('click',()=>{const target=$('path-target').value;if(!target){status('先选择一个连接终点。');return;}const path=E.findPath(data,selected,target,{direction:'both'});if(!path.found){status('这两个节点之间还没有记录关联。可以添加自己的知识笔记。');return;}activePath={...path,title:'从问题追到经历',description:'沿已记录的关系双向查找；每条关联可在节点详情中核对。'};renderGraph();});
    $('job-text').addEventListener('input',()=>{if(jobResult){jobResult=null;$('export-job').disabled=true;$('job-results').replaceChildren(el('p','fine-print','职位已修改，请重新点击“找出我的证据”。'));}});$('match-job').addEventListener('click',matchJob);$('sample-job').addEventListener('click',()=>{$('job-text').value='SAMPLE — Software Engineer, New Grad 2027\n\nBuild reliable backend services and developer tools. Work with Python, Java, Spring Boot, REST APIs, PostgreSQL, Redis, OAuth 2.0, and idempotent webhook processing. Write tests and collaborate through code review. Familiarity with Docker and AWS is useful. Kubernetes and Kafka experience is a plus. Explain technical tradeoffs clearly.\n\nThis is a synthetic practice description, not an actual open position.';matchJob();});$('export-job').addEventListener('click',exportJob);
    ['practice-domain','due-only'].forEach(id=>$(id).addEventListener('change',renderPractice));$('export-answers').addEventListener('click',exportAnswers);
    $('export-state').addEventListener('click',()=>{if(rawRecovery)download('Steve_Knowledge_Recovery.json',rawRecovery,'application/json');download('Steve_Knowledge_Backup.json',JSON.stringify(bundle()),'application/json');status('完整记录已导出，包含个人笔记、复习时间和新增知识。');});
    $('import-state').addEventListener('click',()=>$('import-file').click());$('import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('文件超过 2 MB 限制。');const imported=decodeBundle(await file.text());if(Object.keys(study.notes).length||customNodes.length||Object.keys(study.ratings).length)download('Steve_Knowledge_Before_Import.json',JSON.stringify(bundle()),'application/json');study=imported.studyState;customNodes=imported.customNodes;customEdges=imported.customEdges;rebuild();const saved=persist();if(!nodes.has(selected))selected='steve';activePath=null;selectNode(selected);renderPaths();if(activeMode==='practice')renderPractice();if(jobResult)matchJob();if(saved)status('导入完成。若此前已有记录，已先下载替换前备份。');else status('记录已载入内存，但浏览器未能保存。请保留导入文件，关闭前导出最新记录。');}catch(error){status(`导入失败，现有记录未改变：${errorMessage(error)}`);}finally{e.target.value='';}});
    $('close-dialog').addEventListener('click',()=>$('add-dialog').close());$('add-form').addEventListener('submit',addKnowledge);
    matchMedia('(max-width:680px)').addEventListener('change',renderGraph);renderPaths();selectNode(selected);switchMode(['graph','job','practice'].includes(params.get('view'))?params.get('view'):'graph');
  } catch(error) {status(`载入失败：${errorMessage(error)}`);}
})();
