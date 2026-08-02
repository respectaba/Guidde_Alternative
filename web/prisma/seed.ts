/**
 * Seeds a few demo guides so the entire web experience (dashboard, editor,
 * playback, sharing, PDF export) works end-to-end without the extension.
 */
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import type { Step } from "@guide/shared";
import { mockScreen } from "./mockScreens";

const prisma = new PrismaClient();

const VIEWPORT = { w: 1280, h: 720, dpr: 1 };

function step(partial: Partial<Step> & Pick<Step, "id" | "screenshot" | "click" | "caption" | "element">): Step {
  return {
    order: 0,
    viewport: VIEWPORT,
    annotations: [],
    blurRegions: [],
    ...partial,
  } as Step;
}

function buildOnboardingSteps(): Step[] {
  return [
    step({
      id: "s1",
      screenshot: mockScreen({
        title: "Acme Dashboard",
        accent: "#4f46e5",
        rows: ["Welcome back!", "You have 3 pending tasks", "Recent activity"],
        primaryButton: "New Project",
      }),
      click: { x: 0.863, y: 0.9 },
      caption: 'Click the "New Project" button to get started',
      element: {
        selector: "button.primary",
        tagName: "button",
        text: "New Project",
        role: "button",
        boundingRect: { x: 0.789, y: 0.861, w: 0.148, h: 0.078 },
      },
      annotations: [
        {
          id: "a1",
          type: "highlight",
          rect: { x: 0.783, y: 0.855, w: 0.16, h: 0.09 },
          color: "#f59e0b",
        },
      ],
    }),
    step({
      id: "s2",
      screenshot: mockScreen({
        title: "Create Project",
        accent: "#4f46e5",
        rows: ["Project name", "Description", "Visibility: Private"],
        primaryButton: "Continue",
      }),
      click: { x: 0.52, y: 0.208 },
      caption: 'Type into the "Project name" field',
      element: {
        selector: "input#name",
        tagName: "input",
        text: "Project name",
        role: "textbox",
        boundingRect: { x: 0.234, y: 0.208, w: 0.703, h: 0.072 },
      },
      annotations: [
        {
          id: "a2",
          type: "text",
          point: { x: 0.3, y: 0.35 },
          value: "Give it a memorable name",
          color: "#4f46e5",
          fontSize: 0.03,
        },
        {
          id: "a3",
          type: "arrow",
          from: { x: 0.34, y: 0.33 },
          to: { x: 0.4, y: 0.24 },
          color: "#4f46e5",
        },
      ],
    }),
    step({
      id: "s3",
      screenshot: mockScreen({
        title: "Invite Team",
        accent: "#4f46e5",
        rows: ["teammate@example.com", "Role: Editor", "billing@example.com"],
        primaryButton: "Send Invites",
      }),
      click: { x: 0.863, y: 0.9 },
      caption: 'Click "Send Invites" to finish onboarding',
      element: {
        selector: "button.primary",
        tagName: "button",
        text: "Send Invites",
        role: "button",
        boundingRect: { x: 0.789, y: 0.861, w: 0.148, h: 0.078 },
      },
      blurRegions: [
        // hide the email addresses
        { id: "b1", rect: { x: 0.234, y: 0.18, w: 0.5, h: 0.075 }, intensity: 0.02 },
        { id: "b2", rect: { x: 0.234, y: 0.375, w: 0.5, h: 0.075 }, intensity: 0.02 },
      ],
      annotations: [
        {
          id: "a4",
          type: "highlight",
          rect: { x: 0.783, y: 0.855, w: 0.16, h: 0.09 },
          color: "#10b981",
        },
      ],
    }),
  ];
}

function buildSettingsSteps(): Step[] {
  return [
    step({
      id: "s1",
      screenshot: mockScreen({
        title: "Settings",
        accent: "#0ea5e9",
        rows: ["Profile", "Notifications", "Security", "API Keys"],
      }),
      click: { x: 0.5, y: 0.6 },
      caption: 'Open the "Security" settings section',
      element: {
        selector: "a.nav-security",
        tagName: "a",
        text: "Security",
        role: "link",
        boundingRect: { x: 0.234, y: 0.555, w: 0.703, h: 0.072 },
      },
      annotations: [
        {
          id: "a1",
          type: "highlight",
          rect: { x: 0.228, y: 0.548, w: 0.715, h: 0.086 },
          color: "#f59e0b",
        },
      ],
    }),
    step({
      id: "s2",
      screenshot: mockScreen({
        title: "Security",
        accent: "#0ea5e9",
        rows: ["Two-factor authentication", "Active sessions", "Password"],
        primaryButton: "Enable 2FA",
      }),
      click: { x: 0.863, y: 0.9 },
      caption: 'Click "Enable 2FA" to secure your account',
      element: {
        selector: "button.primary",
        tagName: "button",
        text: "Enable 2FA",
        role: "button",
        boundingRect: { x: 0.789, y: 0.861, w: 0.148, h: 0.078 },
      },
      annotations: [
        {
          id: "a2",
          type: "arrow",
          from: { x: 0.7, y: 0.78 },
          to: { x: 0.85, y: 0.88 },
          color: "#ef4444",
        },
      ],
    }),
  ];
}

async function main() {
  console.log("Seeding demo guides…");

  // Idempotent: clear existing demo rows by known slugs.
  await prisma.guide.deleteMany({
    where: { publicSlug: { in: ["demo-onboarding", "demo-security"] } },
  });

  await prisma.guide.create({
    data: {
      title: "How to create your first project",
      publicSlug: "demo-onboarding",
      isPublic: true,
      steps: JSON.stringify(
        buildOnboardingSteps().map((s, i) => ({ ...s, order: i })),
      ),
    },
  });

  await prisma.guide.create({
    data: {
      title: "Enabling two-factor authentication",
      publicSlug: "demo-security",
      isPublic: false,
      steps: JSON.stringify(
        buildSettingsSteps().map((s, i) => ({ ...s, order: i })),
      ),
    },
  });

  // A third guide with a fresh random slug to show non-demo data too.
  await prisma.guide.create({
    data: {
      title: "Quick tour of the dashboard",
      publicSlug: nanoid(12),
      isPublic: true,
      steps: JSON.stringify(
        buildOnboardingSteps()
          .slice(0, 2)
          .map((s, i) => ({ ...s, order: i })),
      ),
    },
  });

  const count = await prisma.guide.count();
  console.log(`Done. ${count} guides in the database.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
