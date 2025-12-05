"""
유틸리티 실행 결과를 담는 클래스
"""
from typing import List, Dict, Any, Tuple


class UtilityResult:
    """유틸리티 실행 결과를 담는 클래스"""

    def __init__(self):
        self.messages: List[Tuple[str, str]] = []  # (type, message)
        self.statistics: Dict[str, Any] = {}
        self.files: List[Dict[str, Any]] = []  # 파일 정보 목록

    def add_message(self, msg_type: str, message: str):
        """메시지 추가 (info, success, warning, error)"""
        self.messages.append((msg_type, message))

    def add_statistic(self, key: str, value: Any):
        """통계 정보 추가"""
        self.statistics[key] = value
