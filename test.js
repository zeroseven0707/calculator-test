// test.js — jalankan dengan: node test.js
const fs = require('fs');

// Konkatenasi semua file ke satu scope global
const allCode = [
    'type/material-grade-type.js',
    'type/clt-layer-type.js',
    'type/clt-layup-type.js',
    'type/clt-layer-properties-type.js',
    'type/panel-properties-type.js',
    'calculation/panel-properties.js',
].map(f => fs.readFileSync(f, 'utf8')).join('\n');

// Jalankan di global scope Node dengan Function wrapper
const g = new Function(allCode + '\nreturn { CLTLayupType, CLTLayerType, CLTLayerPropertiesType, PanelPropertiesType, MaterialGrade, MATERIAL_GRADES, PanelProperties, ShearAnalogyMethod, GammaMethod };')();
const { CLTLayupType, CLTLayerType, MATERIAL_GRADES, ShearAnalogyMethod, GammaMethod } = g;

// ─── Tests ───────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
function assert(name, cond, info) {
    if (cond) { console.log('  ✅', name); pass++; }
    else       { console.log('  ❌', name, info || ''); fail++; }
}

console.log('\n=== SHEAR ANALOGY ===');

// T1: 5-layer, hasil harus cocok dengan Excel 2.122313E+12
const layup5 = new CLTLayupType('5L', 1000, 5000);
[0,90,0,90,0].forEach(a => layup5.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
const r5 = new ShearAnalogyMethod().calculate(layup5);
// Expected: E=10000 MPa (MGP10 corrected), 5L-35 uniform, beff=1000
assert('Shear 5L EIeff ≈ 1.9294E+13', Math.abs(r5.EIeff - 1.929375e13) < 1e7,
    'got: '+r5.EIeff.toExponential(6));

// T2: 3-layer simetris
const layup3s = new CLTLayupType('3L', 1000, 5000);
[0,90,0].forEach(a => layup3s.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
const r3s = new ShearAnalogyMethod().calculate(layup3s);
assert('Shear 3L tidak throw', r3s && r3s.EIeff > 0);

// T3: 7-layer
const layup7 = new CLTLayupType('7L', 1000, 5000);
[0,90,0,90,0,90,0].forEach(a => layup7.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
const r7 = new ShearAnalogyMethod().calculate(layup7);
assert('Shear 7L tidak throw', r7 && r7.EIeff > 0);

// T4: 9-layer
const layup9 = new CLTLayupType('9L', 1000, 5000);
[0,90,0,90,0,90,0,90,0].forEach(a => layup9.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
const r9 = new ShearAnalogyMethod().calculate(layup9);
assert('Shear 9L tidak throw', r9 && r9.EIeff > 0);

// T5: asimetris harus throw
const asymL = new CLTLayupType('asym', 1000, 5000);
[0,90,0,0,0].forEach(a => asymL.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
let symErr = false;
try { new ShearAnalogyMethod().calculate(asymL); }
catch(e) { symErr = true; }
assert('Shear asimetris → throw', symErr);

// T6: 10-layer harus throw (>9)
const layup10 = new CLTLayupType('10L', 1000, 5000);
for(let i=0;i<10;i++) layup10.addLayer(new CLTLayerType(35, i%2===0?0:90, MATERIAL_GRADES.MGP10));
let overErr = false;
try { new ShearAnalogyMethod().calculate(layup10); }
catch(e) { overErr = true; }
assert('Shear 10L → throw (>9)', overErr);

// T7: 2-layer harus throw (<3)
const layup2 = new CLTLayupType('2L', 1000, 5000);
[0,90].forEach(a => layup2.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
let underErr = false;
try { new ShearAnalogyMethod().calculate(layup2); }
catch(e) { underErr = true; }
assert('Shear 2L → throw (<3)', underErr);

console.log('\n=== GAMMA METHOD ===');

// T8: Gamma 5-layer — E=10000 MPa (MGP10 corrected)
const r5g = new GammaMethod().calculate(layup5);
assert('Gamma 5L EIeff ≈ 3.537E+12', Math.abs(r5g.EIeff - 3.536917e12) < 2e9,
    'got: '+r5g.EIeff.toExponential(6));
assert('Gamma 5L gammaValues length = 3', r5g.gammaValues.length === 3);
assert('Gamma 5L centroid tersedia', typeof r5g.centroid === 'number');

// T9: Gamma 3-layer
const r3g = new GammaMethod().calculate(layup3s);
assert('Gamma 3L tidak throw', r3g && r3g.EIeff > 0);
assert('Gamma 3L gammaValues length = 2', r3g.gammaValues.length === 2);

// T10: Gamma 4-layer harus throw
let g4err = false;
const layup4 = new CLTLayupType('4L', 1000, 5000);
[0,90,0,90].forEach(a => layup4.addLayer(new CLTLayerType(35, a, MATERIAL_GRADES.MGP10)));
try { new GammaMethod().calculate(layup4); }
catch(e) { g4err = true; }
assert('Gamma 4L → throw (bukan 3/5)', g4err);

// T11: Gamma 7-layer harus throw
let g7err = false;
try { new GammaMethod().calculate(layup7); }
catch(e) { g7err = true; }
assert('Gamma 7L → throw (bukan 3/5)', g7err);

// T12: isSymmetric
assert('5L simetris', layup5.isSymmetric());
assert('5L asimetris terdeteksi', !asymL.isSymmetric());

console.log(`\n${'─'.repeat(45)}`);
console.log(`Hasil: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
