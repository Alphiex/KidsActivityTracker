import React, { useState, useEffect } from 'react';
import {
  Image,
  View,
  StyleSheet,
  ActivityIndicator,
  ImageSourcePropType,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { Colors } from '../theme/colors';

interface OptimizedActivityImageProps {
  source: ImageSourcePropType;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  showLoadingIndicator?: boolean;
}

export const OptimizedActivityImage: React.FC<OptimizedActivityImageProps> = ({
  source,
  style,
  containerStyle,
  resizeMode = 'cover',
  showLoadingIndicator = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Reset states when source changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [source]);

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={source}
        style={[styles.image, style]}
        resizeMode={resizeMode}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        // Force image to load immediately
        fadeDuration={0}
        // Optimize for performance
        resizeMethod="resize"
      />
      
      {isLoading && showLoadingIndicator && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}
      
      {hasError && (
        <View style={[styles.errorOverlay, style]}>
          <Image
            source={require('../assets/images/activities/recreation_center.jpg')}
            style={[styles.image, style]}
            resizeMode={resizeMode}
            fadeDuration={0}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#f5f5f5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f5f5f5',
  },
});