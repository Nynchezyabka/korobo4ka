# Project architecture rules

- Route all user-content deletion feedback through `showUndoToast`; this keeps the five-second “Отменить” recovery consistent across tasks, projects, notes, repeats, and checklists.
- Use the shared `AiModelPicker` wherever users can invoke AI; this keeps the active source and model consistent between «Разбор» and project steps.