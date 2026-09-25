// Where each tool goes on the CompetLab API. `{name}` segments are filled from the tool's own
// arguments; every other argument is the query string on a GET and the JSON body otherwise.
// A tool in tools.ts with no route here fails `npm run sync`.

export type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface Route {
  method: Method;
  path: string;
}

export const routes: Record<string, Route> = {
  // Projects and competitors
  list_projects: { method: "GET", path: "/v1/projects" },
  get_project: { method: "GET", path: "/v1/projects/{projectId}" },
  list_competitors: { method: "GET", path: "/v1/projects/{projectId}/competitors" },
  get_competitor: { method: "GET", path: "/v1/projects/{projectId}/competitors/{competitorId}" },

  // Tech & Trust
  get_tech_trust_dashboard: { method: "GET", path: "/v1/projects/{projectId}/tech-trust" },
  get_tech_trust_history: { method: "GET", path: "/v1/projects/{projectId}/tech-trust/history" },
  get_tech_trust_run_detail: { method: "GET", path: "/v1/projects/{projectId}/tech-trust/history/{runId}" },

  // Content
  get_content_dashboard: { method: "GET", path: "/v1/projects/{projectId}/content" },
  get_content_history: { method: "GET", path: "/v1/projects/{projectId}/content/history" },
  get_content_run_detail: { method: "GET", path: "/v1/projects/{projectId}/content/history/{runId}" },
  get_content_changelog: { method: "GET", path: "/v1/projects/{projectId}/content/changelog" },

  // Positioning
  get_positioning_dashboard: { method: "GET", path: "/v1/projects/{projectId}/positioning" },
  get_positioning_history: { method: "GET", path: "/v1/projects/{projectId}/positioning/history" },
  get_positioning_run_detail: { method: "GET", path: "/v1/projects/{projectId}/positioning/history/{runId}" },

  // Pricing
  get_pricing_dashboard: { method: "GET", path: "/v1/projects/{projectId}/pricing" },
  get_pricing_history: { method: "GET", path: "/v1/projects/{projectId}/pricing/history" },
  get_pricing_run_detail: { method: "GET", path: "/v1/projects/{projectId}/pricing/history/{runId}" },

  // AI Visibility
  get_ai_visibility_dashboard: { method: "GET", path: "/v1/projects/{projectId}/ai-visibility" },
  get_ai_visibility_history: { method: "GET", path: "/v1/projects/{projectId}/ai-visibility/history" },
  get_ai_visibility_check_detail: { method: "GET", path: "/v1/projects/{projectId}/ai-visibility/history/{checkId}" },
  get_ai_visibility_trend: { method: "GET", path: "/v1/projects/{projectId}/ai-visibility/trend" },

  // AI Sources
  get_ai_sources_dashboard: { method: "GET", path: "/v1/projects/{projectId}/ai-sources" },
  get_ai_sources_history: { method: "GET", path: "/v1/projects/{projectId}/ai-sources/history" },
  get_ai_sources_check_detail: { method: "GET", path: "/v1/projects/{projectId}/ai-sources/history/{checkId}" },

  // Alerts and schedules
  list_alerts: { method: "GET", path: "/v1/projects/{projectId}/alerts" },
  list_schedules: { method: "GET", path: "/v1/projects/{projectId}/schedules" },

  // Strategic Briefing
  get_briefing: { method: "GET", path: "/v1/projects/{projectId}/strategic-briefing" },
  get_briefing_history: { method: "GET", path: "/v1/projects/{projectId}/strategic-briefing/history" },
  get_briefing_edition: { method: "GET", path: "/v1/projects/{projectId}/strategic-briefing/history/{runId}" },

  // Free tools — no project needed
  check_sitemap: { method: "POST", path: "/v1/tools/sitemap-visualizer" },
  check_ai_crawlers: { method: "POST", path: "/v1/tools/ai-crawler-checker" },
  fetch_url: { method: "POST", path: "/v1/tools/fetch-url" },
  start_tech_stack_scan: { method: "POST", path: "/v1/tools/tech-stack/scans" },
  get_tech_stack_scan: { method: "GET", path: "/v1/tools/tech-stack/scans/{scanId}" },
  start_trust_signals_scan: { method: "POST", path: "/v1/tools/trust-signals/scans" },
  get_trust_signals_scan: { method: "GET", path: "/v1/tools/trust-signals/scans/{scanId}" },
  start_agent_adoption_scan: { method: "POST", path: "/v1/tools/agent-adoption/scans" },
  get_agent_adoption_scan: { method: "GET", path: "/v1/tools/agent-adoption/scans/{scanId}" },

  // Strategic Tickets. A ticketId may be a ticket's number ("#14"); index.ts resolves it first.
  list_tickets: { method: "GET", path: "/v1/projects/{projectId}/tickets" },
  get_ticket: { method: "GET", path: "/v1/projects/{projectId}/tickets/{ticketId}" },
  create_ticket: { method: "POST", path: "/v1/projects/{projectId}/tickets" },
  update_ticket: { method: "PATCH", path: "/v1/projects/{projectId}/tickets/{ticketId}" },
  move_ticket: { method: "PATCH", path: "/v1/projects/{projectId}/tickets/{ticketId}/move" },
  delete_ticket: { method: "DELETE", path: "/v1/projects/{projectId}/tickets/{ticketId}" },
  list_ticket_comments: { method: "GET", path: "/v1/projects/{projectId}/tickets/{ticketId}/comments" },
  add_ticket_comment: { method: "POST", path: "/v1/projects/{projectId}/tickets/{ticketId}/comments" },
  list_ticket_assignees: { method: "GET", path: "/v1/projects/{projectId}/tickets/assignees" },
  list_ticket_labels: { method: "GET", path: "/v1/projects/{projectId}/tickets/labels" },
};
