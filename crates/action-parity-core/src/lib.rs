//! Register a business Action once, then derive its manifest entry, generic CLI
//! catalog, MCP tool description, and runtime dispatcher from the same object.
//! Framework adapters are callers of this crate; business behavior does not
//! belong in an adapter.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fmt;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const ENVELOPE_VERSION: u32 = 1;
const BUNDLE_FORMAT: &str = "action-parity.registry-bundle/v1";

type Handler =
    dyn Fn(&ExecutionContext, Value) -> Result<Value, ActionError> + Send + Sync + 'static;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Application {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

impl Application {
    pub fn new(id: impl Into<String>, name: impl Into<String>, version: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            version: version.into(),
            description: None,
            homepage: None,
            source: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SurfaceKind {
    Gui,
    Tui,
    Cli,
    Mcp,
    Api,
    Ipc,
    Test,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Reachability {
    InProcess,
    LocalIpc,
    External,
}

/// A Shadow template. `{action_id}` and `{action_title}` are expanded for every
/// registered Action, so adding an Action never requires another binding list.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Surface {
    pub id: String,
    pub kind: SurfaceKind,
    pub required_for_parity: bool,
    pub reachability: Reachability,
    pub binding_target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub binding_test: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_driver: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exclusion_reason: Option<String>,
}

impl Surface {
    pub fn new(
        id: impl Into<String>,
        kind: SurfaceKind,
        reachability: Reachability,
        binding_target: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            kind,
            required_for_parity: true,
            reachability,
            binding_target: binding_target.into(),
            binding_test: None,
            description: None,
            test_driver: None,
            exclusion_reason: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum EffectClass {
    Read,
    Write,
    External,
    Financial,
    Destructive,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Risk {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Confirmation {
    Never,
    Conditional,
    Always,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Effects {
    #[serde(rename = "class")]
    pub effect_class: EffectClass,
    pub risk: Risk,
    pub reversible: bool,
    pub confirmation: Confirmation,
    pub audit_required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rollback_action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

impl Effects {
    pub fn read_only() -> Self {
        Self {
            effect_class: EffectClass::Read,
            risk: Risk::Low,
            reversible: true,
            confirmation: Confirmation::Never,
            audit_required: false,
            rollback_action: None,
            notes: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Execution {
    pub headless: bool,
    pub idempotent: bool,
    pub cancellable: bool,
    pub timeout_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_events: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headless_evidence: Option<String>,
}

impl Default for Execution {
    fn default() -> Self {
        Self {
            headless: true,
            idempotent: false,
            cancellable: false,
            timeout_ms: 30_000,
            progress_events: None,
            headless_evidence: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionDescriptor {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    pub input_schema: Value,
    pub output_schema: Value,
    pub effects: Effects,
    #[serde(default)]
    pub execution: Execution,
}

impl ActionDescriptor {
    pub fn new(
        id: impl Into<String>,
        title: impl Into<String>,
        description: impl Into<String>,
        input_schema: Value,
        output_schema: Value,
        effects: Effects,
    ) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            description: description.into(),
            tags: Vec::new(),
            input_schema,
            output_schema,
            effects,
            execution: Execution::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DispatchRequest {
    pub action_id: String,
    #[serde(default)]
    pub input: Value,
    #[serde(default)]
    pub confirmed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub execution_id: String,
    pub surface: Option<String>,
    pub confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecutionEnvelope {
    pub ok: bool,
    pub version: u32,
    pub action_id: String,
    pub execution_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ActionError>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionError {
    pub class: String,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl ActionError {
    pub fn new(
        class: impl Into<String>,
        code: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            class: class.into(),
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn input(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new("input", code, message)
    }

    pub fn refused(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new("refused", code, message)
    }
}

impl fmt::Display for ActionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

impl std::error::Error for ActionError {}

#[derive(Clone)]
struct RegisteredAction {
    descriptor: ActionDescriptor,
    handler: Arc<Handler>,
}

/// Runtime registry and single source for generated Shadows.
pub struct Registry {
    application: Application,
    spec_version: String,
    generator_revision: Option<String>,
    surfaces: BTreeMap<String, Surface>,
    actions: BTreeMap<String, RegisteredAction>,
    state: Option<Value>,
}

impl Registry {
    pub fn new(application: Application) -> Self {
        Self {
            application,
            spec_version: "0.5.0".to_string(),
            generator_revision: None,
            surfaces: BTreeMap::new(),
            actions: BTreeMap::new(),
            state: None,
        }
    }

    pub fn spec_version(mut self, version: impl Into<String>) -> Self {
        self.spec_version = version.into();
        self
    }

    pub fn generator_revision(mut self, revision: impl Into<String>) -> Self {
        self.generator_revision = Some(revision.into());
        self
    }

    pub fn state(mut self, state: Value) -> Self {
        self.state = Some(state);
        self
    }

    pub fn add_surface(&mut self, surface: Surface) -> Result<(), RegistryError> {
        validate_surface(&surface)?;
        if self.surfaces.contains_key(&surface.id) {
            return Err(RegistryError::DuplicateSurface(surface.id));
        }
        self.surfaces.insert(surface.id.clone(), surface);
        Ok(())
    }

    pub fn register<F>(
        &mut self,
        descriptor: ActionDescriptor,
        handler: F,
    ) -> Result<(), RegistryError>
    where
        F: Fn(&ExecutionContext, Value) -> Result<Value, ActionError> + Send + Sync + 'static,
    {
        validate_action(&descriptor)?;
        if self.actions.contains_key(&descriptor.id) {
            return Err(RegistryError::DuplicateAction(descriptor.id));
        }
        self.actions.insert(
            descriptor.id.clone(),
            RegisteredAction {
                descriptor,
                handler: Arc::new(handler),
            },
        );
        Ok(())
    }

    pub fn action(&self, id: &str) -> Option<&ActionDescriptor> {
        self.actions.get(id).map(|action| &action.descriptor)
    }

    pub fn dispatch(&self, request: DispatchRequest) -> ExecutionEnvelope {
        let execution_id = request.execution_id.unwrap_or_else(next_execution_id);
        let Some(action) = self.actions.get(&request.action_id) else {
            return failure(
                request.action_id,
                execution_id,
                ActionError::input("unknown_action", "The Action ID is not registered."),
            );
        };

        if let Some(surface) = request.surface.as_deref() {
            if !self.surfaces.contains_key(surface) {
                return failure(
                    request.action_id,
                    execution_id,
                    ActionError::input("unknown_surface", "The Surface ID is not registered."),
                );
            }
        }

        if confirmation_required(&action.descriptor.effects) && !request.confirmed {
            return failure(
                request.action_id,
                execution_id,
                ActionError::refused(
                    "confirmation_required",
                    "The Action Core refused execution without explicit confirmation.",
                ),
            );
        }

        let context = ExecutionContext {
            execution_id: execution_id.clone(),
            surface: request.surface,
            confirmed: request.confirmed,
        };
        match catch_unwind(AssertUnwindSafe(|| {
            (action.handler)(&context, request.input)
        })) {
            Ok(Ok(result)) => ExecutionEnvelope {
                ok: true,
                version: ENVELOPE_VERSION,
                action_id: request.action_id,
                execution_id,
                result: Some(result),
                error: None,
            },
            Ok(Err(error)) => failure(request.action_id, execution_id, error),
            Err(_) => failure(
                request.action_id,
                execution_id,
                ActionError::new(
                    "internal",
                    "action_panicked",
                    "The Action handler panicked; the process boundary remained intact.",
                ),
            ),
        }
    }

    /// Deterministic Manifest derived from the same descriptors used to execute.
    pub fn manifest(&self) -> Value {
        let surfaces = self
            .surfaces
            .values()
            .map(manifest_surface)
            .collect::<Vec<_>>();
        let actions = self
            .actions
            .values()
            .map(|registered| self.manifest_action(&registered.descriptor))
            .collect::<Vec<_>>();

        let mut generated_from = json!({
            "generator": format!("action-parity-core/{}", env!("CARGO_PKG_VERSION")),
        });
        if let Some(revision) = &self.generator_revision {
            generated_from["revision"] = Value::String(revision.clone());
        }

        let mut manifest = json!({
            "$schema": format!(
                "https://raw.githubusercontent.com/dongsheng123132/action-parity/v{}/schema/action-parity.schema.json",
                self.spec_version
            ),
            "spec_version": self.spec_version,
            "application": self.application,
            "surfaces": surfaces,
            "actions": actions,
            "generated_from": generated_from,
        });
        if let Some(state) = &self.state {
            manifest["state"] = state.clone();
        }
        manifest
    }

    /// Machine-readable catalog for a generic `call <action-id> --input-json` CLI.
    pub fn cli_help(&self) -> Value {
        json!({
            "format": "action-parity.cli-help/v1",
            "application": self.application,
            "invocation": "call <action-id> --input-json <json> --json",
            "actions": self.actions.values().map(|registered| {
                let action = &registered.descriptor;
                json!({
                    "id": action.id,
                    "title": action.title,
                    "description": action.description,
                    "input_schema": action.input_schema,
                    "output_schema": action.output_schema,
                    "effects": action.effects,
                })
            }).collect::<Vec<_>>()
        })
    }

    /// MCP `tools/list` payload. An MCP transport only needs to forward calls to
    /// [`Registry::dispatch`]; it does not reimplement the Action.
    pub fn mcp_tools(&self) -> Value {
        json!({
            "tools": self.actions.values().map(|registered| {
                let action = &registered.descriptor;
                json!({
                    "name": action.id,
                    "title": action.title,
                    "description": action.description,
                    "inputSchema": action.input_schema,
                    "outputSchema": action.output_schema,
                })
            }).collect::<Vec<_>>()
        })
    }

    pub fn artifact_bundle(&self) -> Value {
        json!({
            "format": BUNDLE_FORMAT,
            "manifest": self.manifest(),
            "cli_help": self.cli_help(),
            "mcp_tools": self.mcp_tools(),
        })
    }

    fn manifest_action(&self, action: &ActionDescriptor) -> Value {
        let bindings = self
            .surfaces
            .values()
            .map(|surface| {
                let mut binding = json!({
                    "surface": surface.id,
                    "target": expand_template(&surface.binding_target, action),
                });
                if let Some(test) = &surface.binding_test {
                    binding["test"] = Value::String(expand_template(test, action));
                }
                binding
            })
            .collect::<Vec<_>>();

        let mut value = serde_json::to_value(action).expect("Action descriptors are serializable");
        value["bindings"] = Value::Array(bindings);
        value
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryError {
    DuplicateAction(String),
    DuplicateSurface(String),
    InvalidAction(String),
    InvalidSurface(String),
}

impl fmt::Display for RegistryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DuplicateAction(id) => write!(formatter, "duplicate Action ID: {id}"),
            Self::DuplicateSurface(id) => write!(formatter, "duplicate Surface ID: {id}"),
            Self::InvalidAction(message) => write!(formatter, "invalid Action: {message}"),
            Self::InvalidSurface(message) => write!(formatter, "invalid Surface: {message}"),
        }
    }
}

impl std::error::Error for RegistryError {}

fn failure(action_id: String, execution_id: String, error: ActionError) -> ExecutionEnvelope {
    ExecutionEnvelope {
        ok: false,
        version: ENVELOPE_VERSION,
        action_id,
        execution_id,
        result: None,
        error: Some(error),
    }
}

fn confirmation_required(effects: &Effects) -> bool {
    if effects.confirmation == Confirmation::Always {
        return true;
    }
    effects.confirmation == Confirmation::Conditional
        && (matches!(effects.risk, Risk::High | Risk::Critical)
            || matches!(
                effects.effect_class,
                EffectClass::Financial | EffectClass::Destructive
            ))
}

fn validate_action(action: &ActionDescriptor) -> Result<(), RegistryError> {
    if !valid_action_id(&action.id) {
        return Err(RegistryError::InvalidAction(format!(
            "{} is not a stable dotted Action ID",
            action.id
        )));
    }
    if action.title.trim().is_empty() || action.description.trim().is_empty() {
        return Err(RegistryError::InvalidAction(format!(
            "{} needs a title and description",
            action.id
        )));
    }
    if !action.input_schema.is_object() || !action.output_schema.is_object() {
        return Err(RegistryError::InvalidAction(format!(
            "{} input_schema and output_schema must be JSON Schema objects",
            action.id
        )));
    }
    if !action.execution.headless {
        return Err(RegistryError::InvalidAction(format!(
            "{} is a business Action and must be headless",
            action.id
        )));
    }
    if action.execution.timeout_ms == 0 || action.execution.timeout_ms > 86_400_000 {
        return Err(RegistryError::InvalidAction(format!(
            "{} timeout_ms is outside 1..=86400000",
            action.id
        )));
    }
    if (matches!(action.effects.risk, Risk::High | Risk::Critical)
        || matches!(
            action.effects.effect_class,
            EffectClass::Financial | EffectClass::Destructive
        ))
        && action.effects.confirmation == Confirmation::Never
    {
        return Err(RegistryError::InvalidAction(format!(
            "{} cannot disable confirmation for high-risk effects",
            action.id
        )));
    }
    Ok(())
}

fn validate_surface(surface: &Surface) -> Result<(), RegistryError> {
    if !valid_simple_id(&surface.id) {
        return Err(RegistryError::InvalidSurface(format!(
            "{} is not a valid Surface ID",
            surface.id
        )));
    }
    if !surface.binding_target.contains("{action_id}") {
        return Err(RegistryError::InvalidSurface(format!(
            "{} binding_target must contain {{action_id}}",
            surface.id
        )));
    }
    Ok(())
}

fn valid_action_id(id: &str) -> bool {
    id.contains('.') && id.split('.').all(valid_simple_id)
}

fn valid_simple_id(id: &str) -> bool {
    let mut chars = id.chars();
    matches!(chars.next(), Some(first) if first.is_ascii_lowercase())
        && chars.all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '_'
                || character == '-'
        })
}

fn expand_template(template: &str, action: &ActionDescriptor) -> String {
    template
        .replace("{action_id}", &action.id)
        .replace("{action_title}", &action.title)
}

fn manifest_surface(surface: &Surface) -> Value {
    let mut value = json!({
        "id": surface.id,
        "kind": surface.kind,
        "required_for_parity": surface.required_for_parity,
        "reachability": surface.reachability,
    });
    for (key, field) in [
        ("description", &surface.description),
        ("test_driver", &surface.test_driver),
        ("exclusion_reason", &surface.exclusion_reason),
    ] {
        if let Some(field) = field {
            value[key] = Value::String(field.clone());
        }
    }
    value
}

fn next_execution_id() -> String {
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let counter = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("ap-{millis:x}-{counter:x}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn registry() -> Registry {
        let mut registry = Registry::new(Application::new("example.notes", "Notes", "1.0.0"))
            .generator_revision("test-revision");
        let mut gui = Surface::new(
            "gui",
            SurfaceKind::Gui,
            Reachability::InProcess,
            "data-action-id={action_id}",
        );
        gui.binding_test = Some("tests/parity.test.mjs".into());
        registry.add_surface(gui).unwrap();
        let mut cli = Surface::new(
            "cli",
            SurfaceKind::Cli,
            Reachability::External,
            "notes call {action_id} --input-json <json> --json",
        );
        cli.binding_test = Some("tests/parity.test.mjs".into());
        registry.add_surface(cli).unwrap();

        let descriptor = ActionDescriptor::new(
            "note.create",
            "Create note",
            "Create one note.",
            json!({"type":"object","required":["title"]}),
            json!({"type":"object","required":["id"]}),
            Effects {
                effect_class: EffectClass::Write,
                risk: Risk::Low,
                reversible: true,
                confirmation: Confirmation::Never,
                audit_required: true,
                rollback_action: None,
                notes: None,
            },
        );
        registry
            .register(descriptor, |context, input| {
                Ok(json!({"id":"n-1","title":input["title"],"seen_execution_id":context.execution_id}))
            })
            .unwrap();
        registry
    }

    #[test]
    fn one_registration_generates_manifest_cli_and_mcp() {
        let registry = registry();
        let bundle = registry.artifact_bundle();
        assert_eq!(bundle["manifest"]["actions"].as_array().unwrap().len(), 1);
        assert_eq!(
            bundle["manifest"]["actions"][0]["bindings"][0]["target"],
            "notes call note.create --input-json <json> --json"
        );
        assert_eq!(bundle["cli_help"]["actions"][0]["id"], "note.create");
        assert_eq!(bundle["mcp_tools"]["tools"][0]["name"], "note.create");
    }

    #[test]
    fn generation_is_deterministic_and_sorted() {
        let registry = registry();
        assert_eq!(registry.artifact_bundle(), registry.artifact_bundle());
        assert_eq!(registry.manifest()["surfaces"][0]["id"], "cli");
    }

    #[test]
    fn dispatch_preserves_execution_id_across_an_adapter_boundary() {
        let output = registry().dispatch(DispatchRequest {
            action_id: "note.create".into(),
            input: json!({"title":"hello"}),
            confirmed: false,
            execution_id: Some("from-gui-42".into()),
            surface: Some("gui".into()),
        });
        assert!(output.ok);
        assert_eq!(output.execution_id, "from-gui-42");
        assert_eq!(output.result.unwrap()["seen_execution_id"], "from-gui-42");
    }

    #[test]
    fn confirmation_is_enforced_below_every_surface() {
        let mut registry = Registry::new(Application::new("example.safe", "Safe", "1"));
        registry
            .add_surface(Surface::new(
                "cli",
                SurfaceKind::Cli,
                Reachability::External,
                "safe call {action_id} --json",
            ))
            .unwrap();
        let descriptor = ActionDescriptor::new(
            "files.erase",
            "Erase files",
            "Erase selected files.",
            json!({"type":"object"}),
            json!({"type":"object"}),
            Effects {
                effect_class: EffectClass::Destructive,
                risk: Risk::High,
                reversible: false,
                confirmation: Confirmation::Conditional,
                audit_required: true,
                rollback_action: None,
                notes: None,
            },
        );
        registry
            .register(descriptor, |_, _| Ok(json!({"erased":true})))
            .unwrap();
        let output = registry.dispatch(DispatchRequest {
            action_id: "files.erase".into(),
            input: json!({}),
            confirmed: false,
            execution_id: None,
            surface: Some("cli".into()),
        });
        assert!(!output.ok);
        assert_eq!(output.error.unwrap().code, "confirmation_required");
    }

    #[test]
    fn unsafe_descriptors_never_enter_the_registry() {
        let mut descriptor = ActionDescriptor::new(
            "money.send",
            "Send money",
            "Send money externally.",
            json!({}),
            json!({}),
            Effects::read_only(),
        );
        descriptor.effects.effect_class = EffectClass::Financial;
        descriptor.effects.risk = Risk::Critical;
        let mut registry = Registry::new(Application::new("example.bank", "Bank", "1"));
        let error = registry
            .register(descriptor, |_, _| Ok(json!({})))
            .unwrap_err();
        assert!(matches!(error, RegistryError::InvalidAction(_)));
    }

    #[test]
    fn a_panicking_handler_becomes_a_stable_error_envelope() {
        let mut registry = Registry::new(Application::new("example.panic", "Panic", "1"));
        registry
            .register(
                ActionDescriptor::new(
                    "system.panic",
                    "Panic",
                    "Exercise panic containment.",
                    json!({}),
                    json!({}),
                    Effects::read_only(),
                ),
                |_, _| -> Result<Value, ActionError> { panic!("handler defect") },
            )
            .unwrap();
        let output = registry.dispatch(DispatchRequest {
            action_id: "system.panic".into(),
            input: json!({}),
            confirmed: false,
            execution_id: Some("panic-test".into()),
            surface: None,
        });
        assert!(!output.ok);
        assert_eq!(output.error.unwrap().code, "action_panicked");
    }
}
