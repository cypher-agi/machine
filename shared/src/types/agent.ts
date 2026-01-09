// Agent - Core AI entity model

// Agent status throughout lifecycle
export type AgentStatus =
  | 'pending' // Created but not started
  | 'starting' // Initializing
  | 'running' // Active and processing
  | 'paused' // Temporarily suspended
  | 'stopping' // Shutting down
  | 'stopped' // Not running
  | 'error'; // Failed state

// Wallet chain types
export type WalletChain = 'evm' | 'solana' | 'bitcoin';

// Reasoning model providers
export type ReasoningProvider = 'anthropic' | 'openai' | 'google' | 'local';

// Agent expertise types
export type AgentExpertise =
  | 'developer' // Software development
  | 'code_reviewer' // Code review and quality
  | 'architect' // System architecture
  | 'devops' // DevOps and infrastructure
  | 'security' // Security analysis
  | 'data_engineer' // Data pipelines and ETL
  | 'ml_engineer' // Machine learning
  | 'designer' // UI/UX design
  | 'product_manager' // Product management
  | 'qa_engineer' // Quality assurance
  | 'technical_writer' // Documentation
  | 'generalist'; // General purpose

export interface AgentPersonality {
  display_name: string; // How the agent introduces itself
  backstory: string; // Agent's background/purpose narrative
  system_prompt?: string; // Additional system instructions
  traits: string[]; // Personality traits (e.g., 'analytical', 'helpful')
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  avatar_url?: string;
}

export interface ToolPermission {
  tool_id: string;
  enabled: boolean;
  restrictions?: Record<string, unknown>;
}

export interface Agent {
  agent_id: string;
  team_id: string;

  // Identity
  name: string;
  zid: string; // Zero ID - unique identifier
  swarm_id: string; // Swarm this agent belongs to

  // Status
  status: AgentStatus;

  // Reasoning
  ai_provider_account_id: string; // Reference to stored AI provider credentials
  reasoning_model: string; // e.g., 'claude-3-5-sonnet-20241022'
  expertise: AgentExpertise; // Agent's area of expertise

  // Tools & Access
  enabled_tools: string[]; // Tool IDs
  tool_permissions: Record<string, ToolPermission>;

  // Wallet
  wallet_chain?: WalletChain;
  wallet_address?: string;

  // Credentials
  ssh_key_id?: string; // SSH key for secure operations

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

export interface AgentCreateRequest {
  name: string;
  zid: string;
  swarm_id: string;
  ai_provider_account_id: string;
  reasoning_model: string;
  expertise: AgentExpertise;
  enabled_tools?: string[];
  tool_permissions?: Record<string, ToolPermission>;
  wallet_chain?: WalletChain;
  wallet_address?: string;
  ssh_key_id?: string;
  personality: AgentPersonality;
}

export interface AgentListFilter {
  status?: AgentStatus;
  swarm_id?: string;
  provider?: ReasoningProvider;
  has_wallet?: boolean;
  search?: string;
}

export interface AgentListSort {
  field: 'name' | 'status' | 'created_at' | 'last_active_at';
  direction: 'asc' | 'desc';
}

// Swarm - Isolated environment where agents operate
export type SwarmStatus = 'active' | 'maintenance' | 'offline';

export interface SwarmConfig {
  default_reasoning_model?: string;
  allowed_models?: string[];
  rate_limits?: RateLimitConfig;
}

export interface RateLimitConfig {
  requests_per_minute?: number;
  tokens_per_minute?: number;
}

export interface Swarm {
  swarm_id: string;
  team_id?: string; // null for system swarms

  // Identity
  name: string;
  description?: string;

  // Network
  url: string; // Base URL for swarm
  port: number;

  // Access
  access_level: 'public' | 'team' | 'private';
  allowed_team_ids?: string[]; // For 'team' access level

  // Status
  status: SwarmStatus;

  // Stats
  agent_count: number;
  max_agents?: number; // Capacity limit

  // Configuration
  config?: SwarmConfig;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Flags
  is_system_swarm: boolean; // Read-only system swarm
}

// Agent Conversation
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

// Agent Transaction
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

export interface AgentTransaction {
  transaction_id: string;
  agent_id: string;
  team_id: string;

  // Chain info
  chain: WalletChain;
  tx_hash?: string;

  // Transaction details
  type: string; // e.g., 'transfer', 'swap', 'contract_call'
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

// Available Tools Registry
export type ToolCategory =
  | 'filesystem'
  | 'network'
  | 'blockchain'
  | 'code'
  | 'communication'
  | 'custom';

export interface AgentTool {
  tool_id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string; // Lucide icon name
  requires_credentials: boolean;
  parameters_schema?: Record<string, unknown>;
}

// AI Provider Account - stores API keys for AI providers
export type AICredentialStatus = 'valid' | 'invalid' | 'expired' | 'unchecked';

export interface AIProviderAccount {
  ai_provider_account_id: string;
  team_id: string;

  // Provider info
  provider: ReasoningProvider;
  label: string; // User-friendly name (e.g., "Production Anthropic")

  // Credential status
  credential_status: AICredentialStatus;
  last_verified_at?: string;

  // Usage tracking
  usage_this_month?: number; // Token count or cost
  usage_limit?: number; // Optional spending limit

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
  organization_id?: string; // Optional org ID
}

export interface GoogleAICredentials {
  type: 'google';
  api_key: string;
  project_id?: string;
}

export interface LocalCredentials {
  type: 'local';
  endpoint_url: string; // e.g., http://localhost:11434
  model_name?: string; // e.g., llama2
}

// Reasoning Model Options
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

// Agent Record - immutable log entry
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
  timestamp: string; // ISO with milliseconds

  // Content
  content: string; // Human-readable message
  data?: Record<string, unknown>; // Structured data

  // Context
  conversation_id?: string;
  tool_name?: string;
  transaction_id?: string;

  // Immutability
  hash?: string; // Content hash for verification
}
