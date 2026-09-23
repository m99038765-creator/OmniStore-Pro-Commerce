import { UserProfile } from '../types';

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'usr_pro_8829',
  firstName: 'Alex',
  lastName: 'Vance',
  displayName: 'Alex Vance',
  email: 'm99038765@gmail.com',
  phone: '+1 (415) 890-2134',
  company: 'AcousticLab Audio & Hardware',
  role: 'Principal Acoustic Architect',
  avatarColor: 'emerald',
  timezone: 'America/Los_Angeles (PST/PDT)',
  currency: 'USD',
  memberSince: 'March 2024',
  membershipTier: 'OmniStore Pro',
  twoFactorEnabled: true,
  savedAddresses: [
    {
      id: 'addr_sf_hq',
      label: 'San Francisco Design Lab (HQ)',
      fullName: 'Alex Vance',
      company: 'AcousticLab Technologies',
      addressLine1: '450 Mission Street',
      addressLine2: 'Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      phone: '+1 (415) 890-2134',
      isDefaultShipping: true,
      isDefaultBilling: true
    },
    {
      id: 'addr_ny_studio',
      label: 'East Coast Recording & Mixing Suite',
      fullName: 'Alex Vance',
      company: 'Vance Audio Visual LLC',
      addressLine1: '75 Varick Street',
      addressLine2: '8th Floor, Soundstage 3',
      city: 'New York',
      state: 'NY',
      postalCode: '10013',
      country: 'United States',
      phone: '+1 (212) 555-0198',
      isDefaultShipping: false,
      isDefaultBilling: false
    }
  ],
  communicationPreferences: {
    orderConfirmationsEmail: true,
    orderConfirmationsSms: true,
    shippingUpdatesEmail: true,
    shippingUpdatesSms: true,
    deliveryOutAlertsSms: true,
    inventoryAlertsEmail: true,
    priceDropAlertsEmail: true,
    backInStockSms: true,
    firmwareUpdatesEmail: true,
    hardwareDigestNewsletter: false,
    developerApiUpdates: true,
    exclusiveDropsEmail: true,
    vipEarlyAccessSms: false,
    frequency: 'realtime'
  }
};
