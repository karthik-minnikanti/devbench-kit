import type { TabType } from "../components/CategorizedTabs";

export type WorkflowCategoryId =
  | "home"
  | "build"
  | "debug"
  | "transform"
  | "ship"
  | "document"
  | "profile";

type ToolIcon = keyof typeof import("../components/Icons").Icons;

export interface ToolTileDefinition {
  id: TabType | string;
  label: string;
  icon: ToolIcon;
  description: string;
}

export interface WorkflowCategoryDefinition {
  id: WorkflowCategoryId;
  title: string;
  icon: ToolIcon;
  tabs: TabType[];
  tools: ToolTileDefinition[];
  alwaysShowDropdown?: boolean;
}

/** Set to true to show Profile in navigation and allow opening the profile tab. */
export const PROFILE_SECTION_ENABLED = false;

const NAV_TAB_IDS: TabType[] = [
  "home",
  "js-runner",
  "api",
  "regex",
  "json-diff",
  "formatter",
  "schema",
  "json-xml",
  "encoder",
  "csv-yaml",
  "k8s",
  "docker",
  "devshell",
  "notes",
  "planner",
  "excalidraw",
  "uml",
  ...(PROFILE_SECTION_ENABLED ? (["profile"] as TabType[]) : []),
];

/** Tabs surfaced in the top navigation dropdowns. */
export const NAV_ALLOWED_TABS: TabType[] = NAV_TAB_IDS;

export const TAB_LABELS: Record<TabType, string> = {
  home: "Home",
  schema: "Schema Generator",
  api: "API Studio",
  notes: "Notes",
  excalidraw: "Excalidraw",
  uml: "UML Editor",
  formatter: "Formatter",
  "js-runner": "JS Runner",
  "json-xml": "JSON / XML",
  "csv-yaml": "CSV / YAML",
  encoder: "Encoder",
  "json-diff": "JSON Diff",
  regex: "Regex Tester",
  planner: "Daily Planner",
  profile: "Profile",
  docker: "Docker",
  k8s: "Kube Lens",
  devshell: "DevShell",
  terminal: "DevShell",
  "git-settings": "Git Settings",
};

export const TAB_ICONS: Record<TabType, ToolIcon> = {
  home: "Home",
  schema: "Schema",
  api: "Globe",
  notes: "FileText",
  excalidraw: "Pen",
  uml: "Chart",
  formatter: "Code",
  "js-runner": "Zap",
  "json-xml": "Convert",
  "csv-yaml": "File",
  encoder: "Lock",
  "json-diff": "Diff",
  regex: "Search",
  planner: "Calendar",
  profile: "User",
  docker: "Container",
  k8s: "Kubernetes",
  devshell: "Terminal",
  terminal: "Terminal",
  "git-settings": "Code",
};

export const WORKFLOW_CATEGORIES: WorkflowCategoryDefinition[] = [
  {
    id: "home",
    title: "Home",
    icon: "Home",
    tabs: ["home"],
    tools: [],
  },
  {
    id: "build",
    title: "Build & run",
    icon: "Zap",
    tabs: ["js-runner"],
    tools: [
      {
        id: "js-runner",
        label: "JS Runner",
        icon: "Zap",
        description: "Run snippets with npm",
      },
    ],
  },
  {
    id: "debug",
    title: "Debug & inspect",
    icon: "Search",
    tabs: ["api", "regex", "json-diff"],
    tools: [
      {
        id: "api",
        label: "API Studio",
        icon: "Globe",
        description: "REST client and collections",
      },
      {
        id: "regex",
        label: "Regex Tester",
        icon: "Search",
        description: "Match and debug patterns",
      },
      {
        id: "json-diff",
        label: "JSON Diff",
        icon: "Diff",
        description: "Side-by-side compare",
      },
    ],
  },
  {
    id: "transform",
    title: "Transform data",
    icon: "Convert",
    tabs: ["formatter", "schema", "json-xml", "encoder", "csv-yaml"],
    tools: [
      {
        id: "formatter",
        label: "Formatter",
        icon: "Code",
        description: "JSON, XML, and text",
      },
      {
        id: "schema",
        label: "Schema Generator",
        icon: "Schema",
        description: "Types from JSON samples",
      },
      {
        id: "json-xml",
        label: "JSON / XML",
        icon: "Convert",
        description: "Bidirectional conversion",
      },
      {
        id: "encoder",
        label: "Encoder",
        icon: "Lock",
        description: "Base64 and URL codecs",
      },
      {
        id: "csv-yaml",
        label: "CSV / YAML",
        icon: "File",
        description: "Tabular and config formats",
      },
    ],
  },
  {
    id: "ship",
    title: "Ship & operate",
    icon: "Container",
    tabs: ["k8s", "docker", "devshell"],
    alwaysShowDropdown: true,
    tools: [
      {
        id: "k8s",
        label: "Kube Lens",
        icon: "Kubernetes",
        description: "Pods, logs, cluster ops",
      },
      {
        id: "docker",
        label: "Docker",
        icon: "Container",
        description: "Containers and images",
      },
      {
        id: "devshell",
        label: "DevShell",
        icon: "Terminal",
        description: "Local, K8s, and Docker shells",
      },
    ],
  },
  {
    id: "document",
    title: "Document & plan",
    icon: "FileText",
    tabs: ["notes", "planner", "excalidraw", "uml"],
    tools: [
      {
        id: "notes",
        label: "Notes",
        icon: "FileText",
        description: "Rich docs and templates",
      },
      {
        id: "planner",
        label: "Daily Planner",
        icon: "Calendar",
        description: "Tasks, habits, reflection",
      },
      {
        id: "excalidraw",
        label: "Excalidraw",
        icon: "Pen",
        description: "Whiteboard diagrams",
      },
      {
        id: "uml",
        label: "UML Editor",
        icon: "Chart",
        description: "PlantUML diagrams",
      },
    ],
  },
  {
    id: "profile",
    title: "Profile",
    icon: "User",
    tabs: ["profile"],
    tools: [],
  },
];

export type HomeToolSectionId = Exclude<WorkflowCategoryId, "home" | "profile">;

export const HOME_TOOL_SECTIONS = WORKFLOW_CATEGORIES.filter(
  (category): category is WorkflowCategoryDefinition & { id: HomeToolSectionId } =>
    category.id !== "home" &&
    category.id !== "profile" &&
    category.tools.length > 0,
).map((category) => ({
  id: category.id,
  title: category.title,
  tools: category.tools,
}));

export function getNavCategories(allowedTabs: TabType[] = NAV_ALLOWED_TABS) {
  return WORKFLOW_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.title,
    icon: category.icon,
    tabs: category.tabs.filter((tab) => allowedTabs.includes(tab)),
    alwaysShowDropdown: category.alwaysShowDropdown,
  })).filter(
    (category) =>
      category.tabs.length > 0 &&
      (PROFILE_SECTION_ENABLED || category.id !== "profile"),
  );
}

export function getCategoryForTab(
  tab: TabType,
  allowedTabs: TabType[] = NAV_ALLOWED_TABS,
): (typeof WORKFLOW_CATEGORIES)[number] | undefined {
  return WORKFLOW_CATEGORIES.find(
    (category) =>
      category.tabs.includes(tab) && category.tabs.some((entry) => allowedTabs.includes(entry)),
  );
}

export function getTabIdsForCategory(categoryId: WorkflowCategoryId): TabType[] {
  return WORKFLOW_CATEGORIES.find((category) => category.id === categoryId)?.tabs ?? [];
}
