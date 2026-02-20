import { type Adapter, Helper, type Model } from 'casbin'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Custom Casbin adapter backed by Drizzle ORM.
 *
 * Reads and writes Casbin policies to the casbin_rules SQLite table.
 * Avoids the fragile casbin-drizzle-adapter package (68 downloads/week).
 */
export class DrizzleCasbinAdapter implements Adapter {
  async loadPolicy(model: Model): Promise<void> {
    const rules = await db.select().from(schema.casbinRules).all()

    for (const rule of rules) {
      const values = [rule.v0, rule.v1, rule.v2, rule.v3, rule.v4, rule.v5].filter(
        (v) => v !== ''
      )
      const line = `${rule.ptype}, ${values.join(', ')}`
      Helper.loadPolicyLine(line, model)
    }
  }

  async savePolicy(model: Model): Promise<boolean> {
    // Clear existing rules
    await db.delete(schema.casbinRules)

    // Save all policy rules
    // model.model is a Map<string, Map<string, Assertion>>, not a plain object
    const astMap = model.model as Map<string, Map<string, { policy: string[][] }>>
    for (const [, sectionMap] of astMap) {
      for (const [key, assertion] of sectionMap) {
        if (!assertion.policy) continue
        for (const rule of assertion.policy) {
          await db.insert(schema.casbinRules).values({
            ptype: key,
            v0: rule[0] ?? '',
            v1: rule[1] ?? '',
            v2: rule[2] ?? '',
            v3: rule[3] ?? '',
            v4: rule[4] ?? '',
            v5: rule[5] ?? '',
          })
        }
      }
    }

    return true
  }

  async addPolicy(_sec: string, ptype: string, rule: string[]): Promise<void> {
    await db.insert(schema.casbinRules).values({
      ptype,
      v0: rule[0] ?? '',
      v1: rule[1] ?? '',
      v2: rule[2] ?? '',
      v3: rule[3] ?? '',
      v4: rule[4] ?? '',
      v5: rule[5] ?? '',
    })
  }

  async removePolicy(_sec: string, ptype: string, rule: string[]): Promise<void> {
    // Build conditions for matching
    const rows = await db
      .select()
      .from(schema.casbinRules)
      .where(eq(schema.casbinRules.ptype, ptype))
      .all()

    for (const row of rows) {
      const values = [row.v0, row.v1, row.v2, row.v3, row.v4, row.v5]
      const matches = rule.every((v, i) => values[i] === v)
      if (matches) {
        await db.delete(schema.casbinRules).where(eq(schema.casbinRules.id, row.id))
        return
      }
    }
  }

  async removeFilteredPolicy(
    _sec: string,
    ptype: string,
    fieldIndex: number,
    ...fieldValues: string[]
  ): Promise<void> {
    const rows = await db
      .select()
      .from(schema.casbinRules)
      .where(eq(schema.casbinRules.ptype, ptype))
      .all()

    for (const row of rows) {
      const values = [row.v0, row.v1, row.v2, row.v3, row.v4, row.v5]
      const matches = fieldValues.every(
        (fv, i) => fv === '' || values[fieldIndex + i] === fv
      )
      if (matches) {
        await db.delete(schema.casbinRules).where(eq(schema.casbinRules.id, row.id))
      }
    }
  }
}
