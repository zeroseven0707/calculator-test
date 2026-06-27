/**
 * PanelPropertiesType menyimpan hasil akhir kalkulasi sifat panel CLT.
 * 
 * Properti utama:
 *  - EIeff      : Effective Bending Stiffness (N·mm²/m)
 *  - EAeff      : Effective Axial Stiffness (N/m)
 *  - method     : Metode yang digunakan ('ShearAnalogy' atau 'Gamma')
 *  - layers     : Array CLTLayerPropertiesType (detail per layer)
 *  - centroid   : Titik netral dari dasar panel (mm)
 *  - gammaValues: Koefisien gamma per layer efektif (Gamma Method)
 *  - aiValues   : Jarak ai per layer efektif dari centroid (Gamma Method)
 */
class PanelPropertiesType {
    /**
     * @param {string}                    method - Nama metode kalkulasi
     * @param {number}                    EIeff  - Kekakuan lentur efektif (N·mm²/m)
     * @param {CLTLayerPropertiesType[]}  layers - Properti per layer
     * @param {number}                    EAeff  - Kekakuan aksial efektif (N/m), opsional
     */
    constructor(method, EIeff, layers = [], EAeff = 0) {
        this.method    = method;
        this.EIeff     = EIeff;
        this.EAeff     = EAeff;
        this.layers    = layers;
        this.centroid  = null;       // diisi oleh Gamma Method
        this.gammaValues = null;     // diisi oleh Gamma Method
        this.aiValues    = null;     // diisi oleh Gamma Method
    }
}
