# Project architecture rules

- Route all user-content deletion feedback through `showUndoToast`; this keeps the five-second “Отменить” recovery consistent across tasks, projects, notes, repeats, and checklists.
- Use the shared `AiModelPicker` wherever users can invoke AI; this keeps the active source and model consistent between «Разбор» and project steps.
- Pass a project's optional `description` into every steps request (client prompt, `demo-ai`, `suggest-steps`); the plan quality depends on that context, not just the title.
- Keep production paper effects centralized in `paperFx`: completed items fold like an envelope, deleted items dissolve into dust; this preserves one consistent motion language across the app.
