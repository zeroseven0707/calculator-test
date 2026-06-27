/**
 * CLTLayupType merepresentasikan susunan lengkap lapisan-lapisan (layers) panel CLT.
 * 
 * CLT (Cross-Laminated Timber) terdiri dari beberapa lapisan kayu yang disusun
 * bersilang (alternating 0° dan 90°). CLTLayupType menyimpan koleksi CLTLayerType
 * beserta parameter panel seperti lebar efektif (beff) dan panjang bentang.
 */
class CLTLayupType {
    /**
     * @param {string} name  - Nama layup (misal: "5-Layer CLT")
     * @param {number} beff  - Lebar efektif panel (mm), default 1000 mm/m
     * @param {number} Lref  - Panjang referensi/bentang (mm)
     */
    constructor(name = 'CLT Layup', beff = 1000, Lref = 5000) {
        this.name  = name;
        this.beff  = beff;   // mm
        this.Lref  = Lref;   // mm (digunakan Gamma Method)
        /**
         * @type {CLTLayerType[]}
         */
        this.layers = [];
    }

    /**
     * Menambah layer ke layup.
     * @param {CLTLayerType} layer
     */
    addLayer(layer) {
        if (!(layer instanceof CLTLayerType)) {
            throw new Error('Layer harus instance dari CLTLayerType');
        }
        this.layers.push(layer);
    }

    /**
     * Mengembalikan semua layer.
     * @returns {CLTLayerType[]}
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Mengembalikan jumlah layer.
     * @returns {number}
     */
    getLayerCount() {
        return this.layers.length;
    }

    /**
     * Menghitung total tebal panel.
     * @returns {number} Total tebal (mm)
     */
    getTotalThickness() {
        return this.layers.reduce((sum, l) => sum + l.thickness, 0);
    }

    /**
     * Validasi bahwa layup simetris (layer 1 = layer N, layer 2 = layer N-1, dst).
     * Dibutuhkan oleh Shear Analogy Method.
     * @returns {boolean}
     */
    isSymmetric() {
        const n = this.layers.length;
        for (let i = 0; i < Math.floor(n / 2); i++) {
            const top    = this.layers[i];
            const bottom = this.layers[n - 1 - i];
            if (
                top.thickness !== bottom.thickness ||
                top.angle     !== bottom.angle     ||
                top.material.name !== bottom.material.name
            ) {
                return false;
            }
        }
        return true;
    }
}
