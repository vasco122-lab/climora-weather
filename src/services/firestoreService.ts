import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AdCampaign,
  AlertMetric,
  AppSettings,
  ChromaTheme,
  GeoLocation,
  LanguageCode,
  PlanTier,
  RevenueEvent,
  SavedLocationDoc,
  SubscriptionRecord,
  UnitSystem,
  UserAccount,
  UserPrivateInfo,
  WeatherAlertRule,
} from '../types/climora';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  adsEnabled: true,
  proMonthlyPrice: 4.99,
  proAnnualPrice: 44.99,
  defaultForecastDays: 7,
  announcement: 'Welcome to CLIMORA — Live worldwide rainbow forecasts and smart weather predictions.',
  maintenanceMode: false,
  updatedAt: null,
};

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export async function ensureUserDocuments(params: {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  preferredUnit?: UnitSystem;
  preferredLang?: LanguageCode;
}): Promise<void> {
  const userRef = doc(db, 'users', params.uid);
  const privateRef = doc(db, 'users', params.uid, 'private', 'info');

  try {
    const existing = await getDoc(userRef);
    const displayName = (params.fullName || params.email.split('@')[0] || 'Explorer').slice(0, 80);

    if (!existing.exists()) {
      const batch = writeBatch(db);
      batch.set(userRef, {
        uid: params.uid,
        displayName,
        plan: 'free',
        preferredUnit: params.preferredUnit ?? 'metric',
        preferredLang: params.preferredLang ?? 'en',
        chromaTheme: 'aurora',
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(privateRef, {
        uid: params.uid,
        fullName: displayName,
        email: params.email.slice(0, 160),
        phone: (params.phone || '').slice(0, 32),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      await updateDoc(userRef, {
        lastActiveAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const privSnap = await getDoc(privateRef);
      if (!privSnap.exists()) {
        await setDoc(privateRef, {
          uid: params.uid,
          fullName: displayName,
          email: params.email.slice(0, 160),
          phone: (params.phone || '').slice(0, 32),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function updateUserProfile(params: {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  preferredUnit: UnitSystem;
  preferredLang: LanguageCode;
  chromaTheme: ChromaTheme;
}): Promise<void> {
  const cleanName = params.displayName.trim().slice(0, 80) || 'Explorer';
  const cleanPhone = params.phone.trim().slice(0, 32);
  const cleanEmail = params.email.trim().slice(0, 160);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', params.uid), {
      displayName: cleanName,
      preferredUnit: params.preferredUnit,
      preferredLang: params.preferredLang,
      chromaTheme: params.chromaTheme,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(
      doc(db, 'users', params.uid, 'private', 'info'),
      {
        uid: params.uid,
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.uid}`);
  }
}

export async function updateUserPreferences(
  uid: string,
  updates: Partial<Pick<UserAccount, 'preferredUnit' | 'preferredLang' | 'chromaTheme'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export function subscribeUserAccount(
  uid: string,
  onData: (account: UserAccount | null, privateInfo: UserPrivateInfo | null) => void
): () => void {
  let latestAccount: UserAccount | null = null;
  let latestPrivate: UserPrivateInfo | null = null;

  const unsub1 = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      latestAccount = snap.exists() ? (snap.data() as UserAccount) : null;
      onData(latestAccount, latestPrivate);
    },
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}`)
  );

  const unsub2 = onSnapshot(
    doc(db, 'users', uid, 'private', 'info'),
    (snap) => {
      latestPrivate = snap.exists() ? (snap.data() as UserPrivateInfo) : null;
      onData(latestAccount, latestPrivate);
    },
    (error) => handleFirestoreError(error, OperationType.GET, `users/${uid}/private/info`)
  );

  return () => {
    unsub1();
    unsub2();
  };
}

export function subscribeSavedLocations(
  uid: string,
  onData: (locations: SavedLocationDoc[]) => void
): () => void {
  const q = query(collection(db, 'users', uid, 'locations'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedLocationDoc, 'id'>) })));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/locations`)
  );
}

export async function saveLocationForUser(uid: string, loc: GeoLocation): Promise<void> {
  const locId = sanitizeId(`loc_${loc.id || `${loc.name}_${Math.round(loc.latitude * 100)}`}`);
  try {
    await setDoc(doc(db, 'users', uid, 'locations', locId), {
      uid,
      name: loc.name.slice(0, 100),
      country: (loc.country || 'Global').slice(0, 80),
      admin1: (loc.admin1 || '').slice(0, 100),
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      timezone: (loc.timezone || 'auto').slice(0, 60),
      isPrimary: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${uid}/locations/${locId}`);
  }
}

export async function removeSavedLocation(uid: string, locationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'locations', locationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/locations/${locationId}`);
  }
}

export function subscribeAlertRules(
  uid: string,
  onData: (rules: WeatherAlertRule[]) => void
): () => void {
  const q = query(collection(db, 'users', uid, 'alerts'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WeatherAlertRule, 'id'>) })));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `users/${uid}/alerts`)
  );
}

export async function createAlertRule(params: {
  uid: string;
  locationName: string;
  latitude: number;
  longitude: number;
  metric: AlertMetric;
  threshold: number;
}): Promise<void> {
  const alertId = sanitizeId(`alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    await setDoc(doc(db, 'users', params.uid, 'alerts', alertId), {
      uid: params.uid,
      locationName: params.locationName.slice(0, 100),
      latitude: Number(params.latitude),
      longitude: Number(params.longitude),
      metric: params.metric,
      threshold: Number(params.threshold),
      enabled: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${params.uid}/alerts/${alertId}`);
  }
}

export async function toggleAlertRule(uid: string, alertId: string, enabled: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'alerts', alertId), {
      enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/alerts/${alertId}`);
  }
}

export async function deleteAlertRule(uid: string, alertId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'alerts', alertId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}/alerts/${alertId}`);
  }
}

export async function purchasePlanOrAddon(params: {
  uid: string;
  planId: 'pro_monthly' | 'pro_annual' | 'storm_radar_pack' | 'ad_free_pass';
  amountUsd: number;
  billingCycle: 'monthly' | 'annual' | 'one_time';
}): Promise<void> {
  const subId = sanitizeId(`sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const revId = sanitizeId(`rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'subscriptions', subId), {
      userId: params.uid,
      planId: params.planId,
      amountUsd: Number(params.amountUsd),
      billingCycle: params.billingCycle,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (params.planId === 'pro_monthly' || params.planId === 'pro_annual') {
      batch.update(doc(db, 'users', params.uid), {
        plan: params.planId as PlanTier,
        updatedAt: serverTimestamp(),
      });
    }

    const isSubscription = params.planId === 'pro_monthly' || params.planId === 'pro_annual';
    batch.set(doc(db, 'revenue_events', revId), {
      source: isSubscription ? 'subscription' : 'paid_addon',
      label: `${params.planId} purchase`,
      amountUsd: Number(params.amountUsd),
      userId: params.uid,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscriptions/${subId}`);
  }
}

export function subscribeUserSubscriptions(
  uid: string,
  onData: (subs: SubscriptionRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubscriptionRecord, 'id'>) })));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'subscriptions')
  );
}

export async function cancelSubscription(uid: string, subscriptionId: string, wasProPlan: boolean): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'subscriptions', subscriptionId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    if (wasProPlan) {
      batch.update(doc(db, 'users', uid), {
        plan: 'free',
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptions/${subscriptionId}`);
  }
}

export function subscribeAppSettings(onData: (settings: AppSettings) => void): () => void {
  return onSnapshot(
    doc(db, 'app_config', 'settings'),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as AppSettings);
      } else {
        onData(DEFAULT_APP_SETTINGS);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'app_config/settings')
  );
}

export function subscribeActiveAdCampaigns(onData: (campaigns: AdCampaign[]) => void): () => void {
  const q = query(collection(db, 'ad_campaigns'), where('active', '==', true), limit(5));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdCampaign, 'id'>) })));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'ad_campaigns')
  );
}

export async function recordAdImpression(campaign: AdCampaign): Promise<void> {
  if (!auth.currentUser) return;
  const revId = sanitizeId(`imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'ad_campaigns', campaign.id), {
      impressions: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'revenue_events', revId), {
      source: 'ad_impression',
      label: `Impression: ${campaign.sponsorName}`.slice(0, 120),
      amountUsd: Number((campaign.cpmUsd / 1000).toFixed(4)),
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ad_campaigns/${campaign.id}`);
  }
}

export async function recordAdClick(campaign: AdCampaign): Promise<void> {
  if (!auth.currentUser) return;
  const revId = sanitizeId(`clk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'ad_campaigns', campaign.id), {
      clicks: increment(1),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'revenue_events', revId), {
      source: 'ad_click',
      label: `Click: ${campaign.sponsorName}`.slice(0, 120),
      amountUsd: Number(campaign.cpcUsd.toFixed(2)),
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ad_campaigns/${campaign.id}`);
  }
}

// Admin operations
export async function fetchAdminDashboardData(): Promise<{
  users: UserAccount[];
  subscriptions: SubscriptionRecord[];
  campaigns: AdCampaign[];
  revenueEvents: RevenueEvent[];
}> {
  try {
    const [usersSnap, subsSnap, campSnap, revSnap] = await Promise.all([
      getDocs(query(collection(db, 'users'), orderBy('lastActiveAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, 'ad_campaigns'), orderBy('createdAt', 'desc'), limit(50))),
      getDocs(query(collection(db, 'revenue_events'), orderBy('createdAt', 'desc'), limit(200))),
    ]);
    return {
      users: usersSnap.docs.map((d) => d.data() as UserAccount),
      subscriptions: subsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SubscriptionRecord, 'id'>),
      })),
      campaigns: campSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AdCampaign, 'id'>),
      })),
      revenueEvents: revSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RevenueEvent, 'id'>),
      })),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_dashboard');
  }
}

export async function saveAdminAppSettings(settings: Omit<AppSettings, 'updatedAt'>): Promise<void> {
  try {
    await setDoc(doc(db, 'app_config', 'settings'), {
      adsEnabled: Boolean(settings.adsEnabled),
      proMonthlyPrice: Number(settings.proMonthlyPrice),
      proAnnualPrice: Number(settings.proAnnualPrice),
      defaultForecastDays: Number(settings.defaultForecastDays),
      announcement: settings.announcement.slice(0, 240),
      maintenanceMode: Boolean(settings.maintenanceMode),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'app_config/settings');
  }
}

export async function createAdminCampaign(params: {
  sponsorName: string;
  headline: string;
  description: string;
  ctaLabel: string;
  targetUrl: string;
  cpmUsd: number;
  cpcUsd: number;
}): Promise<void> {
  const id = sanitizeId(`camp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'ad_campaigns', id), {
      sponsorName: params.sponsorName.slice(0, 80),
      headline: params.headline.slice(0, 120),
      description: params.description.slice(0, 240),
      ctaLabel: params.ctaLabel.slice(0, 40),
      targetUrl: params.targetUrl.slice(0, 240),
      cpmUsd: Number(params.cpmUsd),
      cpcUsd: Number(params.cpcUsd),
      impressions: 0,
      clicks: 0,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `ad_campaigns/${id}`);
  }
}

export async function toggleCampaignActive(campaignId: string, active: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'ad_campaigns', campaignId), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `ad_campaigns/${campaignId}`);
  }
}

export async function recordSponsorshipDeal(params: {
  sponsorName: string;
  amountUsd: number;
  uid: string;
}): Promise<void> {
  const id = sanitizeId(`spon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  try {
    await setDoc(doc(db, 'revenue_events', id), {
      source: 'sponsorship',
      label: `Sponsorship: ${params.sponsorName}`.slice(0, 120),
      amountUsd: Number(params.amountUsd),
      userId: params.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `revenue_events/${id}`);
  }
}
