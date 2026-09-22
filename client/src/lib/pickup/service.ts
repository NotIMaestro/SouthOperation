import { createMockCollectionService } from "./mock-service";
import type { CollectionService } from "./types";

// The UI depends on this boundary; an authenticated HTTP adapter can replace it.
export const collectionService: CollectionService = createMockCollectionService();
