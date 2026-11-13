/* DRE Gerencial Mariuá: filtros, números e gráficos em linguagem simples */
(function () {
  'use strict';

  const D = window.DRE;
  const MONTHS = D.months;
  const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho'];
  const N = MONTHS.length;
  // Apresentação: os efeitos ficam ligados mesmo com as animações do Windows desligadas. ?animacao=off desliga.
  const MOTION = new URLSearchParams(location.search).get('animacao') !== 'off';
  if (!MOTION) document.documentElement.classList.add('no-motion');
  let firstRun = true; // na primeira carga, cada número e gráfico anima quando o card aparece

  const C = {
    teal: '#059B9B', teal700: '#04797A', teal900: '#0B4F52',
    orange: '#F2753D', orangeSoft: '#F8B48F', orange700: '#C9531D',
    ink: '#14292B', ink2: '#4A5D60', ink3: '#5B6D70', line: '#E3E9EA', line2: '#EEF2F3',
    other: '#B9C6C8', surface: '#FFFFFF'
  };
  const FONT = 'Manrope, "Segoe UI", system-ui, sans-serif';

  // ---------- Modelo ----------
  const byCode = Object.fromEntries(D.groups.map(g => [g.code, g]));
  const zeros = () => new Array(N).fill(0);
  const series = code => (byCode[code] ? byCode[code].values : zeros());
  const add = (...arrs) => arrs.reduce((acc, a) => acc.map((v, i) => v + a[i]), zeros());
  const neg = arr => arr.map(v => -v);
  const findChild = (code, re) => {
    const g = byCode[code];
    const c = g && g.children.find(ch => re.test(ch.name));
    return c ? c.values : zeros();
  };

  const RB = series('31');                        // faturamento bruto
  const IMP = series('33');                       // impostos sobre o faturamento (negativo)
  const GASTOS = add(series('41'), series('51'), series('52'), series('53')); // custos e despesas (negativo)
  const FINOUT = add(series('54'), series('61')); // outros resultados + resultado financeiro
  const FIN = series('61');
  const IR = series('71');
  const RES = add(...D.groups.map(g => g.values)); // lucro líquido
  const DEP = add(findChild('51', /DEPRECIA/), findChild('52', /DEPRECIA/));
  // EBITDA recalculado: devolve depreciação, resultado financeiro e IR/CS ao resultado
  const EBITDA = RES.map((v, i) => v - DEP[i] - FIN[i] - IR[i]);

  // Gastos em categorias do dia a dia, juntando operação e administrativo
  const CATS = [
    { label: 'Pessoal', hint: 'Salários, encargos, benefícios e provisões', re: /^PESSOAL/ },
    { label: 'Combustível', hint: 'Combustíveis e lubrificantes', re: /COMBUST/ },
    { label: 'Manutenção e peças', hint: 'Veículos, máquinas, instalações e peças', re: /MANUTEN/ },
    { label: 'Depreciação', hint: 'Desgaste de veículos, máquinas e equipamentos', re: /DEPRECIA/ },
    { label: 'Materiais e EPI', hint: 'Material aplicado e segurança do trabalho', group: '41' },
    { label: 'Serviços de terceiros', hint: 'Prestadores, vigilância, telemetria e transporte', re: /^SERVI/ },
    { label: 'Aluguéis e frete', hint: 'Embarcações, motos, veículos, imóveis e fretes', re: /ALUGUEL|FRETE/ },
    { label: 'Impostos e taxas', hint: 'Despesas tributárias e regulatórias', re: /REGULAT/, group: '53' },
    { label: 'Outros', hint: 'Energia, telefonia, seguros, viagens, consumo e diversos', rest: true }
  ];
  CATS.forEach(c => { c.values = zeros(); c.accounts = []; });
  ['41', '51', '52', '53'].forEach(code => {
    byCode[code].children.forEach(ch => {
      const cat = CATS.find(c => c.group === code) ||
        CATS.find(c => c.re && !c.group && c.re.test(ch.name)) ||
        CATS.find(c => c.re && c.re.test(ch.name)) ||
        CATS.find(c => c.rest);
      cat.values = add(cat.values, neg(ch.values));
      ch.accounts.forEach(a => cat.accounts.push({ name: a.name, values: neg(a.values) }));
    });
  });
  console.assert(Math.abs(CATS.reduce((s, c) => s + c.values.reduce((a, b) => a + b, 0), 0) + GASTOS.reduce((a, b) => a + b, 0)) < 1,
    'Categorias de gasto não batem com o total de custos e despesas');

  // ---------- Estado ----------
  const state = {
    selected: new Set(MONTHS.map((_, i) => i)),
    view: 'mensal',
    mode: 'painel',   // 'painel' (tudo numa tela) ou 'apresentacao' (4 telas)
    slide: 0
  };

  const selIdx = () => [...state.selected].sort((a, b) => a - b);
  const lastSel = () => Math.max(...state.selected);
  // Mensal: soma dos meses marcados. Acumulado: de janeiro até o último mês marcado.
  const periodIdx = () => state.view === 'acumulado'
    ? Array.from({ length: lastSel() + 1 }, (_, i) => i)
    : selIdx();
  const sumP = arr => periodIdx().reduce((s, i) => s + arr[i], 0);
  const cumul = arr => arr.reduce((acc, v, i) => (acc.push((acc[i - 1] || 0) + v), acc), []);
  const shape = arr => (state.view === 'acumulado' ? cumul(arr) : arr.slice());
  const isActive = i => (state.view === 'acumulado' ? i <= lastSel() : state.selected.has(i));
  const singleMonth = () => state.view === 'mensal' && state.selected.size === 1;

  // ---------- Formatação ----------
  const nf = d => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const NF0 = nf(0), NF1 = nf(1), NF2 = nf(2);
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  function unitOf(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return { div: 1e6, unit: 'mi', f: NF2 };
    if (a >= 1e3) return { div: 1e3, unit: 'mil', f: NF1 };
    return { div: 1, unit: '', f: NF0 };
  }
  // "R$ 36,4 mi" / "R$ 988 mil"
  function money(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return `R$ ${NF1.format(v / 1e6)} mi`;
    if (a >= 1e3) return `R$ ${NF0.format(v / 1e3)} mil`;
    return `R$ ${NF0.format(v)}`;
  }
  const short = v => money(v).replace('R$ ', '').replace(' ', ' ');
  function axisMoney(v) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e6) return `${NF0.format(v / 1e6)} mi`;
    if (a >= 1e3) return `${NF0.format(v / 1e3)} mil`;
    return NF0.format(v);
  }
  const pct = (v, d = 1) => `${nf(d).format(v * 100)}%`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const joinPT = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`);

  const ACRONYMS = new Set(['EPI', 'EPC', 'INSS', 'FGTS', 'PIS', 'COFINS', 'ISS', 'ICMS', 'IPI', 'CPRB', 'IR', 'CS', 'PJ', 'PF', 'IOF', 'OPER']);
  const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'p/', 's/', 'a', 'o', 'com']);
  function prettify(name) {
    return name.toLowerCase().split(/(\s+|\/|-|\(|\))/).map((w, i) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      if (i > 0 && SMALL.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join('').replace(/\s+/g, ' ').trim();
  }

  // ---------- Count-up ----------
  const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function countTo(el, to, render, { duration = 1600, delay = 0 } = {}) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    cancelAnimationFrame(el._raf);
    clearTimeout(el._wait);
    if (!MOTION || from === to) { render(to); return; }
    render(from);
    el._wait = setTimeout(() => {
      // o relógio começa no primeiro quadro: o timestamp do rAF pode ser anterior a performance.now()
      let t0 = null;
      const tick = now => {
        if (t0 === null) t0 = now;
        const t = Math.max(0, Math.min(1, (now - t0) / duration));
        render(from + (to - from) * easeOutExpo(t));
        if (t < 1) { el._raf = requestAnimationFrame(tick); return; }
        el.classList.remove('settle');
        void el.offsetWidth;
        el.classList.add('settle');
      };
      el._raf = requestAnimationFrame(tick);
    }, delay);
  }
  // formata durante a contagem sempre na unidade do valor final (não pula de "mil" para "mi")
  function moneyLike(target) {
    const a = Math.abs(target);
    if (a >= 1e6) return v => `R$\u00a0${NF1.format(v / 1e6)}\u00a0mi`;
    if (a >= 1e3) return v => `R$\u00a0${NF0.format(v / 1e3)}\u00a0mil`;
    return v => `R$\u00a0${NF0.format(v)}`;
  }

  // ---------- Ícones ----------
  const ICON = {
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10"/><path d="M17 8v9H8"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>'
  };

  // ---------- Filtros ----------
  const monthsEl = document.getElementById('months');
  const btnSem = document.getElementById('btnSemestre');
  const viewToggle = document.getElementById('viewToggle');
  let anchor = 0, dragging = false, dragStart = 0;

  MONTHS.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'month';
    b.textContent = m;
    b.dataset.i = i;
    b.title = `${cap(MONTH_NAMES[i])} · Shift ou arraste para escolher vários meses`;
    monthsEl.appendChild(b);
  });

  function setRange(a, b) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    state.selected = new Set(Array.from({ length: hi - lo + 1 }, (_, k) => lo + k));
  }

  monthsEl.addEventListener('pointerdown', e => {
    const b = e.target.closest('.month');
    if (!b) return;
    const i = +b.dataset.i;
    if (e.shiftKey) setRange(anchor, i);
    else if (e.ctrlKey || e.metaKey) {
      if (state.selected.has(i) && state.selected.size > 1) state.selected.delete(i);
      else state.selected.add(i);
      anchor = i;
    } else {
      anchor = i; dragStart = i; dragging = true;
      state.selected = new Set([i]);
    }
    update();
  });
  monthsEl.addEventListener('pointerover', e => {
    if (!dragging) return;
    const b = e.target.closest('.month');
    if (!b) return;
    setRange(dragStart, +b.dataset.i);
    update();
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  monthsEl.addEventListener('keydown', e => {
    const b = e.target.closest('.month');
    if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    const i = +b.dataset.i;
    if (e.shiftKey) setRange(anchor, i); else { anchor = i; state.selected = new Set([i]); }
    update();
  });
  btnSem.addEventListener('click', () => {
    state.selected = new Set(MONTHS.map((_, i) => i));
    update();
  });
  viewToggle.addEventListener('click', e => {
    const b = e.target.closest('button[data-view]');
    if (!b || b.dataset.view === state.view) return;
    state.view = b.dataset.view;
    update();
  });

  // "De janeiro a junho", "Em junho", "No acumulado de janeiro a abril"
  function periodPhrase() {
    const idx = periodIdx();
    const first = idx[0], last = idx[idx.length - 1];
    const contiguous = idx.length === last - first + 1;
    if (state.view === 'acumulado') return `No acumulado de janeiro a ${MONTH_NAMES[last]}`;
    if (idx.length === 1) return `Em ${MONTH_NAMES[first]}`;
    if (contiguous) return `De ${MONTH_NAMES[first]} a ${MONTH_NAMES[last]}`;
    return `Em ${joinPT(idx.map(i => MONTH_NAMES[i]))}`;
  }

  function renderFilters() {
    [...monthsEl.children].forEach((b, i) => b.setAttribute('aria-pressed', state.selected.has(i)));
    btnSem.disabled = state.selected.size === N && state.view === 'mensal';
    viewToggle.dataset.view = state.view;
    viewToggle.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.view === state.view));

    const h1 = document.querySelector('.titles h1');
    if (singleMonth()) h1.textContent = `Como foi ${MONTH_NAMES[selIdx()[0]]}`;
    else if (periodIdx().length === N) h1.textContent = 'Como foi o semestre';
    else h1.textContent = 'Como foi o período';
    document.getElementById('periodLabel').textContent =
      `DRE gerencial consolidada · ${periodPhrase().replace(/^(De|Em|No) /, '')} de 2025`;
  }

  // ---------- Frase do período ----------
  const headlineEl = document.getElementById('headline');
  function renderHeadline() {
    const fat = sumP(RB), imp = -sumP(IMP), gas = -sumP(GASTOS), res = sumP(RES);
    const cnt = v => `<b class="cnt" data-to="${v}">${money(v)}</b>`;
    let html = `${periodPhrase()}, a Mariuá faturou ${cnt(fat)}, pagou ${cnt(imp)} de impostos, gastou ${cnt(gas)} e `;
    if (res >= 0) {
      const per100 = res / fat * 100;
      html += per100 >= 1
        ? `ficou com ${cnt(res)} de lucro: <b>${NF0.format(Math.round(per100))} de cada 100 reais</b> faturados.`
        : `ficou com ${cnt(res)} de lucro, menos de 1 real a cada 100 faturados.`;
    } else {
      html += `teve <b>prejuízo de</b> ${cnt(-res)}.`;
    }

    // um complemento só: alerta de prejuízo, comparação com o mês anterior ou o maior gasto
    const idx = periodIdx();
    const lossMonths = idx.filter(i => RES[i] <= -1e5).map(i => MONTHS[i]);
    let extra = '';
    if (idx.length > 1 && lossMonths.length) {
      extra = `<span class="alert">Atenção: <b>${joinPT(lossMonths)}</b> ${lossMonths.length > 1 ? 'fecharam' : 'fechou'} no prejuízo.</span>`;
    } else if (singleMonth() && idx[0] > 0) {
      const i = idx[0];
      if (gas > fat - imp) {
        extra = `<span class="alert">Atenção: os gastos passaram o que sobrou do faturamento depois dos impostos (${money(fat - imp)}).</span>`;
      } else {
        const ch = (RB[i] - RB[i - 1]) / RB[i - 1];
        extra = `O faturamento foi <b>${pct(Math.abs(ch))} ${ch >= 0 ? 'maior' : 'menor'}</b> que em ${MONTH_NAMES[i - 1]}.`;
      }
    } else {
      const top = CATS.filter(c => !c.rest).map(c => ({ c, v: sumP(c.values) })).sort((a, b) => b.v - a.v)[0];
      extra = `${top.c.label} é o maior gasto: <b>${NF0.format(Math.round(top.v / gas * 10))} de cada 10 reais</b> gastos.`;
    }
    headlineEl.innerHTML = `${html} ${extra}`;
    headlineEl.classList.remove('swap');
    void headlineEl.offsetWidth;
    headlineEl.classList.add('swap');
    headlineEl.querySelectorAll('.cnt').forEach((b, k) => {
      const to = Number(b.dataset.to), fmt = moneyLike(to);
      countTo(b, to, v => { b.textContent = fmt(v); }, { duration: 1400, delay: firstRun ? 250 + k * 120 : k * 60 });
    });
  }

  // ---------- Os 4 números ----------
  const KPI_DEFS = [
    { id: 'fat', label: 'Faturou', tech: 'Receita bruta', data: RB, higherIsGood: true,
      foot: v => (periodIdx().length > 1 ? `Média de <b>${money(v / periodIdx().length)}</b> por mês` : 'Faturamento bruto do mês') },
    { id: 'imp', label: 'Impostos', tech: 'Sobre o faturamento', data: neg(IMP), higherIsGood: false,
      foot: v => `<b>${pct(v / sumP(RB))}</b> do faturamento` },
    { id: 'gas', label: 'Gastou', tech: 'Custos e despesas', data: neg(GASTOS), higherIsGood: false,
      foot: v => `<b>${pct(v / sumP(RB))}</b> do faturamento` },
    { id: 'res', label: 'Sobrou', tech: 'Lucro líquido', data: RES, higherIsGood: true, result: true,
      foot: v => `Margem de <b>${pct(v / sumP(RB))}</b> · após financeiro e IR/CS` }
  ];

  const kpisEl = document.getElementById('kpis');
  kpisEl.innerHTML = KPI_DEFS.map((k, i) => `
    ${i ? `<div class="op reveal" style="--i:${i * 2}" aria-hidden="true">${i < 3 ? ICON.minus : ICON.arrow}</div>` : ''}
    <article class="kpi reveal ${k.result ? 'kpi-result' : ''}" style="--i:${i * 2 + 1}" id="kpi-${k.id}">
      <div class="kpi-label"><strong>${k.label}</strong><span>${k.tech}</span></div>
      <div class="kpi-value"><span class="cur">R$</span><span class="num">0</span><span class="unit"></span></div>
      <div class="kpi-foot"></div>
    </article>`).join('');

  function renderKpis() {
    const idx = periodIdx();
    const compare = singleMonth() && idx[0] > 0;
    KPI_DEFS.forEach(k => {
      const el = document.getElementById('kpi-' + k.id);
      const v = sumP(k.data);
      const numEl = el.querySelector('.num');
      const u = unitOf(v);
      el.querySelector('.unit').textContent = u.unit;
      if (k.result) el.classList.toggle('is-neg', v < 0);
      countTo(numEl, v, cur => { numEl.textContent = u.f.format(cur / u.div); },
        { delay: firstRun ? 200 + KPI_DEFS.indexOf(k) * 150 : 0 });

      const foot = el.querySelector('.kpi-foot');
      if (compare) {
        const i = idx[0], prev = k.data[i - 1], cur = k.data[i];
        const diff = cur - prev;
        const ch = prev !== 0 ? diff / Math.abs(prev) : Infinity;
        const good = (diff >= 0) === k.higherIsGood;
        const txt = Math.abs(ch) > 3 ? `${money(Math.abs(diff))} ${diff >= 0 ? 'a mais' : 'a menos'}` : `${pct(Math.abs(ch))} ${diff >= 0 ? 'maior' : 'menor'}`;
        foot.innerHTML = `<span class="delta ${good ? 'good' : 'bad'}">${diff >= 0 ? ICON.up : ICON.down}${txt}</span> que em ${MONTH_NAMES[i - 1]}`;
      } else {
        foot.innerHTML = k.foot(v);
      }
    });
  }

  // ---------- ECharts: base ----------
  const charts = {};
  // cria o gráfico só quando o contêiner tem tamanho (os da apresentação ficam ocultos no modo painel)
  function chart(id) {
    if (charts[id]) return charts[id];
    const el = document.getElementById(id);
    if (!el || !el.offsetWidth) return null;
    return (charts[id] = echarts.init(el, null, { renderer: 'canvas' }));
  }
  const ANIM = {
    animation: MOTION,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 850,
    animationEasingUpdate: 'cubicInOut'
  };
  const TOOLTIP = {
    backgroundColor: C.surface,
    borderColor: C.line,
    borderWidth: 1,
    padding: [10, 12],
    textStyle: { color: C.ink, fontFamily: FONT, fontSize: 12.5 },
    extraCssText: 'border-radius:10px;box-shadow:0 10px 30px -10px rgba(20,41,43,.25);max-width:320px;white-space:normal;'
  };
  const AXIS_LABEL = { color: C.ink3, fontFamily: FONT, fontSize: 12, fontWeight: 600 };
  const ttRow = (color, name, value, strong) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-top:4px">` +
    (color ? `<span style="width:8px;height:8px;border-radius:2px;background:${color};flex:none"></span>` : '') +
    `<span style="color:${C.ink2}">${name}</span><span style="margin-left:auto;padding-left:16px;font-weight:${strong ? 800 : 700};color:${C.ink};white-space:nowrap">${value}</span></div>`;
  const ttTitle = t => `<div style="font-weight:800;color:${C.ink};margin-bottom:2px">${t}</div>`;
  const ttNote = t => `<div style="margin-top:6px;color:${C.ink3};line-height:1.4">${t}</div>`;
  const monthTitle = i => cap(MONTH_NAMES[i]) + (state.view === 'acumulado' ? ' (acumulado)' : '');

  // ---------- 1. Do faturamento ao lucro ----------
  const WF_NOTES = {
    imp: 'ISS, PIS, COFINS e CPRB cobrados sobre o faturamento.',
    gas: 'Pessoal, combustível, manutenção, materiais, depreciação e demais custos e despesas.',
    fin: 'Rendimento de aplicações e outros resultados, menos juros de empréstimos e outras despesas financeiras.',
    ir: 'Imposto de renda e contribuição social sobre o lucro.'
  };
  function renderWaterfall() {
    const wf = chart('chWaterfall');
    if (!wf) return;
    const fat = sumP(RB);
    const steps = [
      { name: 'Faturamento', v: fat, total: true },
      { name: 'Impostos', key: 'imp', v: sumP(IMP) },
      { name: 'Gastos', key: 'gas', v: sumP(GASTOS) },
      { name: 'Financeiro\ne outros', key: 'fin', v: sumP(FINOUT) },
      { name: 'IR / CS', key: 'ir', v: sumP(IR) },
      { name: 'Lucro', v: sumP(RES), total: true }
    ];
    let run = 0;
    const data = steps.map((s, i) => {
      let start, end;
      if (s.total) { start = 0; end = s.v; run = s.v; } else { start = run; end = run + s.v; run = end; }
      return { value: [i, start, end, s.v], total: !!s.total, key: s.key, label: s.name.replace('\n', ' ') };
    });

    wf.setOption({
      ...ANIM,
      grid: { left: 8, right: 8, top: 28, bottom: 4, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'item',
        formatter: p => {
          const d = p.data, v = d.value[3];
          if (d.total) {
            return ttTitle(d.label) + ttRow(null, 'Valor', BRL.format(v), true) +
              (d.label === 'Lucro' ? ttRow(null, 'De cada R$ 100 faturados', `R$ ${NF2.format(v / fat * 100)}`) : '');
          }
          return ttTitle(d.label) + ttRow(null, v >= 0 ? 'Entrou' : 'Saiu', BRL.format(Math.abs(v)), true) +
            ttRow(null, 'Em relação ao faturamento', pct(Math.abs(v) / fat)) + ttNote(WF_NOTES[d.key]);
        }
      },
      xAxis: {
        type: 'category',
        data: steps.map(s => s.name),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: C.line } },
        axisLabel: { ...AXIS_LABEL, interval: 0, lineHeight: 14, color: C.ink2 }
      },
      yAxis: { type: 'value', splitNumber: 4, axisLabel: { ...AXIS_LABEL, formatter: axisMoney }, splitLine: { lineStyle: { color: C.line2 } } },
      series: [{
        type: 'custom',
        id: 'wf',
        encode: { x: 0, y: [1, 2] },
        data,
        renderItem: (params, api) => {
          const i = api.value(0), start = api.value(1), end = api.value(2), v = api.value(3);
          const total = data[params.dataIndex].total;
          const p0 = api.coord([i, start]), p1 = api.coord([i, end]);
          const bw = api.size([1, 0])[0] * 0.56;
          const top = Math.min(p0[1], p1[1]);
          const h = Math.max(Math.abs(p1[1] - p0[1]), 2);
          const fill = total ? (v < 0 ? C.orange700 : (params.dataIndex === 0 ? C.ink : C.teal)) : (v >= 0 ? C.teal : C.orange);
          const labelAbove = !(total && v < 0);
          const children = [{
            type: 'rect',
            shape: { x: p0[0] - bw / 2, y: top, width: bw, height: h, r: 5 },
            style: { fill },
            enterFrom: { shape: { y: p0[1], height: 0 } },
            enterAnimation: { duration: 900, delay: params.dataIndex * 180, easing: 'cubicOut' },
            emphasis: { style: { shadowBlur: 14, shadowOffsetY: 4, shadowColor: 'rgba(20,41,43,.22)' } }
          }, {
            type: 'text',
            silent: true,
            style: {
              text: (v < 0 && !total ? '−' : '') + short(total ? v : Math.abs(v)),
              x: p0[0], y: labelAbove ? top - 6 : top + h + 6,
              align: 'center', verticalAlign: labelAbove ? 'bottom' : 'top',
              fill: C.ink, font: `${total ? 800 : 700} 12.5px ${FONT}`
            },
            enterFrom: { style: { opacity: 0 }, y: labelAbove ? 8 : -8 },
            enterAnimation: { duration: 500, delay: params.dataIndex * 180 + 600, easing: 'cubicOut' }
          }];
          if (params.dataIndex < data.length - 1) {
            const nx = api.coord([i + 1, end]);
            children.push({
              type: 'line', silent: true,
              shape: { x1: p0[0] + bw / 2, y1: p1[1], x2: nx[0] - bw / 2, y2: p1[1] },
              style: { stroke: '#B9C6C8', lineWidth: 1, lineDash: [2, 3] },
              enterFrom: { style: { opacity: 0 } },
              enterAnimation: { duration: 400, delay: params.dataIndex * 180 + 700 }
            });
          }
          return { type: 'group', children };
        }
      }]
    }, { replaceMerge: ['series'] });
  }

  // ---------- 2. Faturamento × gastos por mês ----------
  function renderFlow() {
    const fl = chart('chFlow');
    if (!fl) return;
    const fat = shape(RB), imp = shape(neg(IMP)), gas = shape(neg(GASTOS));
    document.getElementById('flowSub').textContent = state.view === 'acumulado'
      ? 'Valores somados desde janeiro'
      : 'Laranja acima do verde: o mês gastou mais do que faturou';
    const op = i => (isActive(i) ? 1 : 0.25);
    const lbl = { show: true, position: 'top', color: C.ink, fontFamily: FONT, fontSize: 11.5, fontWeight: 700 };
    fl.setOption({
      ...ANIM,
      grid: { left: 8, right: 8, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(5,155,155,.06)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          const out = imp[i] + gas[i], bal = fat[i] - out;
          return ttTitle(monthTitle(i)) +
            ttRow(C.teal, 'Faturou', BRL.format(fat[i])) +
            ttRow(C.orangeSoft, 'Impostos', BRL.format(imp[i])) +
            ttRow(C.orange, 'Gastos', BRL.format(gas[i])) +
            ttRow(null, bal >= 0 ? 'Sobrou antes de financeiro e IR' : 'Faltou', BRL.format(Math.abs(bal)), true);
        }
      },
      xAxis: { type: 'category', data: MONTHS, axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...AXIS_LABEL, color: C.ink2 } },
      yAxis: { type: 'value', splitNumber: 4, axisLabel: { ...AXIS_LABEL, formatter: axisMoney }, splitLine: { lineStyle: { color: C.line2 } } },
      series: [
        {
          name: 'Faturou', type: 'bar', stack: 'in', barGap: '10%', barCategoryGap: '32%',
          data: fat.map((v, i) => ({ value: v, itemStyle: { color: C.teal, opacity: op(i) } })),
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          label: { ...lbl, formatter: p => (isActive(p.dataIndex) ? NF1.format(p.value / 1e6) : '') },
          animationDelay: i => i * 110
        },
        {
          name: 'Impostos', type: 'bar', stack: 'out',
          data: imp.map((v, i) => ({ value: v, itemStyle: { color: C.orangeSoft, opacity: op(i) } })),
          animationDelay: i => i * 110 + 60
        },
        {
          name: 'Gastos', type: 'bar', stack: 'out',
          data: gas.map((v, i) => ({ value: v, itemStyle: { color: C.orange, opacity: op(i) } })),
          itemStyle: { borderRadius: [5, 5, 0, 0] },
          // o rótulo mostra o total que saiu (impostos + gastos)
          label: { ...lbl, formatter: p => (isActive(p.dataIndex) ? NF1.format((p.value + imp[p.dataIndex]) / 1e6) : '') },
          animationDelay: i => i * 110 + 180
        }
      ]
    });
  }

  // ---------- 3. Onde gastamos ----------
  function renderSpend() {
    const sp = chart('chSpend');
    if (!sp) return;
    const total = -sumP(GASTOS) || 1;
    const items = CATS.map(c => ({ c, v: sumP(c.values) }))
      .sort((a, b) => (a.c.rest ? 1 : b.c.rest ? -1 : b.v - a.v))
      .reverse();
    sp.setOption({
      ...ANIM,
      grid: { left: 4, right: 96, top: 6, bottom: 2, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'item',
        formatter: p => {
          const it = items[p.dataIndex];
          const top = it.c.accounts.map(a => ({ name: prettify(a.name), v: sumP(a.values) }))
            .filter(a => a.v > 0).sort((a, b) => b.v - a.v).slice(0, 3);
          return ttTitle(it.c.label) +
            ttRow(null, 'Gastou', BRL.format(it.v), true) +
            ttRow(null, 'Dos gastos totais', pct(it.v / total)) +
            ttNote(it.c.hint) +
            `<div style="margin-top:8px;font-weight:700;color:${C.ink2}">Maiores contas</div>` +
            top.map(a => ttRow(null, a.name, money(a.v))).join('');
        }
      },
      xAxis: { type: 'value', show: false, max: v => v.max * 1.02 },
      yAxis: {
        type: 'category', data: items.map(it => it.c.label),
        axisTick: { show: false }, axisLine: { show: false },
        axisLabel: { ...AXIS_LABEL, color: C.ink, fontSize: 12.5, fontWeight: 700 }
      },
      series: [{
        type: 'bar',
        barWidth: '60%',
        data: items.map(it => ({ value: it.v, itemStyle: { color: it.c.rest ? C.other : C.orange, borderRadius: [0, 5, 5, 0] } })),
        showBackground: true,
        backgroundStyle: { color: C.line2, borderRadius: [0, 5, 5, 0] },
        label: {
          show: true, position: 'right', distance: 8,
          formatter: p => `{v|${short(p.value)}}  {p|${pct(p.value / total, 0)}}`,
          rich: {
            v: { color: C.ink, fontFamily: FONT, fontSize: 12.5, fontWeight: 800 },
            p: { color: C.ink3, fontFamily: FONT, fontSize: 12, fontWeight: 600 }
          }
        },
        animationDuration: 1300,
        animationDelay: i => (items.length - 1 - i) * 90
      }]
    });
  }

  // ---------- 4. Lucro por mês ----------
  function renderProfit() {
    const pf = chart('chProfit');
    if (!pf) return;
    const res = shape(RES), eb = shape(EBITDA);
    const maxAbs = Math.max(...res.map(Math.abs));
    const shortVal = v => (Math.abs(v) >= 1e6 ? NF1.format(v / 1e6) : `${NF0.format(v / 1e3)} mil`);
    pf.setOption({
      ...ANIM,
      grid: { left: 8, right: 10, top: 24, bottom: 4, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(5,155,155,.06)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          return ttTitle(monthTitle(i)) +
            ttRow(res[i] >= 0 ? C.teal : C.orange, res[i] >= 0 ? 'Lucro' : 'Prejuízo', BRL.format(Math.abs(res[i])), true) +
            ttRow(C.ink, 'EBITDA', BRL.format(eb[i])) +
            (state.view === 'mensal' && IR[i] ? ttRow(null, 'IR / CS pago no mês', BRL.format(-IR[i])) : '') +
            (i === 5 && state.view === 'mensal' ? ttNote('EBITDA de junho recalculado: a planilha original traz −1.394.826,97 por erro de fórmula.') : '');
        }
      },
      xAxis: { type: 'category', data: MONTHS, axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...AXIS_LABEL, color: C.ink2 } },
      yAxis: { type: 'value', splitNumber: 4, axisLabel: { ...AXIS_LABEL, formatter: axisMoney }, splitLine: { lineStyle: { color: C.line2 } } },
      series: [
        {
          name: 'Resultado', type: 'bar', barWidth: '46%',
          data: res.map((v, i) => ({
            value: v,
            itemStyle: { color: v >= 0 ? C.teal : C.orange, opacity: isActive(i) ? 1 : 0.25, borderRadius: v >= 0 ? [5, 5, 0, 0] : [0, 0, 5, 5] },
            // barras grandes levam o rótulo por dentro, para não brigar com a linha do EBITDA
            label: Math.abs(v) > maxAbs * 0.4
              ? { position: v >= 0 ? 'insideTop' : 'insideBottom', color: '#fff', distance: 6 }
              : { position: v >= 0 ? 'top' : 'bottom', color: C.ink }
          })),
          label: { show: true, formatter: p => (isActive(p.dataIndex) ? shortVal(p.value) : ''), fontFamily: FONT, fontSize: 12, fontWeight: 800 },
          animationDelay: i => i * 110
        },
        {
          name: 'EBITDA', type: 'line', data: eb, symbol: 'circle', symbolSize: 8,
          lineStyle: { color: C.ink, width: 2 },
          itemStyle: { color: C.surface, borderColor: C.ink, borderWidth: 2 },
          z: 3,
          animationDuration: 1600,
          animationDelay: 500
        }
      ]
    });
  }

  // ---------- Tela 2 · Faturamento ----------
  const TAX_HINT = {
    ISS: 'Imposto sobre serviços, municipal',
    PIS: 'Contribuição federal sobre o faturamento',
    COFINS: 'Contribuição federal sobre o faturamento',
    CPRB: 'Contribuição previdenciária sobre a receita bruta'
  };
  const TAXES = byCode['33'].children[0].accounts.map(a => ({ name: a.name.replace(/^\(-\)\s*/, '').trim(), values: neg(a.values) }));

  // compara o primeiro e o último mês do período; com um mês só, compara com o anterior
  function compareIdx() {
    const idx = periodIdx();
    if (idx.length > 1) return [idx[0], idx[idx.length - 1]];
    return idx[0] > 0 ? [idx[0] - 1, idx[0]] : null;
  }
  const fatChangeText = ch => (Math.abs(ch) < 0.03 ? 'ficou praticamente igual' : `${ch >= 0 ? 'subiu' : 'caiu'} ${pct(Math.abs(ch), 0)}`);

  function renderAnswers() {
    const idx = periodIdx();
    const fat = sumP(RB), imp = -sumP(IMP), gas = -sumP(GASTOS), res = sumP(RES);
    const cmp = compareIdx();
    const q = t => `<span class="q">${t}</span>`;

    let a;
    if (idx.length > 1) {
      const vals = idx.map(i => RB[i]);
      const avg = fat / idx.length;
      const hi = idx[vals.indexOf(Math.max(...vals))], lo = idx[vals.indexOf(Math.min(...vals))];
      const stable = (RB[hi] - RB[lo]) / avg < 0.2;
      a = `${stable ? 'Sim, o faturamento está estável' : 'O faturamento oscilou'}: média de <b>${money(avg)} por mês</b>, ` +
        `entre <b>${money(RB[lo])}</b> em ${MONTH_NAMES[lo]} e <b>${money(RB[hi])}</b> em ${MONTH_NAMES[hi]}.`;
    } else {
      const i = idx[0];
      a = `${periodPhrase()} a Mariuá faturou <b>${money(RB[i])}</b>` +
        (i > 0 ? `, ${pct(Math.abs(RB[i] - RB[i - 1]) / RB[i - 1])} ${RB[i] >= RB[i - 1] ? 'a mais' : 'a menos'} que em ${MONTH_NAMES[i - 1]}.` : '.');
    }
    a += ` Os impostos levam <b>${pct(imp / fat)}</b> do faturamento.`;
    document.getElementById('ansFat').innerHTML = q('Estamos vendendo bem?') + a;

    const margin = res / fat;
    const q3 = res < 0 ? 'Por que deu prejuízo?' : margin < 0.1 ? 'Por que sobrou pouco?' : 'Para onde vai o dinheiro?';
    const pessoal = sumP(CATS[0].values) / gas;
    let g;
    if (cmp) {
      const [x, y] = cmp;
      const g0 = -GASTOS[x], g1 = -GASTOS[y];
      const gch = (g1 - g0) / g0, fch = (RB[y] - RB[x]) / RB[x];
      g = `O gasto mensal ${gch >= 0 ? 'subiu' : 'caiu'} <b>${pct(Math.abs(gch), 0)}</b> de ${MONTHS[x]} para ${MONTHS[y]} ` +
        `(de ${money(g0)} para ${money(g1)}), enquanto o faturamento ${fatChangeText(fch)}.`;
    } else {
      g = `${periodPhrase()} a Mariuá gastou <b>${money(gas)}</b>, ${pct(gas / fat, 0)} do faturamento.`;
    }
    g += ` Pessoal é <b>${pct(pessoal, 0)}</b> de tudo o que gastamos.`;
    document.getElementById('ansGas').innerHTML = q(q3) + g;

    let r;
    if (cmp) {
      const [x, y] = cmp;
      r = `O EBITDA, que é o lucro da operação, ${EBITDA[y] < EBITDA[x] ? 'caiu' : 'subiu'} de <b>${money(EBITDA[x])}</b> em ${MONTHS[x]} ` +
        `para <b>${money(EBITDA[y])}</b> em ${MONTHS[y]}` +
        (EBITDA[y] < 0 ? `: <span class="alert">em ${MONTH_NAMES[y]} a operação não gerou caixa.</span>` : '.');
    } else {
      r = `${periodPhrase()} a Mariuá teve ${res >= 0 ? 'lucro' : 'prejuízo'} de <b>${money(Math.abs(res))}</b> e EBITDA de <b>${money(EBITDA[idx[0]])}</b>.`;
    }
    document.getElementById('ansRes').innerHTML = q('Para onde estamos indo?') + r;
  }

  function renderFat() {
    const c = chart('chFat');
    if (!c) return;
    const fat = shape(RB), idx = periodIdx();
    const avg = state.view === 'acumulado' ? null : sumP(RB) / idx.length;
    document.getElementById('fatSub').textContent = avg === null
      ? 'Receita bruta somada desde janeiro, em R$'
      : 'Receita bruta, em R$ · a linha tracejada é a média do período';
    c.setOption({
      ...ANIM,
      grid: { left: 8, right: avg === null ? 16 : 64, top: 30, bottom: 4, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(5,155,155,.06)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          return ttTitle(monthTitle(i)) + ttRow(C.teal, 'Faturou', BRL.format(fat[i]), true) +
            (avg !== null ? ttRow(null, 'Comparado à média', `${fat[i] >= avg ? '+' : '−'}${pct(Math.abs(fat[i] - avg) / avg)}`) : '') +
            (state.view === 'mensal' ? ttRow(C.orangeSoft, 'Impostos do mês', BRL.format(-IMP[i])) : '');
        }
      },
      xAxis: { type: 'category', data: MONTHS, axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...AXIS_LABEL, color: C.ink2, fontSize: 12.5 } },
      yAxis: { type: 'value', splitNumber: 4, axisLabel: { ...AXIS_LABEL, formatter: axisMoney }, splitLine: { lineStyle: { color: C.line2 } } },
      series: [{
        type: 'bar', barWidth: '52%',
        data: fat.map((v, i) => ({ value: v, itemStyle: { color: C.teal, opacity: isActive(i) ? 1 : 0.25, borderRadius: [6, 6, 0, 0] } })),
        label: { show: true, position: 'top', formatter: p => (isActive(p.dataIndex) ? short(p.value) : ''), color: C.ink, fontFamily: FONT, fontSize: 13, fontWeight: 800 },
        markLine: avg === null ? { data: [] } : {
          silent: true, symbol: 'none',
          lineStyle: { color: C.ink, type: [6, 4], width: 1.5 },
          label: { position: 'end', distance: 8, formatter: `Média
${short(avg)}`, color: C.ink, fontFamily: FONT, fontWeight: 800, fontSize: 12, lineHeight: 15 },
          data: [{ yAxis: avg }],
          animationDuration: 900
        },
        animationDelay: i => i * 110
      }]
    });
  }

  function renderStats() {
    const idx = periodIdx();
    const fat = sumP(RB), imp = -sumP(IMP);
    let rows;
    if (idx.length > 1) {
      const vals = idx.map(i => RB[i]);
      const hi = idx[vals.indexOf(Math.max(...vals))], lo = idx[vals.indexOf(Math.min(...vals))];
      rows = [
        ['Média por mês', fat / idx.length, `${idx.length} meses no período`],
        ['Melhor mês', RB[hi], cap(MONTH_NAMES[hi])],
        ['Mês mais fraco', RB[lo], cap(MONTH_NAMES[lo])],
        ['Impostos', imp, `${pct(imp / fat)} do faturamento`]
      ];
    } else {
      const i = idx[0];
      rows = [['Faturou no mês', RB[i], cap(MONTH_NAMES[i])]]
        .concat(i > 0 ? [['Mês anterior', RB[i - 1], cap(MONTH_NAMES[i - 1])]] : [])
        .concat([['Impostos', imp, `${pct(imp / fat)} do faturamento`]]);
    }
    const ul = document.getElementById('fatStats');
    ul.innerHTML = rows.map(r => `<li><span class="k">${r[0]}<small>${r[2]}</small></span><b class="v" data-to="${r[1]}">${money(r[1])}</b></li>`).join('');
    ul.querySelectorAll('.v').forEach((b, k) => {
      const to = Number(b.dataset.to), fmt = moneyLike(to);
      countTo(b, to, v => { b.textContent = fmt(v); }, { duration: 1300, delay: k * 120 });
    });
  }

  function renderTax() {
    const c = chart('chTax');
    if (!c) return;
    const fat = sumP(RB);
    const items = TAXES.map(t => ({ name: t.name, v: sumP(t.values) })).sort((a, b) => a.v - b.v);
    const tot = items.reduce((sum, it) => sum + it.v, 0);
    document.getElementById('taxSub').innerHTML = `${money(tot)} no período, ${pct(tot / fat)} de tudo o que foi faturado`;
    c.setOption({
      ...ANIM,
      grid: { left: 4, right: 104, top: 4, bottom: 2, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'item',
        formatter: p => {
          const it = items[p.dataIndex];
          return ttTitle(it.name) + ttRow(null, 'Pagou', BRL.format(it.v), true) + ttRow(null, 'Do faturamento', pct(it.v / fat, 2)) + ttNote(TAX_HINT[it.name] || '');
        }
      },
      xAxis: { type: 'value', show: false, max: v => v.max * 1.02 },
      yAxis: { type: 'category', data: items.map(it => it.name), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { ...AXIS_LABEL, color: C.ink, fontSize: 12.5, fontWeight: 700 } },
      series: [{
        type: 'bar', barWidth: '56%',
        data: items.map(it => ({ value: it.v, itemStyle: { color: C.orange, borderRadius: [0, 5, 5, 0] } })),
        showBackground: true,
        backgroundStyle: { color: C.line2, borderRadius: [0, 5, 5, 0] },
        label: {
          show: true, position: 'right', distance: 8,
          formatter: p => `{v|${short(p.value)}}  {p|${pct(p.value / fat)}}`,
          rich: {
            v: { color: C.ink, fontFamily: FONT, fontSize: 12.5, fontWeight: 800 },
            p: { color: C.ink3, fontFamily: FONT, fontSize: 12, fontWeight: 600 }
          }
        },
        animationDuration: 1200,
        animationDelay: i => (items.length - 1 - i) * 100
      }]
    });
  }

  // ---------- Tela 3 · Gastos: o que mais mudou ----------
  const SUBS = [];
  ['41', '51', '52', '53'].forEach(code => byCode[code].children.forEach(ch => SUBS.push({
    label: prettify(ch.name) + (code === '51' ? ' (operação)' : code === '52' ? ' (adm.)' : ''),
    values: neg(ch.values),
    accounts: ch.accounts.map(a => ({ name: prettify(a.name), values: neg(a.values) }))
  })));

  function renderGrowth() {
    const c = chart('chGrowth');
    if (!c) return;
    const cmp = compareIdx();
    const sub = document.getElementById('growthSub'), note = document.getElementById('growthNote');
    if (!cmp) {
      sub.textContent = 'Compara o gasto de um mês com o de outro';
      note.textContent = '';
      c.clear();
      c._empty = true;
      c.setOption({ graphic: { type: 'text', left: 'center', top: 'middle', style: { text: 'Escolha mais de um mês\npara comparar', fill: C.ink3, font: `600 14px ${FONT}`, textAlign: 'center', lineHeight: 20 } } });
      return;
    }
    if (c._empty) { c.clear(); c._empty = false; }
    const [x, y] = cmp;
    sub.textContent = `Gasto de ${MONTH_NAMES[x]} comparado ao de ${MONTH_NAMES[y]}, por grupo de contas`;
    const items = SUBS.map(sb => ({ sb, a: sb.values[x], b: sb.values[y], d: sb.values[y] - sb.values[x] }))
      .filter(it => Math.abs(it.d) >= 1e4)
      .sort((p, q) => Math.abs(q.d) - Math.abs(p.d))
      .slice(0, 7)
      .sort((p, q) => p.d - q.d);

    // lançamentos positivos (estornos) no mês-base distorcem a comparação: avisa
    const credits = SUBS.flatMap(sb => sb.accounts).filter(a => a.values[x] <= -1e5 && !/Recupera/i.test(a.name));
    note.innerHTML = credits.length
      ? `Atenção à base: em ${MONTH_NAMES[x]}, ${joinPT(credits.map(a => `<b>${a.name}</b> teve um lançamento positivo de ${money(-a.values[x])}`))} (provável estorno), o que deixa ${MONTH_NAMES[x]} mais baixo.`
      : '';

    const maxD = Math.max(0, ...items.map(it => it.d)), minD = Math.min(0, ...items.map(it => it.d));
    c.setOption({
      ...ANIM,
      grid: { left: 4, right: 12, top: 6, bottom: 2, containLabel: true },
      tooltip: {
        ...TOOLTIP, trigger: 'item',
        formatter: p => {
          const it = items[p.dataIndex];
          return ttTitle(it.sb.label) + ttRow(null, cap(MONTH_NAMES[x]), BRL.format(it.a)) + ttRow(null, cap(MONTH_NAMES[y]), BRL.format(it.b)) +
            ttRow(it.d >= 0 ? C.orange : C.teal, it.d >= 0 ? 'Subiu' : 'Caiu', BRL.format(Math.abs(it.d)), true);
        }
      },
      xAxis: { type: 'value', show: false, min: minD * 1.5, max: maxD * 1.3 },
      yAxis: {
        type: 'category', data: items.map(it => it.sb.label),
        axisTick: { show: false }, axisLine: { show: false, onZero: false },
        axisLabel: { ...AXIS_LABEL, color: C.ink, fontSize: 12, fontWeight: 700, width: 210, overflow: 'truncate' }
      },
      series: [{
        type: 'bar', barWidth: '56%',
        data: items.map(it => ({
          value: it.d,
          itemStyle: { color: it.d >= 0 ? C.orange : C.teal, borderRadius: it.d >= 0 ? [0, 5, 5, 0] : [5, 0, 0, 5] },
          label: { position: it.d >= 0 ? 'right' : 'left' }
        })),
        label: { show: true, distance: 6, formatter: p => `${p.value >= 0 ? '+' : '−'}${short(Math.abs(p.value))}`, color: C.ink, fontFamily: FONT, fontSize: 12, fontWeight: 800 },
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: C.ink3, type: 'solid', width: 1 }, data: [{ xAxis: 0 }], animation: false },
        animationDuration: 1200,
        animationDelay: i => (items.length - 1 - i) * 100
      }]
    }, { replaceMerge: ['series'] });
  }

  // ---------- Tela 4 · Pontos de atenção (sempre o semestre inteiro) ----------
  const ICON_ATT = {
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
  };
  function renderAttention() {
    const A = 0, B = N - 1, items = [];
    const g0 = -GASTOS[A], g1 = -GASTOS[B];
    const gch = (g1 - g0) / g0, fch = (RB[B] - RB[A]) / RB[A];
    if (gch - fch > 0.05) {
      items.push({ kind: 'alert', t: 'Os gastos sobem mais rápido que o faturamento',
        d: `De ${MONTH_NAMES[A]} a ${MONTH_NAMES[B]}, o gasto mensal subiu <b>${pct(gch, 0)}</b> (de ${money(g0)} para ${money(g1)}), e o faturamento ${fatChangeText(fch)}.` });
    }
    const totalG = -GASTOS.reduce((a, b) => a + b, 0);
    const pes = CATS[0].values.reduce((a, b) => a + b, 0) / totalG;
    const top = SUBS.map(sb => ({ sb, d: sb.values[B] - sb.values[A] })).sort((p, q) => q.d - p.d)[0];
    items.push({ kind: 'alert', t: `Pessoal é ${pct(pes, 0)} dos gastos`,
      d: `O que mais cresceu foi <b>${top.sb.label}</b>: de ${money(top.sb.values[A])} para ${money(top.sb.values[B])} por mês.` });

    const losses = MONTHS.map((m, i) => i).filter(i => RES[i] <= -1e5);
    if (losses.length) {
      const opSubs = SUBS.filter(sb => /\((operação|adm\.)\)$/.test(sb.label));
      const why = losses.map(i => {
        const parts = [];
        const spike = opSubs.map(sb => {
          const others = sb.values.filter((_, k) => k !== i);
          const avg = others.reduce((a, b) => a + b, 0) / others.length;
          return { sb, v: sb.values[i], avg, ex: sb.values[i] - avg };
        }).sort((p, q) => q.ex - p.ex)[0];
        if (spike.ex > 1e6) parts.push(`${spike.sb.label.toLowerCase()} de ${money(spike.v)} (média dos outros meses: ${money(spike.avg)})`);
        if (IR[i] <= -1e5) parts.push(`IR/CS de ${money(-IR[i])} lançado no mês`);
        return `<b>${MONTHS[i]}</b>: ${parts.length ? joinPT(parts) : 'gastos acima do faturamento'}.`;
      });
      items.push({ kind: 'info', t: `Por que ${joinPT(losses.map(i => MONTHS[i]))} ${losses.length > 1 ? 'fecharam' : 'fechou'} no prejuízo`, d: why.join(' ') });
    }

    const juros = byCode['61'].children.find(ch => /JUROS ATIVOS/.test(ch.name));
    if (juros) {
      const v = juros.values[B];
      const others = juros.values.slice(0, B);
      const avg = others.reduce((a, b) => a + b, 0) / others.length;
      if (v > 5e5 && v > avg * 5) {
        const without = RES[B] - v;
        items.push({ kind: 'info', t: `Receita pontual em ${MONTH_NAMES[B]}`,
          d: `Entraram <b>${money(v)}</b> de juros ativos (média dos outros meses: ${money(avg)}). ` +
            `Sem eles, ${MONTH_NAMES[B]} teria ${without < 0 ? `prejuízo de ${money(-without)}` : `lucro de ${money(without)}`}.` });
      }
    }
    if (RES[B] < 0) {
      items.push({ kind: 'alert', t: 'Se nada mudar',
        d: `Repetindo o resultado de ${MONTH_NAMES[B]} por 6 meses, o 2º semestre fecharia com prejuízo de cerca de <b>${money(-RES[B] * 6)}</b>. <span class="muted">Projeção simples, só para dar a dimensão.</span>` });
    }
    document.getElementById('attention').innerHTML = items.map((it, k) =>
      `<li class="${it.kind}" style="--k:${k}"><span class="ic">${ICON_ATT[it.kind]}</span><div><strong>${it.t}</strong><p>${it.d}</p></div></li>`).join('');
  }

  // ---------- Painel único × apresentação em 4 telas ----------
  const appEl = document.getElementById('app');
  const viewPainel = document.getElementById('viewPainel'), viewDeck = document.getElementById('viewDeck');
  const slides = [...document.querySelectorAll('.slide')];
  const deckTabs = [...document.querySelectorAll('#deckTabs [data-slide]')];
  const PARTS = [...document.querySelectorAll('[data-part]')];

  // as mesmas peças (frase, números e gráficos) mudam de lugar entre os dois modos
  function placeParts() {
    const prefix = state.mode === 'apresentacao' ? 'deck' : 'painel';
    PARTS.forEach(el => document.querySelector(`[data-slot="${prefix}-${el.dataset.part}"]`).appendChild(el));
  }
  // limpa o gráfico antes de desenhar, para as barras crescerem de novo
  function replay(id, fn) {
    if (charts[id]) charts[id].clear();
    fn();
  }
  function resetKpis() { document.querySelectorAll('#kpis .num').forEach(n => { n.dataset.v = 0; }); }
  const SLIDE_RENDER = [
    [renderHeadline, () => { resetKpis(); renderKpis(); }, () => replay('chWaterfall', renderWaterfall)],
    [renderAnswers, renderStats, () => replay('chFat', renderFat), () => replay('chTax', renderTax)],
    [renderAnswers, () => replay('chFlow', renderFlow), () => replay('chGrowth', renderGrowth), () => replay('chSpend', renderSpend)],
    [renderAnswers, renderAttention, () => replay('chProfit', renderProfit)]
  ];

  function renderDeck() {
    slides.forEach((sl, i) => {
      sl.classList.toggle('is-active', i === state.slide);
      sl.classList.toggle('is-before', i < state.slide);
      sl.inert = i !== state.slide;
    });
    deckTabs.forEach((t, i) => t.setAttribute('aria-selected', i === state.slide));
    document.getElementById('deckCount').textContent = `${state.slide + 1} de ${slides.length}`;
    document.getElementById('prevSlide').disabled = state.slide === 0;
    document.getElementById('nextSlide').disabled = state.slide === slides.length - 1;
  }
  function goSlide(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === state.slide) return;
    state.slide = n;
    renderDeck();
    syncUrl();
    setTimeout(() => SLIDE_RENDER[n].forEach(fn => fn()), MOTION ? 160 : 0);
  }
  function applyMode() {
    const deck = state.mode === 'apresentacao';
    appEl.classList.toggle('is-deck', deck);
    viewPainel.hidden = deck;
    viewDeck.hidden = !deck;
    placeParts();
    renderDeck();
  }
  function setMode(mode) {
    if (mode === state.mode) return;
    state.mode = mode;
    applyMode();
    syncUrl();
    requestAnimationFrame(() => {
      resizeAll();
      if (state.mode === 'apresentacao') SLIDE_RENDER[state.slide].forEach(fn => fn());
      else {
        renderHeadline();
        resetKpis();
        renderKpis();
        [['chWaterfall', renderWaterfall], ['chFlow', renderFlow], ['chSpend', renderSpend], ['chProfit', renderProfit]]
          .forEach(([id, fn], k) => setTimeout(() => replay(id, fn), MOTION ? k * 140 : 0));
      }
    });
  }

  // guarda filtros, modo e tela no endereço: recarregar a página volta para o mesmo ponto
  function syncUrl() {
    const q = new URLSearchParams();
    const idx = selIdx();
    if (idx.length !== N) q.set('meses', idx.map(i => MONTHS[i]).join(','));
    if (state.view === 'acumulado') q.set('visao', 'acumulado');
    if (state.mode === 'apresentacao') { q.set('modo', 'apresentacao'); q.set('tela', state.slide + 1); }
    if (!MOTION) q.set('animacao', 'off');
    const qs = q.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '')); } catch (e) { /* alguns navegadores bloqueiam em file:// */ }
  }

  document.getElementById('toDeck').addEventListener('click', () => setMode('apresentacao'));
  document.getElementById('toPainel').addEventListener('click', () => setMode('painel'));
  document.getElementById('prevSlide').addEventListener('click', () => goSlide(state.slide - 1));
  document.getElementById('nextSlide').addEventListener('click', () => goSlide(state.slide + 1));
  deckTabs.forEach((t, i) => t.addEventListener('click', () => goSlide(i)));
  window.addEventListener('keydown', e => {
    if (state.mode !== 'apresentacao' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goSlide(state.slide + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goSlide(state.slide - 1); }
    else if (e.key === 'Home') goSlide(0);
    else if (e.key === 'End') goSlide(slides.length - 1);
    else if (e.key === 'Escape') setMode('painel');
  });

  // ---------- Ciclo ----------
  function update() {
    renderFilters();
    renderHeadline();
    renderKpis();
    renderAnswers();
    renderStats();
    renderAttention();
    const chartsInOrder = [renderWaterfall, renderFlow, renderSpend, renderProfit, renderFat, renderTax, renderGrowth];
    if (firstRun && MOTION) chartsInOrder.forEach((fn, k) => setTimeout(fn, 450 + k * 220));
    else chartsInOrder.forEach(fn => fn());
    syncUrl();
    firstRun = false;
  }

  document.querySelectorAll('.card').forEach((el, i) => {
    el.classList.add('reveal');
    el.style.setProperty('--i', i + 8);
  });
  document.querySelector('[data-part="headline"]').classList.add('reveal');

  const resizeAll = () => Object.values(charts).forEach(c => c.resize());
  const ro = new ResizeObserver(resizeAll);
  document.querySelectorAll('.chart').forEach(el => ro.observe(el));
  window.addEventListener('load', resizeAll);

  // endereço: ?meses=JAN-MAR (ou JAN,ABR) &visao=acumulado &modo=apresentacao &tela=3
  const params = new URLSearchParams(location.search);
  const mParam = (params.get('meses') || '').toUpperCase();
  if (mParam) {
    const pick = new Set();
    mParam.split(',').forEach(part => {
      const [a, b] = part.split('-').map(x => MONTHS.indexOf(x.trim()));
      if (a < 0) return;
      const hi = b >= 0 ? b : a;
      for (let i = Math.min(a, hi); i <= Math.max(a, hi); i++) pick.add(i);
    });
    if (pick.size) { state.selected = pick; anchor = Math.min(...pick); }
  }
  if (params.get('visao') === 'acumulado') state.view = 'acumulado';
  if (params.get('modo') === 'apresentacao') state.mode = 'apresentacao';
  const tela = parseInt(params.get('tela'), 10);
  if (tela >= 1 && tela <= slides.length) state.slide = tela - 1;
  applyMode();

  // espera a fonte para os rótulos dos gráficos já saírem com a Manrope
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { resizeAll(); update(); });
})();
