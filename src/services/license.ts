import axios from 'axios';
import { getStoredToken } from './auth';
import { getSubscription } from './subscription';

// Ensure API URL is always localhost:3001 for desktop app
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface LicenseStatus {
  status: 'free' | 'pro';
  isValid: boolean;
  subscription?: {
    plan: 'annual' | 'friend';
    endDate: string;
  };
}

export async function validateLicense(licenseKey?: string): Promise<LicenseStatus> {
  const token = getStoredToken();
  
  if (!token) {
    return { status: 'free', isValid: false };
  }

  try {
    // First check subscription
    const subscriptionResponse = await getSubscription(token);
    
    if (!subscriptionResponse.isValid || !subscriptionResponse.subscription) {
      return { status: 'free', isValid: false };
    }

    // Validate license key if provided
    if (licenseKey) {
      const deviceId = localStorage.getItem('devbench_device_id') || generateDeviceId();
      localStorage.setItem('devbench_device_id', deviceId);
      
      const response = await axios.post(`${API_URL}/api/license/validate`, {
        licenseKey,
        deviceId
      });
      
      return {
        status: response.data.isValid ? 'pro' : 'free',
        isValid: response.data.isValid,
        subscription: response.data.subscription
      };
    }

    // If no license key but has valid subscription, generate one
    const licenseResponse = await axios.post(
      `${API_URL}/api/license/generate`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return {
      status: 'pro',
      isValid: true,
      subscription: {
        plan: subscriptionResponse.subscription.plan === 'trial' ? 'annual' : subscriptionResponse.subscription.plan as 'annual' | 'friend',
        endDate: subscriptionResponse.subscription.endDate
      }
    };
  } catch (error: any) {
    console.error('Failed to validate license:', error);
    return { status: 'free', isValid: false };
  }
}

function generateDeviceId(): string {
  return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function setupLicenseListeners(
  onValidated: (status: LicenseStatus) => void,
  onInvalid: (message: string) => void
) {
  // Check license on load
  validateLicense().then(status => {
    if (status.isValid) {
      onValidated(status);
    } else {
      onInvalid('No valid subscription found. Please login and subscribe.');
    }
  });

  // Check periodically
  setInterval(() => {
    validateLicense().then(status => {
      if (!status.isValid) {
        onInvalid('Subscription expired or invalid. Please renew your subscription.');
      }
    });
  }, 5 * 60 * 1000); // Check every 5 minutes
}


