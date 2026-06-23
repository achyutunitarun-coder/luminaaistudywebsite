// =============================================================================
// Lumina Project Types
// =============================================================================

export interface LuminaProject {
  id: string;
  name: string;
  description: string;
  path: string;
  state: ProjectState;
  createdAt: string;
  updatedAt: string;
  pipeline?: GenerationPipeline;
  theme?: ThemeConfig;
  deployment?: DeploymentConfig;
}

export type ProjectState =
  | "initializing"
  | "cloning"
  | "analyzing"
  | "generating"
  | "validating"
  | "deploying"
  | "ready"
  | "error";

// =============================================================================
// Generation Pipeline Types
// =============================================================================

export interface GenerationPipeline {
  id: string;
  projectId: string;
  stages: PipelineStage[];
  currentStageIndex: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineStage {
  name: string;
  agentType: AgentType;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  result?: AgentResult;
  critique?: AgentCritique;
}

// =============================================================================
// Agent Types
// =============================================================================

export type AgentType =
  | "architect"
  | "frontend-developer"
  | "backend-developer"
  | "fullstack-developer"
  | "ui-designer"
  | "ux-researcher"
  | "data-engineer"
  | "ml-engineer"
  | "devops-engineer"
  | "qa-engineer"
  | "security-auditor"
  | "performance-optimizer"
  | "accessibility-specialist"
  | "documentation-writer"
  | "code-reviewer"
  | "test-writer"
  | "database-designer"
  | "api-designer"
  | "integration-specialist"
  | "deployment-specialist"
  | "theme-customizer"
  | "component-generator"
  | "plugin-developer"
  | "debug-specialist";

export interface AgentResult {
  agentType: AgentType;
  success: boolean;
  output: string;
  artifacts: string[];
  metrics?: Record<string, number>;
  durationMs: number;
  completedAt: string;
}

export interface AgentCritique {
  agentType: AgentType;
  targetAgentType: AgentType;
  score: number;
  feedback: string;
  suggestions: string[];
  approved: boolean;
  createdAt: string;
}

// =============================================================================
// Theme Types
// =============================================================================

export interface ThemeConfig {
  preset?: ThemePreset;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  customCSS?: string;
}

export type ThemePreset =
  | "default"
  | "midnight"
  | "sunrise"
  | "forest"
  | "ocean"
  | "lavender"
  | "monochrome"
  | "high-contrast"
  | "custom";

// =============================================================================
// Design System Theme Types (extended)
// =============================================================================

export interface ColorScale {
  1: string;
  2: string;
  3: string;
  4: string;
  5: string;
  6: string;
  7: string;
  8: string;
  9: string;
  10: string;
  11: string;
  12: string;
}

export interface SemanticTokens {
  bgBase: string;
  bgSubtle: string;
  bgSurface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderDefault: string;
  borderSubtle: string;
  interactive: string;
  interactiveHover: string;
}

export interface TypographyTokens {
  display: string;
  body: string;
  mono: string;
  scale: Record<string, string>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, string>;
  weights: Record<string, number>;
}

export interface SpacingTokens {
  [key: string]: string;
}

export interface MotionTokens {
  instant: string;
  fast: string;
  normal: string;
  slow: string;
  glacial: string;
  easeStandard: string;
  easeEnter: string;
  easeExit: string;
  easeSpring: string;
}

export interface ShadowTokens {
  [key: string]: string;
}

export interface RadiusTokens {
  [key: string]: string;
}

export interface DesignSystemThemeConfig {
  name: string;
  preset: DesignSystemThemePreset;
  colors: {
    primary: ColorScale;
    neutral: ColorScale;
    accent: ColorScale;
    success: ColorScale;
    warning: ColorScale;
    error: ColorScale;
    info: ColorScale;
  };
  typography: TypographyTokens;
  spacing: SpacingTokens;
  motion: MotionTokens;
  borderRadius: RadiusTokens;
  shadows: ShadowTokens;
  gradients: Record<string, string>;
  darkMode: boolean;
}

export type DesignSystemThemePreset =
  | "minimal"
  | "bold"
  | "editorial"
  | "glassmorphic"
  | "brutalist"
  | "organic"
  | "technical"
  | "luxury"
  | "playful"
  | "custom";

// =============================================================================
// Component Types
// =============================================================================

export interface ComponentSpec {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  props: ComponentProp[];
  dependencies: string[];
  template: string;
  styles?: string;
  tests?: string;
}

export interface ComponentProp {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description: string;
}

export type ComponentCategory =
  | "layout"
  | "navigation"
  | "form"
  | "display"
  | "feedback"
  | "overlay"
  | "data"
  | "media"
  | "utility";

// =============================================================================
// Validation Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  score: number;
  checkedAt: string;
}

export interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: "error";
}

export interface ValidationWarning {
  code: string;
  message: string;
  file?: string;
  line?: number;
  severity: "warning";
}

// =============================================================================
// Deployment Types
// =============================================================================

export interface DeploymentConfig {
  provider: DeploymentProvider;
  environment: "development" | "staging" | "production";
  region?: string;
  customDomain?: string;
  autoDeploy: boolean;
  envVars: Record<string, string>;
  buildCommand?: string;
  outputDir?: string;
}

export type DeploymentProvider =
  | "vercel"
  | "netlify"
  | "aws"
  | "gcp"
  | "azure"
  | "cloudflare"
  | "github-pages"
  | "docker"
  | "railway"
  | "render";

// =============================================================================
// Plugin Types
// =============================================================================

export interface LuminaPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: PluginHooks;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface PluginHooks {
  onProjectInit?: (project: LuminaProject) => Promise<void>;
  onStageStart?: (stage: PipelineStage, project: LuminaProject) => Promise<void>;
  onStageComplete?: (stage: PipelineStage, result: AgentResult, project: LuminaProject) => Promise<void>;
  onProjectComplete?: (project: LuminaProject) => Promise<void>;
  onProjectError?: (error: LuminaError, project: LuminaProject) => Promise<void>;
  onDeploy?: (config: DeploymentConfig, project: LuminaProject) => Promise<void>;
  onValidate?: (result: ValidationResult, project: LuminaProject) => Promise<ValidationResult>;
}

// =============================================================================
// Snapshot Types
// =============================================================================

export interface Snapshot {
  id: string;
  projectId: string;
  commitHash: string;
  message: string;
  files: FileTreeNode[];
  createdAt: string;
  parentSnapshotId?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
  size?: number;
  hash?: string;
  content?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export interface LuminaError {
  code: LuminaErrorCode;
  message: string;
  details?: string;
  stack?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export type LuminaErrorCode =
  | "PROJECT_NOT_FOUND"
  | "PROJECT_ALREADY_EXISTS"
  | "INVALID_CONFIGURATION"
  | "CLONE_FAILED"
  | "ANALYSIS_FAILED"
  | "GENERATION_FAILED"
  | "VALIDATION_FAILED"
  | "DEPLOYMENT_FAILED"
  | "PLUGIN_ERROR"
  | "AGENT_TIMEOUT"
  | "AGENT_FAILED"
  | "PIPELINE_FAILED"
  | "SNAPSHOT_FAILED"
  | "TRANSFORM_FAILED"
  | "GIT_ERROR"
  | "MERGE_CONFLICT"
  | "NETWORK_ERROR"
  | "AUTHENTICATION_ERROR"
  | "PERMISSION_DENIED"
  | "INTERNAL_ERROR";

// =============================================================================
// Clone Types
// =============================================================================

export interface CloneOptions {
  url: string;
  branch?: string;
  depth?: number;
  destination?: string;
  recursive?: boolean;
  sparsePaths?: string[];
}

export interface CloneResult {
  success: boolean;
  path: string;
  branch: string;
  commitHash: string;
  stats: RepoStats;
  durationMs: number;
}

export interface RepoStats {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  totalSizeBytes: number;
  commitCount: number;
  branchCount: number;
  lastCommitDate: string;
  lastCommitAuthor: string;
}

// =============================================================================
// Codebase Analysis Types
// =============================================================================

export interface CodebaseMap {
  root: FileNode;
  techStack: TechStack;
  quality: QualityMetrics;
  issues: CodeIssue[];
  entryPoints: string[];
  configFiles: string[];
  testFiles: string[];
  generatedAt: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
  size: number;
  lines?: number;
  children?: FileNode[];
  importance: "critical" | "high" | "medium" | "low" | "ignored";
}

export interface TechStack {
  languages: TechItem[];
  frameworks: TechItem[];
  libraries: TechItem[];
  tools: TechItem[];
  databases: TechItem[];
  testingFrameworks: TechItem[];
}

export interface TechItem {
  name: string;
  version?: string;
  confidence: number;
}

export interface QualityMetrics {
  overallScore: number;
  testCoverage?: number;
  lintScore?: number;
  complexityScore?: number;
  duplicationPercent?: number;
  documentationPercent?: number;
  maintainabilityIndex?: number;
}

export interface CodeIssue {
  id: string;
  type: "error" | "warning" | "info" | "suggestion";
  category: "security" | "performance" | "style" | "bug" | "accessibility" | "maintainability";
  message: string;
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  fixable: boolean;
}

// =============================================================================
// Transform Types
// =============================================================================

export interface TransformOptions {
  targetPath: string;
  instructions: string;
  preserveFormatting: boolean;
  dryRun: boolean;
  backup: boolean;
  scope: "file" | "function" | "component" | "module" | "project";
}

export interface TransformResult {
  success: boolean;
  originalPath: string;
  diffs: FileDiff[];
  semanticDiff: SemanticDiff;
  appliedAt: string;
  durationMs: number;
}

export interface SemanticDiff {
  summary: string;
  groups: DiffGroup[];
  breakingChanges: boolean;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
}

export interface DiffGroup {
  category: DiffCategory;
  description: string;
  fileDiffs: FileDiff[];
  impact: "none" | "low" | "medium" | "high";
}

export type DiffCategory =
  | "feature-addition"
  | "bug-fix"
  | "refactor"
  | "style-change"
  | "performance"
  | "security"
  | "documentation"
  | "dependency"
  | "configuration"
  | "test"
  | "breaking-change"
  | "other";

export interface FileDiff {
  filePath: string;
  status: "added" | "modified" | "deleted" | "renamed";
  oldPath?: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

// =============================================================================
// Git Operation Types
// =============================================================================

export interface CommitOptions {
  message: string;
  files?: string[];
  all: boolean;
  amend: boolean;
  signoff: boolean;
  coAuthor?: string;
}

export interface PushOptions {
  remote: string;
  branch: string;
  force: boolean;
  setUpstream: boolean;
  tags: boolean;
}

export interface MergeConflict {
  filePath: string;
  oursContent: string;
  theirsContent: string;
  baseContent?: string;
  resolved: boolean;
  resolution?: "ours" | "theirs" | "manual";
}

// =============================================================================
// Debug Types
// =============================================================================

export interface DebugOptions {
  target: "pipeline" | "agent" | "plugin" | "deployment" | "validation";
  targetId: string;
  verbose: boolean;
  trace: boolean;
  breakpoints?: string[];
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface DebugResult {
  success: boolean;
  target: string;
  targetId: string;
  logs: DebugLogEntry[];
  state: Record<string, unknown>;
  recommendations: string[];
  durationMs: number;
}

export interface DebugLogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  data?: Record<string, unknown>;
}
