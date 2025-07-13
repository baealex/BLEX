from django.test import TestCase, Client, RequestFactory
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.template import Context, Template
from board.models import Post, Tag, PostConfig, Series
from board.templatetags.pagination_tags import get_pagination_url, get_pagination_base_url

User = get_user_model()

class PaginationTemplateTagsTest(TestCase):
    """Test cases for pagination template tags"""
    
    def setUp(self):
        """Set up test data for template tags tests"""
        self.factory = RequestFactory()
    
    def test_get_pagination_url(self):
        """Test get_pagination_url template tag"""
        # Create a request with query parameters
        request = self.factory.get('/?category=all&sort=recent')
        context = Context({'request': request})
        
        # Test the template tag directly
        url = get_pagination_url(context, 2)
        self.assertEqual(url, '?category=all&sort=recent&page=2')
        
        # Test with existing page parameter
        request = self.factory.get('/?category=all&sort=recent&page=1')
        context = Context({'request': request})
        url = get_pagination_url(context, 3)
        self.assertEqual(url, '?category=all&sort=recent&page=3')
    
    def test_get_pagination_base_url(self):
        """Test get_pagination_base_url template tag"""
        # Create a request with query parameters
        request = self.factory.get('/?category=all&sort=recent')
        context = Context({'request': request})
        
        # Test the template tag directly
        url = get_pagination_base_url(context)
        self.assertEqual(url, '?category=all&sort=recent&page=')
        
        # Test with existing page parameter
        request = self.factory.get('/?category=all&sort=recent&page=1')
        context = Context({'request': request})
        url = get_pagination_base_url(context)
        self.assertEqual(url, '?category=all&sort=recent&page=')
        
        # Test with no query parameters
        request = self.factory.get('/')
        context = Context({'request': request})
        url = get_pagination_base_url(context)
        self.assertEqual(url, '?page=')


class PaginationComponentTest(TestCase):
    """Test cases for pagination component"""
    
    def setUp(self):
        """Set up test data for pagination component tests"""
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
    
    def test_pagination_component_rendering(self):
        """Test that pagination component renders correctly"""
        # Test index view with pagination
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        
        # Check if pagination component is rendered
        self.assertContains(response, 'pagination-nav')
        self.assertContains(response, 'pagination-pages')
        
        # Test with page 2
        response = self.client.get(reverse('index') + '?page=2')
        self.assertEqual(response.status_code, 200)
        
        # Check if active page is highlighted
        self.assertContains(response, 'pagination-active')
        
        # Check if previous arrow is enabled on page 2
        self.assertNotContains(response, '<div class="pagination-item pagination-disabled">\n            <span class="pagination-link">\n                <i class="fas fa-angle-left">')
        
        # Test with last page
        # Assuming 24 posts per page, with 50 posts we should have 3 pages
        response = self.client.get(reverse('index') + '?page=3')
        self.assertEqual(response.status_code, 200)
        
        # Check if next arrow is disabled on last page
        self.assertContains(response, '<div class="pagination-item pagination-disabled">\n                <span class="pagination-link">\n                    <i class="fas fa-angle-right">')
    
    def test_pagination_with_query_parameters(self):
        """Test pagination with query parameters"""
        # Test with multiple query parameters
        response = self.client.get('/board/?category=all&sort=recent&page=2')
        self.assertEqual(response.status_code, 200)
        
        # Check if pagination links contain the query parameters
        self.assertContains(response, 'category=all')
        self.assertContains(response, 'sort=recent')
        
        # Check if page=1 link exists and contains the query parameters
        self.assertContains(response, 'category=all&sort=recent&page=1')
        
        # Check if page=3 link exists and contains the query parameters
        self.assertContains(response, 'category=all&sort=recent&page=3')
    
    def test_button_style_pagination(self):
        """Test button style pagination"""
        # Create a template to test the button style pagination
        template = Template("""
            {% load pagination_tags %}
            {% include 'components/pagination.html' with style='button' page=1 last=3 %}
        """)
        
        # Create a request with query parameters
        request = self.factory.get('/?category=all&sort=recent')
        context = Context({'request': request})
        
        # Render the template
        rendered = template.render(context)
        
        # Check if button style pagination is rendered
        self.assertIn('pagination-container button', rendered)
        self.assertIn('load-more-button', rendered)
        self.assertIn('더 불러오기', rendered)
        
        # Check if the link contains the query parameters
        self.assertIn('category=all&sort=recent&page=2', rendered)
