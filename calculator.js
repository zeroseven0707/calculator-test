/**
 * calculator.js
 * Mengelola state input, membangun CLTLayupType dari form,
 * memanggil metode kalkulasi yang sesuai, dan me-render output ke DOM.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

let currentMethod = 'ShearAnalogy';  // 'ShearAnalogy' | 'Gamma'
let currentLayers = 5;               // jumlah layer aktif

// ─────────────────────────────────────────────────────────────────────────────
// PILIH METODE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dipanggil saat pengguna memilih metode analisis.
 * Menyembunyikan output section yang tidak relevan,
 * menyesuaikan pilihan layer, dan me-render ulang input layer.
 * @param {'ShearAnalogy'|'Gamma'} method
 */
function selectMethod(method) {
    currentMethod = method;

    // Highlight label metode yang dipilih
    document.getElementById('opt-shear').classList.toggle('selected', method === 'ShearAnalogy');
    document.getElementById('opt-gamma').classList.toggle('selected', method === 'Gamma');

    // Tampilkan/sembunyikan catatan bawah tabel
    document.getElementById('note-symmetric').classList.toggle('d-none', method !== 'ShearAnalogy');
    document.getElementById('note-gamma').classList.toggle('d-none',     method !== 'Gamma');

    // Tampilkan/sembunyikan field Lref (hanya relevan untuk Gamma)
    document.getElementById('lref-group').classList.toggle('hidden', method !== 'Gamma');

    // Sesuaikan opsi layer dan re-render baris input
    updateLayerOptions();
    renderLayerInputs();

    // Sembunyikan kedua output section saat metode berubah
    hideOutputs();
    clearError();
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN JUMLAH LAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mengisi dropdown jumlah layer sesuai batasan masing-masing metode:
 * - Shear Analogy: 3, 5, 7, 9 (ganjil — karena harus simetris)
 * - Gamma       : 3, 5 saja
 */
function updateLayerOptions() {
    const sel = document.getElementById('layer-count');
    sel.innerHTML = '';

    const options = currentMethod === 'ShearAnalogy'
        ? [3, 5, 7, 9]
        : [3, 5];

    // Jika layer sekarang tidak ada di opsi baru, reset ke yang pertama
    if (!options.includes(currentLayers)) {
        currentLayers = options[0];
    }

    options.forEach(n => {
        const opt    = document.createElement('option');
        opt.value    = n;
        opt.textContent = `${n} Layer`;
        if (n === currentLayers) opt.selected = true;
        sel.appendChild(opt);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER BARIS INPUT LAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Me-render ulang seluruh tabel baris input layer.
 * Gamma Method: layer genap selalu 90° dan dikunci (disabled).
 */
function renderLayerInputs() {
    const tbody = document.getElementById('layer-inputs');
    tbody.innerHTML = '';

    for (let i = 1; i <= currentLayers; i++) {
        const isGamma     = currentMethod === 'Gamma';
        // Layer genap pada Gamma selalu tegak lurus (90°) — tidak bisa diubah
        const isTransverse = isGamma && (i % 2 === 0);
        const defaultAngle = isTransverse ? 90 : (i % 2 !== 0 ? 0 : 90);

        const tr = document.createElement('tr');
        if (isTransverse) tr.classList.add('layer-transverse');

        tr.innerHTML = `
            <td class="layer-num text-center">Layer ${i}</td>
            <td>
                <input type="number"
                       class="form-control form-control-sm"
                       id="thickness-${i}"
                       value="35" min="1" step="1">
            </td>
            <td>
                <select class="form-select form-select-sm"
                        id="angle-${i}"
                        ${isTransverse ? 'disabled' : ''}>
                    <option value="0"  ${defaultAngle === 0  ? 'selected' : ''}>0° — Paralel (∥)</option>
                    <option value="90" ${defaultAngle === 90 ? 'selected' : ''}>90° — Tegak lurus (⊥)</option>
                </select>
            </td>
            <td>
                <select class="form-select form-select-sm" id="material-${i}">
                    ${Object.keys(MATERIAL_GRADES).map(g =>
                        `<option value="${g}">${g}</option>`
                    ).join('')}
                </select>
            </td>`;

        tbody.appendChild(tr);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BACA FORM → CLTLayupType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membaca semua nilai dari form dan membangun objek CLTLayupType.
 * @returns {CLTLayupType}
 * @throws {Error} jika input tidak valid
 */
function buildLayupFromForm() {
    const beff  = parseFloat(document.getElementById('beff').value) || 1000;
    const LrefM = parseFloat(document.getElementById('lref').value) || 5;
    const Lref  = LrefM * 1000;  // konversi meter → mm

    const layup = new CLTLayupType(`CLT ${currentLayers}-Layer`, beff, Lref);

    for (let i = 1; i <= currentLayers; i++) {
        const thickness = parseFloat(document.getElementById(`thickness-${i}`).value);
        const angle     = parseInt(document.getElementById(`angle-${i}`).value, 10);
        const matKey    = document.getElementById(`material-${i}`).value;
        const material  = MATERIAL_GRADES[matKey];

        layup.addLayer(new CLTLayerType(thickness, angle, material));
    }

    return layup;
}

// ─────────────────────────────────────────────────────────────────────────────
// KALKULASI UTAMA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point saat tombol "Hitung" ditekan.
 * Membangun layup, memilih kalkulator yang sesuai, dan merender hasil.
 */
function runCalculation() {
    clearError();
    hideOutputs();

    let layup, result;

    try {
        layup = buildLayupFromForm();
    } catch (err) {
        showError(err.message);
        return;
    }

    try {
        const calculator = currentMethod === 'ShearAnalogy'
            ? new ShearAnalogyMethod()
            : new GammaMethod();

        result = calculator.calculate(layup);
    } catch (err) {
        showError(err.message);
        return;
    }

    if (currentMethod === 'ShearAnalogy') {
        renderShearAnalogy(layup, result);
        document.getElementById('output-shear').classList.remove('d-none');
        document.getElementById('output-shear').scrollIntoView({ behavior: 'smooth' });
    } else {
        renderGamma(layup, result);
        document.getElementById('output-gamma').classList.remove('d-none');
        document.getElementById('output-gamma').scrollIntoView({ behavior: 'smooth' });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER OUTPUT — SHEAR ANALOGY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Me-render hasil kalkulasi Shear Analogy ke section output-shear.
 * @param {CLTLayupType}        layup
 * @param {PanelPropertiesType} result
 */
function renderShearAnalogy(layup, result) {
    document.getElementById('sa-EIeff').textContent    = fmt(result.EIeff, 3) + ' N·mm²/m';
    document.getElementById('sa-n-layers').textContent = layup.getLayerCount();
    document.getElementById('sa-total-t').textContent  = layup.getTotalThickness() + ' mm';
    document.getElementById('sa-beff').textContent     = layup.beff + ' mm';

    const tbody = document.getElementById('sa-table-body');
    tbody.innerHTML = '';

    result.layers.forEach(lp => {
        const isActive = lp.Exx > 0;
        const tr = document.createElement('tr');
        if (!isActive) tr.classList.add('zero');
        tr.innerHTML = `
            <td class="text-center fw-semibold">Layer ${lp.index}</td>
            <td class="text-center">${lp.ti}</td>
            <td class="text-center">${lp.angle}°</td>
            <td class="text-center">${lp.Exx || '—'}</td>
            <td class="text-center">${fmt(lp.yi)}</td>
            <td class="text-center">${fmt(lp.hi)}</td>
            <td class="text-center">${lp.Gi}</td>
            <td class="text-end">${fmt(lp.beffTi3)}</td>
            <td class="text-end">${fmt(lp.beffTiHi2)}</td>
            <td class="text-end">${isActive ? fmt(lp.EiIi) : '—'}
            </td>`;
        tbody.appendChild(tr);
    });

    // Baris total
    const trTotal = document.createElement('tr');
    trTotal.className = 'total-row';
    trTotal.innerHTML = `
        <td colspan="9" class="text-end pe-3">
            Σ E<sub>i</sub>I<sub>i</sub> &nbsp;=&nbsp; <strong>EI<sub>eff</sub></strong>
        </td>
        <td class="text-end">${fmt(result.EIeff)} N·mm²/m</td>`;
    tbody.appendChild(trTotal);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER OUTPUT — GAMMA METHOD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Me-render hasil kalkulasi Gamma Method ke section output-gamma.
 * @param {CLTLayupType}        layup
 * @param {PanelPropertiesType} result
 */
function renderGamma(layup, result) {
    document.getElementById('gm-EIeff').textContent    = fmt(result.EIeff, 3) + ' N·mm²/m';
    document.getElementById('gm-n-layers').textContent = layup.getLayerCount();
    document.getElementById('gm-total-t').textContent  = layup.getTotalThickness() + ' mm';
    document.getElementById('gm-centroid').textContent = fmt(result.centroid, 2) + ' mm';

    const tbody  = document.getElementById('gm-table-body');
    tbody.innerHTML = '';

    // Map layer efektif → gamma index
    const effIdx    = result.gammaValues ? result.layers
        .map((lp, i) => lp.Exx > 0 ? i : -1)
        .filter(i => i >= 0) : [];
    let effCounter  = 0;

    result.layers.forEach((lp, i) => {
        const isEff = lp.Exx > 0;
        const gi    = isEff ? result.gammaValues[effCounter] : null;
        const ai    = isEff ? result.aiValues[effCounter]    : null;
        if (isEff) effCounter++;

        const tr = document.createElement('tr');
        if (!isEff) tr.classList.add('zero');
        tr.innerHTML = `
            <td class="text-center fw-semibold">
                Layer ${lp.index}
                ${isEff ? `<span class="gamma-badge ms-1">eff</span>` : ''}
            </td>
            <td class="text-center">${lp.ti}</td>
            <td class="text-center">${lp.angle}°</td>
            <td class="text-center">${lp.Exx || '—'}</td>
            <td class="text-center">${isEff ? fmt(ai, 3)          : '—'}</td>
            <td class="text-center">${isEff ? fmt(gi, 4)          : '—'}</td>
            <td class="text-center">${lp.Gi}</td>
            <td class="text-end">${isEff ? fmt(lp.beffTi3)    : '—'}</td>
            <td class="text-end">${isEff ? fmt(lp.beffTiHi2)  : '—'}</td>
            <td class="text-end">${isEff ? fmt(lp.EiIi)       : '—'}</td>`;
        tbody.appendChild(tr);
    });

    // Baris total
    const trTotal = document.createElement('tr');
    trTotal.className = 'total-row';
    trTotal.innerHTML = `
        <td colspan="9" class="text-end pe-3">
            Σ γ<sub>i</sub>·E<sub>i</sub>·I<sub>i,eff</sub> &nbsp;=&nbsp; <strong>EI<sub>eff,γ</sub></strong>
        </td>
        <td class="text-end">${fmt(result.EIeff)} N·mm²/m</td>`;
    tbody.appendChild(trTotal);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format angka: notasi ilmiah untuk nilai sangat besar/kecil, fixed untuk lainnya.
 * @param {number} val
 * @param {number} digits
 * @returns {string}
 */
function fmt(val, digits = 3) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    const abs = Math.abs(val);
    if (abs >= 1e9 || (abs > 0 && abs < 1e-2)) {
        return val.toExponential(digits);
    }
    return val.toFixed(digits);
}

function showError(msg) {
    const el = document.getElementById('calc-error');
    el.textContent = '⚠ ' + msg;
    el.classList.remove('d-none');
}

function clearError() {
    document.getElementById('calc-error').classList.add('d-none');
}

function hideOutputs() {
    document.getElementById('output-shear').classList.add('d-none');
    document.getElementById('output-gamma').classList.add('d-none');
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────

function init() {
    // Inisialisasi layer count dropdown
    updateLayerOptions();
    renderLayerInputs();

    // Lref tersembunyi di awal (default Shear Analogy)
    document.getElementById('lref-group').classList.add('hidden');

    // Event: perubahan jumlah layer
    document.getElementById('layer-count').addEventListener('change', e => {
        currentLayers = parseInt(e.target.value, 10);
        renderLayerInputs();
        hideOutputs();
        clearError();
    });
}

document.addEventListener('DOMContentLoaded', init);
