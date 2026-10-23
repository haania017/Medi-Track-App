# Workflow preferences

- Expects a real, running implementation — not a plan, wireframe, static mockup, or collection of code snippets. Wants the agent to build, run, test, and fix the actual application. Confidence: 0.8
- Never silently removes or downgrades requested features (e.g. replacing functionality with decorative buttons). Maintains a requirements checklist and assigns each feature an implementation status. Confidence: 0.75
- Verifies integrations rather than asserting them; states honestly when something is unimplemented or requires configuration or credentials. Confidence: 0.8
- Writes and runs automated tests across backend and frontend, using a separate test database and synthetic data rather than real records. Confidence: 0.65
- Inspects the existing workspace and dependencies before making changes, and preserves working code where possible. Confidence: 0.6
- Prefers a phased workflow: inspect/architect → build → connect and integrate → verify/test → document. Confidence: 0.5
