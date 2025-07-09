import curses
import re
from table import generate_machines, draw_machine_table
import operator

filters = ["STATUS", "TAGS", "ZONE", "FABRIC", "CORES", "RAM", "DISKS", "STORAGE"]

comparison_ops = {
    ">=": operator.ge,
    "<=": operator.le,
    "!=": operator.ne,
    ">": operator.gt,
    "<": operator.lt,
    "=": operator.eq,
}

def parse_comparator(value_str):
    # Try to match the longest operator first (e.g., ">=" before ">")
    for op_symbol in sorted(comparison_ops.keys(), key=lambda x: -len(x)):
        if value_str.startswith(op_symbol):
            try:
                num = float(value_str[len(op_symbol):].strip())
                return comparison_ops[op_symbol], num
            except ValueError:
                return None, None
    # Default: treat as equality if it's a plain number
    try:
        num = float(value_str)
        return operator.eq, num
    except ValueError:
        return None, None

def is_cursor_outside_parentheses(input_str, cursor_pos):
    # Count '(' and ')' before cursor to see if we are inside parentheses
    before_cursor = input_str[:cursor_pos]
    open_count = before_cursor.count('(')
    close_count = before_cursor.count(')')
    return open_count == close_count

def parse_filters(input_str):
    pattern = r'(\w+)\(([^)]*)\)'
    found = re.findall(pattern, input_str.upper())

    filter_dict = {}
    used_spans = []

    for match in re.finditer(pattern, input_str.upper()):
        used_spans.append((match.start(), match.end()))

    # Add structured filters
    for filter_name, values_str in found:
        if filter_name in filters:
            values = [v.strip() for v in values_str.split(",") if v.strip()]
            filter_dict[filter_name] = values

    # Extract remaining free text
    covered = [range(start, end) for start, end in used_spans]
    free_text_parts = []
    last = 0
    for start, end in used_spans:
        free_text = input_str[last:start].strip()
        if free_text:
            free_text_parts.append(free_text)
        last = end
    if last < len(input_str):
        trailing = input_str[last:].strip()
        if trailing:
            free_text_parts.append(trailing)

    # Add as __text__ filter
    if free_text_parts:
        combined = " ".join(free_text_parts).strip()
        if combined:
            filter_dict["__text__"] = [combined]

    return filter_dict

def machine_matches(machine, filters):
    if "__text__" in filters:
        search_terms = filters["__text__"]
        fdqn = str(machine.get("FDQN", "")).lower()
        # All terms must appear somewhere in FDQN (fuzzy match)
        if not all(any(term.lower() in fdqn for term in search_terms) for term in search_terms):
            return False

    for filter_name, values in filters.items():
        if filter_name == "__text__":
            continue  # Already handled

        machine_val = machine.get(filter_name)
        if machine_val is None:
            return False

        # For list fields like TAGS
        if isinstance(machine_val, list):
            if not any(any(v.lower() in mv.lower() for mv in machine_val) for v in values):
                return False

        # For numeric fields with comparator support
        elif filter_name in {"CORES", "RAM", "DISKS", "STORAGE"}:
            try:
                machine_num = float(machine_val)
                matched = False
                for v in values:
                    op_func, num = parse_comparator(v)
                    if op_func and op_func(machine_num, num):
                        matched = True
                        break
                if not matched:
                    return False
            except Exception:
                return False

        # For other strings (FABRIC, ZONE, STATUS)
        else:
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

def filters_to_sql(filters_dict):
    clauses = []
    for key, values in filters_dict.items():
        if key == "__text__":
            for term in values:
                clauses.append(f"FDQN LIKE '%{term}%'")
        elif key in {"CORES", "RAM", "DISKS", "STORAGE"}:
            for val in values:
                # Support basic comparison parsing
                op = "="
                num = val
                for symbol in [">=", "<=", ">", "<", "="]:
                    if val.startswith(symbol):
                        op = symbol
                        num = val[len(symbol):]
                        break
                clauses.append(f"{key} {op} {num}")
        else:
            sub = " OR ".join([f"{key} LIKE '%{v}%'" for v in values])
            clauses.append(f"({sub})")
    return " AND ".join(clauses)

def search_with_table(stdscr):
    curses.curs_set(1)
    input_str = ""
    power_mode_input = ""
    cursor_pos = 0
    selected_index = 0
    power_mode = False
    active_filter = {}

    machines = generate_machines(10)
    last_parsed_filters = {}
    last_filtered_machines = machines
    last_fdqn_query = ""

    while True:
        prompt = "SQL> " if power_mode else "Search: "

        if power_mode:
            # In power mode, don't compute suggestions or update table
            suggestions = []
            filtered_machines = last_filtered_machines
        else:
            active_filter, inside_text = extract_active_filter(input_str)
            outside = is_cursor_outside_parentheses(input_str, cursor_pos)

            if active_filter and not outside:
                if active_filter in {"CORES", "RAM", "DISKS", "STORAGE"}:
                    valid_ops = [">", "<", ">=", "<=", "="]
                    inside_text = inside_text.strip()
                    suggestions = [op for op in valid_ops if op.startswith(inside_text)]
                else:
                    suggestions = get_suggestions_for_filter(machines, active_filter, inside_text)
            else:
                current_word_start = input_str.rfind(' ', 0, cursor_pos) + 1
                filter_prefix = input_str[current_word_start:cursor_pos].upper()
                suggestions = [f for f in filters if filter_prefix in f] if filter_prefix else filters

            selected_index = max(0, min(selected_index, len(suggestions) - 1))

            # Parse filters and filter machines accordingly
            parsed_filters = parse_filters(input_str)
            non_filter_parts = re.sub(r'\w+\([^)]+?\)', '', input_str).strip()
            current_fdqn_query = non_filter_parts.lower()

            filter_just_closed = (
                input_str.count(")") > "".join(last_parsed_filters.keys()).count(")")
            )
            fdqn_changed = current_fdqn_query != last_fdqn_query

            if filter_just_closed or fdqn_changed:
                last_parsed_filters = parsed_filters
                last_fdqn_query = current_fdqn_query
                if current_fdqn_query:
                    parsed_filters["__text__"] = current_fdqn_query.split()
                last_filtered_machines = [
                    m for m in machines if machine_matches(m, parsed_filters)
                ]

            filtered_machines = last_filtered_machines

        input_display = power_mode_input if power_mode else input_str
        draw_interface(
            stdscr, prompt, input_display, cursor_pos,
            suggestions, selected_index, filtered_machines
        )

        key = stdscr.getch()

        if not power_mode:
            last_input_before_power_mode = input_str

        if key in (27,):  # ESC
            break
        elif key == 9:  # TAB key
            power_mode = not power_mode
            if power_mode:
                # Entering Power User Mode
                parsed_filters = parse_filters(input_str)
                non_filter_parts = re.sub(r'\w+\([^)]+?\)', '', input_str).strip()
                if non_filter_parts:
                    parsed_filters["__text__"] = non_filter_parts.split()
                power_mode_input = filters_to_sql(parsed_filters)
            else:
                # Exiting Power User Mode, revert to last known input
                input_str = last_input_before_power_mode
                cursor_pos = len(input_str)
        elif not power_mode and key == curses.KEY_UP:
            selected_index = max(0, selected_index - 1)
        elif not power_mode and key == curses.KEY_DOWN:
            selected_index = min(len(suggestions) - 1, selected_index + 1)
        elif not power_mode and key in (10, 13):
            if suggestions:
                selected = suggestions[selected_index]
                if active_filter and not is_cursor_outside_parentheses(input_str, cursor_pos):
                    value_to_insert = selected
                    before = input_str.rsplit("(", 1)[0] + "("
                    existing_values = input_str.rsplit("(", 1)[1]
                    parts = [p.strip() for p in existing_values.split(",")]
                    parts[-1] = value_to_insert
                    new_inside = ", ".join(parts)
                    input_str = before + new_inside
                    cursor_pos = len(input_str)
                else:
                    current_word_start = input_str.rfind(' ', 0, cursor_pos) + 1
                    current_word_end = cursor_pos
                    new_filter = selected + "("
                    input_str = (
                        input_str[:current_word_start] +
                        new_filter +
                        input_str[current_word_end:]
                    )
                    cursor_pos = current_word_start + len(new_filter)
                selected_index = 0
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