/**
 * Starter catalogue for Vula's Car Wash.
 * Prices are editable estimates informed by public Botswana car-wash listings,
 * not official prices or claims about Vula's current pricing. Staff must review
 * each price before publishing the catalogue to customers.
 */
export type VulaServiceSeed = { id: string; name: string; category: string; description: string; price: number; durationMinutes: number };
export const vulaServiceSeed: VulaServiceSeed[] = [
  { id: "wash-sedan", name: "Exterior wash — sedan / hatchback", category: "Wash & clean", description: "Exterior hand wash, rinse, wheels and tyres. Vehicle condition may affect the final quote.", price: 60, durationMinutes: 30 },
  { id: "wash-suv-bakkie", name: "Exterior wash — SUV / bakkie", category: "Wash & clean", description: "Exterior hand wash for SUVs, crossovers and bakkies.", price: 70, durationMinutes: 35 },
  { id: "wash-minibus", name: "Exterior wash — minibus", category: "Wash & clean", description: "Exterior wash for minibuses and larger passenger vehicles.", price: 80, durationMinutes: 45 },
  { id: "wash-premium", name: "Premium wash & shine", category: "Wash & clean", description: "Exterior wash with extra finish attention and tyre dressing.", price: 120, durationMinutes: 45 },
  { id: "inside-vacuum", name: "Interior vacuum & wipe-down", category: "Interior care", description: "Vacuum accessible interior surfaces and wipe dashboard and door panels.", price: 80, durationMinutes: 30 },
  { id: "inside-out", name: "Full inside & outside clean", category: "Wash & clean", description: "Exterior wash plus interior vacuum and wipe-down. Deep stains are quoted separately.", price: 150, durationMinutes: 60 },
  { id: "mat-clean", name: "Floor mats deep clean", category: "Interior care", description: "Clean and refresh removable floor mats.", price: 40, durationMinutes: 20 },
  { id: "seat-shampoo", name: "Seat shampoo / fabric extraction", category: "Interior care", description: "Deep clean fabric seats; final price depends on seat count and condition.", price: 250, durationMinutes: 120 },
  { id: "interior-detail", name: "Deep interior valet", category: "Detailing", description: "Detailed interior clean including seats, carpets, panels and hard-to-reach areas.", price: 300, durationMinutes: 150 },
  { id: "full-valet-sedan", name: "Full valet — small car", category: "Detailing", description: "Inside-and-out valet for a small car. Staff confirm condition and inclusions before work begins.", price: 450, durationMinutes: 180 },
  { id: "full-valet-large", name: "Full valet — SUV / bakkie", category: "Detailing", description: "Inside-and-out valet for a larger vehicle. Final quote may vary with vehicle condition.", price: 600, durationMinutes: 210 },
  { id: "engine-clean", name: "Engine bay clean", category: "Detailing", description: "Careful engine-bay cleaning subject to a condition and safety check.", price: 100, durationMinutes: 40 },
  { id: "polish-glaze", name: "Machine polish / glazing", category: "Paint & finish", description: "Paint enhancement; inspection required to confirm scope and final price.", price: 250, durationMinutes: 120 },
  { id: "wax-protection", name: "Wax protection", category: "Paint & finish", description: "Apply wax protection after a suitable wash and surface preparation.", price: 150, durationMinutes: 45 },
  { id: "headlight-restore", name: "Headlight restoration", category: "Paint & finish", description: "Restore clarity to hazy headlights. Results depend on lens condition.", price: 250, durationMinutes: 60 },
  { id: "carpet-clean", name: "Carpet / boot deep clean", category: "Interior care", description: "Deep clean vehicle carpet or boot area; heavy staining may need a custom quote.", price: 150, durationMinutes: 60 },
  { id: "leather-care", name: "Leather clean & condition", category: "Interior care", description: "Clean and condition leather or leatherette surfaces after material check.", price: 180, durationMinutes: 60 },
  { id: "odor-treatment", name: "Odour treatment", category: "Interior care", description: "Interior odour treatment. Persistent odours may require a specialist quote.", price: 120, durationMinutes: 45 },
  { id: "mobile-callout", name: "Mobile service call-out", category: "Mobile service", description: "Starter call-out estimate for approved coverage areas; distance and access can change the quote.", price: 80, durationMinutes: 30 },
  { id: "fleet-wash", name: "Fleet / repeat wash plan", category: "Fleet & business", description: "Recurring fleet care; final rate depends on fleet size, frequency, vehicle mix and location.", price: 0, durationMinutes: 30 }
];
