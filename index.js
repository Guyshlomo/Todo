import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

// Global error handler to prevent crashes on iOS 26 with New Architecture
try {
  const { ErrorUtils } = require('react-native');
  if (ErrorUtils) {
    const originalHandler = ErrorUtils.getGlobalHandler?.();
    if (originalHandler) {
      ErrorUtils.setGlobalHandler?.((error, isFatal) => {
        console.error('Global error handler:', error, isFatal);
        // Try to prevent crash by logging and continuing
        try {
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        } catch (e) {
          console.error('Error in global error handler:', e);
        }
      });
    }
  }
} catch (e) {
  console.warn('Could not set up global error handler:', e);
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
try {
  registerRootComponent(App);
} catch (error) {
  console.error('Failed to register root component:', error);
  // Re-throw to see the error
  throw error;
}
