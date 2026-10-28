// Info-panel data per module ID. Text lives in the locales (modules.<id>.name / .desc); this file
// only maps each module to its pillar in the formula Living Plant + Modular Structure + Smart
// Technology, plus the numbers its description quotes.
// Every number here must come from docs/business_plan.md:
//   solar 120 W  → "Status Baterai & Daya Panel Surya (120W)"
//   EC ≈ 1.8 mS/cm → "Konduktivitas Elektrik / Nutrisi (EC ≈ 1,8 mS/cm)"
// facts: { placeholder: { value, unit (locale key under units.*), digits } }

export const MODULE_INFO = {
  trunk_base: { pillar: 'structure' },
  green_tank: { pillar: 'tech' },
  distribution_pipe: { pillar: 'tech' },
  nutrient_tank: { pillar: 'tech', facts: { ec: { value: 1.8, unit: 'msPerCm', digits: 1 } } },
  battery: { pillar: 'tech' },
  tree_crown: { pillar: 'plant' },
  solar_panel: { pillar: 'tech', facts: { power: { value: 120, unit: 'watt', digits: 0 } } },
  branch_apple: { pillar: 'plant' },
  branch_mango: { pillar: 'plant' },
  branch_grape: { pillar: 'plant' },
  branch_orange: { pillar: 'plant' },
}
