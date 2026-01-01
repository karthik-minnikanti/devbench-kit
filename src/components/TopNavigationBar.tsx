import { useState, useRef, useEffect } from 'react';
import { TabType } from './CategorizedTabs';
import { Icon } from './Icon';
import { BrandLogo } from './BrandLogo';
import { ThemeSwitcher } from './ThemeSwitcher';

// Allowed tabs: api, planner, js-runner, notes, excalidraw, uml (plus home)
const ALLOWED_TABS: TabType[] = ['home', 'api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml'];

const allCategories = [
  { id: 'home', label: 'Home', icon: 'Home', tabs: ['home'] as TabType[] },
  { id: 'tools', label: 'Developer Tools', icon: 'Code', tabs: ['api', 'formatter', 'regex', 'js-runner'] as TabType[] },
  { id: 'converters', label: 'Converters', icon: 'Convert', tabs: ['schema', 'json-xml', 'json-diff', 'encoder', 'csv-yaml'] as TabType[] },
  { id: 'productivity', label: 'Productivity', icon: 'FileText', tabs: ['notes', 'planner'] as TabType[] },
  { id: 'design', label: 'Design', icon: 'Pen', tabs: ['excalidraw', 'uml'] as TabType[] },
  { id: 'devops', label: 'DevOps', icon: 'Container', tabs: ['docker', 'k8s'] as TabType[] },
  { id: 'profile', label: 'Profile', icon: 'User', tabs: ['profile'] as TabType[] },
];

// Filter categories to only show allowed tabs
const categories = allCategories
  .map(cat => ({
    ...cat,
    tabs: cat.tabs.filter(tab => ALLOWED_TABS.includes(tab))
  }))
  .filter(cat => cat.tabs.length > 0); // Only show categories that have allowed tabs

const tabLabels: Record<TabType, string> = {
  home: 'Home',
  schema: 'Schema Generator',
  api: 'API Client',
  notes: 'Notes',
  excalidraw: 'Excalidraw',
  uml: 'UML Editor',
  formatter: 'Formatter',
  'js-runner': 'JS Runner',
  'json-xml': 'JSON/XML',
  'csv-yaml': 'CSV/YAML',
  encoder: 'Encoder/Decoder',
  'json-diff': 'JSON Diff',
  regex: 'Regex Tester',
  planner: 'Daily Planner',
  profile: 'Profile',
  docker: 'Docker',
  k8s: 'Kubernetes',
  'git-settings': 'Git Settings',
};

const tabIcons: Record<TabType, string> = {
  home: 'Home',
  schema: 'Schema',
  api: 'Globe',
  notes: 'FileText',
  excalidraw: 'PenTool',
  uml: 'Chart',
  formatter: 'Code',
  'js-runner': 'Zap',
  'json-xml': 'Convert',
  'csv-yaml': 'File',
  encoder: 'Lock',
  'json-diff': 'Diff',
  regex: 'Search',
  planner: 'Calendar',
  profile: 'User',
  docker: 'Container',
  k8s: 'Container',
  'git-settings': 'GitBranch',
};

interface TopNavigationBarProps {
  openTabs: Array<{ id: string; type: TabType; label: string; icon: string }>;
  onTabClick: (tabType: TabType) => void;
  onNewTab: (tabType: TabType) => void;
  isMac?: boolean;
}

export function TopNavigationBar({ openTabs, onTabClick, onNewTab, isMac = false }: TopNavigationBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const dropdown = dropdownRefs.current[openDropdown];
        const target = event.target as Node;
        // Check if click is outside both dropdown and its button
        if (dropdown && !dropdown.contains(target)) {
          // Check if click is on the button that opened this dropdown
          const button = document.querySelector(`[data-category-id="${openDropdown}"]`);
          if (button && !button.contains(target)) {
            setOpenDropdown(null);
          }
        }
      }
    };

    if (openDropdown) {
      // Use a small delay to avoid immediate closure
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown]);

  const handleTabClick = (tabType: TabType) => {
    // Directly change the active tab (no tabs system)
    onTabClick(tabType);
    setOpenDropdown(null);
  };

  const toggleDropdown = (categoryId: string) => {
    setOpenDropdown(openDropdown === categoryId ? null : categoryId);
  };

  const handleCategoryClick = (category: typeof categories[0]) => {
    // If category has only one tab, open it directly
    if (category.tabs.length === 1) {
      handleTabClick(category.tabs[0]);
    } else {
      // Otherwise, toggle dropdown
      toggleDropdown(category.id);
    }
  };

  return (
    <div className="h-8 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-3 flex-shrink-0 relative draggable" style={{ zIndex: 100 }}>
      <div className="flex items-center gap-2.5 flex-shrink-0" style={{ paddingLeft: isMac ? '80px' : '0' }}>
        <BrandLogo size="sm" showText={true} />
      </div>

      {/* Navigation Categories */}
      <div className="flex items-center gap-0 text-xs text-[var(--color-text-secondary)] flex-1 justify-end min-w-0 h-full overflow-visible">
          {categories.map((category, index) => (
          <div key={category.id} className="relative flex items-center h-full" style={{ zIndex: openDropdown === category.id ? 1000 : 'auto' }}>
            {index > 0 && (
              <span className="text-[var(--color-text-tertiary)] px-1 flex-shrink-0 flex items-center h-full">|</span>
            )}
            <button
              data-category-id={category.id}
              onClick={(e) => {
                e.stopPropagation();
                handleCategoryClick(category);
              }}
              className={`px-2 py-1 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 h-full ${
                openDropdown === category.id
                  ? 'bg-[var(--color-muted)] text-[var(--color-text-primary)]'
                  : 'hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <Icon name={category.icon as keyof typeof import('./Icons').Icons} className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs leading-none">{category.label}</span>
              {category.tabs.length > 1 && (
                <Icon 
                  name={openDropdown === category.id ? "ChevronDown" : "ChevronRight"} 
                  className="w-3 h-3 flex-shrink-0" 
                />
              )}
            </button>
            
            {openDropdown === category.id && (
              <div
                ref={(el) => { dropdownRefs.current[category.id] = el; }}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-full left-0 mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded shadow-lg min-w-[180px] max-h-[300px] overflow-y-auto py-1"
                style={{ 
                  zIndex: 9999,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
              >
                {category.tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabClick(tab)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:bg-[var(--color-muted)] text-xs text-[var(--color-text-primary)]"
                  >
                    <Icon name={tabIcons[tab] as keyof typeof import('./Icons').Icons || 'Code'} className="w-3.5 h-3.5 text-[var(--color-text-secondary)] flex-shrink-0" />
                    <span className="truncate">{tabLabels[tab]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Right side - Theme Switcher */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <ThemeSwitcher />
      </div>
    </div>
  );
}

