import { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
    persons: PersonTable,
    roles: RoleTable,
}

export interface RoleTable {
    id: Generated<string>
    name: string;
    description: string;
    created_at: ColumnType<Date, string | undefined, never>
    updated_at: ColumnType<Date, string | undefined, never>
}

export type Role = Selectable<RoleTable>;
export type NewRole = Insertable<RoleTable>;
export type UpdateRole = Updateable<RoleTable>;

export interface PersonTable {
    id: Generated<string>
    name: string;
    email: string;
    role_id: string;
    is_banned: boolean;
    created_at: ColumnType<Date, string | undefined, never>
    updated_at: ColumnType<Date, string | undefined, never>
}

export type Person = Selectable<PersonTable>;
export type NewPerson = Insertable<PersonTable>;
export type UpdatePerson = Updateable<PersonTable>;