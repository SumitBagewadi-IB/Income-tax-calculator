/* ============================================================
   Indiabulls Securities – Income Tax Calculator Logic
   Covers FY 2025-26 (AY 2025-26) Old & New Regime
   ============================================================ */

function getVal(id) {
  return parseFloat(document.getElementById(id).value) || 0;
}

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/* ---------- Slab tax (generic) ---------- */
function slabTax(income, slabs) {
  let tax = 0;
  for (const [limit, rate] of slabs) {
    if (income <= 0) break;
    const chunk = limit === Infinity ? income : Math.min(income, limit);
    tax += chunk * rate;
    income -= chunk;
  }
  return tax;
}

/* ---------- Surcharge ---------- */
function surcharge(income, tax, regime) {
  if (income <= 5000000) return 0;
  let rate = 0;
  if (income <= 10000000)       rate = 0.10;
  else if (income <= 20000000)  rate = 0.15;
  else if (income <= 50000000)  rate = 0.25;
  else rate = regime === 'new' ? 0.25 : 0.37;
  return tax * rate;
}

/* ---------- New Regime Tax (FY 2025-26) ---------- */
// Slabs: https://incometaxindia.gov.in  (Budget 2025 – default regime)
// Basic exemption ₹3L, rebate 87A up to ₹7L (net taxable)
const NEW_SLABS = [
  [300000,  0.00],
  [400000,  0.05],   // 3L–7L → 5%
  [300000,  0.10],   // 7L–10L → 10%
  [200000,  0.15],   // 10L–12L → 15%
  [300000,  0.20],   // 12L–15L → 20%
  [Infinity,0.30],   // >15L → 30%
];

function calcNewRegime(grossIncome, age) {
  const stdDeduction = 75000;
  const taxableIncome = Math.max(0, grossIncome - stdDeduction);
  let tax = slabTax(taxableIncome, NEW_SLABS);

  // Rebate u/s 87A: full rebate if taxable income ≤ 7,00,000
  if (taxableIncome <= 700000) tax = 0;

  const sc = surcharge(taxableIncome, tax, 'new');
  const cess = (tax + sc) * 0.04;
  const total = tax + sc + cess;

  return {
    taxableIncome,
    baseTax: tax,
    surcharge: sc,
    cess,
    total,
    stdDeduction,
    deductions: 0,
  };
}

/* ---------- Old Regime Tax ---------- */
// Slabs vary by age
function oldSlabs(age) {
  if (age === 'above80') {
    return [
      [500000,  0.00],
      [500000,  0.20],
      [Infinity,0.30],
    ];
  } else if (age === '60to80') {
    return [
      [300000,  0.00],
      [200000,  0.05],
      [500000,  0.20],
      [Infinity,0.30],
    ];
  } else {
    return [
      [250000,  0.00],
      [250000,  0.05],
      [500000,  0.20],
      [Infinity,0.30],
    ];
  }
}

function calcOldRegime(grossIncome, age, deductionData) {
  const stdDeduction = 50000;

  // Cap deductions
  const d80c  = Math.min(deductionData.sec80c,  150000);
  const d80ccd= Math.min(deductionData.sec80ccd, 50000);
  const d80d  = Math.min(deductionData.sec80d,   75000);
  const d80e  = deductionData.sec80e;
  const d80g  = deductionData.sec80g;
  const d80tta= Math.min(deductionData.sec80tta, 10000);
  const homeLoanSelf = Math.min(deductionData.homeLoanSelf, 200000);
  const homeLoanLetOut = deductionData.homeLoanLetOut;

  const totalDeductions = stdDeduction + d80c + d80ccd + d80d + d80e + d80g + d80tta
    + homeLoanSelf + homeLoanLetOut;

  const taxableIncome = Math.max(0, grossIncome - totalDeductions);
  let tax = slabTax(taxableIncome, oldSlabs(age));

  // Rebate u/s 87A: full rebate if taxable income ≤ 5,00,000
  if (taxableIncome <= 500000) tax = 0;

  const sc = surcharge(taxableIncome, tax, 'old');
  const cess = (tax + sc) * 0.04;
  const total = tax + sc + cess;

  return {
    taxableIncome,
    baseTax: tax,
    surcharge: sc,
    cess,
    total,
    stdDeduction,
    deductions: totalDeductions - stdDeduction,
    breakdown: { d80c, d80ccd, d80d, d80e, d80g, d80tta, homeLoanSelf, homeLoanLetOut },
  };
}

/* ---------- Main calculate() ---------- */
function calculate() {
  const age = document.getElementById('ageCategory').value;
  const ay  = document.getElementById('assessmentYear').value;

  const grossSalary   = getVal('grossSalary');
  const otherIncome   = getVal('otherIncome');
  const interestIncome= getVal('interestIncome');
  const rentalIncome  = getVal('rentalIncome');

  const grossTotal = grossSalary + otherIncome + interestIncome + rentalIncome;

  if (grossTotal === 0) {
    alert('Please enter at least one income amount.');
    return;
  }

  const deductionData = {
    sec80c:       getVal('sec80c'),
    sec80ccd:     getVal('sec80ccd'),
    sec80d:       getVal('sec80d'),
    sec80e:       getVal('sec80e'),
    sec80g:       getVal('sec80g'),
    sec80tta:     getVal('sec80tta'),
    homeLoanSelf: getVal('homeLoanSelf'),
    homeLoanLetOut: getVal('homeLoanLetOut'),
  };

  const newResult = calcNewRegime(grossTotal, age);
  const oldResult = calcOldRegime(grossTotal, age, deductionData);

  renderResults(newResult, oldResult, grossTotal, ay, age);
}

/* ---------- Render Results ---------- */
function renderResults(nr, or, grossTotal, ay, age) {
  document.getElementById('resultsPlaceholder').classList.add('hidden');
  const content = document.getElementById('resultsContent');
  content.classList.remove('hidden');

  const ageLabel = { below60: 'Below 60', '60to80': '60–80 yrs', above80: 'Above 80 yrs' }[age];
  document.getElementById('resultsMeta').textContent =
    `AY ${ay} | Age: ${ageLabel} | Gross Income: ${fmt(grossTotal)}`;

  // Totals
  document.getElementById('newTaxTotal').textContent = fmt(nr.total);
  document.getElementById('oldTaxTotal').textContent = fmt(or.total);

  // Breakdown
  document.getElementById('newBreakdown').innerHTML =
    `Base Tax: ${fmt(nr.baseTax)}<br>` +
    (nr.surcharge ? `Surcharge: ${fmt(nr.surcharge)}<br>` : '') +
    `Cess (4%): ${fmt(nr.cess)}`;

  document.getElementById('oldBreakdown').innerHTML =
    `Base Tax: ${fmt(or.baseTax)}<br>` +
    (or.surcharge ? `Surcharge: ${fmt(or.surcharge)}<br>` : '') +
    `Cess (4%): ${fmt(or.cess)}`;

  // Recommended badge
  document.getElementById('newRecommended').classList.add('hidden');
  document.getElementById('oldRecommended').classList.add('hidden');
  document.getElementById('newRegimeCard').style.borderWidth = '2px';
  document.getElementById('oldRegimeCard').style.borderWidth = '2px';

  const savingBanner = document.getElementById('savingsBanner');
  if (nr.total < or.total) {
    document.getElementById('newRecommended').classList.remove('hidden');
    document.getElementById('newRegimeCard').style.borderWidth = '3px';
    const saving = or.total - nr.total;
    savingBanner.textContent = `You save ${fmt(saving)} by choosing the New Tax Regime.`;
  } else if (or.total < nr.total) {
    document.getElementById('oldRecommended').classList.remove('hidden');
    document.getElementById('oldRegimeCard').style.borderWidth = '3px';
    const saving = nr.total - or.total;
    savingBanner.textContent = `You save ${fmt(saving)} by choosing the Old Tax Regime.`;
  } else {
    savingBanner.textContent = 'Both regimes result in the same tax liability.';
  }

  // Income Summary Table
  const rows = [
    ['Gross Salary', getVal('grossSalary')],
    ['Other Income', getVal('otherIncome')],
    ['Interest Income', getVal('interestIncome')],
    ['Rental Income', getVal('rentalIncome')],
    ['Total Gross Income', grossTotal],
    ['—', null],
    ['Standard Deduction (New)', nr.stdDeduction],
    ['Net Taxable Income (New)', nr.taxableIncome],
    ['—', null],
    ['Standard Deduction (Old)', or.stdDeduction],
    ['Other Deductions (Old)', or.deductions],
    ['Net Taxable Income (Old)', or.taxableIncome],
  ];

  const table = document.getElementById('incomeSummaryTable');
  table.innerHTML = rows.map(([label, val]) => {
    if (val === null) return `<tr><td colspan="2" style="padding:4px 0;border:none;"></td></tr>`;
    if (val === 0 && !['Total Gross Income','Net Taxable Income (New)','Net Taxable Income (Old)'].includes(label)) return '';
    return `<tr><td>${label}</td><td>${fmt(val)}</td></tr>`;
  }).join('');
}

/* ---------- Reset ---------- */
function resetForm() {
  const inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach(i => i.value = '');
  document.getElementById('resultsPlaceholder').classList.remove('hidden');
  document.getElementById('resultsContent').classList.add('hidden');
}
