import {
  ArrowRight,
  BadgeDollarSign,
  Blocks,
  BookOpenText,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChartColumnBig,
  ClipboardCheck,
  Factory,
  FileText,
  FolderKanban,
  Globe,
  Headset,
  Landmark,
  Mail,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  NotebookText,
  Package,
  ReceiptText,
  Security,
  ShoppingCart,
  Sparkles,
  Store,
  Ticket,
  TrendingUp,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BILLPILOT_MODULE_CATEGORIES, BILLPILOT_MODULES, type ModuleDefinition } from "./moduleRegistry";

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingCart,
  TrendingUp,
  Users,
  Landmark,
  FileText,
  ReceiptText,
  Package,
  Factory,
  Truck,
  BriefcaseBusiness,
  BadgeDollarSign,
  CalendarDays,
  Megaphone,
  Mail,
  Ticket,
  Globe,
  Store,
  NotebookText,
  MessageSquareText,
  FolderKanban,
  Headset,
  CalendarClock,
  MessagesSquare,
  ClipboardCheck,
  BookOpenText,
  Sparkles,
  Blocks,
  ChartColumnBig,
  ShieldCheck,
};

function getModuleIcon(definition: ModuleDefinition) {
  return ICON_MAP[definition.iconKey] ?? Sparkles;
}

export function ModuleLauncherView({ onOpen }: { onOpen: (moduleId: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-blue-200/80">BillPilot</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">One need, one app.</h2>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-blue-100">
            Modular business platform foundation
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{BILLPILOT_MODULES.filter((m) => m.status === "enabled").length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Enabled later</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{BILLPILOT_MODULES.filter((m) => m.status === "disabled").length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Coming soon</p>
          <p className="mt-3 text-2xl font-bold text-foreground">{BILLPILOT_MODULES.filter((m) => m.status === "coming-soon").length}</p>
        </div>
      </div>

      {BILLPILOT_MODULE_CATEGORIES.map((category) => {
        const categoryModules = BILLPILOT_MODULES.filter((module) => module.category === category);

        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">{category}</h3>
              <span className="rounded-full border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {categoryModules.length} modules
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryModules.map((module) => {
                const Icon = getModuleIcon(module);
                const isOpenable = module.status === "enabled";

                return (
                  <div key={module.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          module.status === "enabled"
                            ? "bg-emerald-100 text-emerald-700"
                            : module.status === "disabled"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {module.status === "enabled" ? "Enabled" : module.status === "disabled" ? "Disabled" : "Coming soon"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h4 className="text-lg font-semibold text-foreground">{module.name}</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.description}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Setup</span>
                      <span>{module.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          module.status === "enabled" ? "bg-gradient-to-r from-emerald-500 to-primary" : "bg-gradient-to-r from-slate-300 to-slate-400"
                        }`}
                        style={{ width: `${module.progress}%` }}
                      />
                    </div>

                    {module.requires && (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        Depends on: {module.requires.join(", ")}
                      </p>
                    )}

                    <button
                      onClick={() => isOpenable && onOpen(module.id)}
                      disabled={!isOpenable}
                      className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isOpenable
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "cursor-not-allowed bg-muted text-muted-foreground"
                      }`}
                    >
                      {isOpenable ? "Open module" : "Coming soon"}
                      {isOpenable && <ArrowRight className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
