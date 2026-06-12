/**
 * Dodo product → credits mapping. Hardcoded ground truth.
 */

export type DodoProductType = 'pack' | 'subscription';

export interface DodoProductDetail {
  name: string;
  credits: number;
  price: number;
  type: DodoProductType;
}

export const DODO_CREDIT_MAP: Record<string, number> = {
  // Credit packs — one-time
  'pdt_0NdcF1gd6Z5PBeFx8gbiE': 30,
  'pdt_0NdcF1o3DQYEdtVQBA8MG': 100,
  'pdt_0NdcF1rKPidZVQ4vdzt5u': 300,
  'pdt_0NdcF1ua83g4FRUO1LhKt': 800,
  // Subscriptions — monthly allocation
  'pdt_0NbKNHJ5nK556qajM5MKa': 40,
  'pdt_0Nbybrhl2M0GdzScdoAwb': 150,
  'pdt_0NgrUZL3QLR2Xmw2PQgRR': 300, // MEGA ₹899
  'pdt_0NgrZWBT2Irz439pIp6Xn': 500, // POWER+ ₹1299
};

export const DODO_PACK_DETAILS: Record<string, DodoProductDetail> = {
  'pdt_0NdcF1gd6Z5PBeFx8gbiE': { name: 'Starter',  credits: 30,  price: 59,  type: 'pack' },
  'pdt_0NdcF1o3DQYEdtVQBA8MG': { name: 'Standard', credits: 100, price: 149, type: 'pack' },
  'pdt_0NdcF1rKPidZVQ4vdzt5u': { name: 'Power',    credits: 300, price: 399, type: 'pack' },
  'pdt_0NdcF1ua83g4FRUO1LhKt': { name: 'MAX',      credits: 800, price: 899, type: 'pack' },
  'pdt_0NbKNHJ5nK556qajM5MKa': { name: 'Ultimate', credits: 40,  price: 199, type: 'subscription' },
  'pdt_0Nbybrhl2M0GdzScdoAwb': { name: 'PRO+',     credits: 150, price: 499, type: 'subscription' },
  'pdt_0NgrUZL3QLR2Xmw2PQgRR': { name: 'MEGA',     credits: 300, price: 899, type: 'subscription' },
  'pdt_0NgrZWBT2Irz439pIp6Xn': { name: 'POWER+',   credits: 500, price: 1299, type: 'subscription' },
};

export const RETURN_URL = 'https://luminaai.co.in';
