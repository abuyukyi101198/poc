import curses
from table import generate_machines  # Importing the data generator

filters = ["STATUS", "ZONE", "POOL", "OWNER", "FABRIC", "CPU", "MEMORY", "DISKS", "STORAGE"]

def draw_search_and_filters(stdscr, prompt, input_str, cursor_pos, filtered_filters, selected_index):
    stdscr.clear()
    height, width = stdscr.getmaxyx()

    # Colors
    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)  # For prompt
    curses.init_pair(2, curses.COLOR_WHITE, curses.COLOR_BLACK)  # Default

    # Draw prompt
    prompt_text = prompt.rstrip()
    stdscr.attron(curses.color_pair(1))
    stdscr.addstr(0, 0, prompt_text.upper())
    stdscr.attroff(curses.color_pair(1))
    stdscr.addstr(0, len(prompt_text), " ")
    stdscr.addstr(0, len(prompt_text) + 1, input_str + " " * (width - len(prompt_text) - len(input_str) - 2))
    stdscr.move(0, len(prompt_text) + 1 + cursor_pos)

    # Filter suggestions
    for idx, f in enumerate(filtered_filters):
        y = 1 + idx
        if y >= height:
            break
        prefix = "> " if idx == selected_index else "  "
        stdscr.addstr(y, 0, prefix + f)

def filter_filters(input_str):
    text = input_str.strip().upper()
    if not text:
        return []
    return [f for f in filters if f.startswith(text)]

def search_bar_with_filter_suggestions(stdscr):
    curses.curs_set(1)
    prompt = "Search: "
    input_str = ""
    cursor_pos = 0
    filtered_filters = []
    selected_index = 0

    machines = generate_machines(40)  # Prepare data (used in next steps)

    while True:
        filtered_filters = filter_filters(input_str)

        if filtered_filters:
            selected_index = max(0, min(selected_index, len(filtered_filters) - 1))
        else:
            selected_index = 0

        draw_search_and_filters(stdscr, prompt, input_str, cursor_pos, filtered_filters, selected_index)

        key = stdscr.getch()

        if key in (27,):  # ESC
            break
        elif key in (curses.KEY_UP,):
            selected_index = max(0, selected_index - 1)
        elif key in (curses.KEY_DOWN,):
            selected_index = min(len(filtered_filters) - 1, selected_index + 1)
        elif key in (curses.KEY_ENTER, 10, 13):
            if filtered_filters:
                selected_filter = filtered_filters[selected_index]
                insert_text = selected_filter + "("
                input_str = insert_text
                cursor_pos = len(insert_text)
        elif key in (curses.KEY_BACKSPACE, 127, 8):
            if cursor_pos > 0:
                input_str = input_str[:cursor_pos - 1] + input_str[cursor_pos:]
                cursor_pos -= 1
        elif key == curses.KEY_DC:
            if cursor_pos < len(input_str):
                input_str = input_str[:cursor_pos] + input_str[cursor_pos + 1:]
        elif key == curses.KEY_LEFT:
            if cursor_pos > 0:
                cursor_pos -= 1
        elif key == curses.KEY_RIGHT:
            if cursor_pos < len(input_str):
                cursor_pos += 1
        elif 32 <= key <= 126:
            input_str = input_str[:cursor_pos] + chr(key) + input_str[cursor_pos:]
            cursor_pos += 1

def main(stdscr):
    search_bar_with_filter_suggestions(stdscr)

if __name__ == "__main__":
    curses.wrapper(main)