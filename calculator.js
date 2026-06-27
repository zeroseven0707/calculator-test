/**
 * calculator.js — UI Controller
 * Manages form state, builds CLTLayupType, calls calculation methods,
 * and renders results into the redesigned DOM.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let currentMethod = 'ShearAnalogy';
let currentLayers = 5;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateLayerOptions();
    renderLayerInputs();

    // Layer count change
    document.getElementById('layer-count').addEventListener('change', e => {
        currentLayers = parseInt(e.target.value, 10);
        renderLayerInputs();
        hideOutputs();
        clearError();
    });

    // Default thickness applies to all layer rows
    document.getElementById('default-thickness').addEventListener('input', () => {
        const t = parseFloat(document.getElementById('default-thickness').value) || 35;
        document.querySelectorAll('.layer-thickness').forEach(el => { el.value = t; });
        updatePreview();
    });
});

// ── Method switch ─────────────────────────────────────────────────────────────
function selectMethod(method) {
    currentMethod = method;
    const isGamma = method === 'Gamma';

    document.getElementById('note-symmetric').classList.toggle('hidden', isGamma);
    document.getElementById('note-gamma').classList.toggle('hidden', !isGamma);

    const lg = document.getElementById('lref-group');
    lg.style.opacity       = isGamma ? '1'    : '0.4';
    lg.style.pointerEvents = isGamma ? 'auto' : 'none';

    updateLayerOptions();
    renderLayerInputs();
    hideOutputs();
    clearError();
}

// ── Layer count dropdown ──────────────────────────────────────────────────────
function updateLayerOptions() {
    const sel  = document.getElementById('layer-count');
    const opts = currentMethod === 'ShearAnalogy' ? [3, 5, 7, 9] : [3, 5];
    if (!opts.includes(currentLayers)) currentLayers = opts[0];
    sel.innerHTML = opts.map(n =>
        `<option value="${n}"${n === currentLayers ? ' selected' : ''}>${n} Layer</option>`
    ).join('');
}

// ── Render layer input rows ───────────────────────────────────────────────────
function renderLayerInputs() {
    const tbody    = document.getElementById('layer-inputs');
    const defThick = parseFloat(document.getElementById('default-thickness').value) || 35;
    tbody.innerHTML = '';

    for (let i = 1; i <= currentLayers; i++) {
        const isGamma = currentMethod === 'Gamma';
        const isPerp  = isGamma && (i % 2 === 0);
        const defAng  = isPerp ? 90 : (i % 2 !== 0 ? 0 : 90);

        const tr = document.createElement('tr');
        if (isPerp) tr.classList.add('perp-row');

        tr.innerHTML = `
            <td><span class="layer-idx">${i}</span></td>
            <td>
                <input type="number" class="mini-control layer-thickness"
                       value="${defThick}" min="1" step="1"
                       oninput="updatePreview()">
            </td>
            <td>
                <select class="mini-control layer-orientation"
                        ${isPerp ? 'disabled' : ''}
                        onchange="updatePreview()">
                    <option value="0"  ${defAng === 0  ? 'selected' : ''}>0°  ∥</option>
                    <option value="90" ${defAng === 90 ? 'selected' : ''}>90° ⊥</option>
                </select>
            </td>`;

        tbody.appendChild(tr);
    }

    updatePreview();
}

// ── Live layup preview ────────────────────────────────────────────────────────
function updatePreview() {
    const wrap    = document.getElementById('layup-preview');
    const thickEls  = document.querySelectorAll('.layer-thickness');
    const orientEls = document.querySelectorAll('.layer-orientation');
    if (!thickEls.length) { wrap.innerHTML = ''; return; }

    let total = 0;
    thickEls.forEach(el => { total += parseFloat(el.value) || 35; });
    const MAX_H = 160;

    wrap.innerHTML = '';
    thickEls.forEach((el, i) => {
        const t   = parseFloat(el.value) || 35;
        const ori = parseInt(orientEls[i].value);
        const h   = Math.max(20, (t / total) * MAX_H);
        const cls = ori === 0 ? 'par' : 'perp';
        const lbl = ori === 0 ? `Layer ${i + 1}  —  0°  ∥` : `Layer ${i + 1}  —  90°  ⊥`;

        const bar = document.createElement('div');
        bar.className    = `preview-bar ${cls}`;
        bar.style.height = `${h}px`;
        bar.innerHTML    = `<span>${lbl}</span><span class="pb-mm">${t} mm</span>`;
        wrap.appendChild(bar);
    });
}

// ── Build CLTLayupType from form ──────────────────────────────────────────────
function buildLayupFromForm() {
    const beff     = parseFloat(document.getElementById('beff').value)  || 1000;
    const LrefM    = parseFloat(document.getElementById('lref').value)  || 5;
    const material = MATERIAL_GRADES[document.getElementById('grade').value];
    const layup    = new CLTLayupType(`CLT ${currentLayers}-Layer`, beff, LrefM * 1000);

    const thickEls  = document.querySelectorAll('.layer-thickness');
    const orientEls = document.querySelectorAll('.layer-orientation');

    for (let i = 0; i < currentLayers; i++) {
        layup.addLayer(new CLTLayerType(
            parseFloat(thickEls[i].value),
            parseInt(orientEls[i].value, 10),
            material
        ));
    }
    return layup;
}

// ── Run calculation ───────────────────────────────────────────────────────────
function runCalculation() {
    clearError();
    hideOutputs();

    let layup, result;
    try { layup = buildLayupFromForm(); }
    catch (e) { showError(e.message); return; }

    try {
        const calc = currentMethod === 'ShearAnalogy'
            ? new ShearAnalogyMethod()
            : new GammaMethod();
        result = calc.calculate(layup);
    }
    catch (e) { showError(e.message); return; }

    document.getElementById('output-placeholder').style.display = 'none';

    if (currentMethod === 'ShearAnalogy') {
        renderShearAnalogy(layup, result);
        document.getElementById('output-shear').style.display = '';
    } else {
        renderGamma(layup, result);
        document.getElementById('output-gamma').style.display = '';
    }
}

// ── Render: Shear Analogy ─────────────────────────────────────────────────────
function renderShearAnalogy(layup, result) {
    const n      = layup.getLayerCount();
    const totalT = layup.getTotalThickness();
    const sym    = layup.isSymmetric();
    const EI     = result.EIeff;
    const EIpm   = EI / layup.beff * 1000;   // per 1 m width

    // ── Hero banner ──────────────────────────────────────────────────────────
    document.getElementById('sa-hero').innerHTML = `
        <div class="rh-main">
            <div class="rh-label">EI<sub>eff</sub> — Effective Bending Stiffness</div>
            <div class="rh-value">${fmtSci(EI)}</div>
            <div class="rh-unit">N·mm² / m width</div>
        </div>
        <div class="rh-meta">
            <div class="rh-meta-tag">Shear Analogy</div>
            <div class="rh-meta-tag">${n} Layer</div>
            <div class="rh-meta-tag">proHolz §4.1.3</div>
        </div>`;

    // ── KPI row ───────────────────────────────────────────────────────────────
    document.getElementById('sa-kpi').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Total Tebal</div>
            <div class="kpi-value">${totalT}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">${n} layer</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">b<sub>eff</sub></div>
            <div class="kpi-value">${layup.beff}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">effective width</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">EI per 1 m lebar</div>
            <div class="kpi-value" style="font-size:15px;">${fmtSci(EIpm)}</div>
            <div class="kpi-sub">N·mm²/m</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Simetris</div>
            <div class="kpi-value ${sym ? 'green' : 'red'}">${sym ? '✓ Ya' : '✗ Tidak'}</div>
            <div class="kpi-sub">${sym ? 'layup valid' : 'periksa layup'}</div>
        </div>`;

    // ── Detail table ──────────────────────────────────────────────────────────
    const tbody = document.getElementById('sa-tbody');
    tbody.innerHTML = '';

    result.layers.forEach(lp => {
        const active = lp.Exx > 0;
        const tr = document.createElement('tr');
        tr.className = active ? '' : 'row-inactive';
        tr.innerHTML = `
            <td>Layer ${lp.index}</td>
            <td>${lp.ti}</td>
            <td style="text-align:center;">
                <span class="${lp.angle === 0 ? 'chip-par' : 'chip-perp'}">${lp.angle}°</span>
            </td>
            <td>${active ? lp.Exx : '—'}</td>
            <td>${fmt(lp.yi)}</td>
            <td>${fmt(lp.hi)}</td>
            <td>${lp.Gi}</td>
            <td>${fmtSci(lp.beffTi3)}</td>
            <td>${fmtSci(lp.beffTiHi2)}</td>
            <td style="font-weight:600;color:${active ? 'var(--ink)' : ''}">
                ${active ? fmtSci(lp.EiIi) : '—'}
            </td>`;
        tbody.appendChild(tr);
    });

    // Total row
    const trTot = document.createElement('tr');
    trTot.className = 'row-total';
    trTot.innerHTML = `
        <td colspan="9" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;">
            Σ E<sub>i</sub>I<sub>i</sub> = EI<sub>eff</sub>
        </td>
        <td>${fmtSci(EI)}</td>`;
    tbody.appendChild(trTot);
}

// ── Render: Gamma Method ──────────────────────────────────────────────────────
function renderGamma(layup, result) {
    const n      = layup.getLayerCount();
    const totalT = layup.getTotalThickness();
    const EI     = result.EIeff;
    const EIpm   = EI / layup.beff * 1000;

    // ── Hero banner ───────────────────────────────────────────────────────────
    document.getElementById('gm-hero').innerHTML = `
        <div class="rh-main">
            <div class="rh-label">EI<sub>eff,γ</sub> — Effective Bending Stiffness (Gamma)</div>
            <div class="rh-value">${fmtSci(EI)}</div>
            <div class="rh-unit">N·mm² / m width</div>
        </div>
        <div class="rh-meta">
            <div class="rh-meta-tag">Gamma (γ)</div>
            <div class="rh-meta-tag">${n} Layer</div>
            <div class="rh-meta-tag">proHolz §4.2</div>
        </div>`;

    // ── KPI row ───────────────────────────────────────────────────────────────
    document.getElementById('gm-kpi').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Total Tebal</div>
            <div class="kpi-value">${totalT}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">${n} layer</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">b<sub>eff</sub></div>
            <div class="kpi-value">${layup.beff}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">effective width</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">EI per 1 m lebar</div>
            <div class="kpi-value" style="font-size:15px;">${fmtSci(EIpm)}</div>
            <div class="kpi-sub">N·mm²/m</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Centroid dari dasar</div>
            <div class="kpi-value" style="font-size:15px;">${fmt(result.centroid, 2)}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">titik netral efektif</div>
        </div>`;

    // ── Gamma coefficient cards ───────────────────────────────────────────────
    const ggrid = document.getElementById('gm-gamma-grid');
    ggrid.innerHTML = '';
    if (result.gammaValues) {
        let k = 0;
        result.layers.forEach((lp, i) => {
            if (lp.Exx > 0) {
                const g = result.gammaValues[k++];
                ggrid.innerHTML += `
                    <div class="gamma-card">
                        <div class="gc-top">γ — Layer ${i + 1} (0°)</div>
                        <div class="gc-val">${fmt(g, 6)}</div>
                    </div>`;
            }
        });
    }

    // ── Detail table ──────────────────────────────────────────────────────────
    const tbody = document.getElementById('gm-tbody');
    tbody.innerHTML = '';
    let k = 0;

    result.layers.forEach((lp, i) => {
        const active = lp.Exx > 0;
        const gi = active ? result.gammaValues[k]  : null;
        const ai = active ? result.aiValues[k]     : null;
        if (active) k++;

        const tr = document.createElement('tr');
        tr.className = active ? '' : 'row-inactive';
        tr.innerHTML = `
            <td>
                Layer ${lp.index}
                ${active ? '<span class="chip-eff">eff</span>' : ''}
            </td>
            <td>${lp.ti}</td>
            <td style="text-align:center;">
                <span class="${lp.angle === 0 ? 'chip-par' : 'chip-perp'}">${lp.angle}°</span>
            </td>
            <td>${active ? lp.Exx : '—'}</td>
            <td>${active ? fmt(ai, 3) : '—'}</td>
            <td>${active ? fmt(gi, 4) : '—'}</td>
            <td>${lp.Gi}</td>
            <td>${active ? fmtSci(lp.beffTi3)   : '—'}</td>
            <td>${active ? fmtSci(lp.beffTiHi2) : '—'}</td>
            <td style="font-weight:600;">
                ${active ? fmtSci(lp.EiIi) : '—'}
            </td>`;
        tbody.appendChild(tr);
    });

    // Total row
    const trTot = document.createElement('tr');
    trTot.className = 'row-total';
    trTot.innerHTML = `
        <td colspan="9" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;">
            Σ γ<sub>i</sub>·E<sub>i</sub>·I<sub>i,eff</sub> = EI<sub>eff,γ</sub>
        </td>
        <td>${fmtSci(EI)}</td>`;
    tbody.appendChild(trTot);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(val, digits = 3) {
    if (val == null || isNaN(val)) return '—';
    return val.toFixed(digits);
}

function fmtSci(val, digits = 3) {
    if (val == null || isNaN(val)) return '—';
    const abs = Math.abs(val);
    if (abs >= 1e9 || (abs > 0 && abs < 1e-2)) return val.toExponential(digits);
    return val.toFixed(digits);
}

function showError(msg) {
    const el = document.getElementById('calc-error');
    el.classList.remove('hidden');
    document.getElementById('calc-error-msg').textContent = msg;
}

function clearError() {
    document.getElementById('calc-error').classList.add('hidden');
}

function hideOutputs() {
    document.getElementById('output-shear').style.display       = 'none';
    document.getElementById('output-gamma').style.display       = 'none';
    document.getElementById('output-placeholder').style.display = '';
}
