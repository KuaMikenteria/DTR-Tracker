# OJT DTR Tracker

A **Daily Time Record (DTR) tracker** designed for OJT (On-the-Job Training) students/interns.  
It helps you log your daily shift hours, track progress toward your target OJT hours, and manage your entries with an intuitive interface.

> **Two versions are provided:**  
> - **Full‑stack** (Flask + JSON) – saves data persistently.  
> - **Standalone** (pure HTML/CSS/JS) – runs entirely in the browser, no server needed.

---

## 📖 Description

The **OJT DTR Tracker** lets you:

- Record **morning**, **afternoon**, and **overtime** sessions.
- Automatically calculate **total hours per shift**.
- Set a **target number of OJT hours** (e.g., 480 hours).
- Visualize progress with a **progress bar** and statistics (total shifts, average hours, completed hours, remaining hours).
- View, edit, or delete existing shifts.
- **Group** shifts by **month** or **week** for better overview.
- **Sort** shifts by newest or oldest.
- Use **dark mode** for comfortable night‑time use.
- **Edit shifts via a modal popup** – no more scrolling back to the top of the page.
- Receive a **success toast notification** after saving changes.

---

## 🎯 Purpose

This tool was built to simplify the tedious process of manually tracking OJT hours.  
Instead of using spreadsheets or paper logs, you can:

- Quickly log daily time in/out.
- See your remaining hours at a glance.
- Correct mistakes with a single click (via the modal edit).
- Keep a clean, searchable history of all shifts.

It is especially useful for interns, trainees, and supervisors who need to monitor attendance and hour accumulation over an extended period.

---

## 🚀 Step‑by‑Step Guide

### 1. Choose your version

| Version | File | Description |
|---------|------|-------------|
| **Full‑stack** | `main.py`, `templates/index.html`, `static/script.js`, `static/style.css` | Requires Python and Flask. Saves data to `data.json`. |
| **Standalone** | `dtr.tracker.html` (or the provided single HTML file) | No installation. Just open in a browser. All data stays in memory (lost on refresh). |

---

### 2. Running the Full‑stack Version

#### Prerequisites
- Python 3.7+ installed on your machine.
- `pip` (Python package manager).

#### Steps
1. **Clone or download** the project files.
2. Open a terminal/command prompt in the project folder.
3. Install Flask:
   ```bash
   pip install flask