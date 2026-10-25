export type ModuleStatus = "enabled" | "disabled" | "coming-soon";

export type ModuleDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  iconKey: string;
  enabled: boolean;
  progress: number;
  status: ModuleStatus;
  requires?: string[];
};

export const BILLPILOT_MODULE_CATEGORIES = [
  "Website",
  "Sales",
  "Finance",
  "Inventory & Manufacturing",
  "Human Resources",
  "Marketing",
  "Services",
  "Productivity",
  "Customization",
] as const;

export const BILLPILOT_MODULES: ModuleDefinition[] = [
  { id: "pos", name: "POS", description: "Fast checkout, barcode sales, cash flow and receipt workflows.", category: "Sales", iconKey: "ShoppingCart", enabled: true, progress: 92, status: "enabled" },
  { id: "sales", name: "Sales", description: "Quotations, orders, customers, pricing and sales tracking.", category: "Sales", iconKey: "TrendingUp", enabled: false, progress: 28, status: "disabled" },
  { id: "crm", name: "CRM", description: "Leads, pipeline, follow-ups, and customer lifecycle insights.", category: "Sales", iconKey: "Users", enabled: false, progress: 18, status: "coming-soon" },

  { id: "accounting", name: "Accounting", description: "Ledger, journals, financial reports and tax foundation.", category: "Finance", iconKey: "Landmark", enabled: false, progress: 14, status: "coming-soon" },
  { id: "invoicing", name: "Invoicing", description: "Invoices, drafts, payments, PDFs and GST-ready billing.", category: "Finance", iconKey: "FileText", enabled: true, progress: 88, status: "enabled" },
  { id: "expenses", name: "Expenses", description: "Receipts, categories, approvers and reimbursement workflows.", category: "Finance", iconKey: "ReceiptText", enabled: false, progress: 12, status: "coming-soon" },

  { id: "inventory", name: "Inventory", description: "Products, stock levels, movements, transfers and low-stock rules.", category: "Inventory & Manufacturing", iconKey: "Package", enabled: true, progress: 84, status: "enabled" },
  { id: "manufacturing", name: "Manufacturing", description: "BOMs, work orders and production coordination.", category: "Inventory & Manufacturing", iconKey: "Factory", enabled: false, progress: 10, status: "coming-soon" },
  { id: "purchase", name: "Purchase", description: "Vendors, purchase orders and supplier commitments.", category: "Inventory & Manufacturing", iconKey: "Truck", enabled: false, progress: 10, status: "coming-soon" },

  { id: "employees", name: "Employees", description: "Profiles, departments, documents and org hierarchy.", category: "Human Resources", iconKey: "BriefcaseBusiness", enabled: false, progress: 9, status: "coming-soon" },
  { id: "payroll", name: "Payroll", description: "Salary structures, payslips, payroll periods and reports.", category: "Human Resources", iconKey: "BadgeDollarSign", enabled: false, progress: 8, status: "coming-soon" },
  { id: "timeoff", name: "Time Off", description: "Leave requests, approvals, balances and holiday planning.", category: "Human Resources", iconKey: "CalendarDays", enabled: false, progress: 7, status: "coming-soon" },

  { id: "marketing", name: "Marketing Automation", description: "Campaigns, email flows and segmented customer actions.", category: "Marketing", iconKey: "Megaphone", enabled: false, progress: 6, status: "coming-soon" },
  { id: "emailmarketing", name: "Email Marketing", description: "Email campaigns, templates, contacts and campaign analytics.", category: "Marketing", iconKey: "Mail", enabled: false, progress: 6, status: "coming-soon" },
  { id: "events", name: "Events", description: "Event registrations, tickets, attendees and event portals.", category: "Marketing", iconKey: "Ticket", enabled: false, progress: 6, status: "coming-soon" },

  { id: "website", name: "Website", description: "Pages, navigation, themes, sections, and publishing architecture.", category: "Website", iconKey: "Globe", enabled: false, progress: 5, status: "coming-soon" },
  { id: "ecommerce", name: "eCommerce", description: "Catalog, cart, checkout, payments, shipping and product pages.", category: "Website", iconKey: "Store", enabled: false, progress: 5, status: "coming-soon" },
  { id: "blog", name: "Blog", description: "Posts, categories, authors and SEO-ready publishing.", category: "Website", iconKey: "NotebookText", enabled: false, progress: 5, status: "coming-soon" },
  { id: "livechat", name: "Live Chat", description: "Visitor support, agent workflows and conversation history.", category: "Website", iconKey: "MessageSquareText", enabled: false, progress: 5, status: "coming-soon" },

  { id: "project", name: "Project", description: "Projects, tasks, milestones, team planning and budgets.", category: "Services", iconKey: "FolderKanban", enabled: false, progress: 7, status: "coming-soon" },
  { id: "helpdesk", name: "Helpdesk", description: "Support tickets, SLAs, priorities and responsive teams.", category: "Services", iconKey: "Headset", enabled: false, progress: 7, status: "coming-soon" },
  { id: "appointments", name: "Appointments", description: "Bookings, calendars, customer schedules and reminders.", category: "Services", iconKey: "CalendarClock", enabled: false, progress: 6, status: "coming-soon" },

  { id: "discuss", name: "Discuss", description: "Internal messaging, channels, mentions and team communications.", category: "Productivity", iconKey: "MessagesSquare", enabled: false, progress: 5, status: "coming-soon" },
  { id: "approvals", name: "Approvals", description: "Approval flows, review history and business sign-offs.", category: "Productivity", iconKey: "ClipboardCheck", enabled: false, progress: 5, status: "coming-soon" },
  { id: "knowledge", name: "Knowledge", description: "Wiki, article search, categories and internal documentation.", category: "Productivity", iconKey: "BookOpenText", enabled: false, progress: 5, status: "coming-soon" },
  { id: "ai", name: "AI Assistant", description: "Business insights, summaries, reporting guidance and automation support.", category: "Productivity", iconKey: "Sparkles", enabled: false, progress: 4, status: "coming-soon" },

  { id: "studio", name: "Studio", description: "Custom fields, forms, dashboards and low-code workflow basics.", category: "Customization", iconKey: "Blocks", enabled: false, progress: 6, status: "coming-soon" },
  { id: "core-platform", name: "Core Platform", description: "Users, roles, permissions, companies, branches, notifications and audit trails.", category: "Customization", iconKey: "ShieldCheck", enabled: true, progress: 76, status: "enabled", requires: ["Users", "Companies"] },
  { id: "reports", name: "Reports", description: "Reusable reporting engine for sales, inventory and performance metrics.", category: "Customization", iconKey: "ChartColumnBig", enabled: false, progress: 13, status: "disabled" },
];

export function getModuleDependencyState(moduleId: string, modules: ModuleDefinition[] = BILLPILOT_MODULES) {
  const module = modules.find((entry) => entry.id === moduleId);
  if (!module) {
    return { ready: false, missing: ["Module not found"], status: "disabled" as ModuleStatus };
  }

  const required = module.requires ?? [];
  const missing = required.filter((dep) => !modules.some((entry) => entry.name === dep && entry.enabled));

  return {
    ready: missing.length === 0,
    missing,
    status: missing.length > 0 ? "disabled" : module.enabled ? "enabled" : module.status,
  };
}
