import { useState, useEffect } from 'react';
import { logger } from '~/utils/logger';
import { getSocialProviders, type SocialProvider } from '~/lib/api';

export const useSocialProviders = () => {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const { data } = await getSocialProviders();

        if (data.status === 'DONE' && data.body) {
          setProviders(data.body);
        }
      } catch (error) {
        logger.error('Failed to load social providers:', error);
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
