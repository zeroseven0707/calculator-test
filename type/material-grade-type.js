/**
 * MaterialGrade menyimpan properti mekanik material kayu
 * E     = Modulus elastisitas arah paralel serat (MPa)
 * E_90  = Modulus elastisitas arah tegak lurus serat (MPa)
 * G     = Modulus geser arah paralel serat (MPa)
 * G_90  = Modulus geser arah tegak lurus serat (MPa)
 */
class MaterialGrade {
    /**
     * @param {string} name  - Nama grade material (misal: "MGP10", "MGP12")
     * @param {number} E     - Modulus elastisitas paralel (MPa)
     * @param {number} E_90  - Modulus elastisitas tegak lurus (MPa)
     * @param {number} G     - Modulus geser paralel (MPa)
     * @param {number} G_90  - Modulus geser tegak lurus (MPa)
     */
    constructor(name, E, E_90, G, G_90) {
        this.name = name;
        this.E    = E;
        this.E_90 = E_90;
        this.G    = G;
        this.G_90 = G_90;
    }
}

/**
 * Daftar grade material yang tersedia (dari Excel sheet)
 */
const MATERIAL_GRADES = {
    MGP10: new MaterialGrade('MGP10', 1100, 110, 687.5, 62.5),
    MGP12: new MaterialGrade('MGP12', 1100, 110, 687.5, 62.5),
};
