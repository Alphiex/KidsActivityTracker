import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

interface Props {
  error: Error;
  onRetry: () => void;
}

const SimpleErrorDisplay: React.FC<Props> = ({ error, onRetry }) => {
  // Extract the most important part of the error
  const errorMessage = error.message || 'Unknown error';
  const errorName = error.name || 'Error';
  
  // Try to extract the main error from the message
  let mainError = errorMessage;
  if (errorMessage.includes('The action')) {
    mainError = errorMessage.split('\n')[0];
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Navigation Error</Text>
      
      <View style={styles.errorBox}>
        <Text style={styles.label}>Error Type:</Text>
        <Text style={styles.value}>{errorName}</Text>
      </View>

      <View style={styles.errorBox}>
        <Text style={styles.label}>Main Error:</Text>
        <Text style={styles.value}>{mainError}</Text>
      </View>

      <View style={styles.errorBox}>
        <Text style={styles.label}>Full Message:</Text>
        <ScrollView style={styles.messageScroll}>
          <Text style={styles.message}>{errorMessage}</Text>
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  messageScroll: {
    maxHeight: 150,
  },
  message: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SimpleErrorDisplay;