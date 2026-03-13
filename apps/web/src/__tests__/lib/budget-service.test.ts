import { describe, it, expect, beforeEach } from "vitest";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { createTestDb } from "../test-utils";
import { BudgetService } from "@/lib/services/budget-service";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";

describe("BudgetService", () => {
  let db: BunSQLiteDatabase<typeof schema>;
  let service: BudgetService;
  let userId: string;

  beforeEach(() => {
    db = createTestDb();
    service = new BudgetService(db);
    userId = generateId();

    // Seed a test user (required by FK on budget.createdBy)
    db.insert(schema.user)
      .values({
        id: userId,
        name: "Test User",
        email: "test@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
  });

  it("creates a budget and adds creator as owner", () => {
    const budget = service.create(userId, { name: "My Budget" });

    expect(budget).toBeDefined();
    expect(budget.name).toBe("My Budget");
    expect(budget.currency).toBe("USD");
    expect(budget.createdBy).toBe(userId);

    // Verify membership was created
    const members = db
      .select()
      .from(schema.budgetMember)
      .where(eq(schema.budgetMember.budgetId, budget.id))
      .all();
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
    expect(members[0].userId).toBe(userId);
  });

  it("creates a budget with specified currency", () => {
    const budget = service.create(userId, {
      name: "Euro Budget",
      currency: "EUR",
    });
    expect(budget.currency).toBe("EUR");
  });

  it("lists only budgets the user is a member of", () => {
    service.create(userId, { name: "Budget 1" });
    service.create(userId, { name: "Budget 2" });

    // Create another user with their own budget
    const otherUserId = generateId();
    db.insert(schema.user)
      .values({
        id: otherUserId,
        name: "Other User",
        email: "other@example.com",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();
    service.create(otherUserId, { name: "Other Budget" });

    const budgets = service.listForUser(userId);
    expect(budgets).toHaveLength(2);
    expect(budgets.map((b) => b.name).sort()).toEqual(["Budget 1", "Budget 2"]);
  });

  it("gets a budget by id", () => {
    const created = service.create(userId, { name: "Find Me" });
    const found = service.getById(created.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe("Find Me");
  });

  it("returns undefined for non-existent budget", () => {
    const found = service.getById(generateId());
    expect(found).toBeUndefined();
  });

  it("updates a budget name", () => {
    const created = service.create(userId, { name: "Old Name" });
    service.update(created.id, { name: "New Name" });
    const updated = service.getById(created.id);
    expect(updated!.name).toBe("New Name");
  });

  it("deletes a budget and cascades to members", () => {
    const created = service.create(userId, { name: "Delete Me" });
    service.delete(created.id);

    const found = service.getById(created.id);
    expect(found).toBeUndefined();

    // Verify members are also deleted (cascade)
    const members = db
      .select()
      .from(schema.budgetMember)
      .where(eq(schema.budgetMember.budgetId, created.id))
      .all();
    expect(members).toHaveLength(0);
  });
});
