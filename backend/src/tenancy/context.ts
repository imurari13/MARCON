import { AsyncLocalStorage } from "node:async_hooks";
export interface TenantContext { organizationId: string; }
export const tenants = new AsyncLocalStorage<TenantContext>();
export const currentOrganization = () => tenants.getStore()?.organizationId ?? "default";
export const setOrganization = (organizationId: string) => { const store = tenants.getStore(); if (store) store.organizationId = organizationId; };
