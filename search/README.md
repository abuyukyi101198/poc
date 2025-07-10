# MAAS Search & Filter UX Demo

This is a terminal-based proof of concept demonstrating the redesigned search and filter user experience proposed for MAAS UI table views.

## What This Demo Shows

This demo simulates the unified, keyboard-friendly search interface intended to replace the existing search text field and filter dropdown components in MAAS. It includes:

- A single input field that supports both fuzzy text search and structured filters.
- Live suggestions for available filter names and values.
- Context-aware interactions, such as inserting operators for numeric filters.
- Real-time feedback as the user types, with results shown in a mock table.
- A toggleable **Power User Mode**, which reveals the equivalent CLI-style query syntax.

This is not the actual implementation that will be used in the MAAS UI, but a low-fidelity interactive prototype to validate core concepts and user flow.

## Requirements

- Python 3.x
- A full-screen terminal (min 80x24 recommended)

## How to Run

1. Clone or download this project.
2. Ensure your terminal is full-screen or large enough to fit the interface.
3. In the `/search` directory, run:
```sh
python3 search.py
```
4. Use your keyboard to:
   - Type filters like `status(deployed)` or `zone(default)`
   - Perform fuzzy searches by typing any text outside of a filter
   - Navigate suggestions with arrow keys, and select with Enter
   - Toggle **Power User Mode** with `Tab` (in demo only)

5. Press `ESC` to exit the demo.

