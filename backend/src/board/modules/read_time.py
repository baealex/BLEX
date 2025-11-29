import readtime

def calc_read_time(html):
    """
    Calculate reading time for HTML content using readtime library.
    Returns reading time in minutes (rounded to nearest integer, minimum 1 minute).
    """
    if not html or not html.strip():
        return 1

    result = readtime.of_html(html)
    # Return minutes, with minimum of 1 minute
    return max(1, round(result.minutes))
