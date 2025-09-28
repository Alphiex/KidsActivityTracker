// Debug Logger - comprehensive logging for debugging
const DEBUG = true; // Enable/disable all debug logs

interface LogEntry {
  timestamp: string;
  type: 'API' | 'PREF' | 'UI' | 'STATE' | 'ERROR';
  location: string;
  message: string;
  data?: any;
}

class DebugLogger {
  private static logs: LogEntry[] = [];

  static log(type: LogEntry['type'], location: string, message: string, data?: any) {
    if (!DEBUG) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type,
      location,
      message,
      data
    };

    this.logs.push(entry);

    // Format for console
    const prefix = `[${type}] ${location}`;
    const color = this.getColor(type);

    console.log(
      `%c${prefix}%c ${message}`,
      `color: ${color}; font-weight: bold`,
      'color: inherit',
      data ? data : ''
    );

    // Also log raw data if present
    if (data && typeof data === 'object') {
      console.log('📊 Data:', JSON.stringify(data, null, 2));
    }
  }

  static getColor(type: LogEntry['type']): string {
    switch(type) {
      case 'API': return '#4CAF50';
      case 'PREF': return '#2196F3';
      case 'UI': return '#FF9800';
      case 'STATE': return '#9C27B0';
      case 'ERROR': return '#F44336';
      default: return '#757575';
    }
  }

  static api(location: string, message: string, data?: any) {
    this.log('API', location, message, data);
  }

  static pref(location: string, message: string, data?: any) {
    this.log('PREF', location, message, data);
  }

  static ui(location: string, message: string, data?: any) {
    this.log('UI', location, message, data);
  }

  static state(location: string, message: string, data?: any) {
    this.log('STATE', location, message, data);
  }

  static error(location: string, message: string, data?: any) {
    this.log('ERROR', location, message, data);
  }

  static getLogs(): LogEntry[] {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
  }

  static printSummary() {
    console.log('=' .repeat(80));
    console.log('DEBUG LOG SUMMARY');
    console.log('=' .repeat(80));

    const summary = {
      total: this.logs.length,
      byType: {} as Record<string, number>,
      errors: this.logs.filter(l => l.type === 'ERROR'),
      apiCalls: this.logs.filter(l => l.type === 'API')
    };

    this.logs.forEach(log => {
      summary.byType[log.type] = (summary.byType[log.type] || 0) + 1;
    });

    console.table(summary.byType);

    if (summary.errors.length > 0) {
      console.log('❌ ERRORS FOUND:');
      summary.errors.forEach(err => {
        console.log(`  - ${err.location}: ${err.message}`);
      });
    }

    console.log('🔄 API CALLS:');
    summary.apiCalls.forEach(call => {
      console.log(`  - ${call.location}: ${call.message}`);
    });
  }
}

export default DebugLogger;