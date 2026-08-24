"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  IconCheck,
  IconChevronDown,
  IconCircleFilled,
  IconAlertOctagonFilled,
  IconInfoCircle,
  IconTriangleFilled,
  IconUserPlus,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import type {
  ImportQualitySummary,
  PriorityFilter,
  Responder,
  Severity,
} from "@/features/control-tower/types";
import type { Priority } from "@/features/manufacturing-events";
import { classNames } from "@/lib/class-names";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: Icon;
  notification?: boolean;
};

export function IconButton({
  label,
  icon: IconComponent,
  notification = false,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={classNames("icon-button", className)}
      title={label}
      type="button"
      {...props}
    >
      <IconComponent aria-hidden="true" size={15} stroke={1.75} />
      {notification ? <span className="notification-dot" /> : null}
    </button>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  compact?: boolean;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      aria-label={label}
      className={classNames("segmented-control", compact && "is-compact")}
      role="group"
    >
      {options.map((option) => (
        <button
          aria-pressed={value === option.value}
          className="segmented-control__button"
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const severityIcons: Record<Severity, Icon> = {
  critical: IconAlertOctagonFilled,
  high: IconTriangleFilled,
  medium: IconCircleFilled,
  low: IconCircleFilled,
};

export function SeverityIndicator({ severity }: { severity: Severity }) {
  const IconComponent = severityIcons[severity];

  return (
    <span className={`severity severity--${severity}`}>
      <IconComponent aria-hidden="true" size={10} stroke={0} />
      <span>{severity[0].toUpperCase() + severity.slice(1)}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      {priority === "normal"
        ? "Normal"
        : priority[0].toUpperCase() + priority.slice(1)}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "healthy" | "warning" | "critical";
}) {
  return (
    <span className={`status-badge status-badge--${tone}`}>{children}</span>
  );
}

export function EmptyState({
  icon: IconComponent,
  title,
  detail,
}: {
  icon: Icon;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state__icon">
        <IconComponent aria-hidden="true" size={18} stroke={1.5} />
      </span>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function DataStatusPopover({
  summary,
}: {
  summary: ImportQualitySummary | null;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton
          className="data-status-trigger"
          icon={IconInfoCircle}
          label="Data status"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="popover-card data-status"
          collisionPadding={12}
          sideOffset={8}
        >
          <Popover.Arrow className="popover-arrow" />
          <h2>Data status</h2>
          {summary ? (
            <>
              <p>
                {summary.repeatedEventIdCount.toLocaleString()} repeated event
                IDs were detected; accepted duplicate payloads were
                de-duplicated during ingestion.
              </p>
              <dl className="data-status__counts">
                <div>
                  <dt>Accepted events</dt>
                  <dd>{summary.acceptedEventCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Invalid lines</dt>
                  <dd>{summary.invalidLineCount.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>Conflicting IDs</dt>
                  <dd>{summary.conflictingDuplicateCount.toLocaleString()}</dd>
                </div>
              </dl>
              {summary.missingFields.length > 0 ? (
                <p>
                  Source fields not reported:{" "}
                  {summary.missingFields
                    .map(
                      (item) =>
                        `${item.label} (${item.count.toLocaleString()})`,
                    )
                    .join(", ")}
                  .
                </p>
              ) : null}
              <p>
                Missing values remain missing; the interface does not infer
                them.
              </p>
            </>
          ) : (
            <p>No completed import-quality report is available.</p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FacilityPopover({ facility }: { facility: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="facility-trigger" type="button">
          {facility}
          <IconChevronDown aria-hidden="true" size={13} stroke={1.75} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="popover-card facility-menu"
          collisionPadding={12}
          sideOffset={7}
        >
          <div className="facility-menu__row is-selected">
            <span>{facility}</span>
            <span className="facility-menu__viewing">
              <IconCircleFilled aria-hidden="true" size={7} stroke={0} />
              Viewing
            </span>
          </div>
          <div aria-disabled="true" className="facility-menu__row is-disabled">
            <span>la_02</span>
            <span>Unavailable</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AssignmentMenu({
  assigneeName,
  responders,
  onAssign,
  disabled = false,
}: {
  assigneeName?: string;
  responders: Responder[];
  onAssign: (responderId: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={classNames(
            "assignment-trigger",
            assigneeName && "is-assigned",
          )}
          disabled={disabled}
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          <IconUserPlus aria-hidden="true" size={13} stroke={1.75} />
          <span>{assigneeName ?? "Assign"}</span>
          {assigneeName ? (
            <IconChevronDown aria-hidden="true" size={12} stroke={1.75} />
          ) : null}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="assignment-menu"
          collisionPadding={12}
          onClick={(event) => event.stopPropagation()}
          sideOffset={5}
        >
          <DropdownMenu.Label>Assign technician</DropdownMenu.Label>
          {responders.length > 0 ? (
            responders.map((responder) => (
              <DropdownMenu.Item
                className="assignment-menu__item"
                key={responder.id}
                onSelect={() => onAssign(responder.id)}
              >
                <span>
                  <strong>{responder.displayName}</strong>
                  <small>{responder.role}</small>
                </span>
                {assigneeName === responder.displayName ? (
                  <IconCheck aria-hidden="true" size={14} stroke={1.75} />
                ) : null}
              </DropdownMenu.Item>
            ))
          ) : (
            <DropdownMenu.Item className="assignment-menu__empty" disabled>
              No active technicians
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function SideDrawer({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content aria-describedby={undefined} className="drawer-content">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Close asChild>
            <IconButton
              className="drawer-close"
              icon={IconX}
              label="Close job details"
            />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const priorityOptions: Array<{
  value: PriorityFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];
