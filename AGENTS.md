# Project architecture rules

- Route all user-content deletion feedback through `showUndoToast`; this keeps the five-second “Отменить” recovery consistent across tasks, projects, notes, repeats, and checklists.