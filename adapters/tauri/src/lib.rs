//! A deliberately thin Tauri boundary. The adapter deserializes a request,
//! forwards it to the Action Registry, and serializes the same envelope. It has
//! no business policy and no second dispatch table.

pub use action_parity_core::DispatchRequest;
use action_parity_core::Registry;
use serde_json::Value;
use std::sync::Arc;

pub type JsonValue = Value;

#[derive(Clone)]
pub struct TauriAdapter {
    registry: Arc<Registry>,
}

impl TauriAdapter {
    pub fn new(registry: Registry) -> Self {
        Self {
            registry: Arc::new(registry),
        }
    }

    pub fn from_shared(registry: Arc<Registry>) -> Self {
        Self { registry }
    }

    pub fn call(&self, request: DispatchRequest) -> Value {
        serde_json::to_value(self.registry.dispatch(request))
            .expect("ExecutionEnvelope is always serializable")
    }

    pub fn registry_artifacts(&self) -> Value {
        self.registry.artifact_bundle()
    }
}

/// Define the one forwarding command inside a Tauri application without making
/// this small adapter crate pull Tauri into non-GUI builds.
#[macro_export]
macro_rules! tauri_command {
    ($name:ident) => {
        #[tauri::command]
        fn $name(
            state: tauri::State<'_, $crate::TauriAdapter>,
            request: $crate::DispatchRequest,
        ) -> $crate::JsonValue {
            state.call(request)
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use action_parity_core::{
        ActionDescriptor, Application, Effects, Reachability, Surface, SurfaceKind,
    };
    use serde_json::json;

    #[test]
    fn adapter_forwards_execution_id_to_the_same_registry() {
        let mut registry = Registry::new(Application::new("example.tauri", "Tauri", "1"));
        registry
            .add_surface(Surface::new(
                "gui",
                SurfaceKind::Gui,
                Reachability::InProcess,
                "data-action-id={action_id}",
            ))
            .unwrap();
        registry
            .register(
                ActionDescriptor::new(
                    "window.describe",
                    "Describe window",
                    "Return a description without reading pixels.",
                    json!({"type":"object"}),
                    json!({"type":"object"}),
                    Effects::read_only(),
                ),
                |context, _| Ok(json!({"core_execution_id":context.execution_id})),
            )
            .unwrap();

        let output = TauriAdapter::new(registry).call(DispatchRequest {
            action_id: "window.describe".into(),
            input: json!({}),
            confirmed: false,
            execution_id: Some("gui-request-7".into()),
            surface: Some("gui".into()),
        });
        assert_eq!(output["execution_id"], "gui-request-7");
        assert_eq!(output["result"]["core_execution_id"], "gui-request-7");
    }
}
