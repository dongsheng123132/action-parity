use action_parity_core::{
    ActionDefinition, ActionError, Application, DispatchRequest, Effects, Reachability, Registry,
    Surface, SurfaceKind,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::sync::{Arc, Mutex};

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct CreateNoteInput {
    #[schemars(length(min = 1))]
    title: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct ListNotesInput {}

#[derive(Debug, Clone, Serialize, JsonSchema)]
struct CreatedNote {
    id: String,
    title: String,
    core_execution_id: String,
}

#[derive(Debug, Serialize, JsonSchema)]
struct ListNotesOutput {
    notes: Vec<CreatedNote>,
    core_execution_id: String,
}

fn main() {
    let args = env::args().skip(1).collect::<Vec<_>>();
    let registry = build_registry();
    let output = match args.first().map(String::as_str) {
        Some("export") => registry.artifact_bundle(),
        Some("help-json") => registry.cli_help(),
        Some("mcp-tools") => registry.mcp_tools(),
        Some("call") => match call(&registry, &args[1..]) {
            Ok(value) => value,
            Err(message) => {
                eprintln!("{message}");
                std::process::exit(64);
            }
        },
        _ => {
            eprintln!(
                "usage: notes-registry export | help-json | mcp-tools | call <surface> <action-id> <input-json> [execution-id] [--confirm]"
            );
            std::process::exit(64);
        }
    };
    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}

fn call(registry: &Registry, args: &[String]) -> Result<Value, String> {
    if args.len() < 3 {
        return Err("call needs <surface> <action-id> <input-json>".into());
    }
    let input =
        serde_json::from_str(&args[2]).map_err(|error| format!("invalid input JSON: {error}"))?;
    let execution_id = args
        .get(3)
        .filter(|value| value.as_str() != "--confirm")
        .cloned();
    let envelope = registry.dispatch(DispatchRequest {
        action_id: args[1].clone(),
        input,
        confirmed: args.iter().any(|arg| arg == "--confirm"),
        execution_id,
        surface: Some(args[0].clone()),
    });
    Ok(serde_json::to_value(envelope).unwrap())
}

fn build_registry() -> Registry {
    let mut registry = Registry::new(Application {
        id: "org.actionparity.real-notes".into(),
        name: "Real Notes Registry Example".into(),
        version: "0.1.0".into(),
        description: Some("One Rust Action Registry exported to GUI, CLI, and MCP Shadows.".into()),
        homepage: None,
        source: Some("https://github.com/dongsheng123132/action-parity".into()),
    })
    .generator_revision("examples/rust-registry/src/main.rs");

    for mut surface in [
        Surface::new(
            "gui",
            SurfaceKind::Gui,
            Reachability::InProcess,
            "data-action-id={action_id}",
        ),
        Surface::new(
            "cli",
            SurfaceKind::Cli,
            Reachability::External,
            "notes-registry call cli {action_id} <input-json> --json",
        ),
        Surface::new(
            "mcp",
            SurfaceKind::Mcp,
            Reachability::LocalIpc,
            "tool:{action_id}",
        ),
    ] {
        surface.binding_test = Some("tests/parity.test.mjs".into());
        surface.test_driver = Some("node --test".into());
        registry.add_surface(surface).unwrap();
    }

    let notes = Arc::new(Mutex::new(Vec::<CreatedNote>::new()));
    let write_notes = Arc::clone(&notes);
    registry
        .register_typed(
            ActionDefinition::new(
                "note.create",
                "Create note",
                "Create one note in the in-memory example store.",
                Effects::write(true),
            )
            .timeout_ms(1_000)
            .evidence("cargo test -p action-parity-rust-registry-example"),
            move |context, input: CreateNoteInput| {
                let title = input.title.trim();
                if title.is_empty() {
                    return Err(ActionError::input(
                        "title_required",
                        "title must be a non-empty string",
                    ));
                }
                let mut notes = write_notes.lock().unwrap();
                let note = CreatedNote {
                    id: format!("note-{}", notes.len() + 1),
                    title: title.to_string(),
                    core_execution_id: context.execution_id.clone(),
                };
                notes.push(note.clone());
                Ok(note)
            },
        )
        .unwrap();

    let read_notes = Arc::clone(&notes);
    registry
        .register_typed(
            ActionDefinition::new(
                "note.list",
                "List notes",
                "List notes from the in-memory example store.",
                Effects::read_only(),
            )
            .idempotent()
            .timeout_ms(1_000)
            .evidence("cargo test -p action-parity-rust-registry-example"),
            move |context, _: ListNotesInput| {
                Ok(ListNotesOutput {
                    notes: read_notes.lock().unwrap().clone(),
                    core_execution_id: context.execution_id.clone(),
                })
            },
        )
        .unwrap();

    registry
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn every_shadow_reaches_the_same_core_envelope() {
        let registry = build_registry();
        for surface in ["gui", "cli", "mcp"] {
            let execution_id = format!("{surface}-trace-1");
            let output = registry.dispatch(DispatchRequest {
                action_id: "note.create".into(),
                input: json!({"title":surface}),
                confirmed: false,
                execution_id: Some(execution_id.clone()),
                surface: Some(surface.into()),
            });
            assert!(output.ok);
            assert_eq!(output.execution_id, execution_id);
            assert_eq!(output.result.unwrap()["core_execution_id"], execution_id);
        }
    }
}
