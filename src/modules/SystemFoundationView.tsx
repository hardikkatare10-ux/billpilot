import { useState } from "react";
import { AlertCircle, Building2, BriefcaseBusiness, FileText, Landmark, Plus, ShieldCheck, Sparkles, Users } from "lucide-react";

export type Role = {
  id: string;
  name: string;
  users: number;
  permissions: string[];
};

export type CompanyRecord = {
  id: string;
  name: string;
  type: "Head Office" | "Branch" | "Partner";
  region: string;
  active: boolean;
};

export type BranchRecord = {
  id: string;
  name: string;
  company: string;
  inventoryEnabled: boolean;
  manager: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  channel: "In-app" | "Email" | "Push";
  time: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  note: string;
};

export type UserDirectoryRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  branch: string;
  status: "Active" | "Inactive" | "Pending";
};

const INITIAL_ROLES: Role[] = [
  { id: "owner", name: "Business Owner", users: 1, permissions: ["All modules", "Financial access", "User management"] },
  { id: "admin", name: "Admin", users: 2, permissions: ["Configuration", "Approvals", "Reports"] },
  { id: "manager", name: "Manager", users: 4, permissions: ["Inventory", "Sales", "Customer updates"] },
  { id: "staff", name: "Staff", users: 8, permissions: ["POS", "Invoices", "Basic records"] },
];

const INITIAL_COMPANIES: CompanyRecord[] = [
  { id: "cp-1", name: "BillPilot HQ", type: "Head Office", region: "India", active: true },
  { id: "cp-2", name: "Retail West", type: "Branch", region: "Maharashtra", active: true },
  { id: "cp-3", name: "Distribution Hub", type: "Branch", region: "Gujarat", active: false },
];

const INITIAL_BRANCHES: BranchRecord[] = [
  { id: "br-1", name: "Main Store", company: "BillPilot HQ", inventoryEnabled: true, manager: "Anita Rao" },
  { id: "br-2", name: "Nashik Outlet", company: "Retail West", inventoryEnabled: true, manager: "Rahul Mehta" },
  { id: "br-3", name: "Warehouse", company: "Distribution Hub", inventoryEnabled: false, manager: "Karan Shah" },
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: "n-1", title: "Low stock alert", detail: "12 products are below reorder threshold.", channel: "In-app", time: "2 min ago" },
  { id: "n-2", title: "New approval request", detail: "Expense reimbursement is awaiting manager review.", channel: "Email", time: "28 min ago" },
  { id: "n-3", title: "Branch sync complete", detail: "Retail West inventory has been synchronized.", channel: "Push", time: "1 hr ago" },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  { id: "a-1", actor: "Owner", action: "Updated tax settings", target: "Accounting Setup", time: "Today, 09:30 AM", note: "GST defaults adjusted for the new fiscal period." },
  { id: "a-2", actor: "Manager", action: "Approved stock transfer", target: "Warehouse -> Main Store", time: "Today, 08:15 AM", note: "Transfer approved after inventory confirmation." },
  { id: "a-3", actor: "Staff", action: "Created invoice", target: "INV-2026-0042", time: "Yesterday, 06:40 PM", note: "Cash sale recorded and printed." },
];

const INITIAL_USERS: UserDirectoryRecord[] = [
  { id: "u-1", name: "Asha Nair", email: "asha@billpilot.io", role: "Business Owner", company: "BillPilot HQ", branch: "Main Store", status: "Active" },
  { id: "u-2", name: "Vikram Shah", email: "vikram@billpilot.io", role: "Admin", company: "Retail West", branch: "Nashik Outlet", status: "Active" },
  { id: "u-3", name: "Mehul Joshi", email: "mehul@billpilot.io", role: "Manager", company: "BillPilot HQ", branch: "Main Store", status: "Active" },
  { id: "u-4", name: "Priya Kulkarni", email: "priya@billpilot.io", role: "Staff", company: "Distribution Hub", branch: "Warehouse", status: "Pending" },
];

const DEFAULT_PERMISSION_OPTIONS = [
  "All modules",
  "Financial access",
  "User management",
  "Configuration",
  "Approvals",
  "Reports",
  "Inventory",
  "Sales",
  "Customer updates",
  "POS",
  "Invoices",
  "Basic records",
];

export function SystemFoundationView() {
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [companies, setCompanies] = useState<CompanyRecord[]>(INITIAL_COMPANIES);
  const [branches, setBranches] = useState<BranchRecord[]>(INITIAL_BRANCHES);
  const [users, setUsers] = useState<UserDirectoryRecord[]>(INITIAL_USERS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [newCompany, setNewCompany] = useState({ name: "", region: "", type: "Branch" as CompanyRecord["type"] });
  const [newBranch, setNewBranch] = useState({ name: "", company: INITIAL_COMPANIES[0]?.name ?? "", manager: "", inventoryEnabled: true });
  const [newRole, setNewRole] = useState({ name: "", permissions: ["POS"] });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: INITIAL_ROLES[0]?.name ?? "Business Owner", company: INITIAL_COMPANIES[0]?.name ?? "", branch: INITIAL_BRANCHES[0]?.name ?? "Main Store", status: "Active" as UserDirectoryRecord["status"] });

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "Active").length;
  const activeCompanies = companies.filter((company) => company.active).length;
  const activeBranches = branches.filter((branch) => branch.inventoryEnabled).length;

  const togglePermission = (roleId: string, permission: string) => {
    setRoles((current) => current.map((role) => {
      if (role.id !== roleId) return role;
      const hasPermission = role.permissions.includes(permission);
      return {
        ...role,
        permissions: hasPermission ? role.permissions.filter((item) => item !== permission) : [...role.permissions, permission],
      };
    }));
  };

  const addCompany = () => {
    if (!newCompany.name.trim()) return;
    const company: CompanyRecord = {
      id: `cp-${Date.now()}`,
      name: newCompany.name.trim(),
      type: newCompany.type,
      region: newCompany.region.trim() || "India",
      active: true,
    };
    setCompanies((current) => [company, ...current]);
    setNewBranch((branch) => ({ ...branch, company: company.name }));
    setNewCompany({ name: "", region: "", type: "Branch" });
    setAuditLogs((current) => [{
      id: `a-${Date.now()}`,
      actor: "System Admin",
      action: "Created company",
      target: company.name,
      time: "Just now",
      note: "New company profile added to the platform foundation.",
    }, ...current]);
  };

  const addBranch = () => {
    if (!newBranch.name.trim()) return;
    const branch: BranchRecord = {
      id: `br-${Date.now()}`,
      name: newBranch.name.trim(),
      company: newBranch.company,
      inventoryEnabled: newBranch.inventoryEnabled,
      manager: newBranch.manager.trim() || "Unassigned",
    };
    setBranches((current) => [branch, ...current]);
    setNewBranch({ name: "", company: companies[0]?.name ?? "", manager: "", inventoryEnabled: true });
    setAuditLogs((current) => [{
      id: `a-${Date.now()}`,
      actor: "System Admin",
      action: "Created branch",
      target: branch.name,
      time: "Just now",
      note: `Branch mapped to ${branch.company} with inventory ${branch.inventoryEnabled ? "enabled" : "disabled"}.`,
    }, ...current]);
  };

  const addRole = () => {
    if (!newRole.name.trim()) return;
    const role: Role = {
      id: `role-${Date.now()}`,
      name: newRole.name.trim(),
      users: 0,
      permissions: newRole.permissions,
    };
    setRoles((current) => [...current, role]);
    setNewRole({ name: "", permissions: ["POS"] });
  };

  const addNotification = () => {
    const next: NotificationItem = {
      id: `n-${Date.now()}`,
      title: "Platform reminder",
      detail: "Review the new module onboarding configuration.",
      channel: "In-app",
      time: "Just now",
    };
    setNotifications((current) => [next, ...current]);
  };

  const addUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    const user: UserDirectoryRecord = {
      id: `u-${Date.now()}`,
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      role: newUser.role,
      company: newUser.company,
      branch: newUser.branch,
      status: newUser.status,
    };

    setUsers((current) => [user, ...current]);
    setAuditLogs((current) => [{
      id: `a-${Date.now()}`,
      actor: "System Admin",
      action: "Added user",
      target: user.name,
      time: "Just now",
      note: `${user.role} assigned to ${user.company} / ${user.branch}.`,
    }, ...current]);
    setNewUser({
      name: "",
      email: "",
      role: roles[0]?.name ?? "Business Owner",
      company: companies[0]?.name ?? "",
      branch: branches[0]?.name ?? "Main Store",
      status: "Active",
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Users", value: `${activeUsers}/${totalUsers}`, icon: Users, tint: "text-blue-600 bg-blue-50" }, { label: "Companies", value: String(activeCompanies), icon: Building2, tint: "text-violet-600 bg-violet-50" }, { label: "Branches", value: String(activeBranches), icon: Landmark, tint: "text-emerald-600 bg-emerald-50" }, { label: "Alerts", value: String(notifications.length), icon: AlertCircle, tint: "text-amber-600 bg-amber-50" }].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className={`inline-flex rounded-lg p-2 ${stat.tint}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Roles & permissions</h3>
          </div>
          <div className="space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{role.name}</p>
                  <span className="text-xs rounded-full bg-muted px-2 py-1 text-muted-foreground">{role.users} users</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {DEFAULT_PERMISSION_OPTIONS.map((permission) => {
                    const checked = role.permissions.includes(permission);
                    return (
                      <button
                        key={`${role.id}-${permission}`}
                        type="button"
                        onClick={() => togglePermission(role.id, permission)}
                        className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition ${checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/30"}`}
                      >
                        {permission}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add role</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={newRole.name}
                onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
                placeholder="Role name"
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={newRole.permissions[0] ?? "POS"}
                onChange={(event) => setNewRole((current) => ({ ...current, permissions: [event.target.value] }))}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {DEFAULT_PERMISSION_OPTIONS.map((permission) => (
                  <option key={permission} value={permission}>{permission}</option>
                ))}
              </select>
              <button onClick={addRole} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Companies & branches</h3>
          </div>
          <div className="space-y-3">
            {companies.map((company) => (
              <div key={company.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{company.name}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${company.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {company.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{company.type} · {company.region}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-dashed border-border bg-background p-3 sm:grid-cols-2">
            <input
              value={newCompany.name}
              onChange={(event) => setNewCompany((current) => ({ ...current, name: event.target.value }))}
              placeholder="Company name"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={newCompany.region}
              onChange={(event) => setNewCompany((current) => ({ ...current, region: event.target.value }))}
              placeholder="Region"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={newCompany.type}
              onChange={(event) => setNewCompany((current) => ({ ...current, type: event.target.value as CompanyRecord["type"] }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 sm:col-span-2"
            >
              <option value="Head Office">Head Office</option>
              <option value="Branch">Branch</option>
              <option value="Partner">Partner</option>
            </select>
            <button onClick={addCompany} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:col-span-2">
              <Plus className="h-4 w-4" /> Add company
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add branch</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={newBranch.name}
                onChange={(event) => setNewBranch((current) => ({ ...current, name: event.target.value }))}
                placeholder="Branch name"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                value={newBranch.manager}
                onChange={(event) => setNewBranch((current) => ({ ...current, manager: event.target.value }))}
                placeholder="Manager"
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={newBranch.company}
                onChange={(event) => setNewBranch((current) => ({ ...current, company: event.target.value }))}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.name}>{company.name}</option>
                ))}
              </select>
              <label className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                Inventory enabled
                <input
                  type="checkbox"
                  checked={newBranch.inventoryEnabled}
                  onChange={(event) => setNewBranch((current) => ({ ...current, inventoryEnabled: event.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
              </label>
              <button onClick={addBranch} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:col-span-2">
                <Plus className="h-4 w-4" /> Add branch
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Users & access</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">{user.name}</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${user.status === "Active" ? "bg-emerald-100 text-emerald-700" : user.status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                  {user.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="rounded-full bg-muted px-2 py-1">{user.role}</span>
                <span className="rounded-full bg-muted px-2 py-1">{user.company}</span>
                <span className="rounded-full bg-muted px-2 py-1">{user.branch}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-dashed border-border bg-background p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add user</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <input
              value={newUser.name}
              onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))}
              placeholder="Full name"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={newUser.email}
              onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email address"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            <select
              value={newUser.role}
              onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
            <select
              value={newUser.company}
              onChange={(event) => {
                const company = event.target.value;
                setNewUser((current) => ({ ...current, company, branch: branches.find((branch) => branch.company === company)?.name ?? current.branch }));
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.name}>{company.name}</option>
              ))}
            </select>
            <select
              value={newUser.branch}
              onChange={(event) => setNewUser((current) => ({ ...current, branch: event.target.value }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              {branches.filter((branch) => branch.company === newUser.company || !newUser.company).map((branch) => (
                <option key={branch.id} value={branch.name}>{branch.name}</option>
              ))}
            </select>
            <select
              value={newUser.status}
              onChange={(event) => setNewUser((current) => ({ ...current, status: event.target.value as UserDirectoryRecord["status"] }))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 md:col-span-2 xl:col-span-1"
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
            <button onClick={addUser} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:col-span-2 xl:col-span-1">
              <Plus className="h-4 w-4" /> Add user
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{notification.title}</p>
                  <span className="text-[10px] uppercase tracking-wide text-primary">{notification.channel}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{notification.detail}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">{notification.time}</p>
              </div>
            ))}
          </div>
          <button onClick={addNotification} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted">
            <Plus className="h-4 w-4" /> Add alert
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Audit log</h3>
          </div>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{log.action}</p>
                  <span className="text-[10px] text-muted-foreground">{log.time}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">By {log.actor} on {log.target}</p>
                <p className="mt-2 text-sm text-muted-foreground">{log.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
