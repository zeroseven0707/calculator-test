/**
 * CLTLayerPropertiesType menyimpan hasil perhitungan properti untuk satu layer.
 * Digunakan sebagai detail per-layer dalam hasil kalkulasi panel.
 */
class CLTLayerPropertiesType {
    /**
     * @param {number} index     - Nomor layer (0-based)
     * @param {number} ti        - Tebal layer (mm)
     * @param {number} yi        - Jarak dari dasar panel ke titik tengah layer (mm)
     * @param {number} angle     - Sudut orientasi serat (0 atau 90 derajat)
     * @param {number} Exx       - Modulus elastisitas arah XX (MPa)
     * @param {number} hi        - Jarak dari centroid panel ke titik tengah layer (mm)
     * @param {number} Gi        - Modulus geser (MPa)
     * @param {number} beffTi3   - beff * ti³ / 12 (mm⁴)  — momen inersia sendiri
     * @param {number} beffTiHi2 - beff * ti * hi² (mm⁴)  — kontribusi Steiner
     * @param {number} EiIi      - Ei * (beffTi3 + beffTiHi2) (N·mm²/m)
     */
    constructor({ index, ti, yi, angle, Exx, hi, Gi, beffTi3, beffTiHi2, EiIi }) {
        this.index     = index;
        this.ti        = ti;
        this.yi        = yi;
        this.angle     = angle;
        this.Exx       = Exx;
        this.hi        = hi;
        this.Gi        = Gi;
        this.beffTi3   = beffTi3;
        this.beffTiHi2 = beffTiHi2;
        this.EiIi      = EiIi;
    }
}
