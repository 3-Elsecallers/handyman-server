import "dotenv/config";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Mirrors the slugs relied on by `seed-vetting-requirements.ts`.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type ServiceInput = {
  name: string;
  description: string;
  basePrice?: number;
  durationMins?: number;
};

type CategoryInput = {
  name: string;
  safetyRiskLevel: "low" | "medium" | "high";
  description: string;
  basePrice: number;
  durationMins: number;
  services: ServiceInput[];
};

const TAXONOMY: CategoryInput[] = [
  {
    name: "Cleaning",
    safetyRiskLevel: "low",
    description:
      "Residential and commercial cleaning services, from routine tidying to deep, post-construction and move-in/out cleans.",
    basePrice: 80,
    durationMins: 120,
    services: [
      { name: "Standard Cleaning", description: "Routine dusting, sweeping, mopping and surface cleaning of a home or office." },
      { name: "Deep Cleaning", description: "A thorough, top-to-bottom clean targeting grime in hard-to-reach areas." },
      { name: "Move-In Cleaning", description: "Pre-move-in cleaning so a new home is spotless and ready to occupy." },
      { name: "Move-Out Cleaning", description: "End-of-tenancy cleaning to restore a property to move-out condition." },
      { name: "Post-Construction Cleaning", description: "Removal of dust, debris and residue after building or renovation work.", basePrice: 200, durationMins: 240 },
      { name: "Kitchen Cleaning", description: "Degreasing and sanitising of kitchen surfaces, sinks and appliances." },
      { name: "Bathroom Cleaning", description: "Scrubbing and sanitising of tiles, fixtures, glass and sanitary ware." },
      { name: "Window Cleaning", description: "Streak-free cleaning of interior and exterior windows, sills and frames." },
      { name: "Carpet Cleaning", description: "Deep extraction or steam cleaning to refresh carpeted floors." },
      { name: "Upholstery Cleaning", description: "Cleaning and deodorising of sofas, chairs and fabric furnishings." },
      { name: "Floor Cleaning & Polishing", description: "Washing, scrubbing and polishing of hard floor surfaces." },
      { name: "Appliance Cleaning", description: "Interior and exterior cleaning of kitchen and household appliances." },
      { name: "Garage Cleaning", description: "Sweeping, washing down and organising garage spaces." },
      { name: "Outdoor/Patio Cleaning", description: "Washing and sprucing up patios, balconies and paved outdoor areas." },
      { name: "Pressure Washing", description: "High-pressure washing of driveways, walls, patios and exterior surfaces.", basePrice: 150, durationMins: 180 },
      { name: "Gutter Cleaning", description: "Removal of leaves and debris from roof gutters and downspouts.", basePrice: 120, durationMins: 120 },
    ],
  },
  {
    name: "Plumbing",
    safetyRiskLevel: "medium",
    description:
      "Installation, repair and maintenance of pipes, fixtures and water systems for homes and businesses.",
    basePrice: 100,
    durationMins: 90,
    services: [
      { name: "Faucet Installation/Replacement", description: "Fitting or swapping out taps and faucets with proper sealing." },
      { name: "Sink Installation/Replacement", description: "Installation or replacement of kitchen and bathroom sinks." },
      { name: "Toilet Installation", description: "Installation of toilets, including wax ring and water connection." },
      { name: "Toilet Repair", description: "Fixing running, clogged, leaking or broken toilets." },
      { name: "Shower Installation/Repair", description: "Installation or repair of showers, heads and shower systems." },
      { name: "Drain Unclogging", description: "Clearing blocked sinks, drains and pipes." },
      { name: "Pipe Leak Repair", description: "Locating and sealing leaking pipes to stop water damage." },
      { name: "Pipe Replacement", description: "Replacing worn, rusted or damaged sections of pipework.", durationMins: 180 },
      { name: "Water Tank Installation", description: "Installation of water storage tanks with proper connections.", basePrice: 300, durationMins: 240 },
      { name: "Water Heater Installation/Repair", description: "Installation, servicing and repair of water heating units.", basePrice: 250, durationMins: 180 },
      { name: "Water Pressure Repair", description: "Diagnosing and fixing low or unstable water pressure." },
      { name: "Bathroom Plumbing", description: "Complete plumbing work for bathroom fixtures and fittings." },
      { name: "Kitchen Plumbing", description: "Plumbing installation and repair for kitchen sinks and appliances." },
      { name: "Plumbing Fixture Installation", description: "Installation of assorted plumbing fixtures and fittings." },
    ],
  },
  {
    name: "Electrical",
    safetyRiskLevel: "high",
    description:
      "Safe installation, repair and diagnosis of electrical wiring, fixtures and systems.",
    basePrice: 120,
    durationMins: 90,
    services: [
      { name: "Light Fixture Installation", description: "Fitting ceiling lights, pendants and wall-mounted light fixtures." },
      { name: "Ceiling Fan Installation", description: "Installing ceiling fans with secure mounting and wiring." },
      { name: "Socket/Outlet Installation", description: "Installing or relocating power sockets and outlets." },
      { name: "Switch Installation/Replacement", description: "Installing and replacing light switches and dimmers." },
      { name: "Circuit Breaker Replacement", description: "Replacing faulty circuit breakers in distribution boards." },
      { name: "Electrical Fault Diagnosis", description: "Tracing and identifying electrical faults and their cause." },
      { name: "Wiring Repair", description: "Repairing damaged, exposed or faulty electrical wiring.", durationMins: 150 },
      { name: "New Electrical Wiring", description: "Installing new wiring for rooms, renovations or additions.", durationMins: 240 },
      { name: "Generator Installation", description: "Installation and connection of standby/power generators.", basePrice: 350, durationMins: 240 },
      { name: "Inverter Installation", description: "Installing and wiring inverter and solar/battery power systems.", basePrice: 350, durationMins: 240 },
      { name: "Security Lighting Installation", description: "Installing motion-activated and security lighting." },
      { name: "Outdoor Lighting Installation", description: "Installing garden, pathway and exterior lighting." },
    ],
  },
  {
    name: "Carpentry & Woodwork",
    safetyRiskLevel: "medium",
    description:
      "Crafting, assembling, repairing and finishing wooden structures, fixtures and furniture.",
    basePrice: 110,
    durationMins: 120,
    services: [
      { name: "Furniture Assembly", description: "Assembling ready-to-assemble wooden furniture." },
      { name: "Furniture Repair", description: "Repairing broken, wobbly or damaged wooden furniture." },
      { name: "Custom Furniture", description: "Building bespoke wooden furniture to specification.", durationMins: 240 },
      { name: "Cabinet Installation", description: "Installing kitchen and storage cabinets." },
      { name: "Cabinet Repair", description: "Fixing hinges, doors and structure of cabinets." },
      { name: "Door Installation", description: "Hanging new interior and exterior wooden doors." },
      { name: "Door Repair", description: "Repairing damaged doors, panels and hinges." },
      { name: "Door Frame Repair", description: "Fixing warped, rotted or damaged door frames." },
      { name: "Window Frame Repair", description: "Repairing or rebuilding wooden window frames." },
      { name: "Shelving Installation", description: "Installing wooden shelves and shelving units." },
      { name: "Wooden Partition Installation", description: "Building wooden partition walls for room division." },
      { name: "Deck/Outdoor Woodwork", description: "Building and repairing wooden decks and outdoor structures." },
      { name: "Wood Polishing & Refinishing", description: "Sanding, staining and sealing wooden surfaces." },
    ],
  },
  {
    name: "Painting & Finishing",
    safetyRiskLevel: "medium",
    description:
      "Interior and exterior painting, wallpapering and wall preparation for a clean, durable finish.",
    basePrice: 100,
    durationMins: 180,
    services: [
      { name: "Interior Painting", description: "Painting internal walls, ceilings and trim." },
      { name: "Exterior Painting", description: "Painting external walls and facades with weatherproof paint.", durationMins: 360 },
      { name: "Single-Room Painting", description: "Painting a single room, including prep and clean-up.", basePrice: 80, durationMins: 150 },
      { name: "Full-Home Painting", description: "Complete interior painting of an entire home.", basePrice: 500, durationMins: 480 },
      { name: "Wall Touch-Ups", description: "Spot-repairing scuffs, stains and flaking paint on walls.", basePrice: 60 },
      { name: "Ceiling Painting", description: "Painting ceilings with proper prep and edging." },
      { name: "Door & Window Painting", description: "Painting doors, frames and window trim." },
      { name: "Fence Painting", description: "Painting or staining wooden and metal fences.", durationMins: 240 },
      { name: "Wallpaper Installation", description: "Hanging wallpaper smoothly with aligned seams." },
      { name: "Wallpaper Removal", description: "Stripping old wallpaper and prepping the wall surface." },
      { name: "Wall Preparation", description: "Filling, sanding and priming walls before painting." },
      { name: "Decorative Painting", description: "Specialist finishes such as feature walls and textures." },
    ],
  },
  {
    name: "Masonry & Construction",
    safetyRiskLevel: "high",
    description:
      "Structural and finishing building work including walls, tiling, screeding and waterproofing.",
    basePrice: 150,
    durationMins: 180,
    services: [
      { name: "Wall Repair", description: "Repairing cracked, crumbling or damaged walls." },
      { name: "Crack Repair", description: "Filling and reinforcing hairline and structural cracks." },
      { name: "Brickwork", description: "Laying and repairing brick structures." },
      { name: "Blockwork", description: "Building and repairing concrete block walls." },
      { name: "Cement Plastering", description: "Applying smooth or textured cement plaster to walls." },
      { name: "Concrete Repair", description: "Repairing and resurfacing damaged concrete." },
      { name: "Floor Screeding", description: "Levelling and smoothing floors before finishing." },
      { name: "Minor Renovations", description: "Small structural and finishing renovation jobs.", durationMins: 360 },
      { name: "Partition Wall Construction", description: "Building internal partition walls." },
      { name: "Tiling", description: "Laying floor and wall tiles with proper alignment and grout." },
      { name: "Tile Repair", description: "Replacing cracked or broken tiles." },
      { name: "Grouting", description: "Applying or renewing grout between tiles." },
      { name: "Waterproofing", description: "Applying waterproof coatings to walls, roofs and floors.", durationMins: 240 },
    ],
  },
  {
    name: "HVAC & Cooling",
    safetyRiskLevel: "high",
    description:
      "Installation, servicing and repair of air conditioners, fans and ventilation systems.",
    basePrice: 150,
    durationMins: 120,
    services: [
      { name: "Air Conditioner Installation", description: "Installing split and window air conditioners." },
      { name: "Air Conditioner Servicing", description: "Servicing, degassing and gas-top-ups for AC units.", basePrice: 120, durationMins: 90 },
      { name: "Air Conditioner Repair", description: "Diagnosing and repairing faulty air conditioners." },
      { name: "Air Conditioner Cleaning", description: "Cleaning filters, coils and units for better performance.", basePrice: 80, durationMins: 60 },
      { name: "Air Conditioner Removal", description: "Safe removal and disconnection of air conditioners." },
      { name: "Ceiling Fan Installation", description: "Installing and balancing ceiling fans." },
      { name: "Standing Fan Repair", description: "Repairing blade, motor or control faults in standing fans." },
      { name: "Ventilation Installation", description: "Installing ventilation units and ducting." },
      { name: "Exhaust Fan Installation", description: "Installing kitchen and bathroom exhaust fans." },
      { name: "Refrigerator Repair", description: "Diagnosing and repairing refrigerator cooling faults." },
    ],
  },
  {
    name: "Appliance Services",
    safetyRiskLevel: "medium",
    description:
      "Installation, repair and diagnostics for household appliances.",
    basePrice: 100,
    durationMins: 90,
    services: [
      { name: "Washing Machine Installation", description: "Installing and connecting washing machines." },
      { name: "Washing Machine Repair", description: "Repairing washing machine faults and leaks." },
      { name: "Dishwasher Installation", description: "Installing and connecting dishwashers." },
      { name: "Dishwasher Repair", description: "Repairing dishwasher drainage, spray and control faults." },
      { name: "Refrigerator Installation", description: "Installing and levelling refrigerators." },
      { name: "Refrigerator Repair", description: "Repairing refrigerator cooling and electrical faults." },
      { name: "Oven Installation", description: "Installing and connecting ovens." },
      { name: "Oven Repair", description: "Repairing oven heating and control problems." },
      { name: "Cooker Installation", description: "Installing gas or electric cookers safely." },
      { name: "Microwave Repair", description: "Repairing microwave faults such as heating and door issues." },
      { name: "TV Mounting", description: "Mounting televisions securely on walls.", basePrice: 80, durationMins: 60 },
      { name: "Home Appliance Diagnostics", description: "Diagnosing faults across common household appliances.", basePrice: 60 },
    ],
  },
  {
    name: "Furniture & Assembly",
    safetyRiskLevel: "low",
    description:
      "Assembly, disassembly, mounting and relocation of household and office furniture.",
    basePrice: 80,
    durationMins: 90,
    services: [
      { name: "Flat-Pack Furniture Assembly", description: "Assembling flat-pack and ready-to-assemble furniture." },
      { name: "Bed Assembly", description: "Assembling bed frames and headboards." },
      { name: "Wardrobe Assembly", description: "Assembling wardrobes and wardrobes-with-drawers." },
      { name: "Table Assembly", description: "Assembling dining, work and side tables." },
      { name: "Chair Assembly", description: "Assembling chairs and office seating." },
      { name: "Desk Assembly", description: "Assembling home and office desks." },
      { name: "Shelf Assembly", description: "Assembling freestanding and wall shelves." },
      { name: "Furniture Disassembly", description: "Taking furniture apart for moving or storage." },
      { name: "Furniture Relocation", description: "Moving assembled furniture within or between spaces." },
      { name: "Furniture Repair", description: "Repairing loose joints, hinges and damaged furniture." },
      { name: "Furniture Mounting", description: "Securely mounting furniture and units to walls." },
    ],
  },
  {
    name: "Mounting & Installation",
    safetyRiskLevel: "medium",
    description:
      "Precise mounting and hanging of TVs, fixtures, shelves and smart devices.",
    basePrice: 80,
    durationMins: 60,
    services: [
      { name: "TV Wall Mounting", description: "Mounting TVs to walls with concealed or exposed brackets." },
      { name: "Mirror Mounting", description: "Safely mounting mirrors of various sizes and weights." },
      { name: "Picture/Artwork Hanging", description: "Hanging pictures and artwork level and secure." },
      { name: "Curtain Rod Installation", description: "Installing curtain rods and tracks." },
      { name: "Blind Installation", description: "Installing window blinds and shades." },
      { name: "Shelf Mounting", description: "Mounting brackets and wall shelves securely." },
      { name: "Wall Cabinet Mounting", description: "Mounting wall cabinets with proper anchoring." },
      { name: "Towel Rack Installation", description: "Installing towel racks and bathroom accessories." },
      { name: "Wall-Mounted Appliance Installation", description: "Mounting wall appliances such as TVs and soundbars." },
      { name: "Smart Home Device Installation", description: "Installing and setting up smart home devices.", basePrice: 100, durationMins: 90 },
    ],
  },
  {
    name: "Doors, Windows & Locks",
    safetyRiskLevel: "medium",
    description:
      "Installation and repair of doors, windows, locks and security fittings.",
    basePrice: 100,
    durationMins: 90,
    services: [
      { name: "Lock Installation", description: "Installing new locks on doors and gates." },
      { name: "Lock Replacement", description: "Replacing old or compromised locks." },
      { name: "Lock Repair", description: "Repairing jammed, broken or faulty locks." },
      { name: "Door Handle Replacement", description: "Replacing door handles and knobs." },
      { name: "Door Hinge Repair", description: "Fixing squeaky, loose or misaligned hinges." },
      { name: "Door Alignment", description: "Re-aligning doors that stick or rub." },
      { name: "Door Frame Repair", description: "Repairing damaged or rotted door frames." },
      { name: "Window Repair", description: "Repairing broken or seized windows." },
      { name: "Window Handle Replacement", description: "Replacing broken window handles and stays." },
      { name: "Window Lock Installation", description: "Installing locks on windows for security." },
      { name: "Mosquito Net Installation", description: "Fitting mosquito nets to windows and doors." },
      { name: "Security Door Installation", description: "Installing metal or security doors.", durationMins: 180 },
    ],
  },
  {
    name: "Gardening & Outdoor",
    safetyRiskLevel: "low",
    description:
      "Lawn and garden care, landscaping, planting and outdoor maintenance.",
    basePrice: 90,
    durationMins: 120,
    services: [
      { name: "Lawn Mowing", description: "Mowing, edging and cleaning up lawns." },
      { name: "Lawn Maintenance", description: "Ongoing care including mowing, feeding and watering." },
      { name: "Garden Cleanup", description: "Clearing leaves, weeds and debris from the garden." },
      { name: "Hedge Trimming", description: "Trimming and shaping hedges and shrubs." },
      { name: "Tree Trimming", description: "Pruning and trimming tree branches.", durationMins: 180 },
      { name: "Weeding", description: "Removing weeds from beds, borders and paving." },
      { name: "Planting", description: "Planting flowers, shrubs, and plants." },
      { name: "Garden Landscaping", description: "Designing and building garden layouts and features.", durationMins: 300 },
      { name: "Garden Bed Installation", description: "Building and filling garden beds." },
      { name: "Irrigation Installation/Repair", description: "Installing or repairing garden irrigation systems." },
      { name: "Outdoor Furniture Assembly", description: "Assembling garden and patio furniture." },
      { name: "Patio Maintenance", description: "Cleaning, sealing and maintaining patios." },
    ],
  },
  {
    name: "Pest Control",
    safetyRiskLevel: "high",
    description:
      "Treatment and prevention of common household and property pests.",
    basePrice: 120,
    durationMins: 90,
    services: [
      { name: "General Pest Control", description: "Broad treatment for a range of common pests." },
      { name: "Ant Control", description: "Targeted treatment and baiting for ant infestations." },
      { name: "Cockroach Control", description: "Eradication and prevention of cockroach infestations." },
      { name: "Termite Treatment", description: "Chemical and bait treatment for termite colonies." },
      { name: "Mosquito Control", description: "Reducing mosquito breeding and activity around the property." },
      { name: "Rodent Control", description: "Trapping, baiting and proofing against rodents." },
      { name: "Bed Bug Treatment", description: "Specialist heat or chemical treatment for bed bugs." },
      { name: "Flea Treatment", description: "Treating homes for flea infestations." },
      { name: "Wasp/Insect Nest Removal", description: "Safe removal of wasp and insect nests." },
      { name: "Preventive Pest Treatment", description: "Ongoing preventive spraying to deter future infestations." },
    ],
  },
  {
    name: "Roofing & Gutters",
    safetyRiskLevel: "high",
    description:
      "Inspection, repair and maintenance of roofs, gutters and downspouts.",
    basePrice: 200,
    durationMins: 180,
    services: [
      { name: "Roof Inspection", description: "Assessing roof condition, damage and leaks." },
      { name: "Roof Leak Repair", description: "Locating and repairing roof leaks." },
      { name: "Roof Tile Replacement", description: "Replacing broken or missing roof tiles." },
      { name: "Roofing Sheet Replacement", description: "Replacing worn or damaged roofing sheets.", durationMins: 240 },
      { name: "Roof Cleaning", description: "Cleaning moss, algae and debris from roofs." },
      { name: "Roof Maintenance", description: "Preventive checks and repairs to extend roof life." },
      { name: "Gutter Installation", description: "Installing new gutters and gutter systems." },
      { name: "Gutter Repair", description: "Fixing leaking, sagging or damaged gutters." },
      { name: "Gutter Cleaning", description: "Clearing gutters and downspouts of blockages.", basePrice: 120, durationMins: 120 },
      { name: "Downspout Repair", description: "Repairing or replacing downspouts and extensions." },
      { name: "Roof Waterproofing", description: "Applying waterproof coatings to prevent leaks.", durationMins: 240 },
    ],
  },
  {
    name: "Moving & General Help",
    safetyRiskLevel: "low",
    description:
      "Moving assistance, lifting, packing and organisational help around the home.",
    basePrice: 100,
    durationMins: 120,
    services: [
      { name: "Furniture Moving", description: "Moving furniture between rooms or properties." },
      { name: "Home Moving Assistance", description: "Hands-on help relocating household items.", durationMins: 240 },
      { name: "Packing & Unpacking", description: "Careful packing and unpacking of belongings." },
      { name: "Furniture Rearrangement", description: "Rearranging furniture to new layouts." },
      { name: "Heavy Item Moving", description: "Lifting and moving heavy items safely." },
      { name: "Appliance Moving", description: "Moving and repositioning large appliances." },
      { name: "Loading/Unloading", description: "Loading and unloading vehicles and trucks." },
      { name: "Home Organization", description: "Decluttering and organising living spaces." },
      { name: "Garage Organization", description: "Organising garage storage and workspaces." },
      { name: "Storage Organization", description: "Organising storage rooms, cupboards and units." },
    ],
  },
  {
    name: "Security & Smart Home",
    safetyRiskLevel: "high",
    description:
      "Installation and setup of security systems and connected smart-home devices.",
    basePrice: 150,
    durationMins: 120,
    services: [
      { name: "CCTV Installation", description: "Installing and configuring CCTV camera systems.", durationMins: 180 },
      { name: "CCTV Repair", description: "Diagnosing and repairing CCTV camera faults." },
      { name: "Smart Lock Installation", description: "Installing keyless and smart locks." },
      { name: "Alarm System Installation", description: "Installing burglar alarm systems and sensors." },
      { name: "Motion Sensor Installation", description: "Installing motion sensors for lighting and security." },
      { name: "Doorbell Camera Installation", description: "Installing and wiring smart doorbell cameras." },
      { name: "Access Control Installation", description: "Installing entry and access-control systems." },
      { name: "Security Light Installation", description: "Installing motion-activated security lighting." },
      { name: "Intercom Installation", description: "Installing audio and video intercom systems." },
      { name: "Smart Home Device Setup", description: "Pairing and configuring smart home devices." },
    ],
  },
  {
    name: "Laundry & Household Services",
    safetyRiskLevel: "low",
    description:
      "Laundry, ironing, fabric care and household organisational services.",
    basePrice: 60,
    durationMins: 120,
    services: [
      { name: "Standard Laundry", description: "Washing and drying of laundry loads.", basePrice: 40, durationMins: 90 },
      { name: "Ironing", description: "Ironing and pressing clothing and linens." },
      { name: "Drying & Folding", description: "Drying, folding and sorting clean laundry." },
      { name: "Bedding/Linen Cleaning", description: "Washing and refreshing bed linens." },
      { name: "Curtain Cleaning", description: "Washing and re-hanging curtains." },
      { name: "Carpet Cleaning", description: "Deep cleaning of carpets and rugs.", basePrice: 100, durationMins: 180 },
      { name: "Upholstery Cleaning", description: "Cleaning and refreshing upholstered furniture." },
      { name: "Household Organization", description: "Organising rooms, storage and daily household routines." },
    ],
  },
  {
    name: "General Handyman",
    safetyRiskLevel: "low",
    description:
      "Versatile general repairs, maintenance and odd jobs around the home.",
    basePrice: 70,
    durationMins: 60,
    services: [
      { name: "General Home Repairs", description: "Fixing assorted household repairs." },
      { name: "Minor Repairs", description: "Small fixes to fixtures, fittings and surfaces." },
      { name: "Fixture Replacement", description: "Replacing worn or broken household fixtures." },
      { name: "Drilling & Wall Anchoring", description: "Drilling holes and anchoring items to walls." },
      { name: "Caulking & Sealing", description: "Applying sealant to gaps and joints." },
      { name: "Silicone Seal Replacement", description: "Renewing degraded silicone seals and caulking." },
      { name: "Hanging & Mounting", description: "Hanging and mounting items around the home." },
      { name: "Minor Assembly", description: "Quick assembly of small items and furniture." },
      { name: "Home Inspection/Assessment", description: "Walking through a property to assess needed repairs." },
      { name: "Property Maintenance", description: "Routine upkeep to keep a property in good shape." },
      { name: "Preventive Maintenance", description: "Check-ups and fixes to prevent future issues." },
      { name: "Odd Jobs", description: "General household tasks and errands." },
    ],
  },
];

async function main() {
  console.log("Seeding categories and services from handyman-taxonomy...\n");

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let servicesCreated = 0;
  let servicesUpdated = 0;

  for (const category of TAXONOMY) {
    const slug = slugify(category.name);
    const existingCategory = await prisma.serviceCategory.findUnique({
      where: { slug },
      include: { services: true },
    });

    if (existingCategory) {
      await prisma.serviceCategory.update({
        where: { id: existingCategory.id },
        data: {
          name: category.name,
          description: category.description,
          safetyRiskLevel: category.safetyRiskLevel,
        },
      });
      categoriesUpdated++;
      console.log(`  • Category updated: ${category.name} (${slug})`);
    } else {
      await prisma.serviceCategory.create({
        data: {
          name: category.name,
          slug,
          description: category.description,
          safetyRiskLevel: category.safetyRiskLevel,
          sortOrder: TAXONOMY.findIndex((c) => c.name === category.name),
        },
      });
      categoriesCreated++;
      console.log(`  • Category created: ${category.name} (${slug})`);
    }

    const catForId = await prisma.serviceCategory.findUnique({ where: { slug } });
    if (!catForId) continue;

    for (const service of category.services) {
      const serviceSlug = slugify(service.name);
      const existingService = await prisma.service.findUnique({
        where: { slug: serviceSlug },
      });

      const data = {
        categoryId: catForId.id,
        name: service.name,
        description: service.description,
        basePrice: service.basePrice ?? category.basePrice,
        durationMins: service.durationMins ?? category.durationMins,
      };

      if (existingService) {
        await prisma.service.update({
          where: { id: existingService.id },
          data,
        });
        servicesUpdated++;
      } else {
        await prisma.service.create({
          data: {
            ...data,
            slug: serviceSlug,
            sortOrder: category.services.findIndex((s) => s.name === service.name),
          },
        });
        servicesCreated++;
      }
    }
  }

  console.log("\n--- Seed Summary ---");
  console.log(`Categories created: ${categoriesCreated}`);
  console.log(`Categories updated: ${categoriesUpdated}`);
  console.log(`Services created: ${servicesCreated}`);
  console.log(`Services updated: ${servicesUpdated}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
