class UsernameConverter:
    regex = r'@?[\w.@+-]+'  # Match usernames with or without @ prefix
    
    def to_python(self, value):
        # Remove @ if it exists at the beginning
        return value[1:] if value.startswith('@') else value
    
    def to_url(self, value):
        # Always add @ to the beginning for URLs
        return f'@{value}' if not value.startswith('@') else value
