/**
 * Small editable starter menu for Vula's Car Wash.
 * These are sensible guide prices, not verified Vula prices. Staff can edit
 * the names, descriptions, prices and durations in the staff dashboard.
 */
export type VulaServiceSeed = { id: string; name: string; category: string; description: string; price: number; durationMinutes: number };
export const vulaServiceSeed: VulaServiceSeed[] = [
  { id: "wash-sedan", name: "Basic wash — car", category: "Basic wash", description: "Exterior hand wash, rinse, wheels and tyres.", price: 60, durationMinutes: 30 },
  { id: "wash-suv-bakkie", name: "Basic wash — SUV / bakkie", category: "Basic wash", description: "Exterior hand wash for SUVs, crossovers and bakkies.", price: 70, durationMinutes: 35 },
  { id: "inside-vacuum", name: "Wash + interior clean", category: "Inside & out", description: "Exterior wash plus interior vacuum and dashboard wipe-down.", price: 120, durationMinutes: 45 },
  { id: "wash-premium", name: "Premium wash & shine", category: "Premium wash", description: "Exterior wash with extra finish attention and tyre dressing.", price: 150, durationMinutes: 50 }
];
