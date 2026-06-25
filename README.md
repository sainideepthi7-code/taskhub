# ⚡ TaskHub

A clean, modern task management app with a sidebar layout, dark mode, subtasks, priorities, categories, and real-time due-date alerts — all in pure HTML, CSS, and JavaScript. No build tools, no dependencies, no backend.

![TaskHub Preview](preview.png)

## ✨ Features

- **Add tasks** with name, due date, priority (High / Medium / Low), and category
- **Subtasks** with per-task progress bars
- **Sidebar navigation** — filter by All, Due Today, Overdue, Completed, or Category
- **Search & sort** — find tasks by name; sort by newest, due date, priority, or name
- **Dark / Light mode** toggle, persisted across sessions
- **Floating action bar** — Edit, Mark Done, Remove when a task is selected
- **Due-date notifications** — alerts for overdue tasks and tasks due tomorrow
- **Progress tracker** — shows how many tasks you've completed
- **Fully responsive** — works on mobile and desktop
- **LocalStorage persistence** — tasks survive page refreshes

## 🚀 Getting Started

Just open `index.html` in your browser — no server required.

```bash
git clone https://github.com/YOUR_USERNAME/taskhub.git
cd taskhub
open index.html
```

## 📁 File Structure

```
taskhub/
├── index.html    # App markup
├── styles.css    # All styling & themes
├── script.js     # App logic (TodoApp class)
└── README.md
```

## 🛠 Tech Stack

- **HTML5** — semantic structure
- **CSS3** — CSS custom properties for theming, CSS Grid & Flexbox for layout
- **Vanilla JavaScript** — ES6 class-based architecture
- **Font Awesome 6** — icons
- **Google Fonts** — Inter + Space Grotesk
- **LocalStorage** — data persistence

## 📝 License

MIT — use it however you like.
