/**
 * MaterialGrade menyimpan properti mekanik material kayu
 * E     = Modulus elastisitas arah paralel serat (MPa)
 * E_90  = Modulus elastisitas arah tegak lurus serat (MPa)
 * G     = Modulus geser arah paralel serat (MPa)
 * G_90  = Modulus geser arah tegak lurus serat (MPa)
 * fb    = Kuat lentur karakteristik (MPa)  — untuk cek kapasitas
 * ft    = Kuat tarik paralel serat (MPa)
 * fc    = Kuat tekan paralel serat (MPa)
 * fv    = Kuat geser (MPa)
 */
class MaterialGrade {
    /**
     * @param {string} name  - Nama grade material
     * @param {number} E     - Modulus elastisitas paralel (MPa)
     * @param {number} E_90  - Modulus elastisitas tegak lurus (MPa)
     * @param {number} G     - Modulus geser paralel (MPa)
     * @param {number} G_90  - Modulus geser tegak lurus / rolling shear (MPa)
     * @param {number} fb    - Kuat lentur karakteristik (MPa)
     * @param {number} ft    - Kuat tarik paralel (MPa)
     * @param {number} fc    - Kuat tekan paralel (MPa)
     * @param {number} fv    - Kuat geser (MPa)
     * @param {string} category - 'sawn' | 'glulam'
     */
    constructor(name, E, E_90, G, G_90, fb = 0, ft = 0, fc = 0, fv = 0, category = 'sawn') {
        this.name     = name;
        this.E        = E;
        this.E_90     = E_90;
        this.G        = G;
        this.G_90     = G_90;
        this.fb       = fb;
        this.ft       = ft;
        this.fc       = fc;
        this.fv       = fv;
        this.category = category;
    }
}

/**
 * Daftar grade material yang tersedia
 * Sumber: AS 1720.1-2010 & proHolz Vol.1
 */
const MATERIAL_GRADES = {
    // ── Sawn timber (MGP) ────────────────────────────────────────────────────
    MGP10: new MaterialGrade('MGP10', 10000, 300, 625,  62.5, 20, 14, 18, 3.1, 'sawn'),
    MGP12: new MaterialGrade('MGP12', 12500, 375, 781,  78.1, 24, 16, 20, 3.4, 'sawn'),
    MGP15: new MaterialGrade('MGP15', 15000, 450, 938,  93.8, 30, 20, 24, 4.0, 'sawn'),
    // ── Structural grades (F-grade) ──────────────────────────────────────────
    F7:  new MaterialGrade('F7',  9100,  275, 569,  56.9, 14, 9,  15, 2.5, 'sawn'),
    F14: new MaterialGrade('F14', 14000, 420, 875,  87.5, 28, 18, 22, 3.7, 'sawn'),
    F17: new MaterialGrade('F17', 17500, 525, 1094, 109,  34, 21, 26, 4.5, 'sawn'),
    // ── Glulam (GL) ──────────────────────────────────────────────────────────
    GL8:  new MaterialGrade('GL8',  8000,  240, 500,  50,  16, 11, 16, 2.8, 'glulam'),
    GL12: new MaterialGrade('GL12', 12000, 360, 750,  75,  24, 16, 20, 3.5, 'glulam'),
    GL17: new MaterialGrade('GL17', 17000, 510, 1063, 106, 34, 22, 27, 4.6, 'glulam'),
};
