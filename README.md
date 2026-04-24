# Coding Notebook Sheets App

This application recreates the feel of the uploaded coding notebook PDF as a working data-entry and code-running app.

## Main features
- Notebook sheet interface based on the uploaded PDF layout
- Create, store, edit, delete, duplicate, and save coding sheets
- Automatic browser storage with JSON import/export
- 18 numbered code lines that mirror the paper sheet
- Comments, summary, lecture, concept, filename, and day fields
- Python runner panel using Pyodide in the browser
- Purple and green themes matching the two uploaded sheets

## Files
- `index.html` – main application
- `styles.css` – notebook styling
- `app.js` – CRUD, storage, import/export, and Python runtime logic

## How to use
1. Open `index.html` in a browser.
2. Fill in the sheet fields.
3. Click **Save Sheet** or leave autosave on.
4. Use **Export JSON** to back up all sheets.
5. Use **Import JSON** to restore sheets.
6. Click **Load 01–18 into Runner** and then **Run Python** to execute the code.

## Notes
- Browser storage is local to the browser profile unless you export the JSON.
- Python execution requires an internet connection the first time so Pyodide can load from CDN.


## Python Runner Update
This version includes an Online-Python Pyodide-style runner: browser-based Pyodide/WebAssembly execution, Ctrl+Enter run shortcut, input() prompt support, package installation with micropip, opening .py files, copying code, downloading main.py, and a button that opens https://www.online-python.com/pyodide for an external IDE workspace.


## Online-style runner response
The Python Runner now displays progress messages similar to the Online-Python execution panel: Run started, Initializing environment, Installing packages, Running code, followed by Python output or traceback errors.

## Runner update: terminal-style input
The Python Runner no longer uses browser pop-up prompts for `input()`. When a program reaches an `input()` question, the question appears directly in the Output/Terminal area and a small inline answer field appears beside it. Type the answer there and press Enter to continue the run.
