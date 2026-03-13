import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { createTestDb } from "../test-utils";
import * as schema from "@/db/schema";
import { generateId } from "@/lib/id";

// Mock the production db and auth modules to prevent side effects (file open, network, etc.)
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: {} }));

import { hasMinRole, type BudgetRole } from "@/lib/auth-middleware";

describe("budget access control", () => {
  describe("hasMinRole", () => {
    it("owner has access at all levels", () => {
      expect(hasMinRole("owner", "viewer")).toBe(true);
      expect(hasMinRole("owner", "editor")).toBe(true);
      expect(hasMinRole("owner", "owner")).toBe(true);
    });

    it("editor has access at viewer and editor levels", () => {
      expect(hasMinRole("editor", "viewer")).toBe(true);
      expect(hasMinRole("editor", "editor")).toBe(true);
      expect(hasMinRole("editor", "owner")).toBe(false);
    });

    it("viewer has access only at viewer level", () => {
      expect(hasMinRole("viewer", "viewer")).toBe(true);
      expect(hasMinRole("viewer", "editor")).toBe(false);
      expect(hasMinRole("viewer", "owner")).toBe(false);
    });
  });

  describe("budgetMember role lookup", () => {
    let db: BunSQLiteDatabase<typeof schema>;
    let userId: string;
    let budgetId: string;

    beforeEach(() => {
      db = createTestDb();
      userId = generateId();
      budgetId = generateId();

      // Seed a user (required by FK)
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

      // Seed a budget
      db.insert(schema.budget)
        .values({
          id: budgetId,
          name: "Test Budget",
          currency: "USD",
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    });

    it("finds member with correct role", () => {
      const memberId = generateId();
      db.insert(schema.budgetMember)
        .values({
          id: memberId,
          budgetId,
          userId,
          role: "owner",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      const member = db
        .select({ role: schema.budgetMember.role })
        .from(schema.budgetMember)
        .where(
          and(
            eq(schema.budgetMember.budgetId, budgetId),
            eq(schema.budgetMember.userId, userId),
          ),
        )
        .get();

      expect(member).toBeDefined();
      expect(member!.role).toBe("owner");
      expect(hasMinRole(member!.role as BudgetRole, "editor")).toBe(true);
    });

    it("returns undefined for non-member", () => {
      const nonMemberId = generateId();
      // Seed another user who is NOT a member
      db.insert(schema.user)
        .values({
          id: nonMemberId,
          name: "Non Member",
          email: "nonmember@example.com",
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      const member = db
        .select({ role: schema.budgetMember.role })
        .from(schema.budgetMember)
        .where(
          and(
            eq(schema.budgetMember.budgetId, budgetId),
            eq(schema.budgetMember.userId, nonMemberId),
          ),
        )
        .get();

      expect(member).toBeUndefined();
    });

    it("enforces unique constraint on budgetId + userId", () => {
      const memberId = generateId();
      db.insert(schema.budgetMember)
        .values({
          id: memberId,
          budgetId,
          userId,
          role: "editor",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();

      // Attempting to insert a second membership for same user+budget should fail
      expect(() => {
        db.insert(schema.budgetMember)
          .values({
            id: generateId(),
            budgetId,
            userId,
            role: "viewer",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .run();
      }).toThrow();
    });
  });
});
