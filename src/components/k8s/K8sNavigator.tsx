import { useState } from "react";
import { K8sResourceKind } from "./types";
import { NAV_SECTIONS } from "./utils";
import {
  ToolSidebar,
  ToolSidebarBody,
  ToolSidebarItem,
  ToolSidebarSection,
} from "../ui/ToolChrome";

interface K8sNavigatorProps {
  activeKind: K8sResourceKind;
  onSelect: (kind: K8sResourceKind) => void;
}

const DEFAULT_EXPANDED = NAV_SECTIONS.map((section) => section.id);

export function K8sNavigator({ activeKind, onSelect }: K8sNavigatorProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(DEFAULT_EXPANDED);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    );
  };

  return (
    <ToolSidebar width="narrow" aria-label="Kubernetes resources">
      <ToolSidebarBody>
        {NAV_SECTIONS.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          return (
            <div key={section.id}>
              <ToolSidebarSection
                label={section.label}
                expanded={isExpanded}
                onToggle={() => toggleSection(section.id)}
              />
              {isExpanded && (
                <ul>
                  {section.items.map((item) => (
                    <li key={item.kind}>
                      <ToolSidebarItem
                        active={activeKind === item.kind}
                        onClick={() => onSelect(item.kind)}
                        className="truncate"
                      >
                        {item.label}
                      </ToolSidebarItem>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </ToolSidebarBody>
    </ToolSidebar>
  );
}
