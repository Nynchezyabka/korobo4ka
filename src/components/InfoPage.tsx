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
            КОРОБОЧКА — это цифровая коробка с бумажками для тех, кто устал решать, с чего начать.
          </p>
          <p className="mt-2">
            Вы ссыпаете дела в цветные отделения, вытягиваете одно наугад и работаете по таймеру.
            Это «лайтовая» самодисциплина: содержание определяете вы, а паузу можно сделать в любой момент.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            🗂️ Шесть отделений
          </h3>
          <p className="mb-3">
            Именно категории здесь работают как инструмент мотивационной гигиены (по методике психолога Виолетты Макеевой):
            они расставляют дела не по срочности, а по источнику энергии. А сама Коробочка — это механизм, который снимает
            с вас груз выбора, когда сил решать уже нет.
          </p>
          <div className="grid gap-2">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-1-bg/50">
              <span className="text-lg leading-none mt-0.5">🟨</span>
              <div><strong>Обязательные</strong> <span className="text-muted-foreground">— срочное и важное: работа, дом, здоровье, финансы, учёба</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-2-bg/50">
              <span className="text-lg leading-none mt-0.5">🟦</span>
              <div><strong>Безопасность</strong> <span className="text-muted-foreground">— базовые потребности: подушка безопасности, документы, навыки</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-3-bg/50">
              <span className="text-lg leading-none mt-0.5">🟩</span>
              <div><strong>Простые радости</strong> <span className="text-muted-foreground">— приятные мелочи: прогулки, творчество, чтение, музыка</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-4-bg/50">
              <span className="text-lg leading-none mt-0.5">🟥</span>
              <div><strong>Эго-радости</strong> <span className="text-muted-foreground">— дела ради статуса и признания: карьера, достижения</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-cat-5-bg/50">
              <span className="text-lg leading-none mt-0.5">🟪</span>
              <div><strong>Доступность радостей</strong> <span className="text-muted-foreground">— условия, без которых радости не случаются: время, деньги, энергия</span></div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50">
              <span className="text-lg leading-none mt-0.5">⚪</span>
              <div><strong>Без категории</strong> <span className="text-muted-foreground">— всё, что пока не разобрано</span></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ✏️ Названия отделений и подкатегорий можно переименовать под себя.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            🔄 Как пользоваться
          </h3>
          <ol className="space-y-2.5">
            {[
              ["➊", "Насыпьте дела в коробочку — по одному, списком или голосом. Не сортируя."],
              ["➋", "Разложите по отделениям — как бумажки по секциям (или доверьте это «Разбору»)."],
              ["➌", "Вытяните 🎲 — приложение выберет случайную задачу из отделения."],
              ["➍", "Поработайте по таймеру — время настраивается (по умолчанию 10 минут)."],
              ["➎", "Отметьте результат — ✅ Готово или 🔄 Вернуть в коробочку. Вернуть — это нормально и безопасно."],
            ].map(([num, text]) => (
              <li key={num} className="flex items-start gap-2.5">
                <span className="text-primary font-bold text-base leading-none mt-0.5">{num}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3">
            Застряли? Кнопка «С чего начать?» предложит микрошаг на одну минуту и мягко спросит, что именно мешает.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-3 flex items-center gap-2">
            ⚡ Возможности
          </h3>
          <div className="grid gap-1.5">
            {[
              ["🎲", "Случайный выбор", "вытягивание бумажки вслепую из любого отделения"],
              ["⏱️", "Таймер фокуса", "настраиваемое время, фон под цвет категории"],
              ["✨", "Ассистент «Разбор»", "поток мыслей → задачи, проекты, заметки (всё редактируется перед сохранением)"],
              ["📁", "Проекты", "большое дело со списком шагов и готовыми чек-листами"],
              ["🔄", "Повторяющиеся задачи", "появляются сами в заданный час или день недели"],
              ["📊", "История и статистика", "календарь выполненного и время по категориям"],
              ["🎙️", "Голосовой ввод", "в быстром добавлении и в «Разборе»"],
              ["🏷️", "Подкатегории", "предустановленные и свои, прямо в карточке"],
              ["👁️", "Скрытие задач", "чтобы дело не попадалось случайно, пока не настало его время"],
              ["🌙", "Тёмная тема и 3D-главная", "светлая, тёмная и объёмная коробочка"],
              ["🔤", "Размер шрифта и скин", "«Коробочка» или «Строгий» (если рукописный читать тяжело)"],
              ["🔑", "Свой ключ ИИ", "хранится только на вашем устройстве"],
              ["💾", "Автономная работа", "всё на вашем устройстве, работает без интернета"],
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
            Здесь нет аккаунтов и серверов, которые хранили бы ваши дела. Все задачи лежат в браузере на вашем устройстве
            и никуда не отправляются. Приложение работает офлайн.
          </p>
          <p className="mt-2">
            Единственное исключение — ассистент «Разбор»: текст, который вы сами отправили, уходит к языковой модели,
            чтобы вернуться разобранным. Остальное работает полностью локально.
          </p>
        </section>

        <hr className="border-border" />

        <section>
          <h3 className="font-semibold text-base sm:text-lg mb-2 flex items-center gap-2">
            🛠️ Как это сделано
          </h3>
          <p>
            Приложение развивается через вайбкодинг: идеи, код и тексты рождаются вместе с нейросетями
            (Lovable, Claude, DeepSeek и др.).
          </p>
          <p className="mt-2">
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
