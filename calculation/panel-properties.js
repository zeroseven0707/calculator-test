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

        // Hitung yi = jarak dari dasar panel ke titik tengah layer-i
        // Formula Excel: yi = SUM(layer-i ... layer-n) + ti/2
        // (dihitung dari layer-i sampai layer terbawah, lalu tambah ti/2)
        const yi = layers.map((_, i) => {
            let sum = 0;
            for (let j = i; j < n; j++) sum += layers[j].thickness;
            return sum + layers[i].thickness / 2;
        });

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

        return new PanelPropertiesType('ShearAnalogy', EIeff, layerProps);
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

        const result       = new PanelPropertiesType('Gamma', EIeff, layerProps);
        result.gammaValues = gamma;
        result.aiValues    = ai;
        result.centroid    = centroid;
        return result;
    }
}
