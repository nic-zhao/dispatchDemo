import { exec } from 'child_process';
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function getLocalImages(): Promise<LocalImage[]> {
  return new Promise((resolve) => {
    exec('k3s crictl images -o json', (err, stdout) => {
      if (err) {
        console.error('Failed to list local images:', err.message);
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        const images = (parsed.images || []).map((img: any) => {
          const repoTags: string[] = img.repoTags || [];
          const [name, tag] = repoTags.length > 0
            ? repoTags[0].split(':')
            : [img.repoDigests?.[0]?.split('@')[0] || 'unknown', 'latest'];

          return {
            name,
            tag: tag || 'latest',
            size: formatBytes(parseInt(img.size) || 0),
            available: true as const,
          };
        });

        resolve(images);
      } catch (parseErr: any) {
        console.error('Failed to parse crictl output:', parseErr.message);
        resolve([]);
      }
    });
  });
}

export function getCommunityImages(): CommunityImage[] {
  return communityImagesData.map((img) => ({
    ...img,
    available: false as const,
  }));
}
