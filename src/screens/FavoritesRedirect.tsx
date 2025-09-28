import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';

const FavoritesRedirect: React.FC = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // Redirect to UnifiedResultsScreen with favorites type
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'UnifiedResults' as never,
          params: {
            type: 'favorites',
          } as never,
        },
      ],
    });
  }, [navigation]);

  return null;
};

export default FavoritesRedirect;