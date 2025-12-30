import { afterAll, afterEach, beforeAll, describe, it, expect } from "vitest";
import { db } from "../../plugins/database";
import { sql } from "kysely";

describe("PersonRepository", () => {
    beforeAll(async () => {
        await db.schema.createTable("roles")
        .addColumn("id", "uuid", (cb) => cb.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn("name", "varchar", (cb) => cb.notNull())
        .addColumn("description", "varchar")
        .addColumn("created_at", "timestamp", (cb) =>
            cb.notNull().defaultTo(sql`now()`)
        )
        .addColumn("updated_at", "timestamp", (cb) =>
            cb.notNull().defaultTo(sql`now()`)
        ).execute()

        await db.schema.createTable('persons')
        .addColumn('id', 'uuid', (cb) => cb.primaryKey().defaultTo(sql`gen_random_uuid()`))
        .addColumn('name', 'varchar', (cb) => cb.notNull())
        .addColumn('email', 'varchar(150)', (cb) => cb.notNull())
        .addColumn('role_id', 'uuid')
        .addColumn('is_banned', 'boolean', (cb) => cb.notNull().defaultTo(false))
        .addColumn("created_at", "timestamp", (cb) =>
            cb.notNull().defaultTo(sql`now()`)
        )
        .addColumn("updated_at", "timestamp", (cb) =>
            cb.notNull().defaultTo(sql`now()`)
        )
        .addForeignKeyConstraint('fk_role_id', ["role_id"], "roles", ["id"])
        .execute()
    })

    afterEach(async () => {
        await sql`truncate table ${sql.table('persons')} cascade`.execute(db);
        await sql`truncate table ${sql.table('roles')} cascade`.execute(db);
    })

    it("should enforce foreign key constraint", async () => {
        const role = await db.insertInto('roles')
            .values({
                name: 'USER',
                description: 'Regular user'
            })
            .returningAll()
            .executeTakeFirst();

        expect(role).toBeDefined();
        expect(role?.id).toBeDefined();

        const validUserWithRole = await db.insertInto('persons')
                .values({
                    name: 'John Doe',
                    email: 'john@example.com',
                    role_id: role!.id,
                    is_banned: false
                })
                .returningAll()
                .executeTakeFirst()

        expect(validUserWithRole).toBeDefined();
        expect(validUserWithRole?.id).toBeDefined();

        const invalidPersonWithFakeRoleId = db.insertInto('persons')
                .values({
                    name: 'Invalid Person',
                    email: 'invalid@example.com',
                    role_id: '00000000-0000-0000-0000-000000000000',
                    is_banned: false
                })
                .returningAll()
                .executeTakeFirst()
        await expect(invalidPersonWithFakeRoleId).rejects.toThrow();
    })

    afterAll(async () => {
        await db.schema.dropTable('persons').ifExists().execute();
        await db.schema.dropTable('roles').ifExists().execute();
    })
})