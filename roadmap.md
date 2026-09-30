# Roadmap

- [x] Add a persistent light/dark/3D appearance selector.
- [x] Port the reference desk, boxes, paper model, lighting, labels, counters, and animations.
- [x] Connect the 3D home to existing tasks, timer, category lists, and task creation.
- [x] Keep all non-home sections in their current interface.
- [x] Verify TypeScript and live WebGL rendering on desktop and mobile dimensions.
- [x] Resize the list/plus label buttons smaller.
- [x] In landscape mode, place the list/plus buttons as separate stickers on the front wall of the boxes.
- [x] Remove the overflow dots from every 3D box.
- [x] Place portrait list/plus actions vertically on the right side of each box.
- [x] Center and slightly rotate the portrait stack to match the supplied reference.
- [x] Separate the portrait title and appearance selector so they never overlap.
- [x] Increase the 3D sidebar transparency while preserving icon readability.
- [x] Fit the portrait stack into the safe area on varying phone heights.
- [x] Extend the 3D background beneath the translucent sidebar.
- [x] Stack the appearance controls vertically at the mobile top-right.
- [x] Verify portrait layouts, sidebar states, and 3D interactions without publishing.
- [x] Keep the portrait table below the complete bottom box and its label.
- [x] Replace the three-option appearance selector with one cycling icon button.

## Разбор: ничего не пропадает
- [x] Неподтверждённые карточки разбора («не задача» + снятые галочки) сохраняются как обработанные заметки
 - [x] Блок «Обработанные · N» в «Накопленных заметках» с раскрытием и удалением
- [x] Починить нечитаемые чипы «Предложенные шаги» в тёмной теме (ProjectsPanel)
- [x] Единое уведомление с «Отменить» при удалении задач, шагов, проектов, заметок, повторов и пользовательских чек-листов

## Анимации «сложить / сжечь»
- [x] Выполненная задача улетает бумажкой в коробочку (список, таймер, шаги проекта)
- [x] Удалённое вспыхивает и осыпается на месте (список, календарь, проекты, чек-листы, заметки, повторы, «Разбор»)
- [x] Эффект не задерживает само действие; отключается при «меньше движения»

## Разбор: внешние материалы
- [x] Прикрепление текстового файла (.txt/.md) к полю разбора
- [x] Вставка ссылки: серверная функция fetch-url скачивает страницу и извлекает текст
- [x] Подпись о новой возможности в описании «Разбора» и на странице «О приложении»
