/**
 * calculator.js — UI Controller
 * Manages form state, builds CLTLayupType, calls calculation methods,
 * and renders results into the redesigned DOM.
 *
 * Features:
 *  - Per-layer material selection
 *  - Layup presets
 *  - Deflection check (mid-span, UDL)
 *  - Comparison Mode (SA vs Gamma side-by-side, 3 & 5 layer only)
 *  - CSV export
 *  - Alternating-orientation warning
 */

// ── State ─────────────────────────────────────────────────────────────────────
let currentMethod = 'ShearAnalogy';
let currentLayers = 5;
let comparisonMode = false;

// ── Layup Presets ─────────────────────────────────────────────────────────────
const PRESETS = {
    '3L-35':    { n: 3, thicknesses: [35, 35, 35],          label: '3L-35/35/35' },
    '5L-35':    { n: 5, thicknesses: [35, 35, 35, 35, 35],  label: '5L-35/35/35/35/35' },
    '5L-40-20': { n: 5, thicknesses: [40, 20, 40, 20, 40],  label: '5L-40/20/40/20/40' },
    '5L-35-20': { n: 5, thicknesses: [35, 20, 35, 20, 35],  label: '5L-35/20/35/20/35' },
    '7L-35':    { n: 7, thicknesses: [35,35,35,35,35,35,35], label: '7L-35 (semua)' },
    '9L-35':    { n: 9, thicknesses: [35,35,35,35,35,35,35,35,35], label: '9L-35 (semua)' },
};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    updateLayerOptions();
    renderLayerInputs();

    document.getElementById('layer-count').addEventListener('change', e => {
        currentLayers = parseInt(e.target.value, 10);
        renderLayerInputs();
        hideOutputs();
        clearError();
    });

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

    // comparison mode only available for SA or Gamma with 3/5 layers
    syncComparisonAvailability();
    updateLayerOptions();
    renderLayerInputs();
    hideOutputs();
    clearError();
}

// ── Comparison Mode ───────────────────────────────────────────────────────────
function toggleComparison() {
    comparisonMode = !comparisonMode;
    const btn = document.getElementById('btn-compare');
    btn.classList.toggle('active', comparisonMode);
    btn.textContent = comparisonMode ? '⚖ Mode: Banding (aktif)' : '⚖ Bandingkan SA vs γ';
    syncComparisonAvailability();
    hideOutputs();
    clearError();
}

function syncComparisonAvailability() {
    const canCompare = (currentLayers === 3 || currentLayers === 5);
    const btn = document.getElementById('btn-compare');
    if (!canCompare) {
        comparisonMode = false;
        btn.classList.remove('active');
        btn.textContent = '⚖ Bandingkan SA vs γ';
    }
    btn.disabled = !canCompare;
    btn.title    = canCompare ? '' : 'Hanya tersedia untuk 3 atau 5 layer';
}

// ── Preset loader ─────────────────────────────────────────────────────────────
function loadPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;

    // switch layer count
    currentLayers = preset.n;
    if (currentMethod === 'Gamma' && preset.n > 5) {
        currentMethod = 'ShearAnalogy';
        document.querySelector('input[value="ShearAnalogy"]').checked = true;
        selectMethod('ShearAnalogy');
    }
    updateLayerOptions();
    renderLayerInputs();

    // fill thicknesses
    const thickEls = document.querySelectorAll('.layer-thickness');
    preset.thicknesses.forEach((t, i) => { if (thickEls[i]) thickEls[i].value = t; });
    updatePreview();
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

// ── Build grade options HTML ──────────────────────────────────────────────────
function gradeOptions(selected = 'MGP10') {
    const groups = {
        'Sawn Timber (MGP)': ['MGP10', 'MGP12', 'MGP15'],
        'Structural (F-Grade)': ['F7', 'F14', 'F17'],
        'Glulam (GL)': ['GL8', 'GL12', 'GL17'],
    };
    return Object.entries(groups).map(([grp, keys]) =>
        `<optgroup label="${grp}">${keys.map(k =>
            `<option value="${k}"${k === selected ? ' selected' : ''}>${k} — E=${MATERIAL_GRADES[k].E} MPa</option>`
        ).join('')}</optgroup>`
    ).join('');
}

// ── Render layer input rows ───────────────────────────────────────────────────
function renderLayerInputs() {
    const tbody    = document.getElementById('layer-inputs');
    const defThick = parseFloat(document.getElementById('default-thickness').value) || 35;
    const defGrade = document.getElementById('grade').value || 'MGP10';
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
            </td>
            <td>
                <select class="mini-control layer-material" onchange="updatePreview()">
                    ${gradeOptions(defGrade)}
                </select>
            </td>`;

        tbody.appendChild(tr);
    }

    syncComparisonAvailability();
    updatePreview();
}

// ── Live layup preview ────────────────────────────────────────────────────────
function updatePreview() {
    const wrap      = document.getElementById('layup-preview');
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

    // Alternating check live
    checkAlternatingUI();
}

// ── Live alternating orientation check ───────────────────────────────────────
function checkAlternatingUI() {
    const orientEls = document.querySelectorAll('.layer-orientation');
    const box       = document.getElementById('note-alternating');
    if (!box) return;
    let hasAdj = false;
    orientEls.forEach((el, i) => {
        if (i > 0 && parseInt(el.value) === parseInt(orientEls[i-1].value)) hasAdj = true;
    });
    box.classList.toggle('hidden', !hasAdj);
}

// ── Build CLTLayupType from form ──────────────────────────────────────────────
function buildLayupFromForm() {
    const beff   = parseFloat(document.getElementById('beff').value)  || 1000;
    const LrefM  = parseFloat(document.getElementById('lref').value)  || 5;
    const layup  = new CLTLayupType(`CLT ${currentLayers}-Layer`, beff, LrefM * 1000);

    const thickEls    = document.querySelectorAll('.layer-thickness');
    const orientEls   = document.querySelectorAll('.layer-orientation');
    const materialEls = document.querySelectorAll('.layer-material');

    for (let i = 0; i < currentLayers; i++) {
        const mat = MATERIAL_GRADES[materialEls[i].value];
        layup.addLayer(new CLTLayerType(
            parseFloat(thickEls[i].value),
            parseInt(orientEls[i].value, 10),
            mat
        ));
    }
    return layup;
}

// ── Run calculation ───────────────────────────────────────────────────────────
function runCalculation() {
    clearError();
    hideOutputs();

    let layup;
    try { layup = buildLayupFromForm(); }
    catch (e) { showError(e.message); return; }

    document.getElementById('output-placeholder').style.display = 'none';

    // Comparison mode
    if (comparisonMode) {
        try {
            const cmp = ComparisonCalculator.calculate(layup);
            renderComparison(layup, cmp);
            document.getElementById('output-comparison').style.display = '';
        } catch (e) { showError(e.message); }
        return;
    }

    // Single method
    try {
        const calc = currentMethod === 'ShearAnalogy'
            ? new ShearAnalogyMethod()
            : new GammaMethod();
        const result = calc.calculate(layup);

        if (currentMethod === 'ShearAnalogy') {
            renderShearAnalogy(layup, result);
            document.getElementById('output-shear').style.display = '';
        } else {
            renderGamma(layup, result);
            document.getElementById('output-gamma').style.display = '';
        }
    } catch (e) { showError(e.message); }
}

// ── Deflection block HTML ─────────────────────────────────────────────────────
function deflectionHTML(EIeff, beff, L) {
    const wkPa = parseFloat(document.getElementById('load-w').value) || 0;
    if (wkPa <= 0) return '';

    const d = DeflectionCalculator.calculate(EIeff, beff, L, wkPa);
    const ok300 = d.statusL300 === 'OK';
    const ok400 = d.statusL400 === 'OK';

    return `
    <div class="section-header" style="margin-top:20px;">Cek Defleksi (UDL = ${wkPa} kN/m²,  L = ${(L/1000).toFixed(2)} m)</div>
    <div class="kpi-row" style="margin-bottom:0;">
        <div class="kpi-card">
            <div class="kpi-label">δ<sub>max</sub></div>
            <div class="kpi-value">${fmt(d.delta, 2)}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">5wL⁴/384EI</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Limit L/300</div>
            <div class="kpi-value ${ok300 ? 'green' : 'red'}">${ok300 ? '✓' : '✗'} ${fmt(d.limitL300, 1)} mm</div>
            <div class="kpi-sub">Ratio: ${fmt(d.ratio300, 2)} ${ok300 ? '≤ 1.0 ✓' : '> 1.0 ✗'}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Limit L/400</div>
            <div class="kpi-value ${ok400 ? 'green' : 'red'}">${ok400 ? '✓' : '✗'} ${fmt(d.limitL400, 1)} mm</div>
            <div class="kpi-sub">Ratio: ${fmt(d.ratio400, 2)} ${ok400 ? '≤ 1.0 ✓' : '> 1.0 ✗'}</div>
        </div>
    </div>`;
}

// ── Render: Shear Analogy ─────────────────────────────────────────────────────
function renderShearAnalogy(layup, result) {
    const n      = layup.getLayerCount();
    const totalT = layup.getTotalThickness();
    const sym    = layup.isSymmetric();
    const EI     = result.EIeff;
    const L      = layup.Lref;

    // Warning for non-alternating
    if (result.altWarning) showWarning(result.altWarning);

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

    document.getElementById('sa-kpi').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Total Tebal</div>
            <div class="kpi-value">${totalT}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">${n} layer</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Centroid</div>
            <div class="kpi-value" style="font-size:15px;">${fmt(result.centroid, 2)}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">dari dasar panel</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">EA<sub>eff</sub></div>
            <div class="kpi-value" style="font-size:15px;">${fmtSci(result.EAeff)}</div>
            <div class="kpi-sub">N/m (aksial)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Simetris</div>
            <div class="kpi-value ${sym ? 'green' : 'red'}">${sym ? '✓ Ya' : '✗ Tidak'}</div>
            <div class="kpi-sub">${sym ? 'layup valid' : 'periksa layup'}</div>
        </div>`;

    const tbody = document.getElementById('sa-tbody');
    tbody.innerHTML = '';
    result.layers.forEach(lp => {
        const active = lp.Exx > 0;
        const tr = document.createElement('tr');
        tr.className = active ? '' : 'row-inactive';
        tr.innerHTML = `
            <td>Layer ${lp.index}</td>
            <td>${lp.ti}</td>
            <td style="text-align:center;"><span class="${lp.angle===0?'chip-par':'chip-perp'}">${lp.angle}°</span></td>
            <td>${active ? lp.Exx : '—'}</td>
            <td>${fmt(lp.yi)}</td>
            <td>${fmt(lp.hi)}</td>
            <td>${lp.Gi}</td>
            <td>${fmtSci(lp.beffTi3)}</td>
            <td>${fmtSci(lp.beffTiHi2)}</td>
            <td style="font-weight:600;">${active ? fmtSci(lp.EiIi) : '—'}</td>`;
        tbody.appendChild(tr);
    });

    const trTot = document.createElement('tr');
    trTot.className = 'row-total';
    trTot.innerHTML = `
        <td colspan="9" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;">
            Σ E<sub>i</sub>I<sub>i</sub> = EI<sub>eff</sub>
        </td>
        <td>${fmtSci(EI)}</td>`;
    tbody.appendChild(trTot);

    // Deflection section
    document.getElementById('sa-deflection').innerHTML = deflectionHTML(EI, layup.beff, L);
}

// ── Render: Gamma Method ──────────────────────────────────────────────────────
function renderGamma(layup, result) {
    const n      = layup.getLayerCount();
    const totalT = layup.getTotalThickness();
    const EI     = result.EIeff;
    const L      = layup.Lref;

    if (result.altWarning) showWarning(result.altWarning);

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

    document.getElementById('gm-kpi').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Total Tebal</div>
            <div class="kpi-value">${totalT}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">${n} layer</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Centroid</div>
            <div class="kpi-value" style="font-size:15px;">${fmt(result.centroid, 2)}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">mm</span></div>
            <div class="kpi-sub">titik netral efektif</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">EA<sub>eff</sub></div>
            <div class="kpi-value" style="font-size:15px;">${fmtSci(result.EAeff)}</div>
            <div class="kpi-sub">N/m (aksial)</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">L<sub>ref</sub></div>
            <div class="kpi-value" style="font-size:15px;">${(L/1000).toFixed(2)}<span style="font-size:13px;font-weight:500;color:var(--ink-soft);margin-left:3px;">m</span></div>
            <div class="kpi-sub">bentang referensi</div>
        </div>`;

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
            <td>Layer ${lp.index}${active ? '<span class="chip-eff">eff</span>' : ''}</td>
            <td>${lp.ti}</td>
            <td style="text-align:center;"><span class="${lp.angle===0?'chip-par':'chip-perp'}">${lp.angle}°</span></td>
            <td>${active ? lp.Exx : '—'}</td>
            <td>${active ? fmt(ai, 3) : '—'}</td>
            <td>${active ? fmt(gi, 4) : '—'}</td>
            <td>${lp.Gi}</td>
            <td>${active ? fmtSci(lp.beffTi3)   : '—'}</td>
            <td>${active ? fmtSci(lp.beffTiHi2) : '—'}</td>
            <td style="font-weight:600;">${active ? fmtSci(lp.EiIi) : '—'}</td>`;
        tbody.appendChild(tr);
    });

    const trTot = document.createElement('tr');
    trTot.className = 'row-total';
    trTot.innerHTML = `
        <td colspan="9" style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;">
            Σ γ<sub>i</sub>·E<sub>i</sub>·I<sub>i,eff</sub> = EI<sub>eff,γ</sub>
        </td>
        <td>${fmtSci(EI)}</td>`;
    tbody.appendChild(trTot);

    document.getElementById('gm-deflection').innerHTML = deflectionHTML(EI, layup.beff, L);
}

// ── Render: Comparison Mode ───────────────────────────────────────────────────
function renderComparison(layup, cmp) {
    const sa  = cmp.shearAnalogy;
    const gm  = cmp.gamma;
    const diff = cmp.diffPercent;
    const n   = layup.getLayerCount();
    const L   = layup.Lref;

    const wrap = document.getElementById('output-comparison');
    wrap.innerHTML = `
    <div class="result-hero" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); margin-bottom:16px;">
        <div class="rh-main">
            <div class="rh-label">Mode Perbandingan — ${n} Layer</div>
            <div class="rh-value" style="font-size:22px;">SA vs Gamma (γ)</div>
            <div class="rh-unit">Selisih EI<sub>eff</sub>: ${fmt(Math.abs(diff), 2)}% — ${diff < 0 ? 'Gamma lebih konservatif' : 'SA lebih konservatif'}</div>
        </div>
        <div class="rh-meta">
            <div class="rh-meta-tag">${n} Layer</div>
            <div class="rh-meta-tag">L<sub>ref</sub> = ${(L/1000).toFixed(1)} m</div>
        </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div class="kpi-card" style="border-top:3px solid var(--accent);">
            <div class="kpi-label">EI<sub>eff</sub> — Shear Analogy</div>
            <div class="kpi-value" style="font-size:16px;">${fmtSci(sa.EIeff)}</div>
            <div class="kpi-sub">N·mm²/m · proHolz §4.1.3</div>
        </div>
        <div class="kpi-card" style="border-top:3px solid #7c3aed;">
            <div class="kpi-label">EI<sub>eff,γ</sub> — Gamma Method</div>
            <div class="kpi-value" style="font-size:16px;color:#7c3aed;">${fmtSci(gm.EIeff)}</div>
            <div class="kpi-sub">N·mm²/m · proHolz §4.2</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Centroid (SA)</div>
            <div class="kpi-value" style="font-size:16px;">${fmt(sa.centroid, 2)} mm</div>
            <div class="kpi-sub">dari dasar panel</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Centroid (Gamma)</div>
            <div class="kpi-value" style="font-size:16px;color:#7c3aed;">${fmt(gm.centroid, 2)} mm</div>
            <div class="kpi-sub">dari dasar panel</div>
        </div>
    </div>
    ${deflectionHTML(sa.EIeff, layup.beff, L)}
    <div style="margin-top:8px;font-size:12px;color:var(--ink-soft);font-style:italic;padding:8px 0;">
        ⬆ Defleksi dihitung menggunakan EI<sub>eff</sub> Shear Analogy (lebih konservatif dari Gamma jika SA &lt; Gamma).
    </div>`;
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV() {
    // Gather last result from visible output
    const saVisible  = document.getElementById('output-shear').style.display !== 'none';
    const gmVisible  = document.getElementById('output-gamma').style.display !== 'none';
    const cmpVisible = document.getElementById('output-comparison').style.display !== 'none';

    if (!saVisible && !gmVisible && !cmpVisible) {
        showError('Tidak ada hasil yang bisa diekspor. Hitung dulu.');
        return;
    }

    let layup, result;
    try {
        layup = buildLayupFromForm();
        if (saVisible) result = new ShearAnalogyMethod().calculate(layup);
        else if (gmVisible) result = new GammaMethod().calculate(layup);
        else result = ComparisonCalculator.calculate(layup).shearAnalogy;
    } catch (e) { showError(e.message); return; }

    const rows = [
        ['CLT Panel Properties Calculator — Export CSV'],
        ['Metode', result.method],
        ['EIeff (N·mm²/m)', result.EIeff],
        ['EAeff (N/m)', result.EAeff],
        ['Centroid (mm)', result.centroid ?? ''],
        [],
        ['Layer', 't (mm)', 'Orientasi', 'Exx (MPa)', 'yi (mm)', 'hi (mm)', 'Gi (MPa)', 'beff·ti³/12', 'beff·ti·hi²', 'EiIi'],
    ];

    result.layers.forEach(lp => {
        rows.push([
            `Layer ${lp.index}`,
            lp.ti,
            `${lp.angle}°`,
            lp.Exx || 0,
            lp.yi,
            lp.hi,
            lp.Gi,
            lp.beffTi3.toFixed(2),
            lp.beffTiHi2.toFixed(2),
            lp.EiIi.toFixed(2),
        ]);
    });

    rows.push([], ['Total EIeff', result.EIeff]);

    const csv  = rows.map(r => r.join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `CLT_${result.method}_${layup.getLayerCount()}Layer.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    el.style.display = '';
}

function showWarning(msg) {
    const el = document.getElementById('calc-warning');
    if (!el) return;
    el.classList.remove('hidden');
    el.querySelector('#calc-warning-msg').textContent = msg;
    el.style.display = '';
}

function clearError() {
    const e = document.getElementById('calc-error');
    e.classList.add('hidden');
    e.style.display = 'none';
    const w = document.getElementById('calc-warning');
    if (w) { w.classList.add('hidden'); w.style.display = 'none'; }
}

function hideOutputs() {
    document.getElementById('output-shear').style.display       = 'none';
    document.getElementById('output-gamma').style.display       = 'none';
    document.getElementById('output-comparison').style.display  = 'none';
    document.getElementById('output-placeholder').style.display = '';
}
