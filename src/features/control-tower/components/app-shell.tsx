"use client";

import {
  IconBell,
  IconBriefcase,
  IconChecklist,
  IconClock,
  IconInbox,
  IconSearch,
  IconTool,
  IconUserCircle,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/ui/brand-lockup";
import {
  DataStatusPopover,
  FacilityPopover,
  IconButton,
} from "@/components/ui/control-tower-primitives";
import { formatTimestamp } from "@/features/control-tower/format";
import type {
  ControlTowerPageData,
  OperationsViewKey,
} from "@/features/control-tower/types";

const navItems = [
  { label: "Control Tower", icon: IconChecklist, active: true },
  { label: "Jobs", icon: IconBriefcase },
  { label: "Quality", icon: IconClock },
  { label: "Assets", icon: IconTool },
];

export function AppShell({
  data,
  activeView,
  children,
}: {
  data: ControlTowerPageData;
  activeView: OperationsViewKey;
  children: ReactNode;
}) {
  const snapshotDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(data.asOf));

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <BrandLockup />
        <nav aria-label="Primary navigation" className="primary-nav">
          {navItems.map(({ label, icon: IconComponent, active }) => (
            <button
              aria-current={active ? "page" : undefined}
              className="primary-nav__item"
              disabled={!active}
              key={label}
              type="button"
            >
              <IconComponent aria-hidden="true" size={15} stroke={1.75} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar__spacer" />
        <div className="snapshot-stamp">
          <span>SNAPSHOT</span>
          <span>{snapshotDate.toUpperCase()}</span>
        </div>
      </aside>
      <section className="app-main">
        <header className="page-header">
          <h1>LA-01 Control Tower</h1>
          <FacilityPopover facility={data.facility} />
          <span className="snapshot-pill">
            <IconClock aria-hidden="true" size={12} stroke={1.75} />
            Historical snapshot
          </span>
          <time className="page-header__time" dateTime={data.asOf}>
            {formatTimestamp(data.asOf)} UTC
          </time>
          <DataStatusPopover summary={data.importQuality} />
          <div className="page-header__spacer" />
          <label className="global-search">
            <span className="sr-only">Search</span>
            <IconSearch aria-hidden="true" size={14} stroke={1.75} />
            <input
              aria-disabled="true"
              placeholder="Job, machine, Tool, Part, customer…"
              readOnly
              type="search"
            />
          </label>
          <IconButton icon={IconBell} label="Notifications" notification />
          <IconButton icon={IconInbox} label="Inbox" />
          <button className="profile-button" type="button">
            <span className="profile-button__avatar">AK</span>
            <span>Avery Kim</span>
            <IconUserCircle aria-hidden="true" className="sr-only" />
          </button>
        </header>
        <div className="screen-content" data-view={activeView}>
          {children}
        </div>
      </section>
    </main>
  );
}
