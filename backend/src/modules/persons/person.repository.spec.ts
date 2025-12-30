import { afterAll, afterEach, beforeAll, describe, it, expect } from "vitest";
import { db } from "../../plugins/database";
import { sql } from "kysely";
import * as PersonRepository from './person.repository';

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
        .addColumn('email', 'varchar(150)', (cb) => cb.notNull().unique())
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
    })

    describe("findPersonById", () => {
        it("should find existing person by ID", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirst();

            const created = await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role!.id,
                is_banned: false
            });

            const found = await PersonRepository.findPersonById(created.id);
            expect(found).toBeDefined();
            expect(found?.id).toBe(created.id);
            expect(found?.name).toBe('John Doe');
        })

        it("should return undefined for non-existent person", async () => {
            const found = await PersonRepository.findPersonById('00000000-0000-0000-0000-000000000000');
            expect(found).toBeUndefined();
        })
    })

    describe("findPeople", () => {
        it("should find by ID", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            const person1 = await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role.id,
                is_banned: false
            });

            const person2 = await PersonRepository.createPerson({
                name: 'Alice Toe',
                email: 'alice@example.com',
                role_id: role.id,
                is_banned: false
            });

            const result1 = await PersonRepository.findPeople({ id: person1.id });
            expect(result1).toHaveLength(1);
            expect(result1[0]?.id).toBe(person1.id);

            const result2 = await PersonRepository.findPeople({ id: person2.id });
            expect(result2).toHaveLength(1);
            expect(result2[0]?.id).toBe(person2.id);
        })

        it("should find by email", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            await PersonRepository.createPerson({
                name: 'Alice Toe',
                email: 'alice@example.com',
                role_id: role.id,
                is_banned: false
            });

            const result = await PersonRepository.findPeople({ email: 'alice@example.com' });
            expect(result).toHaveLength(1);
            expect(result[0]?.email).toBe('alice@example.com');
        })

        it("should find by name (multiple results)", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john1@example.com',
                role_id: role.id,
                is_banned: false
            });

            await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john2@example.com',
                role_id: role!.id,
                is_banned: false
            });

            const result = await PersonRepository.findPeople({ name: 'John Doe' });
            expect(result).toHaveLength(2);
        })

        it("should find all with no criteria", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role.id,
                is_banned: false
            });

            await PersonRepository.createPerson({
                name: 'Jane Smith',
                email: 'jane@example.com',
                role_id: role.id,
                is_banned: false
            });

            const result = await PersonRepository.findPeople({});
            expect(result).toHaveLength(2);
        })
    })

    describe("updatePerson", () => {
        it("should update existing person", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            const person = await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role.id,
                is_banned: false
            });

            await PersonRepository.updatePerson(person.id, {
                name: 'Jack Smith',
                is_banned: true
            });

            const updated = await PersonRepository.findPersonById(person.id);
            expect(updated?.name).toBe('Jack Smith');
            expect(updated?.is_banned).toBe(true);
        })

        it("should silently fail when updating non-existent person", async () => {
            const result = await PersonRepository.updatePerson('00000000-0000-0000-0000-000000000000', {
                name: 'New Name',
                is_banned: true
            });

            expect(result).toBeUndefined();
        })
    })

    describe("createPerson", () => {
        it("should create valid person and return with generated ID", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            const created = await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role.id,
                is_banned: false
            });

            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
            expect(created.name).toBe('John Doe');
            expect(created.email).toBe('john@example.com');
        })

        it("should fail when creating person with duplicate email", async () => {
            const role = await db.insertInto('roles')
                .values({ name: 'USER', description: 'Regular user' })
                .returningAll()
                .executeTakeFirstOrThrow();

            await PersonRepository.createPerson({
                name: 'John Doe',
                email: 'john@example.com',
                role_id: role.id,
                is_banned: false
            });

            await expect(
                PersonRepository.createPerson({
                    name: 'Jane Smith',
                    email: 'john@example.com',
                    role_id: role.id,
                    is_banned: false
                })
            ).rejects.toThrow();
        })

        it("should fail when creating person with invalid role_id", async () => {
            await expect(
                PersonRepository.createPerson({
                    name: 'John Doe',
                    email: 'john@example.com',
                    role_id: '00000000-0000-0000-0000-000000000000',
                    is_banned: false
                })
            ).rejects.toThrow();
        })
    })

    afterAll(async () => {
        await db.schema.dropTable('persons').ifExists().execute();
        await db.schema.dropTable('roles').ifExists().execute();
    })
})