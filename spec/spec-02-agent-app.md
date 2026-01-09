# SPEC-02: Agents App

> **Version:** 1.0  
> **Status:** Draft  
> **Last Updated:** January 2026  
> **Phase:** Frontend Only (Backend as separate microservice later)

## 1. Overview

The **Agents App** introduces autonomous AI agents that can be deployed, managed, and monitored within Machina. Agents live within **Swarms** (isolated environments with distinct URLs, ports, and access restrictions). Each agent has a unique identity (ZID - Zero ID), reasoning capabilities, tool access, wallet integration, and personality configuration.

### 1.1 Core Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | An autonomous AI entity with reasoning, tools, and identity |
| **Swarm** | An isolated environment where agents operate (has URL, port, access rules) |
| **ZID (Zero ID)** | Unique identifier for an agent within the system |
| **Reasoning Model** | The LLM powering the agent (Claude, GPT-4, etc.) |
| **Wallet** | Blockchain wallet for agent transactions (EVM, Solana, Bitcoin) |

### 1.2 Key Features

- Create agents via a wizard-based deployment flow
- Assign agents to swarms
- Configure reasoning models, tools, wallets, and credentials
- Define agent personality and backstory
- Monitor agent conversations in real-time
- Access agent terminal for direct command/process viewing
- View transaction records

---

## 2. Data Model

### 2.1 Agent Entity

```typescript
// Agent status throughout lifecycle
export type AgentStatus =
  | 'pending'      // Created but not started
  | 'starting'     // Initializing
  | 'running'      // Active and processing
  | 'paused'       // Temporarily suspended
  | 'stopping'     // Shutting down
  | 'stopped'      // Not running
  | 'error';       // Failed state

// Wallet chain types
export type WalletChain = 'evm' | 'solana' | 'bitcoin';

// Reasoning model providers
export type ReasoningProvider = 'anthropic' | 'openai' | 'google' | 'local';

// Agent expertise types
export type AgentExpertise =
  | 'developer'       // Software development
  | 'code_reviewer'   // Code review and quality
  | 'architect'       // System architecture
  | 'devops'          // DevOps and infrastructure
  | 'security'        // Security analysis
  | 'data_engineer'   // Data pipelines and ETL
  | 'ml_engineer'     // Machine learning
  | 'designer'        // UI/UX design
  | 'product_manager' // Product management
  | 'qa_engineer'     // Quality assurance
  | 'technical_writer'// Documentation
  | 'generalist';     // General purpose

export interface Agent {
  agent_id: string;
  team_id: string;
  
  // Identity
  name: string;
  zid: string;                    // Zero ID - unique identifier
  swarm_id: string;               // Swarm this agent belongs to
  
  // Status
  status: AgentStatus;
  
  // Reasoning
  ai_provider_account_id: string; // Reference to stored AI provider credentials
  reasoning_model: string;        // e.g., 'claude-3-5-sonnet-20241022'
  expertise: AgentExpertise;      // Agent's area of expertise
  
  // Tools & Access
  enabled_tools: string[];        // Tool IDs
  tool_permissions: Record<string, ToolPermission>;
  
  // Wallet
  wallet_chain?: WalletChain;
  wallet_address?: string;
  
  // Credentials
  ssh_key_id?: string;            // SSH key for secure operations
  
  // Personality
  personality: AgentPersonality;
  
  // Stats
  total_conversations: number;
  total_transactions: number;
  last_active_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AgentPersonality {
  display_name: string;           // How the agent introduces itself
  backstory: string;              // Agent's background/purpose narrative
  system_prompt?: string;         // Additional system instructions
  traits: string[];               // Personality traits (e.g., 'analytical', 'helpful')
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  avatar_url?: string;
}

export interface ToolPermission {
  tool_id: string;
  enabled: boolean;
  restrictions?: Record<string, unknown>;
}
```

### 2.2 Swarm Entity

```typescript
export type SwarmStatus = 'active' | 'maintenance' | 'offline';

export interface Swarm {
  swarm_id: string;
  team_id?: string;               // null for system swarms
  
  // Identity
  name: string;
  description?: string;
  
  // Network
  url: string;                    // Base URL for swarm
  port: number;
  
  // Access
  access_level: 'public' | 'team' | 'private';
  allowed_team_ids?: string[];    // For 'team' access level
  
  // Status
  status: SwarmStatus;
  
  // Stats
  agent_count: number;
  max_agents?: number;            // Capacity limit
  
  // Configuration
  config?: SwarmConfig;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Flags
  is_system_swarm: boolean;       // Read-only system swarm
}

export interface SwarmConfig {
  default_reasoning_model?: string;
  allowed_models?: string[];
  rate_limits?: RateLimitConfig;
}
```

### 2.3 Agent Conversation

```typescript
export type MessageRole = 'user' | 'agent' | 'system' | 'tool';

export interface AgentConversation {
  conversation_id: string;
  agent_id: string;
  team_id: string;
  
  // Metadata
  title?: string;
  started_at: string;
  last_message_at: string;
  
  // Stats
  message_count: number;
  tool_calls_count: number;
}

export interface AgentMessage {
  message_id: string;
  conversation_id: string;
  
  role: MessageRole;
  content: string;
  
  // Tool-related
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  
  // Timestamps
  created_at: string;
}
```

### 2.4 Agent Transaction

```typescript
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface AgentTransaction {
  transaction_id: string;
  agent_id: string;
  team_id: string;
  
  // Chain info
  chain: WalletChain;
  tx_hash?: string;
  
  // Transaction details
  type: string;                   // e.g., 'transfer', 'swap', 'contract_call'
  amount?: string;
  token?: string;
  from_address: string;
  to_address?: string;
  
  // Status
  status: TransactionStatus;
  error_message?: string;
  
  // Timestamps
  created_at: string;
  confirmed_at?: string;
}
```

### 2.5 Available Tools Registry

```typescript
export interface AgentTool {
  tool_id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'network' | 'blockchain' | 'code' | 'communication' | 'custom';
  icon: string;                   // Lucide icon name
  requires_credentials: boolean;
  parameters_schema?: Record<string, unknown>;
}
```

### 2.6 AI Provider Account

Stores API keys for AI providers, similar to `ProviderAccount` for cloud providers.

```typescript
export type AICredentialStatus = 'valid' | 'invalid' | 'expired' | 'unchecked';

export interface AIProviderAccount {
  ai_provider_account_id: string;
  team_id: string;
  
  // Provider info
  provider: ReasoningProvider;
  label: string;                  // User-friendly name (e.g., "Production Anthropic")
  
  // Credential status
  credential_status: AICredentialStatus;
  last_verified_at?: string;
  
  // Usage tracking
  usage_this_month?: number;      // Token count or cost
  usage_limit?: number;           // Optional spending limit
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface AIProviderAccountCreateRequest {
  provider: ReasoningProvider;
  label: string;
  credentials: AIProviderCredentials;
}

export type AIProviderCredentials =
  | AnthropicCredentials
  | OpenAICredentials
  | GoogleAICredentials
  | LocalCredentials;

export interface AnthropicCredentials {
  type: 'anthropic';
  api_key: string;
}

export interface OpenAICredentials {
  type: 'openai';
  api_key: string;
  organization_id?: string;       // Optional org ID
}

export interface GoogleAICredentials {
  type: 'google';
  api_key: string;
  project_id?: string;
}

export interface LocalCredentials {
  type: 'local';
  endpoint_url: string;           // e.g., http://localhost:11434
  model_name?: string;            // e.g., llama2
}
```

### 2.7 Reasoning Model Options

```typescript
export interface ReasoningModel {
  model_id: string;
  provider: ReasoningProvider;
  name: string;
  description?: string;
  context_window: number;
  max_output_tokens: number;
  supports_tools: boolean;
  supports_vision: boolean;
  pricing_tier: 'free' | 'standard' | 'premium';
}
```

---

## 3. Wizard Flow (Create Agent)

The wizard follows the same pattern as `DeployWizard` from the Machines app.

### 3.1 Wizard Steps

| Step | ID | Icon | Description |
|------|----|------|-------------|
| 1 | `identity` | Bot | Name, ZID, and Swarm selection |
| 2 | `reasoning` | Brain | Reasoning model selection |
| 3 | `tools` | Wrench | Tools and access permissions |
| 4 | `wallet` | Wallet | Blockchain wallet configuration |
| 5 | `credentials` | Key | SSH key and credential binding |
| 6 | `personality` | Sparkles | Personality and backstory |
| 7 | `review` | FileText | Review and deploy |

### 3.2 Step Details

#### Step 1: Identity (`identity`)

**Fields:**
- `name` (required): Agent display name
- `zid` (required): Zero ID - unique identifier, auto-generated but editable
- `swarm_id` (required): Dropdown of available swarms

**Validation:**
- Name: 3-50 characters, alphanumeric with spaces
- ZID: Unique, 8-32 characters, lowercase alphanumeric with hyphens
- Swarm: Must be selected from available swarms

**UI Elements:**
- Input for name
- Input for ZID with auto-generate button
- Swarm selector showing: name, status, agent count, URL

#### Step 2: Reasoning (`reasoning`)

**Fields:**
- `ai_provider_account_id` (required): Select from configured AI provider accounts
- `reasoning_model` (required): Model selection based on selected provider account
- `expertise` (required): Agent expertise type

**AI Provider Account Selection:**

Similar to how Machines select cloud provider accounts, Agents select from configured AI provider accounts. Each account stores encrypted API keys.

**Empty State:**
If no AI provider accounts are configured, show an empty state with:
- Icon: `BrainCog`
- Message: "No AI providers configured"
- Description: "Add an AI provider account to power your agents"
- CTA: Link to add AI provider (see Section 4.5)

**Account Card Display:**
```
┌─────────────────────────────────────────────────────────────────┐
│  [AN]  Production Anthropic                    [valid] ✓       │
│        anthropic · Last verified 2h ago                        │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  [OA]  OpenAI Team                             [valid] ✓       │
│        openai · Last verified 1d ago                           │
└─────────────────────────────────────────────────────────────────┘
```

**Model Selection (after account selected):**

| Provider | Model | Context | Tools |
|----------|-------|---------|-------|
| Anthropic | claude-3-5-sonnet-20241022 | 200K | ✓ |
| Anthropic | claude-3-opus-20240229 | 200K | ✓ |
| Anthropic | claude-3-haiku-20240307 | 200K | ✓ |
| OpenAI | gpt-4o | 128K | ✓ |
| OpenAI | gpt-4-turbo | 128K | ✓ |
| Google | gemini-1.5-pro | 1M | ✓ |
| Local | ollama/llama2 | 4K | ✗ |

**Available Expertise Types:**

| Expertise | Label | Description |
|-----------|-------|-------------|
| `developer` | Developer | Software development and coding |
| `code_reviewer` | Code Reviewer | Code review, best practices, quality |
| `architect` | Architect | System design and architecture |
| `devops` | DevOps Engineer | CI/CD, infrastructure, deployment |
| `security` | Security Analyst | Security review and vulnerability analysis |
| `data_engineer` | Data Engineer | Data pipelines, ETL, databases |
| `ml_engineer` | ML Engineer | Machine learning and AI systems |
| `designer` | Designer | UI/UX design and user experience |
| `product_manager` | Product Manager | Product strategy and requirements |
| `qa_engineer` | QA Engineer | Testing and quality assurance |
| `technical_writer` | Technical Writer | Documentation and technical writing |
| `generalist` | Generalist | General purpose assistant |

**UI Elements:**
- AI Provider account cards (selectable, shows label, provider type, credential status)
- Model grid showing: name, context window, features, pricing tier (filtered by selected provider)
- Expertise dropdown with icon and description for each type

#### Step 3: Tools & Access (`tools`)

**Fields:**
- `enabled_tools`: Multi-select of available tools
- `tool_permissions`: Per-tool permission configuration

**Available Tools (categories):**

| Category | Tools |
|----------|-------|
| Filesystem | read_file, write_file, list_directory, search_files |
| Network | http_request, dns_lookup, port_scan |
| Blockchain | send_transaction, read_contract, deploy_contract |
| Code | execute_code, git_operations, npm_commands |
| Communication | send_email, slack_message, webhook_call |

**UI Elements:**
- Tool categories as collapsible sections
- Checkbox for each tool with description
- Permission toggle for each enabled tool

#### Step 4: Wallet (`wallet`)

**Fields:**
- `wallet_chain` (optional): EVM, Solana, or Bitcoin
- `wallet_address` (optional): Existing wallet or generate new

**Options:**
1. **No Wallet** - Agent operates without blockchain capabilities
2. **EVM** - Ethereum-compatible chains (ETH, Polygon, Arbitrum, etc.)
3. **Solana** - Solana blockchain
4. **Bitcoin** - Bitcoin network

**UI Elements:**
- Chain selection cards with icons
- Option to generate new wallet or import existing
- Address display with copy button

#### Step 5: Credentials (`credentials`)

**Fields:**
- `ssh_key_id` (optional): SSH key binding for secure operations

**UI Elements:**
- SSH key selector (same pattern as Machine deploy wizard)
- Link to Keys page if no keys available
- Key details: name, type, fingerprint

#### Step 6: Personality (`personality`)

**Fields:**
- `display_name` (required): How agent introduces itself
- `backstory` (required): Narrative text (markdown supported)
- `traits` (optional): Multi-select tags
- `tone` (required): Communication style dropdown
- `avatar_url` (optional): Avatar image URL

**Available Traits:**
`analytical`, `creative`, `helpful`, `precise`, `patient`, `curious`, `friendly`, `professional`, `technical`, `concise`

**Tone Options:**
`professional`, `casual`, `friendly`, `formal`

**UI Elements:**
- Input for display name
- Textarea for backstory with character count
- Tag selector for traits
- Dropdown for tone
- Avatar preview with URL input

#### Step 7: Review (`review`)

Displays all configured values in a review card format:
- Identity section: Name, ZID, Swarm
- Reasoning section: AI Provider Account, Model, Expertise
- Tools section: List of enabled tools
- Wallet section: Chain, Address
- Credentials section: SSH Key
- Personality section: Display name, Traits, Tone

---

## 4. Main List View

The `AgentsApp` follows the same layout pattern as `MachinesApp`.

### 4.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  PageLayout                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Header: "Agents" [count]         [Search] [Filter] [+ New]  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Filters Panel (when open)                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Agent Cards List                                            ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │ AgentCard (selectable)                                  │││
│  │  │ - Icon/Avatar, Name, ZID                                │││
│  │  │ - Status badge, Swarm name                              │││
│  │  │ - Model, Last active                                    │││
│  │  └─────────────────────────────────────────────────────────┘││
│  │  ...                                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Terminal Panel (when agent selected)                        ││
│  │ - Agent process logs                                        ││
│  │ - Transaction record feed                                   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 AgentCard Component

Displays:
- Agent avatar or icon placeholder
- Name and ZID
- Status badge (running, stopped, error, etc.)
- Swarm name
- Reasoning model (abbreviated)
- Last active timestamp
- Quick action buttons (start/stop, terminal)

### 4.3 Filters

| Filter | Type | Options |
|--------|------|---------|
| Status | Multi-select | pending, running, paused, stopped, error |
| Swarm | Multi-select | Available swarms |
| Provider | Multi-select | anthropic, openai, google, local |
| Has Wallet | Boolean | Yes/No |

### 4.4 Actions

- **Search**: Filter by name, ZID
- **Filter**: Open filter panel
- **+ New Agent**: Open create wizard
- **Refresh**: Refresh agent list

### 4.5 AI Provider Account Management

AI provider accounts (API keys) can be managed from within the Agents app. A secondary action in the header provides access.

**Header Actions:**
```
[Search] [Filter] [⚙️ AI Providers] [+ New Agent]
```

**AI Providers Modal:**

Opens a modal similar to how Providers app works, but for AI providers.

```
┌─────────────────────────────────────────────────────────────────┐
│  AI Provider Accounts                              [+ Add]  [X] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [AN]  Production Anthropic              [valid] ✓          │││
│  │       anthropic · Created Dec 15, 2025                     │││
│  │       [Verify] [Edit] [Delete]                             │││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [OA]  OpenAI Team                       [unchecked] ?      │││
│  │       openai · Created Jan 5, 2026                         │││
│  │       [Verify] [Edit] [Delete]                             │││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [LO]  Local Ollama                      [valid] ✓          │││
│  │       local · http://localhost:11434                       │││
│  │       [Verify] [Edit] [Delete]                             │││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Add AI Provider Modal:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Add AI Provider                                            [X] │
├─────────────────────────────────────────────────────────────────┤
│  Select Provider                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │  [Anthropic] │ │   [OpenAI]   │ │   [Google]   │            │
│  │      AN      │ │      OA      │ │      GO      │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│  ┌──────────────┐                                              │
│  │   [Local]    │                                              │
│  │      LO      │                                              │
│  └──────────────┘                                              │
├─────────────────────────────────────────────────────────────────┤
│  Label                                                          │
│  [Production Anthropic                                      ]   │
│                                                                 │
│  API Key                                                        │
│  [sk-ant-api03-...                                          ]   │
│                                                                 │
│                                          [Cancel] [Add Provider]│
└─────────────────────────────────────────────────────────────────┘
```

**Provider-Specific Fields:**

| Provider | Fields |
|----------|--------|
| Anthropic | `api_key` |
| OpenAI | `api_key`, `organization_id` (optional) |
| Google | `api_key`, `project_id` (optional) |
| Local | `endpoint_url`, `model_name` (optional) |

**File Structure:**
```
client/src/apps/agents/components/
├── AIProvidersModal/
│   ├── index.ts
│   ├── AIProvidersModal.tsx
│   ├── AIProvidersModal.module.css
│   ├── AIProviderCard.tsx
│   └── AddAIProviderModal.tsx
```

---

## 5. Sidekick Detail View

When an agent is selected, the sidekick opens with a specialized **split layout**:
- **Top half**: Agent details with tabs (Overview, Tools, Transactions)
- **Bottom half**: AgentChat component (always visible, resizable)

This layout is inspired by Cursor's agent chat interface.

### 5.1 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  SidekickHeader                                                 │
│  - Avatar, Name, ZID                                            │
│  - Status badge                                                 │
│  - Quick actions: Start/Stop, Terminal                          │
├─────────────────────────────────────────────────────────────────┤
│  TOP HALF: Detail Tabs (resizable)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ SidekickTabs: [Overview] [Tools] [Transactions]             ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Tab Content Area (scrollable)                               ││
│  │ - Overview: Agent info sections                             ││
│  │ - Tools: Enabled tools list                                 ││
│  │ - Transactions: Transaction history                         ││
│  └─────────────────────────────────────────────────────────────┘│
├═════════════════════════════════════════════════════════════════┤
│  ↕ Resize Handle (drag to resize top/bottom split)             │
├═════════════════════════════════════════════════════════════════┤
│  BOTTOM HALF: AgentChat Component (always visible)              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Chat Header: Conversation selector, New chat button         ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Messages Area (scrollable)                                  ││
│  │ - SystemMessage, UserMessage, AgentMessage, ToolMessage     ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Input Area: [Message input...              ] [Send]         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Tab: Overview

**Sections:**
- **Identity**: Name, ZID, Swarm (link)
- **Reasoning**: Provider, Model, Expertise, Context window
- **Wallet**: Chain, Address (copyable), Balance
- **Personality**: Display name, Traits, Tone
- **Stats**: Conversations, Transactions, Uptime
- **Credentials**: SSH Key info

### 5.3 Tab: Tools

List of enabled tools with:
- Tool name and icon
- Description
- Permission status
- Last used timestamp
- Usage count

### 5.4 Tab: Transactions

Transaction history with:
- Transaction type and icon
- Amount and token (if applicable)
- Chain indicator
- Status badge
- Timestamp
- Link to block explorer

---

## 6. AgentChat Component

A dedicated, always-visible chat component that occupies the bottom half of the agent sidekick. Designed similar to Cursor's agent chat interface.

### 6.1 Component Structure

```
client/src/features/sidekick/components/AgentChat/
├── index.ts
├── AgentChat.tsx
├── AgentChat.module.css
├── ChatHeader.tsx
├── ChatMessages.tsx
├── ChatInput.tsx
└── MessageBubble.tsx
```

### 6.2 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ChatHeader                                                     │
│  ┌───────────────────────────────────────────┬─────────────────┐│
│  │ [▾ Current Conversation Title           ] │ [+ New Chat]    ││
│  └───────────────────────────────────────────┴─────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ChatMessages (scrollable, auto-scroll to bottom)               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 🤖 SystemMessage: Session started                       │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │                         ┌───────────────────────────────────┐││
│  │                         │ 👤 What can you help me with?    │││
│  │                         └───────────────────────────────────┘││
│  │                                                             ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 🤖 I'm a Developer agent. I can help with:              │ ││
│  │ │ • Writing and reviewing code                            │ ││
│  │ │ • Debugging issues                                      │ ││
│  │ │ • Architecture decisions...                             │ ││
│  │ │ ▊ (streaming cursor)                                    │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ ┌─────────────────────────────────────────────────────────┐ ││
│  │ │ 🔧 Tool: read_file                                      │ ││
│  │ │ Reading: src/components/App.tsx                         │ ││
│  │ │ ✓ Complete (1.2s)                                       │ ││
│  │ └─────────────────────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  ChatInput                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [📎] [Enter message...                          ] [Send ➤] ││
│  └─────────────────────────────────────────────────────────────┘│
│  Shift+Enter for newline • ⌘+Enter to send                     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Message Types

| Type | Alignment | Styling | Icon |
|------|-----------|---------|------|
| `user` | Right | Accent background, rounded | 👤 |
| `agent` | Left | Surface background, rounded | 🤖 |
| `system` | Center | Muted, small, no bubble | — |
| `tool` | Left | Code background, monospace | 🔧 |

### 6.4 Features

- **Real-time streaming**: Agent responses stream character-by-character
- **Tool call visualization**: Shows tool name, input, status, duration
- **Conversation history**: Dropdown to switch between conversations
- **New conversation**: Button to start fresh chat
- **Auto-scroll**: Automatically scrolls to latest message
- **Keyboard shortcuts**: Enter to send, Shift+Enter for newline
- **Attachment support**: Future - attach files/context (📎 button)

### 6.5 Resizable Split

The split between detail tabs and chat is resizable:
- **Drag handle**: Horizontal bar between sections
- **Default split**: 50% / 50%
- **Min heights**: 150px for each section
- **Persistence**: Split position saved to preferences

### 6.6 Props Interface

```typescript
interface AgentChatProps {
  agentId: string;
  conversationId?: string;
  onConversationChange?: (conversationId: string) => void;
  defaultHeight?: number;
  minHeight?: number;
}
```

---

## 7. Terminal Panel

Extends the existing `TerminalPanel` pattern from the Machines app.

### 7.1 Layout

Same resizable panel at the bottom of the Agents app, with:
- Drag handle for resize
- Header with agent info and status
- Minimize/close buttons

### 7.2 Content Modes

The terminal supports two views (toggled via tabs):

#### RecordView (Records Tab)
An immutable, append-only log of all agent activity. Records are streamed in real-time and cannot be modified or deleted.

**Record Types:**
| Type | Icon | Description |
|------|------|-------------|
| `reasoning` | 🧠 | Agent reasoning/thinking steps |
| `tool_call` | 🔧 | Tool invocation with input/output |
| `tool_result` | ✓/✗ | Tool execution result |
| `message_sent` | 💬 | Message sent to user |
| `message_received` | 📥 | Message received from user |
| `transaction` | 💰 | Blockchain transaction initiated |
| `error` | ❌ | Error occurred |
| `state_change` | 🔄 | Agent state change (started, paused, etc.) |

**Record Format:**
```
[2026-01-08 10:30:45.123] [REASONING] Analyzing user request...
[2026-01-08 10:30:45.456] [TOOL_CALL] read_file: src/App.tsx
[2026-01-08 10:30:45.789] [TOOL_RESULT] ✓ 245 lines read (12ms)
[2026-01-08 10:30:46.012] [MESSAGE_SENT] I found the issue in App.tsx...
[2026-01-08 10:30:47.234] [TRANSACTION] 0x1234...5678 → 0xabcd...efgh (0.01 ETH)
```

**Features:**
- Immutable append-only log
- Real-time streaming via WebSocket
- Timestamp with millisecond precision
- Color-coded by record type
- Searchable/filterable
- Export to file

#### Transactions Tab
- Focused view of blockchain transactions only
- Transaction details: hash, chain, amount, status
- Link to block explorer
- Status updates in real-time

### 7.3 Terminal Styling

Reuses `SSHTerminal` styling and xterm.js configuration:
- Same theme colors
- Same font (JetBrains Mono)
- Status bar with agent info
- Connection status indicator

### 7.4 Record Data Model

```typescript
export type RecordType =
  | 'reasoning'
  | 'tool_call'
  | 'tool_result'
  | 'message_sent'
  | 'message_received'
  | 'transaction'
  | 'error'
  | 'state_change';

export interface AgentRecord {
  record_id: string;
  agent_id: string;
  type: RecordType;
  timestamp: string;           // ISO with milliseconds
  
  // Content
  content: string;             // Human-readable message
  data?: Record<string, unknown>; // Structured data
  
  // Context
  conversation_id?: string;
  tool_name?: string;
  transaction_id?: string;
  
  // Immutability
  hash?: string;               // Content hash for verification
}
```

---

## 8. File Structure

Following existing app conventions:

```
client/src/apps/agents/
├── index.ts                          # Barrel export
├── AgentsApp.tsx                     # Main app component
├── AgentsApp.module.css              # App styles
├── AgentsApp.test.tsx                # App tests
│
├── components/
│   ├── index.ts                      # Barrel export
│   │
│   ├── AgentCard/
│   │   ├── index.ts
│   │   ├── AgentCard.tsx
│   │   └── AgentCard.module.css
│   │
│   ├── AgentFilters/
│   │   ├── index.ts
│   │   ├── AgentFilters.tsx
│   │   └── AgentFilters.module.css
│   │
│   ├── CreateAgentWizard/
│   │   ├── index.ts
│   │   ├── CreateAgentWizard.tsx
│   │   └── CreateAgentWizard.module.css
│   │
│   └── AIProvidersModal/
│       ├── index.ts
│       ├── AIProvidersModal.tsx
│       ├── AIProvidersModal.module.css
│       ├── AIProviderCard.tsx
│       └── AddAIProviderModal.tsx
│
└── hooks/
    ├── index.ts
    └── useAgentGroups.ts             # For grouping agents
```

Sidekick detail:
```
client/src/features/sidekick/details/AgentDetail/
├── index.ts
├── AgentDetail.tsx
├── AgentDetail.module.css
├── AgentOverviewTab.tsx
├── AgentToolsTab.tsx
└── AgentTransactionsTab.tsx
```

AgentChat component (always visible in agent sidekick):
```
client/src/features/sidekick/components/AgentChat/
├── index.ts
├── AgentChat.tsx
├── AgentChat.module.css
├── ChatHeader.tsx
├── ChatMessages.tsx
├── ChatInput.tsx
└── MessageBubble.tsx
```

Terminal extension with RecordView:
```
client/src/features/terminal/components/
├── AgentTerminalPanel/
│   ├── index.ts
│   ├── AgentTerminalPanel.tsx
│   └── AgentTerminalPanel.module.css
├── RecordView/
│   ├── index.ts
│   ├── RecordView.tsx
│   ├── RecordView.module.css
│   └── RecordEntry.tsx
```

---

## 9. Shared Types

Add to `shared/src/types/`:

```
shared/src/types/
├── agent.ts                          # Agent, Swarm, AgentPersonality, etc.
├── index.ts                          # Add export
```

---

## 10. Navigation Update

Update `Appbar.tsx` to include Agents at the top:

```typescript
const navItems: NavItem[] = [
  { to: '/agents', icon: Bot, label: 'Agents' },        // NEW - at top
  { to: '/machines', icon: Server, label: 'Machines' },
  { to: '/providers', icon: Cloud, label: 'Providers' },
  { to: '/keys', icon: Key, label: 'Keys' },
  { to: '/repositories', icon: FolderGit2, label: 'Repositories' },
  { to: '/deployments', icon: GitBranch, label: 'Deployments' },
  { to: '/bootstrap', icon: Package, label: 'Bootstrap' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/members', icon: Users, label: 'Members' },
];
```

---

## 11. Store Updates

### 11.1 appStore Extensions

```typescript
interface AppState {
  // ... existing state
  
  // Agent-specific
  agentFilters: AgentListFilter;
  agentSort: AgentListSort;
  createAgentWizardOpen: boolean;
  activeAgentTerminalId: string | null;
  
  // Actions
  setAgentFilters: (filters: Partial<AgentListFilter>) => void;
  clearAgentFilters: () => void;
  setAgentSort: (sort: AgentListSort) => void;
  setCreateAgentWizardOpen: (open: boolean) => void;
  setActiveAgentTerminalId: (id: string | null) => void;
}
```

### 11.2 sidekickStore Extensions

Add `'agent'` to selection types for sidekick panel.

---

## 12. API Endpoints (Future Backend)

> Note: For Phase 1 (frontend only), use mock data. These endpoints define the future API contract.

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent |
| PUT | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/start` | Start agent |
| POST | `/api/agents/:id/stop` | Stop agent |
| POST | `/api/agents/:id/pause` | Pause agent |
| POST | `/api/agents/:id/resume` | Resume agent |

### Swarms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/swarms` | List swarms |
| GET | `/api/swarms/:id` | Get swarm |

### AI Provider Accounts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai-providers/accounts` | List AI provider accounts |
| GET | `/api/ai-providers/accounts/:id` | Get AI provider account |
| POST | `/api/ai-providers/accounts` | Create AI provider account |
| PUT | `/api/ai-providers/accounts/:id` | Update AI provider account |
| DELETE | `/api/ai-providers/accounts/:id` | Delete AI provider account |
| POST | `/api/ai-providers/accounts/:id/verify` | Verify credentials |
| GET | `/api/ai-providers/:type/models` | List available models for provider |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/:id/conversations` | List conversations |
| POST | `/api/agents/:id/conversations` | New conversation |
| GET | `/api/agents/:id/conversations/:cid/messages` | Get messages |
| POST | `/api/agents/:id/conversations/:cid/messages` | Send message |
| GET | `/api/agents/:id/conversations/:cid/stream` | Stream responses (SSE) |

### Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/:id/transactions` | List transactions |
| GET | `/api/agents/:id/transactions/:tid` | Get transaction |

### Records

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents/:id/records` | List records (paginated) |
| GET | `/api/agents/:id/records/stream` | Stream records (SSE) |

### Agent Terminal

| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/ws/agent-terminal?agentId=X` | Agent process stream |

---

## 13. Mock Data (Phase 1)

For frontend development, use mock data with realistic values:

### Sample AI Provider Accounts

```typescript
const mockAIProviderAccounts: AIProviderAccount[] = [
  {
    ai_provider_account_id: 'ai-provider-1',
    team_id: 'team-1',
    provider: 'anthropic',
    label: 'Production Anthropic',
    credential_status: 'valid',
    last_verified_at: '2026-01-08T08:00:00Z',
    usage_this_month: 125000,
    created_at: '2025-12-15T09:00:00Z',
    updated_at: '2026-01-08T08:00:00Z',
    created_by: 'user-1',
  },
  {
    ai_provider_account_id: 'ai-provider-2',
    team_id: 'team-1',
    provider: 'openai',
    label: 'OpenAI Team',
    credential_status: 'valid',
    last_verified_at: '2026-01-07T12:00:00Z',
    usage_this_month: 50000,
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-07T12:00:00Z',
    created_by: 'user-1',
  },
  {
    ai_provider_account_id: 'ai-provider-3',
    team_id: 'team-1',
    provider: 'local',
    label: 'Local Ollama',
    credential_status: 'valid',
    last_verified_at: '2026-01-08T10:00:00Z',
    created_at: '2026-01-02T14:00:00Z',
    updated_at: '2026-01-08T10:00:00Z',
    created_by: 'user-1',
  },
];
```

### Sample Swarms

```typescript
const mockSwarms: Swarm[] = [
  {
    swarm_id: 'swarm-1',
    name: 'Production Swarm',
    url: 'https://swarm.machina.io',
    port: 443,
    status: 'active',
    access_level: 'team',
    agent_count: 12,
    max_agents: 50,
    is_system_swarm: true,
  },
  {
    swarm_id: 'swarm-2',
    name: 'Development Swarm',
    url: 'https://dev-swarm.machina.io',
    port: 443,
    status: 'active',
    access_level: 'team',
    agent_count: 5,
    max_agents: 20,
    is_system_swarm: true,
  },
  {
    swarm_id: 'swarm-3',
    name: 'Local Testing',
    url: 'http://localhost',
    port: 8080,
    status: 'active',
    access_level: 'private',
    agent_count: 2,
    max_agents: 10,
    is_system_swarm: false,
  },
];
```

### Sample Agent

```typescript
const mockAgent: Agent = {
  agent_id: 'agent-001',
  team_id: 'team-1',
  name: 'Code Review Assistant',
  zid: 'code-review-alpha-01',
  swarm_id: 'swarm-1',
  status: 'running',
  ai_provider_account_id: 'ai-provider-1',  // References Production Anthropic
  reasoning_model: 'claude-3-5-sonnet-20241022',
  expertise: 'code_reviewer',
  enabled_tools: ['read_file', 'write_file', 'http_request', 'git_operations'],
  tool_permissions: {},
  wallet_chain: 'evm',
  wallet_address: '0x1234...5678',
  personality: {
    display_name: 'Alex',
    backstory: 'I am a code review specialist focused on TypeScript and React best practices...',
    traits: ['analytical', 'precise', 'helpful'],
    tone: 'professional',
  },
  total_conversations: 47,
  total_transactions: 12,
  last_active_at: '2026-01-08T10:30:00Z',
  created_at: '2025-12-15T09:00:00Z',
  updated_at: '2026-01-08T10:30:00Z',
  created_by: 'user-1',
};
```

### Sample Records

```typescript
const mockRecords: AgentRecord[] = [
  {
    record_id: 'rec-001',
    agent_id: 'agent-001',
    type: 'state_change',
    timestamp: '2026-01-08T10:30:00.000Z',
    content: 'Agent started',
    data: { previous_state: 'stopped', new_state: 'running' },
  },
  {
    record_id: 'rec-002',
    agent_id: 'agent-001',
    type: 'message_received',
    timestamp: '2026-01-08T10:30:15.123Z',
    content: 'Review the changes in App.tsx',
    conversation_id: 'conv-001',
  },
  {
    record_id: 'rec-003',
    agent_id: 'agent-001',
    type: 'reasoning',
    timestamp: '2026-01-08T10:30:15.456Z',
    content: 'Analyzing request to review App.tsx changes...',
    conversation_id: 'conv-001',
  },
  {
    record_id: 'rec-004',
    agent_id: 'agent-001',
    type: 'tool_call',
    timestamp: '2026-01-08T10:30:16.789Z',
    content: 'Calling read_file: src/App.tsx',
    tool_name: 'read_file',
    data: { path: 'src/App.tsx' },
  },
  {
    record_id: 'rec-005',
    agent_id: 'agent-001',
    type: 'tool_result',
    timestamp: '2026-01-08T10:30:17.012Z',
    content: 'Successfully read 245 lines (12ms)',
    tool_name: 'read_file',
    data: { lines: 245, duration_ms: 12, success: true },
  },
];
```

---

## 14. Testing Checklist

### Unit Tests

| Component | Tests |
|-----------|-------|
| `AgentsApp` | List render, empty state, filter, search, wizard open |
| `AgentCard` | Render info, status badge, click select |
| `CreateAgentWizard` | Step navigation, validation, form data, submit |
| `AgentFilters` | Filter changes, clear filters |
| `AgentDetail` | Tab switching, data display, split resize |
| `AgentChat` | Message render, input, send, streaming |
| `ChatMessages` | Auto-scroll, message types, tool calls |
| `RecordView` | Record render, streaming, filtering |
| `AgentTerminalPanel` | Open/close, resize, tab toggle |
| `AIProvidersModal` | List providers, empty state, open add modal |
| `AddAIProviderModal` | Provider selection, form fields, validation, submit |
| `AIProviderCard` | Render info, status badge, actions (verify, edit, delete) |

### Integration Tests

| Flow | Tests |
|------|-------|
| Create Agent | Full wizard flow with AI provider selection, validation, success |
| Agent Actions | Start, stop, pause from card and detail |
| Chat | Send message, receive response, tool calls |
| Records | Stream records, filter by type |
| Terminal | Open, view records, switch modes |
| AI Providers | Add provider, verify credentials, delete provider |

### E2E Tests

| Scenario | Tests |
|----------|-------|
| Navigation | Agents link at top, page loads |
| CRUD | Create, view, update, delete agent |
| Wizard | Complete all steps including AI provider selection, validation errors |
| AI Providers | Open modal, add provider, verify, delete |
| Sidekick | Select agent, view tabs, chat always visible |
| Chat | Send message, streaming response, conversation switch |
| Terminal | Open, resize, minimize, close, records streaming |

---

## 15. Design Tokens

Uses existing Machina design system with new additions:

### Status Colors

| Status | Color Token |
|--------|-------------|
| running | `--accent-success` (#00ff88) |
| pending | `--text-secondary` (#8b949e) |
| paused | `--accent-warning` (#ff9500) |
| stopped | `--text-secondary` (#8b949e) |
| error | `--accent-error` (#ff3366) |

### Icons

| Element | Lucide Icon |
|---------|-------------|
| Agents nav | `Bot` |
| Swarm | `Boxes` |
| Reasoning | `Brain` |
| AI Providers | `BrainCog` |
| Expertise | `GraduationCap` |
| Tools | `Wrench` |
| Wallet | `Wallet` |
| Personality | `Sparkles` |
| Chat | `MessageSquare` |
| Records | `ScrollText` |
| Transactions | `ArrowRightLeft` |

### AI Provider Icons

| Provider | Abbreviation | Color |
|----------|--------------|-------|
| Anthropic | AN | `#d4a27f` (tan/clay) |
| OpenAI | OA | `#00a67e` (green) |
| Google | GO | `#4285f4` (blue) |
| Local | LO | `#8b949e` (gray) |

---

## 16. Implementation Notes

### Phase 1: Frontend Only

1. Use mock data from `mock/agents.ts`
2. Simulate API delays with `setTimeout`
3. Store state in Zustand (no persistence)
4. AgentChat uses local state with simulated streaming
5. RecordView shows mock records with simulated streaming
6. Split sidekick layout with resizable chat panel

### Phase 2: Backend Integration

1. Create microservice for agent orchestration
2. Implement SSE for chat streaming
3. Implement SSE for record streaming
4. Integrate with actual LLM providers
5. Add wallet generation and transaction signing
6. Connect to swarm infrastructure
7. Persist records to immutable log store

---

## Appendix A: Lucide Icons Reference

```typescript
import {
  Bot,           // Agents nav, agent icon
  Boxes,         // Swarms
  Brain,         // Reasoning
  BrainCog,      // AI Providers
  GraduationCap, // Expertise
  Wrench,        // Tools
  Wallet,        // Wallet
  Key,           // Credentials
  Sparkles,      // Personality
  MessageSquare, // Chat / AgentChat
  ScrollText,    // Records / RecordView
  ArrowRightLeft,// Transactions
  Play,          // Start
  Pause,         // Pause
  Square,        // Stop
  Terminal,      // Terminal
  FileText,      // Review
  Send,          // Send message
  Paperclip,     // Attachments
  Settings,      // AI Providers modal button
  ShieldCheck,   // Credential status valid
  ShieldAlert,   // Credential status invalid
} from 'lucide-react';
```

## Appendix B: Naming Conventions

Following Machina conventions:

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `AgentCard.tsx` |
| Hook | camelCase with `use` | `useAgentGroups.ts` |
| CSS Module | PascalCase.module.css | `AgentCard.module.css` |
| Type field | snake_case | `agent_id`, `swarm_id` |
| Route | kebab-case | `/agents`, `/agents/:id` |
| Test | `.test.tsx` | `AgentCard.test.tsx` |
