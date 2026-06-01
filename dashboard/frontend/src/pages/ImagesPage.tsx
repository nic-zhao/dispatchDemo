import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

interface ImageItem {
  name: string;
  tag?: string;
  size?: string;
  available: boolean;
  description?: string;
  recommendedResources?: any;
  command?: string[];
  args?: string[];
  ports?: number[];
  category?: string;
  tags?: string[];
}

export function ImagesPage() {
  const [images, setImages] = useState<{ local: ImageItem[]; community: ImageItem[] }>({ local: [], community: [] });
  const navigate = useNavigate();

  useEffect(() => {
    api.getImages().then(setImages).catch(console.error);
  }, []);

  const handleCreate = (img: ImageItem) => {
    const fullName = img.tag ? `${img.name}:${img.tag}` : img.name;
    navigate(`/deployments?image=${encodeURIComponent(fullName)}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">镜像仓库</h2>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium">本地镜像</h3>
          <Badge variant="default" className="bg-green-500">{images.local.length}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.local.map((img) => (
            <Card key={img.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{img.name}</span>
                  <Badge variant="default" className="bg-green-500 text-xs">可用</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>标签: {img.tag || 'latest'}</p>
                  <p>大小: {img.size || '-'}</p>
                </div>
                <Button size="sm" className="w-full mt-3" onClick={() => handleCreate(img)}>
                  <Rocket className="h-3 w-3 mr-1" /> 以此创建部署
                </Button>
              </CardContent>
            </Card>
          ))}
          {images.local.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-3">暂无本地镜像</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium">社区镜像</h3>
          <Badge variant="secondary">{images.community.length}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.community.map((img) => (
            <Card key={img.name} className="hover:shadow-md transition-shadow opacity-80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{img.name}</span>
                  <Badge variant="secondary" className="text-xs">社区</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{img.description}</p>
                <div className="text-xs text-muted-foreground">
                  <p>标签: {img.tags?.join(', ') || 'latest'}</p>
                  {img.recommendedResources && (
                    <p>推荐: {img.recommendedResources.vgpuNumber} vGPU · {img.recommendedResources.vgpuMemory}MB 显存</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="w-full mt-3" onClick={() => handleCreate(img)}>
                  <Rocket className="h-3 w-3 mr-1" /> 以此创建部署
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
