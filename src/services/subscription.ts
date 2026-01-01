import axios from 'axios';

// Ensure API URL is always localhost:3001 for desktop app
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Subscription {
    id: string;
    userId: string;
    plan: 'trial' | 'annual' | 'friend';
    status: 'active' | 'expired' | 'cancelled';
    startDate: string;
    endDate: string;
}

export interface SubscriptionResponse {
    subscription: Subscription | null;
    isValid: boolean;
}

export async function getSubscription(token: string): Promise<SubscriptionResponse> {
    const response = await axios.get(`${API_URL}/api/subscription/me`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}

export async function createSubscription(token: string, plan: 'annual' | 'friend'): Promise<Subscription> {
    const response = await axios.post(
        `${API_URL}/api/subscription/create`,
        { plan },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.subscription;
}

export async function getPricingPlans() {
    const response = await axios.get(`${API_URL}/api/subscription/plans`);
    return response.data.plans;
}

