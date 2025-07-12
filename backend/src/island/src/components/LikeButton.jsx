import React, { useState } from 'react';
import styles from './LikeButton.module.scss';

/**
 * 게시글 좋아요 버튼 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.postId - 게시글 ID
 * @param {number} props.likesCount - 초기 좋아요 수
 * @param {boolean} props.hasLiked - 사용자가 이미 좋아요를 눌렀는지 여부
 */
const LikeButton = ({ postId, likesCount, hasLiked }) => {
  const [count, setCount] = useState(likesCount);
  const [liked, setLiked] = useState(hasLiked);
  const [isLoading, setIsLoading] = useState(false);

  const handleLike = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // CSRF 토큰 가져오기
      const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
      };
      
      const response = await fetch(`/like/${postId}`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setCount(data.count_likes);
        setLiked(data.has_liked);
      } else {
        console.error('Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleLike}
      className={`${styles.likeButton} ${liked ? styles.liked : ''} ${isLoading ? styles.loading : ''}`}
      disabled={isLoading}
    >
      <i className={`fas fa-heart ${styles.icon} ${liked ? styles.liked : ''}`}></i>
      <span className={styles.count}>{count}</span>
    </button>
  );
};

export default LikeButton;
