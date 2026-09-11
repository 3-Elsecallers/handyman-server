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

type ServiceLevelSeed = {
  requirements: RequirementInput[];
  questions?: QuestionInput[];
};

// Mirrors the slugs relied on by `seed-taxonomy.ts`.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const CATEGORY_SEEDS: Record<
  string,
  {
    safetyRiskLevel: string;
    requirements: RequirementInput[];
    questions?: QuestionInput[];
    serviceRequirements?: Record<string, ServiceLevelSeed>;
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
    serviceRequirements: {
      "pressure-washing": {
        requirements: [
          {
            type: "attestation",
            name: "Pressure Washer Ownership",
            description:
              "Confirm that you own or have access to a pressure washer suitable for the job.",
            isRequired: true,
            sortOrder: 0,
          },
          {
            type: "document",
            name: "Pressure Washing Portfolio",
            description:
              "Upload photos of at least 2 previous pressure washing jobs.",
            isRequired: false,
            acceptedMimeTypes: [...IMAGE_MIME],
            sortOrder: 1,
          },
        ],
        questions: [
          {
            question: "What pressure washer types do you use?",
            type: "multiple_choice",
            options: ["Electric", "Petrol", "Both"],
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "window-cleaning": {
        requirements: [
          {
            type: "attestation",
            name: "Safety Equipment Declaration",
            description:
              "Confirm you have the safety equipment required for window cleaning at height (ladders, harness where applicable).",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "water-heater-installation-repair": {
        requirements: [
          {
            type: "certification",
            name: "Water Heater Installation Certification",
            description:
              "Upload certification or manufacturer training covering water heater installation and service.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
          {
            type: "attestation",
            name: "Gas Appliance Safety Training",
            description:
              "Confirm that you have completed gas appliance safety training for gas water heaters.",
            isRequired: false,
            sortOrder: 1,
          },
        ],
        questions: [
          {
            question: "What types of water heaters do you service?",
            type: "multiple_choice",
            options: ["Electric", "Gas", "Solar", "On-demand/Tankless"],
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "water-tank-installation": {
        requirements: [
          {
            type: "attestation",
            name: "Water Tank Installation Experience",
            description:
              "Confirm you have installed water storage tanks with proper inlet/outlet and overflow connections.",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "drain-unclogging": {
        requirements: [
          {
            type: "attestation",
            name: "Drain Cleaning Equipment Ownership",
            description:
              "Confirm that you own drain clearing tools (auger, drain snake, etc.).",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "inverter-installation": {
        requirements: [
          {
            type: "certification",
            name: "Inverter/Power Systems Installation Certificate",
            description:
              "Upload certification or manufacturer training for inverter and battery power systems.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
          {
            type: "attestation",
            name: "Battery Handling Safety",
            description:
              "Confirm you are trained in safe handling and installation of batteries.",
            isRequired: true,
            sortOrder: 1,
          },
        ],
      },
      "generator-installation": {
        requirements: [
          {
            type: "certification",
            name: "Generator Installation Training",
            description:
              "Upload training or certification covering standby generator installation and connection.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
      },
      "new-electrical-wiring": {
        requirements: [
          {
            type: "document",
            name: "Wiring Installation Permit",
            description:
              "Upload your electrical wiring installation permit issued by the Ghana Energy Commission.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "air-conditioner-installation": {
        requirements: [
          {
            type: "attestation",
            name: "Split AC Installation Competency",
            description:
              "Confirm you have installed split and window air conditioners with proper mounting and drainage.",
            isRequired: true,
            sortOrder: 0,
          },
        ],
        questions: [
          {
            question: "What types of AC units do you install?",
            type: "multiple_choice",
            options: ["Split", "Window", "Cassette", "Inverter"],
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "refrigerator-repair": {
        requirements: [
          {
            type: "attestation",
            name: "Refrigerant Handling Competency",
            description:
              "Confirm you can safely recover and handle refrigerants during repair work.",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "termite-treatment": {
        requirements: [
          {
            type: "certification",
            name: "Termite Treatment License",
            description:
              "Upload a license or certification specific to termite chemical and bait treatments.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
        questions: [
          {
            question: "What termite treatment methods do you offer?",
            type: "multiple_choice",
            options: ["Chemical barrier", "Baiting systems", "Soil treatment", "Fumigation"],
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "bed-bug-treatment": {
        requirements: [
          {
            type: "certification",
            name: "Heat Treatment Certification",
            description:
              "Upload certification for thermal/heat bed bug treatment if you offer it.",
            isRequired: false,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
      },
      "rodent-control": {
        requirements: [
          {
            type: "attestation",
            name: "Rodenticide Handling Training",
            description:
              "Confirm you are trained in safe handling and placement of rodenticides.",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "roofing-sheet-replacement": {
        requirements: [
          {
            type: "attestation",
            name: "Working at Height Safety Training",
            description:
              "Confirm you have completed working-at-height safety training.",
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "roof-waterproofing": {
        requirements: [
          {
            type: "certification",
            name: "Waterproofing Application Certificate",
            description:
              "Upload certification covering the application of roof waterproofing coatings.",
            isRequired: true,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "cctv-installation": {
        requirements: [
          {
            type: "attestation",
            name: "Network & Cabling Skills",
            description:
              "Confirm you are proficient in running and terminating network/camera cabling.",
            isRequired: true,
            sortOrder: 0,
          },
          {
            type: "certification",
            name: "CCTV Installation Certification",
            description:
              "Upload any CCTV installation certification or vendor training you hold.",
            isRequired: false,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 1,
          },
        ],
        questions: [
          {
            question: "What types of CCTV systems do you install?",
            type: "multiple_choice",
            options: ["Analog/HDTVI", "IP/Network", "Wireless", "Solar-powered"],
            isRequired: true,
            sortOrder: 0,
          },
        ],
      },
      "alarm-system-installation": {
        requirements: [
          {
            type: "certification",
            name: "Alarm System Installation Training",
            description:
              "Upload training or certification covering burglar alarm installation.",
            isRequired: false,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
        ],
      },
    },
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
    serviceRequirements: {
      "carpet-cleaning": {
        requirements: [
          {
            type: "certification",
            name: "Carpet Cleaning Certification",
            description:
              "Upload any carpet cleaning certification or professional training you hold.",
            isRequired: false,
            acceptedMimeTypes: [...IMAGE_PDF_MIME],
            sortOrder: 0,
          },
          {
            type: "attestation",
            name: "Carpet Cleaning Equipment Declaration",
            description:
              "Confirm that you own carpet cleaning equipment (extractor, steam unit, etc.).",
            isRequired: true,
            sortOrder: 1,
          },
        ],
      },
    },
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
  let serviceRequirementsCreated = 0;
  let serviceRequirementsUpdated = 0;
  let serviceQuestionsCreated = 0;
  let serviceQuestionsUpdated = 0;
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

    // Upsert service-level requirements and questions
    for (const [serviceSlug, levelSeed] of Object.entries(seed.serviceRequirements ?? {})) {
      const service = await prisma.service.findUnique({ where: { slug: serviceSlug } });
      if (!service || service.categoryId !== category.id) {
        console.log(
          `  ⚠ Service-level seed references unknown service slug: ${serviceSlug} (category ${category.slug})`,
        );
        continue;
      }

      for (const req of levelSeed.requirements) {
        const existing = await prisma.serviceVettingRequirement.findUnique({
          where: { serviceId_name: { serviceId: service.id, name: req.name } },
        });

        if (existing) {
          await prisma.serviceVettingRequirement.update({
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
          serviceRequirementsUpdated++;
        } else {
          await prisma.serviceVettingRequirement.create({
            data: {
              serviceId: service.id,
              type: req.type,
              name: req.name,
              description: req.description ?? null,
              isRequired: req.isRequired,
              acceptedMimeTypes: req.acceptedMimeTypes ?? [],
              maxFileSizeMb: req.maxFileSizeMb ?? 10,
              sortOrder: req.sortOrder,
            },
          });
          serviceRequirementsCreated++;
        }
      }

      if (levelSeed.questions) {
        for (const q of levelSeed.questions) {
          const existing = await prisma.serviceQuestion.findFirst({
            where: { serviceId: service.id, question: q.question },
          });

          if (existing) {
            await prisma.serviceQuestion.update({
              where: { id: existing.id },
              data: {
                type: q.type,
                options: q.options ?? [],
                isRequired: q.isRequired,
                sortOrder: q.sortOrder,
              },
            });
            serviceQuestionsUpdated++;
          } else {
            await prisma.serviceQuestion.create({
              data: {
                serviceId: service.id,
                question: q.question,
                type: q.type,
                options: q.options ?? [],
                isRequired: q.isRequired,
                sortOrder: q.sortOrder,
              },
            });
            serviceQuestionsCreated++;
          }
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
  console.log(`Service requirements created: ${serviceRequirementsCreated}`);
  console.log(`Service requirements updated: ${serviceRequirementsUpdated}`);
  console.log(`Service questions created: ${serviceQuestionsCreated}`);
  console.log(`Service questions updated: ${serviceQuestionsUpdated}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
