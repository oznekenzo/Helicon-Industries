import { IconMenu2, IconSettings } from "@tabler/icons-react";

import { classNames } from "@/lib/class-names";

export function BrandLockup({
  className,
  variant = "compact",
}: {
  className?: string;
  variant?: "compact" | "product";
}) {
  const BrandIcon = variant === "product" ? IconMenu2 : IconSettings;

  return (
    <div
      className={classNames(
        "brand-lockup",
        variant === "product" && "brand-lockup--product",
        className,
      )}
    >
      <span aria-hidden="true" className="brand-mark">
        <BrandIcon size={variant === "product" ? 22 : 18} stroke={2} />
      </span>
      <span>
        <strong>
          {variant === "product" ? "Helicon Industries" : "Helicon"}
        </strong>
        <small>
          {variant === "product" ? "MANUFACTURING CONTROL TOWER" : "INDUSTRIES"}
        </small>
      </span>
    </div>
  );
}
