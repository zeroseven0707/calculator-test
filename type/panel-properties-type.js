/**
 * PanelPropertiesType menyimpan hasil akhir kalkulasi sifat panel CLT.
 * 
 * Properti utama:
 *  - EIeff : Effective Bending Stiffness (N·mm²/m)
 *  - method: Metode yang digunakan ('ShearAnalogy' atau 'Gamma')
 *  - layers : Array CLTLayerPropertiesType (detail per layer)
 */
class PanelPropertiesType {
    /**
     * @param {string}                    method - Nama metode kalkulasi
     * @param {number}                    EIeff  - Kekakuan lentur efektif (N·mm²/m)
     * @param {CLTLayerPropertiesType[]}  layers - Properti per layer
     */
    constructor(method, EIeff, layers = []) {
        this.method = method;
        this.EIeff  = EIeff;
        this.layers = layers;
    }
}
