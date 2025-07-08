import curses
import re
from table import generate_machines, draw_machine_table

filters = ["STATUS", "TAGS", "ZONE", "FABRIC", "CORES", "RAM", "DISKS", "STORAGE"]

def parse_filters(input_str):
    # Simple regex to match FILTER_NAME(values) e.g. STATUS(deployed,commissioning)
    pattern = r'(\w+)\(([^)]*)\)'
    found = re.findall(pattern, input_str.upper())

    filter_dict = {}
    for filter_name, values_str in found:
        if filter_name in filters:
            values = [v.strip() for v in values_str.split(",") if v.strip()]
            filter_dict[filter_name] = values
    return filter_dict

def machine_matches(machine, filters):
    for filter_name, values in filters.items():
        machine_val = machine.get(filter_name)
        if machine_val is None:
            return False

        # Normalize machine_val to list for TAGS, else single item
        if isinstance(machine_val, list):
            # Check if any of machine's list values match any filter values (case insensitive substring)
            if not any(any(v.lower() in mv.lower() for mv in machine_val) for v in values):
                return False
        else:
            # For numeric filters, compare as string or numeric
            # Try numeric comparison if filter is numeric
            if filter_name in {"CORES", "RAM", "DISKS"}:
                # Match if str(int) equals any filter values (as int)
                try:
                    machine_num = int(machine_val)
                    if not any(str(machine_num) == str(int(v)) for v in values if v.isdigit()):
                        return False
                except ValueError:
                    return False
            elif filter_name == "STORAGE":
                # storage is float, match if machine storage >= any value (numeric filter)
                try:
                    machine_storage = float(machine_val)
                    # Accept filter values like ">1" or "1.5"
                    # We'll support only >= for now (simple)
                    matched = False
                    for v in values:
                        v_clean = v.strip()
                        if v_clean.startswith(">"):
                            try:
                                val = float(v_clean[1:])
                                if machine_storage > val:
                                    matched = True
                            except:
                                pass
                        else:
                            try:
                                val = float(v_clean)
                                if machine_storage == val:
                                    matched = True
                            except:
                                pass
                    if not matched:
                        return False
                except:
                    return False
            else:
                # String filter, match if any filter value is substring of machine_val
                if not any(v.lower() in str(machine_val).lower() for v in values):
                    return False
    return True

def extract_active_filter(input_str):
    if "(" not in input_str:
        return None, None
    try:
        before_paren = input_str.rsplit("(", 1)[0]
        active_filter = before_paren.strip().split()[-1].upper()
        inside_text = input_str.rsplit("(", 1)[1]
        return active_filter if active_filter in filters else None, inside_text
    except IndexError:
        return None, None

def get_suggestions_for_filter(machines, filter_name, inside_text):
    values = set()
    for m in machines:
        val = m.get(filter_name)
        if isinstance(val, list):
            values.update(val)
        elif val is not None:
            values.add(str(val))

    parts = [p.strip() for p in inside_text.split(",")]
    last_term = parts[-1].lower()

    # Fuzzy match contains
    suggestions = sorted([v for v in values if last_term in v.lower()])
    return suggestions

def draw_interface(stdscr, prompt, input_str, cursor_pos, suggestions, selected_index, machines):
    stdscr.clear()
    height, width = stdscr.getmaxyx()
    curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)  # prompt
    curses.init_pair(2, curses.COLOR_WHITE, curses.COLOR_BLACK)  # default

    prompt_text = prompt.rstrip()
    stdscr.attron(curses.color_pair(1))
    stdscr.addstr(0, 0, prompt_text.upper())
    stdscr.attroff(curses.color_pair(1))
    stdscr.addstr(0, len(prompt_text), " ")
    stdscr.addstr(0, len(prompt_text) + 1, input_str + " " * (width - len(prompt_text) - len(input_str) - 2))
    stdscr.move(0, len(prompt_text) + 1 + cursor_pos)

    reserved_lines = 8
    for idx in range(reserved_lines):
        y = 1 + idx
        if y >= height:
            break
        if idx < len(suggestions):
            suggestion = suggestions[idx]
            prefix = "> " if idx == selected_index else "  "
            stdscr.addstr(y, len(prompt_text) + 1, prefix + suggestion)
        else:
            stdscr.addstr(y, len(prompt_text) + 1, " " * (width - len(prompt_text) - 1))

    table_start_line = 1 + reserved_lines + 1
    draw_machine_table(stdscr, machines, start_line=table_start_line)

def search_with_table(stdscr):
    curses.curs_set(1)
    prompt = "Search: "
    input_str = ""
    cursor_pos = 0
    selected_index = 0

    machines = generate_machines(10)

    while True:
        active_filter, inside_text = extract_active_filter(input_str)
        if active_filter:
            suggestions = get_suggestions_for_filter(machines, active_filter, inside_text)
        else:
            text = input_str.strip().upper()
            suggestions = [f for f in filters if text in f]
        selected_index = max(0, min(selected_index, len(suggestions) - 1))

        # Parse filters and filter machines accordingly
        parsed_filters = parse_filters(input_str)
        filtered_machines = [m for m in machines if machine_matches(m, parsed_filters)]

        draw_interface(stdscr, prompt, input_str, cursor_pos, suggestions, selected_index, filtered_machines)

        key = stdscr.getch()

        if key in (27,):  # ESC
            break
        elif key == curses.KEY_UP:
            selected_index = max(0, selected_index - 1)
        elif key == curses.KEY_DOWN:
            selected_index = min(len(suggestions) - 1, selected_index + 1)
        elif key in (10, 13):  # Enter
            if active_filter and suggestions:
                value_to_insert = suggestions[selected_index]
                before = input_str.rsplit("(", 1)[0] + "("
                existing_values = input_str.rsplit("(", 1)[1]
                parts = [p.strip() for p in existing_values.split(",")]
                parts[-1] = value_to_insert
                new_inside = ", ".join(parts)
                input_str = before + new_inside
                cursor_pos = len(input_str)
            elif suggestions:
                selected = suggestions[selected_index]
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