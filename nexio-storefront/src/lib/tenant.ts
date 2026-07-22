export function getTenantId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('nexio_tenant_id');
    if (saved) return saved;
  }
  // Deployment-specific tenant ID, with the deterministic development seed as fallback.
  return process.env.NEXT_PUBLIC_TENANT_ID || '9c85b40e-5f51-4668-a9bb-f9320d309052';
}

export function setTenantId(tenantId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexio_tenant_id', tenantId);
  }
}
