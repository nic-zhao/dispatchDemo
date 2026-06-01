import communityImagesData from '../data/community-images.json';

export interface LocalImage {
  name: string;
  tag: string;
  size: string;
  available: true;
}

export interface CommunityImage {
  name: string;
  tags: string[];
  description: string;
  recommendedResources: {
    vgpuNumber: number;
    vgpuMemory: number;
    vgpuCores: number;
    cpu: string;
    memory: string;
  };
  command: string[];
  args?: string[];
  ports?: number[];
  category: string;
  available: false;
}

// Available local/demo images for creating deployments
export const LOCAL_IMAGES: LocalImage[] = [
  {
    name: 'vllm/vllm-openai',
    tag: 'latest',
    size: '~',
    available: true,
  },
  {
    name: 'jupyter/base-notebook',
    tag: 'python-3.12',
    size: '~',
    available: true,
  },
  {
    name: 'jupyter/scipy-notebook',
    tag: 'latest',
    size: '~',
    available: true,
  },
  {
    name: 'jupyter/datascience-notebook',
    tag: 'latest',
    size: '~',
    available: true,
  },
  {
    name: 'nginx',
    tag: 'latest',
    size: '~',
    available: true,
  },
  {
    name: 'python',
    tag: '3.12-slim',
    size: '~',
    available: true,
  },
  {
    name: 'ollama/ollama',
    tag: 'latest',
    size: '~',
    available: true,
  },
  {
    name: 'mistral/vllm',
    tag: 'latest',
    size: '~',
    available: true,
  },
];

export async function getLocalImages(): Promise<LocalImage[]> {
  // Return pre-defined available images
  // In production, this would query the node's container registry
  return Promise.resolve(LOCAL_IMAGES);
}

export function getCommunityImages(): CommunityImage[] {
  return communityImagesData.map((img) => ({
    ...img,
    available: false as const,
  }));
}