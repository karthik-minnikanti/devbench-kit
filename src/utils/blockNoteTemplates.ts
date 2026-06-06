import type { PartialBlock } from "@blocknote/core";

// Template Map for easy access
export const TemplateBlockMap: Record<string, PartialBlock[]> = {
    // 1️⃣ Blank Template
    blank: [
        {
            id: "blank-1",
            type: "paragraph",
            content: "Start writing here...",
            props: {}
        }
    ],

    // 2️⃣ API Documentation
    'api-documentation': [
        {
            id: "api-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "API Documentation", styles: {} }]
        },
        {
            id: "api-2",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "Overview", styles: {} }]
        },
        {
            id: "api-3",
            type: "paragraph",
            content: [{ type: "text", text: "API Name: ", styles: {} }]
        },
        {
            id: "api-4",
            type: "paragraph",
            content: [{ type: "text", text: "Version: ", styles: {} }]
        },
        {
            id: "api-5",
            type: "paragraph",
            content: [{ type: "text", text: "Base URL: ", styles: {} }]
        },
        {
            id: "api-6",
            type: "paragraph",
            content: []
        },
        {
            id: "api-7",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔐 Authentication", styles: {} }]
        },
        {
            id: "api-8",
            type: "paragraph",
            content: [{ type: "text", text: "Describe the authentication method used (API Key, OAuth, Bearer Token, etc.)", styles: {} }]
        },
        {
            id: "api-9",
            type: "paragraph",
            content: []
        },
        {
            id: "api-10",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📡 Endpoints", styles: {} }]
        },
        {
            id: "api-11",
            type: "paragraph",
            content: []
        },
        {
            id: "api-12",
            type: "heading",
            props: { level: 3 },
            content: [{ type: "text", text: "GET /resource", styles: {} }]
        },
        {
            id: "api-13",
            type: "paragraph",
            content: [{ type: "text", text: "Description: ", styles: {} }]
        },
        {
            id: "api-14",
            type: "paragraph",
            content: [{ type: "text", text: "Method: GET", styles: {} }]
        },
        {
            id: "api-15",
            type: "paragraph",
            content: [{ type: "text", text: "Path: /api/v1/resource", styles: {} }]
        },
        {
            id: "api-16",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Query Parameters", styles: {} }]
        },
        {
            id: "api-17",
            type: "bulletListItem",
            content: [{ type: "text", text: "param: type - description", styles: {} }]
        },
        {
            id: "api-18",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Request Example", styles: {} }]
        },
        {
            id: "api-19",
            type: "codeBlock",
            props: { language: "bash" },
            content: "GET /api/v1/resource?id=123"
        },
        {
            id: "api-20",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Response Schema", styles: {} }]
        },
        {
            id: "api-21",
            type: "codeBlock",
            props: { language: "json" },
            content: `{
  "id": "string",
  "name": "string"
}`
        },
        {
            id: "api-22",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Status Codes", styles: {} }]
        },
        {
            id: "api-23",
            type: "bulletListItem",
            content: [{ type: "text", text: "200: Success", styles: {} }]
        },
        {
            id: "api-24",
            type: "bulletListItem",
            content: [{ type: "text", text: "400: Bad Request", styles: {} }]
        },
        {
            id: "api-25",
            type: "bulletListItem",
            content: [{ type: "text", text: "404: Not Found", styles: {} }]
        },
        {
            id: "api-26",
            type: "paragraph",
            content: []
        },
        {
            id: "api-27",
            type: "heading",
            props: { level: 3 },
            content: [{ type: "text", text: "POST /resource", styles: {} }]
        },
        {
            id: "api-28",
            type: "paragraph",
            content: [{ type: "text", text: "Description: ", styles: {} }]
        },
        {
            id: "api-29",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Request Body", styles: {} }]
        },
        {
            id: "api-30",
            type: "codeBlock",
            props: { language: "json" },
            content: "{}"
        },
        {
            id: "api-31",
            type: "paragraph",
            content: []
        },
        {
            id: "api-32",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📚 Error Handling", styles: {} }]
        },
        {
            id: "api-33",
            type: "paragraph",
            content: [{ type: "text", text: "Common error responses and their meanings.", styles: {} }]
        },
        {
            id: "api-34",
            type: "bulletListItem",
            content: []
        },
        {
            id: "api-35",
            type: "paragraph",
            content: []
        },
        {
            id: "api-36",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 Notes", styles: {} }]
        },
        {
            id: "api-37",
            type: "paragraph",
            content: [{ type: "text", text: "Additional information, rate limits, deprecation notices, etc.", styles: {} }]
        },
        {
            id: "api-38",
            type: "paragraph",
            content: []
        }
    ],

    // 3️⃣ Requirements Document
    'requirements': [
        {
            id: "req-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Requirements Document", styles: {} }]
        },
        {
            id: "req-2",
            type: "paragraph",
            content: [{ type: "text", text: "Feature: ", styles: {} }]
        },
        {
            id: "req-3",
            type: "paragraph",
            content: [{ type: "text", text: "Version: ", styles: {} }]
        },
        {
            id: "req-4",
            type: "paragraph",
            content: [{ type: "text", text: `Date: ${new Date().toLocaleDateString()}`, styles: { bold: true } }]
        },
        {
            id: "req-5",
            type: "paragraph",
            content: []
        },
        {
            id: "req-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📋 Overview", styles: {} }]
        },
        {
            id: "req-7",
            type: "paragraph",
            content: [{ type: "text", text: "Brief description of the feature and its purpose.", styles: {} }]
        },
        {
            id: "req-8",
            type: "paragraph",
            content: []
        },
        {
            id: "req-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🎯 Goals & Objectives", styles: {} }]
        },
        {
            id: "req-10",
            type: "paragraph",
            content: [{ type: "text", text: "What problem does this solve? What are the success criteria?", styles: {} }]
        },
        {
            id: "req-11",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-12",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-13",
            type: "paragraph",
            content: []
        },
        {
            id: "req-14",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "👤 User Stories", styles: {} }]
        },
        {
            id: "req-15",
            type: "paragraph",
            content: [{ type: "text", text: "As a [user type], I want [goal] so that [benefit].", styles: {} }]
        },
        {
            id: "req-16",
            type: "bulletListItem",
            content: [{ type: "text", text: "As a... I want... so that...", styles: {} }]
        },
        {
            id: "req-17",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-18",
            type: "paragraph",
            content: []
        },
        {
            id: "req-19",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Acceptance Criteria", styles: {} }]
        },
        {
            id: "req-20",
            type: "paragraph",
            content: [{ type: "text", text: "Specific, testable conditions that must be met for the feature to be considered complete.", styles: {} }]
        },
        {
            id: "req-21",
            type: "bulletListItem",
            content: [{ type: "text", text: "Given [context], when [action], then [expected result]", styles: {} }]
        },
        {
            id: "req-22",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-23",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-24",
            type: "paragraph",
            content: []
        },
        {
            id: "req-25",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔧 Technical Requirements", styles: {} }]
        },
        {
            id: "req-26",
            type: "paragraph",
            content: [{ type: "text", text: "Technical constraints, dependencies, and implementation details.", styles: {} }]
        },
        {
            id: "req-27",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-28",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-29",
            type: "paragraph",
            content: []
        },
        {
            id: "req-30",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🎨 UI/UX Requirements", styles: {} }]
        },
        {
            id: "req-31",
            type: "paragraph",
            content: [{ type: "text", text: "Design specifications, wireframes, and user experience considerations.", styles: {} }]
        },
        {
            id: "req-32",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-33",
            type: "paragraph",
            content: []
        },
        {
            id: "req-34",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🚫 Out of Scope", styles: {} }]
        },
        {
            id: "req-35",
            type: "paragraph",
            content: [{ type: "text", text: "Features explicitly not included in this requirement.", styles: {} }]
        },
        {
            id: "req-36",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-37",
            type: "paragraph",
            content: []
        },
        {
            id: "req-38",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📊 Success Metrics", styles: {} }]
        },
        {
            id: "req-39",
            type: "paragraph",
            content: [{ type: "text", text: "How will we measure success?", styles: {} }]
        },
        {
            id: "req-40",
            type: "bulletListItem",
            content: []
        },
        {
            id: "req-41",
            type: "paragraph",
            content: []
        }
    ],

    // 4️⃣ Jira Ticket
    'jira-ticket': [
        {
            id: "jira-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Jira Ticket", styles: {} }]
        },
        {
            id: "jira-2",
            type: "paragraph",
            content: [{ type: "text", text: "Ticket ID: ", styles: {} }]
        },
        {
            id: "jira-3",
            type: "paragraph",
            content: [{ type: "text", text: "Type: Bug / Story / Task / Epic", styles: {} }]
        },
        {
            id: "jira-4",
            type: "paragraph",
            content: [{ type: "text", text: "Priority: High / Medium / Low", styles: {} }]
        },
        {
            id: "jira-5",
            type: "paragraph",
            content: [{ type: "text", text: "Status: To Do", styles: {} }]
        },
        {
            id: "jira-6",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-7",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 Summary", styles: {} }]
        },
        {
            id: "jira-8",
            type: "paragraph",
            content: [{ type: "text", text: "Brief, one-line description of the issue or feature.", styles: {} }]
        },
        {
            id: "jira-9",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-10",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📋 Description", styles: {} }]
        },
        {
            id: "jira-11",
            type: "paragraph",
            content: [{ type: "text", text: "Detailed description of the issue, feature request, or task.", styles: {} }]
        },
        {
            id: "jira-12",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-13",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Acceptance Criteria", styles: {} }]
        },
        {
            id: "jira-14",
            type: "paragraph",
            content: [{ type: "text", text: "List of conditions that must be met for this ticket to be considered done.", styles: {} }]
        },
        {
            id: "jira-15",
            type: "bulletListItem",
            content: []
        },
        {
            id: "jira-16",
            type: "bulletListItem",
            content: []
        },
        {
            id: "jira-17",
            type: "bulletListItem",
            content: []
        },
        {
            id: "jira-18",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-19",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔧 Technical Details", styles: {} }]
        },
        {
            id: "jira-20",
            type: "paragraph",
            content: [{ type: "text", text: "Technical implementation notes, architecture decisions, or code references.", styles: {} }]
        },
        {
            id: "jira-21",
            type: "bulletListItem",
            content: []
        },
        {
            id: "jira-22",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-23",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔗 Related Issues", styles: {} }]
        },
        {
            id: "jira-24",
            type: "paragraph",
            content: [{ type: "text", text: "Links to related tickets, PRs, or dependencies.", styles: {} }]
        },
        {
            id: "jira-25",
            type: "bulletListItem",
            content: []
        },
        {
            id: "jira-26",
            type: "paragraph",
            content: []
        },
        {
            id: "jira-27",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📸 Screenshots / Attachments", styles: {} }]
        },
        {
            id: "jira-28",
            type: "paragraph",
            content: [{ type: "text", text: "Visual references, mockups, or relevant files.", styles: {} }]
        },
        {
            id: "jira-29",
            type: "paragraph",
            content: []
        }
    ],

    // 5️⃣ Bug Report
    'bug-report': [
        {
            id: "bug-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Bug Report", styles: {} }]
        },
        {
            id: "bug-2",
            type: "paragraph",
            content: [{ type: "text", text: "Severity: Critical / High / Medium / Low", styles: {} }]
        },
        {
            id: "bug-3",
            type: "paragraph",
            content: [{ type: "text", text: "Priority: ", styles: {} }]
        },
        {
            id: "bug-4",
            type: "paragraph",
            content: [{ type: "text", text: "Status: Open", styles: {} }]
        },
        {
            id: "bug-5",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🐛 Summary", styles: {} }]
        },
        {
            id: "bug-7",
            type: "paragraph",
            content: [{ type: "text", text: "Brief description of the bug.", styles: {} }]
        },
        {
            id: "bug-8",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🌍 Environment", styles: {} }]
        },
        {
            id: "bug-10",
            type: "paragraph",
            content: [{ type: "text", text: "Browser: ", styles: {} }]
        },
        {
            id: "bug-11",
            type: "paragraph",
            content: [{ type: "text", text: "OS: ", styles: {} }]
        },
        {
            id: "bug-12",
            type: "paragraph",
            content: [{ type: "text", text: "Version: ", styles: {} }]
        },
        {
            id: "bug-13",
            type: "paragraph",
            content: [{ type: "text", text: "Device: ", styles: {} }]
        },
        {
            id: "bug-14",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-15",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 Steps to Reproduce", styles: {} }]
        },
        {
            id: "bug-16",
            type: "paragraph",
            content: [{ type: "text", text: "Detailed steps to reproduce the bug.", styles: {} }]
        },
        {
            id: "bug-17",
            type: "numberedListItem",
            content: []
        },
        {
            id: "bug-18",
            type: "numberedListItem",
            content: []
        },
        {
            id: "bug-19",
            type: "numberedListItem",
            content: []
        },
        {
            id: "bug-20",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-21",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Expected Behavior", styles: {} }]
        },
        {
            id: "bug-22",
            type: "paragraph",
            content: [{ type: "text", text: "What should happen?", styles: {} }]
        },
        {
            id: "bug-23",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-24",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "❌ Actual Behavior", styles: {} }]
        },
        {
            id: "bug-25",
            type: "paragraph",
            content: [{ type: "text", text: "What actually happens?", styles: {} }]
        },
        {
            id: "bug-26",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-27",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📸 Screenshots / Logs", styles: {} }]
        },
        {
            id: "bug-28",
            type: "paragraph",
            content: [{ type: "text", text: "Visual evidence, error messages, or console logs.", styles: {} }]
        },
        {
            id: "bug-29",
            type: "paragraph",
            content: []
        },
        {
            id: "bug-30",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "💡 Additional Context", styles: {} }]
        },
        {
            id: "bug-31",
            type: "paragraph",
            content: [{ type: "text", text: "Any other relevant information.", styles: {} }]
        },
        {
            id: "bug-32",
            type: "paragraph",
            content: []
        }
    ],

    // 6️⃣ Pull Request
    'pull-request': [
        {
            id: "pr-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Pull Request", styles: {} }]
        },
        {
            id: "pr-2",
            type: "paragraph",
            content: [{ type: "text", text: "PR #: ", styles: {} }]
        },
        {
            id: "pr-3",
            type: "paragraph",
            content: [{ type: "text", text: "Branch: ", styles: {} }]
        },
        {
            id: "pr-4",
            type: "paragraph",
            content: [{ type: "text", text: "Status: Draft / Ready for Review", styles: {} }]
        },
        {
            id: "pr-5",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 Description", styles: {} }]
        },
        {
            id: "pr-7",
            type: "paragraph",
            content: [{ type: "text", text: "What does this PR do? Why is it needed?", styles: {} }]
        },
        {
            id: "pr-8",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔧 Changes Made", styles: {} }]
        },
        {
            id: "pr-10",
            type: "paragraph",
            content: [{ type: "text", text: "List of key changes in this PR.", styles: {} }]
        },
        {
            id: "pr-11",
            type: "bulletListItem",
            content: []
        },
        {
            id: "pr-12",
            type: "bulletListItem",
            content: []
        },
        {
            id: "pr-13",
            type: "bulletListItem",
            content: []
        },
        {
            id: "pr-14",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-15",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🧪 Testing", styles: {} }]
        },
        {
            id: "pr-16",
            type: "paragraph",
            content: [{ type: "text", text: "How was this tested? What test cases were covered?", styles: {} }]
        },
        {
            id: "pr-17",
            type: "bulletListItem",
            content: []
        },
        {
            id: "pr-18",
            type: "bulletListItem",
            content: []
        },
        {
            id: "pr-19",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-20",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Checklist", styles: {} }]
        },
        {
            id: "pr-21",
            type: "bulletListItem",
            content: [{ type: "text", text: "Code follows style guidelines", styles: {} }]
        },
        {
            id: "pr-22",
            type: "bulletListItem",
            content: [{ type: "text", text: "Self-review completed", styles: {} }]
        },
        {
            id: "pr-23",
            type: "bulletListItem",
            content: [{ type: "text", text: "Comments added for complex logic", styles: {} }]
        },
        {
            id: "pr-24",
            type: "bulletListItem",
            content: [{ type: "text", text: "Documentation updated", styles: {} }]
        },
        {
            id: "pr-25",
            type: "bulletListItem",
            content: [{ type: "text", text: "No new warnings generated", styles: {} }]
        },
        {
            id: "pr-26",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-27",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔗 Related Issues", styles: {} }]
        },
        {
            id: "pr-28",
            type: "paragraph",
            content: [{ type: "text", text: "Closes #", styles: {} }]
        },
        {
            id: "pr-29",
            type: "paragraph",
            content: [{ type: "text", text: "Related to #", styles: {} }]
        },
        {
            id: "pr-30",
            type: "paragraph",
            content: []
        },
        {
            id: "pr-31",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📸 Screenshots", styles: {} }]
        },
        {
            id: "pr-32",
            type: "paragraph",
            content: [{ type: "text", text: "Before/after screenshots if UI changes.", styles: {} }]
        },
        {
            id: "pr-33",
            type: "paragraph",
            content: []
        }
    ],

    // 7️⃣ Technical Design Doc
    'technical-design': [
        {
            id: "design-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Technical Design Document", styles: {} }]
        },
        {
            id: "design-2",
            type: "paragraph",
            content: [{ type: "text", text: "Feature: ", styles: {} }]
        },
        {
            id: "design-3",
            type: "paragraph",
            content: [{ type: "text", text: "Author: ", styles: {} }]
        },
        {
            id: "design-4",
            type: "paragraph",
            content: [{ type: "text", text: `Date: ${new Date().toLocaleDateString()}`, styles: { bold: true } }]
        },
        {
            id: "design-5",
            type: "paragraph",
            content: []
        },
        {
            id: "design-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📋 Overview", styles: {} }]
        },
        {
            id: "design-7",
            type: "paragraph",
            content: [{ type: "text", text: "High-level overview of the feature and its goals.", styles: {} }]
        },
        {
            id: "design-8",
            type: "paragraph",
            content: []
        },
        {
            id: "design-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🏗️ Architecture", styles: {} }]
        },
        {
            id: "design-10",
            type: "paragraph",
            content: [{ type: "text", text: "System architecture and component interactions.", styles: {} }]
        },
        {
            id: "design-11",
            type: "paragraph",
            content: []
        },
        {
            id: "design-12",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "💾 Data Model", styles: {} }]
        },
        {
            id: "design-13",
            type: "paragraph",
            content: [{ type: "text", text: "Database schema, data structures, and relationships.", styles: {} }]
        },
        {
            id: "design-14",
            type: "paragraph",
            content: []
        },
        {
            id: "design-15",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔌 API Design", styles: {} }]
        },
        {
            id: "design-16",
            type: "paragraph",
            content: [{ type: "text", text: "Endpoints, request/response formats, and API contracts.", styles: {} }]
        },
        {
            id: "design-17",
            type: "bulletListItem",
            content: []
        },
        {
            id: "design-18",
            type: "paragraph",
            content: []
        },
        {
            id: "design-19",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "⚡ Implementation Approach", styles: {} }]
        },
        {
            id: "design-20",
            type: "paragraph",
            content: [{ type: "text", text: "Step-by-step implementation plan and key decisions.", styles: {} }]
        },
        {
            id: "design-21",
            type: "bulletListItem",
            content: []
        },
        {
            id: "design-22",
            type: "bulletListItem",
            content: []
        },
        {
            id: "design-23",
            type: "paragraph",
            content: []
        },
        {
            id: "design-24",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔒 Security Considerations", styles: {} }]
        },
        {
            id: "design-25",
            type: "paragraph",
            content: [{ type: "text", text: "Security implications and mitigation strategies.", styles: {} }]
        },
        {
            id: "design-26",
            type: "bulletListItem",
            content: []
        },
        {
            id: "design-27",
            type: "paragraph",
            content: []
        },
        {
            id: "design-28",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "⚖️ Trade-offs", styles: {} }]
        },
        {
            id: "design-29",
            type: "paragraph",
            content: [{ type: "text", text: "Alternatives considered and why this approach was chosen.", styles: {} }]
        },
        {
            id: "design-30",
            type: "bulletListItem",
            content: []
        },
        {
            id: "design-31",
            type: "paragraph",
            content: []
        },
        {
            id: "design-32",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📊 Performance Impact", styles: {} }]
        },
        {
            id: "design-33",
            type: "paragraph",
            content: [{ type: "text", text: "Expected performance implications and optimization strategies.", styles: {} }]
        },
        {
            id: "design-34",
            type: "paragraph",
            content: []
        }
    ],

    // 8️⃣ Code Review
    'code-review': [
        {
            id: "review-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Code Review", styles: {} }]
        },
        {
            id: "review-2",
            type: "paragraph",
            content: [{ type: "text", text: "PR #: ", styles: {} }]
        },
        {
            id: "review-3",
            type: "paragraph",
            content: [{ type: "text", text: "Reviewer: ", styles: {} }]
        },
        {
            id: "review-4",
            type: "paragraph",
            content: [{ type: "text", text: `Date: ${new Date().toLocaleDateString()}`, styles: { bold: true } }]
        },
        {
            id: "review-5",
            type: "paragraph",
            content: [{ type: "text", text: "Status: Approved / Changes Requested / Comment", styles: {} }]
        },
        {
            id: "review-6",
            type: "paragraph",
            content: []
        },
        {
            id: "review-7",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Positive Feedback", styles: {} }]
        },
        {
            id: "review-8",
            type: "paragraph",
            content: [{ type: "text", text: "What was done well?", styles: {} }]
        },
        {
            id: "review-9",
            type: "bulletListItem",
            content: []
        },
        {
            id: "review-10",
            type: "bulletListItem",
            content: []
        },
        {
            id: "review-11",
            type: "paragraph",
            content: []
        },
        {
            id: "review-12",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔧 Suggestions", styles: {} }]
        },
        {
            id: "review-13",
            type: "paragraph",
            content: [{ type: "text", text: "Improvements and recommendations.", styles: {} }]
        },
        {
            id: "review-14",
            type: "bulletListItem",
            content: [{ type: "text", text: "File: line - suggestion", styles: {} }]
        },
        {
            id: "review-15",
            type: "bulletListItem",
            content: []
        },
        {
            id: "review-16",
            type: "paragraph",
            content: []
        },
        {
            id: "review-17",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "⚠️ Concerns", styles: {} }]
        },
        {
            id: "review-18",
            type: "paragraph",
            content: [{ type: "text", text: "Potential issues or risks that need attention.", styles: {} }]
        },
        {
            id: "review-19",
            type: "bulletListItem",
            content: []
        },
        {
            id: "review-20",
            type: "paragraph",
            content: []
        },
        {
            id: "review-21",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 General Comments", styles: {} }]
        },
        {
            id: "review-22",
            type: "paragraph",
            content: [{ type: "text", text: "Overall thoughts and additional context.", styles: {} }]
        },
        {
            id: "review-23",
            type: "paragraph",
            content: []
        }
    ],

    // 9️⃣ Deployment Plan
    'deployment-plan': [
        {
            id: "deploy-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Deployment Plan", styles: {} }]
        },
        {
            id: "deploy-2",
            type: "paragraph",
            content: [{ type: "text", text: "Version: ", styles: {} }]
        },
        {
            id: "deploy-3",
            type: "paragraph",
            content: [{ type: "text", text: "Environment: Production / Staging", styles: {} }]
        },
        {
            id: "deploy-4",
            type: "paragraph",
            content: [{ type: "text", text: "Scheduled Date: ", styles: {} }]
        },
        {
            id: "deploy-5",
            type: "paragraph",
            content: []
        },
        {
            id: "deploy-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📦 Deployment Checklist", styles: {} }]
        },
        {
            id: "deploy-7",
            type: "bulletListItem",
            content: [{ type: "text", text: "All tests passing", styles: {} }]
        },
        {
            id: "deploy-8",
            type: "bulletListItem",
            content: [{ type: "text", text: "Code review approved", styles: {} }]
        },
        {
            id: "deploy-9",
            type: "bulletListItem",
            content: [{ type: "text", text: "Database migrations prepared", styles: {} }]
        },
        {
            id: "deploy-10",
            type: "bulletListItem",
            content: [{ type: "text", text: "Environment variables updated", styles: {} }]
        },
        {
            id: "deploy-11",
            type: "bulletListItem",
            content: [{ type: "text", text: "Backup created", styles: {} }]
        },
        {
            id: "deploy-12",
            type: "paragraph",
            content: []
        },
        {
            id: "deploy-13",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🚀 Deployment Steps", styles: {} }]
        },
        {
            id: "deploy-14",
            type: "paragraph",
            content: [{ type: "text", text: "Step-by-step deployment procedure.", styles: {} }]
        },
        {
            id: "deploy-15",
            type: "numberedListItem",
            content: []
        },
        {
            id: "deploy-16",
            type: "numberedListItem",
            content: []
        },
        {
            id: "deploy-17",
            type: "numberedListItem",
            content: []
        },
        {
            id: "deploy-18",
            type: "paragraph",
            content: []
        },
        {
            id: "deploy-19",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Post-Deployment Checks", styles: {} }]
        },
        {
            id: "deploy-20",
            type: "paragraph",
            content: [{ type: "text", text: "Verification steps after deployment.", styles: {} }]
        },
        {
            id: "deploy-21",
            type: "bulletListItem",
            content: []
        },
        {
            id: "deploy-22",
            type: "bulletListItem",
            content: []
        },
        {
            id: "deploy-23",
            type: "paragraph",
            content: []
        },
        {
            id: "deploy-24",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "↩️ Rollback Plan", styles: {} }]
        },
        {
            id: "deploy-25",
            type: "paragraph",
            content: [{ type: "text", text: "Steps to rollback if issues occur.", styles: {} }]
        },
        {
            id: "deploy-26",
            type: "numberedListItem",
            content: []
        },
        {
            id: "deploy-27",
            type: "numberedListItem",
            content: []
        },
        {
            id: "deploy-28",
            type: "paragraph",
            content: []
        },
        {
            id: "deploy-29",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "👥 Team Contacts", styles: {} }]
        },
        {
            id: "deploy-30",
            type: "paragraph",
            content: [{ type: "text", text: "On-call engineer: ", styles: {} }]
        },
        {
            id: "deploy-31",
            type: "paragraph",
            content: [{ type: "text", text: "Backup contact: ", styles: {} }]
        },
        {
            id: "deploy-32",
            type: "paragraph",
            content: []
        }
    ],

    // 🔟 Database Schema
    'database-schema': [
        {
            id: "db-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Database Schema", styles: {} }]
        },
        {
            id: "db-2",
            type: "paragraph",
            content: [{ type: "text", text: "Database: ", styles: {} }]
        },
        {
            id: "db-3",
            type: "paragraph",
            content: [{ type: "text", text: "Version: ", styles: {} }]
        },
        {
            id: "db-4",
            type: "paragraph",
            content: []
        },
        {
            id: "db-5",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📊 Tables", styles: {} }]
        },
        {
            id: "db-6",
            type: "paragraph",
            content: []
        },
        {
            id: "db-7",
            type: "heading",
            props: { level: 3 },
            content: [{ type: "text", text: "table_name", styles: {} }]
        },
        {
            id: "db-8",
            type: "paragraph",
            content: [{ type: "text", text: "Description: ", styles: {} }]
        },
        {
            id: "db-9",
            type: "paragraph",
            content: []
        },
        {
            id: "db-10",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Columns", styles: {} }]
        },
        {
            id: "db-11",
            type: "bulletListItem",
            content: [{ type: "text", text: "id: INTEGER (Primary Key)", styles: {} }]
        },
        {
            id: "db-12",
            type: "bulletListItem",
            content: [{ type: "text", text: "name: VARCHAR(255)", styles: {} }]
        },
        {
            id: "db-13",
            type: "bulletListItem",
            content: [{ type: "text", text: "created_at: TIMESTAMP", styles: {} }]
        },
        {
            id: "db-14",
            type: "paragraph",
            content: []
        },
        {
            id: "db-15",
            type: "heading",
            props: { level: 4 },
            content: [{ type: "text", text: "Indexes", styles: {} }]
        },
        {
            id: "db-16",
            type: "bulletListItem",
            content: []
        },
        {
            id: "db-17",
            type: "paragraph",
            content: []
        },
        {
            id: "db-18",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔗 Relationships", styles: {} }]
        },
        {
            id: "db-19",
            type: "paragraph",
            content: [{ type: "text", text: "Foreign keys and table relationships.", styles: {} }]
        },
        {
            id: "db-20",
            type: "bulletListItem",
            content: []
        },
        {
            id: "db-21",
            type: "paragraph",
            content: []
        },
        {
            id: "db-22",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🔄 Migrations", styles: {} }]
        },
        {
            id: "db-23",
            type: "paragraph",
            content: [{ type: "text", text: "Migration history and pending migrations.", styles: {} }]
        },
        {
            id: "db-24",
            type: "bulletListItem",
            content: []
        },
        {
            id: "db-25",
            type: "paragraph",
            content: []
        }
    ],

    // 1️⃣1️⃣ Daily Standup
    'daily-standup': [
        {
            id: "standup-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Daily Standup", styles: {} }]
        },
        {
            id: "standup-2",
            type: "paragraph",
            content: [{ type: "text", text: `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, styles: { bold: true } }]
        },
        {
            id: "standup-3",
            type: "paragraph",
            content: []
        },
        {
            id: "standup-4",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Yesterday", styles: {} }]
        },
        {
            id: "standup-5",
            type: "paragraph",
            content: [{ type: "text", text: "What did I accomplish yesterday?", styles: {} }]
        },
        {
            id: "standup-6",
            type: "bulletListItem",
            content: []
        },
        {
            id: "standup-7",
            type: "bulletListItem",
            content: []
        },
        {
            id: "standup-8",
            type: "paragraph",
            content: []
        },
        {
            id: "standup-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🎯 Today", styles: {} }]
        },
        {
            id: "standup-10",
            type: "paragraph",
            content: [{ type: "text", text: "What will I work on today?", styles: {} }]
        },
        {
            id: "standup-11",
            type: "bulletListItem",
            content: []
        },
        {
            id: "standup-12",
            type: "bulletListItem",
            content: []
        },
        {
            id: "standup-13",
            type: "paragraph",
            content: []
        },
        {
            id: "standup-14",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🚧 Blockers", styles: {} }]
        },
        {
            id: "standup-15",
            type: "paragraph",
            content: [{ type: "text", text: "Any impediments or blockers?", styles: {} }]
        },
        {
            id: "standup-16",
            type: "bulletListItem",
            content: [{ type: "text", text: "None", styles: {} }]
        },
        {
            id: "standup-17",
            type: "paragraph",
            content: []
        },
        {
            id: "standup-18",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "💡 Notes", styles: {} }]
        },
        {
            id: "standup-19",
            type: "paragraph",
            content: [{ type: "text", text: "Additional context, questions, or follow-ups.", styles: {} }]
        },
        {
            id: "standup-20",
            type: "paragraph",
            content: []
        }
    ],

    // 1️⃣2️⃣ Dev Team Meeting
    'meeting-notes-dev': [
        {
            id: "meeting-1",
            type: "heading",
            props: { level: 1 },
            content: [{ type: "text", text: "Development Team Meeting", styles: {} }]
        },
        {
            id: "meeting-2",
            type: "paragraph",
            content: [{ type: "text", text: `Date: ${new Date().toLocaleDateString()}`, styles: { bold: true } }]
        },
        {
            id: "meeting-3",
            type: "paragraph",
            content: [{ type: "text", text: "Time: ", styles: {} }]
        },
        {
            id: "meeting-4",
            type: "paragraph",
            content: [{ type: "text", text: "Type: Standup / Sprint Planning / Retrospective / Technical Discussion", styles: {} }]
        },
        {
            id: "meeting-5",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-6",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "👥 Attendees", styles: {} }]
        },
        {
            id: "meeting-7",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-8",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-9",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📋 Agenda", styles: {} }]
        },
        {
            id: "meeting-10",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-11",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-12",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-13",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "💻 Technical Discussion", styles: {} }]
        },
        {
            id: "meeting-14",
            type: "paragraph",
            content: [{ type: "text", text: "Architecture decisions, technical challenges, and solutions discussed.", styles: {} }]
        },
        {
            id: "meeting-15",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-16",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-17",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-18",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "✅ Decisions Made", styles: {} }]
        },
        {
            id: "meeting-19",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-20",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-21",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-22",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "🎯 Action Items", styles: {} }]
        },
        {
            id: "meeting-23",
            type: "paragraph",
            content: [{ type: "text", text: "Owner: | Task: | Due Date: ", styles: {} }]
        },
        {
            id: "meeting-24",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-25",
            type: "bulletListItem",
            content: []
        },
        {
            id: "meeting-26",
            type: "paragraph",
            content: []
        },
        {
            id: "meeting-27",
            type: "heading",
            props: { level: 2 },
            content: [{ type: "text", text: "📝 Notes", styles: {} }]
        },
        {
            id: "meeting-28",
            type: "paragraph",
            content: []
        }
    ]
};

// Helper function to get template blocks
export function getTemplateBlocks(templateId: string): PartialBlock[] {
    return TemplateBlockMap[templateId] || TemplateBlockMap.blank;
}

export function blocksToPartialBlocks(blocks: PartialBlock[]): PartialBlock[] {
    return blocks;
}
