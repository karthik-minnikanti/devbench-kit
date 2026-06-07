import { useState, useRef, useEffect } from "react";
import { TabType } from "./CategorizedTabs";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";
import { ThemeSwitcher } from "./ThemeSwitcher";
import {
  getNavCategories,
  NAV_ALLOWED_TABS,
  TAB_ICONS,
  TAB_LABELS,
} from "../utils/toolCategories";

const categories = getNavCategories(NAV_ALLOWED_TABS);

interface TopNavigationBarProps {
  openTabs: Array<{ id: string; type: TabType; label: string; icon: string }>;
  onTabClick: (tabType: TabType) => void;
  onNewTab: (tabType: TabType) => void;
  isMac?: boolean;
}

export function TopNavigationBar({
  openTabs,
  onTabClick,
  onNewTab,
  isMac = false,
}: TopNavigationBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const dropdown = dropdownRefs.current[openDropdown];
        const target = event.target as Node;
        if (dropdown && !dropdown.contains(target)) {
          const button = document.querySelector(
            `[data-category-id="${openDropdown}"]`,
          );
          if (button && !button.contains(target)) {
            setOpenDropdown(null);
          }
        }
      }
    };

    if (openDropdown) {
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openDropdown]);

  const handleTabClick = (tabType: TabType) => {
    onTabClick(tabType);
    setOpenDropdown(null);
  };

  const toggleDropdown = (categoryId: string) => {
    setOpenDropdown(openDropdown === categoryId ? null : categoryId);
  };

  const handleCategoryClick = (category: (typeof categories)[0]) => {
    const showDropdown =
      category.alwaysShowDropdown || category.tabs.length > 1;

    if (!showDropdown) {
      handleTabClick(category.tabs[0]);
    } else {
      toggleDropdown(category.id);
    }
  };

  return (
    <div
      className="h-[var(--app-header-height)] bg-[var(--color-background)] border-b border-[var(--color-border)] flex items-center justify-between px-3 flex-shrink-0 relative draggable"
      style={{ zIndex: 100 }}
    >
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{ paddingLeft: isMac ? "80px" : "0" }}
      >
        <BrandLogo size="sm" showText={true} />
      </div>

      <div className="flex items-center gap-0 text-xs font-medium text-[var(--color-text-secondary)] flex-1 justify-end min-w-0 overflow-visible">
        {categories.map((category, index) => (
          <div
            key={category.id}
            className="relative flex items-center"
            style={{ zIndex: openDropdown === category.id ? 1000 : "auto" }}
          >
            {index > 0 && (
              <span className="text-[var(--color-text-tertiary)] px-1 flex-shrink-0">
                |
              </span>
            )}
            <button
              data-category-id={category.id}
              onClick={(e) => {
                e.stopPropagation();
                handleCategoryClick(category);
              }}
              className={`px-2 py-1 transition-colors flex items-center gap-1 whitespace-nowrap flex-shrink-0 border-b-2 -mb-px ${
                openDropdown === category.id
                  ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                  : "border-transparent hover:text-[var(--color-text-primary)] text-[var(--color-text-secondary)]"
              }`}
            >
              <Icon
                name={category.icon}
                className="w-3 h-3 flex-shrink-0"
              />
              <span className="text-xs leading-none">{category.label}</span>
              {category.alwaysShowDropdown || category.tabs.length > 1 ? (
                <Icon
                  name={
                    openDropdown === category.id
                      ? "ChevronDown"
                      : "ChevronRight"
                  }
                  className="w-3 h-3 flex-shrink-0"
                />
              ) : null}
            </button>

            {openDropdown === category.id && (
              <div
                ref={(el) => {
                  dropdownRefs.current[category.id] = el;
                }}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg min-w-[200px] max-h-[300px] overflow-y-auto py-1"
                style={{ zIndex: 9999 }}
              >
                {category.tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-[var(--color-muted)] text-xs text-[var(--color-text-primary)]"
                  >
                    <Icon
                      name={TAB_ICONS[tab]}
                      className="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-shrink-0"
                    />
                    <span className="truncate">{TAB_LABELS[tab]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <ThemeSwitcher />
      </div>
    </div>
  );
}
