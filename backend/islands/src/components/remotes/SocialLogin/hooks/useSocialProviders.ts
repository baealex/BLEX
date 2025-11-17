import { useState, useEffect } from 'react';
import { getSocialProviders } from '~/lib/api';

interface SocialProvider {
  key: string;
  name: string;
  color: string;
}

export const useSocialProviders = () => {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const data = await getSocialProviders();

        if (data.status === 'DONE' && data.body) {
          setProviders(data.body);
        }
      } catch (error) {
        console.error('Failed to load social providers:', error);
      }
      setLoading(false);
    };

    loadProviders();
  }, []);

  return {
    providers,
    loading
  };
};