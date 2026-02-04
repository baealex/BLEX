import json
import time
import hashlib
from collections import Counter
from typing import Dict, List, Any

from django.conf import settings
from django.db import connection, reset_queries
from django.utils.deprecation import MiddlewareMixin

from modules.sysutil import flush_print


class QueryDebugger(MiddlewareMixin):
    """
    Enhanced Query Debugger Middleware

    Features:
    - Per-endpoint query tracking
    - Slow query detection
    - Duplicate query detection (N+1 pattern)
    - Query time analysis
    - Colored console output

    Settings (in settings.py):
        QUERY_DEBUG_ENABLED = True  # Enable/disable
        QUERY_DEBUG_SLOW_THRESHOLD = 0.1  # Slow query threshold (seconds)
        QUERY_DEBUG_WARN_THRESHOLD = 10  # Warn if queries exceed this count
        QUERY_DEBUG_LOG_FILE = None  # Optional: path to JSON log file
    """

    # ANSI color codes
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'reset': '\033[0m',
        'bold': '\033[1m',
    }

    def __init__(self, get_response=None):
        super().__init__(get_response)
        self.slow_threshold = getattr(settings, 'QUERY_DEBUG_SLOW_THRESHOLD', 0.1)
        self.warn_threshold = getattr(settings, 'QUERY_DEBUG_WARN_THRESHOLD', 10)
        self.log_file = getattr(settings, 'QUERY_DEBUG_LOG_FILE', None)

    def _color(self, text: str, color: str) -> str:
        """Apply color to text"""
        return f"{self.COLORS.get(color, '')}{text}{self.COLORS['reset']}"

    def _get_query_hash(self, sql: str) -> str:
        """Generate hash for query pattern (ignoring specific values)"""
        import re
        # Replace specific values with placeholders
        normalized = re.sub(r"'[^']*'", "'?'", sql)
        normalized = re.sub(r'\b\d+\b', '?', normalized)
        return hashlib.md5(normalized.encode()).hexdigest()[:8]

    def _analyze_queries(self, queries: List[Dict]) -> Dict[str, Any]:
        """Analyze queries for patterns and issues"""
        analysis = {
            'total_count': len(queries),
            'total_time': 0,
            'slow_queries': [],
            'duplicate_queries': [],
            'query_types': Counter(),
            'tables_accessed': Counter(),
        }

        query_patterns = Counter()
        query_examples = {}

        for query in queries:
            sql = query.get('sql', '')
            time_taken = float(query.get('time', 0))

            analysis['total_time'] += time_taken

            # Detect query type
            query_type = sql.split()[0].upper() if sql else 'UNKNOWN'
            analysis['query_types'][query_type] += 1

            # Detect tables (simple pattern matching)
            import re
            tables = re.findall(r'FROM\s+[`"]?(\w+)[`"]?', sql, re.IGNORECASE)
            tables += re.findall(r'JOIN\s+[`"]?(\w+)[`"]?', sql, re.IGNORECASE)
            for table in tables:
                analysis['tables_accessed'][table] += 1

            # Track slow queries
            if time_taken >= self.slow_threshold:
                analysis['slow_queries'].append({
                    'sql': sql[:200] + '...' if len(sql) > 200 else sql,
                    'time': time_taken,
                })

            # Track duplicate patterns
            pattern_hash = self._get_query_hash(sql)
            query_patterns[pattern_hash] += 1
            if pattern_hash not in query_examples:
                query_examples[pattern_hash] = sql[:150] + '...' if len(sql) > 150 else sql

        # Find duplicates (potential N+1)
        for pattern_hash, count in query_patterns.items():
            if count > 1:
                analysis['duplicate_queries'].append({
                    'count': count,
                    'example': query_examples[pattern_hash],
                })

        # Sort duplicates by count
        analysis['duplicate_queries'].sort(key=lambda x: x['count'], reverse=True)

        return analysis

    def _format_output(self, request, response, analysis: Dict[str, Any], elapsed: float) -> str:
        """Format the debug output"""
        lines = []

        # Header
        lines.append('')
        lines.append(self._color('=' * 80, 'cyan'))
        lines.append(self._color(f' QUERY DEBUG: {request.method} {request.path}', 'bold'))
        lines.append(self._color('=' * 80, 'cyan'))

        # Summary
        query_count = analysis['total_count']
        query_time = analysis['total_time']

        # Color code based on severity
        if query_count > self.warn_threshold * 2:
            count_color = 'red'
            status = '🔴 CRITICAL'
        elif query_count > self.warn_threshold:
            count_color = 'yellow'
            status = '🟡 WARNING'
        else:
            count_color = 'green'
            status = '🟢 OK'

        lines.append(f'')
        lines.append(f'  Status: {status}')
        lines.append(f'  Response: {response.status_code}')
        lines.append(f'  Total Time: {self._color(f"{elapsed:.3f}s", "blue")}')
        lines.append(f'  Query Count: {self._color(str(query_count), count_color)}')
        lines.append(f'  Query Time: {self._color(f"{query_time:.3f}s", "blue")} ({query_time/elapsed*100:.1f}% of total)')

        # Query type breakdown
        if analysis['query_types']:
            lines.append(f'')
            lines.append(self._color('  Query Types:', 'white'))
            for qtype, count in analysis['query_types'].most_common():
                lines.append(f'    {qtype}: {count}')

        # Tables accessed
        if analysis['tables_accessed']:
            lines.append(f'')
            lines.append(self._color('  Tables Accessed:', 'white'))
            for table, count in analysis['tables_accessed'].most_common(5):
                lines.append(f'    {table}: {count}')

        # Duplicate queries (N+1 warning)
        if analysis['duplicate_queries']:
            lines.append(f'')
            lines.append(self._color('  ⚠️  Duplicate Queries (Potential N+1):', 'yellow'))
            for dup in analysis['duplicate_queries'][:3]:  # Show top 3
                lines.append(f'    {self._color(f"×{dup['count']}", "red")}: {dup["example"][:60]}...')

        # Slow queries
        if analysis['slow_queries']:
            lines.append(f'')
            lines.append(self._color(f'  🐌 Slow Queries (>{self.slow_threshold}s):', 'red'))
            for slow in analysis['slow_queries'][:3]:  # Show top 3
                lines.append(f'    {self._color(f"{slow['time']:.3f}s", "red")}: {slow["sql"][:60]}...')

        lines.append(self._color('=' * 80, 'cyan'))
        lines.append('')

        return '\n'.join(lines)

    def _log_to_file(self, request, response, analysis: Dict[str, Any], elapsed: float):
        """Log to JSON file for later analysis"""
        if not self.log_file:
            return

        log_entry = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'method': request.method,
            'path': request.path,
            'status_code': response.status_code,
            'elapsed_time': round(elapsed, 4),
            'query_count': analysis['total_count'],
            'query_time': round(analysis['total_time'], 4),
            'query_types': dict(analysis['query_types']),
            'tables_accessed': dict(analysis['tables_accessed']),
            'duplicate_count': len(analysis['duplicate_queries']),
            'slow_query_count': len(analysis['slow_queries']),
        }

        try:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception:
            pass  # Silently fail if can't write

    def process_request(self, request):
        reset_queries()
        self.start = time.perf_counter()

    def process_response(self, request, response):
        # Skip if disabled
        if not getattr(settings, 'QUERY_DEBUG_ENABLED', settings.DEBUG):
            return response

        # Skip static files and admin
        skip_paths = ['/static/', '/media/', '/__debug__/', '/favicon.ico']
        if any(request.path.startswith(p) for p in skip_paths):
            return response

        elapsed = time.perf_counter() - self.start
        queries = connection.queries.copy()

        # Analyze queries
        analysis = self._analyze_queries(queries)

        # Output to console
        output = self._format_output(request, response, analysis, elapsed)
        flush_print(output)

        # Log to file
        self._log_to_file(request, response, analysis, elapsed)

        return response


class QueryDebuggerSimple(MiddlewareMixin):
    """
    Simple version - just counts queries (for production monitoring)
    Only logs if query count exceeds threshold
    """

    def process_request(self, request):
        reset_queries()
        self.start = time.perf_counter()

    def process_response(self, request, response):
        elapsed = time.perf_counter() - self.start
        query_count = len(connection.queries)

        threshold = getattr(settings, 'QUERY_DEBUG_WARN_THRESHOLD', 20)

        if query_count > threshold:
            flush_print(
                f'[QUERY WARNING] {request.method} {request.path} '
                f'- {query_count} queries in {elapsed:.2f}s'
            )

        return response
