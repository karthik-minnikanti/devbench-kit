export interface BlockNoteTheme {
  colors: Record<string, Record<string, string>>;
  fonts: Record<string, string>;
  borderRadius: number;
  spacing: Record<string, number>;
}

export const createTheme = (overrides: Partial<BlockNoteTheme>): BlockNoteTheme => ({
  colors: {
    editor: {
      background: "#ffffff",
      text: "#1f2937"
    },
    menu: {
      background: "#ffffff",
      text: "#1f2937"
    },
    tooltip: {
      background: "#111827",
      text: "#ffffff"
    },
    hovered: {
      background: "#f3f4f6"
    },
    selected: {
      background: "#e5e7eb"
    },
    disabled: {
      background: "#f9fafb",
      text: "#9ca3af"
    },
    ...overrides.colors
  },
  fonts: {
    body: "Inter, system-ui, sans-serif",
    heading: "Inter, system-ui, sans-serif",
    monospace: "JetBrains Mono, monospace",
    ...overrides.fonts
  },
  borderRadius: 8,
  spacing: {
    block: 8,
    ...overrides.spacing,
  },
  ...overrides,
});

// Blank / Basic Template Theme
export const BlankTheme = createTheme({
  colors: {
    editor: {
      background: "#fafafa",
      text: "#111827"
    }
  }
});

// API Documentation Theme
export const ApiDocsTheme = createTheme({
  colors: {
    editor: {
      background: "#ffffff",
      text: "#0f172a"
    },
    selected: {
      background: "#dbeafe"
    }
  }
});

// Requirements Document Theme
export const RequirementsTheme = createTheme({
  colors: {
    editor: {
      background: "#f8fafc",
      text: "#1e293b"
    },
    hovered: {
      background: "#eef2ff"
    }
  }
});

// Jira Ticket Theme
export const JiraTheme = createTheme({
  colors: {
    editor: {
      background: "#ffffff",
      text: "#111827"
    },
    selected: {
      background: "#fde68a"
    }
  },
  borderRadius: 6
});

// Bug Report Theme
export const BugTheme = createTheme({
  colors: {
    editor: {
      background: "#fff7ed",
      text: "#7c2d12"
    },
    selected: {
      background: "#fee2e2"
    }
  }
});

// Pull Request Theme
export const PullRequestTheme = createTheme({
  colors: {
    editor: {
      background: "#ffffff",
      text: "#064e3b"
    },
    hovered: {
      background: "#ecfdf5"
    }
  }
});

// Technical Design Doc Theme
export const TechDesignTheme = createTheme({
  colors: {
    editor: {
      background: "#f1f5f9",
      text: "#020617"
    }
  },
  borderRadius: 10
});

// Code Review Theme
export const CodeReviewTheme = createTheme({
  colors: {
    editor: {
      background: "#ffffff",
      text: "#3f3f46"
    },
    selected: {
      background: "#fef9c3"
    }
  }
});

// Deployment Plan Theme
export const DeploymentTheme = createTheme({
  colors: {
    editor: {
      background: "#ecfeff",
      text: "#164e63"
    }
  }
});

// Database Schema Theme
export const DatabaseTheme = createTheme({
  fonts: {
    monospace: "IBM Plex Mono, monospace"
  },
  colors: {
    editor: {
      background: "#ffffff",
      text: "#022c22"
    }
  }
});

// Dev Team Meeting Theme
export const MeetingTheme = createTheme({
  colors: {
    editor: {
      background: "#faf5ff",
      text: "#2e1065"
    }
  }
});

// Daily Standup Theme
export const StandupTheme = createTheme({
  colors: {
    editor: {
      background: "#f0fdf4",
      text: "#14532d"
    },
    selected: {
      background: "#dcfce7"
    },
    hovered: {
      background: "#ecfdf5"
    }
  },
  borderRadius: 6
});

// Theme Map
export const themeMap: Record<string, BlockNoteTheme> = {
  blank: BlankTheme,
  'api-documentation': ApiDocsTheme,
  'requirements': RequirementsTheme,
  'jira-ticket': JiraTheme,
  'bug-report': BugTheme,
  'pull-request': PullRequestTheme,
  'technical-design': TechDesignTheme,
  'code-review': CodeReviewTheme,
  'deployment-plan': DeploymentTheme,
  'database-schema': DatabaseTheme,
  'meeting-notes-dev': MeetingTheme,
  'daily-standup': StandupTheme,
};

export function getThemeForTemplate(templateId: string): BlockNoteTheme {
  return themeMap[templateId] || BlankTheme;
}
