import { callApi, type ApiCallResult } from "@/lib/api-client";

import {
  TransportServiceError, deliveryDate, filterSchema,
  type DeliveryFilters, type FilteredReceiving, type ReceivingSnapshot,
} from "./types";

async function unwrap(result: Promise<ApiCallResult<ReceivingSnapshot>>) {
  const response = await result;
  if (!response.ok) throw new TransportServiceError(response.message);
  return response.data;
}

/** Filters apply to pending deliveries only; every condition must match. */
export function filterDeliveries(snapshot: ReceivingSnapshot, raw: DeliveryFilters): FilteredReceiving {
  const filters = filterSchema.parse(raw);
  const deliveryNumber = filters.deliveryNumber.toLowerCase();
  return {
    pending: snapshot.pending.filter((entry) => (!filters.date || deliveryDate(entry) === filters.date)
      && entry.transportNumber.toLowerCase().includes(deliveryNumber)
      && (!filters.packageNumber || entry.units.some((unit) => unit.unitNumber?.includes(filters.packageNumber)))),
    confirmed: snapshot.confirmed,
    pendingTotal: snapshot.pending.length,
  };
}

export const receivingService = {
  async search(groupId: string, filters: DeliveryFilters) {
    return filterDeliveries(await unwrap(callApi<ReceivingSnapshot>(`/api/v1/groups/${groupId}/receiving`, { method: "GET" })), filters);
  },
  async confirm(groupId: string, transportIds: string[], filters: DeliveryFilters) {
    return filterDeliveries(await unwrap(callApi<ReceivingSnapshot>(`/api/v1/groups/${groupId}/receiving`, { body: { transportIds } })), filters);
  },
};
