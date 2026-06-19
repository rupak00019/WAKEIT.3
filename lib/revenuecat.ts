import Purchases, { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useAuthStore } from '../store/authStore';

const RC_API_KEY = 'goog_placeholder_key'; // Placeholder API key as requested by PRD/User

/**
 * Initializes RevenueCat and logs in the Supabase user to associate billing accounts.
 */
export async function initializeRevenueCat(supabaseUserId: string): Promise<void> {
  try {
    // Configure with API key
    Purchases.configure({ apiKey: RC_API_KEY });
    
    // Link Supabase user ID to RevenueCat
    const { customerInfo } = await Purchases.logIn(supabaseUserId);
    
    // Sync current entitlements with authStore
    updateStoreEntitlements(customerInfo.entitlements.active);
    console.log('[RevenueCat] Initialization succeeded. Active entitlements:', Object.keys(customerInfo.entitlements.active));
  } catch (err) {
    console.error('[RevenueCat] Failed to initialize:', err);
  }
}

/**
 * Synchronizes active entitlements directly with the Zustand authStore.
 */
export function updateStoreEntitlements(activeEntitlements: Record<string, any>) {
  try {
    const authStore = useAuthStore.getState();
    authStore.setEntitlements(activeEntitlements);
  } catch (err) {
    console.error('[RevenueCat] Failed to sync entitlements to store:', err);
  }
}

/**
 * Fetches the current available offerings from RevenueCat configuration.
 */
export async function getRCOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current;
    }
    return null;
  } catch (err) {
    console.error('[RevenueCat] Failed to fetch offerings:', err);
    return null;
  }
}

/**
 * Purchases a RevenueCat package (Admin/Member subscriptions) and updates entitlements.
 */
export async function purchaseRCPackage(rcPackage: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(rcPackage);
    updateStoreEntitlements(customerInfo.entitlements.active);
    return true;
  } catch (err: any) {
    if (err.userCancelled) {
      console.log('[RevenueCat] Purchase cancelled by user.');
    } else {
      console.error('[RevenueCat] Purchase failed:', err);
    }
    return false;
  }
}

/**
 * Restores Google Play Store purchases and updates entitlements in the authStore.
 */
export async function restoreRCPurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    updateStoreEntitlements(customerInfo.entitlements.active);
    return true;
  } catch (err) {
    console.error('[RevenueCat] Restore purchases failed:', err);
    return false;
  }
}
