# ZUI Submodule Setup

This document explains how the ZUI component library is integrated into the Machina project.

## Overview

The `zui` directory is a **Git submodule** pointing to the separate repository at `git@github.com:cypher-agi/zui.git`.

## What is a Git Submodule?

A Git submodule allows you to keep a Git repository as a subdirectory of another Git repository. This lets you:
- Maintain ZUI as a separate, independent repository
- Version ZUI independently from the main Machina project
- Use ZUI in multiple projects
- Track specific commits of ZUI in the main project

## Working with the Submodule

### Cloning the Project

When cloning the Machina project for the first time:

```bash
git clone git@github.com:your-org/machina.git
cd machina
git submodule init
git submodule update
```

Or clone with submodules in one command:

```bash
git clone --recurse-submodules git@github.com:your-org/machina.git
```

### Making Changes to ZUI

When you `cd` into the `zui` directory, you're working in a separate Git repository:

```bash
cd zui
# You're now in the ZUI repository
git status  # Shows ZUI repo status
git remote -v  # Shows git@github.com:cypher-agi/zui.git

# Make changes
git add .
git commit -m "Your changes"
git push

# Return to main repo
cd ..
git add zui  # Update the submodule reference
git commit -m "Update ZUI submodule"
git push
```

### Updating ZUI in the Main Project

To pull the latest changes from the ZUI repository:

```bash
cd zui
git pull origin master
cd ..
git add zui
git commit -m "Update ZUI to latest"
```

Or from the main repo:

```bash
git submodule update --remote zui
git add zui
git commit -m "Update ZUI to latest"
```

## npm Workspace Integration

The client workspace uses ZUI as a local dependency:

```json
{
  "dependencies": {
    "@cypher-agi/zui": "file:../zui"
  }
}
```

The Vite config has an alias for easy imports:

```typescript
resolve: {
  alias: {
    '@machina/zui': path.resolve(__dirname, '../zui/src'),
    '@cypher-agi/zui': path.resolve(__dirname, '../zui/src'),
  },
}
```

## Usage in Client Code

Import ZUI components in your React code:

```typescript
import { Button, Card, Modal } from '@machina/zui';
import '@machina/zui/styles';
```

## ZUI Development

The ZUI repository includes:
- `src/` - Component library source code
- `inspector/` - Component playground/inspector app
- `docs-site/` - Documentation site

To work on ZUI components:

```bash
cd zui
npm install
npm run dev:inspector  # Run the component inspector
npm run dev:docs       # Run the documentation site
npm test              # Run tests
```

## Benefits of This Setup

1. **Independent Versioning**: ZUI can be versioned and released independently
2. **Reusability**: ZUI can be used in other projects
3. **Clear Separation**: UI library development is separate from application development
4. **Git History**: Each repository maintains its own clean git history
5. **Team Collaboration**: Different teams can work on ZUI and Machina independently

## Important Notes

- The `zui` directory is **not** part of the main repository's git tracking
- Changes in `zui` must be committed to the ZUI repository
- The main repository only tracks which commit of ZUI it's using
- Always run `npm install` after updating the submodule to sync dependencies
