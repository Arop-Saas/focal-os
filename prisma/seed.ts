import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // NOTE: This seed creates demo data.
  // To use: first create a user via Supabase Auth, then run this seed
  // and update the supabaseId below.

  // ─── Demo Workspace ────────────────────────────────────────────────────────
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-photography" },
    update: {},
    create: {
      name: "Blue Sky Real Estate Photography",
      slug: "demo-photography",
      email: "hello@bluesky.photo",
      phone: "(615) 555-0100",
      timezone: "America/Chicago",
      city: "Nashville",
      state: "TN",
      postalCode: "37201",
      invoicePrefix: "BSP",
      invoiceNextNumber: 1001,
      defaultTaxRate: 0,
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("✅ Workspace created:", workspace.slug);

  // ─── Services ────────────────────────────────────────────────────────────
  const serviceData = [
    { name: "Standard Photography", category: "PHOTOGRAPHY" as const, basePrice: 150, durationMins: 60 },
    { name: "Twilight Photography", category: "TWILIGHT" as const, basePrice: 250, durationMins: 60 },
    { name: "Drone Photography", category: "DRONE" as const, basePrice: 200, durationMins: 45 },
    { name: "Drone Video", category: "DRONE" as const, basePrice: 250, durationMins: 45 },
    { name: "Property Video", category: "VIDEO" as const, basePrice: 350, durationMins: 90 },
    { name: "Matterport 3D Tour", category: "VIRTUAL_TOUR_3D" as const, basePrice: 200, durationMins: 60 },
    { name: "Floor Plan", category: "FLOOR_PLAN" as const, basePrice: 125, durationMins: 30 },
    { name: "Virtual Staging (5 rooms)", category: "VIRTUAL_STAGING" as const, basePrice: 175, durationMins: 0 },
    { name: "Rush Editing (48h → 24h)", category: "RUSH_EDITING" as const, basePrice: 75, durationMins: 0 },
    { name: "Social Media Package", category: "SOCIAL_MEDIA" as const, basePrice: 100, durationMins: 0 },
  ];

  const services = await Promise.all(
    serviceData.map((s, i) =>
      prisma.service.upsert({
        where: { id: `seed-service-${i}` },
        update: {},
        create: { id: `seed-service-${i}`, workspaceId: workspace.id, sortOrder: i, isActive: true, ...s },
      })
    )
  );

  console.log(`✅ ${services.length} services created`);

  // ─── Packages ─────────────────────────────────────────────────────────────
  const starterPkg = await prisma.package.upsert({
    where: { id: "seed-pkg-starter" },
    update: {},
    create: {
      id: "seed-pkg-starter",
      workspaceId: workspace.id,
      name: "Starter — Photo Only",
      description: "Standard photography package for smaller homes",
      price: 175,
      isActive: true,
      sortOrder: 0,
      items: {
        create: [{ serviceId: services[0].id, quantity: 1 }],
      },
    },
  });

  const proPkg = await prisma.package.upsert({
    where: { id: "seed-pkg-pro" },
    update: {},
    create: {
      id: "seed-pkg-pro",
      workspaceId: workspace.id,
      name: "Pro — Photo + Drone + Floor Plan",
      description: "Our most popular package for listings under $750K",
      price: 449,
      isActive: true,
      isPopular: true,
      sortOrder: 1,
      items: {
        create: [
          { serviceId: services[0].id, quantity: 1 },
          { serviceId: services[2].id, quantity: 1 },
          { serviceId: services[6].id, quantity: 1 },
        ],
      },
    },
  });

  const premiumPkg = await prisma.package.upsert({
    where: { id: "seed-pkg-premium" },
    update: {},
    create: {
      id: "seed-pkg-premium",
      workspaceId: workspace.id,
      name: "Premium — Full Media Suite",
      description: "Everything you need for luxury listings",
      price: 899,
      isActive: true,
      sortOrder: 2,
      items: {
        create: [
          { serviceId: services[0].id, quantity: 1 },
          { serviceId: services[1].id, quantity: 1 },
          { serviceId: services[2].id, quantity: 1 },
          { serviceId: services[3].id, quantity: 1 },
          { serviceId: services[4].id, quantity: 1 },
          { serviceId: services[5].id, quantity: 1 },
          { serviceId: services[6].id, quantity: 1 },
        ],
      },
    },
  });

  console.log("✅ 3 packages created");

  // ─── Demo Clients ─────────────────────────────────────────────────────────
  const clientData = [
    { firstName: "Sarah", lastName: "Mitchell", email: "sarah.mitchell@kw.com", company: "Keller Williams Nashville", type: "AGENT" as const },
    { firstName: "James", lastName: "Patterson", email: "jp@remax-elite.com", company: "RE/MAX Elite", type: "AGENT" as const },
    { firstName: "Emily", lastName: "Chen", email: "echen@coldwellbanker.com", company: "Coldwell Banker", type: "AGENT" as const },
    { firstName: "David", lastName: "Rodriguez", email: "david@nashvillehomes.com", company: "Nashville Homes Group", type: "BROKER" as const },
    { firstName: "Lisa", lastName: "Thompson", email: "lisa@luxuryconstruction.com", company: "Luxury Construction Group", type: "BUILDER" as const },
  ];

  const clients = await Promise.all(
    clientData.map((c, i) =>
      prisma.client.upsert({
        where: { id: `seed-client-${i}` },
        update: {},
        create: {
          id: `seed-client-${i}`,
          workspaceId: workspace.id,
          status: "ACTIVE",
          source: "referral",
          ...c,
        },
      })
    )
  );

  console.log(`✅ ${clients.length} demo clients created`);

  console.log("\n🎉 Seed complete!");
  console.log("Next steps:");
  console.log("1. Create a user account via /register");
  console.log("2. Complete the onboarding wizard");
  console.log("3. Start adding jobs!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
