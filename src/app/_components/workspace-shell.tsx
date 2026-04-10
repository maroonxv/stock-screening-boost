"use client";

import Link from "next/link";
import React, { type ComponentType, type ReactNode, useState } from "react";

import {
  CloseIcon,
  CompanyResearchIcon,
  HistoryIcon,
  MenuIcon,
  OverviewIcon,
  ResearchSpacesIcon,
  ScreeningIcon,
  TimingIcon,
  WorkflowsIcon,
} from "~/app/_components/sidebar-icons";
import type { WorkflowStageTab } from "~/app/_components/workflow-stage-config";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type WorkspaceSection =
  | "home"
  | "screening"
  | "workflows"
  | "timing"
  | "companyResearch"
  | "spaces";

type WorkspaceSectionView = "default" | "history";

type SidebarIcon = ComponentType<React.SVGProps<SVGSVGElement>>;

const sidebarNavItems: Array<{
  key: WorkspaceSection;
  href: string;
  label: string;
  icon: SidebarIcon;
  historyHref?: string;
  historyLabel?: string;
}> = [
  {
    key: "home",
    href: "/",
    label: "概览",
    icon: OverviewIcon,
  },
  {
    key: "screening",
    href: "/screening",
    label: "筛选",
    icon: ScreeningIcon,
    historyHref: "/screening/history",
    historyLabel: "筛选历史",
  },
  {
    key: "workflows",
    href: "/workflows",
    label: "行业研究",
    icon: WorkflowsIcon,
    historyHref: "/workflows/history",
    historyLabel: "行业研究历史",
  },
  {
    key: "companyResearch",
    href: "/company-research",
    label: "公司判断",
    icon: CompanyResearchIcon,
    historyHref: "/company-research/history",
    historyLabel: "公司判断历史",
  },
  {
    key: "timing",
    href: "/timing",
    label: "择时组合",
    icon: TimingIcon,
    historyHref: "/timing/history",
    historyLabel: "择时组合历史",
  },
  {
    key: "spaces",
    href: "/spaces",
    label: "Research Spaces",
    icon: ResearchSpacesIcon,
  },
];

function AppMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-panel-strong)] font-[family-name:var(--font-heading)] text-[11px] tracking-[0.12em] text-[var(--app-text-strong)]">
      SSB
    </div>
  );
}

function SidebarBrand(props: { onNavigate?: () => void }) {
  const { onNavigate } = props;

  return (
    <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
      <AppMark />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--app-text-strong)]">
          Stock Screening Boost
        </div>
        <div className="text-xs text-[var(--app-text-subtle)]">
          投资决策工作台
        </div>
      </div>
    </Link>
  );
}

function SidebarLink(props: {
  href: string;
  label: string;
  icon: SidebarIcon;
  iconKey: string;
  active?: boolean;
  onNavigate?: () => void;
}) {
  const {
    href,
    label,
    icon: Icon,
    iconKey,
    active = false,
    onNavigate,
  } = props;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-[var(--app-border-strong)] bg-[var(--app-panel-strong)] text-[var(--app-text-strong)]"
          : "border-transparent text-[var(--app-text-muted)] hover:bg-[var(--app-bg-raised)] hover:text-[var(--app-text-strong)]",
      )}
    >
      <span
        data-sidebar-icon={iconKey}
        className="flex h-[18px] w-[18px] items-center justify-center text-current"
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SidebarRail(props: {
  section: WorkspaceSection;
  sectionView: WorkspaceSectionView;
  navMode: "desktop" | "mobile";
  onNavigate?: () => void;
}) {
  const { section, sectionView, navMode, onNavigate } = props;
  const activeItem = sidebarNavItems.find((item) => item.key === section);
  const contextualHistory =
    activeItem?.historyHref && activeItem.historyLabel
      ? {
          href: activeItem.historyHref,
          label: activeItem.historyLabel,
        }
      : null;

  return (
    <div className="flex h-full flex-col gap-6">
      {navMode === "desktop" ? <SidebarBrand onNavigate={onNavigate} /> : null}

      <nav
        className="grid gap-1"
        data-sidebar-nav={navMode}
        aria-label="Sidebar navigation"
      >
        {sidebarNavItems.map((item) => (
          <SidebarLink
            key={item.key}
            href={item.href}
            label={item.label}
            icon={item.icon}
            iconKey={item.key}
            active={item.key === section}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {contextualHistory ? (
        <section className="mt-auto border-t border-[var(--app-border-soft)] pt-5">
          <div className="px-3 pb-2 text-[11px] font-medium tracking-[0.08em] text-[var(--app-text-subtle)]">
            历史
          </div>
          <SidebarLink
            href={contextualHistory.href}
            label={contextualHistory.label}
            icon={HistoryIcon}
            iconKey="history"
            active={sectionView === "history"}
            onNavigate={onNavigate}
          />
        </section>
      ) : null}
    </div>
  );
}

function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { eyebrow, title, description, actions } = props;

  return (
    <header className="app-page-header flex flex-col gap-5 border-b border-[var(--app-border-soft)] pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-4 font-[family-name:var(--font-heading)] text-[11px] tracking-[0.18em] text-[var(--app-text-subtle)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="app-display max-w-5xl text-[46px] leading-[0.96] text-[var(--app-text-strong)] sm:text-[58px] xl:text-[72px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--app-text-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function WorkspaceShell(props: {
  section: WorkspaceSection;
  sectionView?: WorkspaceSectionView;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  showWatchlistsAction?: boolean;
  summary?: ReactNode;
  workflowTabs?: WorkflowStageTab[];
  children: ReactNode;
}) {
  const {
    section,
    sectionView = "default",
    eyebrow,
    title,
    description,
    actions,
    showWatchlistsAction = true,
    summary,
    workflowTabs = [],
    children,
  } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerActions = (
    <>
      {actions}
      {showWatchlistsAction ? (
        <Link href="/watchlists" className="app-button">
          鑷€夎偂鍒楄〃
        </Link>
      ) : null}
    </>
  );

  return (
    <main
      className="app-shell min-h-screen bg-[var(--app-bg)] lg:grid lg:grid-cols-[258px_minmax(0,1fr)]"
      data-workflow-shell="mistral"
    >
      <aside
        data-sidebar-anchor="left"
        className="hidden border-r border-[var(--app-border-soft)] bg-[var(--app-bg-inset)] lg:block"
      >
        <div className="sticky top-0 h-screen px-4 py-4">
          <SidebarRail
            section={section}
            sectionView={sectionView}
            navMode="desktop"
          />
        </div>
      </aside>

      <section className="min-w-0 bg-[var(--app-bg)]">
        <div className="border-b border-[var(--app-border-soft)] bg-[var(--app-bg)] lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button
              type="button"
              aria-label="Open navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-bg-inset)] text-[var(--app-text-strong)] transition-colors hover:bg-[var(--app-bg-raised)]"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="h-[18px] w-[18px]" />
            </button>
            <SidebarBrand />
          </div>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation menu"
              className="absolute inset-0 bg-[rgba(0,0,0,0.72)]"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative z-10 flex h-full w-[280px] max-w-[82vw] flex-col border-r border-[var(--app-border-soft)] bg-[var(--app-bg-inset)] px-4 py-4 shadow-[var(--app-shadow-lg)]">
              <div className="mb-6 flex items-center justify-between gap-3">
                <SidebarBrand onNavigate={() => setMobileOpen(false)} />
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[var(--app-border-soft)] bg-[var(--app-bg-inset)] text-[var(--app-text-strong)] transition-colors hover:bg-[var(--app-bg-raised)]"
                  onClick={() => setMobileOpen(false)}
                >
                  <CloseIcon className="h-[18px] w-[18px]" />
                </button>
              </div>
              <SidebarRail
                section={section}
                sectionView={sectionView}
                navMode="mobile"
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </div>
        ) : null}

        <div className="mx-auto flex min-h-screen w-full max-w-[1280px] flex-col gap-8 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <PageHeader
            eyebrow={eyebrow}
            title={title}
            description={description}
            actions={headerActions}
          />

          {workflowTabs.length > 0 ? (
            <section className="grid gap-3 lg:grid-cols-4 xl:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
              {workflowTabs.map((tab, tabIndex) => (
                <article
                  key={tab.id}
                  className="border border-[var(--app-border-soft)] bg-[var(--app-surface)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-[family-name:var(--font-heading)] text-[11px] tracking-[0.14em] text-[var(--app-text-subtle)]">
                      Step {tabIndex + 1}
                    </div>
                    <div className="app-workflow-index">
                      {String(tabIndex + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="mt-3 font-[family-name:var(--font-heading)] text-xl leading-none text-[var(--app-text-strong)]">
                    {tab.label}
                  </div>
                  <div className="mt-3 text-sm leading-6 text-[var(--app-text-muted)]">
                    {tab.summary}
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {summary ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summary}
            </section>
          ) : null}

          <div className="grid gap-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
