import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Step } from "@guide/shared";
import { prisma } from "@/lib/db";
import { GET as listGuides, POST as createGuide } from "./route";
import {
  GET as getGuide,
  PATCH as patchGuide,
  DELETE as deleteGuide,
} from "./[id]/route";

function fixtureStep(over: Partial<Step> = {}): Step {
  return {
    id: "s1",
    order: 0,
    screenshot: "data:image/png;base64,AAAA",
    viewport: { w: 1280, h: 720, dpr: 1 },
    click: { x: 0.5, y: 0.5 },
    caption: "Click the button",
    element: {
      selector: "button",
      tagName: "button",
      text: "Go",
      role: "button",
      boundingRect: { x: 0.4, y: 0.4, w: 0.1, h: 0.05 },
    },
    annotations: [],
    blurRegions: [],
    ...over,
  };
}

function post(body: unknown) {
  return createGuide(
    new Request("http://localhost/api/guides", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }) as never,
  );
}

beforeEach(async () => {
  await prisma.guide.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/guides", () => {
  it("creates a guide from a valid payload", async () => {
    const res = await post({ title: "Test guide", steps: [fixtureStep()] });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeTruthy();
    expect(data.publicSlug).toBeTruthy();
    expect(data.guide.steps).toHaveLength(1);
    expect(data.guide.isPublic).toBe(false);
  });

  it("rejects an invalid payload with 422", async () => {
    const res = await post({ title: "", steps: [] });
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error).toBe("Validation failed");
  });

  it("sets CORS headers for the extension", async () => {
    const res = await post({ title: "x", steps: [fixtureStep()] });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("GET /api/guides", () => {
  it("lists created guides as summaries with a thumbnail", async () => {
    await post({ title: "One", steps: [fixtureStep()] });
    await post({ title: "Two", steps: [fixtureStep(), fixtureStep({ id: "s2" })] });

    const res = await listGuides();
    const data = await res.json();
    expect(data.guides).toHaveLength(2);
    const two = data.guides.find((g: { title: string }) => g.title === "Two");
    expect(two.stepCount).toBe(2);
    expect(two.thumbnail).toContain("data:image");
  });
});

describe("/api/guides/[id]", () => {
  async function seed() {
    const res = await post({ title: "Editable", steps: [fixtureStep()] });
    const { id } = await res.json();
    return id as string;
  }

  it("GET returns the full guide", async () => {
    const id = await seed();
    const res = await getGuide(new Request("http://localhost") as never, {
      params: { id },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guide.id).toBe(id);
    expect(data.guide.steps[0].caption).toBe("Click the button");
  });

  it("GET returns 404 for unknown id", async () => {
    const res = await getGuide(new Request("http://localhost") as never, {
      params: { id: "nope" },
    });
    expect(res.status).toBe(404);
  });

  it("PATCH updates caption + isPublic and re-indexes step order", async () => {
    const id = await seed();
    const updatedStep = fixtureStep({ caption: "Updated caption" });
    const res = await patchGuide(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ isPublic: true, steps: [updatedStep] }),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: { id } },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.guide.isPublic).toBe(true);
    expect(data.guide.steps[0].caption).toBe("Updated caption");
    expect(data.guide.steps[0].order).toBe(0);
  });

  it("PATCH rejects an empty body with 422", async () => {
    const id = await seed();
    const res = await patchGuide(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }) as never,
      { params: { id } },
    );
    expect(res.status).toBe(422);
  });

  it("DELETE removes the guide", async () => {
    const id = await seed();
    const res = await deleteGuide(new Request("http://localhost") as never, {
      params: { id },
    });
    expect(res.status).toBe(200);

    const after = await getGuide(new Request("http://localhost") as never, {
      params: { id },
    });
    expect(after.status).toBe(404);
  });
});
