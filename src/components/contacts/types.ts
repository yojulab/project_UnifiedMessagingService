export interface ContactListItem {
  id: string;
  name: string;
  primaryPhone: string;
  primaryEmail: string;
  phoneCount: number;
  emailCount: number;
  company: string;
  sourceName: string;
  labels: string[];
  unsubscribe: 'ALL' | 'PARTIAL' | 'NONE';
}

export interface ContactDetail extends Omit<ContactListItem, 'phoneCount' | 'emailCount'> {
  department: string;
  notes: string;
  customFields: Record<string, unknown>;
  isUnsubscribed: boolean;
  unsubscribedAt: string | null;
  phones: { value: string; display: string; smsBlocked: boolean; reason: string | null }[];
  emails: { value: string; display: string; emailBlocked: boolean; reason: string | null }[];
  createdAt: string | null;
}

export interface ContactLog {
  id: string;
  campaignId: string;
  campaignName: string;
  channel: string;
  recipient: string;
  subject: string;
  bodyPreview: string;
  resultCode: string;
  errorMessage: string;
  sentAt: string;
}
