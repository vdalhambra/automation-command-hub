export interface Client {
  id: string;
  name: string;
  industry: string;
  description: string;
  connectedApis: number;
  automations: number;
  createdAt: string;
}

export interface ApiConnection {
  id: string;
  service: string;
  status: "connected" | "disconnected";
  lastSync: string;
  icon: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  client: string;
  status: "active" | "inactive";
  lastRun: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  event: string;
  client: string;
  status: "success" | "error" | "pending";
  type: "automation" | "api" | "system";
}

export const clients: Client[] = [
  { id: "1", name: "Acme Corp", industry: "SaaS", description: "Enterprise automation suite", connectedApis: 4, automations: 12, createdAt: "2026-01-15" },
  { id: "2", name: "Nova Digital", industry: "Marketing", description: "Digital marketing agency", connectedApis: 3, automations: 8, createdAt: "2026-02-01" },
  { id: "3", name: "Pulse Health", industry: "Healthcare", description: "Patient engagement platform", connectedApis: 2, automations: 5, createdAt: "2026-02-20" },
  { id: "4", name: "Vertex AI Labs", industry: "AI/ML", description: "AI research consultancy", connectedApis: 5, automations: 15, createdAt: "2026-03-01" },
];

export const apiConnections: ApiConnection[] = [
  { id: "1", service: "Google Calendar", status: "connected", lastSync: "2 min ago", icon: "📅" },
  { id: "2", service: "Meta Ads", status: "connected", lastSync: "5 min ago", icon: "📢" },
  { id: "3", service: "Retell AI", status: "disconnected", lastSync: "2 days ago", icon: "🤖" },
  { id: "4", service: "Slack Webhook", status: "connected", lastSync: "1 min ago", icon: "💬" },
  { id: "5", service: "Custom API", status: "connected", lastSync: "10 min ago", icon: "🔗" },
];

export const automations: Automation[] = [
  { id: "1", name: "Lead Follow-up", description: "Auto-send follow-up emails after form submission", triggerType: "Webhook", client: "Acme Corp", status: "active", lastRun: "3 min ago" },
  { id: "2", name: "Calendar Sync", description: "Sync meetings between Google Calendar and CRM", triggerType: "Schedule", client: "Nova Digital", status: "active", lastRun: "15 min ago" },
  { id: "3", name: "Ad Report Generator", description: "Generate weekly Meta Ads performance reports", triggerType: "Schedule", client: "Nova Digital", status: "inactive", lastRun: "2 days ago" },
  { id: "4", name: "Patient Reminder", description: "Send appointment reminders via SMS", triggerType: "Schedule", client: "Pulse Health", status: "active", lastRun: "1 hour ago" },
  { id: "5", name: "Data Pipeline", description: "ETL pipeline for analytics dashboard", triggerType: "Event", client: "Vertex AI Labs", status: "active", lastRun: "5 min ago" },
];

export const activityLogs: ActivityLog[] = [
  { id: "1", timestamp: "2026-03-05 14:32:00", event: "Lead Follow-up automation completed", client: "Acme Corp", status: "success", type: "automation" },
  { id: "2", timestamp: "2026-03-05 14:28:00", event: "Google Calendar API synced", client: "Nova Digital", status: "success", type: "api" },
  { id: "3", timestamp: "2026-03-05 14:15:00", event: "Patient Reminder sent (24 recipients)", client: "Pulse Health", status: "success", type: "automation" },
  { id: "4", timestamp: "2026-03-05 14:10:00", event: "Meta Ads connection refreshed", client: "Nova Digital", status: "success", type: "api" },
  { id: "5", timestamp: "2026-03-05 14:05:00", event: "Data Pipeline execution failed", client: "Vertex AI Labs", status: "error", type: "automation" },
  { id: "6", timestamp: "2026-03-05 13:58:00", event: "New client onboarded", client: "Vertex AI Labs", status: "success", type: "system" },
  { id: "7", timestamp: "2026-03-05 13:45:00", event: "Webhook endpoint health check", client: "Acme Corp", status: "pending", type: "system" },
  { id: "8", timestamp: "2026-03-05 13:30:00", event: "Ad Report Generator skipped (inactive)", client: "Nova Digital", status: "pending", type: "automation" },
];
