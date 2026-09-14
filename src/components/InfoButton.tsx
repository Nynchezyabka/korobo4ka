import { useState } from "react";
import { Info, X } from "lucide-react";

export function InfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
        aria-label="О приложении"
      >
        <Info size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-background rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 relative animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-muted text-muted-foreground hover:bg-accent transition-colors"
            >
              <X size={18} />
            </button>

            <h2 className="text-2xl font-display text-primary mb-4">🎁 КОРОБОЧКА</h2>

            <div className="space-y-5 text-sm sm:text-base text-foreground/90 leading-relaxed">
              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">📖 Что это</h3>
                <p>
                  КОРОБОЧКА — цифровая коробка с бумажками для тех, у кого «надо» не превращается в «сделано».
                  Методика взята из мотивационной гигиены психолога Виолетты Макеевой.
                  Вы ссыпаете дела в цветные отделения, вытягиваете одно наугад и работаете по таймеру.
                </p>
                <p className="mt-2">
                  Это «лайтовая» самодисциплина: содержание определяете вы, паузу можно сделать в любой момент.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">🗂️ Шесть отделений</h3>
                <ul className="space-y-1 list-none">
                  <li>🟨 <strong>Обязательные</strong> — срочное и важное</li>
                  <li>🟦 <strong>Безопасность</strong> — базовые потребности и подушки на всякий случай</li>
                  <li>🟩 <strong>Простые радости</strong> — приятные мелочи ради себя</li>
                  <li>🟥 <strong>Эго-радости</strong> — статус, признание, достижения</li>
                  <li>🟪 <strong>Доступность радостей</strong> — условия, без которых радости не случаются</li>
                  <li>⚪ <strong>Без категории</strong> — всё, что пока не разобрано</li>
                </ul>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Названия отделений и подкатегорий можно переименовать через иконку ✏️.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">🔄 Как пользоваться</h3>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Добавьте задачи в отделения — по одному, списком или голосом.</li>
                  <li>Нажмите на секцию или «🎲 случайная задача» — вытяните бумажку.</li>
                  <li>Работайте по таймеру, время настраивается.</li>
                  <li>Отметьте результат: ✅ Готово или 🔄 Вернуть в коробочку.</li>
                  <li>Застряли? Кнопка «С чего начать?» поможет найти микрошаг.</li>
                </ol>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">⚡ Возможности</h3>
                <ul className="space-y-1.5 list-none">
                  <li>🎲 <strong>Случайный выбор</strong> — как вытягивание бумажки из коробки</li>
                  <li>⏱️ <strong>Таймер фокуса</strong> — настраиваемое время, фон под цвет категории</li>
                  <li>✨ <strong>Ассистент «Разбор»</strong> — надиктуйте поток мыслей, он разложит на задачи, проекты и повторяющиеся дела</li>
                  <li>📁 <strong>Проекты</strong> — чек-листы по шагам, по порядку или в любом</li>
                  <li>🔄 <strong>Повторяющиеся задачи</strong> — по дням недели, интервалу, с датой окончания</li>
                  <li>📊 <strong>История и статистика</strong> — календарь выполненного, время по категориям</li>
                  <li>🌙 <strong>Тёмная тема и 3D-главная</strong> — светлая, тёмная и объёмная коробочка</li>
                  <li>🔤 <strong>Размер шрифта и скин</strong> — «Коробочка» с рукописным шрифтом или «Строгий»</li>
                  <li>🔑 <strong>Свой ключ ИИ</strong> — DeepSeek, OpenRouter, OpenAI, Groq, Mistral, Google, локальные модели</li>
                  <li>🔔 <strong>Уведомления</strong> — напоминания через браузер</li>
                  <li>💾 <strong>Автономная работа</strong> — всё на вашем устройстве, без интернета</li>
                  <li>📱 <strong>Установка как приложение</strong> (PWA) — добавьте на домашний экран</li>
                  <li>📤 <strong>Экспорт и импорт</strong> — резервная копия задач в JSON</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">💡 Советы</h3>
                <ul className="space-y-1 list-none">
                  <li>👆 Нажмите на текст задачи для редактирования</li>
                  <li>🏷️ Нажмите на подкатегорию для смены или добавления новой</li>
                  <li>📂 Нажмите на иконку папки для смены категории</li>
                  <li>⬆⬇ Перетаскивайте задачи для изменения порядка</li>
                  <li>👁️ Скрывайте задачи, чтобы они не попадались случайно</li>
                  <li>🔄 Создавайте шаблоны для регулярных задач</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">🔒 Приватность</h3>
                <p>
                  Здесь нет аккаунтов, потому что нет сервера, который хранил бы ваши дела.
                  Все задачи лежат в браузере на вашем устройстве и никуда не отправляются.
                  Работает офлайн — в самолёте, в метро, на даче без связи.
                  Единственное исключение — ассистент «Разбор»: текст, который вы сами вставили, уходит к языковой модели, чтобы вернуться разобранным.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base sm:text-lg mb-1">🛠️ Как это сделано</h3>
                <p>
                  Приложение развивается через вайбкодинг: идеи, код, тексты и картинки рождаются вместе с несколькими нейросетями — Lovable, Claude, DeepSeek и другими.
                  Под капотом: React 19, TypeScript, Vite, Tailwind CSS, IndexedDB, Service Worker.
                </p>
              </section>

              <p className="text-xs sm:text-sm text-muted-foreground pt-2 border-t border-border text-center">
                Без регистрации · Бесплатно · Конфиденциально · Все данные на вашем устройстве
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
