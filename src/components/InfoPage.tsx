export function InfoPage() {
  return (
    <div className="animate-fade-in space-y-6 pb-8">
      <h2 className="text-2xl font-display text-primary flex items-center gap-2">
        📖 О приложении
      </h2>

      <div className="bg-card rounded-xl border border-border p-5 space-y-5 text-sm sm:text-base text-foreground/90 leading-relaxed">
        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
            🎁 Что такое КОРОБОЧКА?
          </h3>
          <p>
            КОРОБОЧКА — цифровая коробка с бумажками для тех, у кого «надо» не превращается в «сделано».
            Методика взята из мотивационной гигиены психолога Виолетты Макеевой.
          </p>
          <p className="mt-2">
            Вы ссыпаете дела в цветные отделения, вытягиваете одно наугад и работаете по таймеру.
            Это «лайтовая» самодисциплина: содержание определяете вы, паузу можно сделать в любой момент.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            🗂️ Шесть отделений
          </h3>
          <div className="grid gap-2">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-1-bg/50">
              <span className="text-lg leading-none mt-0.5">🟨</span>
              <div><strong>Обязательные</strong> <span className="text-muted-foreground">— срочное и важное: работа, дом, здоровье, финансы, учёба</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-2-bg/50">
              <span className="text-lg leading-none mt-0.5">🟦</span>
              <div><strong>Безопасность</strong> <span className="text-muted-foreground">— базовые потребности и подушки на всякий случай</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-3-bg/50">
              <span className="text-lg leading-none mt-0.5">🟩</span>
              <div><strong>Простые радости</strong> <span className="text-muted-foreground">— приятные мелочи ради себя</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-4-bg/50">
              <span className="text-lg leading-none mt-0.5">🟥</span>
              <div><strong>Эго-радости</strong> <span className="text-muted-foreground">— статус, признание, достижения</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-accent/30">
              <span className="text-lg leading-none mt-0.5">🟪</span>
              <div><strong>Доступность радостей</strong> <span className="text-muted-foreground">— условия, без которых радости не случаются</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50">
              <span className="text-lg leading-none mt-0.5">⚪</span>
              <div><strong>Без категории</strong> <span className="text-muted-foreground">— всё, что пока не разобрано</span></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ✏️ Названия отделений и подкатегорий можно переименовать.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            🔄 Как пользоваться
          </h3>
          <ol className="space-y-2.5">
            {[
              ["➊", "Добавьте задачи в отделения — по одному, списком или голосом"],
              ["➋", "Нажмите на секцию или «🎲 случайная задача» — вытяните бумажку"],
              ["➌", "Работайте по таймеру — время настраивается"],
              ["➍", "Отметьте результат — ✅ Готово или 🔄 Вернуть в коробочку"],
              ["➎", "Застряли? Кнопка «С чего начать?» предложит микрошаг"],
            ].map(([num, text]) => (
              <li key={num} className="flex items-start gap-2.5">
                <span className="text-primary font-bold text-base leading-none mt-0.5">{num}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            ⚡ Возможности
          </h3>
          <div className="grid gap-1.5">
            {[
              ["🎲", "Случайный выбор", "вытягивание бумажки вслепую"],
              ["⏱️", "Таймер фокуса", "настраиваемое время, фон под цвет категории"],
              ["✨", "Ассистент «Разбор»", "поток мыслей → задачи, проекты, повторяющиеся дела"],
              ["📁", "Проекты", "чек-листы по шагам, по порядку или в любом"],
              ["🔄", "Повторяющиеся задачи", "по дням недели, интервалу, с датой окончания"],
              ["📊", "История и статистика", "календарь выполненного, время по категориям"],
              ["🎙️", "Голосовой ввод", "в быстром добавлении и в «Разборе»"],
              ["🏷️", "Подкатегории", "предустановленные и свои, прямо в карточке"],
              ["👁️", "Скрытие задач", "чтобы дело не попадалось случайно"],
              ["📅", "Задачи на будущее", "с датой и временем"],
              ["🔔", "Уведомления", "напоминания через браузер"],
              ["🌙", "Тёмная тема и 3D-главная", "светлая, тёмная и объёмная коробочка"],
              ["🔤", "Размер шрифта и скин", "«Коробочка» или «Строгий»"],
              ["🔑", "Свой ключ ИИ", "DeepSeek, OpenRouter, OpenAI, Groq, Mistral, Google, локальные модели"],
              ["💾", "Автономная работа", "всё на вашем устройстве"],
              ["📱", "Установка как приложение", "добавьте на домашний экран (PWA)"],
              ["📤", "Экспорт и импорт", "резервная копия задач в JSON"],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex items-start gap-2 py-1">
                <span className="text-base leading-none mt-0.5">{icon}</span>
                <span><strong>{title}</strong> <span className="text-muted-foreground">— {desc}</span></span>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            💡 Советы
          </h3>
          <div className="grid gap-1.5">
            {[
              ["👆", "Нажмите на текст задачи для редактирования"],
              ["🏷️", "Нажмите на подкатегорию для смены или добавления новой"],
              ["📂", "Нажмите на иконку папки для смены категории"],
              ["⬆⬇", "Перетаскивайте задачи для изменения порядка"],
              ["👁️", "Скрывайте задачи, чтобы они не попадались случайно"],
              ["🔄", "Создавайте шаблоны для регулярных задач"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-2 py-1">
                <span className="text-base leading-none mt-0.5">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
            🔒 Приватность
          </h3>
          <p>
            Здесь нет аккаунтов, потому что нет сервера, который хранил бы ваши дела.
            Все задачи лежат в браузере на вашем устройстве и никуда не отправляются.
            Работает офлайн — в самолёте, в метро, на даче без связи.
          </p>
          <p className="mt-2">
            Единственное исключение — ассистент «Разбор»: текст, который вы сами вставили, уходит к языковой модели, чтобы вернуться разобранным.
            Остальные разделы работают полностью локально.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
            🛠️ Как это сделано
          </h3>
          <p>
            Приложение развивается через вайбкодинг: идеи, код, тексты и картинки рождаются вместе с несколькими нейросетями — Lovable, Claude, DeepSeek и другими.
            Под капотом: React 19, TypeScript, Vite, Tailwind CSS, IndexedDB, Service Worker.
          </p>
        </section>

        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Без регистрации · Бесплатно · Конфиденциально · Все данные на вашем устройстве
          </p>
        </div>
      </div>
    </div>
  );
}
