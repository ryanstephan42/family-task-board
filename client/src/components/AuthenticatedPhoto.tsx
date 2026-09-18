import { useEffect, useState } from 'react';
import api from '../services/api';

interface AuthenticatedPhotoProps {
  itemId: string;
  alt: string;
  className?: string;
}

export default function AuthenticatedPhoto({ itemId, alt, className }: AuthenticatedPhotoProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.get(`/inventory/${itemId}/photo`, { responseType: 'blob' }).then((response) => {
      objectUrl = URL.createObjectURL(response.data);
      setSrc(objectUrl);
    }).catch(() => setSrc(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId]);

  return src ? <img src={src} alt={alt} className={className} /> : null;
}
