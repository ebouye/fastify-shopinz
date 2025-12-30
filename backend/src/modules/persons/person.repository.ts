import { db } from "../../plugins/database";
import { NewPerson, Person, UpdatePerson } from "../../shared/types";


export async function findPersonById(id: string) {
    return await db.selectFrom('persons')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst();
}

export async function findPeople(criteria: Partial<Person>) {
    let query = db.selectFrom('persons');

    if (criteria.id) {
        query = query.where('id', '=', criteria.id);
    }

    if (criteria.name) {
        query = query.where('name', '=', criteria.name);
    }

    if (criteria.email) {
        query = query.where('email', '=', criteria.email);
    }
    
    return await query.selectAll().execute();
}

export async function updatePerson(id: string, updatePerson: UpdatePerson) {
    await db.updateTable('persons').set(updatePerson).where('id', '=', id).execute();
}

export async function createPerson(person: NewPerson) {
    return await db.insertInto('persons').values(person).returningAll().executeTakeFirstOrThrow()
}