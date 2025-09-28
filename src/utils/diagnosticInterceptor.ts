import axios from 'axios';

class DiagnosticInterceptor {
  private static requestId = 0;

  static setupInterceptors() {
    // Request interceptor
    axios.interceptors.request.use(
      (config) => {
        const id = ++this.requestId;
        const timestamp = new Date().toISOString();

        console.log(`\n${'='.repeat(80)}`);
        console.log(`🚀 [REQUEST #${id}] ${timestamp}`);
        console.log(`${'='.repeat(80)}`);
        console.log('📍 URL:', config.url);
        console.log('📍 Method:', config.method?.toUpperCase());
        console.log('📍 Base URL:', config.baseURL);
        console.log('📍 Full URL:', config.baseURL ? `${config.baseURL}${config.url}` : config.url);

        if (config.params) {
          console.log('📍 Query Params:', JSON.stringify(config.params, null, 2));
        }

        if (config.headers) {
          console.log('📍 Headers:', JSON.stringify(config.headers, null, 2));
        }

        if (config.data) {
          console.log('📍 Body Data:', JSON.stringify(config.data, null, 2));
        }

        // Attach request ID for tracking
        config.metadata = { startTime: new Date(), requestId: id };

        return config;
      },
      (error) => {
        console.log(`❌ REQUEST ERROR:`, error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    axios.interceptors.response.use(
      (response) => {
        const id = response.config.metadata?.requestId || 'unknown';
        const startTime = response.config.metadata?.startTime;
        const duration = startTime ? new Date().getTime() - startTime.getTime() : 0;

        console.log(`\n${'='.repeat(80)}`);
        console.log(`✅ [RESPONSE #${id}] Duration: ${duration}ms`);
        console.log(`${'='.repeat(80)}`);
        console.log('📍 Status:', response.status, response.statusText);
        console.log('📍 URL:', response.config.url);

        if (response.data) {
          // Handle large responses
          if (response.data.activities && Array.isArray(response.data.activities)) {
            console.log('📍 Activities Count:', response.data.activities.length);
            if (response.data.activities.length > 0) {
              console.log('📍 First Activity:', JSON.stringify(response.data.activities[0], null, 2).substring(0, 500) + '...');
            }
            console.log('📍 Pagination:', response.data.pagination);
          } else {
            const dataStr = JSON.stringify(response.data, null, 2);
            if (dataStr.length > 1000) {
              console.log('📍 Response Data (truncated):', dataStr.substring(0, 1000) + '...');
            } else {
              console.log('📍 Response Data:', dataStr);
            }
          }
        }

        return response;
      },
      (error) => {
        const id = error.config?.metadata?.requestId || 'unknown';
        const startTime = error.config?.metadata?.startTime;
        const duration = startTime ? new Date().getTime() - startTime.getTime() : 0;

        console.log(`\n${'='.repeat(80)}`);
        console.log(`❌ [ERROR #${id}] Duration: ${duration}ms`);
        console.log(`${'='.repeat(80)}`);

        if (error.response) {
          // Server responded with error
          console.log('❌ Status:', error.response.status);
          console.log('❌ Status Text:', error.response.statusText);
          console.log('❌ URL:', error.config?.url);
          console.log('❌ Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
          // Request made but no response
          console.log('❌ NO RESPONSE RECEIVED');
          console.log('❌ URL:', error.config?.url);
          console.log('❌ Request Details:', {
            url: error.config?.url,
            method: error.config?.method,
            params: error.config?.params,
          });
          console.log('❌ Possible causes:');
          console.log('   - Network connectivity issues');
          console.log('   - Server not responding');
          console.log('   - CORS issues (if browser)');
          console.log('   - DNS resolution failed');
          console.log('   - Timeout exceeded');
        } else {
          // Error setting up request
          console.log('❌ REQUEST SETUP ERROR:', error.message);
        }

        return Promise.reject(error);
      }
    );

    console.log('🔧 Diagnostic interceptors installed successfully');
  }

  static removeInterceptors() {
    // Note: In production, you'd want to store the interceptor IDs and remove them properly
    console.log('🔧 Diagnostic interceptors would be removed here');
  }
}

export default DiagnosticInterceptor;