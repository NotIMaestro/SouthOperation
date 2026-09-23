import { createMockPackageService } from "./mock-service";
import type { PackageService } from "./types";

// Replace this adapter with an HTTP implementation when the package API is ready.
const service: PackageService = createMockPackageService();
export const { findPackageByQrToken, findPackageByPackageNumber, getAllPackages, generatePackage, resetGeneratedPackages } = service;
