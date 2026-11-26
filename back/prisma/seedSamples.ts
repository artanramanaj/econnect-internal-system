import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { reservePartnerNumber } from "../services/documentSequence.js";

/**
 * Sample partners for a development database: `npm run seed:samples`.
 *
 * Kept out of the main seed on purpose — that one also runs in production,
 * which must never receive invented companies. Safe to re-run: a partner whose
 * legal name already exists is skipped.
 */
const SAMPLE_PARTNERS = [
  {
    legalName: "Northgate Logistics Sh.p.k.",
    tradeName: "Northgate Logistics",
    city: "Prishtinë",
    fiscalNumber: "600112233",
    email: "it@northgate.example",
    phone: "+383 44 000 112",
    paymentTerms: "50% advance, 50% on completion",
    sites: [
      { name: "Main warehouse", address: "Zona Industriale", city: "Prishtinë" },
      { name: "Head office", address: "Rr. Agim Ramadani", city: "Prishtinë" },
    ],
  },
  {
    legalName: "Blue River Hotel Sh.p.k.",
    tradeName: "Blue River Hotel",
    city: "Prizren",
    fiscalNumber: "600087087",
    email: "tech@blueriver.example",
    phone: "+383 44 000 087",
    paymentTerms: "30 days after invoice",
    sites: [{ name: "Hotel — east wing", address: "Shadërvan", city: "Prizren" }],
  },
  {
    legalName: "Central Clinic Sh.p.k.",
    tradeName: "Central Clinic",
    city: "Prishtinë",
    fiscalNumber: "600064064",
    email: "facilities@clinic.example",
    phone: "+383 44 000 064",
    paymentTerms: "50% advance, 50% on completion",
    sites: [{ name: "Laboratory", address: "Lagjja e Spitalit", city: "Prishtinë" }],
  },
  {
    legalName: "Riverside Mall Sh.p.k.",
    tradeName: "Riverside Mall",
    city: "Pejë",
    fiscalNumber: "600101101",
    email: "facility@riverside.example",
    phone: "+383 44 000 101",
    paymentTerms: "100% on delivery",
    sites: [
      { name: "Food court", address: "Rr. Mbretëresha Teutë", city: "Pejë" },
      { name: "Parking level", address: "Rr. Mbretëresha Teutë", city: "Pejë" },
    ],
  },
  {
    legalName: "Arena Business Center Sh.p.k.",
    tradeName: "Arena Business Center",
    city: "Ferizaj",
    fiscalNumber: "600121121",
    email: "ops@arena.example",
    phone: "+383 44 000 121",
    paymentTerms: "50% advance, 50% on completion",
    sites: [],
  },
];

async function main() {
  let created = 0;

  for (const { sites, ...partner } of SAMPLE_PARTNERS) {
    const exists = await prisma.partner.findFirst({
      where: { legalName: partner.legalName },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.$transaction(async (tx) => {
      const partnerNumber = await reservePartnerNumber(tx);
      await tx.partner.create({
        data: { ...partner, partnerNumber, isCustomer: true, sites: { create: sites } },
      });
    });
    created++;
  }

  console.log(`Sample partners: ${created} created, ${await prisma.partner.count()} in total.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
