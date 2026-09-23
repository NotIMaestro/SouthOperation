import data from "./mock-collection.json";

// The one session identity for this prototype. Replace with the authenticated
// session when introducing the API; never derive identity from a lookup argument.
const currentUser = Object.freeze({ ...data.users[0] });
export function getCurrentUser() { return currentUser; }
