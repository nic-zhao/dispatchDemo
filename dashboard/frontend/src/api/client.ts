const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getOverview: () => request<any>('/overview'),
  getDeployments: () => request<any[]>('/deployments'),
  createDeployment: (data: any) => request<any>('/deployments', { method: 'POST', body: JSON.stringify(data) }),
  getDeployment: (name: string, ns?: string) => request<any>(`/deployments/${name}${ns ? `?namespace=${ns}` : ''}`),
  scaleDeployment: (name: string, data: any) => request<any>(`/deployments/${name}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeployment: (name: string, ns?: string) => request<any>(`/deployments/${name}${ns ? `?namespace=${ns}` : ''}`, { method: 'DELETE' }),
  getImages: () => request<{ local: any[]; community: any[] }>('/images'),
  getResources: () => request<any>('/resources'),
  getLogStreamUrl: (name: string, ns?: string) => `${BASE}/deployments/${name}/logs${ns ? `?namespace=${ns}` : ''}`,
  getPods: () => request<any[]>('/pods'),
  getPodDetail: (name: string, ns?: string) => request<any>(`/pods/${name}${ns ? `?namespace=${ns}` : ''}`),
  deletePod: (name: string, ns?: string) => request<any>(`/pods/${name}${ns ? `?namespace=${ns}` : ''}`, { method: 'DELETE' }),
  getPodLogStreamUrl: (name: string, ns?: string) => `${BASE}/pods/${name}/logs${ns ? `?namespace=${ns}` : ''}`,
};
