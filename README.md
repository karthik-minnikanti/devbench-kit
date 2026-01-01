# DevBench

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-Yes-green.svg)](LICENSE)

A comprehensive desktop application for developers that combines productivity tools, API testing, code execution, and planning features in one unified interface.

**Open Source**: This project is fully open source and available under the MIT License.

## 🚀 Features

### 🏠 Home Dashboard
- Quick access to all tools and features
- Today's tasks overview
- Quick navigation to frequently used tools
- Calendar integration for date selection

### 🌐 API Studio
A powerful Postman-like interface for testing REST APIs with the following features:

- **Request Management**
  - Create, save, and organize API requests in folders
  - Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
  - Custom headers and request body
  - URL parameters support
  - Request history and recent requests

- **Response Handling**
  - Preview, Raw, and Headers view modes
  - JSON pretty-printing
  - HTML rendering in preview mode
  - Response status codes with color-coded badges
  - Copy response functionality
  - Detailed error messages with specific error codes

- **Import/Export**
  - Import cURL commands
  - Import Swagger/Postman collections
  - Individual request file storage for Git sync

- **Search & Organization**
  - Real-time search across requests and responses
  - Folder-based organization
  - Drag and drop support

### 📅 Daily Planner
A comprehensive daily planning and task management tool:

- **Task Management**
  - Create, edit, and delete tasks
  - Task status tracking (Todo, In Progress, Done, Blocked)
  - Priority levels
  - Estimated time tracking
  - Task categories and tags
  - Move tasks to next day
  - Carry forward incomplete tasks

- **Time Blocking**
  - Schedule tasks in time blocks
  - Visual calendar view
  - Drag and drop task scheduling

- **Work Modes**
  - Deep Work
  - Meetings
  - Collaboration
  - Learning
  - Review

- **Analytics & Insights**
  - Task completion statistics
  - Weekly view with task distribution
  - Productivity metrics
  - Habit tracking with streaks
  - Daily reflections

- **Habit Tracking**
  - Create and track daily habits
  - Streak calculation
  - Completion statistics
  - Separate habit storage

- **Week View**
  - Overview of the entire week
  - Task distribution across days
  - Quick navigation between dates

### 💻 JavaScript Runner
- Execute JavaScript code in a sandboxed environment
- Real-time code execution
- Output display
- Support for modern JavaScript features

### 📝 Notes
A rich text editor for taking and organizing notes:

- **Rich Text Editing**
  - BlockNote-based editor with full formatting support
  - Headings, lists, code blocks, quotes
  - Bold, italic, underline
  - Links and images

- **Note Management**
  - Create unlimited notes
  - UUID-based file naming
  - Auto-save functionality
  - Real-time sync with Git
  - Search and filter notes
  - Date-grouped organization

- **Git Integration**
  - Automatic Git sync
  - Pull before push to prevent conflicts
  - Individual file storage
  - Conflict-free editing

### 🎨 Drawing (Excalidraw)
- Create beautiful diagrams and sketches
- Excalidraw integration
- Export diagrams
- Auto-save functionality
- Git sync support

### 📊 UML Editor
Create UML diagrams using Mermaid syntax:

- **Diagram Types**
  - Sequence diagrams
  - Flowcharts
  - Class diagrams
  - State diagrams
  - And more Mermaid diagram types

- **Features**
  - Monaco Editor with syntax highlighting
  - Live preview
  - Export to PNG
  - Theme matching with DevBench
  - Code editor with auto-completion

## 📦 Installation

### macOS
1. Download `DevBench-1.0.0.dmg` (Intel) or `DevBench-1.0.0-arm64.dmg` (Apple Silicon)
2. Open the DMG file
3. Drag DevBench to your Applications folder
4. **Important**: Since the app is not code-signed, you'll need to allow Gatekeeper to install it:
   - Right-click on DevBench in Applications and select "Open"
   - Click "Open" in the security dialog that appears
   - Alternatively, you can run: `xattr -cr /Applications/DevBench.app` in Terminal to remove quarantine attributes
5. Launch DevBench from Applications

### Windows
1. Download `DevBench Setup 1.0.0.exe` for installation
   - Or `DevBench 1.0.0.exe` for portable version
2. Run the installer
3. Follow the installation wizard
4. Launch DevBench from Start Menu or desktop shortcut

### Linux
Choose the appropriate package for your distribution:

**AppImage** (Universal)
- Download `DevBench-1.0.0.AppImage` (x64) or `DevBench-1.0.0-arm64.AppImage` (ARM64)
- Make it executable: `chmod +x DevBench-1.0.0.AppImage`
- Run: `./DevBench-1.0.0.AppImage`

**Debian/Ubuntu (.deb)**
- Download `devbench-desktop_1.0.0_amd64.deb` (x64) or `devbench-desktop_1.0.0_arm64.deb` (ARM64)
- Install: `sudo dpkg -i devbench-desktop_1.0.0_amd64.deb`
- Fix dependencies if needed: `sudo apt-get install -f`

## 🔧 Setup

### Git Integration
DevBench uses Git for data synchronization and version control:

1. On first launch, you'll be prompted to set up a Git repository
2. Choose an existing repository or create a new one
3. All your data (notes, drawings, API requests, planner entries) will be stored in the repository
4. Changes are automatically synced with Git

### Data Storage
All data is stored locally in your Git repository:
- Notes: `notes/` directory
- Drawings: `drawings/` directory
- API Requests: `apiclient/` directory (individual JSON files)
- Planner Entries: `planner/` directory (date-based JSON files)
- Habits: `habits/` directory (separate from planner)

## ⌨️ Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open global search
- `Cmd/Ctrl + /` - Show keyboard shortcuts
- `Cmd/Ctrl + Enter` - Send API request (in API Studio)

## 🛠️ Technology Stack

- **Framework**: Electron 32.0.0
- **Frontend**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 5.0.8
- **Editor**: BlockNote (Notes), Monaco Editor (UML Editor)
- **Diagramming**: Excalidraw, Mermaid.js
- **Styling**: Tailwind CSS

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

Copyright (c) 2025 Karthik Minnikanti

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

- **Author**: Karthik Minnikanti
- **Email**: contact@devbench.in
- **Homepage**: https://devbench.in

## 🔄 Version History

### Version 0.1
- Initial release
- API Studio
- Daily Planner with task management and habit tracking
- JavaScript Runner
- Rich text Notes with Git sync
- Excalidraw integration
- UML Editor with Mermaid support
- Cross-platform support (macOS, Windows, Linux)

---

**Note**: This application requires Git to be installed on your system for data synchronization. Make sure Git is properly configured before using DevBench.

