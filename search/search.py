import curses
from table import generate_machines, draw_machine_table

filters = ["STATUS", "TAGS", "ZONE", "FABRIC", "CORES", "RAM", "DISKS", "STORAGE"]

def draw_interface(stdscr, prompt, input_str, cursor_pos, filtered_filters, selected_index, machines):
    stdscr.clear()
    height, width = stdscr.getmaxyx()
    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)  # prompt
    curses.init_pair(2, curses.COLOR_WHITE, curses.COLOR_BLACK)  # default

    # Draw prompt
    prompt_text = prompt.rstrip()
    stdscr.attron(curses.color_pair(1))
    stdscr.addstr(0, 0, prompt_text.upper())
    stdscr.attroff(curses.color_pair(1))
    stdscr.addstr(0, len(prompt_text), " ")
    stdscr.addstr(0, len(prompt_text) + 1, input_str + " " * (width - len(prompt_text) - len(input_str) - 2))
    stdscr.move(0, len(prompt_text) + 1 + cursor_pos)

    # Draw filter suggestions
    reserved_lines = 8  # Reserve 8 lines always
    for idx in range(reserved_lines):
        y = 1 + idx
        if y >= height:
            break
        if idx < len(filtered_filters):
            f = filtered_filters[idx]
            prefix = "> " if idx == selected_index else "  "
            stdscr.addstr(y, len(prompt_text) + 1, prefix + f)
        else:
            stdscr.addstr(y, len(prompt_text) + 1, " " * (width - len(prompt_text) - 1))

    # Draw machine table
    table_start_line = 1 + reserved_lines + 1  # +1 for spacing
    draw_machine_table(stdscr, machines, start_line=table_start_line)

def filter_filters(input_str):
    if not input_str.strip():
        return filters
    return [f for f in filters if f.startswith(input_str.strip().upper())]

def search_with_table(stdscr):
    curses.curs_set(1)
    prompt = "Search: "
    input_str = ""
    cursor_pos = 0
    selected_index = 0

    machines = generate_machines(10)

    while True:
        filtered_filters = filter_filters(input_str)
        selected_index = max(0, min(selected_index, len(filtered_filters) - 1))

        draw_interface(stdscr, prompt, input_str, cursor_pos, filtered_filters, selected_index, machines)

        key = stdscr.getch()

        if key in (27,):  # ESC
            break
        elif key == curses.KEY_UP:
            selected_index = max(0, selected_index - 1)
        elif key == curses.KEY_DOWN:
            selected_index = min(len(filtered_filters) - 1, selected_index + 1)
        elif key in (10, 13):
            if filtered_filters:
                selected = filtered_filters[selected_index]
                input_str = selected + "("
                cursor_pos = len(input_str)
        elif key in (curses.KEY_BACKSPACE, 127, 8):
            if cursor_pos > 0:
                input_str = input_str[:cursor_pos - 1] + input_str[cursor_pos:]
                cursor_pos -= 1
        elif key == curses.KEY_LEFT and cursor_pos > 0:
            cursor_pos -= 1
        elif key == curses.KEY_RIGHT and cursor_pos < len(input_str):
            cursor_pos += 1
        elif 32 <= key <= 126:
            input_str = input_str[:cursor_pos] + chr(key) + input_str[cursor_pos:]
            cursor_pos += 1

def main(stdscr):
    search_with_table(stdscr)

if __name__ == "__main__":
    curses.wrapper(main)