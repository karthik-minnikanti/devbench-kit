import { useState } from "react";
import { Icon } from "./Icon";
import { BrandLogo } from "./BrandLogo";

interface WelcomeScreenProps {
  onDismiss: () => void;
  onOpenTool: (tool: string) => void;
}

export function WelcomeScreen({ onDismiss, onOpenTool }: WelcomeScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const features = [
    {
      icon: "Schema",
      title: "Schema Generator",
      description:
        "Generate TypeScript, Zod, Prisma, and Mongoose schemas from JSON",
      action: () => onOpenTool("schema"),
    },
    {
      icon: "Globe",
      title: "API Studio",
      description: "Test REST APIs with a Postman-like interface",
      action: () => onOpenTool("api"),
    },
    {
      icon: "Code",
      title: "Formatter",
      description: "Format JSON, XML, HTML, CSS, and more",
      action: () => onOpenTool("formatter"),
    },
    {
      icon: "FileText",
      title: "Notes",
      description: "Rich text notes with auto-save",
      action: () => onOpenTool("notes"),
    },
  ];

  const quickTips = [
    "Press Cmd/Ctrl + K to open global search",
    "Use Cmd/Ctrl + T to open a new tab",
    "Right-click on tools to open in new tab",
    "All your work is automatically saved",
  ];

  if (currentStep === 0) {
    return (
      <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-[var(--color-background)] p-8">
        <div className="max-w-4xl w-full animate-fade-in">
          <div className="text-center mb-8">
            <div className="mb-6 flex justify-center">
              <BrandLogo size="lg" showText={true} />
            </div>
            <h1 className="display-md mb-3">Welcome to DevBench</h1>
            <p className="text-base text-[var(--color-text-secondary)] mb-8">
              Your all-in-one developer toolkit
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {features.map((feature, index) => (
              <button
                key={index}
                onClick={feature.action}
                className="card p-4 hover:bg-[var(--color-muted)] transition-colors text-left group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-md bg-[var(--color-muted)] flex items-center justify-center group-hover:bg-[var(--color-primary)]/10 transition-colors">
                    <Icon
                      name={
                        feature.icon as keyof typeof import("./Icons").Icons
                      }
                      className="w-5 h-5 text-[var(--color-primary)]"
                    />
                  </div>
                  <h3 className="title-sm">{feature.title}</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {feature.description}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-[var(--color-background-soft)] border border-[var(--color-border)] rounded-lg p-6 mb-6">
            <h3 className="title-sm mb-3 flex items-center gap-2">
              <Icon
                name="Info"
                className="w-4 h-4 text-[var(--color-primary)]"
              />
              Quick Tips
            </h3>
            <ul className="space-y-2">
              {quickTips.map((tip, index) => (
                <li
                  key={index}
                  className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2"
                >
                  <span className="text-[var(--color-primary)]">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button onClick={onDismiss} className="btn-primary">
              Get Started
            </button>
            <button onClick={() => setCurrentStep(1)} className="btn-secondary">
              View All Features
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-[var(--color-background)] p-8">
      <div className="max-w-4xl w-full animate-fade-in">
        <div className="text-center mb-8">
          <h2 className="display-sm mb-2">All Features</h2>
          <p className="text-[var(--color-text-secondary)]">
            Explore everything DevBench has to offer
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            "Schema Generator",
            "JSON/XML Converter",
            "JSON Diff",
            "Encoder/Decoder",
            "CSV/YAML Converter",
            "API Studio",
            "Formatter",
            "Regex Tester",
            "JavaScript Runner",
            "Docker",
            "Kubernetes",
            "Notes",
            "Excalidraw",
            "UML Editor",
            "Profile",
          ].map((tool) => (
            <button
              key={tool}
              onClick={() => {
                const toolMap: Record<string, string> = {
                  "Schema Generator": "schema",
                  "JSON/XML Converter": "json-xml",
                  "JSON Diff": "json-diff",
                  "Encoder/Decoder": "encoder",
                  "CSV/YAML Converter": "csv-yaml",
                  "API Studio": "api",
                  Formatter: "formatter",
                  "Regex Tester": "regex",
                  "JavaScript Runner": "js-runner",
                  Docker: "docker",
                  Kubernetes: "k8s",
                  Notes: "notes",
                  Excalidraw: "excalidraw",
                  "UML Editor": "uml",
                  Profile: "profile",
                };
                onOpenTool(toolMap[tool] || "schema");
              }}
              className="px-4 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-muted)] transition-colors text-sm text-[var(--color-text-primary)]"
            >
              {tool}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setCurrentStep(0)} className="btn-secondary">
            ← Back
          </button>
          <button onClick={onDismiss} className="btn-primary">
            Start Using DevBench
          </button>
        </div>
      </div>
    </div>
  );
}
