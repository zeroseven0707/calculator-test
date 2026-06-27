/**
 * CLTLayerType merepresentasikan satu lapisan (layer) dalam panel CLT.
 * 
 * Setiap layer memiliki:
 *  - thickness (ti): tebal layer dalam mm
 *  - angle (θi): sudut orientasi serat (0° = paralel sumbu X, 90° = tegak lurus)
 *  - material: grade material kayu yang digunakan
 */
class CLTLayerType {
    /**
     * @param {number}        thickness - Tebal layer (mm)
     * @param {number}        angle     - Sudut orientasi serat: 0 atau 90 (derajat)
     * @param {MaterialGrade} material  - Material grade layer ini
     */
    constructor(thickness, angle, material) {
        if (typeof thickness !== 'number' || thickness <= 0) {
            throw new Error('Thickness harus berupa angka positif (mm)');
        }
        if (angle !== 0 && angle !== 90) {
            throw new Error('Angle harus 0° (paralel) atau 90° (tegak lurus)');
        }
        if (!(material instanceof MaterialGrade)) {
            throw new Error('Material harus instance dari MaterialGrade');
        }

        this.thickness = thickness;   // ti (mm)
        this.angle     = angle;       // θi (0 atau 90 derajat)
        this.material  = material;    // grade material
    }

    /**
     * Mengembalikan modulus elastisitas efektif pada arah XX berdasarkan sudut serat.
     * Layer 0°  → menggunakan E (paralel serat)
     * Layer 90° → menggunakan 0 (tidak berkontribusi ke lentur arah X)
     * @returns {number} Ei,XX (MPa)
     */
    getExx() {
        return this.angle === 0 ? this.material.E : 0;
    }

    /**
     * Mengembalikan modulus geser efektif layer berdasarkan sudut serat.
     * Layer 0°  → G (in-plane shear)
     * Layer 90° → G_90 (rolling shear)
     * @returns {number} Gi (MPa)
     */
    getG() {
        return this.angle === 0 ? this.material.G : this.material.G_90;
    }
}
