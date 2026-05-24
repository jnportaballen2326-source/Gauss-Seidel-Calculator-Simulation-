/* ── Gauss-Seidel Calculator JS ─────────────────── */

// ── Tab Navigation ──────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── State ────────────────────────────────────────────
let currentN = 3;

// ── Build grid inputs ────────────────────────────────
function buildGrid(n) {
  currentN = n;
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.n) === n);
  });

  const grid = document.getElementById('matrix-grid');
  grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  grid.innerHTML = '';
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.step = 'any';
      inp.value = i === j ? '1' : '0';
      inp.setAttribute('aria-label', `A[${i+1}][${j+1}]`);
      grid.appendChild(inp);
    }
  }

  const vecB = document.getElementById('vector-b');
  vecB.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.value = '0';
    inp.setAttribute('aria-label', `b[${i+1}]`);
    vecB.appendChild(inp);
  }

  const vecX0 = document.getElementById('vector-x0');
  vecX0.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.step = 'any'; inp.value = '0';
    inp.setAttribute('aria-label', `x0[${i+1}]`);
    vecX0.appendChild(inp);
  }
}

document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => { buildGrid(parseInt(btn.dataset.n)); hideResults(); });
});

// ── Presets ──────────────────────────────────────────
const PRESETS = {
  handwritten: {
    n: 3,
    A: [[12,3,-5],[1,5,3],[3,7,13]],
    b: [1, 28, 76],
    x0: [1, 0, 1]
  },
  ex2: {
    n: 4,
    A: [[4,-1,0,-1],[-1,4,-1,0],[0,-1,4,-1],[-1,0,-1,4]],
    b: [100, 200, 200, 100],
    x0: [0, 0, 0, 0]
  },
  simple: {
    n: 2,
    A: [[4,1],[2,3]],
    b: [9, 8],
    x0: [0, 0]
  }
};

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    buildGrid(p.n);
    const gridInputs = document.querySelectorAll('#matrix-grid input');
    let idx = 0;
    for (let i = 0; i < p.n; i++)
      for (let j = 0; j < p.n; j++)
        gridInputs[idx++].value = p.A[i][j];
    document.querySelectorAll('#vector-b input').forEach((inp, i) => inp.value = p.b[i]);
    document.querySelectorAll('#vector-x0 input').forEach((inp, i) => inp.value = p.x0[i]);
    hideResults();
  });
});

function getMatrixText() {
  return Array.from(document.querySelectorAll('#matrix-grid input')).map(i => i.value).join(' ');
}
function getVectorText(id) {
  return Array.from(document.querySelectorAll(`#${id} input`)).map(i => i.value).join(' ');
}

// ── Solve ─────────────────────────────────────────────
document.getElementById('solve-btn').addEventListener('click', async () => {
  const btn = document.getElementById('solve-btn');
  btn.disabled = true; btn.textContent = 'Solving…';
  hideResults(); hideError();

  const payload = {
    n: currentN,
    A: getMatrixText(),
    b: getVectorText('vector-b'),
    x0: getVectorText('vector-x0'),
    tol: document.getElementById('tol-input').value,
    max_iter: parseInt(document.getElementById('maxiter-input').value)
  };

  try {
    const resp = await fetch('/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || data.error) showError(data.error || 'Unknown error.');
    else renderResults(data);
  } catch (e) {
    showError('Network error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Solve';
  }
});

// ── Format helpers ────────────────────────────────────
function f(v, dec=4) {
  if (typeof v !== 'number') return v;
  if (Math.abs(v) < 1e-10) return '0';
  return parseFloat(v.toFixed(dec)).toString();
}
function fErr(v) { return v.toFixed(4) + '%'; }
function sign(v) { return v >= 0 ? '+' : ''; }

// ── Main render ───────────────────────────────────────
function renderResults(data) {
  const area = document.getElementById('results-area');

  // 1. Diagonal dominance check
  renderDomCheck(data.dom_check);

  // 2. Rearranged formulas
  renderFormulas(data.formulas, data.iterations[0]?.row_details, data);

  // 3. Iteration summary table
  renderSummaryTable(data);

  // 4. Detailed iterations
  renderIterDetails(data.iterations);

  // 5. Final solution
  renderSolution(data);

  area.classList.remove('hidden');
  if (window.MathJax) MathJax.typesetPromise();
}

// ── 1. Diagonal dominance ─────────────────────────────
function renderDomCheck(checks) {
  const el = document.getElementById('dom-check');
  let html = '<div class="step-label">Step 1 — Check if Diagonally Dominant</div>';
  let allDom = checks.every(c => c.dominant);
  checks.forEach(c => {
    const ok = c.dominant;
    html += `<div class="dom-row ${ok ? 'dom-ok' : 'dom-warn'}">
      Row ${c.row}: |${f(c.diag)}| ${ok ? '>' : '≤'} ${f(c.off_sum)}
      <span class="dom-badge">${ok ? '✓ dominant' : '✗ not dominant'}</span>
    </div>`;
  });
  html += `<div class="dom-conclusion ${allDom ? 'dom-ok' : 'dom-warn'}">
    ${allDom ? '✓ Matrix is diagonally dominant — convergence guaranteed.' : '⚠ Matrix may not converge. Results are still computed.'}
  </div>`;
  el.innerHTML = html;
}

// ── 2. Rearranged formulas ────────────────────────────
function renderFormulas(formulas, firstRowDetails, data) {
  const el = document.getElementById('formula-display');
  let html = '<div class="step-label">Step 2 — Rearrange Equations</div>';

  formulas.forEach(f_ => {
    let expr = `(${f(f_.b_i)}`;
    f_.terms.forEach(t => {
      const c = -t.a_ij;
      html += '';  // built below
    });

    // Build formula line
    let rhs = `(${f(f_.b_i)}`;
    f_.terms.forEach(t => {
      const c = t.a_ij;
      rhs += ` ${c >= 0 ? '−' : '+'} ${f(Math.abs(c))}x<sub>${t.var}</sub>`;
    });
    rhs += `) / ${f(f_.a_ii)}`;

    html += `<div class="formula-line">
      x<sub>${f_.var}</sub> = ${rhs}
    </div>`;
  });

  el.innerHTML = html;
}

// ── 3. Summary table ─────────────────────────────────
function renderSummaryTable(data) {
  const el = document.getElementById('summary-table');
  const n = data.solution.length;
  let html = '<div class="step-label">Iteration Summary Table</div>';
  html += '<div class="iter-table-wrap"><table class="iter-table"><thead><tr><th>Iter</th>';
  for (let i = 0; i < n; i++) {
    html += `<th>x<sub>${i+1}</sub></th><th>ε<sub>${i+1}</sub> (%)</th>`;
  }
  html += '</tr></thead><tbody>';

  // Row 0 = initial guess
  const x0 = data.iterations[0].x_old;
  html += '<tr class="guess-row"><td>0 (guess)</td>';
  x0.forEach(v => { html += `<td>${f(v)}</td><td>—</td>`; });
  html += '</tr>';

  data.iterations.forEach(it => {
    const isFinal = it.k === data.num_iterations || it.max_err_pct < (data.tol || Infinity);
    html += `<tr${isFinal ? ' class="sol-row"' : ''}>`;
    html += `<td>${it.k}</td>`;
    it.row_details.forEach(r => {
      html += `<td>${f(r.x_new)}</td><td>${fErr(r.rel_err_pct)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

// ── 4. Detailed iterations ────────────────────────────
function renderIterDetails(iterations) {
  const el = document.getElementById('iter-details');
  el.innerHTML = '';
  const maxShow = Math.min(iterations.length, 10);

  for (let k = 0; k < maxShow; k++) {
    const it = iterations[k];
    const card = document.createElement('div');
    card.className = 'iter-card';

    let html = `<div class="iter-card-title">Iteration ${it.k}</div>`;

    // Each variable
    it.row_details.forEach(r => {
      // Build substitution line
      let sub = `(${f(r.b_i)}`;
      r.sub_terms.forEach(t => {
        const coeff = t.coeff;
        sub += ` ${coeff >= 0 ? '−' : '+'} ${f(Math.abs(coeff))}(${f(t.value, 4)})`;
      });
      sub += `) / ${f(r.a_ii)}`;

      // Numerator computed
      let numLine = `(${f(r.b_i)} − (${f(r.sigma, 4)})) / ${f(r.a_ii)}`;

      html += `
        <div class="var-block">
          <div class="var-title">x<sub>${r.var}</sub></div>
          <div class="var-formula">= ${sub}</div>
          <div class="var-formula dimmed">= ${numLine}</div>
          <div class="var-result">= <span class="var-value">${f(r.x_new, 4)}</span></div>
          <div class="var-error">
            ε<sub>${r.var}</sub> = |( ${f(r.x_new,4)} − ${f(r.x_old,4)} ) / ${f(r.x_new,4)}| × 100
            = <span class="err-value">${fErr(r.rel_err_pct)}</span>
          </div>
        </div>`;
    });

    card.innerHTML = html;
    el.appendChild(card);
  }

  if (iterations.length > maxShow) {
    const note = document.createElement('div');
    note.className = 'more-note';
    note.textContent = `… ${iterations.length - maxShow} more iterations (see table above for all values)`;
    el.appendChild(note);
  }
}

// ── 5. Final solution ─────────────────────────────────
function renderSolution(data) {
  const el = document.getElementById('final-solution');
  const converged = data.converged;
  let html = `<div class="solution-box ${converged ? 'sol-ok' : 'sol-warn'}">`;
  html += `<div class="sol-title">${converged ? '✓ Converged' : '⚠ Max iterations reached'} after ${data.num_iterations} iteration(s)</div>`;
  html += '<div class="sol-values">';
  data.solution.forEach((v, i) => {
    html += `<div class="sol-item">x<sub>${i+1}</sub> = <strong>${f(v, 6)}</strong></div>`;
  });
  html += '</div></div>';
  el.innerHTML = html;
}

// ── Helpers ───────────────────────────────────────────
function hideResults() { document.getElementById('results-area').classList.add('hidden'); }
function hideError()   { document.getElementById('error-area').classList.add('hidden'); }
function showError(msg) {
  const el = document.getElementById('error-area');
  el.textContent = msg; el.classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────
buildGrid(3);
// Load the handwritten example by default
const p = PRESETS['handwritten'];
buildGrid(p.n);
const gi = document.querySelectorAll('#matrix-grid input');
let idx = 0;
for (let i = 0; i < p.n; i++) for (let j = 0; j < p.n; j++) gi[idx++].value = p.A[i][j];
document.querySelectorAll('#vector-b input').forEach((inp, i) => inp.value = p.b[i]);
document.querySelectorAll('#vector-x0 input').forEach((inp, i) => inp.value = p.x0[i]);
