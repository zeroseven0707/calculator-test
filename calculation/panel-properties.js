/**
 * Kelas-kelas perhitungan Panel Properties CLT.
 * 
 * Referensi: proHolz Vol1, Section 4.1.3 (Shear Analogy) dan 4.2 (Gamma Method)
 * 
 * Cara pakai:
 *   const method = new ShearAnalogyMethod();
 *   const result = method.calculate(cltLayup);  // → PanelPropertiesType
 */

// ─── Base Class ─────────────────────────────────────────────────────────────

class PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        throw new Error('Metode calculate() harus di-override oleh subclass');
    }

    /**
     * Hitung kekakuan aksial efektif: EAeff = Σ Ei,XX × beff × ti
     * @param {CLTLayupType} cltLayup
     * @returns {number} N/m
     */
    calcEAeff(cltLayup) {
        const beff = cltLayup.beff;
        return cltLayup.getLayers().reduce((sum, l) => {
            return sum + l.getExx() * beff * l.thickness;
        }, 0);
    }

    /**
     * Validasi pola alternating 0°/90° — warning saja, tidak throw.
     * @param {CLTLayupType} cltLayup
     * @returns {{ valid: boolean, message: string }}
     */
    checkAlternating(cltLayup) {
        const layers = cltLayup.getLayers();
        for (let i = 1; i < layers.length; i++) {
            if (layers[i].angle === layers[i - 1].angle) {
                return {
                    valid: false,
                    message: `Layer ${i} dan Layer ${i + 1} memiliki orientasi yang sama (${layers[i].angle}°). Pastikan pola 0°/90° alternating.`
                };
            }
        }
        return { valid: true, message: '' };
    }
}

// ─── Shear Analogy Method ────────────────────────────────────────────────────

/**
 * ShearAnalogyMethod — Metode Shear Analogy untuk 3–9 layer.
 * 
 * Layup HARUS simetris (layer atas = bawah secara cermin).
 * 
 * Formula (proHolz Vol1, 4.1.3):
 *   EIeff = Σ Ei,XX × (beff×ti³/12 + beff×ti×yi²)
 * 
 * di mana:
 *   yi = SUM(ti ... t_n) + ti/2
 *      = jarak dari DASAR panel ke titik tengah layer-i
 *      (dihitung kumulatif dari layer terbawah ke atas)
 * 
 * Catatan: Excel menggunakan yi sebagai hi langsung (centroid referensi = dasar panel).
 */
class ShearAnalogyMethod extends PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        const n = cltLayup.getLayerCount();

        // Validasi jumlah layer
        if (n < 3 || n > 9) {
            throw new Error(`Shear Analogy hanya bisa untuk 3–9 layer. Saat ini: ${n} layer.`);
        }

        // Validasi simetris
        if (!cltLayup.isSymmetric()) {
            throw new Error(
                'Shear Analogy membutuhkan layup simetris (layer teratas harus cerminan layer terbawah).'
            );
        }

        const layers = cltLayup.getLayers();
        const beff   = cltLayup.beff;

        // Periksa pola alternating (warning, bukan error)
        const altCheck = this.checkAlternating(cltLayup);

        // Hitung yi = jarak dari dasar panel ke titik tengah layer-i
        const yi = layers.map((_, i) => {
            let sum = 0;
            for (let j = i; j < n; j++) sum += layers[j].thickness;
            return sum + layers[i].thickness / 2;
        });

        // Centroid = Σ(Ei·Ai·yi) / Σ(Ei·Ai)
        let sumEAy = 0, sumEA = 0;
        layers.forEach((l, i) => {
            const ea = l.getExx() * beff * l.thickness;
            sumEAy  += ea * yi[i];
            sumEA   += ea;
        });
        const centroid = sumEA > 0 ? sumEAy / sumEA : cltLayup.getTotalThickness() / 2;

        const layerProps = [];
        let EIeff = 0;

        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            const ti    = layer.thickness;
            const Exx   = layer.getExx();
            const Gi    = layer.getG();

            // hi = yi (referensi dari dasar panel, sesuai formula Excel)
            const hi = yi[i];

            const beffTi3   = beff * Math.pow(ti, 3) / 12;  // beff·ti³/12
            const beffTiHi2 = beff * ti * Math.pow(hi, 2);  // beff·ti·yi²
            const EiIi      = Exx * (beffTi3 + beffTiHi2);  // Ei·(Ii_own + Ii_steiner)

            EIeff += EiIi;

            layerProps.push(new CLTLayerPropertiesType({
                index    : i + 1,
                ti,
                yi       : Math.round(yi[i] * 1000) / 1000,
                angle    : layer.angle,
                Exx,
                hi       : Math.round(hi * 1000) / 1000,
                Gi,
                beffTi3,
                beffTiHi2,
                EiIi,
            }));
        }

        const EAeff  = this.calcEAeff(cltLayup);
        const result = new PanelPropertiesType('ShearAnalogy', EIeff, layerProps, EAeff);
        result.centroid    = centroid;
        result.altWarning  = altCheck.valid ? null : altCheck.message;
        return result;
    }
}

// ─── Gamma Method ────────────────────────────────────────────────────────────

/**
 * GammaMethod — Metode Gamma untuk 3 atau 5 layer saja.
 * 
 * Referensi: proHolz Vol1, Section 4.2
 * 
 * Metode Gamma memperhitungkan deformasi geser antar-layer melalui
 * faktor γi (gamma), sehingga lebih konservatif dibanding Shear Analogy.
 * 
 * Hanya layer paralel (0°) yang berkontribusi (layer 90° diabaikan).
 * Lapisan efektif untuk 3-layer: T1, T3        (index 0, 2)
 * Lapisan efektif untuk 5-layer: T1, T3, T5   (index 0, 2, 4)
 * 
 * Formula γi:
 *   γi = 1 / (1 + π²·Ei·ti / ((beff/di)·G_gap·Lref²))
 *   Layer tengah: γ = 1
 * 
 * yi = SUM(layer-i ... layer-n) + ti/2   (dari dasar panel, konsisten dgn Shear Analogy)
 * ai = yi_eff - centroid
 * EIeff = Σ γi·Ei·(beff·ti³/12 + beff·ti·ai²)
 */
class GammaMethod extends PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        const n = cltLayup.getLayerCount();

        // Validasi: hanya 3 atau 5 layer
        if (n !== 3 && n !== 5) {
            throw new Error(`Gamma Method hanya bisa untuk 3 atau 5 layer. Saat ini: ${n} layer.`);
        }

        const layers = cltLayup.getLayers();
        const beff   = cltLayup.beff;
        const Lref   = cltLayup.Lref;

        // Periksa pola alternating (warning, bukan error)
        const altCheck = this.checkAlternating(cltLayup);

        // Layer efektif (0°) dan layer pemisah (90°)
        const effIdx = n === 3 ? [0, 2]    : [0, 2, 4];   // index layer 0°
        const gapIdx = n === 3 ? [1]       : [1, 3];       // index layer 90°

        // yi untuk semua layer: SUM(layer-i..n) + ti/2
        const yi = layers.map((_, i) => {
            let s = 0;
            for (let j = i; j < n; j++) s += layers[j].thickness;
            return s + layers[i].thickness / 2;
        });

        // Tebal layer pemisah (di)
        const d     = gapIdx.map(gi => layers[gi].thickness);
        // Modulus geser layer pemisah (G_90 rolling shear)
        const Ggap  = gapIdx.map(gi => layers[gi].getG());
        // Modulus elastisitas layer efektif
        const Eeff  = effIdx.map(ei => layers[ei].getExx());
        // Luas penampang layer efektif (beff × ti)
        const A     = effIdx.map(ei => beff * layers[ei].thickness);

        // Faktor γi (gamma) untuk tiap layer efektif
        const gamma = effIdx.map((ei, idx) => {
            // Layer tengah → γ = 1
            if (idx > 0 && idx < effIdx.length - 1) return 1;

            // Pilih gap yang berdekatan dengan layer ini
            const gapPos = idx === 0 ? 0 : gapIdx.length - 1;
            const di     = d[gapPos];
            const Ggapi  = Ggap[gapPos];
            const Ei     = Eeff[idx];
            const ti     = layers[ei].thickness;

            const num = Math.PI ** 2 * Ei * ti;
            const den = (beff / di) * Ggapi * Math.pow(Lref, 2);
            return 1 / (1 + num / den);
        });

        // Centroid = Σ(γi·Ei·Ai·yi_eff) / Σ(γi·Ei·Ai)
        let sumGEAy = 0, sumGEA = 0;
        effIdx.forEach((ei, idx) => {
            const gEA = gamma[idx] * Eeff[idx] * A[idx];
            sumGEAy  += gEA * yi[ei];
            sumGEA   += gEA;
        });
        const centroid = sumGEA > 0 ? sumGEAy / sumGEA : cltLayup.getTotalThickness() / 2;

        // ai = yi_eff - centroid
        const ai = effIdx.map(ei => yi[ei] - centroid);

        // EIeff = Σ γi·Ei·(beff·ti³/12 + beff·ti·ai²)
        let EIeff = 0;
        const layerProps = [];

        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            const ti    = layer.thickness;
            const Exx   = layer.getExx();
            const Gi    = layer.getG();

            const beffTi3   = beff * Math.pow(ti, 3) / 12;
            const beffTiHi2 = beff * ti * Math.pow(Math.abs(yi[i] - centroid), 2);

            const effPos = effIdx.indexOf(i);
            let EiIi = 0;
            if (effPos !== -1) {
                const gi  = gamma[effPos];
                const aei = ai[effPos];
                EiIi  = gi * Exx * (beffTi3 + beff * ti * Math.pow(aei, 2));
                EIeff += EiIi;
            }

            layerProps.push(new CLTLayerPropertiesType({
                index    : i + 1,
                ti,
                yi       : Math.round(yi[i] * 1000) / 1000,
                angle    : layer.angle,
                Exx,
                hi       : Math.round(Math.abs(yi[i] - centroid) * 1000) / 1000,
                Gi,
                beffTi3,
                beffTiHi2,
                EiIi,
            }));
        }

        const EAeff  = this.calcEAeff(cltLayup);
        const result = new PanelPropertiesType('Gamma', EIeff, layerProps, EAeff);
        result.gammaValues = gamma;
        result.aiValues    = ai;
        result.centroid    = centroid;
        result.altWarning  = altCheck.valid ? null : altCheck.message;
        return result;
    }
}

// ─── Deflection Calculator ───────────────────────────────────────────────────

/**
 * DeflectionCalculator — Menghitung defleksi mid-span dari beban merata.
 * 
 * Formula:
 *   δ_max = 5wL⁴ / (384·EIeff)
 * 
 * di mana:
 *   w    = beban merata (N/mm per mm lebar = kN/m²)
 *   L    = bentang (mm)
 *   EIeff = kekakuan lentur efektif (N·mm²)
 * 
 * Limit defleksi tipikal: L/300 (serviceability), L/400 (presisi tinggi)
 */
class DeflectionCalculator {
    /**
     * @param {number} EIeff   - Kekakuan lentur efektif (N·mm²/m)
     * @param {number} beff    - Lebar efektif (mm)
     * @param {number} L       - Bentang (mm)
     * @param {number} wkPa    - Beban merata (kN/m²)
     * @returns {{ delta: number, ratio: number, limitL300: number, limitL400: number, statusL300: string, statusL400: string }}
     */
    static calculate(EIeff, beff, L, wkPa) {
        // Konversi beban: kN/m² → N/mm per mm lebar
        // 1 kN/m² = 1000 N / (1000mm × 1000mm) = 0.001 N/mm²
        // Beban per mm lebar per mm bentang = wkPa × 1000 / (1000 × 1000) = wkPa × 0.001
        // w (N/mm/mm) = wkPa × 1e3 / 1e6 = wkPa × 1e-3 N/mm²
        // Untuk EIeff per m lebar (beff=1000mm), w = wkPa [kN/m²] × 1000 [N/kN] / 1000 [mm/m] = wkPa N/mm per m
        // Maka w_total = wkPa [N/mm] untuk lebar 1m
        const w = wkPa * 1.0;  // N/mm (per m lebar, wkPa kN/m² = N/mm per m)

        const delta = (5 * w * Math.pow(L, 4)) / (384 * EIeff);

        const limitL300 = L / 300;
        const limitL400 = L / 400;

        return {
            delta,
            limitL300,
            limitL400,
            ratio300    : delta / limitL300,
            ratio400    : delta / limitL400,
            statusL300  : delta <= limitL300 ? 'OK' : 'NG',
            statusL400  : delta <= limitL400 ? 'OK' : 'NG',
        };
    }
}

// ─── Comparison Calculator ───────────────────────────────────────────────────

/**
 * ComparisonCalculator — Menjalankan kedua metode (SA & Gamma) sekaligus
 * dan mengembalikan keduanya beserta perbandingan.
 * Hanya valid untuk 3 atau 5 layer.
 */
class ComparisonCalculator {
    /**
     * @param {CLTLayupType} cltLayup
     * @returns {{ shearAnalogy: PanelPropertiesType, gamma: PanelPropertiesType, diff: number }}
     */
    static calculate(cltLayup) {
        const n = cltLayup.getLayerCount();
        if (n !== 3 && n !== 5) {
            throw new Error('Comparison hanya tersedia untuk 3 atau 5 layer.');
        }

        const saResult = new ShearAnalogyMethod().calculate(cltLayup);
        const gmResult = new GammaMethod().calculate(cltLayup);

        const diff = ((gmResult.EIeff - saResult.EIeff) / saResult.EIeff) * 100;

        return { shearAnalogy: saResult, gamma: gmResult, diffPercent: diff };
    }
}
