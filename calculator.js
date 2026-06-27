/**
 * Calculator — mengelola input pengguna, membangun CLTLayupType,
 * memanggil metode kalkulasi, dan me-render hasil ke halaman.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STATE GLOBAL
// ─────────────────────────────────────────────────────────────────────────────

let currentMethod = 'ShearAnalogy';   // 'ShearAnalogy' | 'Gamma'
let currentLayers = 5;                // jumlah layer default

// ─────────────────────────────────────────────────────────────────────────────
// RENDER INPUT FORM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membuat baris input untuk satu layer.
 * @param {number} index  - Nomor layer (1-based)
 * @param {number} method - Metode aktif saat ini
 * @returns {string} HTML string
 */
function renderLayerRow(index, method) {
    // Pada Gamma Method, layer genap bersifat tegak lurus (90°) — tidak bisa diubah.
    // Layer ganjil adalah layer efektif (0°).
    const isGammaTransverse = method === 'Gamma' && index % 2 === 0;
    const defaultAngle      = isGammaTransverse ? 90 : (index % 2 !== 0 ? 0 : 90);
    const angleDisabled     = isGammaTransverse ? 'disabled' : '';

    return `
    <tr id="layer-row-${index}">
        <td class="text-center fw-semibold text-muted">Layer ${index}</td>
        <td>
            <input type="number" class="form-control form-control-sm"
                   id="thickness-${index}" value="35" min="1" step="1"
                   placeholder="mm">
        </td>
        <td>
            <select class="form-select form-select-sm" id="angle-${index}" ${angleDisabled}>
                <option value="0"  ${defaultAngle === 0  ? 'selected' : ''}>0° (Paralel / ∥)</option>
                <option value="90" ${defaultAngle === 90 ? 'selected' : ''}>90° (Tegak lurus / ⊥)</option>
            </select>
        </td>
        <td>
            <select class="form-select form-select-sm" id="material-${index}">
                ${Object.keys(MATERIAL_GRADES).map(g =>
                    `<option value="${g}">${g}</option>`
                ).join('')}
            </select>
        </td>
    </tr>`;
}

/**
 * Merender tabel input layer berdasarkan metode dan jumlah layer.
 */
function renderLayerInputs() {
    const container = document.getElementById('layer-inputs');
    let rows = '';
    for (let i = 1; i <= currentLayers; i++) {
        rows += renderLayerRow(i, currentMethod);
    }
    container.innerHTML = rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ INPUT & BUILD CLTLayupType
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Membaca nilai dari form dan membangun objek CLTLayupType.
 * @returns {CLTLayupType}
 */
function buildLayupFromForm() {
    const beff  = parseFloat(document.getElementById('beff').value)  || 1000;
    const Lref  = parseFloat(document.getElementById('lref').value)  * 1000 || 5000;
    const grade = document.getElementById('grade').value;

    const layup = new CLTLayupType(`CLT ${currentLayers}-Layer`, beff, Lref);

    for (let i = 1; i <= currentLayers; i++) {
        const thickness = parseFloat(document.getElementById(`thickness-${i}`).value);
        const angle     = parseInt(document.getElementById(`angle-${i}`).value);
        const matName   = document.getElementById(`material-${i}`)?.value || grade;
        const material  = MATERIAL_GRADES[matName] || MATERIAL_GRADES[grade];

        layup.addLayer(new CLTLayerType(thickness, angle, material));
    }

    return layup;
}

// ─────────────────────────────────────────────────────────────────────────────
// KALKULASI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Menjalankan kalkulasi dan me-render hasilnya.
 */
function runCalculation() {
    const errorEl  = document.getElementById('calc-error');
    const resultEl = document.getElementById('result-section');
    errorEl.classList.add('d-none');
    resultEl.classList.add('d-none');

    let layup, result;

    try {
        layup = buildLayupFromForm();
    } catch (e) {
        showError(e.message);
        return;
    }

    try {
        const calculator = currentMethod === 'ShearAnalogy'
            ? new ShearAnalogyMethod()
            : new GammaMethod();

        result = calculator.calculate(layup);
    } catch (e) {
        showError(e.message);
        return;
    }

    renderResult(layup, result);
}

function showError(msg) {
    const el = document.getElementById('calc-error');
    el.textContent = msg;
    el.classList.remove('d-none');
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER HASIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format angka ke notasi ilmiah atau fixed tergantung ukurannya.
 * @param {number} val
 * @param {number} digits
 * @returns {string}
 */
function fmt(val, digits = 3) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    if (Math.abs(val) >= 1e9 || (Math.abs(val) < 0.01 && val !== 0)) {
        return val.toExponential(digits);
    }
    return val.toFixed(digits);
}

/**
 * Me-render hasil kalkulasi ke DOM.
 * @param {CLTLayupType}        layup
 * @param {PanelPropertiesType} result
 */
function renderResult(layup, result) {
    const totalThickness = layup.getTotalThickness();

    // ── Header info ──────────────────────────────────────────────────────────
    document.getElementById('res-method').textContent = result.method === 'ShearAnalogy'
        ? 'Shear Analogy Method'
        : 'Gamma Method';
    document.getElementById('res-layers').textContent  = layup.getLayerCount();
    document.getElementById('res-total-t').textContent = `${totalThickness} mm`;
    document.getElementById('res-beff').textContent    = `${layup.beff} mm`;
    document.getElementById('res-EIeff').textContent   = `${fmt(result.EIeff, 3)} N·mm²/m`;

    // ── Tabel per layer ──────────────────────────────────────────────────────
    const tbody = document.getElementById('result-table-body');
    tbody.innerHTML = '';

    result.layers.forEach(lp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-center">Layer ${lp.index}</td>
            <td class="text-center">${lp.ti}</td>
            <td class="text-center">${lp.angle}°</td>
            <td class="text-center">${lp.Exx}</td>
            <td class="text-center">${fmt(lp.yi)}</td>
            <td class="text-center">${fmt(lp.hi)}</td>
            <td class="text-center">${lp.Gi}</td>
            <td class="text-end">${fmt(lp.beffTi3, 3)}</td>
            <td class="text-end">${fmt(lp.beffTiHi2, 3)}</td>
            <td class="text-end">${fmt(lp.EiIi, 3)}</td>
        `;
        tbody.appendChild(row);
    });

    // ── Baris total ──────────────────────────────────────────────────────────
    const totalRow = document.createElement('tr');
    totalRow.className = 'table-active fw-bold';
    totalRow.innerHTML = `
        <td colspan="9" class="text-end">ΣEᵢIᵢ (EI<sub>eff</sub>)</td>
        <td class="text-end">${fmt(result.EIeff, 3)} N·mm²/m</td>
    `;
    tbody.appendChild(totalRow);

    // ── Gamma section (hanya Gamma Method) ──────────────────────────────────
    const gammaSection = document.getElementById('gamma-extra');
    if (result.method === 'Gamma' && result.gammaValues) {
        const effLayers = layup.getLayers()
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => l.angle === 0);

        let gammaRows = '';
        effLayers.forEach(({ l, i }, idx) => {
            gammaRows += `
            <tr>
                <td>Layer ${i + 1} (T${idx + 1})</td>
                <td class="text-center">${l.thickness}</td>
                <td class="text-center">${l.getExx()}</td>
                <td class="text-center">${fmt(result.gammaValues[idx], 4)}</td>
            </tr>`;
        });

        gammaSection.innerHTML = `
            <h6 class="mt-3 text-secondary">Faktor Gamma (γᵢ) per Layer Efektif</h6>
            <div class="table-responsive">
                <table class="table table-sm table-bordered text-sm">
                    <thead class="table-light">
                        <tr>
                            <th>Layer</th>
                            <th class="text-center">tᵢ (mm)</th>
                            <th class="text-center">Eᵢ (MPa)</th>
                            <th class="text-center">γᵢ</th>
                        </tr>
                    </thead>
                    <tbody>${gammaRows}</tbody>
                </table>
            </div>
            <p class="text-muted small">Centroid panel: ${fmt(result.centroid, 3)} mm dari dasar</p>
        `;
        gammaSection.classList.remove('d-none');
    } else {
        gammaSection.classList.add('d-none');
    }

    document.getElementById('result-section').classList.remove('d-none');
    document.getElementById('result-section').scrollIntoView({ behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT HANDLERS & INIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dipanggil saat metode analisis berubah.
 */
function onMethodChange(method) {
    currentMethod = method;

    // Tampilkan/sembunyikan info metode
    document.getElementById('info-shear').classList.toggle('d-none', method !== 'ShearAnalogy');
    document.getElementById('info-gamma').classList.toggle('d-none', method !== 'Gamma');

    // Sesuaikan pilihan jumlah layer sesuai metode
    updateLayerOptions();
    renderLayerInputs();
    document.getElementById('result-section').classList.add('d-none');
    document.getElementById('calc-error').classList.add('d-none');
}

/**
 * Menyesuaikan dropdown jumlah layer berdasarkan metode.
 */
function updateLayerOptions() {
    const sel = document.getElementById('layer-count');
    sel.innerHTML = '';

    let options;
    if (currentMethod === 'ShearAnalogy') {
        // 3–9 layer ganjil (simetris)
        options = [3, 5, 7, 9];
    } else {
        // Gamma: hanya 3 atau 5
        options = [3, 5];
    }

    options.forEach(n => {
        const opt   = document.createElement('option');
        opt.value   = n;
        opt.text    = `${n} Layer`;
        if (n === currentLayers && options.includes(currentLayers)) opt.selected = true;
        sel.appendChild(opt);
    });

    // Reset ke nilai valid terdekat
    if (!options.includes(currentLayers)) {
        currentLayers = options[0];
    }
    sel.value = currentLayers;
}

/**
 * Dipanggil saat jumlah layer berubah.
 */
function onLayerCountChange(n) {
    currentLayers = parseInt(n);
    renderLayerInputs();
    document.getElementById('result-section').classList.add('d-none');
    document.getElementById('calc-error').classList.add('d-none');
}

/**
 * Inisialisasi aplikasi saat halaman dimuat.
 */
function init() {
    updateLayerOptions();
    renderLayerInputs();

    document.getElementById('layer-count').addEventListener('change', e => {
        onLayerCountChange(e.target.value);
    });
}

document.addEventListener('DOMContentLoaded', init);
