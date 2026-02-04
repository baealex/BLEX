# Testing Guide

> "Tests exist to catch bugs, not to hit coverage numbers."

## Philosophy

We embrace **pragmatic testing**:
- Minimize build time and feedback loops
- Test only where bugs are likely to occur
- Write tests with low maintenance cost

---

## Test Structure

```
backend/src/board/tests/
├── api/                    # API integration tests
│   ├── test_auth.py        # Authentication
│   ├── test_post.py        # Post CRUD
│   ├── test_comment.py     # Comment CRUD
│   ├── test_series_api.py  # Series CRUD
│   ├── test_setting.py     # User settings
│   ├── test_temp_post.py   # Temp posts
│   └── ...
├── templates/              # Template rendering tests
│   ├── test_main.py
│   ├── test_post_detail.py
│   └── ...
└── test_utils.py           # Utility function tests
```

### Why This Structure?

**API tests cover the service layer implicitly.**

```
[API Endpoint] → [View] → [Service] → [Model]
     ↑
   Test here
```

Testing at API level:
- Tests the same path as real user scenarios
- No need to mock Services, reducing maintenance cost
- Resistant to refactoring (internal changes don't break tests)

---

## What to Test

### Must Test

1. **CRUD Operations**
   - Verify create/update/delete actually persists to DB
   ```python
   def test_delete_comment(self):
       response = self.client.delete(f'/v1/comments/{comment_id}')
       comment.refresh_from_db()
       self.assertIsNone(comment.author)  # Verify soft delete
   ```

2. **Authorization**
   - Block access to other users' data
   ```python
   def test_delete_comment_not_author(self):
       self.client.login(username='other', password='test')
       response = self.client.delete(f'/v1/comments/{comment.id}')
       self.assertEqual(content['status'], 'ERROR')
   ```

3. **Business Logic**
   - Conditional behavior, state changes, calculations
   ```python
   def test_create_temp_post_updates_existing(self):
       # Same content → updates existing post
       self.assertEqual(first_token, second_token)
   ```

4. **Security**
   - Authentication, password changes, token validation
   ```python
   def test_change_password_wrong_current(self):
       # Wrong current password → should fail
   ```

5. **Error Handling**
   - Invalid inputs, non-existent resources
   ```python
   def test_get_nonexistent_series(self):
       response = self.client.get('/v1/users/@author/series/nonexistent')
       self.assertEqual(response.status_code, 404)
   ```

### Don't Test

1. **Simple Getters/Setters**
   ```python
   # BAD: Testing framework functionality
   def test_get_user_profile_data(self):
       data = UserService.get_user_profile_data(user)
       self.assertEqual(data['username'], user.username)
   ```

2. **Django/ORM Basic Operations**
   ```python
   # BAD: Testing if ORM works
   def test_user_save(self):
       user.save()
       self.assertTrue(User.objects.filter(id=user.id).exists())
   ```

3. **External Services (Use Mocks)**
   ```python
   # Discord webhooks, email sending, etc. should be mocked
   @patch('modules.discord.Discord.send_webhook')
   def test_create_post(self, mock_webhook):
       ...
   ```

4. **Private Methods**
   - Covered indirectly through public API tests

---

## Writing Tests

### Naming Convention

```python
def test_<action>_<target>_<condition>(self):
    """Description in Korean for Korean developers"""
```

Examples:
```python
def test_delete_comment(self):
    """댓글 삭제 테스트"""

def test_delete_comment_not_author(self):
    """본인이 아닌 댓글 삭제 시도 시 실패"""

def test_create_temp_post_empty_title(self):
    """빈 제목으로 임시 포스트 생성 시 기본 제목 설정"""
```

### Test Structure (AAA Pattern)

```python
def test_edit_comment(self):
    """댓글 수정 테스트"""
    # Arrange
    comment = Comment.objects.last()
    self.client.login(username='viewer', password='test')

    # Act
    response = self.client.put(
        f'/v1/comments/{comment.id}',
        'edit=edit&comment_md=Edited'
    )

    # Assert
    comment.refresh_from_db()
    self.assertEqual(comment.text_md, 'Edited')
    self.assertTrue(comment.edited)
```

### Setup Data

`setUpTestData` runs once per class (fast):
```python
@classmethod
def setUpTestData(cls):
    cls.user = User.objects.create_user(...)
    cls.post = Post.objects.create(...)
```

`setUp` runs before each test (when isolation needed):
```python
def setUp(self):
    self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
```

### Assertions

```python
# Status code
self.assertEqual(response.status_code, 200)

# API response
content = json.loads(response.content)
self.assertEqual(content['status'], 'DONE')
self.assertEqual(content['status'], 'ERROR')

# DB state
self.assertTrue(Post.objects.filter(url='test').exists())
self.assertFalse(Post.objects.filter(url='test').exists())

# Object attributes (refresh required!)
comment.refresh_from_db()
self.assertEqual(comment.text_md, 'Updated')
```

---

## Running Tests

```bash
# All tests
npm run server:test

# Specific app
./scripts/manage.sh test board

# Specific file
./scripts/manage.sh test board.tests.api.test_comment

# Specific case
./scripts/manage.sh test board.tests.api.test_comment.CommentTestCase.test_edit_comment

# Fast run (reuse DB)
./scripts/manage.sh test board --keepdb

# Parallel execution
./scripts/manage.sh test board --parallel
```

---

## Coverage

```bash
# Measure coverage
cd backend/src
source mvenv/bin/activate
pip install coverage

coverage run --source='board/services' manage.py test board
coverage report -m
```

### Coverage Goals

| Layer | Target | Note |
|-------|--------|------|
| Services | 70-80% | Focus on business logic |
| Views | 60-70% | Covered by API tests |
| Models | 50-60% | Only complex methods |

**Warning:** Don't aim for 100%. ROI drops sharply above 80%.

---

## Anti-Patterns

### 1. Over-Mocking
```python
# BAD: Mock everything
@patch('service.method1')
@patch('service.method2')
@patch('service.method3')
def test_something(self, m1, m2, m3):
    ...

# GOOD: Mock only external dependencies
@patch('modules.discord.Discord.send_webhook')
def test_create_post(self, mock_webhook):
    ...
```

### 2. Test Interdependence
```python
# BAD: Test order matters
def test_1_create(self):
    Post.objects.create(url='test')

def test_2_read(self):
    post = Post.objects.get(url='test')  # Depends on test_1

# GOOD: Independent
def test_read(self):
    post = Post.objects.create(url='test')
    ...
```

### 3. Testing Implementation Details
```python
# BAD: Testing internal calls
def test_service_calls_repository(self):
    with patch('repository.save') as mock:
        service.create()
        mock.assert_called_once()

# GOOD: Testing outcomes
def test_create_post(self):
    response = self.client.post('/v1/posts', data)
    self.assertTrue(Post.objects.filter(title='Test').exists())
```

---

## Adding New Tests

When adding a new feature:

1. **Happy Path** - Normal operation works
2. **Authorization** - Not logged in, other user access
3. **Error Cases** - Invalid input, missing resource

```python
# Example: New "Bookmark" feature
class BookmarkTestCase(TestCase):
    def test_add_bookmark(self):
        """북마크 추가"""

    def test_add_bookmark_not_logged_in(self):
        """비로그인 시 북마크 추가 실패"""

    def test_add_bookmark_already_bookmarked(self):
        """이미 북마크된 포스트 재추가 시 처리"""

    def test_remove_bookmark(self):
        """북마크 삭제"""

    def test_remove_bookmark_not_owner(self):
        """타인의 북마크 삭제 시도 실패"""
```

---

## CI Integration

Tests run automatically on every PR. Failing tests block merge.

```yaml
# .github/workflows/test.yml
- name: Run Tests
  run: npm run server:test
```
