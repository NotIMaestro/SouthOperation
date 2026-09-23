import { callApi, type ApiCallResult } from "@/lib/api-client";

import { PickupServiceError, type CollectionSnapshot } from "./types";

async function unwrap(result: Promise<ApiCallResult<CollectionSnapshot>>) {
  const response = await result;
  if (!response.ok) throw new PickupServiceError(response.message);
  return response.data;
}

export const collectionService = {
  getPackages(groupId: string) {
    return unwrap(callApi<CollectionSnapshot>(`/api/v1/groups/${groupId}/pickup`, { method: "GET" }));
  },
  confirmPackages(groupId: string, packingUnitIds: string[]) {
    return unwrap(callApi<CollectionSnapshot>(`/api/v1/groups/${groupId}/pickup`, { body: { packingUnitIds } }));
  },
};
