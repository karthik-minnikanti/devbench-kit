import { Icons as IconSet } from "./Icons";
import { cloneElement } from "react";

interface IconProps {
  name: keyof typeof IconSet;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size }: IconProps) {
  const IconComponent = IconSet[name];
  if (!IconComponent) {
    console.warn(
      `Icon "${name}" not found in IconSet. Available icons:`,
      Object.keys(IconSet),
    );
    return null;
  }

  // Build className and style
  let finalClassName: string | undefined;
  let finalStyle: React.CSSProperties | undefined;

  if (size) {
    // Use inline style for size (this will override any className width/height)
    finalStyle = { width: `${size}px`, height: `${size}px` };
    // Keep className for other styles like colors, but don't include size classes
    finalClassName = className;
  } else {
    // Use className or default
    finalClassName = className || "w-4 h-4";
  }

  const iconElement = <IconComponent />;
  // Clone and replace className/style completely
  return cloneElement(iconElement, {
    className: finalClassName,
    style: finalStyle,
  });
}
