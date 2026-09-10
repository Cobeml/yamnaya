import type { HumanRole, Person } from "./contracts";

export const participantNames: Readonly<Record<HumanRole, string>> = {
  security: "Cobe",
  operations: "Megi",
  platform: "Daniel",
};

// Apply current display names to older snapshots without changing identity or authority.
export function displayPeople(people: Person[]): Person[] {
  return people.map(person => ({
    ...person,
    name: Object.hasOwn(participantNames, person.id)
      ? participantNames[person.id as HumanRole]
      : person.name,
  }));
}
