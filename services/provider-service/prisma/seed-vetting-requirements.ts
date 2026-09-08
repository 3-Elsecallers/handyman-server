import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const IMAGE_PDF_MIME = ["image/jpeg", "image/png", "application/pdf"];
const IMAGE_MIME = ["image/jpeg", "image/png"];

type RequirementInput = {
  type: "document" | "attestation" | "certification";
  name: string;
  description?: string;
  isRequired: boolean;
  acceptedMimeTypes?: string[];
  maxFileSizeMb?: number;
  sortOrder: number;
};

type QuestionInput = {
  question: string;
  type: "yes_no" | "text" | "single_choice" | "multiple_choice";
  options?: string[];
  isRequired: boolean;
  sortOrder: number;
};

const CATEGORY_SEEDS: Record<
  string,
  {
    safetyRiskLevel: string;
    requirements: RequirementInput[];
    questions?: QuestionInput[];
  }
> = {
  cleaning: {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "attestation",
        name: "Equipment Declaration",
        description:
          "Confirm the cleaning equipment and supplies you use for your services.",
        isRequired: false,
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Training Certification",
        description:
          "Upload any cleaning training or certification documents you hold.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
    ],
    questions: [
      {
        question:
          "How many years of professional cleaning experience do you have?",
        type: "single_choice",
        options: [
          "Less than 1 year",
          "1-3 years",
          "3-5 years",
          "5-10 years",
          "10+ years",
        ],
        isRequired: true,
        sortOrder: 0,
      },
      {
        question: "What cleaning services do you offer?",
        type: "multiple_choice",
        options: [
          "Residential",
          "Commercial",
          "Post-construction",
          "Deep cleaning",
          "Move-in/out",
        ],
        isRequired: true,
        sortOrder: 1,
      },
      {
        question: "Do you bring your own supplies and equipment?",
        type: "yes_no",
        isRequired: true,
        sortOrder: 2,
      },
      {
        question: "Are you experienced with eco-friendly products?",
        type: "yes_no",
        isRequired: false,
        sortOrder: 3,
      },
    ],
  },
  plumbing: {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your plumbing trade certificate or apprenticeship completion document.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering plumbing work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "attestation",
        name: "Tool Ownership",
        description:
          "Confirm that you own the basic tools required for plumbing work.",
        isRequired: true,
        sortOrder: 2,
      },
    ],
    questions: [
      {
        question:
          "How many years of professional plumbing experience do you have?",
        type: "single_choice",
        options: [
          "Less than 1 year",
          "1-3 years",
          "3-5 years",
          "5-10 years",
          "10+ years",
        ],
        isRequired: true,
        sortOrder: 0,
      },
      {
        question: "What pipe materials do you work with?",
        type: "multiple_choice",
        options: ["PVC", "PEX", "Copper", "Galvanized steel", "Other"],
        isRequired: true,
        sortOrder: 1,
      },
      {
        question: "Do you carry your own tools?",
        type: "yes_no",
        isRequired: true,
        sortOrder: 2,
      },
      {
        question:
          "Have you worked on residential, commercial, or both?",
        type: "single_choice",
        options: ["Residential", "Commercial", "Both"],
        isRequired: true,
        sortOrder: 3,
      },
      {
        question: "Are you comfortable with emergency callouts?",
        type: "yes_no",
        isRequired: false,
        sortOrder: 4,
      },
    ],
  },
  electrical: {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your electrical trade certificate or apprenticeship completion document.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering electrical work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "document",
        name: "Safety Certification",
        description:
          "Upload any electrical safety certifications you hold (e.g., Ghana Energy Commission).",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 2,
      },
    ],
    questions: [
      {
        question:
          "How many years of electrical work experience do you have?",
        type: "single_choice",
        options: [
          "Less than 1 year",
          "1-3 years",
          "3-5 years",
          "5-10 years",
          "10+ years",
        ],
        isRequired: true,
        sortOrder: 0,
      },
      {
        question:
          "Do you carry your own tools and testing equipment?",
        type: "yes_no",
        isRequired: true,
        sortOrder: 1,
      },
      {
        question:
          "Are you familiar with Ghana Energy Commission standards?",
        type: "yes_no",
        isRequired: true,
        sortOrder: 2,
      },
    ],
  },
  "carpentry-woodwork": {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your carpentry trade certificate or apprenticeship completion document.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Portfolio",
        description:
          "Upload at least 3 photos of your previous carpentry work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_MIME],
        sortOrder: 1,
      },
      {
        type: "attestation",
        name: "Tool Ownership",
        description:
          "Confirm that you own the basic tools required for carpentry work.",
        isRequired: true,
        sortOrder: 2,
      },
    ],
  },
  "painting-finishing": {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your painting trade certificate or apprenticeship completion document.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Portfolio",
        description:
          "Upload at least 3 photos of your previous painting work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_MIME],
        sortOrder: 1,
      },
      {
        type: "attestation",
        name: "Equipment Declaration",
        description:
          "Confirm the painting equipment and materials you use for your services.",
        isRequired: true,
        sortOrder: 2,
      },
    ],
  },
  "masonry-construction": {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your masonry or construction trade certificate.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering construction work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "document",
        name: "Portfolio",
        description:
          "Upload at least 5 photos of your previous construction work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_MIME],
        sortOrder: 2,
      },
    ],
  },
  "hvac-cooling": {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your HVAC trade certificate or apprenticeship completion document.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering HVAC work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "certification",
        name: "Refrigerant Handling Certificate",
        description:
          "Upload your refrigerant handling certification.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 2,
      },
    ],
  },
  "appliance-services": {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your appliance repair trade certificate.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Portfolio",
        description:
          "Upload photos of your previous appliance repair work.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_MIME],
        sortOrder: 1,
      },
    ],
  },
  "furniture-assembly": {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "attestation",
        name: "Tool Ownership",
        description:
          "Confirm that you own the basic tools required for furniture assembly.",
        isRequired: true,
        sortOrder: 0,
      },
    ],
  },
  "mounting-installation": {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload any relevant mounting or installation certification.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "attestation",
        name: "Tool Ownership",
        description:
          "Confirm that you own the tools required for mounting and installation work.",
        isRequired: true,
        sortOrder: 1,
      },
    ],
  },
  "doors-windows-locks": {
    safetyRiskLevel: "medium",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload any relevant door, window, or lock installation certification.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
    ],
  },
  "gardening-outdoor": {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "attestation",
        name: "Equipment Declaration",
        description:
          "Confirm the gardening equipment and tools you use for your services.",
        isRequired: true,
        sortOrder: 0,
      },
    ],
  },
  "pest-control": {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your pest control trade certificate or license.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "certification",
        name: "Chemical Handling License",
        description:
          "Upload your chemical handling license for pest control substances.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering pest control work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 2,
      },
    ],
  },
  "roofing-gutters": {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your roofing trade certificate or apprenticeship completion document.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering roofing work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
      {
        type: "attestation",
        name: "Safety Equipment Declaration",
        description:
          "Confirm that you have the required safety equipment for roofing work (harness, hard hat, etc.).",
        isRequired: true,
        sortOrder: 2,
      },
    ],
  },
  "moving-general-help": {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "attestation",
        name: "Equipment Declaration",
        description:
          "Confirm the moving equipment and tools you use for your services.",
        isRequired: true,
        sortOrder: 0,
      },
    ],
  },
  "security-smart-home": {
    safetyRiskLevel: "high",
    requirements: [
      {
        type: "certification",
        name: "Trade Certificate",
        description:
          "Upload your security or smart home installation certification.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 0,
      },
      {
        type: "document",
        name: "Insurance Certificate",
        description:
          "Upload your liability insurance certificate covering security installation work.",
        isRequired: true,
        acceptedMimeTypes: [...IMAGE_PDF_MIME],
        sortOrder: 1,
      },
    ],
  },
  "laundry-household-services": {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "attestation",
        name: "Equipment Declaration",
        description:
          "Confirm the laundry equipment and supplies you use for your services.",
        isRequired: true,
        sortOrder: 0,
      },
    ],
  },
  "general-handyman": {
    safetyRiskLevel: "low",
    requirements: [
      {
        type: "document",
        name: "Portfolio",
        description:
          "Upload photos of your previous handyman work.",
        isRequired: false,
        acceptedMimeTypes: [...IMAGE_MIME],
        sortOrder: 0,
      },
      {
        type: "attestation",
        name: "Tool Ownership",
        description:
          "Confirm that you own the basic tools required for general handyman work.",
        isRequired: true,
        sortOrder: 1,
      },
    ],
  },
};

async function main() {
  console.log("Seeding vetting requirements and safety risk levels...\n");

  const categories = await prisma.serviceCategory.findMany();
  console.log(`Found ${categories.length} categories in database.`);

  let requirementsCreated = 0;
  let requirementsUpdated = 0;
  let questionsCreated = 0;
  let questionsUpdated = 0;
  let riskLevelsUpdated = 0;
  let categoriesSkipped = 0;

  for (const category of categories) {
    const seed = CATEGORY_SEEDS[category.slug];
    if (!seed) {
      console.log(`  ⚠ No seed data for category: ${category.name} (${category.slug})`);
      categoriesSkipped++;
      continue;
    }

    // Update safety risk level
    if (category.safetyRiskLevel !== seed.safetyRiskLevel) {
      await prisma.serviceCategory.update({
        where: { id: category.id },
        data: { safetyRiskLevel: seed.safetyRiskLevel },
      });
      riskLevelsUpdated++;
      console.log(`  Updated safety risk level for ${category.name}: ${seed.safetyRiskLevel}`);
    }

    // Upsert requirements
    for (const req of seed.requirements) {
      const existing = await prisma.categoryVettingRequirement.findUnique({
        where: { categoryId_name: { categoryId: category.id, name: req.name } },
      });

      if (existing) {
        await prisma.categoryVettingRequirement.update({
          where: { id: existing.id },
          data: {
            type: req.type,
            description: req.description ?? null,
            isRequired: req.isRequired,
            acceptedMimeTypes: req.acceptedMimeTypes ?? [],
            maxFileSizeMb: req.maxFileSizeMb ?? 10,
            sortOrder: req.sortOrder,
          },
        });
        requirementsUpdated++;
      } else {
        await prisma.categoryVettingRequirement.create({
          data: {
            categoryId: category.id,
            type: req.type,
            name: req.name,
            description: req.description ?? null,
            isRequired: req.isRequired,
            acceptedMimeTypes: req.acceptedMimeTypes ?? [],
            maxFileSizeMb: req.maxFileSizeMb ?? 10,
            sortOrder: req.sortOrder,
          },
        });
        requirementsCreated++;
      }
    }

    // Upsert questions
    if (seed.questions) {
      for (const q of seed.questions) {
        const existing = await prisma.categoryQuestion.findFirst({
          where: { categoryId: category.id, question: q.question },
        });

        if (existing) {
          await prisma.categoryQuestion.update({
            where: { id: existing.id },
            data: {
              type: q.type,
              options: q.options ?? [],
              isRequired: q.isRequired,
              sortOrder: q.sortOrder,
            },
          });
          questionsUpdated++;
        } else {
          await prisma.categoryQuestion.create({
            data: {
              categoryId: category.id,
              question: q.question,
              type: q.type,
              options: q.options ?? [],
              isRequired: q.isRequired,
              sortOrder: q.sortOrder,
            },
          });
          questionsCreated++;
        }
      }
    }
  }

  console.log("\n--- Seed Summary ---");
  console.log(`Categories processed: ${categories.length - categoriesSkipped}`);
  console.log(`Categories skipped (no seed): ${categoriesSkipped}`);
  console.log(`Safety risk levels updated: ${riskLevelsUpdated}`);
  console.log(`Requirements created: ${requirementsCreated}`);
  console.log(`Requirements updated: ${requirementsUpdated}`);
  console.log(`Questions created: ${questionsCreated}`);
  console.log(`Questions updated: ${questionsUpdated}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
