from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model
from board.models import Post, Tag, PostConfig, Series

User = get_user_model()

class MainViewsTest(TestCase):
    """Test cases for main views"""
    
    def setUp(self):
        """Set up test data for main views"""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # Create test tags
        self.tag1 = Tag.objects.create(value='django')
        self.tag2 = Tag.objects.create(value='python')
        
        # Create test posts
        for i in range(30):  # Create enough posts for pagination
            post = Post.objects.create(
                title=f'Test Post {i}',
                author=self.user,
                content=f'Test content for post {i}',
                created_date='2023-01-01T00:00:00Z',
                updated_date='2023-01-01T00:00:00Z',
            )
            post_config = PostConfig.objects.create(
                post=post,
                hide=False,
                url=f'test-post-{i}',
                description=f'Test description {i}',
                notice=False,
                advertise=False
            )
            post.tags.add(self.tag1 if i % 2 == 0 else self.tag2)
        
        # Create client
        self.client = Client()
    
    def test_index_view(self):
        """Test index view renders correctly"""
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/index.html')
        self.assertIn('posts', response.context)
        self.assertIn('page_number', response.context)
        self.assertIn('page_count', response.context)
        
        # Test pagination
        self.assertEqual(response.context['page_number'], 1)
        
        # Test with page parameter
        response = self.client.get(reverse('index') + '?page=2')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 2)
    
    def test_tag_list_view(self):
        """Test tag list view renders correctly"""
        response = self.client.get(reverse('tag_list'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/tag_list.html')
        self.assertIn('tags', response.context)
        self.assertIn('page_number', response.context)
        self.assertIn('page_count', response.context)
        
        # Verify tags are in the context
        self.assertEqual(len(response.context['tags']), 2)
        
        # Test with page parameter
        response = self.client.get(reverse('tag_list') + '?page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 1)


class AuthorViewsTest(TestCase):
    """Test cases for author views"""
    
    def setUp(self):
        """Set up test data for author views"""
        # Create test users
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # Create test posts
        for i in range(10):
            post = Post.objects.create(
                title=f'Test Post {i}',
                author=self.user,
                content=f'Test content for post {i}',
                created_date='2023-01-01T00:00:00Z',
                updated_date='2023-01-01T00:00:00Z',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                url=f'test-post-{i}',
                description=f'Test description {i}',
                notice=False,
                advertise=False
            )
        
        # Create client
        self.client = Client()
    
    def test_author_view(self):
        """Test author view renders correctly"""
        response = self.client.get(reverse('author', args=['testuser']))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/author/author.html')
        self.assertIn('posts', response.context)
        self.assertIn('author', response.context)
        self.assertIn('page_number', response.context)
        self.assertIn('page_count', response.context)
        
        # Test pagination
        response = self.client.get(reverse('author', args=['testuser']) + '?page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 1)
        
        # Test with query parameters
        response = self.client.get(reverse('author', args=['testuser']) + '?category=all&page=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['page_number'], 1)


class PaginationTest(TestCase):
    """Test pagination functionality across views"""
    
    def setUp(self):
        """Set up test data for pagination tests"""
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # Create test posts (50 posts to test pagination)
        for i in range(50):
            post = Post.objects.create(
                title=f'Test Post {i}',
                author=self.user,
                content=f'Test content for post {i}',
                created_date='2023-01-01T00:00:00Z',
                updated_date='2023-01-01T00:00:00Z',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                url=f'test-post-{i}',
                description=f'Test description {i}',
                notice=False,
                advertise=False
            )
        
        # Create client
        self.client = Client()
    
    def test_pagination_preserves_query_params(self):
        """Test that pagination preserves query parameters"""
        # Test index view with query parameters
        response = self.client.get('/board/?category=all&sort=recent&page=1')
        self.assertEqual(response.status_code, 200)
        
        # Check if the pagination links in the rendered HTML contain the query parameters
        self.assertContains(response, 'category=all')
        self.assertContains(response, 'sort=recent')
        
        # Test author view with query parameters
        response = self.client.get('/board/author/testuser/?category=series&page=1')
        self.assertEqual(response.status_code, 200)
        
        # Check if the pagination links in the rendered HTML contain the query parameters
        self.assertContains(response, 'category=series')
